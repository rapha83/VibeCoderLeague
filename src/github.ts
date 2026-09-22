export type Repo = { id: string; nameWithOwner: string; visibility: "PUBLIC" | string };
export type Pull = { id: string; mergedAt: string; author: { id: string; login: string; avatarUrl?: string } | null };
export const eligibleRepo = <T extends Repo>(repos: T[], submittedId: string): T | null => repos.find(repo => repo.id === submittedId && repo.visibility === "PUBLIC") ?? null;

const API = "https://api.github.com";
const bytes64 = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const pemBytes = (pem: string) => Uint8Array.from(atob(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----|\s/g, "")), c => c.charCodeAt(0));
const graph = async (token: string, query: string, variables: Record<string, unknown>, fetcher = fetch) => {
  const response = await fetcher(`${API}/graphql`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "vibe-coder-league" }, body: JSON.stringify({ query, variables }) });
  if (!response.ok) throw new Error(`github_${response.status}`);
  return response.json() as Promise<any>;
};

// This fixed document deliberately excludes title, body, files, patches, review text and source content.
const PULLS_QUERY = `query LeaguePulls($owner:String!,$name:String!,$after:String){repository(owner:$owner,name:$name){id nameWithOwner visibility pullRequests(first:50,after:$after,states:MERGED,orderBy:{field:UPDATED_AT,direction:DESC}){pageInfo{hasNextPage endCursor}nodes{id mergedAt author{... on User{id login avatarUrl}}}}}}`;

export type ViewerDiagnosticCategory = "http_error" | "transport_error" | "invalid_json" | "invalid_user_shape";
export type ViewerDiagnostic = { category: ViewerDiagnosticCategory; status: number };

/** An allowlisted viewer failure description. It deliberately carries no upstream payload or cause. */
export class GitHubViewerError extends Error {
  constructor(readonly diagnostic: ViewerDiagnostic) { super("github_viewer_failed"); }
}

export class GitHubClient {
  constructor(private readonly userToken: string, private readonly fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init)) {}
  async viewer(): Promise<{ id: string; login: string; avatarUrl: string | null }> {
    const viewer = await this.rest("/user", true);
    if (!viewer || typeof viewer.node_id !== "string" || !viewer.node_id || typeof viewer.login !== "string" || !viewer.login) {
      throw new GitHubViewerError({ category: "invalid_user_shape", status: 200 });
    }
    return { id: viewer.node_id, login: viewer.login, avatarUrl: typeof viewer.avatar_url === "string" ? viewer.avatar_url : null };
  }
  async accessibleRepos(): Promise<Array<Repo & { installationId: string }>> {
    const installations = await this.rest("/user/installations");
    const result: Array<Repo & { installationId: string }> = [];
    for (const installation of installations.installations ?? []) {
      const page = await this.rest(`/user/installations/${encodeURIComponent(String(installation.id))}/repositories?per_page=100`);
      for (const repo of page.repositories ?? []) result.push({ id: String(repo.node_id), nameWithOwner: String(repo.full_name), visibility: repo.private ? "PRIVATE" : "PUBLIC", installationId: String(installation.id) });
    }
    return result;
  }
  async publicRepo(repo: Repo): Promise<Repo> {
    const [owner, name] = repo.nameWithOwner.split("/");
    if (!owner || !name) throw new Error("invalid_repo");
    const data = await graph(this.userToken, `query Repo($owner:String!,$name:String!){repository(owner:$owner,name:$name){id nameWithOwner visibility}}`, { owner, name }, this.fetcher);
    const found = data.data?.repository;
    if (!found || found.id !== repo.id || found.visibility !== "PUBLIC") throw new Error("repo_not_public");
    return found;
  }
  async pulls(repo: Repo, after: string | null): Promise<{ pulls: Pull[]; cursor: string | null; hasNext: boolean; visibility: string }> {
    const [owner, name] = repo.nameWithOwner.split("/");
    const data = await graph(this.userToken, PULLS_QUERY, { owner, name, after }, this.fetcher);
    const found = data.data?.repository;
    if (!found) throw new Error("repo_inaccessible");
    return { pulls: found.pullRequests.nodes ?? [], cursor: found.pullRequests.pageInfo.endCursor, hasNext: found.pullRequests.pageInfo.hasNextPage, visibility: found.visibility };
  }
  private async rest(path: string, viewerDiagnostic = false): Promise<any> {
    let response: Response;
    try {
      response = await this.fetcher(`${API}${path}`, { method: "GET", headers: { Authorization: `Bearer ${this.userToken}`, Accept: "application/vnd.github+json", "User-Agent": "vibe-coder-league" } });
    } catch {
      if (viewerDiagnostic) throw new GitHubViewerError({ category: "transport_error", status: 0 });
      throw new Error("github_transport_error");
    }
    if (!response.ok) {
      if (viewerDiagnostic) throw new GitHubViewerError({ category: "http_error", status: response.status });
      throw new Error(`github_${response.status}`);
    }
    try {
      return await response.json();
    } catch {
      if (viewerDiagnostic) throw new GitHubViewerError({ category: "invalid_json", status: response.status });
      throw new Error("github_invalid_json");
    }
  }
}

export const prohibitedGitHubAccess = (url: string, graphql: string = "") =>
  /\/contents(?:\/|\s|$)|\/pulls(?:\/|\s|$)|\.diff(?:\s|$)|\.patch(?:\s|$)|\b(title|body|files|patch|content)\b/i.test(`${url} ${graphql}`);

/** Mint a short-lived installation token; it is held only in memory for the sync request. */
export async function installationToken(appId: string, privateKeyPem: string, installationId: string, fetcher: typeof fetch = fetch): Promise<string> {
  const issued = Math.floor(Date.now() / 1000) - 30, expires = issued + 9 * 60;
  const head = bytes64(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = bytes64(new TextEncoder().encode(JSON.stringify({ iat: issued, exp: expires, iss: appId })));
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(privateKeyPem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claims}`));
  const response = await fetcher(`${API}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, { method: "POST", headers: { Authorization: `Bearer ${head}.${claims}.${bytes64(new Uint8Array(signature))}`, Accept: "application/vnd.github+json", "User-Agent": "vibe-coder-league" } });
  const data = await response.json() as { token?: string }; if (!response.ok || !data.token) throw new Error(`github_installation_${response.status}`); return data.token;
}
