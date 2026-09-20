(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const state = { csrfToken: null, session: null, request: 0 };
  const monthInput = $("#month-picker");
  const leaderboardBody = $("#leaderboard-body");
  const leaderboardStatus = $("#leaderboard-status");
  const rulesStatus = $("#rules-status");
  const sessionStatus = $("#session-status");
  const form = $("#participation-form");
  const repoSelect = $("#repo-select");

  function currentMonth() { return new Date().toISOString().slice(0, 7); }
  function asObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  function asText(value, fallback = "—") { return typeof value === "string" || typeof value === "number" ? String(value) : fallback; }
  function setMessage(element, text, type = "") { element.textContent = text; element.className = `${element.className.replace(/\b(error|success)\b/g, "").trim()} ${type}`.trim(); }
  function setButtonBusy(button, busy, text) { button.disabled = busy; if (text) button.textContent = text; }
  function displayError(error) { return error instanceof Error && error.message ? error.message : "The request could not be completed."; }

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body) headers.set("Content-Type", "application/json");
    if (options.method && options.method !== "GET" && state.csrfToken) headers.set("X-CSRF-Token", state.csrfToken);
    const response = await fetch(path, { credentials: "same-origin", ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
    if (!response.ok) throw new Error(asText(asObject(data).message || asObject(data).error, `Request failed (${response.status}).`));
    return data;
  }

  function row(data, cells, className = "") { const tr = document.createElement("tr"); if (className) tr.className = className; cells.forEach((value) => { const td = document.createElement("td"); td.textContent = value; tr.append(td); }); data.append(tr); }
  function itemList(value) { return Array.isArray(value) ? value : []; }
  function leaderboardRows(payload) { const source = asObject(payload); return Array.isArray(payload) ? payload : itemList(source.rows || source.entries || source.leaderboard); }

  async function loadLeaderboard() {
    const requestId = ++state.request;
    leaderboardBody.replaceChildren(); setMessage(leaderboardStatus, "Loading leaderboard…"); $("#leaderboard-retry").hidden = true;
    try {
      const payload = await request(`/api/leaderboard?month=${encodeURIComponent(monthInput.value)}`);
      if (requestId !== state.request) return;
      const rows = leaderboardRows(payload);
      if (!rows.length) {
        row(leaderboardBody, ["", "No opted-in participants yet for this month.", "", ""]);
        setMessage(leaderboardStatus, "No opted-in participants are published for this month.");
        return;
      }
      rows.forEach((item, index) => { const entry = asObject(item); row(leaderboardBody, [asText(entry.rank, String(index + 1)), asText(entry.displayName || entry.name || entry.participant || entry.user), asText(entry.repository || entry.repo || entry.repositoryName), asText(entry.score || entry.points || entry.total)], "leaderboard-entry"); });
      setMessage(leaderboardStatus, `${rows.length} opted-in participant${rows.length === 1 ? "" : "s"} published for ${monthInput.value}.`);
    } catch (error) {
      if (requestId !== state.request) return;
      row(leaderboardBody, ["", "Leaderboard unavailable.", "", ""]);
      setMessage(leaderboardStatus, displayError(error), "error"); $("#leaderboard-retry").hidden = false;
    }
  }

  async function loadRules() {
    const content = $("#rules-content"); content.replaceChildren(); setMessage(rulesStatus, "Loading rules…"); $("#rules-retry").hidden = true;
    try {
      const payload = await request("/api/rules"); const source = asObject(payload); const rules = Array.isArray(payload) ? payload : itemList(source.rules || source.items);
      if (rules.length) { const list = document.createElement("ul"); rules.forEach((rule) => { const item = document.createElement("li"); item.textContent = asText(asObject(rule).text || asObject(rule).description || rule); list.append(item); }); content.append(list); }
      else if (source.content || source.text || source.description) { const paragraph = document.createElement("p"); paragraph.textContent = asText(source.content || source.text || source.description); content.append(paragraph); }
      else { const paragraph = document.createElement("p"); paragraph.textContent = "Rules are currently unavailable."; content.append(paragraph); }
      setMessage(rulesStatus, "");
    } catch (error) { setMessage(rulesStatus, displayError(error), "error"); $("#rules-retry").hidden = false; }
  }

  function sessionIsAuthenticated(session) { return session.authenticated === true || Boolean(session.user || session.githubUser); }
  function participating(session) { return session.participating === true || session.hasConsent === true || Boolean(session.consent && session.consent.active !== false); }
  function connectionUrl(session) { return session.connectUrl || session.authorizationUrl || session.githubAuthUrl || session.loginUrl; }
  function showConnect(session) { const area = $("#connect-action"); area.replaceChildren(); const url = connectionUrl(session); if (typeof url === "string" && (/^https:\/\//i.test(url) || url.startsWith("/"))) { const link = document.createElement("a"); link.className = "button button-primary"; link.href = url; link.textContent = "Connect GitHub"; area.append(link); } else { const note = document.createElement("p"); note.className = "field-help"; note.textContent = "Connect GitHub through the sign-in route provided by this service."; area.append(note); } }

  async function loadRepos() {
    repoSelect.replaceChildren(new Option("Choose a repository", "")); repoSelect.disabled = true;
    try {
      const payload = await request("/api/repos"); const source = asObject(payload); const repos = Array.isArray(payload) ? payload : itemList(source.repos || source.repositories);
      repos.forEach((repo) => { const item = asObject(repo); const id = asText(item.id || item.repoId, ""); if (!id) return; repoSelect.add(new Option(asText(item.fullName || item.name || item.repository, id), id)); });
      repoSelect.disabled = repos.length === 0;
      if (!repos.length) setMessage($("#form-message"), "No eligible public repositories are available for this session.", "error");
    } catch (error) { setMessage($("#form-message"), displayError(error), "error"); }
  }

  async function loadSession() {
    form.hidden = true; $("#withdrawal-panel").hidden = true; $("#connect-action").replaceChildren(); setMessage(sessionStatus, "Checking session…");
    try {
      const payload = asObject(await request("/api/session")); state.session = payload; state.csrfToken = asText(payload.csrfToken || payload.csrf, "") || null;
      if (!sessionIsAuthenticated(payload)) { setMessage(sessionStatus, "Connect GitHub to review repositories and choose whether to participate."); showConnect(payload); return; }
      if (!state.csrfToken) { setMessage(sessionStatus, "Your session cannot make participation changes right now. Refresh and try again.", "error"); return; }
      if (participating(payload)) { setMessage(sessionStatus, "Your session is connected."); $("#withdrawal-panel").hidden = false; return; }
      setMessage(sessionStatus, "Your session is connected. Choose a repository and confirm consent to participate."); form.hidden = false; await loadRepos();
    } catch (error) { setMessage(sessionStatus, displayError(error), "error"); }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault(); const message = $("#form-message"); const submit = $("#participation-submit");
    if (!repoSelect.value) { setMessage(message, "Choose a repository before confirming participation.", "error"); repoSelect.focus(); return; }
    if (!$("#consent-checkbox").checked) { setMessage(message, "Consent is required before participation can be confirmed.", "error"); $("#consent-checkbox").focus(); return; }
    if (!state.csrfToken) { setMessage(message, "Your session cannot make participation changes right now. Refresh and try again.", "error"); return; }
    setButtonBusy(submit, true, "Confirming…"); setMessage(message, "");
    try { await request("/api/selections", { method:"POST", body:JSON.stringify({ repoId:repoSelect.value, declaredTooling:$("#declared-tooling").value.trim() || undefined, declaredModel:$("#declared-model").value.trim() || undefined, consent:true }) }); await Promise.all([loadSession(), loadLeaderboard()]); setMessage(sessionStatus, "Participation confirmed. Your session is connected.", "success"); }
    catch (error) { setMessage(message, displayError(error), "error"); } finally { setButtonBusy(submit, false, "Confirm participation"); }
  });

  $("#withdraw-consent").addEventListener("click", async () => { const button = $("#withdraw-consent"); const message = $("#withdrawal-message"); if (!state.csrfToken) { setMessage(message, "Your session cannot withdraw consent right now. Refresh and try again.", "error"); return; } setButtonBusy(button, true, "Withdrawing…"); setMessage(message, ""); try { await request("/api/consent", { method:"DELETE" }); await Promise.all([loadSession(), loadLeaderboard()]); setMessage(sessionStatus, "Consent withdrawn. You can choose a repository and opt in again.", "success"); } catch (error) { setMessage(message, displayError(error), "error"); } finally { setButtonBusy(button, false, "Withdraw consent"); } });
  monthInput.value = currentMonth(); monthInput.addEventListener("change", loadLeaderboard); $("#leaderboard-retry").addEventListener("click", loadLeaderboard); $("#rules-retry").addEventListener("click", loadRules);
  loadLeaderboard(); loadRules(); loadSession();
})();
