import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eligibleRepo, GitHubClient, prohibitedGitHubAccess } from "../src/github";
import { utcMonth, validMonth } from "../src/worker";

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

describe("publication safety contract", () => {
  it("uses strict UTC month boundaries", () => {
    expect(utcMonth("2025-01-31T23:59:59.999Z")).toBe("2025-01");
    expect(utcMonth("2025-02-01T00:00:00.000Z")).toBe("2025-02");
    expect(validMonth("2025-02")).toBe(true);
    expect(validMonth("2025-2")).toBe(false);
    expect(validMonth("2025-13")).toBe(false);
  });
  it("makes withdrawal and sync upserts fail closed on consent/repository visibility", () => {
    const worker = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
    expect(worker).toContain("DELETE FROM pull_requests WHERE author_id=?");
    expect(worker).toContain("p.consent_active=1");
    expect(worker).toContain("c.active=1 AND c.visibility='public'");
    expect(worker).toContain("ON CONFLICT(pr_id)");
    expect(worker).toContain("visibility='unknown'");
  });
  it("persists only the minimal approved PR fields", () => {
    const migration = readFileSync(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8");
    expect(migration).toMatch(/pr_id TEXT PRIMARY KEY/);
    expect(migration).toMatch(/merged_at TEXT NOT NULL/);
    expect(migration).not.toMatch(/\b(title|body|patch|content)\b/i);
  });
});
