import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import worker, { createApp, runScheduledSync, syncConsent, SyncWorkBudget, type Env } from "../src/worker";

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

  it("guards old-origin root, assets, APIs and callback before any state or fetch access", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const assets = vi.fn(() => new Response("asset")); bindings.ASSETS = { fetch: assets };
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
    for (const path of ["/", "/app.js", "/style.css", "//evil.example/path"]) {
      const response = await worker.fetch(new Request(`https://old.example${path}?code=secret&state=secret`), bindings, ctx);
      expect(response.status).toBe(308);
      expect(response.headers.get("Location")).toBe(`${origin}${path}`);
      expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    }
    for (const path of ["/api/session", "/api/auth/github", "/api/sync"]) for (const method of ["GET", "POST"]) {
      const response = await worker.fetch(new Request(`https://old.example${path}`, { method, headers: { Cookie: "__Host-vcl=fake", Origin: origin } }), bindings, ctx);
      expect(response.status).toBe(421); expect(response.headers.has("Location")).toBe(false);
    }
    const callback = await worker.fetch(new Request("https://old.example/api/auth/github/callback?code=secret&state=secret"), bindings, ctx);
    expect(callback.status).toBe(303); expect(callback.headers.get("Location")).toBe(`${origin}/api/auth/github`);
    expect((await worker.fetch(new Request("https://old.example/", { method: "POST", body: "secret" }), bindings, ctx)).status).toBe(421);
    expect(assets).not.toHaveBeenCalled(); expect(upstream).not.toHaveBeenCalled();
    expect(await DB.prepare("SELECT COUNT(*) count FROM oauth_states").first()).toEqual({ count: 0 });
    expect(await (await worker.fetch(new Request(`${origin}/app.js`), bindings, ctx)).text()).toBe("asset");
    expect(assets).toHaveBeenCalledTimes(1);
    expect((await createApp().request("https://old.example/api/session", {}, bindings)).status).toBe(421);
  });

  it("adds current public declarations to every leaderboard row without changing scores or ordering", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const customTool = 'Custom, "工具" <script>alert(1)</script>';
    const longModel = `Legacy model, "Ω" ${"x".repeat(400)}`;
    for (const [id, name, active] of [["u1", "Alpha", 1], ["u2", "Beta", 1], ["u3", "Gamma", 1], ["u4", "Withdrawn", 0], ["u5", "Private", 1], ["u6", "Unknown", 1]] as const) {
      await DB.prepare("INSERT INTO participants(github_id,github_login,display_name,public_profile_id,consent_active,updated_at) VALUES(?,?,?,?,?,?)").bind(id, id, name, `profile-${id}`, active, "2025-01-01").run();
    }
    const consent = async (id: string, repo: string, tooling: string | null, model: string | null, visibility = "public", active = 1) => {
      await DB.prepare("INSERT INTO consents(github_id,repo_id,repo_name,installation_id,visibility,declared_tooling,declared_model,active,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id, repo, `${id}/${repo}`, "installation", visibility, tooling, model, active, "2025-01-01").run();
    };
    await consent("u1", "r1", "Cursor", "Model A");
    await consent("u1", "r2", customTool, longModel);
    await consent("u1", "r3", "Cursor", "Model B");
    await consent("u1", "r4", "Cursor", "Model A");
    await consent("u1", "private", "PRIVATE TOOL", "PRIVATE MODEL", "private");
    await consent("u1", "unknown", "UNKNOWN TOOL", "UNKNOWN MODEL", "unknown");
    await consent("u1", "inactive", "INACTIVE TOOL", "INACTIVE MODEL", "public", 0);
    await consent("u2", "r1", null, null);
    await consent("u3", "r1", "", "");
    await consent("u4", "r1", "WITHDRAWN TOOL", "WITHDRAWN MODEL");
    await consent("u5", "r1", "PRIVATE PARTICIPANT TOOL", "PRIVATE PARTICIPANT MODEL", "private");
    await consent("u6", "r1", "UNKNOWN PARTICIPANT TOOL", "UNKNOWN PARTICIPANT MODEL", "unknown");
    const pr = async (id: string, repo: string, prId: string, month = "2025-01") => {
      await DB.prepare("INSERT INTO pull_requests(pr_id,repo_id,repo_name,author_id,author_login,merged_at,month_utc,generation,declared_tooling,declared_model) VALUES(?,?,?,?,?,?,?,1,?,?)").bind(prId, repo, `${id}/${repo}`, id, id, `${month}-10T00:00:00Z`, month, "STALE PR TOOL", "STALE PR MODEL").run();
    };
    await pr("u1", "r1", "pr1"); await pr("u1", "r1", "pr2");
    await pr("u1", "r2", "february", "2025-02");
    await pr("u1", "private", "private-pr"); await pr("u1", "unknown", "unknown-pr"); await pr("u1", "inactive", "inactive-pr");
    for (const id of ["u2", "u3", "u4", "u5", "u6"]) await pr(id, "r1", `pr-${id}`);
    const emptyDeclarations = { status: "self_declared_unverified", tooling: [], models: [] };
    const response = await request("/api/leaderboard?month=2025-01", bindings);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(await response.json()).toEqual({ month: "2025-01", rows: [
      { rank: 1, profileId: "profile-u1", displayName: "Alpha", repository: "u1/r1", score: 2, declarations: { status: "self_declared_unverified", tooling: ["Cursor", customTool], models: ["Model A", "Model B", longModel] } },
      { rank: 2, profileId: "profile-u2", displayName: "Beta", repository: "u2/r1", score: 1, declarations: emptyDeclarations },
      { rank: 3, profileId: "profile-u3", displayName: "Gamma", repository: "u3/r1", score: 1, declarations: emptyDeclarations }
    ] });
    // Consent edits change historical-month declarations, not PR snapshots or ranking.
    await DB.prepare("UPDATE consents SET declared_tooling='Updated Tool',declared_model='Updated Model' WHERE github_id='u1' AND repo_id='r1'").run();
    const updated = await request("/api/leaderboard?month=2025-01", bindings);
    expect(await updated.json()).toMatchObject({ rows: [{ rank: 1, score: 2, declarations: { tooling: ["Cursor", customTool, "Updated Tool"], models: ["Model A", "Model B", longModel, "Updated Model"] } }, { rank: 2, score: 1 }, { rank: 3, score: 1 }] });
    // Loss of visibility hides both contributions and declarations, even with stale PRs retained.
    await DB.prepare("UPDATE consents SET visibility='private' WHERE github_id='u1' AND repo_id='r2'").run();
    const privateResponse = await request("/api/leaderboard?month=2025-01", bindings);
    const privateBody = await privateResponse.json();
    expect(JSON.stringify(privateBody)).not.toContain(customTool);
    expect(JSON.stringify(privateBody)).not.toContain(longModel);
    expect(privateBody).toMatchObject({ rows: [{ score: 2, declarations: { tooling: ["Cursor", "Updated Tool"], models: ["Model A", "Model B", "Updated Model"] } }, { score: 1 }, { score: 1 }] });
    await DB.prepare("UPDATE participants SET consent_active=0 WHERE github_id='u1'").run();
    const withdrawn = await request("/api/leaderboard?month=2025-01", bindings);
    expect(await withdrawn.json()).toEqual({ month: "2025-01", rows: [
      { rank: 1, profileId: "profile-u2", displayName: "Beta", repository: "u2/r1", score: 1, declarations: emptyDeclarations },
      { rank: 2, profileId: "profile-u3", displayName: "Gamma", repository: "u3/r1", score: 1, declarations: emptyDeclarations }
    ] });
    expect(await (await request("/api/leaderboard?month=2024-12", bindings)).json()).toEqual({ month: "2024-12", rows: [] });
    expect((await request("/api/leaderboard?month=2025-13", bindings)).status).toBe(400);
  });

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
    expect(await leaderboard.json()).toEqual({ month: "2025-01", rows: [{ rank: 1, profileId: "profile-1", displayName: "Octo", repository: "octo/public", score: 1, declarations: { status: "self_declared_unverified", tooling: ["Cursor"], models: ["Model A", "Model B"] } }] });
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

describe("manual post-consent sync integration", () => {
  const fixtures: Miniflare[] = [];
  afterEach(async () => { await Promise.all(fixtures.splice(0).map(mf => mf.dispose())); vi.unstubAllGlobals(); });

  const signIn = async (bindings: Env, githubId = "u1") => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("access_token") ? new Response(JSON.stringify({ access_token: "user-token" })) : new Response(JSON.stringify({ node_id: githubId, login: "octo", avatar_url: null }))));
    const start = await request("/api/auth/github", bindings);
    const transaction = cookieValue(start, "__Host-vcl-oauth")!;
    const state = new URL(start.headers.get("Location")!).searchParams.get("state")!;
    const completed = await request(`/api/auth/github/callback?state=${state}&code=code`, bindings, { Cookie: transaction });
    const cookie = cookieValue(completed, "__Host-vcl")!;
    const snapshot = await request("/api/session", bindings, { Cookie: cookie });
    return { cookie, csrfToken: (await snapshot.json() as { csrfToken: string }).csrfToken };
  };
  const syncRequest = (bindings: Env, auth: { cookie: string; csrfToken: string }, options: Parameters<typeof createApp>[0] = {}) => createApp(options).request(`${origin}/api/sync`, { method: "POST", headers: { Cookie: auth.cookie, Origin: origin, "X-CSRF-Token": auth.csrfToken, "Content-Type": "application/json" }, body: JSON.stringify({ github_id: "attacker", repo_id: "attacker-repo", installation_id: "attacker-installation", model: "attacker-model" }) }, bindings);
  const selected = (DB: D1Database, githubId = "u1", installationId = "i1") => DB.batch([
    DB.prepare("INSERT INTO participants(github_id,github_login,display_name,consent_active,updated_at) VALUES(?,?,?,1,?)").bind(githubId, "octo", "Octo", "2025-01-01T00:00:00Z"),
    DB.prepare("INSERT INTO consents(github_id,repo_id,repo_name,installation_id,visibility,active,updated_at) VALUES(?,?,?,?, 'public',1,?)").bind(githubId, "r1", "octo/public", installationId, "2025-01-01T00:00:00Z")
  ]);
  const accessibleFetch = (pulls: unknown[] = [], visibility = "PUBLIC") => vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/user/installations")) return new Response(JSON.stringify({ installations: [{ id: 42 }] }));
    if (url.includes("/repositories")) return new Response(JSON.stringify({ repositories: [{ node_id: "r1", full_name: "octo/public", private: false }] }));
    if (url.endsWith("/graphql")) {
      const query = JSON.parse(String(init?.body)).query as string;
      if (query.includes("query Repo")) return new Response(JSON.stringify({ data: { repository: { __typename: "Repository", id: "r1", nameWithOwner: "octo/public", visibility } } }));
      return new Response(JSON.stringify({ data: { repository: { __typename: "Repository", id: "r1", nameWithOwner: "octo/public", visibility, pullRequests: { nodes: pulls, pageInfo: { endCursor: null, hasNextPage: false } } } } }));
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  it("refreshes renamed repository metadata without changing identity or counting a PR twice", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    await selected(DB);
    await DB.prepare("UPDATE consents SET declared_tooling='Cursor',declared_model='Model A' WHERE github_id='u1'").run();
    await DB.prepare("INSERT INTO pull_requests(pr_id,repo_id,repo_name,author_id,author_login,merged_at,month_utc,generation) VALUES('pr1','r1','octo/public','u1','octo','2025-01-10T00:00:00Z','2025-01',1)").run();
    const consent = { github_id: "u1", repo_id: "r1", repo_name: "octo/public", installation_id: "i1", declared_tooling: "Cursor", declared_model: "Model A" };
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.variables).toEqual({ id: "r1", after: null });
      expect(body.query).toContain("repository:node(id:$id)");
      expect(String(init?.body)).not.toContain("octo/public");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer installation-token");
      return Response.json({ data: { repository: { __typename: "Repository", id: "r1", nameWithOwner: "octo/VibeRivals", visibility: "PUBLIC", pullRequests: { nodes: [{ id: "pr1", mergedAt: "2025-01-10T00:00:00Z", author: { id: "u1", login: "octo" } }], pageInfo: { endCursor: null, hasNextPage: false } } } } });
    });
    vi.stubGlobal("fetch", fetcher);
    for (let i = 0; i < 2; i++) expect(await syncConsent(bindings, consent, "installation-token")).toEqual({ status: "complete" });
    expect(await DB.prepare("SELECT github_id,repo_id,repo_name,installation_id,active,visibility,declared_tooling,declared_model FROM consents").first()).toEqual({ github_id: "u1", repo_id: "r1", repo_name: "octo/VibeRivals", installation_id: "i1", active: 1, visibility: "public", declared_tooling: "Cursor", declared_model: "Model A" });
    expect((await DB.prepare("SELECT pr_id,repo_id,repo_name,author_id,merged_at,month_utc FROM pull_requests").all()).results).toEqual([{ pr_id: "pr1", repo_id: "r1", repo_name: "octo/VibeRivals", author_id: "u1", merged_at: "2025-01-10T00:00:00Z", month_utc: "2025-01" }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects unauthenticated and CSRF-invalid requests before any GitHub or sync work", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await createApp().request(`${origin}/api/sync`, { method: "POST" }, bindings)).status).toBe(401);
    const auth = await signIn(bindings);
    vi.stubGlobal("fetch", fetcher);
    expect((await createApp().request(`${origin}/api/sync`, { method: "POST", headers: { Cookie: auth.cookie, Origin: origin } }, bindings)).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await DB.prepare("SELECT COUNT(*) count FROM sync_jobs").first<{ count: number }>())?.count).toBe(0);
  });

  it("fails closed when consent is withdrawn or the selected repository is no longer accessible/public", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings); await selected(DB);
    await DB.prepare("UPDATE participants SET consent_active=0 WHERE github_id='u1'").run();
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await syncRequest(bindings, auth, { mintToken: vi.fn() })).status).toBe(409);
    expect(fetcher).not.toHaveBeenCalled();
    await DB.prepare("UPDATE participants SET consent_active=1 WHERE github_id='u1'").run();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/user/installations") ? new Response(JSON.stringify({ installations: [] })) : (() => { throw new Error(`unexpected fetch ${url}`); })()));
    expect((await syncRequest(bindings, auth, { mintToken: vi.fn() })).status).toBe(409);
    vi.stubGlobal("fetch", accessibleFetch([], "PRIVATE"));
    expect((await syncRequest(bindings, auth, { mintToken: vi.fn() })).status).toBe(409);
    expect((await DB.prepare("SELECT COUNT(*) count FROM sync_jobs").first<{ count: number }>())?.count).toBe(0);
  });

  it("uses only the session user's selected consent and shared cursor/deduplication path", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings); await selected(DB); await selected(DB, "u2", "i2");
    const pulls = [{ id: "pr-1", mergedAt: "2025-01-10T00:00:00Z", author: { id: "u1", login: "octo" } }];
    vi.stubGlobal("fetch", accessibleFetch(pulls));
    const mintToken = vi.fn(async () => "installation-token");
    expect(await (await syncRequest(bindings, auth, { mintToken })).json()).toEqual({ status: "complete" });
    expect(await (await syncRequest(bindings, auth, { mintToken })).json()).toEqual({ status: "complete" });
    expect(mintToken).toHaveBeenCalledWith("app", "key", "42");
    expect((await DB.prepare("SELECT COUNT(*) count FROM pull_requests WHERE author_id='u1'").first<{ count: number }>())?.count).toBe(1);
    expect((await DB.prepare("SELECT COUNT(*) count FROM pull_requests WHERE author_id='u2'").first<{ count: number }>())?.count).toBe(0);
    expect(await DB.prepare("SELECT cursor,status,lease_token,lease_until FROM sync_jobs WHERE github_id='u1' AND repo_id='r1'").first()).toEqual({ cursor: null, status: "complete", lease_token: null, lease_until: null });
  });

  it.each([undefined, "legacy-app"])("resolves the same issuer in manual and scheduled sync", async appId => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    bindings.GITHUB_APP_ID = appId;
    const auth = await signIn(bindings); await selected(DB);
    vi.stubGlobal("fetch", accessibleFetch());
    const mintToken = vi.fn(async () => "synthetic-installation-token");
    const sync = vi.fn(async () => ({ status: "complete" as const }));
    expect((await syncRequest(bindings, auth, { mintToken, sync })).status).toBe(200);
    await runScheduledSync(bindings, { mintToken, sync });
    expect(mintToken).toHaveBeenCalledTimes(2);
    expect(mintToken.mock.calls.every(call => call[0] === (appId ?? "client"))).toBe(true);
  });

  it("fails closed without either issuer in manual and scheduled sync", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings); await selected(DB);
    delete bindings.GITHUB_APP_ID;
    bindings.GITHUB_APP_CLIENT_ID = "";
    vi.stubGlobal("fetch", accessibleFetch());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const mintToken = vi.fn(), sync = vi.fn();
      const response = await syncRequest(bindings, auth, { mintToken, sync });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ diagnostic: { stage: "installation_token", category: "configuration_error", status: 0 } });
      await runScheduledSync(bindings, { mintToken, sync });
      expect(mintToken).not.toHaveBeenCalled();
      expect(sync).not.toHaveBeenCalled();
    } finally { warn.mockRestore(); }
  });

  it("completes a no-PR manual sync without creating contributions", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings); await selected(DB);
    vi.stubGlobal("fetch", accessibleFetch());
    const response = await syncRequest(bindings, auth, { mintToken: vi.fn(async () => "installation-token") });
    expect(await response.json()).toEqual({ status: "no_eligible_prs" });
    expect((await DB.prepare("SELECT COUNT(*) count FROM pull_requests").first<{ count: number }>())?.count).toBe(0);
    expect(await DB.prepare("SELECT cursor,status FROM sync_jobs WHERE github_id='u1' AND repo_id='r1'").first()).toEqual({ cursor: null, status: "complete" });
  });

  it("supports login, opt-in, UTC ranking, idempotent sync and withdrawal through the API", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings);
    vi.stubGlobal("fetch", accessibleFetch([
      { id: "pr-utc", mergedAt: "2026-09-30T22:30:00-03:00", author: { id: "u1", login: "octo" } },
      { id: "pr-other", mergedAt: "2026-10-01T00:00:00Z", author: { id: "u2", login: "other" } }
    ]));
    const headers = { Cookie: auth.cookie, Origin: origin, "X-CSRF-Token": auth.csrfToken, "Content-Type": "application/json" };
    const optIn = await createApp().request(`${origin}/api/selections`, { method: "POST", headers, body: JSON.stringify({ consent: true, repoId: "r1" }) }, bindings);
    expect(optIn.status).toBe(201);
    for (let attempt = 0; attempt < 2; attempt++) expect(await (await syncRequest(bindings, auth, { mintToken: async () => "fake" })).json()).toEqual({ status: "complete" });
    const ranked = await (await request("/api/leaderboard?month=2026-10", bindings)).json() as { rows: Array<{ rank: number }> };
    expect(ranked.rows).toHaveLength(1); expect(ranked.rows[0].rank).toBe(1);
    expect((await DB.prepare("SELECT COUNT(*) count FROM pull_requests").first<{ count: number }>())?.count).toBe(1);
    expect(await (await request("/api/leaderboard?month=2026-09", bindings)).json()).toEqual({ month: "2026-09", rows: [] });
    const withdrawn = await createApp().request(`${origin}/api/consent`, { method: "DELETE", headers }, bindings);
    expect(await withdrawn.json()).toEqual({ ok: true });
    expect(await (await request("/api/leaderboard?month=2026-10", bindings)).json()).toEqual({ month: "2026-10", rows: [] });
    expect((await DB.prepare("SELECT COUNT(*) count FROM pull_requests").first<{ count: number }>())?.count).toBe(0);
    const mintToken = vi.fn(); expect((await syncRequest(bindings, auth, { mintToken })).status).toBe(409); expect(mintToken).not.toHaveBeenCalled();
  });

  it("returns only sanitized busy, partial, and failure state", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings); await selected(DB);
    vi.stubGlobal("fetch", accessibleFetch());
    expect(await (await syncRequest(bindings, auth, { mintToken: vi.fn(async () => "token"), sync: vi.fn(async () => ({ status: "busy" as const })) })).json()).toEqual({ status: "busy" });
    expect(await (await syncRequest(bindings, auth, { mintToken: vi.fn(async () => "token"), sync: vi.fn(async () => ({ status: "partial" as const })) })).json()).toEqual({ status: "partial" });
    const failed = await syncRequest(bindings, auth, { mintToken: vi.fn(async () => { throw new Error("upstream secret sentinel"); }) });
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: "sync_unavailable", category: "upstream_or_persistence", diagnostic: { stage: "installation_token", category: "unknown_error", status: 0, correlationId: expect.stringMatching(/^[a-f0-9-]{36}$/) } });
  });

  it("preserves stored contributions and consent on a GraphQL error, then permits a clean retry", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings); await selected(DB);
    const pulls = [{ id: "pr-existing", mergedAt: "2026-10-01T00:00:00Z", author: { id: "u1", login: "octo" } }];
    const normal = accessibleFetch(pulls), mintToken = vi.fn(async () => "installation-token");
    vi.stubGlobal("fetch", normal);
    expect(await (await syncRequest(bindings, auth, { mintToken })).json()).toEqual({ status: "complete" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/graphql") && String(init?.body).includes("LeaguePulls")) return Response.json({ errors: [{ message: "private upstream sentinel" }], data: { repository: null } });
      return normal(url, init);
    }));
    const failed = await syncRequest(bindings, auth, { mintToken });
    expect(failed.status).toBe(503); expect(failed.headers.get("Cache-Control")).toBe("no-store");
    const body = await failed.json() as { diagnostic: unknown };
    expect(body).toEqual({ error: "sync_unavailable", category: "upstream_or_persistence", diagnostic: { stage: "pull_fetch", category: "graphql_error", status: 200, correlationId: expect.stringMatching(/^[a-f0-9-]{36}$/) } });
    expect(warn).toHaveBeenCalledWith("sync_unavailable", body.diagnostic);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("sentinel"); warn.mockRestore();
    expect(await DB.prepare("SELECT active,visibility FROM consents WHERE github_id='u1'").first()).toEqual({ active: 1, visibility: "public" });
    expect((await DB.prepare("SELECT COUNT(*) count FROM pull_requests").first<{ count: number }>())?.count).toBe(1);
    expect(await DB.prepare("SELECT status,lease_token FROM sync_jobs WHERE github_id='u1'").first()).toEqual({ status: "partial", lease_token: null });
    vi.stubGlobal("fetch", normal);
    expect(await (await syncRequest(bindings, auth, { mintToken })).json()).toEqual({ status: "complete" });
  });

  it("diagnoses access and visibility upstream errors rather than consent denial or zero", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings); await selected(DB);
    const mintToken = vi.fn(), normal = accessibleFetch();
    for (const stage of ["repo_access", "repo_visibility"]) {
      vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
        if ((stage === "repo_access" && url.endsWith("/user/installations")) || (stage === "repo_visibility" && url.endsWith("/graphql"))) return new Response("sensitive payload", { status: 403 });
        return normal(url, init);
      }));
      const response = await syncRequest(bindings, auth, { mintToken });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: "sync_unavailable", diagnostic: { stage, category: "http_error", status: 403 } });
    }
    expect(mintToken).not.toHaveBeenCalled();
  });

  it("diagnoses a stale encrypted session and signing configuration safely", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings); await selected(DB);
    vi.stubGlobal("fetch", accessibleFetch());
    const failed = await syncRequest(bindings, auth);
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ error: "sync_unavailable", diagnostic: { stage: "installation_token", category: "configuration_error", status: 0 } });
    const stale = await syncRequest({ ...bindings, SESSION_ENCRYPTION_KEY_BASE64: btoa("bad") }, auth);
    expect(stale.status).toBe(503);
    expect(await stale.json()).toMatchObject({ error: "sync_unavailable", diagnostic: { stage: "session_decryption", category: "configuration_error", status: 0 } });
  });

  it("never interprets a missing persisted count as a legitimate zero", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings); await selected(DB);
    vi.stubGlobal("fetch", accessibleFetch());
    const prepare = DB.prepare.bind(DB);
    const mockedDB = { prepare: (sql: string) => sql.startsWith("SELECT COUNT(*) count FROM pull_requests WHERE repo_id=") ? { bind: () => ({ first: async () => null }) } : prepare(sql) } as unknown as D1Database;
    const response = await syncRequest({ ...bindings, DB: mockedDB }, auth, { mintToken: async () => "fake", sync: async () => ({ status: "complete" }) });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "sync_unavailable", diagnostic: { stage: "result_read", category: "persistence_error", status: 0 } });
  });

  it("refreshes the server-verified installation ID on selection after a reinstall without duplicating consent or cursor", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings); await selected(DB, "u1", "old-installation");
    await DB.prepare("INSERT INTO sync_jobs(github_id,repo_id,cursor,generation,status,pages_processed) VALUES('u1','r1','cursor-1',3,'partial',1)").run();
    vi.stubGlobal("fetch", accessibleFetch());
    const response = await createApp().request(`${origin}/api/selections`, { method: "POST", headers: { Cookie: auth.cookie, Origin: origin, "X-CSRF-Token": auth.csrfToken, "Content-Type": "application/json" }, body: JSON.stringify({ consent: true, repoId: "r1" }) }, bindings);
    expect(response.status).toBe(201);
    expect(await DB.prepare("SELECT installation_id,active FROM consents WHERE github_id='u1' AND repo_id='r1'").first()).toEqual({ installation_id: "42", active: 1 });
    expect((await DB.prepare("SELECT COUNT(*) count FROM consents WHERE github_id='u1' AND repo_id='r1'").first<{ count: number }>())?.count).toBe(1);
    expect(await DB.prepare("SELECT cursor,generation FROM sync_jobs WHERE github_id='u1' AND repo_id='r1'").first()).toEqual({ cursor: "cursor-1", generation: 3 });
  });

  it("makes a newly selected repository the user's sole active consent and retracts obsolete contributions", async () => {
    const { mf, DB, bindings } = await fixture(); fixtures.push(mf);
    const auth = await signIn(bindings); await selected(DB);
    await DB.prepare("INSERT INTO pull_requests(pr_id,repo_id,repo_name,author_id,author_login,merged_at,month_utc,generation) VALUES('pr-old','r1','octo/public','u1','octo','2025-01-10T00:00:00Z','2025-01',1)").run();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/user/installations")) return new Response(JSON.stringify({ installations: [{ id: 84 }] }));
      if (url.includes("/repositories")) return new Response(JSON.stringify({ repositories: [{ node_id: "r2", full_name: "octo/next-public", private: false }] }));
      if (url.endsWith("/graphql")) return new Response(JSON.stringify({ data: { repository: { __typename: "Repository", id: "r2", nameWithOwner: "octo/next-public", visibility: "PUBLIC" } } }));
      throw new Error(`unexpected fetch ${url} ${String(init?.body)}`);
    }));
    const response = await createApp().request(`${origin}/api/selections`, { method: "POST", headers: { Cookie: auth.cookie, Origin: origin, "X-CSRF-Token": auth.csrfToken, "Content-Type": "application/json" }, body: JSON.stringify({ consent: true, repoId: "r2" }) }, bindings);
    expect(response.status).toBe(201);
    expect((await DB.prepare("SELECT repo_id,active FROM consents WHERE github_id='u1' ORDER BY repo_id").all()).results).toEqual([{ repo_id: "r1", active: 0 }, { repo_id: "r2", active: 1 }]);
    expect((await DB.prepare("SELECT COUNT(*) count FROM consents WHERE github_id='u1' AND active=1").first<{ count: number }>())?.count).toBe(1);
    expect((await DB.prepare("SELECT COUNT(*) count FROM pull_requests WHERE author_id='u1'").first<{ count: number }>())?.count).toBe(0);
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
      return new Response(JSON.stringify({ data: { repository: { __typename: "Repository", id: "r-u1", nameWithOwner: "octo/u1", visibility: "PUBLIC", pullRequests: { nodes: [], pageInfo: { endCursor: first ? "cursor-1" : null, hasNextPage: first } } } } }));
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
    await DB.prepare("INSERT INTO participants(github_id,github_login,display_name,consent_active,updated_at) VALUES('u1','octo','Octo',1,'2025-01-01T00:00:00Z')").run();
    const consent = { github_id: "u1", repo_id: "r-u1", repo_name: "octo/u1", installation_id: "i-u1", declared_tooling: null, declared_model: null };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    const budget = new SyncWorkBudget(1);
    await expect(syncConsent(bindings, consent, "token", 2, budget)).rejects.toMatchObject({ category: "http_error", status: 503 });
    expect(budget.remaining).toBe(0);
    expect(await DB.prepare("SELECT cursor,status,lease_token,lease_until FROM sync_jobs WHERE github_id='u1' AND repo_id='r-u1'").first()).toEqual({ cursor: null, status: "partial", lease_token: null, lease_until: null });
  });
});
