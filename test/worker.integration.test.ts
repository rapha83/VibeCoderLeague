import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { createApp, runScheduledSync, syncConsent, SyncWorkBudget, type Env } from "../src/worker";

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

  it("returns a safe anonymous session contract with the GitHub authorization route", async () => {
    const { mf, bindings } = await fixture(); fixtures.push(mf);
    const response = await request("/api/session", bindings);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ authenticated: false, connectUrl: "/api/auth/github" });
  });

  it("fails OAuth initiation safely when the session encryption configuration is unusable", async () => {
    const { mf, bindings } = await fixture(); fixtures.push(mf);
    const response = await request("/api/auth/github", { ...bindings, SESSION_ENCRYPTION_KEY_BASE64: btoa("too-short") });
    expect(response.status).toBe(503); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "oauth_configuration_invalid", category: "session_encryption" });
    expect(response.headers.get("Location")).toBeNull(); expect(response.headers.get("Set-Cookie")).toBeNull();
  });

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

  it("returns safe correlated completion failures for each boundary without exposing sentinels", async () => {
    const sentinel = "oauth-completion-sentinel";
    const begin = async (bindings: Env) => {
      const start = await request("/api/auth/github", bindings);
      return { bindings, transaction: cookieValue(start, "__Host-vcl-oauth")!, state: new URL(start.headers.get("Location")!).searchParams.get("state")! };
    };
    const callback = ({ bindings, transaction, state }: { bindings: Env; transaction: string; state: string }) => request(`/api/auth/github/callback?state=${state}&code=code`, bindings, { Cookie: transaction });
    const viewer = { node_id: "u1", login: "octo", avatar_url: null };
    const completeFetch = vi.fn(async (url: string) => url.includes("access_token") ? new Response(JSON.stringify({ access_token: "token" })) : new Response(JSON.stringify(viewer)));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const assertFailure = async (response: Response, stage: "viewer" | "session_encryption" | "session_persistence", viewer?: { category: string; status: number }) => {
      expect(response.status).toBe(502);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("X-OAuth-Completion-Id")).toBeNull();
      expect(response.headers.get("X-OAuth-Completion-Stage")).toBeNull();
      const body = await response.json() as { error: string; stage: string; correlation_id: string };
      expect(body.error).toBe("oauth_completion_failed");
      expect(body.stage).toBe(stage);
      expect(body.correlation_id).toMatch(/^[a-f0-9]{64}$/);
      expect(body.viewer).toEqual(viewer);
      expect(response.headers.getSetCookie()).toContainEqual(expect.stringContaining("__Host-vcl-oauth=;"));
      expect(response.headers.getSetCookie()).toContainEqual(expect.stringContaining("Max-Age=0"));
      expect(response.headers.getSetCookie().some(value => value.startsWith("__Host-vcl="))).toBe(false);
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith({ event: "oauth_completion_failed", stage, completionId: body.correlation_id, ...(viewer ? { viewer } : {}) });
      expect(error.mock.calls[0]).toHaveLength(1);
      expect(JSON.stringify({ body, headers: Array.from(response.headers.entries()), console: error.mock.calls })).not.toContain(sentinel);
      error.mockClear();
    };

    {
      const { mf, bindings } = await fixture(); fixtures.push(mf);
      vi.stubGlobal("fetch", completeFetch);
      const response = await callback(await begin(bindings));
      expect(response.status).toBe(302);
      expect(response.headers.get("X-OAuth-Completion-Id")).toBeNull();
      expect(response.headers.get("X-OAuth-Completion-Stage")).toBeNull();
      expect(response.headers.getSetCookie()).toContainEqual(expect.stringContaining("__Host-vcl="));
      expect(error).not.toHaveBeenCalled();
    }
    {
      const { mf, bindings } = await fixture(); fixtures.push(mf);
      vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("access_token") ? new Response(JSON.stringify({ access_token: "token" })) : new Response(sentinel, { status: 503 })));
      await assertFailure(await callback(await begin(bindings)), "viewer", { category: "http_error", status: 503 });
    }
    {
      const { mf, bindings } = await fixture(); fixtures.push(mf);
      vi.stubGlobal("fetch", completeFetch);
      const started = await begin(bindings);
      await assertFailure(await callback({ ...started, bindings: { ...bindings, SESSION_ENCRYPTION_KEY_BASE64: sentinel } }), "session_encryption");
    }
    {
      const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
      vi.stubGlobal("fetch", completeFetch);
      const started = await begin(bindings);
      const failingDB = { prepare(sql: string) { if (sql.startsWith("INSERT OR REPLACE INTO sessions")) return { bind: () => ({ run: async () => { throw new Error(sentinel); } }) }; return DB.prepare(sql); } } as unknown as D1Database;
      await assertFailure(await callback({ ...started, bindings: { ...bindings, DB: failingDB } }), "session_persistence");
    }
    error.mockRestore();
  });

  it("publishes only actively consenting public profiles and profile identifiers", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    await DB.batch([
      DB.prepare("INSERT INTO participants(github_id,github_login,display_name,public_profile_id,consent_active,updated_at) VALUES('u1','octo','Octo','profile-1',1,'2025-01-01T00:00:00Z'),('u2','hidden','Hidden','profile-2',0,'2025-01-01T00:00:00Z'),('u3','private','Private','profile-3',1,'2025-01-01T00:00:00Z')"),
      DB.prepare("INSERT INTO consents(github_id,repo_id,repo_name,installation_id,visibility,declared_tooling,declared_model,active,updated_at) VALUES('u1','r1','octo/public','i1','public','Cursor','Model A',1,'2025-01-01T00:00:00Z'),('u1','r4','octo/other-public','i4','public','Cursor','Model B',1,'2025-01-01T00:00:00Z'),('u1','r5','octo/private','i5','private','Private Tool','Private Model',1,'2025-01-01T00:00:00Z'),('u2','r2','hidden/public','i2','public','Hidden Tool','Hidden Model',1,'2025-01-01T00:00:00Z'),('u3','r3','private/private','i3','private','Private Tool','Private Model',1,'2025-01-01T00:00:00Z')"),
      DB.prepare("INSERT INTO pull_requests(pr_id,repo_id,repo_name,author_id,author_login,merged_at,month_utc,generation) VALUES('pr1','r1','octo/public','u1','octo','2025-01-10T00:00:00Z','2025-01',1),('pr4','r4','octo/other-public','u1','octo','2025-02-01T00:00:00Z','2025-02',1),('pr2','r2','hidden/public','u2','hidden','2025-01-10T00:00:00Z','2025-01',1),('pr3','r3','private/private','u3','private','2025-01-10T00:00:00Z','2025-01',1)")
    ]);
    const leaderboard = await request("/api/leaderboard?month=2025-01", bindings);
    expect(await leaderboard.json()).toEqual({ month: "2025-01", rows: [{ rank: 1, profileId: "profile-1", displayName: "Octo", repository: "octo/public", score: 1 }] });
    const profile = await request("/api/profiles/profile-1?month=2025-01", bindings);
    expect(profile.headers.get("Cache-Control")).toBe("no-store");
    expect(await profile.json()).toEqual({ id: "profile-1", displayName: "Octo", month: "2025-01", repositories: [{ repository: "octo/public", pullRequests: 1 }], declarations: { status: "self_declared_unverified", tooling: ["Cursor"], models: ["Model A", "Model B"] } });
    const februaryProfile = await request("/api/profiles/profile-1?month=2025-02", bindings);
    expect(await februaryProfile.json()).toMatchObject({ month: "2025-02", repositories: [{ repository: "octo/other-public", pullRequests: 1 }] });
    const invalidProfileMonth = await request("/api/profiles/profile-1?month=2025-13", bindings);
    expect(invalidProfileMonth.status).toBe(400);
    expect(invalidProfileMonth.headers.get("Cache-Control")).toBe("no-store");
    expect(await invalidProfileMonth.json()).toEqual({ error: "invalid_month" });
    for (const id of ["profile-2", "profile-3", "unknown"]) {
      const response = await request(`/api/profiles/${id}`, bindings);
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});

describe("scheduled sync budget integration", () => {
  const fixtures: Miniflare[] = [];
  afterEach(async () => { await Promise.all(fixtures.splice(0).map(mf => mf.dispose())); vi.unstubAllGlobals(); });
  const addConsents = async (DB: D1Database, ids: string[]) => DB.prepare(`INSERT INTO consents(github_id,repo_id,repo_name,installation_id,visibility,active,updated_at) VALUES ${ids.map(() => "(?,?,?,?, 'public',1,?)").join(",")}`).bind(...ids.flatMap((id, index) => [id, `r-${id}`, `octo/${id}`, `i-${id}`, `2025-01-0${index + 1}T00:00:00Z`])).run();

  it("uses one sequential budget across a cohort and defers the remaining consents to later runs", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    await addConsents(DB, ["u1", "u2", "u3", "u4"]);
    const calls: string[] = [], sync = async (_: Env, consent: { github_id: string }, _token: string, _pages: number, budget?: SyncWorkBudget) => { calls.push(consent.github_id); expect(budget?.tryConsume()).toBe(true); await DB.prepare("UPDATE consents SET updated_at=? WHERE github_id=?").bind(`2025-02-0${calls.length}T00:00:00Z`, consent.github_id).run(); };
    const mint = async (_app: string, _key: string, installation: string) => { calls.push(`token:${installation}`); return "token"; };
    await runScheduledSync(bindings, { budget: new SyncWorkBudget(4), mintToken: mint, sync });
    expect(calls).toEqual(["token:i-u1", "u1", "token:i-u2", "u2"]);
    await runScheduledSync(bindings, { budget: new SyncWorkBudget(4), mintToken: mint, sync });
    expect(calls.slice(4)).toEqual(["token:i-u3", "u3", "token:i-u4", "u4"]);
  });

  it("charges failures, continues sequentially, and marks only the failed consent unknown", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    await addConsents(DB, ["u1", "u2", "u3"]);
    const synced: string[] = [], mint = async (_app: string, _key: string, installation: string) => { if (installation === "i-u1") throw new Error("github_500"); return "token"; };
    const sync = async (_: Env, consent: { github_id: string }, _token: string, _pages: number, budget?: SyncWorkBudget) => { synced.push(consent.github_id); expect(budget?.tryConsume()).toBe(true); };
    await runScheduledSync(bindings, { budget: new SyncWorkBudget(4), mintToken: mint, sync });
    expect(synced).toEqual(["u2"]);
    expect(await DB.prepare("SELECT visibility FROM consents WHERE github_id='u1'").first()).toEqual({ visibility: "unknown" });
    expect(await DB.prepare("SELECT visibility FROM consents WHERE github_id='u3'").first()).toEqual({ visibility: "public" });
  });

  it("persists a cursor and clears its lease when the shared budget exhausts, then resumes on the next run", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    await addConsents(DB, ["u1"]);
    await DB.prepare("INSERT INTO participants(github_id,github_login,display_name,consent_active,updated_at) VALUES('u1','octo','Octo',1,'2025-01-01T00:00:00Z')").run();
    const cursors: Array<string | null> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const after = (JSON.parse(String(init?.body)).variables.after ?? null) as string | null; cursors.push(after);
      const first = after === null;
      return new Response(JSON.stringify({ data: { repository: { visibility: "PUBLIC", pullRequests: { nodes: [], pageInfo: { endCursor: first ? "cursor-1" : null, hasNextPage: first } } } } }));
    }));
    const consent = { github_id: "u1", repo_id: "r-u1", repo_name: "octo/u1", installation_id: "i-u1", declared_tooling: null, declared_model: null };
    await syncConsent(bindings, consent, "token", 2, new SyncWorkBudget(1));
    expect(await DB.prepare("SELECT cursor,status,lease_token,lease_until FROM sync_jobs WHERE github_id='u1' AND repo_id='r-u1'").first()).toEqual({ cursor: "cursor-1", status: "partial", lease_token: null, lease_until: null });
    await syncConsent(bindings, consent, "token", 2, new SyncWorkBudget(1));
    expect(cursors).toEqual([null, "cursor-1"]);
    expect(await DB.prepare("SELECT cursor,status,lease_token,lease_until FROM sync_jobs WHERE github_id='u1' AND repo_id='r-u1'").first()).toEqual({ cursor: null, status: "complete", lease_token: null, lease_until: null });
  });

  it("charges a failed page attempt and releases its lease so a later run can retry safely", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    await addConsents(DB, ["u1"]);
    const consent = { github_id: "u1", repo_id: "r-u1", repo_name: "octo/u1", installation_id: "i-u1", declared_tooling: null, declared_model: null };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    const budget = new SyncWorkBudget(1);
    await expect(syncConsent(bindings, consent, "token", 2, budget)).rejects.toThrow("github_503");
    expect(budget.remaining).toBe(0);
    expect(await DB.prepare("SELECT cursor,status,lease_token,lease_until FROM sync_jobs WHERE github_id='u1' AND repo_id='r-u1'").first()).toEqual({ cursor: null, status: "partial", lease_token: null, lease_until: null });
  });
});
