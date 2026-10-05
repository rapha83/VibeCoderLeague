import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubClient, installationToken } from "../src/github";

const repo = { id: "r1", nameWithOwner: "octo/public", visibility: "PUBLIC" };
const client = (data: unknown) => new GitHubClient("fake", (async () => Response.json(data)) as typeof fetch);
const connection = { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } };

describe("sync GitHub failures cannot become empty contributions", () => {
  afterEach(() => vi.useRealTimers());
  it.each([
    { errors: [{ message: "secret sentinel", type: "FORBIDDEN" }], data: { repository: null } },
    { errors: [{ message: "secret sentinel" }], data: { repository: { __typename: "Repository", id: "r1", nameWithOwner: "octo/public", visibility: "PUBLIC", pullRequests: connection } } }
  ])("rejects GraphQL errors including HTTP-200 partial data", async data => {
    await expect(client(data).pulls(repo, null)).rejects.toMatchObject({ category: "graphql_error", status: 200, message: "github_request_failed" });
    await expect(client(data).publicRepo(repo)).rejects.toMatchObject({ category: "graphql_error", status: 200 });
  });
  it.each([
    {}, { data: {} },
    { data: { repository: { __typename: "Repository", id: "r1", nameWithOwner: "octo/public", visibility: "PUBLIC", pullRequests: { pageInfo: connection.pageInfo } } } },
    { data: { repository: { __typename: "Repository", id: "r1", nameWithOwner: "octo/public", visibility: "PUBLIC", pullRequests: { ...connection, pageInfo: { hasNextPage: true, endCursor: null } } } } },
    { data: { repository: { __typename: "Repository", id: "r1", nameWithOwner: "octo/public", visibility: "PUBLIC", pullRequests: { ...connection, nodes: [{ id: "p", mergedAt: "invalid", author: null }] } } } }
  ])("rejects malformed pages rather than defaulting to zero", async data => {
    await expect(client(data).pulls(repo, null)).rejects.toMatchObject({ category: "invalid_response", status: 200 });
  });
  it.each([
    { __typename: "Repository", id: "other", nameWithOwner: "octo/new", visibility: "PUBLIC" },
    { __typename: "User", id: "r1", nameWithOwner: "octo/new", visibility: "PUBLIC" },
    { __typename: "Repository", id: "r1", nameWithOwner: "invalid", visibility: "PUBLIC" },
    {}
  ])("rejects mismatched ID/type/name as retryable errors, not retraction", async found => {
    await expect(client({ data: { repository: { ...found, pullRequests: connection } } }).pulls(repo, null)).rejects.toMatchObject({ category: "invalid_response" });
  });
  it("resolves metadata by immutable ID even when the stored name is stale", async () => {
    const fetcher = vi.fn(async (_url, init) => {
      expect(JSON.parse(String(init?.body)).variables).toEqual({ id: "r1" });
      expect(String(init?.body)).not.toContain("octo/public");
      return Response.json({ data: { repository: { __typename: "Repository", id: "r1", nameWithOwner: "octo/new", visibility: "PUBLIC" } } });
    });
    expect((await new GitHubClient("fake", fetcher as typeof fetch).publicRepo(repo)).nameWithOwner).toBe("octo/new");
  });
  it("accepts a valid empty page and excludes non-User fragment actors", async () => {
    await expect(client({ data: { repository: { __typename: "Repository", id: "r1", nameWithOwner: "octo/public", visibility: "PUBLIC", pullRequests: connection } } }).pulls(repo, null)).resolves.toEqual({ nameWithOwner: "octo/public", visibility: "PUBLIC", pulls: [], cursor: null, hasNext: false });
    const result = await client({ data: { repository: { __typename: "Repository", id: "r1", nameWithOwner: "octo/public", visibility: "PUBLIC", pullRequests: { ...connection, nodes: [{ id: "bot-pr", mergedAt: "2026-10-01T00:00:00Z", author: {} }] } } } }).pulls(repo, null);
    expect(result.pulls[0].author).toBeNull();
  });
  it("separates HTTP, malformed JSON, and transport failures without leaking messages", async () => {
    for (const status of [401, 403, 429, 500]) {
      const github = new GitHubClient("fake", (async () => new Response("secret sentinel", { status })) as typeof fetch);
      await expect(github.accessibleRepos()).rejects.toMatchObject({ category: "http_error", status, message: "github_request_failed" });
    }
    await expect(new GitHubClient("fake", (async () => new Response("secret sentinel")) as typeof fetch).accessibleRepos()).rejects.toMatchObject({ category: "invalid_json", status: 200 });
    await expect(new GitHubClient("fake", (async () => { throw new Error("secret sentinel"); }) as typeof fetch).accessibleRepos()).rejects.toMatchObject({ category: "transport_error", status: 0 });
    await expect(client({}).accessibleRepos()).rejects.toMatchObject({ category: "invalid_response" });
  });
  it("aborts a stalled sync metadata request after ten seconds", async () => {
    vi.useFakeTimers();
    const github = new GitHubClient("fake", ((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("secret sentinel")));
    })) as typeof fetch);
    const assertion = expect(github.accessibleRepos()).rejects.toMatchObject({ category: "timeout", status: 0 });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("classifies unusable installation signing configuration without exposing the key", async () => {
    await expect(installationToken("fake", "fake-not-a-key", "42")).rejects.toMatchObject({ category: "configuration_error", status: 0, message: "github_request_failed" });
  });
  it("requires explicit repository visibility and valid installation metadata", async () => {
    const github = new GitHubClient("fake", (async (url: string) => Response.json(url.endsWith("/user/installations") ? { installations: [{ id: 42 }] } : { repositories: [{ node_id: "r1", full_name: "octo/public" }] })) as typeof fetch);
    await expect(github.accessibleRepos()).rejects.toMatchObject({ category: "invalid_response", status: 200 });
    await expect(client({ installations: [{}] }).accessibleRepos()).rejects.toMatchObject({ category: "invalid_response" });
  });
  it("validates installation exchange HTTP errors and missing token using a synthetic signing key", async () => {
    const key = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey("pkcs8", key.privateKey))))}\n-----END PRIVATE KEY-----`;
    await expect(installationToken("fake", pem, "42", (async () => new Response("sensitive payload", { status: 401 })) as typeof fetch)).rejects.toMatchObject({ category: "http_error", status: 401 });
    await expect(installationToken("fake", pem, "42", (async () => Response.json({}, { status: 201 })) as typeof fetch)).rejects.toMatchObject({ category: "invalid_response", status: 201 });
    await expect(installationToken("fake", pem, "42", (async () => Response.json({ token: "fake" }, { status: 201 })) as typeof fetch)).resolves.toBe("fake");
  });
});
