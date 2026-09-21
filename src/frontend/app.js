(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const requestFetch = window.fetch.bind(window);
  const state = { csrfToken: null, session: null, leaderboardRequest: 0, sessionRequest: 0, profileRequest: 0 };
  const monthInput = $("#month-picker");
  const leaderboardBody = $("#leaderboard-body");
  const leaderboardStatus = $("#leaderboard-status");
  const rulesStatus = $("#rules-status");
  const sessionStatus = $("#session-status");
  const form = $("#participation-form");
  const repoSelect = $("#repo-select");
  const profileSection = $("#profile");
  const profileContent = $("#profile-content");
  const profileStatus = $("#profile-status");

  function currentMonth() { return new Date().toISOString().slice(0, 7); }
  function asObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  function asText(value, fallback = "—") { return typeof value === "string" || typeof value === "number" ? String(value) : fallback; }
  function setMessage(element, text, type = "") { element.textContent = text; element.className = `${element.className.replace(/\b(error|success)\b/g, "").trim()} ${type}`.trim(); }
  function setButtonBusy(button, busy, text) { button.disabled = busy; if (text) button.textContent = text; }
  function displayError(error) { return error instanceof Error && error.message ? error.message : "The request could not be completed."; }

  function isUtcMonth(value) { return /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value); }
  function profilePath(profileId, month) { const query = isUtcMonth(month) ? `?month=${encodeURIComponent(month)}` : ""; return `#/profiles/${encodeURIComponent(profileId)}${query}`; }
  function profileRouteFromHash() { const match = /^#\/profiles\/([^/?#]+)(?:\?([^#]*))?$/.exec(window.location.hash); if (!match) return null; const params = new URLSearchParams(match[2] || ""); const month = params.get("month"); return { id: decodeURIComponent(match[1]), month: isUtcMonth(month || "") ? month : null }; }
  function profileIdFromHash() { return profileRouteFromHash()?.id || null; }
  function repoOption(label, value) { const option = document.createElement("option"); option.textContent = label; option.value = value; return option; }
  function handleUnauthorized() { ++state.sessionRequest; state.csrfToken = null; state.session = null; form.hidden = true; $("#withdrawal-panel").hidden = true; repoSelect.disabled = true; repoSelect.replaceChildren(repoOption("Choose a repository", "")); setMessage(sessionStatus, "Your session expired. Reconnect GitHub to continue.", "error"); showConnect({ connectUrl: "/api/auth/github" }); }

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body) headers.set("Content-Type", "application/json");
    if (options.method && options.method !== "GET" && state.csrfToken) headers.set("X-CSRF-Token", state.csrfToken);
    const response = await requestFetch(path, { credentials: "same-origin", ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
    if (!response.ok) { if (response.status === 401) handleUnauthorized(); const error = new Error(asText(asObject(data).message || asObject(data).error, `Request failed (${response.status}).`)); error.status = response.status; throw error; }
    return data;
  }

  function row(data, cells, className = "", profileId = null, month = null) { const tr = document.createElement("tr"); if (className) tr.className = className; cells.forEach((value, index) => { const td = document.createElement("td"); if (index === 1 && profileId) { const link = document.createElement("a"); link.href = profilePath(profileId, month); link.textContent = value; td.append(link); } else td.textContent = value; tr.append(td); }); data.append(tr); }
  function itemList(value) { return Array.isArray(value) ? value : []; }
  function leaderboardRows(payload) { const source = asObject(payload); return Array.isArray(payload) ? payload : itemList(source.rows || source.entries || source.leaderboard); }

  async function loadLeaderboard() {
    const requestId = ++state.leaderboardRequest;
    leaderboardBody.replaceChildren(); setMessage(leaderboardStatus, "Loading leaderboard…"); $("#leaderboard-retry").hidden = true;
    try {
      const payload = await request(`/api/leaderboard?month=${encodeURIComponent(monthInput.value)}`);
      if (requestId !== state.leaderboardRequest) return;
      const rows = leaderboardRows(payload);
      const returnedMonth = asText(asObject(payload).month, monthInput.value);
      if (!rows.length) {
        row(leaderboardBody, ["", "No opted-in participants yet for this month.", "", ""]);
        setMessage(leaderboardStatus, `No opted-in participants are published for ${returnedMonth}.`);
        return;
      }
      rows.forEach((item, index) => { const entry = asObject(item); row(leaderboardBody, [asText(entry.rank, String(index + 1)), asText(entry.displayName), asText(entry.repository), asText(entry.score)], "leaderboard-entry", typeof entry.profileId === "string" ? entry.profileId : null, returnedMonth); });
      setMessage(leaderboardStatus, `${rows.length} opted-in participant${rows.length === 1 ? "" : "s"} published for ${returnedMonth}.`);
    } catch (error) {
      if (requestId !== state.leaderboardRequest) return;
      row(leaderboardBody, ["", "Leaderboard unavailable.", "", ""]);
      setMessage(leaderboardStatus, displayError(error), "error"); $("#leaderboard-retry").hidden = false;
    }
  }

  function declaredDetails(label, values) { const declarations = itemList(values).filter(value => typeof value === "string" && value.trim()); if (!declarations.length) return null; const item = document.createElement("p"); const strong = document.createElement("strong"); const qualifier = document.createElement("span"); strong.textContent = `${label}: `; qualifier.className = "unverified"; qualifier.textContent = "self-declared — unverified"; item.append(strong, declarations.join(", "), " ", qualifier); return item; }
  function profileSummary(repositories, month) { const stats = document.createElement("dl"); stats.className = "profile-stats"; const pullRequestCount = repositories.reduce((total, repository) => { const count = asObject(repository).pullRequests; return typeof count === "number" && Number.isFinite(count) ? total + count : total; }, 0); [["Published repositories", repositories.length], [`Merged pull requests${isUtcMonth(month) ? ` in ${month}` : ""}`, pullRequestCount]].forEach(([label, value]) => { const item = document.createElement("div"); const term = document.createElement("dt"); const definition = document.createElement("dd"); term.textContent = label; definition.textContent = String(value); item.append(term, definition); stats.append(item); }); return stats; }
  async function loadProfile(route) { const { id: profileId, month } = route; const requestId = ++state.profileRequest; profileSection.hidden = false; profileContent.replaceChildren(); setMessage(profileStatus, "Loading public profile…"); $("#profile-retry").hidden = true; const query = month ? `?month=${encodeURIComponent(month)}` : ""; try { const payload = asObject(await request(`/api/profiles/${encodeURIComponent(profileId)}${query}`)); if (requestId !== state.profileRequest || profileId !== profileIdFromHash()) return; const profile = asObject(payload.profile || payload); const responseMonth = asText(profile.month, ""); const repositories = itemList(profile.repositories); const declarations = asObject(profile.declarations); const heading = document.createElement("h2"); heading.id = "profile-title"; heading.textContent = asText(profile.displayName, "Participant"); const copy = document.createElement("p"); copy.textContent = "This public profile shows only the participant's published, self-declared details."; profileContent.append(heading, copy, profileSummary(repositories, responseMonth)); const tooling = declarations.status === "self_declared_unverified" ? declaredDetails("Tooling", declarations.tooling) : null; const models = declarations.status === "self_declared_unverified" ? declaredDetails("Models", declarations.models) : null; if (tooling) profileContent.append(tooling); if (models) profileContent.append(models); if (!tooling && !models) { const empty = document.createElement("p"); empty.textContent = "No self-declared tooling or model details were provided."; profileContent.append(empty); } setMessage(profileStatus, ""); } catch (error) { if (requestId !== state.profileRequest) return; setMessage(profileStatus, displayError(error), "error"); $("#profile-retry").hidden = false; } }
  function route() { const profileRoute = profileRouteFromHash(); if (!profileRoute) { ++state.profileRequest; profileSection.hidden = true; return; } loadProfile(profileRoute); }

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

  async function loadRepos(sessionRequest = state.sessionRequest) {
    repoSelect.replaceChildren(repoOption("Choose a repository", "")); repoSelect.disabled = true;
    try {
      const payload = await request("/api/repos"); if (sessionRequest !== state.sessionRequest) return; const source = asObject(payload); const repos = Array.isArray(payload) ? payload : itemList(source.repos || source.repositories);
      repos.forEach((repo) => { const item = asObject(repo); const id = asText(item.id, ""); if (!id) return; repoSelect.append(repoOption(asText(item.fullName, id), id)); });
      repoSelect.disabled = repos.length === 0;
      if (!repos.length) setMessage($("#form-message"), "No eligible public repositories are available for this session.", "error");
    } catch (error) { if (sessionRequest === state.sessionRequest) setMessage($("#form-message"), displayError(error), "error"); }
  }

  async function loadSession() {
    const requestId = ++state.sessionRequest;
    form.hidden = true; $("#withdrawal-panel").hidden = true; $("#connect-action").replaceChildren(); setMessage(sessionStatus, "Checking session…");
    try {
      const payload = asObject(await request("/api/session")); if (requestId !== state.sessionRequest) return; state.session = payload; state.csrfToken = asText(payload.csrfToken || payload.csrf, "") || null;
      if (!sessionIsAuthenticated(payload)) { setMessage(sessionStatus, "Connect GitHub to review repositories and choose whether to participate."); showConnect(payload); return; }
      if (!state.csrfToken) { setMessage(sessionStatus, "Your session cannot make participation changes right now. Refresh and try again.", "error"); return; }
      if (participating(payload)) { setMessage(sessionStatus, "Your session is connected."); $("#withdrawal-panel").hidden = false; return; }
      setMessage(sessionStatus, "Your session is connected. Choose a repository and confirm consent to participate."); form.hidden = false; await loadRepos(requestId);
    } catch (error) { if (requestId === state.sessionRequest) setMessage(sessionStatus, displayError(error), "error"); }
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
  monthInput.value = currentMonth(); monthInput.addEventListener("change", loadLeaderboard); $("#leaderboard-retry").addEventListener("click", loadLeaderboard); $("#rules-retry").addEventListener("click", loadRules); $("#profile-retry").addEventListener("click", route); window.addEventListener("hashchange", route);
  loadLeaderboard(); loadRules(); loadSession(); route();
})();
