import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Window } from "happy-dom";

const html = readFileSync(new URL("../src/frontend/index.html", import.meta.url), "utf8").replace(/\s*<script src="\/app\.js" defer><\/script>/, "").replace(/\s*<link rel="stylesheet" href="\/styles\.css" \/>/, "");
const app = readFileSync(new URL("../src/frontend/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/frontend/styles.css", import.meta.url), "utf8");
const tick = async () => { for (let i = 0; i < 8; i += 1) await new Promise(resolve => setTimeout(resolve, 0)); };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const originalGlobals = Object.fromEntries(["window", "document", "fetch", "Option"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));

beforeEach(() => {
  for (const [key, descriptor] of Object.entries(originalGlobals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});
afterEach(() => {
  for (const [key, descriptor] of Object.entries(originalGlobals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});

function boot({ hash = "", handler } = {}) {
  const window = new Window({ url: `https://league.test/${hash}` });
  window.document.write(html); window.document.close();
  const style = window.document.createElement("style"); style.textContent = styles; window.document.head.append(style);
  const calls = [];
  const fetch = async (path, options = {}) => { calls.push({ path: String(path), options }); return handler(String(path), options); };
  window.fetch = fetch;
  Object.assign(globalThis, { window, document: window.document, Headers, Response, fetch });
  window.eval(app);
  return { window, document: window.document, calls };
}

const anonymous = (path) => {
  if (path.startsWith("/api/leaderboard")) return json({ rows: [] });
  if (path === "/api/rules") return json({ rules: [] });
  if (path === "/api/session") return json({ authenticated: false, connectUrl: "/api/auth/github" });
  throw new Error(`Unexpected request ${path}`);
};

describe("public leaderboard frontend", () => {
  it("links a ranking to a public profile and also loads that profile on direct hash entry", async () => {
    const handler = (path) => {
      if (path.startsWith("/api/leaderboard")) return json({ rows: [{ rank: 1, profileId: "profile/42", displayName: "Ada", repository: "octo/league", score: 8 }] });
      if (path === "/api/profiles/profile%2F42") return json({ displayName: "Ada", declarations: { status: "self_declared_unverified", tooling: ["Cursor", "Claude Code"], models: ["GPT-4.1", "o3"] } });
      return anonymous(path);
    };
    const first = boot({ handler }); await tick();
    const participant = first.document.querySelector("#leaderboard-body a");
    expect(participant?.textContent).toBe("Ada"); expect(participant?.getAttribute("href")).toBe("#/profiles/profile%2F42");
    first.window.location.hash = participant.getAttribute("href"); first.window.dispatchEvent(new first.window.HashChangeEvent("hashchange")); await tick();
    expect(first.document.querySelector("#profile").hidden).toBe(false);
    const profileText = first.document.querySelector("#profile-content").textContent;
    expect(profileText).toContain("Cursor, Claude Code");
    expect(profileText).toContain("GPT-4.1, o3");
    expect(profileText).toContain("self-declared — unverified");
    expect(profileText).not.toContain("attribution");

    const direct = boot({ hash: "#/profiles/profile%2F42", handler }); await tick();
    expect(direct.calls.some(call => call.path === "/api/profiles/profile%2F42")).toBe(true);
    expect(direct.document.querySelector("#profile-content h2")?.textContent).toBe("Ada");
  });

  it("renders leaderboard loading, empty, error, and retry states", async () => {
    let attempt = 0;
    const page = boot({ handler: (path) => {
      if (path.startsWith("/api/leaderboard")) { attempt += 1; return attempt === 1 ? new Response("temporarily unavailable", { status: 503 }) : json({ rows: [] }); }
      return anonymous(path);
    } });
    expect(page.document.querySelector("#leaderboard-status").textContent).toBe("Loading leaderboard…"); await tick();
    expect(page.document.querySelector("#leaderboard-status").textContent).toContain("Request failed (503)");
    expect(page.document.querySelector("#leaderboard-retry").hidden).toBe(false);
    page.document.querySelector("#leaderboard-retry").click(); await tick();
    expect(page.document.querySelector("#leaderboard-status").textContent).toContain("No opted-in participants");
    expect(page.document.querySelector("#leaderboard-body").textContent).toContain("No opted-in participants");
  });

  it("uses the exact repository contract and sends explicit consent with the CSRF token", async () => {
    const page = boot({ handler: (path, options) => {
      if (path.startsWith("/api/leaderboard")) return json({ rows: [] });
      if (path === "/api/rules") return json({ rules: [] });
      if (path === "/api/session") return json({ authenticated: true, csrfToken: "csrf-1", participating: false });
      if (path === "/api/repos") return json({ repos: [{ id: "repo-1", fullName: "octo/public" }] });
      if (path === "/api/selections") return json({ ok: true }, 201);
      throw new Error(`Unexpected request ${path}`);
    } }); await tick();
    const select = page.document.querySelector("#repo-select"); const repositoryOption = select.querySelectorAll("option")[1]; expect(repositoryOption?.textContent).toBe("octo/public"); expect(repositoryOption?.value).toBe("repo-1");
    select.value = "repo-1"; page.document.querySelector("#participation-form").dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true })); await tick();
    expect(page.calls.some(call => call.path === "/api/selections")).toBe(false);
    page.document.querySelector("#consent-checkbox").checked = true; page.document.querySelector("#participation-form").dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true })); await tick();
    const mutation = page.calls.find(call => call.path === "/api/selections"); expect(mutation.options.headers.get("X-CSRF-Token")).toBe("csrf-1"); expect(JSON.parse(mutation.options.body)).toMatchObject({ repoId: "repo-1", consent: true });
  });

  it("withdraws, then handles a non-JSON 401 without a stale session reload restoring protected controls", async () => {
    let withdrawn = false, expire = false;
    const page = boot({ handler: (path) => {
      if (path.startsWith("/api/leaderboard")) return json({ rows: [] });
      if (path === "/api/rules") return json({ rules: [] });
      if (path === "/api/session") return json({ authenticated: true, csrfToken: "csrf-1", participating: !withdrawn });
      if (path === "/api/consent") { withdrawn = true; return json({ ok: true }); }
      if (path === "/api/selections") return expire ? new Response("expired", { status: 401 }) : json({ ok: true }, 201);
      if (path === "/api/repos") return json({ repos: [{ id: "repo-1", fullName: "octo/public" }] });
      throw new Error(`Unexpected request ${path}`);
    } }); await tick();
    expect(page.document.querySelector("#withdrawal-panel").hidden).toBe(false);
    page.document.querySelector("#withdraw-consent").click(); await tick();
    expect(page.document.querySelector("#withdrawal-panel").hidden).toBe(true); expect(page.document.querySelector("#participation-form").hidden).toBe(false);
    expire = true; page.document.querySelector("#repo-select").value = "repo-1"; page.document.querySelector("#consent-checkbox").checked = true; page.document.querySelector("#participation-form").dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true })); await tick();
    expect(page.document.querySelector("#participation-form").hidden).toBe(true);
    expect(page.document.querySelector("#withdrawal-panel").hidden).toBe(true);
    expect(page.document.querySelector("#session-status").textContent).toContain("Your session expired");
    expect(page.document.querySelector("#connect-action a")?.textContent).toContain("Connect GitHub");
    expect(page.window.getComputedStyle(page.document.querySelector("#participation-form")).display).toBe("none");
  });
});
