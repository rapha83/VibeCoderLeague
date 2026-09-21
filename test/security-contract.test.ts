import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eligibleRepo, GitHubClient, prohibitedGitHubAccess } from "../src/github";
import { utcMonth, validMonth } from "../src/worker";

const readRepositoryFile = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("GitHub boundary", () => {
  it("uses only repository metadata, installation repository enumeration, and allowlisted GraphQL fields", async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const fetcher = async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      if (String(url).endsWith("/graphql")) return new Response(JSON.stringify({ data: { repository: { id: "R_1", nameWithOwner: "octo/public", visibility: "PUBLIC", pullRequests: { nodes: [{ id: "PR_1", mergedAt: "2025-01-31T23:59:59Z", author: { id: "U_1", login: "octo", avatarUrl: "https://avatar" } }], pageInfo: { endCursor: null, hasNextPage: false } } } } }));
      return new Response(JSON.stringify({ installations: [], repositories: [] }));
    };
    const client = new GitHubClient("token", fetcher as typeof fetch);
    await client.publicRepo({ id: "R_1", nameWithOwner: "octo/public", visibility: "PUBLIC" });
    await client.pulls({ id: "R_1", nameWithOwner: "octo/public", visibility: "PUBLIC" }, null);
    expect(calls.every(call => !prohibitedGitHubAccess(call.url, call.body))).toBe(true);
    expect(calls.map(c => c.url)).toEqual(["https://api.github.com/graphql", "https://api.github.com/graphql"]);
    expect(calls[1].body).not.toMatch(/title|body|files|patch|content/i);
  });
  it("recognizes all prohibited endpoint and field forms", () => {
    for (const value of ["/repos/a/b/contents/x", "/repos/a/b/pulls", "/x.patch", "query { pullRequest { title body } }"]) expect(prohibitedGitHubAccess(value)).toBe(true);
  });
  it("rejects forged repository IDs and private repository selections before metadata confirmation", () => {
    const repos = [{ id: "R_public", nameWithOwner: "octo/public", visibility: "PUBLIC" }, { id: "R_private", nameWithOwner: "octo/private", visibility: "PRIVATE" }];
    expect(eligibleRepo(repos, "forged")).toBeNull();
    expect(eligibleRepo(repos, "R_private")).toBeNull();
    expect(eligibleRepo(repos, "R_public")?.nameWithOwner).toBe("octo/public");
  });
});

describe("activation configuration", () => {
  it("targets the existing production Worker, exact public origin, and no cron trigger", () => {
    const wrangler = readRepositoryFile("../wrangler.toml");
    expect(wrangler).toMatch(/^name\s*=\s*"vibecoderleague"\s*$/m);
    expect(wrangler).toMatch(/^workers_dev\s*=\s*true\s*$/m);
    expect(wrangler).not.toMatch(/^workers_dev\s*=\s*false\s*$/m);
    expect(wrangler).toMatch(/^PUBLIC_ORIGIN\s*=\s*"https:\/\/vibecoderleague\.grumpzillax\.workers\.dev"\s*$/m);
    expect(wrangler).not.toMatch(/^\s*\[triggers\]\s*$/m);
    expect(wrangler).toMatch(/database_id\s*=\s*"a5fcb38c-026a-4bd3-9f93-a2822cf067b4"/);
  });
  it("uses GitHub App user authorization credentials, not a separate broad OAuth App", () => {
    const worker = readRepositoryFile("../src/worker.ts");
    const appSetup = readRepositoryFile("../docs/github-app.md");
    expect(worker).toContain("https://github.com/login/oauth/authorize");
    expect(worker).toContain("https://github.com/login/oauth/access_token");
    expect(worker).toContain("GITHUB_APP_CLIENT_ID");
    expect(worker).toContain("GITHUB_APP_CLIENT_SECRET");
    expect(worker).not.toContain("scope=repo");
    expect(appSetup).toContain("GitHub App's user authorization web flow");
    expect(appSetup).toContain("Do not create or use a separate OAuth App");
    expect(appSetup).toContain("no broad `repo` scope is requested");
  });
});

describe("publication safety contract", () => {
  it("uses strict UTC month boundaries", () => {
    expect(utcMonth("2025-01-31T23:59:59.999Z")).toBe("2025-01");
    expect(utcMonth("2025-02-01T00:00:00.000Z")).toBe("2025-02");
    expect(validMonth("2025-02")).toBe(true);
    expect(validMonth("2025-2")).toBe(false);
    expect(validMonth("2025-13")).toBe(false);
  });
  it("makes withdrawal and sync upserts fail closed on consent/repository visibility", () => {
    const worker = readRepositoryFile("../src/worker.ts");
    expect(worker).toContain("DELETE FROM pull_requests WHERE author_id=?");
    expect(worker).toContain("p.consent_active=1");
    expect(worker).toContain("c.active=1 AND c.visibility='public'");
    expect(worker).toContain("ON CONFLICT(pr_id)");
    expect(worker).toContain("visibility='unknown'");
  });
  it("retries active unknown visibility and restores public only through the current lease before PR writes", () => {
    const worker = readRepositoryFile("../src/worker.ts");
    const scheduledQuery = "FROM consents WHERE active=1 AND visibility IN ('public','unknown')";
    const restore = "UPDATE consents SET visibility='public',updated_at=? WHERE github_id=? AND repo_id=? AND active=1 AND EXISTS (SELECT 1 FROM sync_jobs WHERE github_id=? AND repo_id=? AND lease_token=? AND lease_until>?)";
    expect(worker).toContain(scheduledQuery);
    expect(worker).toContain(restore);
    expect(worker.indexOf(restore)).toBeLessThan(worker.indexOf("INSERT INTO pull_requests"));
    expect(worker).toContain("UPDATE consents SET visibility='unknown',updated_at=? WHERE github_id=? AND repo_id=? AND active=1");
    expect(worker).toContain('error.message === "repo_inaccessible"');
    expect(worker).toContain("await retract(); return;");
  });
  it("uses one generation for a partial traversal and advances only when starting a new traversal", () => {
    const worker = readRepositoryFile("../src/worker.ts");
    expect(worker).toContain("CASE WHEN sync_jobs.cursor IS NULL THEN sync_jobs.generation+1 ELSE sync_jobs.generation END");
    expect(worker).toContain("RETURNING cursor,generation");
    expect(worker).toContain("generation<?");
  });
  it("acquires one compare-and-set lease and fences all sync state transitions with its token", () => {
    const worker = readRepositoryFile("../src/worker.ts");
    const leaseMigration = readRepositoryFile("../migrations/0003_sync_job_leases.sql");
    expect(leaseMigration).toMatch(/ADD COLUMN lease_token TEXT/);
    expect(worker).toContain("WHERE sync_jobs.lease_token IS NULL OR sync_jobs.lease_until IS NULL OR sync_jobs.lease_until<=?");
    expect(worker).toContain("lease_token=excluded.lease_token,lease_until=excluded.lease_until");
    expect(worker).toContain("AND lease_token=? AND lease_until>?");
    expect(worker).toContain("UPDATE sync_jobs SET lease_until=?");
    expect(worker).toContain("AND EXISTS (SELECT 1 FROM sync_jobs WHERE github_id=? AND repo_id=? AND lease_token=? AND lease_until>?)");
    expect(worker).toContain("generation=MAX(pull_requests.generation,excluded.generation)");
    expect(worker).toContain('error.message === "sync_lease_lost"');
    expect(worker).toContain("invalid_sync_page_limit");
    expect(worker).toContain("lease_token=CASE WHEN ? THEN NULL ELSE lease_token END");
    expect(worker).toContain("terminal = complete || page + 1 === maxPages");
  });
  it("uses durable, bounded, pre-CSRF rate limits for opt-in and withdrawal", () => {
    const worker = readRepositoryFile("../src/worker.ts");
    const migration = readRepositoryFile("../migrations/0002_rate_limits.sql");
    expect(migration).toMatch(/PRIMARY KEY \(scope, actor_key\)/);
    expect(migration).toMatch(/rate_limits_expiry/);
    expect(worker).toContain("CF-Connecting-IP");
    expect(worker).toContain("ON CONFLICT(scope,actor_key) DO UPDATE");
    expect(worker).toContain("MIN(rate_limits.request_count+1,?)");
    expect(worker.indexOf('consumeMutationRateLimit(c, "selection")')).toBeLessThan(worker.indexOf("const s = await csrf(c)"));
    expect(worker.indexOf('consumeMutationRateLimit(c, "consent_withdrawal")')).toBeLessThan(worker.lastIndexOf("const s = await csrf(c)"));
  });
  it("advances the bounded sync cursor before fenced partial progress is persisted", () => {
    const worker = readRepositoryFile("../src/worker.ts");
    expect(worker).toContain("cursor = result.cursor;");
    expect(worker).toContain("complete ? null : cursor");
  });
  it("persists only the minimal approved PR fields", () => {
    const migration = readRepositoryFile("../migrations/0001_initial.sql");
    expect(migration).toMatch(/pr_id TEXT PRIMARY KEY/);
    expect(migration).toMatch(/merged_at TEXT NOT NULL/);
    expect(migration).not.toMatch(/\b(title|body|patch|content)\b/i);
  });
});
