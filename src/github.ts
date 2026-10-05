export type Repo = { id: string; nameWithOwner: string; visibility: "PUBLIC" | string };
export type Pull = { id: string; mergedAt: string; author: { id: string; login: string; avatarUrl?: string } | null };
export const eligibleRepo = <T extends Repo>(repos: T[], submittedId: string): T | null => repos.find(repo => repo.id === submittedId && repo.visibility === "PUBLIC") ?? null;

const API = "https://api.github.com";
export type GitHubDiagnosticCategory = "http_error" | "transport_error" | "timeout" | "invalid_json" | "graphql_error" | "invalid_response" | "configuration_error";
export class GitHubRequestError extends Error {
  constructor(readonly category: GitHubDiagnosticCategory, readonly status = 0) { super("github_request_failed"); }
}
const requestJson = async (url: string, init: RequestInit, fetcher: typeof fetch): Promise<any> => {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
  try {
    let response: Response;
    try { response = await fetcher(url, { ...init, signal: controller.signal }); }
    catch { throw new GitHubRequestError(controller.signal.aborted ? "timeout" : "transport_error"); }
    if (!response.ok) throw new GitHubRequestError("http_error", response.status);
    try { return await response.json(); }
    catch { throw new GitHubRequestError(controller.signal.aborted ? "timeout" : "invalid_json", response.status); }
  } finally { clearTimeout(timer); }
};
const bytes64 = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const pemBytes = (pem: string) => Uint8Array.from(atob(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----|\s/g, "")), c => c.charCodeAt(0));
const graph = async (token: string, query: string, variables: Record<string, unknown>, fetcher = fetch) => {
  const data = await requestJson(`${API}/graphql`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "vibe-coder-league" }, body: JSON.stringify({ query, variables }) }, fetcher);
  if (Array.isArray(data?.errors) && data.errors.length) throw new GitHubRequestError("graphql_error", 200);
  if (!data?.data || typeof data.data !== "object" || !Object.hasOwn(data.data, "repository")) throw new GitHubRequestError("invalid_response", 200);
  return data;
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
    if (!Array.isArray(installations?.installations)) throw new GitHubRequestError("invalid_response", 200);
    const result: Array<Repo & { installationId: string }> = [];
    for (const installation of installations.installations ?? []) {
      if (!installation || !Number.isInteger(installation.id) || installation.id <= 0) throw new GitHubRequestError("invalid_response", 200);
      const page = await this.rest(`/user/installations/${encodeURIComponent(String(installation.id))}/repositories?per_page=100`);
      if (!Array.isArray(page?.repositories)) throw new GitHubRequestError("invalid_response", 200);
      for (const repo of page.repositories) {
        if (!repo || typeof repo.node_id !== "string" || !repo.node_id || typeof repo.full_name !== "string" || !/^[^/]+\/[^/]+$/.test(repo.full_name) || typeof repo.private !== "boolean") throw new GitHubRequestError("invalid_response", 200);
        result.push({ id: repo.node_id, nameWithOwner: repo.full_name, visibility: repo.private ? "PRIVATE" : "PUBLIC", installationId: String(installation.id) });
      }
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
    const connection = found.pullRequests, info = connection?.pageInfo;
    // The User-only fragment returns {} for Bot/Organization actors; those are not eligible users.
    const nodes = Array.isArray(connection?.nodes) ? connection.nodes.map((pull: any) => pull?.author && typeof pull.author === "object" && Object.keys(pull.author).length === 0 ? { ...pull, author: null } : pull) : null;
    if (!["PUBLIC", "PRIVATE", "INTERNAL"].includes(found.visibility) || !nodes || typeof info?.hasNextPage !== "boolean" ||
        !(info.endCursor === null || typeof info.endCursor === "string") || (info.hasNextPage && !info.endCursor) ||
        nodes.some((pull: any) => !pull || typeof pull.id !== "string" || typeof pull.mergedAt !== "string" || !Number.isFinite(Date.parse(pull.mergedAt)) ||
          !(pull.author === null || (pull.author && typeof pull.author.id === "string" && typeof pull.author.login === "string")))) {
      throw new GitHubRequestError("invalid_response", 200);
    }
    return { pulls: nodes, cursor: info.endCursor, hasNext: info.hasNextPage, visibility: found.visibility };
  }
  private async rest(path: string, viewerDiagnostic = false): Promise<any> {
    if (!viewerDiagnostic) return requestJson(`${API}${path}`, { method: "GET", headers: { Authorization: `Bearer ${this.userToken}`, Accept: "application/vnd.github+json", "User-Agent": "vibe-coder-league" } }, this.fetcher);
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

/** Preserve a configured legacy App ID; otherwise use GitHub's recommended Client ID issuer. */
export function resolveGitHubAppIssuer(bindings: { GITHUB_APP_ID?: string; GITHUB_APP_CLIENT_ID?: string }): string {
  for (const value of [bindings.GITHUB_APP_ID, bindings.GITHUB_APP_CLIENT_ID]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  throw new GitHubRequestError("configuration_error");
}

/** Mint a short-lived installation token; it is held only in memory for the sync request. */
export async function installationToken(issuer: string, privateKeyPem: string, installationId: string, fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init)): Promise<string> {
  if (typeof issuer !== "string" || !issuer.trim()) throw new GitHubRequestError("configuration_error");
  const issued = Math.floor(Date.now() / 1000) - 30, expires = issued + 9 * 60;
  const head = bytes64(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = bytes64(new TextEncoder().encode(JSON.stringify({ iat: issued, exp: expires, iss: issuer })));
  let signature: ArrayBuffer;
  try {
    const key = await crypto.subtle.importKey("pkcs8", pemBytes(privateKeyPem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claims}`));
  } catch { throw new GitHubRequestError("configuration_error"); }
  let status = 0;
  const data = await requestJson(`${API}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, { method: "POST", headers: { Authorization: `Bearer ${head}.${claims}.${bytes64(new Uint8Array(signature))}`, Accept: "application/vnd.github+json", "User-Agent": "vibe-coder-league" } }, async (input, init) => {
    const response = await fetcher(input, init); status = response.status; return response;
  });
  if (typeof data?.token !== "string" || !data.token) throw new GitHubRequestError("invalid_response", status);
  return data.token;
}
