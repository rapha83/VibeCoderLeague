import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { eligibleRepo, GitHubClient, GitHubViewerError, prohibitedGitHubAccess } from "../src/github";
import { utcMonth, validMonth } from "../src/worker";

const readRepositoryFile = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const fakeViewerToken = "test-user-token-not-for-diagnostics";
const viewerResponse = { node_id: "U_test", login: "octo", avatar_url: "https://example.test/avatar" };

async function viewerFailure(response: Response | Error) {
  const client = new GitHubClient(fakeViewerToken, (async () => {
    if (response instanceof Error) throw response;
    return response;
  }) as typeof fetch);
  try {
    await client.viewer();
    throw new Error("expected viewer failure");
  } catch (error) {
    expect(error).toBeInstanceOf(GitHubViewerError);
    return (error as GitHubViewerError).diagnostic;
  }
}

describe("GitHub viewer boundary", () => {
  it("uses the freshly supplied user token only for GET https://api.github.com/user and validates the user contract", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new GitHubClient(fakeViewerToken, (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(viewerResponse));
    }) as typeof fetch);

    await expect(client.viewer()).resolves.toEqual({ id: "U_test", login: "octo", avatarUrl: "https://example.test/avatar" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.github.com/user");
    expect(calls[0].init?.method).toBe("GET");
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${fakeViewerToken}`);
    expect(headers.get("Accept")).toBe("application/vnd.github+json");
    expect(headers.get("User-Agent")).toBe("vibe-coder-league");
  });

  it("uses a global receiver for the default fetcher in Miniflare/workerd", async () => {
    const bundle = await build({
      bundle: true,
      format: "esm",
      platform: "browser",
      write: false,
      stdin: {
        resolveDir: process.cwd(),
        sourcefile: "github-client-receiver-worker.ts",
        contents: `import { GitHubClient } from "./src/github.ts";
          export default { async fetch() {
            let receiver = "not_called";
            globalThis.fetch = function () {
              receiver = this === globalThis ? "global" : "other";
              return new Response(JSON.stringify({ node_id: "U_test", login: "octo", avatar_url: null }));
            };
            const viewer = await new GitHubClient("test-user-token").viewer();
            return Response.json({ receiver, viewer });
          } };`
      }
    });
    const mf = new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: "2024-12-18" });
    try {
      const response = await mf.dispatchFetch("https://worker.invalid/");
      expect(await response.json()).toEqual({ receiver: "global", viewer: { id: "U_test", login: "octo", avatarUrl: null } });
    } finally {
      await mf.dispose();
    }
  });

  it("reports only an allowlisted diagnostic for viewer failures", async () => {
    await expect(viewerFailure(new Response("ignored upstream body", { status: 401 }))).resolves.toEqual({ category: "http_error", status: 401 });
    await expect(viewerFailure(new Response("ignored upstream body", { status: 403 }))).resolves.toEqual({ category: "http_error", status: 403 });
    await expect(viewerFailure(new Response("not json", { status: 200 }))).resolves.toEqual({ category: "invalid_json", status: 200 });
    await expect(viewerFailure(new Response(JSON.stringify({ node_id: "U_test", login: 42, email: "not-allowed@example.test" })))).resolves.toEqual({ category: "invalid_user_shape", status: 200 });
    await expect(viewerFailure(new Error("transport sentinel not for output"))).resolves.toEqual({ category: "transport_error", status: 0 });
  });
});

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
