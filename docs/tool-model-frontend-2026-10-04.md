# Tool / model frontend evidence — 2026-10-04

## Outcome and ownership

Implemented on the shared `feat/public-opt-in-leaderboard` candidate, based on `77f33046d703f41727f84b564adb58b42397591f`. No commit, push or deployment. Changes owned here: `src/frontend/app.js`, `src/frontend/index.html`, `src/frontend/styles.css`, `test/frontend.behavior.test.js`, and this document. Existing untracked evidence and concurrent backend changes were preserved.

The existing dark league arena remains the visual direction: rank and score stay dominant; a divided, wrapping definition list presents current configuration beneath each podium score. The complete ranking has distinct Tool and Model columns.

## Implemented journey

- Optional editable tooling combobox inside “Select an eligible public repository”; initially empty, never assigns a tool or model automatically.
- Suggestions: Codex, Claude Code, Antigravity, Nimrava, OpenClaw, Hermes, Pi, OpenCode; additional recognized suggestions Cursor, GitHub Copilot, Aider, Cline, Roo Code, and Devin Desktop (formerly Windsurf). These are suggestions, not a quantitative popularity ranking or endorsement.
- Filtering, ArrowDown/ArrowUp, Enter, Escape, Tab, pointer selection, associated label/help, listbox/options, selected state, active descendant and expanded state. Enter within the popup does not submit consent. IME composition is not intercepted.
- Other/custom keeps typed text; Not informed clears tooling only. Model remains an independent free-text declaration. Existing submit contract, length limit and whitespace trim remain unchanged. Legacy free strings such as Windsurf are not rewritten to a newer suggestion name.
- Both ranking surfaces consume only `row.declarations` with `status: self_declared_unverified`, `tooling: string[]`, `models: string[]`. Missing/empty lists display Not informed independently. Nonempty legacy/custom strings render as text, never HTML.
- Visible qualifier: self-declared current configuration, unverified by PR, not attributed to the selected month or individual contributions. No per-PR inference or historical/monthly attribution.
- Long names wrap in table cells and podium definitions; podium collapses to one column under 760px. The six-column table has a 52rem minimum and a keyboard-focusable horizontal scroll region; the popup has bounded vertical scrolling and minimum 2.8rem option targets.

## Official source evidence

Read-only official documentation fetched during this task:

- Cursor: https://cursor.com/docs
- GitHub Copilot: https://docs.github.com/en/copilot
- Aider: https://aider.chat/docs/
- Cline: https://docs.cline.bot/ (redirects to `/cline-overview`)
- Roo Code: official repository https://github.com/RooCodeInc/Roo-Code remains the product reference. Documentation fetched at https://docs.roocode.com/ redirects to https://roocodeinc.github.io/Roo-Code/ and reports extension shutdown on May 15; retained here as a recognized self-declaration, not a recommendation or claim of current availability. Source caveat: CTO reports `roocode.com` now redirects to `roomote.dev`, a different cloud product; neither that redirect nor Roomote is substituted for Roo Code.
- Devin Desktop nomenclature: https://docs.devin.ai/desktop/devin-desktop-faq explicitly identifies Devin Desktop as the new name for Windsurf. CTO additionally corroborated https://windsurf.com/ redirecting to https://devin.ai/desktop and the official announcement https://devin.ai/blog/windsurf-is-now-devin-desktop. The suggestion labels the former name for discoverability and submits `Devin Desktop`; manually typed/stored `Windsurf` stays intact. Devin Local is not substituted for the desktop product.

The eight mandatory suggestions are task-specified. No popularity measurement was made.

## Validation and real diff evidence

- `npm test -- test/frontend.behavior.test.js`: **31/31 passed** after updating the existing four-header assertion for the six-column contract.
- `npm run check`: **passed**, `tsc --noEmit`.
- `git diff --check`: **passed**.
- Actual scoped diff before this new document: app.js +52/-4, index.html +8/-3, styles.css +10/-1, frontend.behavior.test.js +47/-2.
- New tests cover the complete option set, optional empty initial state, filtering, arrows/Enter/Escape/Tab, custom and Not informed behavior, independent model, recognized/legacy/custom/empty POST payloads and a fresh API-backed page boot, safe multiple/HTML-like/long declarations, missing fallbacks, qualifiers and responsive CSS rules. Existing stale-month, failure/retry, profile and sync behavior tests remain passing.
- `review_changes` was unavailable because its Git pin cannot inspect this shared worktree. A separate read-only reviewer inspected the absolute-path candidate files and reported **no MUST gaps**. That reviewer could not independently run Git/tests due to its sandbox command limit; these commands were run by the implementation agent above.

Persistence evidence is explicitly frontend/API-contract evidence: mocked POST saves declarations, then a fresh page requests and renders them. Database persistence is backend-owner evidence. The session response does not provide a saved-declaration editing/hydration contract; active participants keep the existing control-room journey. Unsaved draft retention across refresh is not introduced, and no local storage is treated as public truth.

## USER_VISUAL_CHECK

Not browser-render verified; Happy DOM and CSS checks are not screenshots or assistive-technology certification. Optional human checks, not a completion gate:

1. Desktop: connect, focus Tooling, type `Claude`, arrow/select, reopen, Escape and Tab; verify popup focus/selection announcement with a screen reader and pointer selection without premature dismissal.
2. Type a custom/legacy tool plus an unrelated model; consent and refresh. Verify both values in ranking and top three, with current/unverified qualifier. Leave tooling empty and confirm Not informed while the model remains.
3. At 320–390px width and 200% zoom: verify long custom names wrap in podium cards without clipping, popup options remain reachable, and complete ranking scrolls horizontally without pushing the whole page sideways.

Sync diagnostic artifacts were not modified and do not gate this work. No additional dependency, framework, generated asset or production action was introduced.
