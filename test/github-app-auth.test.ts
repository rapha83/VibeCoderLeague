import { generateKeyPairSync, verify, constants } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GitHubRequestError, installationToken, resolveGitHubAppIssuer } from "../src/github";

// Generated only in memory. Never print keys, captured Authorization, or JWTs.
describe("GitHub App installation JWT contract", () => {
  let pem: string, pkcs1: string, publicKey: ReturnType<typeof generateKeyPairSync>["publicKey"];
  beforeAll(() => {
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    publicKey = pair.publicKey;
    pem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    pkcs1 = pair.privateKey.export({ type: "pkcs1", format: "pem" }).toString();
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([undefined, "", " \t\n"])("rejects an absent or blank issuer before signing or upstream access", async issuer => {
    const fetcher = vi.fn(async () => Response.json({ token: "synthetic" }, { status: 201 }));
    const sign = vi.spyOn(crypto.subtle, "sign");
    const importKey = vi.spyOn(crypto.subtle, "importKey");
    await expect(installationToken(issuer as string, pem, "42", fetcher as typeof fetch)).rejects.toMatchObject({ category: "configuration_error", status: 0, message: "github_request_failed" });
    expect(importKey).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    { bindings: { GITHUB_APP_CLIENT_ID: "synthetic-client-id" }, issuer: "synthetic-client-id" },
    { bindings: { GITHUB_APP_ID: "123456", GITHUB_APP_CLIENT_ID: "synthetic-client-id" }, issuer: "123456" },
    { bindings: { GITHUB_APP_ID: " \t", GITHUB_APP_CLIENT_ID: "synthetic-client-id" }, issuer: "synthetic-client-id" }
  ])("signs an independently verifiable RS256 JWT with resolved issuer", async ({ bindings, issuer }) => {
    const nowMs = Date.parse("2026-10-05T00:10:00.987Z"), now = Math.floor(nowMs / 1000);
    vi.spyOn(Date, "now").mockReturnValue(nowMs);
    let called = false;
    const fetcher = (async (input, init) => {
      called = true;
      expect(String(input)).toBe("https://api.github.com/app/installations/42/access_tokens");
      expect(init?.method).toBe("POST");
      const authorization = new Headers(init?.headers).get("Authorization") ?? "";
      // Boolean assertions prevent the runner from printing captured JWTs on failure.
      expect(authorization.startsWith("Bearer ")).toBe(true);
      const parts = authorization.slice(7).split(".");
      expect(parts.length).toBe(3);
      expect(parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))).toBe(true);
      const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      expect(header).toEqual({ alg: "RS256", typ: "JWT" });
      expect(claims.iss === issuer).toBe(true);
      expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "iss"]);
      expect(Number.isInteger(claims.iat) && Number.isInteger(claims.exp)).toBe(true);
      expect(claims.iat).toBe(now - 30);
      expect(claims.exp).toBe(now + 510);
      expect(claims.iat <= now && claims.exp > now && claims.exp <= now + 600).toBe(true);
      expect(verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), { key: publicKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(parts[2], "base64url"))).toBe(true);
      expect(verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}tampered`), { key: publicKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(parts[2], "base64url"))).toBe(false);
      return Response.json({ token: "synthetic-installation-token" }, { status: 201 });
    }) as typeof fetch;
    const result = await installationToken(resolveGitHubAppIssuer(bindings), pem, "42", fetcher);
    expect(result === "synthetic-installation-token").toBe(true);
    expect(called).toBe(true);
  });

  it.each([{}, { GITHUB_APP_ID: "", GITHUB_APP_CLIENT_ID: " \n" }])("rejects bindings without any nonempty issuer before upstream access", async bindings => {
    const fetcher = vi.fn();
    const exchange = async () => installationToken(resolveGitHubAppIssuer(bindings), pem, "42", fetcher as typeof fetch);
    await expect(exchange()).rejects.toMatchObject({ category: "configuration_error", status: 0, message: "github_request_failed" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["lf", "crlf", "whitespace"])("accepts PKCS#8 PEM with %s formatting", async format => {
    const formatted = format === "crlf" ? pem.replace(/\n/g, "\r\n") : format === "whitespace" ? ` \t\n${pem.replace(/\n/g, "\n \t")}\n ` : pem;
    const fetcher = vi.fn(async () => Response.json({ token: "synthetic" }, { status: 201 }));
    expect(await installationToken("synthetic", formatted, "42", fetcher as typeof fetch) === "synthetic").toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["pkcs1", "literal-newlines", "invalid-der"])("rejects %s locally, before any HTTP request", async format => {
    const unsupported = format === "pkcs1" ? pkcs1 : format === "literal-newlines" ? pem.replace(/\n/g, "\\n") : "-----BEGIN PRIVATE KEY-----\nYWJj\n-----END PRIVATE KEY-----";
    const fetcher = vi.fn();
    await expect(installationToken("synthetic", unsupported, "42", fetcher as typeof fetch)).rejects.toMatchObject({ category: "configuration_error", status: 0, message: "github_request_failed" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves only allowlisted upstream 401 diagnostics and never reads the body", async () => {
    const response = new Response("synthetic-sensitive-upstream-body", { status: 401 });
    const text = vi.spyOn(response, "text"), json = vi.spyOn(response, "json");
    let failure: unknown;
    try { await installationToken("synthetic", pem, "42", (async () => response) as typeof fetch); }
    catch (error) { failure = error; }
    expect(failure instanceof GitHubRequestError).toBe(true);
    expect(failure).toMatchObject({ category: "http_error", status: 401, message: "github_request_failed" });
    expect(Object.keys(failure as object).sort()).toEqual(["category", "status"]);
    expect((failure as Error).cause).toBeUndefined();
    expect(String(failure).includes("synthetic-sensitive-upstream-body")).toBe(false);
    expect(JSON.stringify(failure).includes("synthetic-sensitive-upstream-body")).toBe(false);
    expect(text).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(response.bodyUsed).toBe(false);
  });
});
