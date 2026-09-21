import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { createApp, type Env } from "../src/worker";

const migration = (name: string) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");
const origin = "https://league.example";
const env = (DB: D1Database): Env => ({ ASSETS: { fetch: () => new Response("asset") }, DB, PUBLIC_ORIGIN: origin, GITHUB_APP_ID: "app", GITHUB_APP_PRIVATE_KEY: "key", GITHUB_APP_CLIENT_ID: "client", GITHUB_APP_CLIENT_SECRET: "secret", SESSION_ENCRYPTION_KEY_BASE64: btoa("01234567890123456789012345678901") });

async function fixture() {
  const mf = new Miniflare({ modules: true, script: "export default { fetch(){ return new Response('ok') } }", d1Databases: { DB: ":memory:" }, compatibilityDate: "2024-12-18" });
  const DB = await mf.getD1Database("DB") as unknown as D1Database;
  for (const name of ["0001_initial.sql", "0002_rate_limits.sql", "0003_sync_job_leases.sql", "0004_oauth_transactions_and_public_profiles.sql"]) for (const statement of migration(name).split(";").map(sql => sql.replace(/^--.*$/gm, "").trim()).filter(Boolean)) await DB.prepare(statement).run();
  return { mf, DB, bindings: env(DB) };
}

const request = (path: string, bindings: Env, headers?: HeadersInit) => createApp().request(`${origin}${path}`, { headers }, bindings);
const cookieValue = (response: Response, name: string) => response.headers.getSetCookie().find(value => value.startsWith(`${name}=`))?.split(";")[0];

describe("worker OAuth and public profile integration", () => {
  const fixtures: Miniflare[] = [];
  afterEach(async () => { await Promise.all(fixtures.splice(0).map(mf => mf.dispose())); vi.unstubAllGlobals(); });

  it("binds OAuth state to a secure browser transaction and consumes it exactly once", async () => {
    const { mf, bindings } = await fixture(); fixtures.push(mf);
    const start = await request("/api/auth/github", bindings);
    const transaction = cookieValue(start, "__Host-vcl-oauth");
    const state = new URL(start.headers.get("Location")!).searchParams.get("state")!;
    expect(transaction).toMatch(/^__Host-vcl-oauth=[a-f0-9]{64}$/);
    expect(start.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(start.headers.get("Set-Cookie")).toContain("Secure");
    expect(start.headers.get("Set-Cookie")).toContain("SameSite=Lax");

    const missing = await request(`/api/auth/github/callback?state=${state}&code=code`, bindings);
    expect(missing.status).toBe(400);
    expect(missing.headers.get("Set-Cookie")).toContain("Max-Age=0");

    const mismatch = await request(`/api/auth/github/callback?state=${state}&code=code`, bindings, { Cookie: "__Host-vcl-oauth=wrong" });
    expect(mismatch.status).toBe(400);
    expect(await mismatch.json()).toEqual({ error: "oauth_state_invalid" });

    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("access_token") ? new Response(JSON.stringify({ access_token: "token" })) : new Response(JSON.stringify({ node_id: "u1", login: "octo", avatar_url: null }))));
    const completed = await request(`/api/auth/github/callback?state=${state}&code=code`, bindings, { Cookie: transaction! });
    expect(completed.status).toBe(302);
    expect(completed.headers.get("Set-Cookie")).toContain("__Host-vcl-oauth=");
    expect(completed.headers.get("Set-Cookie")).toContain("Max-Age=0");

    const reused = await request(`/api/auth/github/callback?state=${state}&code=code`, bindings, { Cookie: transaction! });
    expect(reused.status).toBe(400);
    expect(await reused.json()).toEqual({ error: "oauth_state_invalid" });
  });

  it("publishes only actively consenting public profiles and profile identifiers", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    await DB.batch([
      DB.prepare("INSERT INTO participants(github_id,github_login,display_name,public_profile_id,consent_active,updated_at) VALUES('u1','octo','Octo','profile-1',1,'2025-01-01T00:00:00Z'),('u2','hidden','Hidden','profile-2',0,'2025-01-01T00:00:00Z'),('u3','private','Private','profile-3',1,'2025-01-01T00:00:00Z')"),
      DB.prepare("INSERT INTO consents(github_id,repo_id,repo_name,installation_id,visibility,declared_tooling,declared_model,active,updated_at) VALUES('u1','r1','octo/public','i1','public','Cursor','Model A',1,'2025-01-01T00:00:00Z'),('u1','r4','octo/other-public','i4','public','Cursor','Model B',1,'2025-01-01T00:00:00Z'),('u1','r5','octo/private','i5','private','Private Tool','Private Model',1,'2025-01-01T00:00:00Z'),('u2','r2','hidden/public','i2','public','Hidden Tool','Hidden Model',1,'2025-01-01T00:00:00Z'),('u3','r3','private/private','i3','private','Private Tool','Private Model',1,'2025-01-01T00:00:00Z')"),
      DB.prepare("INSERT INTO pull_requests(pr_id,repo_id,repo_name,author_id,author_login,merged_at,month_utc,generation) VALUES('pr1','r1','octo/public','u1','octo','2025-01-10T00:00:00Z','2025-01',1),('pr2','r2','hidden/public','u2','hidden','2025-01-10T00:00:00Z','2025-01',1),('pr3','r3','private/private','u3','private','2025-01-10T00:00:00Z','2025-01',1)")
    ]);
    const leaderboard = await request("/api/leaderboard?month=2025-01", bindings);
    expect(await leaderboard.json()).toEqual({ month: "2025-01", rows: [{ rank: 1, profileId: "profile-1", displayName: "Octo", repository: "octo/public", score: 1 }] });
    const profile = await request("/api/profiles/profile-1", bindings);
    expect(profile.headers.get("Cache-Control")).toBe("no-store");
    expect(await profile.json()).toEqual({ id: "profile-1", displayName: "Octo", repositories: [{ repository: "octo/public", pullRequests: 1 }], declarations: { status: "self_declared_unverified", tooling: ["Cursor"], models: ["Model A", "Model B"] } });
    for (const id of ["profile-2", "profile-3", "unknown"]) {
      const response = await request(`/api/profiles/${id}`, bindings);
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});
