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
  const window = new Window({ url: `https://viberivals.com/${hash}` });
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
  it("presents VibeRivals branding, canonical share metadata and transparent AI competition scoring", async () => {
    const page = boot({ handler: anonymous }); await tick();
    const meta = selector => page.document.querySelector(selector).getAttribute("content");
    expect(page.document.title).toBe("Vibe Coding Rivals — The vibe coding competition");
    expect(page.document.querySelector('.hero .eyebrow').textContent).toBe("The vibe coding competition");
    expect(page.document.querySelector('.wordmark').textContent).toBe("VibeRivals");
    expect(page.document.querySelector('.wordmark').getAttribute("aria-label")).toBe("VibeRivals home");
    expect(page.document.querySelector('#page-title').textContent).toBe("Vibe Coding Rivals");
    expect(page.document.querySelector('link[rel="canonical"]').href).toBe("https://viberivals.com/");
    expect(meta('meta[property="og:url"]')).toBe("https://viberivals.com/");
    expect(meta('meta[property="og:site_name"]')).toBe("VibeRivals");
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) expect(meta(selector)).toBe(page.document.title);
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      expect(meta(selector).toLowerCase()).toContain("monthly utc");
      expect(meta(selector)).toContain("quality or productivity");
      expect(meta(selector)).toContain("self-declared, unverified");
      expect(meta(selector)).toContain("eligible merged PR");
    }
    expect(meta('meta[name="twitter:card"]')).toBe("summary");
    expect(page.document.querySelector('.hero-copy').textContent).toContain("tools and models");
    expect(page.document.querySelector('.hero-copy').textContent).toContain("Compete with builders using AI");
    expect(page.document.querySelector('.hero-copy').textContent).toContain("self-declared, unverified");
    expect(page.document.querySelectorAll('h1')).toHaveLength(1);
    expect(page.document.querySelector('.hero').getAttribute('aria-labelledby')).toBe("page-title");
    expect(page.document.querySelector('.hero-ranking-link').textContent).toContain("View the leaderboard");
    expect(page.document.querySelector('.hero-ranking-link').getAttribute('href')).toBe("#leaderboard");
    expect(page.document.querySelector('#connect-action a').textContent).toBe("Connect GitHub");
    expect(page.document.querySelector('#sync-now').textContent).toBe("Sync my PRs");
    expect(page.document.querySelector('#withdrawal-panel').hidden).toBe(true);
    expect(page.document.querySelector('.hero-note').textContent).toContain("not code quality or developer productivity");
    expect(page.document.querySelector('.hero-note').textContent).toContain("merged-at UTC month");
    expect(page.document.querySelector('.ranking-heading').textContent).toContain("1 eligible merged PR = 1 point");
    expect(page.document.querySelector('#declarations-help').textContent).toContain("do not affect points");
    expect(page.document.querySelector('#leaderboard-title').textContent).toBe("Vibe coding leaderboard");
    expect(page.document.querySelector('#participation-title').textContent).toBe("Join the vibe coding race.");
    expect(page.document.querySelector('.hero .button-primary').textContent).toContain("Join the vibe coding race");
    expect(page.document.querySelector('.hero .button-primary').getAttribute("href")).toBe("#participate");
    expect(page.document.querySelector('#leaderboard-status').textContent).toContain("join VibeRivals below");
    expect(`${html}\n${app}`).not.toMatch(/Vibe Coder League|join the league|Leaving the league|Climb the league/i);
  });

  it("keeps monthly profile routing and self-declared AI context under the VibeRivals identity", async () => {
    const page = boot({ hash: "#/profiles/coder?month=2026-09", handler: path => path === "/api/profiles/coder?month=2026-09" ? json({ profile: { displayName: "Coder", month: "2026-09", repositories: [{ pullRequests: 3 }], declarations: { status: "self_declared_unverified", tooling: ["Codex"], models: ["Custom model"] } } }) : anonymous(path) }); await tick();
    expect(page.document.querySelector('#profile').hidden).toBe(false);
    expect(page.document.querySelector('#profile .eyebrow').textContent).toContain("VibeRivals");
    const content = page.document.querySelector('#profile-content').textContent;
    expect(content).toContain("This VibeRivals profile");
    expect(content).toContain("not a measure of code quality or developer productivity");
    expect(content).toContain("Codex"); expect(content).toContain("Custom model");
    expect(content).toContain("self-declared — unverified");
    expect(page.document.querySelector('.profile-stats').textContent).toContain("Merged pull requests in 2026-09");
    expect(page.document.querySelector('.profile-stats').lastElementChild.querySelector('dd').textContent).toBe("3");
  });

  it("offers recognized optional tools with complete keyboard and custom controls", async () => {
    const page = boot({ handler: path => path === "/api/session" ? json({ authenticated: true, csrfToken: "csrf" }) : path === "/api/repos" ? json({ repos: [{ id: "1", fullName: "a/b" }] }) : anonymous(path) }); await tick();
    const input = page.document.querySelector("#declared-tooling"); const model = page.document.querySelector("#declared-model"); const list = page.document.querySelector("#tool-options");
    const key = value => input.dispatchEvent(new page.window.KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
    expect(input.value).toBe(""); expect(model.value).toBe(""); expect(input.getAttribute("role")).toBe("combobox"); input.focus();
    expect([...list.children].map(option => option.textContent)).toEqual(["Codex", "Claude Code", "Antigravity", "Nimrava", "OpenClaw", "Hermes", "Pi", "OpenCode", "Cursor", "GitHub Copilot", "Aider", "Cline", "Roo Code", "Devin Desktop (formerly Windsurf)", "Other/custom", "Not informed"]);
    key("ArrowDown"); expect(input.getAttribute("aria-activedescendant")).toBe(list.firstElementChild.id); key("ArrowDown"); key("ArrowUp"); key("Enter"); expect(input.value).toBe("Codex"); expect(list.hidden).toBe(true);
    input.value = "Claude"; input.dispatchEvent(new page.window.Event("input")); expect(list.firstElementChild.textContent).toBe("Claude Code"); key("ArrowDown"); key("Escape"); expect(input.value).toBe("Claude"); expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    input.value = "Legacy Windsurf + private helper"; input.dispatchEvent(new page.window.Event("input")); list.firstElementChild.click(); expect(input.value).toBe("Legacy Windsurf + private helper");
    model.value = "Independent model"; input.click(); list.lastElementChild.click(); expect(input.value).toBe(""); expect(model.value).toBe("Independent model");
    input.click(); key("ArrowUp"); expect(list.lastElementChild.getAttribute("aria-selected")).toBe("true"); key("Tab"); expect(list.hidden).toBe(true); expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(page.calls.some(call => call.path === "/api/selections")).toBe(false);
  });

  it.each(["Codex", "Windsurf", "My custom tool <script>literal</script>", ""])("preserves %s through submission and fresh API-backed refresh", async tooling => {
    let saved;
    const handler = (path, options) => {
      if (path === "/api/session") return json({ authenticated: true, csrfToken: "csrf", participating: Boolean(saved) });
      if (path === "/api/repos") return json({ repos: [{ id: "1", fullName: "a/b" }] });
      if (path === "/api/selections") { saved = JSON.parse(options.body); return json({ ok: true }); }
      if (path.startsWith("/api/leaderboard")) return json({ rows: saved ? [{ rank: 1, displayName: "Participant", repository: "a/b", score: 2, declarations: { status: "self_declared_unverified", tooling: saved.declaredTooling ? [saved.declaredTooling] : [], models: [saved.declaredModel] } }] : [] });
      return anonymous(path);
    };
    const page = boot({ handler }); await tick(); page.document.querySelector("#repo-select").value = "1"; page.document.querySelector("#declared-tooling").value = tooling; page.document.querySelector("#declared-model").value = "Separate model"; page.document.querySelector("#consent-checkbox").checked = true;
    page.document.querySelector("#participation-form").dispatchEvent(new page.window.Event("submit", { cancelable: true })); await tick();
    expect(saved.declaredTooling).toBe(tooling || undefined); expect(saved.declaredModel).toBe("Separate model");
    const refreshed = boot({ handler }); await tick();
    expect(refreshed.document.querySelector(".leaderboard-entry").children[3].textContent).toBe(tooling || "Not informed");
    expect(refreshed.document.querySelector(".podium-configuration").textContent).toContain(tooling || "Not informed"); expect(refreshed.document.querySelector(".podium-configuration").textContent).toContain("Separate model");
    expect(refreshed.document.querySelector("#podium script")).toBeNull();
  });

  it("renders safe multi-value declarations, missing fallbacks and long mobile content on both surfaces", async () => {
    const long = "Custom-" + "x".repeat(240); const rows = [{ displayName: "One", declarations: { status: "self_declared_unverified", tooling: [long, "<img src=x onerror=alert(1)>"], models: ["Model A", "Model B"] } }, { displayName: "Two", declarations: { status: "self_declared_unverified", tooling: [], models: ["", null] } }, { displayName: "Three" }];
    const page = boot({ handler: path => path.startsWith("/api/leaderboard") ? json({ rows }) : anonymous(path) }); await tick();
    const entries = page.document.querySelectorAll(".leaderboard-entry"); const cards = page.document.querySelectorAll(".podium-card");
    expect(entries[0].children[3].textContent).toBe(`${long}, <img src=x onerror=alert(1)>`); expect(entries[0].children[4].textContent).toBe("Model A, Model B");
    expect(cards[0].querySelector("dd").textContent).toBe(entries[0].children[3].textContent); expect(page.document.querySelector("#ranking-surfaces img")).toBeNull();
    for (const card of cards) expect(card.textContent).toContain("Self-declared current configuration · unverified by PR");
    expect(entries[1].children[3].textContent).toBe("Not informed"); expect(entries[2].children[4].textContent).toBe("Not informed");
    expect(page.document.querySelector("#declarations-help").textContent).toContain("not attributed to the selected month");
    expect(page.document.querySelector(".table-wrap").getAttribute("tabindex")).toBe("0");
    expect(styles).toContain(".podium-configuration dd { margin:0; overflow-wrap:anywhere; }"); expect(styles).toContain("min-width:52rem"); expect(styles).toContain(".podium { grid-template-columns:1fr;"); expect(styles).toContain("overflow-y:auto");
  });

  it.each([
    ["rapha83/VibeRivals", ["rapha83/VibeRivals"]],
    ["octo/one,other-owner/repo.two", ["octo/one", "other-owner/repo.two"]],
    ["a/b, c/d", []], ["a/b,bad", []], ["a/b,", []],
    ["https://github.com/a/b", []], ["//github.com/a/b", []],
    ["javascript:alert(1)", []], ["a/..", []], ["a--b/repo", []],
    ["a/b?x=1", []], ["a/b#fragment", []], ["a/%2F", []], ["a/b\n", []], ["a\n/b", []],
    ["<img src=x onerror=alert(1)>/repo", []], ["a/repo&evil", []],
    [null, []], [42, []], [{ repository: "a/b" }, []],
  ])("links only unambiguous GitHub names: %j", async (repository, names) => {
    const page = boot({ handler: path => path.startsWith("/api/leaderboard") ? json({ rows: [{ displayName: "Rival", repository, score: 4 }] }) : anonymous(path) }); await tick();
    for (const container of [page.document.querySelector(".leaderboard-entry").children[2], page.document.querySelector(".podium-repository")]) {
      const links = [...container.querySelectorAll("a")];
      expect(links.map(link => link.getAttribute("href"))).toEqual(names.map(name => `https://github.com/${name}`));
      links.forEach((link, index) => { expect(link.textContent).toBe(names[index]); expect(link.getAttribute("aria-label")).toBe(`View ${names[index]} on GitHub`); expect(link.hasAttribute("target")).toBe(false); link.focus(); expect(page.document.activeElement).toBe(link); });
      expect(container.querySelector("img,script")).toBeNull();
      if (typeof repository === "string") expect(container.textContent).toBe(names.length ? names.join(", ") : repository);
    }
    expect(page.calls.every(call => call.path.startsWith("/api/"))).toBe(true);
    expect(page.document.querySelector(".leaderboard-entry").lastElementChild.textContent).toBe("4");
  });

  it.each([0, 1, 2, 3, 5])("renders %i API rows without placeholders, reordering or count changes", async count => {
    // Deliberately not alphabetical: the frontend must preserve server tie-breaking.
    const rows = Array.from({ length: count }, (_, index) => ({ rank: index + 1, profileId: `p/${index}`, displayName: ["Zed", "Ada", "Bea", "Cam", "Dee"][index], repository: `owner/repo-${index}`, score: index === 0 ? 0 : 7 }));
    const page = boot({ handler: path => path.startsWith("/api/leaderboard") ? json({ month: "2026-02", rows }) : anonymous(path) }); await tick();
    const cards = [...page.document.querySelectorAll("#podium li")];
    const entries = [...page.document.querySelectorAll(".leaderboard-entry")];
    expect(cards).toHaveLength(Math.min(3, count)); expect(entries).toHaveLength(count);
    expect(page.document.querySelector("#podium").hidden).toBe(count === 0);
    expect(cards.map(card => card.querySelector(".podium-name").textContent)).toEqual(rows.slice(0, 3).map(row => row.displayName));
    expect(cards.map(card => card.querySelector(".podium-count strong").textContent)).toEqual(rows.slice(0, 3).map(row => String(row.score)));
    expect(entries.map(entry => [...entry.children].map(cell => cell.textContent))).toEqual(rows.map(row => [String(row.rank), row.displayName, row.repository, "Not informed", "Not informed", String(row.score)]));
    cards.forEach((card, index) => { expect(card.querySelector("a").getAttribute("href")).toBe(`#/profiles/p%2F${index}?month=2026-02`); expect(card.querySelector(".podium-rank").textContent).toContain(["Gold", "Silver", "Bronze"][index]); });
    expect(page.document.querySelector("#ranking-surfaces").getAttribute("aria-busy")).toBe("false");
  });

  it("clears old cards while loading and rejects stale month responses on both surfaces", async () => {
    let resolveOld; let resolveNew;
    const page = boot({ handler: path => {
      if (path.startsWith("/api/leaderboard")) return new Promise(resolve => { if (!resolveOld) resolveOld = resolve; else resolveNew = resolve; });
      return anonymous(path);
    } });
    expect(page.document.querySelector("#podium").hidden).toBe(true);
    const month = page.document.querySelector("#month-picker"); month.value = "2026-01"; month.dispatchEvent(new page.window.Event("change"));
    expect(page.calls.at(-1).path).toBe("/api/leaderboard?month=2026-01");
    resolveNew(json({ month: "2026-01", rows: [{ rank: 1, profileId: "new", displayName: "Current", repository: "a/b", score: 3 }] })); await tick();
    resolveOld(json({ month: "2025-12", rows: [{ rank: 1, profileId: "old", displayName: "Stale", repository: "c/d", score: 9 }] })); await tick();
    expect(page.document.querySelector("#podium").textContent).toContain("Current");
    expect(page.document.querySelector("#leaderboard-body").textContent).not.toContain("Stale");
    expect(page.document.querySelector("#podium a").getAttribute("href")).toContain("month=2026-01");
  });

  it("removes previous podium and list data during a new request and on failure", async () => {
    let resolveNext; let attempts = 0;
    const page = boot({ handler: path => {
      if (path.startsWith("/api/leaderboard")) {
        attempts += 1;
        return attempts === 1 ? json({ month: "2026-01", rows: [{ rank: 1, profileId: "p", displayName: "Published", repository: "a/b", score: 2 }] }) : new Promise(resolve => { resolveNext = resolve; });
      }
      return anonymous(path);
    } }); await tick();
    expect(page.document.querySelectorAll("#podium li")).toHaveLength(1);
    const month = page.document.querySelector("#month-picker"); month.value = "2026-02"; month.dispatchEvent(new page.window.Event("change"));
    expect(page.document.querySelectorAll("#podium li")).toHaveLength(0);
    expect(page.document.querySelectorAll(".leaderboard-entry")).toHaveLength(0);
    expect(page.document.querySelector("#ranking-surfaces").getAttribute("aria-busy")).toBe("true");
    resolveNext(json({ error: "unavailable" }, 503)); await tick();
    expect(page.document.querySelector("#podium").hidden).toBe(true);
    expect(page.document.querySelector("#leaderboard-body").textContent).not.toContain("Published");
    expect(page.document.querySelector("#leaderboard-retry").hidden).toBe(false);
  });

  it("uses text rendering for untrusted participant content", async () => {
    const label = '<img src=x onerror="alert(1)">';
    const page = boot({ handler: path => path.startsWith("/api/leaderboard") ? json({ month: "2026-02", rows: [{ rank: 1, profileId: "p/#?", displayName: label, repository: label, score: 0 }] }) : anonymous(path) }); await tick();
    expect(page.document.querySelector("#podium").textContent).toContain(label);
    expect(page.document.querySelectorAll("#podium img, #leaderboard-body img")).toHaveLength(0);
    expect(page.document.querySelector("#podium a").getAttribute("href")).toBe("#/profiles/p%2F%23%3F?month=2026-02");
  });

  it("keeps text and state palette pairs above AA text contrast", () => {
    const luminance = hex => {
      const channels = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const tokens = Object.fromEntries([...styles.matchAll(/--([a-z-]+):(#(?:[0-9a-f]{6}));/g)].map(match => [match[1], match[2]]));
    for (const [foreground, background] of [[tokens.ink, tokens.panel], [tokens.muted, tokens.panel], [tokens.green, tokens.panel], [tokens.orange, tokens.panel], [tokens.gold, "#2a2540"], [tokens.silver, tokens.panel], [tokens.bronze, tokens.panel], ["#ffb5bd", tokens.panel], ["#90ecc8", tokens.panel], ["#07111c", tokens.green], ["#07111c", tokens["green-dark"]]]) {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      expect((values[0] + .05) / (values[1] + .05)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps headings, table semantics, native controls and mobile podium order explicit", async () => {
    const page = boot({ handler: anonymous }); await tick();
    expect(page.document.querySelectorAll("h1")).toHaveLength(1);
    expect(page.document.querySelectorAll("#profile-title")).toHaveLength(1);
    expect(page.document.querySelector("#month-picker").getAttribute("type")).toBe("month");
    expect(page.document.querySelector("label[for='month-picker']").textContent).toContain("UTC");
    expect(page.document.querySelectorAll("thead th[scope='col']")).toHaveLength(6);
    expect(page.document.querySelector(".table-wrap").getAttribute("tabindex")).toBe("0");
    expect(styles).toContain(".podium-1 { grid-column:2; grid-row:1;");
    expect(styles).toContain(".podium-card { grid-column:1; grid-row:auto;");
    expect(styles).toContain(":focus-visible");
  });

  it.each([
    [503, { error: "sync_unavailable", message: "secret upstream details", diagnostic: { correlationId: "support-1234", stage: "secret", category: "secret" } }, "Support reference: support-1234."],
    [503, { error: "sync_unavailable", correlationId: "<script>secret</script>" }, "Sync could not be completed."],
    [409, { error: "sync_not_available" }, "review consent and public repository access"],
    [429, { error: "rate_limited" }, "Wait before manually trying again."],
    [403, { error: "csrf_invalid" }, "Refresh your session"],
    [401, { error: "unauthorized" }, "Reconnect GitHub"],
    [200, { status: "unexpected" }, "The sync result could not be confirmed."]
  ])("announces safe actionable sync failure (%i), with exactly one manual POST", async (status, payload, copy) => {
    const page = boot({ handler: path => {
      if (path === "/api/session") return json({ authenticated: true, csrfToken: "csrf-1", participating: true });
      if (path === "/api/sync") return json(payload, status);
      return anonymous(path);
    } }); await tick();
    page.document.querySelector("#sync-now").click(); await tick();
    const message = page.document.querySelector("#sync-message");
    expect(message.textContent).toContain(copy); expect(message.textContent).not.toContain("secret");
    expect(message.className).toContain("error");
    expect(page.document.querySelector("#sync-now").disabled).toBe(false);
    expect(page.document.querySelector("#sync-now").textContent).toBe("Sync my PRs");
    expect(page.calls.filter(call => call.path === "/api/sync")).toHaveLength(1);
    if (status === 401) expect(page.document.querySelector("#withdrawal-panel").hidden).toBe(true);
  });
  it("links a ranking to a public profile and also loads that profile on direct hash entry", async () => {
    const handler = (path) => {
      if (path.startsWith("/api/leaderboard")) return json({ month: "2025-01", rows: [{ rank: 1, profileId: "profile/42", displayName: "Ada", repository: "octo/league", score: 8 }] });
      if (path === "/api/profiles/profile%2F42?month=2025-01" || path === "/api/profiles/profile%2F42") return json({ month: "2025-01", displayName: "Ada", declarations: { status: "self_declared_unverified", tooling: ["Cursor", "Claude Code"], models: ["GPT-4.1", "o3"] } });
      return anonymous(path);
    };
    const first = boot({ handler }); await tick();
    const participant = first.document.querySelector("#leaderboard-body a");
    expect(participant?.textContent).toBe("Ada"); expect(participant?.getAttribute("href")).toBe("#/profiles/profile%2F42?month=2025-01");
    first.window.location.hash = participant.getAttribute("href"); first.window.dispatchEvent(new first.window.HashChangeEvent("hashchange")); await tick();
    expect(first.calls.some(call => call.path === "/api/profiles/profile%2F42?month=2025-01")).toBe(true);
    expect(first.document.activeElement.id).toBe("profile-title");
    const profileText = first.document.querySelector("#profile-content").textContent;
    expect(profileText).toContain("Cursor, Claude Code");
    expect(profileText).toContain("GPT-4.1, o3");
    expect(profileText).toContain("self-declared — unverified");
    expect(profileText).not.toContain("attribution");

    const direct = boot({ hash: "#/profiles/profile%2F42", handler }); await tick();
    expect(direct.calls.some(call => call.path === "/api/profiles/profile%2F42")).toBe(true);
    expect(direct.document.querySelector("#profile-content h2")?.textContent).toBe("Ada");
  });

  it("renders repository and PR totals from the profile schema, including zeroes, and uses the leaderboard response month", async () => {
    const handler = (path) => {
      if (path.startsWith("/api/leaderboard")) return json({ month: "2025-02", rows: [{ rank: 1, profileId: "counted", displayName: "Counted", repository: "octo/public", score: 7 }] });
      if (path === "/api/profiles/counted") return json({ id: "counted", month: "2025-02", displayName: "Counted", repositories: [{ repository: "octo/public", pullRequests: 0 }, { repository: "octo/other-public", pullRequests: 7 }], declarations: { status: "self_declared_unverified", tooling: [], models: [] } });
      if (path === "/api/profiles/zero") return json({ id: "zero", month: "2025-02", displayName: "Zero", repositories: [], declarations: { status: "self_declared_unverified", tooling: [], models: [] } });
      return anonymous(path);
    };

    const counted = boot({ hash: "#/profiles/counted", handler }); await tick();
    expect(counted.document.querySelector("#leaderboard-status").textContent).toContain("2025-02");
    expect([...counted.document.querySelectorAll("#profile-content .profile-stats dd")].map(value => value.textContent)).toEqual(["2", "7"]);
    expect([...counted.document.querySelectorAll("#profile-content .profile-stats dt")].map(value => value.textContent)).toEqual(["Published repositories", "Merged pull requests in 2025-02"]);

    const zero = boot({ hash: "#/profiles/zero", handler }); await tick();
    expect([...zero.document.querySelectorAll("#profile-content .profile-stats dd")].map(value => value.textContent)).toEqual(["0", "0"]);
  });

  it("renders leaderboard loading, empty, error, and retry states", async () => {
    let attempt = 0;
    const page = boot({ handler: (path) => {
      if (path.startsWith("/api/leaderboard")) { attempt += 1; return attempt === 1 ? new Response("temporarily unavailable", { status: 503 }) : json({ rows: [] }); }
      return anonymous(path);
    } });
    expect(page.document.querySelector("#leaderboard-status").textContent).toBe("Loading leaderboard…"); await tick();
    expect(page.document.querySelector("#leaderboard-status").textContent).toContain("Rankings could not be loaded");
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

  it("keeps Sync my PRs hidden until participation is active", async () => {
    const page = boot({ handler: (path) => {
      if (path.startsWith("/api/leaderboard")) return json({ rows: [] });
      if (path === "/api/rules") return json({ rules: [] });
      if (path === "/api/session") return json({ authenticated: true, csrfToken: "csrf-1", participating: false });
      if (path === "/api/repos") return json({ repos: [{ id: "repo-1", fullName: "octo/public" }] });
      throw new Error(`Unexpected request ${path}`);
    } }); await tick();
    expect(page.document.querySelector("#withdrawal-panel").hidden).toBe(true);
    expect(page.calls.filter(call => call.path === "/api/sync")).toHaveLength(0);
  });

  it("posts Sync my PRs with CSRF but no authority fields, then refreshes without re-syncing", async () => {
    let finishSync;
    const page = boot({ hash: "#/profiles/p1", handler: (path) => {
      if (path.startsWith("/api/leaderboard")) return json({ rows: [] });
      if (path === "/api/rules") return json({ rules: [] });
      if (path === "/api/session") return json({ authenticated: true, csrfToken: "csrf-1", participating: true });
      if (path === "/api/profiles/p1") return json({ displayName: "Participant", repositories: [], declarations: { status: "self_declared_unverified", tooling: [], models: [] } });
      if (path === "/api/sync") return new Promise(resolve => { finishSync = () => resolve(json({ status: "complete" })); });
      throw new Error(`Unexpected request ${path}`);
    } }); await tick();
    const button = page.document.querySelector("#sync-now"); const message = page.document.querySelector("#sync-message");
    expect(button.textContent).toBe("Sync my PRs");
    expect(page.document.querySelector("#withdrawal-panel").hidden).toBe(false); expect(message.getAttribute("role")).toBe("status");
    button.click(); button.dispatchEvent(new page.window.Event("click")); await tick();
    expect(button.disabled).toBe(true); expect(button.textContent).toBe("Syncing…"); expect(message.textContent).toContain("Syncing your selected public repository");
    const syncCalls = page.calls.filter(call => call.path === "/api/sync"); expect(syncCalls).toHaveLength(1); expect(syncCalls[0].options.method).toBe("POST"); expect(syncCalls[0].options.headers.get("X-CSRF-Token")).toBe("csrf-1"); expect(syncCalls[0].options.body).toBeUndefined();
    finishSync(); await tick();
    expect(button.disabled).toBe(false); expect(button.textContent).toBe("Sync my PRs"); expect(message.textContent).toContain("Sync complete."); expect(message.className).toContain("success");
    expect(page.calls.filter(call => call.path === "/api/sync")).toHaveLength(1); expect(page.calls.filter(call => call.path === "/api/session")).toHaveLength(2); expect(page.calls.filter(call => call.path.startsWith("/api/leaderboard"))).toHaveLength(2); expect(page.calls.filter(call => call.path === "/api/profiles/p1")).toHaveLength(2);
  });

  it("announces no eligible merged PRs, partial results, and a busy sync without automatic retry", async () => {
    let outcome = "no_eligible_prs";
    const page = boot({ handler: (path) => {
      if (path.startsWith("/api/leaderboard")) return json({ rows: [] });
      if (path === "/api/rules") return json({ rules: [] });
      if (path === "/api/session") return json({ authenticated: true, csrfToken: "csrf-1", participating: true });
      if (path === "/api/sync") {
        if (outcome === "busy") return json({ status: "busy" }, 409);
        return json({ status: outcome });
      }
      throw new Error(`Unexpected request ${path}`);
    } }); await tick();
    const button = page.document.querySelector("#sync-now"); const message = page.document.querySelector("#sync-message");
    button.click(); await tick();
    expect(message.textContent).toContain("Sync finished. No eligible merged pull requests were found for your selected public repository."); expect(message.className).not.toContain("success"); expect(page.calls.filter(call => call.path === "/api/sync")).toHaveLength(1);
    outcome = "partial"; button.click(); await tick();
    expect(message.textContent).toContain("Sync finished with partial results."); expect(page.calls.filter(call => call.path === "/api/sync")).toHaveLength(2);
    outcome = "busy"; button.click(); await tick();
    expect(message.textContent).toContain("Wait a moment, then use Sync my PRs again."); expect(message.className).toContain("error"); expect(button.disabled).toBe(false); expect(page.calls.filter(call => call.path === "/api/sync")).toHaveLength(3);
  });
});
