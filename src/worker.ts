import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { eligibleRepo, GitHubClient, installationToken, type Repo } from "./github";

export type Env = { ASSETS: Fetcher; DB: D1Database; PUBLIC_ORIGIN: string; GITHUB_APP_ID: string; GITHUB_APP_PRIVATE_KEY: string; GITHUB_OAUTH_CLIENT_ID: string; GITHUB_OAUTH_CLIENT_SECRET: string; SESSION_ENCRYPTION_KEY_BASE64: string };
type Session = { github_id: string; github_login: string; avatar_url: string | null; csrf_token: string; access_token_ciphertext: string | null };
const encoder = new TextEncoder(), decoder = new TextDecoder();
const now = () => new Date().toISOString();
const random = () => crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))).map(b => b.toString(16).padStart(2, "0")).join("");
export const utcMonth = (timestamp: string) => new Date(timestamp).toISOString().slice(0, 7);
export const validMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const limitText = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max ? value.trim() || null : null;

async function key(env: Env) { return crypto.subtle.importKey("raw", Uint8Array.from(atob(env.SESSION_ENCRYPTION_KEY_BASE64), c => c.charCodeAt(0)), "AES-GCM", false, ["encrypt", "decrypt"]); }
async function seal(env: Env, token: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(env), encoder.encode(token)); return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...new Uint8Array(data)))}`; }
async function open(env: Env, value: string) { const [a, b] = value.split("."); const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(atob(a), c => c.charCodeAt(0)) }, await key(env), Uint8Array.from(atob(b), c => c.charCodeAt(0))); return decoder.decode(data); }

async function session(c: any): Promise<Session | null> { const token = getCookie(c, "__Host-vcl"); if (!token) return null; return c.env.DB.prepare("SELECT github_id,github_login,avatar_url,csrf_token,access_token_ciphertext FROM sessions WHERE token_hash=? AND expires_at>? ").bind(await hash(token), now()).first() as Promise<Session | null>; }
const unauthorized = (c: any) => c.json({ error: "authentication_required" }, 401);
async function csrf(c: any): Promise<Session | Response> { const s = await session(c); if (!s) return unauthorized(c); const origin = c.req.header("Origin"); if (origin !== c.env.PUBLIC_ORIGIN || c.req.header("X-CSRF-Token") !== s.csrf_token) return c.json({ error: "csrf_rejected" }, 403); return s; }

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.get("/api/auth/github", async c => {
    const state = random(); const expiry = new Date(Date.now() + 10 * 60_000).toISOString();
    await c.env.DB.prepare("INSERT INTO oauth_states(state_hash,expires_at) VALUES(?,?)").bind(await hash(state), expiry).run();
    const callback = `${c.env.PUBLIC_ORIGIN}/api/auth/github/callback`;
    return c.redirect(`https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(c.env.GITHUB_OAUTH_CLIENT_ID)}&redirect_uri=${encodeURIComponent(callback)}&state=${state}`);
  });
  app.get("/api/auth/github/callback", async c => {
    const state = c.req.query("state"), code = c.req.query("code"); if (!state || !code) return c.json({ error: "oauth_invalid" }, 400);
    const used = await c.env.DB.prepare("DELETE FROM oauth_states WHERE state_hash=? AND expires_at>?").bind(await hash(state), now()).run(); if (!used.meta.changes) return c.json({ error: "oauth_state_invalid" }, 400);
    const callback = `${c.env.PUBLIC_ORIGIN}/api/auth/github/callback`;
    const exchange = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: c.env.GITHUB_OAUTH_CLIENT_ID, client_secret: c.env.GITHUB_OAUTH_CLIENT_SECRET, code, redirect_uri: callback }) });
    const granted = await exchange.json() as { access_token?: string }; if (!exchange.ok || !granted.access_token) return c.json({ error: "oauth_exchange_failed" }, 502);
    const user = await new GitHubClient(granted.access_token).viewer(); const token = random(), timestamp = now();
    await c.env.DB.prepare("INSERT OR REPLACE INTO sessions(token_hash,github_id,github_login,avatar_url,csrf_token,access_token_ciphertext,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(await hash(token),user.id,user.login,user.avatarUrl,random(),await seal(c.env,granted.access_token),new Date(Date.now() + 8 * 60 * 60_000).toISOString(),timestamp).run();
    setCookie(c, "__Host-vcl", token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 8 * 60 * 60 }); return c.redirect(`${c.env.PUBLIC_ORIGIN}/`);
  });
  app.get("/api/rules", c => c.json({ rules: ["Participation is opt-in.", "One merged pull request counts once for its opted-in author in its merged-at UTC month.", "Only currently public, accessible repositories are published.", "Tooling and model declarations are unverified."] }, 200, { "Cache-Control": "public, max-age=300" }));
  app.get("/api/leaderboard", async c => {
    const month = c.req.query("month") ?? new Date().toISOString().slice(0, 7); if (!validMonth(month)) return c.json({ error: "invalid_month" }, 400);
    const rows = await c.env.DB.prepare(`SELECT p.display_name displayName, GROUP_CONCAT(DISTINCT pr.repo_name) repository, COUNT(*) score FROM pull_requests pr JOIN participants p ON p.github_id=pr.author_id AND p.consent_active=1 JOIN consents co ON co.github_id=pr.author_id AND co.repo_id=pr.repo_id AND co.active=1 AND co.visibility='public' WHERE pr.month_utc=? GROUP BY pr.author_id ORDER BY score DESC, displayName ASC LIMIT 100`).bind(month).all();
    return c.json({ month, rows: rows.results.map((r: any, i) => ({ rank: i + 1, ...r })) }, 200, { "Cache-Control": "public, max-age=60" });
  });
  app.get("/api/session", async c => { const s = await session(c); if (!s) return c.json({ authenticated: false, connectUrl: "/api/auth/github" }, 200, { "Cache-Control": "no-store" }); const p = await c.env.DB.prepare("SELECT consent_active FROM participants WHERE github_id=?").bind(s.github_id).first<{ consent_active: number }>(); return c.json({ authenticated: true, user: { login: s.github_login, avatarUrl: s.avatar_url }, csrfToken: s.csrf_token, participating: p?.consent_active === 1 }, 200, { "Cache-Control": "no-store" }); });
  app.get("/api/repos", async c => { const s = await session(c); if (!s || !s.access_token_ciphertext) return unauthorized(c); const repos = await new GitHubClient(await open(c.env, s.access_token_ciphertext)).accessibleRepos(); return c.json({ repos: repos.filter(r => r.visibility === "PUBLIC").map(r => ({ id: r.id, fullName: r.nameWithOwner })) }, 200, { "Cache-Control": "no-store" }); });
  app.post("/api/selections", async c => {
    const s = await csrf(c); if (s instanceof Response) return s; if (!s.access_token_ciphertext) return unauthorized(c);
    const body = await c.req.json().catch(() => null) as any; if (!body?.consent || typeof body.repoId !== "string") return c.json({ error: "invalid_selection" }, 400);
    const client = new GitHubClient(await open(c.env, s.access_token_ciphertext)); const available = await client.accessibleRepos(); const candidate = eligibleRepo(available, body.repoId); if (!candidate) return c.json({ error: "repo_not_accessible_or_public" }, 403);
    let repo: Repo; try { repo = await client.publicRepo(candidate); } catch { return c.json({ error: "repo_not_public" }, 403); }
    const timestamp = now(), tooling = limitText(body.declaredTooling, 80), model = limitText(body.declaredModel, 80);
    await c.env.DB.batch([c.env.DB.prepare("INSERT INTO participants(github_id,github_login,avatar_url,display_name,consent_active,withdrawn_at,updated_at) VALUES(?,?,?,?,1,NULL,?) ON CONFLICT(github_id) DO UPDATE SET github_login=excluded.github_login,avatar_url=excluded.avatar_url,consent_active=1,withdrawn_at=NULL,updated_at=excluded.updated_at").bind(s.github_id,s.github_login,s.avatar_url,s.github_login,timestamp), c.env.DB.prepare("INSERT INTO consents(github_id,repo_id,repo_name,installation_id,visibility,declared_tooling,declared_model,active,updated_at) VALUES(?,?,?,?, 'public',?,?,1,?) ON CONFLICT(github_id,repo_id) DO UPDATE SET active=1,visibility='public',declared_tooling=excluded.declared_tooling,declared_model=excluded.declared_model,updated_at=excluded.updated_at").bind(s.github_id,repo.id,repo.nameWithOwner,candidate.installationId,tooling,model,timestamp)]);
    return c.json({ ok: true }, 201);
  });
  app.delete("/api/consent", async c => { const s = await csrf(c); if (s instanceof Response) return s; const timestamp = now(); await c.env.DB.batch([c.env.DB.prepare("UPDATE participants SET consent_active=0,withdrawn_at=?,updated_at=? WHERE github_id=?").bind(timestamp,timestamp,s.github_id), c.env.DB.prepare("UPDATE consents SET active=0,updated_at=? WHERE github_id=?").bind(timestamp,s.github_id), c.env.DB.prepare("DELETE FROM pull_requests WHERE author_id=?").bind(s.github_id)]); return c.json({ ok: true }); });
  return app;
}

export async function syncConsent(env: Env, consent: { github_id: string; repo_id: string; repo_name: string; installation_id: string; declared_tooling: string | null; declared_model: string | null }, token: string, maxPages = 2) {
  const job = await env.DB.prepare("SELECT cursor,generation FROM sync_jobs WHERE github_id=? AND repo_id=?").bind(consent.github_id, consent.repo_id).first() as { cursor: string | null; generation: number } | null;
  const repo: Repo = { id: consent.repo_id, nameWithOwner: consent.repo_name, visibility: "PUBLIC" }; const client = new GitHubClient(token); let cursor = job?.cursor ?? null, generation = job?.generation || Date.now();
  await env.DB.prepare("INSERT INTO sync_jobs(github_id,repo_id,cursor,generation,status,lease_until,pages_processed) VALUES(?,?,?,?, 'running',?,0) ON CONFLICT(github_id,repo_id) DO UPDATE SET status='running',lease_until=excluded.lease_until").bind(consent.github_id, consent.repo_id, cursor, generation, new Date(Date.now() + 60_000).toISOString()).run();
  for (let page = 0; page < maxPages; page++) { const result = await client.pulls(repo, cursor); if (result.visibility !== "PUBLIC") { await env.DB.batch([env.DB.prepare("UPDATE consents SET visibility='private',active=0,updated_at=? WHERE github_id=? AND repo_id=?").bind(now(),consent.github_id,consent.repo_id), env.DB.prepare("DELETE FROM pull_requests WHERE repo_id=?").bind(consent.repo_id), env.DB.prepare("UPDATE sync_jobs SET status='retracted',cursor=NULL WHERE github_id=? AND repo_id=?").bind(consent.github_id,consent.repo_id)]); return; }
    const statements = result.pulls.filter(p => p.author?.id === consent.github_id).map(p => env.DB.prepare(`INSERT INTO pull_requests(pr_id,repo_id,repo_name,author_id,author_login,author_avatar_url,merged_at,month_utc,generation,declared_tooling,declared_model) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM participants p JOIN consents c ON c.github_id=p.github_id WHERE p.github_id=? AND p.consent_active=1 AND c.repo_id=? AND c.active=1 AND c.visibility='public') ON CONFLICT(pr_id) DO UPDATE SET generation=excluded.generation`).bind(p.id,consent.repo_id,consent.repo_name,p.author!.id,p.author!.login,p.author!.avatarUrl ?? null,p.mergedAt,utcMonth(p.mergedAt),generation,consent.declared_tooling,consent.declared_model,consent.github_id,consent.repo_id));
    if (statements.length) await env.DB.batch(statements); cursor = result.cursor; const complete = !result.hasNext; if (complete) { await env.DB.prepare("DELETE FROM pull_requests WHERE repo_id=? AND author_id=? AND generation<>?").bind(consent.repo_id,consent.github_id,generation).run(); }
    await env.DB.prepare("UPDATE sync_jobs SET cursor=?,status=?,pages_processed=pages_processed+1,last_success_at=CASE WHEN ? THEN ? ELSE last_success_at END,lease_until=NULL WHERE github_id=? AND repo_id=?").bind(complete ? null : cursor, complete ? "complete" : "partial", complete ? 1 : 0, now(), consent.github_id, consent.repo_id).run(); if (complete) break;
  }
}
const api = createApp();
const worker = { fetch: (request: Request, env: Env, ctx: ExecutionContext) => new URL(request.url).pathname.startsWith("/api/") ? api.fetch(request, env, ctx) : env.ASSETS.fetch(request), scheduled: async (_: ScheduledController, env: Env, ctx: ExecutionContext) => { const consents = await env.DB.prepare("SELECT github_id,repo_id,repo_name,installation_id,declared_tooling,declared_model FROM consents WHERE active=1 AND visibility='public'").all<any>(); ctx.waitUntil(Promise.all(consents.results.map(async c => { try { await syncConsent(env, c, await installationToken(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY, c.installation_id)); } catch { await env.DB.prepare("UPDATE consents SET visibility='unknown',updated_at=? WHERE github_id=? AND repo_id=?").bind(now(),c.github_id,c.repo_id).run(); } }))); } };
export default worker;
