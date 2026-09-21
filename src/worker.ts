import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { eligibleRepo, GitHubClient, installationToken, type Repo } from "./github";

export type Env = { ASSETS: Fetcher; DB: D1Database; PUBLIC_ORIGIN: string; GITHUB_APP_ID: string; GITHUB_APP_PRIVATE_KEY: string; GITHUB_APP_CLIENT_ID: string; GITHUB_APP_CLIENT_SECRET: string; SESSION_ENCRYPTION_KEY_BASE64: string };
type Session = { github_id: string; github_login: string; avatar_url: string | null; csrf_token: string; access_token_ciphertext: string | null };
const encoder = new TextEncoder(), decoder = new TextDecoder();
export const SCHEDULED_SYNC_WORK_BUDGET = 20;
const SYNC_PAGES_PER_CONSENT = 2;
const now = () => new Date().toISOString();
const random = () => crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))).map(b => b.toString(16).padStart(2, "0")).join("");
export const utcMonth = (timestamp: string) => new Date(timestamp).toISOString().slice(0, 7);
export const validMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
export class SyncWorkBudget {
  constructor(private remainingWork: number) { if (!Number.isInteger(remainingWork) || remainingWork < 0) throw new Error("invalid_sync_work_budget"); }
  get remaining() { return this.remainingWork; }
  tryConsume() { if (!this.remainingWork) return false; this.remainingWork--; return true; }
}
const requestedUtcMonth = (month: string | undefined) => month ?? new Date().toISOString().slice(0, 7);
const limitText = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max ? value.trim() || null : null;
const MUTATION_RATE_LIMIT = 10, MUTATION_RATE_WINDOW_MS = 60_000;
const OAUTH_TRANSACTION_COOKIE = "__Host-vcl-oauth", OAUTH_TRANSACTION_MAX_AGE = 10 * 60;
const clearOAuthTransaction = (c: any) => setCookie(c, OAUTH_TRANSACTION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 0 });

async function key(env: Env) {
  if (typeof env.SESSION_ENCRYPTION_KEY_BASE64 !== "string") throw new Error("session_key_invalid");
  let raw: Uint8Array;
  try { raw = Uint8Array.from(atob(env.SESSION_ENCRYPTION_KEY_BASE64), c => c.charCodeAt(0)); } catch { throw new Error("session_key_invalid"); }
  if (raw.byteLength !== 32) throw new Error("session_key_invalid");
  try { return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]); } catch { throw new Error("session_key_invalid"); }
}
async function seal(env: Env, token: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(env), encoder.encode(token)); return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...new Uint8Array(data)))}`; }
async function open(env: Env, value: string) { const [a, b] = value.split("."); const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(atob(a), c => c.charCodeAt(0)) }, await key(env), Uint8Array.from(atob(b), c => c.charCodeAt(0))); return decoder.decode(data); }

async function session(c: any): Promise<Session | null> { const token = getCookie(c, "__Host-vcl"); if (!token) return null; return c.env.DB.prepare("SELECT github_id,github_login,avatar_url,csrf_token,access_token_ciphertext FROM sessions WHERE token_hash=? AND expires_at>? ").bind(await hash(token), now()).first() as Promise<Session | null>; }
const unauthorized = (c: any) => c.json({ error: "authentication_required" }, 401);
async function csrf(c: any): Promise<Session | Response> { const s = await session(c); if (!s) return unauthorized(c); const origin = c.req.header("Origin"); if (origin !== c.env.PUBLIC_ORIGIN || c.req.header("X-CSRF-Token") !== s.csrf_token) return c.json({ error: "csrf_rejected" }, 403); return s; }
async function consumeMutationRateLimit(c: any, scope: string): Promise<boolean> {
  const timestamp = now(), expiry = new Date(Date.now() + MUTATION_RATE_WINDOW_MS).toISOString();
  const actorKey = await hash(c.req.header("CF-Connecting-IP") || "missing-cf-connecting-ip");
  await c.env.DB.prepare("DELETE FROM rate_limits WHERE rowid IN (SELECT rowid FROM rate_limits WHERE expires_at<=? LIMIT 100)").bind(timestamp).run();
  const result = await c.env.DB.prepare("INSERT INTO rate_limits(scope,actor_key,request_count,expires_at) VALUES(?,?,1,?) ON CONFLICT(scope,actor_key) DO UPDATE SET request_count=CASE WHEN rate_limits.expires_at<=? THEN 1 ELSE MIN(rate_limits.request_count+1,?) END,expires_at=CASE WHEN rate_limits.expires_at<=? THEN excluded.expires_at ELSE rate_limits.expires_at END RETURNING request_count").bind(scope, actorKey, expiry, timestamp, MUTATION_RATE_LIMIT + 1, timestamp).first() as { request_count: number } | null;
  return Boolean(result && result.request_count <= MUTATION_RATE_LIMIT);
}

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.get("/api/auth/github", async c => {
    try { await key(c.env); } catch { return c.json({ error: "oauth_configuration_invalid", category: "session_encryption" }, 503, { "Cache-Control": "no-store" }); }
    const state = random(), transaction = random(), expiry = new Date(Date.now() + OAUTH_TRANSACTION_MAX_AGE * 1_000).toISOString();
    await c.env.DB.prepare("INSERT INTO oauth_states(state_hash,transaction_hash,expires_at) VALUES(?,?,?)").bind(await hash(state), await hash(transaction), expiry).run();
    setCookie(c, OAUTH_TRANSACTION_COOKIE, transaction, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: OAUTH_TRANSACTION_MAX_AGE });
    const callback = `${c.env.PUBLIC_ORIGIN}/api/auth/github/callback`;
    return c.redirect(`https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(c.env.GITHUB_APP_CLIENT_ID)}&redirect_uri=${encodeURIComponent(callback)}&state=${state}`);
  });
  app.get("/api/auth/github/callback", async c => {
    const state = c.req.query("state"), code = c.req.query("code"), transaction = getCookie(c, OAUTH_TRANSACTION_COOKIE);
    if (!state || !code || !transaction) { clearOAuthTransaction(c); return c.json({ error: "oauth_invalid" }, 400); }
    const used = await c.env.DB.prepare("DELETE FROM oauth_states WHERE state_hash=? AND transaction_hash=? AND expires_at>?").bind(await hash(state), await hash(transaction), now()).run();
    if (!used.meta.changes) { clearOAuthTransaction(c); return c.json({ error: "oauth_state_invalid" }, 400); }
    const callback = `${c.env.PUBLIC_ORIGIN}/api/auth/github/callback`;
    const exchange = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: c.env.GITHUB_APP_CLIENT_ID, client_secret: c.env.GITHUB_APP_CLIENT_SECRET, code, redirect_uri: callback }) });
    const granted = await exchange.json() as { access_token?: string }; if (!exchange.ok || !granted.access_token) { clearOAuthTransaction(c); return c.json({ error: "oauth_exchange_failed" }, 502); }
    let completionStage: "viewer_lookup" | "token_seal" | "session_persist" = "viewer_lookup";
    try {
      const user = await new GitHubClient(granted.access_token).viewer(); const token = random(), timestamp = now();
      completionStage = "token_seal";
      const ciphertext = await seal(c.env, granted.access_token);
      completionStage = "session_persist";
      await c.env.DB.prepare("INSERT OR REPLACE INTO sessions(token_hash,github_id,github_login,avatar_url,csrf_token,access_token_ciphertext,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(await hash(token),user.id,user.login,user.avatarUrl,random(),ciphertext,new Date(Date.now() + 8 * 60 * 60_000).toISOString(),timestamp).run();
      clearOAuthTransaction(c); setCookie(c, "__Host-vcl", token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 8 * 60 * 60 }); return c.redirect(`${c.env.PUBLIC_ORIGIN}/`);
    } catch {
      const completionId = random();
      console.error({ event: "oauth_completion_failed", stage: completionStage, completionId });
      clearOAuthTransaction(c); return c.json({ error: "oauth_completion_failed" }, 502, { "Cache-Control": "no-store", "X-OAuth-Completion-Id": completionId, "X-OAuth-Completion-Stage": completionStage });
    }
  });
  app.get("/api/rules", c => c.json({ rules: ["Participation is opt-in.", "One merged pull request counts once for its opted-in author in its merged-at UTC month.", "Only currently public, accessible repositories are published.", "Tooling and model declarations are unverified."] }, 200, { "Cache-Control": "public, max-age=300" }));
  app.get("/api/leaderboard", async c => {
    const month = requestedUtcMonth(c.req.query("month")); if (!validMonth(month)) return c.json({ error: "invalid_month" }, 400);
    const rows = await c.env.DB.prepare(`SELECT p.public_profile_id profileId, p.display_name displayName, GROUP_CONCAT(DISTINCT pr.repo_name) repository, COUNT(*) score FROM pull_requests pr JOIN participants p ON p.github_id=pr.author_id AND p.consent_active=1 JOIN consents co ON co.github_id=pr.author_id AND co.repo_id=pr.repo_id AND co.active=1 AND co.visibility='public' WHERE pr.month_utc=? AND p.public_profile_id IS NOT NULL GROUP BY pr.author_id ORDER BY score DESC, displayName ASC LIMIT 100`).bind(month).all();
    return c.json({ month, rows: rows.results.map((r: any, i) => ({ rank: i + 1, ...r })) }, 200, { "Cache-Control": "public, max-age=60" });
  });
  app.get("/api/profiles/:id", async c => {
    const month = requestedUtcMonth(c.req.query("month")); if (!validMonth(month)) return c.json({ error: "invalid_month" }, 400, { "Cache-Control": "no-store" });
    const profile = await c.env.DB.prepare("SELECT github_id,display_name FROM participants WHERE public_profile_id=? AND consent_active=1 AND EXISTS (SELECT 1 FROM consents WHERE consents.github_id=participants.github_id AND active=1 AND visibility='public')").bind(c.req.param("id")).first<{ github_id: string; display_name: string }>();
    if (!profile) return c.json({ error: "profile_not_found" }, 404, { "Cache-Control": "no-store" });
    const repositories = await c.env.DB.prepare("SELECT pr.repo_name repository,COUNT(*) pullRequests FROM pull_requests pr JOIN consents co ON co.github_id=pr.author_id AND co.repo_id=pr.repo_id AND co.active=1 AND co.visibility='public' WHERE pr.author_id=? AND pr.month_utc=? GROUP BY pr.repo_id,pr.repo_name ORDER BY repository ASC").bind(profile.github_id,month).all();
    const declarations = await c.env.DB.prepare("SELECT DISTINCT declared_tooling tooling,declared_model model FROM consents WHERE github_id=? AND active=1 AND visibility='public' AND (declared_tooling IS NOT NULL OR declared_model IS NOT NULL) ORDER BY declared_tooling,declared_model").bind(profile.github_id).all<{ tooling: string | null; model: string | null }>();
    return c.json({ id: c.req.param("id"), displayName: profile.display_name, month, repositories: repositories.results, declarations: { status: "self_declared_unverified", tooling: [...new Set(declarations.results.flatMap(row => row.tooling ? [row.tooling] : []))], models: [...new Set(declarations.results.flatMap(row => row.model ? [row.model] : []))] } }, 200, { "Cache-Control": "no-store" });
  });
  app.get("/api/session", async c => {
    const s = await session(c);
    if (!s) return c.json({ authenticated: false, connectUrl: "/api/auth/github" }, 200, { "Cache-Control": "no-store" });
    const participant = await c.env.DB.prepare("SELECT consent_active FROM participants WHERE github_id=?").bind(s.github_id).first<{ consent_active: number }>();
    return c.json({ authenticated: true, csrfToken: s.csrf_token, participating: participant?.consent_active === 1 }, 200, { "Cache-Control": "no-store" });
  });
  app.get("/api/repos", async c => { const s = await session(c); if (!s || !s.access_token_ciphertext) return unauthorized(c); const repos = await new GitHubClient(await open(c.env, s.access_token_ciphertext)).accessibleRepos(); return c.json({ repos: repos.filter(r => r.visibility === "PUBLIC").map(r => ({ id: r.id, fullName: r.nameWithOwner })) }, 200, { "Cache-Control": "no-store" }); });
  app.post("/api/selections", async c => {
    try { if (!await consumeMutationRateLimit(c, "selection")) return c.json({ error: "rate_limited" }, 429, { "Retry-After": String(MUTATION_RATE_WINDOW_MS / 1000) }); } catch { return c.json({ error: "rate_limit_unavailable" }, 503); }
    const s = await csrf(c); if (s instanceof Response) return s; if (!s.access_token_ciphertext) return unauthorized(c);
    const body = await c.req.json().catch(() => null) as any; if (!body?.consent || typeof body.repoId !== "string") return c.json({ error: "invalid_selection" }, 400);
    const client = new GitHubClient(await open(c.env, s.access_token_ciphertext)); const available = await client.accessibleRepos(); const candidate = eligibleRepo(available, body.repoId); if (!candidate) return c.json({ error: "repo_not_accessible_or_public" }, 403);
    let repo: Repo; try { repo = await client.publicRepo(candidate); } catch { return c.json({ error: "repo_not_public" }, 403); }
    const timestamp = now(), tooling = limitText(body.declaredTooling, 80), model = limitText(body.declaredModel, 80);
    await c.env.DB.batch([c.env.DB.prepare("INSERT INTO participants(github_id,github_login,avatar_url,display_name,public_profile_id,consent_active,withdrawn_at,updated_at) VALUES(?,?,?,?,?,1,NULL,?) ON CONFLICT(github_id) DO UPDATE SET github_login=excluded.github_login,avatar_url=excluded.avatar_url,display_name=excluded.display_name,public_profile_id=COALESCE(participants.public_profile_id,excluded.public_profile_id),consent_active=1,withdrawn_at=NULL,updated_at=excluded.updated_at").bind(s.github_id,s.github_login,s.avatar_url,s.github_login,random(),timestamp), c.env.DB.prepare("INSERT INTO consents(github_id,repo_id,repo_name,installation_id,visibility,declared_tooling,declared_model,active,updated_at) VALUES(?,?,?,?, 'public',?,?,1,?) ON CONFLICT(github_id,repo_id) DO UPDATE SET active=1,visibility='public',declared_tooling=excluded.declared_tooling,declared_model=excluded.declared_model,updated_at=excluded.updated_at").bind(s.github_id,repo.id,repo.nameWithOwner,candidate.installationId,tooling,model,timestamp)]);
    return c.json({ ok: true }, 201);
  });
  app.delete("/api/consent", async c => { try { if (!await consumeMutationRateLimit(c, "consent_withdrawal")) return c.json({ error: "rate_limited" }, 429, { "Retry-After": String(MUTATION_RATE_WINDOW_MS / 1000) }); } catch { return c.json({ error: "rate_limit_unavailable" }, 503); } const s = await csrf(c); if (s instanceof Response) return s; const timestamp = now(); await c.env.DB.batch([c.env.DB.prepare("UPDATE participants SET consent_active=0,withdrawn_at=?,updated_at=? WHERE github_id=?").bind(timestamp,timestamp,s.github_id), c.env.DB.prepare("UPDATE consents SET active=0,updated_at=? WHERE github_id=?").bind(timestamp,s.github_id), c.env.DB.prepare("DELETE FROM pull_requests WHERE author_id=?").bind(s.github_id)]); return c.json({ ok: true }); });
  return app;
}

export async function syncConsent(env: Env, consent: { github_id: string; repo_id: string; repo_name: string; installation_id: string; declared_tooling: string | null; declared_model: string | null }, token: string, maxPages = SYNC_PAGES_PER_CONSENT, budget?: SyncWorkBudget) {
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new Error("invalid_sync_page_limit");
  const leaseToken = random(), leaseUntil = new Date(Date.now() + 60_000).toISOString();
  const job = await env.DB.prepare("INSERT INTO sync_jobs(github_id,repo_id,cursor,generation,status,lease_token,lease_until,pages_processed) VALUES(?,?,NULL,1,'running',?,?,0) ON CONFLICT(github_id,repo_id) DO UPDATE SET generation=CASE WHEN sync_jobs.cursor IS NULL THEN sync_jobs.generation+1 ELSE sync_jobs.generation END,status='running',lease_token=excluded.lease_token,lease_until=excluded.lease_until WHERE sync_jobs.lease_token IS NULL OR sync_jobs.lease_until IS NULL OR sync_jobs.lease_until<=? RETURNING cursor,generation").bind(consent.github_id, consent.repo_id, leaseToken, leaseUntil, now()).first<{ cursor: string | null; generation: number }>();
  if (!job) return;
  const repo: Repo = { id: consent.repo_id, nameWithOwner: consent.repo_name, visibility: "PUBLIC" }; const client = new GitHubClient(token); let cursor = job.cursor, generation = job.generation;
  const renewLease = async () => { const renewed = await env.DB.prepare("UPDATE sync_jobs SET lease_until=? WHERE github_id=? AND repo_id=? AND lease_token=? AND lease_until>?").bind(new Date(Date.now() + 60_000).toISOString(),consent.github_id,consent.repo_id,leaseToken,now()).run(); if (!renewed.meta.changes) throw new Error("sync_lease_lost"); };
  const releasePartialLease = async () => { const released = await env.DB.prepare("UPDATE sync_jobs SET status='partial',lease_token=NULL,lease_until=NULL WHERE github_id=? AND repo_id=? AND lease_token=? AND lease_until>?").bind(consent.github_id,consent.repo_id,leaseToken,now()).run(); if (!released.meta.changes) throw new Error("sync_lease_lost"); };
  const retract = async () => { const timestamp = now(); const retracted = await env.DB.batch([env.DB.prepare("UPDATE sync_jobs SET status='retracted',cursor=NULL,lease_token=NULL,lease_until=NULL WHERE github_id=? AND repo_id=? AND lease_token=? AND lease_until>?").bind(consent.github_id,consent.repo_id,leaseToken,timestamp), env.DB.prepare("UPDATE consents SET visibility='private',active=0,updated_at=? WHERE github_id=? AND repo_id=? AND EXISTS (SELECT 1 FROM sync_jobs WHERE github_id=? AND repo_id=? AND status='retracted' AND lease_token IS NULL)").bind(timestamp,consent.github_id,consent.repo_id,consent.github_id,consent.repo_id), env.DB.prepare("DELETE FROM pull_requests WHERE repo_id=? AND EXISTS (SELECT 1 FROM sync_jobs WHERE github_id=? AND repo_id=? AND status='retracted' AND lease_token IS NULL)").bind(consent.repo_id,consent.github_id,consent.repo_id)]); if (!retracted[0].meta.changes) throw new Error("sync_lease_lost"); };
  for (let page = 0; page < maxPages; page++) { if (budget && !budget.tryConsume()) { await releasePartialLease(); return; } let result; await renewLease(); try { result = await client.pulls(repo, cursor); } catch (error) { if (error instanceof Error && error.message === "repo_inaccessible") { await retract(); return; } await releasePartialLease(); throw error; } await renewLease(); if (result.visibility !== "PUBLIC") { await retract(); return; }
    cursor = result.cursor; const timestamp = now(), complete = !result.hasNext, terminal = complete || page + 1 === maxPages || budget?.remaining === 0; const statements = [env.DB.prepare("UPDATE consents SET visibility='public',updated_at=? WHERE github_id=? AND repo_id=? AND active=1 AND EXISTS (SELECT 1 FROM sync_jobs WHERE github_id=? AND repo_id=? AND lease_token=? AND lease_until>?)").bind(timestamp,consent.github_id,consent.repo_id,consent.github_id,consent.repo_id,leaseToken,timestamp)]; const pulls = result.pulls.filter(p => p.author?.id === consent.github_id).map(p => env.DB.prepare(`INSERT INTO pull_requests(pr_id,repo_id,repo_name,author_id,author_login,author_avatar_url,merged_at,month_utc,generation,declared_tooling,declared_model) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM participants p JOIN consents c ON c.github_id=p.github_id WHERE p.github_id=? AND p.consent_active=1 AND c.repo_id=? AND c.active=1 AND c.visibility='public') AND EXISTS (SELECT 1 FROM sync_jobs WHERE github_id=? AND repo_id=? AND lease_token=? AND lease_until>?) ON CONFLICT(pr_id) DO UPDATE SET generation=MAX(pull_requests.generation,excluded.generation)`).bind(p.id,consent.repo_id,consent.repo_name,p.author!.id,p.author!.login,p.author!.avatarUrl ?? null,p.mergedAt,utcMonth(p.mergedAt),generation,consent.declared_tooling,consent.declared_model,consent.github_id,consent.repo_id,consent.github_id,consent.repo_id,leaseToken,timestamp)); statements.push(...pulls);
    if (complete) statements.push(env.DB.prepare("DELETE FROM pull_requests WHERE repo_id=? AND author_id=? AND generation<? AND EXISTS (SELECT 1 FROM sync_jobs WHERE github_id=? AND repo_id=? AND lease_token=? AND lease_until>?)").bind(consent.repo_id,consent.github_id,generation,consent.github_id,consent.repo_id,leaseToken,timestamp));
    statements.push(env.DB.prepare("UPDATE sync_jobs SET cursor=?,status=?,pages_processed=pages_processed+1,last_success_at=CASE WHEN ? THEN ? ELSE last_success_at END,lease_token=CASE WHEN ? THEN NULL ELSE lease_token END,lease_until=CASE WHEN ? THEN NULL ELSE lease_until END WHERE github_id=? AND repo_id=? AND lease_token=? AND lease_until>?").bind(complete ? null : cursor, complete ? "complete" : "partial", complete ? 1 : 0, timestamp, terminal ? 1 : 0, terminal ? 1 : 0, consent.github_id, consent.repo_id, leaseToken, timestamp));
    const progress = (await env.DB.batch(statements)).at(-1)!;
    if (!progress.meta.changes) throw new Error("sync_lease_lost"); if (terminal) break;
  }
}
type ScheduledConsent = { github_id: string; repo_id: string; repo_name: string; installation_id: string; declared_tooling: string | null; declared_model: string | null };
type ScheduledSyncOptions = { budget?: SyncWorkBudget; mintToken?: typeof installationToken; sync?: typeof syncConsent };
export async function runScheduledSync(env: Env, options: ScheduledSyncOptions = {}) {
  const budget = options.budget ?? new SyncWorkBudget(SCHEDULED_SYNC_WORK_BUDGET), mintToken = options.mintToken ?? installationToken, sync = options.sync ?? syncConsent;
  const consentLimit = Math.floor(budget.remaining / 2);
  if (!consentLimit) return;
  const consents = await env.DB.prepare("SELECT github_id,repo_id,repo_name,installation_id,declared_tooling,declared_model FROM consents WHERE active=1 AND visibility IN ('public','unknown') ORDER BY updated_at ASC,github_id ASC,repo_id ASC LIMIT ?").bind(consentLimit).all<ScheduledConsent>();
  for (const consent of consents.results) {
    if (budget.remaining < 2) break;
    try {
      if (!budget.tryConsume()) break;
      const token = await mintToken(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY, consent.installation_id);
      await sync(env, consent, token, SYNC_PAGES_PER_CONSENT, budget);
    } catch (error) {
      if (error instanceof Error && error.message === "sync_lease_lost") continue;
      await env.DB.prepare("UPDATE consents SET visibility='unknown',updated_at=? WHERE github_id=? AND repo_id=? AND active=1").bind(now(),consent.github_id,consent.repo_id).run();
    }
  }
}
const api = createApp();
const worker = { fetch: (request: Request, env: Env, ctx: ExecutionContext) => new URL(request.url).pathname.startsWith("/api/") ? api.fetch(request, env, ctx) : env.ASSETS.fetch(request), scheduled: async (_: ScheduledController, env: Env, ctx: ExecutionContext) => { ctx.waitUntil(runScheduledSync(env)); } };
export default worker;
