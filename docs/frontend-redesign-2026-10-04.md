# Frontend redesign — 2026-10-04

## Direction and scope

The chosen direction is a **league arena**: dark navy surfaces, restrained cyan actions, violet typographic accents, and gold/silver/bronze rank treatment. System sans and monospace fonts require no remote assets or dependencies. Compared with a terminal-only board or a uniform dashboard-card grid, the arena emphasizes the real product mechanism: merged PRs competing within a UTC month. The deliberate tradeoff is a desktop podium whose spatial order is silver / gold / bronze, while DOM, keyboard, and mobile order remain first / second / third.

Frontend-owned paths:

- `src/frontend/index.html` — arena composition, complete-ranking region, UTC selector, participation steps, active sync control room, separated withdrawal, stable profile heading and return navigation.
- `src/frontend/app.js` — API-backed podium, coordinated loading/error transitions, profile focus, explicit sync outcomes and safe recovery copy.
- `src/frontend/styles.css` — shared dark visual system, podium placement, content wrapping, focus and responsive rules.
- `test/frontend.behavior.test.js` — focused DOM/contract regressions.

Backend and backend tests are concurrently owned by another implementer. No shared configuration, dependency, API success contract, auth authority, or deployment configuration was changed by this frontend work. The existing untracked `docs/deployment-smoke-2026-09-21.md` is preserved. No commit, push, or deployment was performed.

## Data and behavior invariants

- Podium uses `rows.slice(0, 3)` from the same accepted `/api/leaderboard` response as the full table. Every returned row, including podium participants, remains in the complete ranking. No client sorting, score recomputation, fixture participants, or filler medal slots.
- `score` is displayed as merged PRs because the current worker counts eligible pull requests once per opted-in author and merged-at UTC month. Repository/profile aggregates are not substituted for leaderboard scores.
- Response month drives status and encoded profile links. Current month initialization uses ISO UTC. Request sequence guards apply to both ranking surfaces, clearing old data while a new month loads and rejecting stale responses.
- Zero participants has an actionable empty message; one/two participants show only actual cards; three or more show exactly the first three cards plus every API row. “Complete” means all returned rows; the existing API limit of 100 is unchanged.
- Connect → repository review → explicit consent → manual sync remains server-backed. Mutation methods, same-origin credentials, CSRF headers, consent requirements and withdrawal behavior are retained.
- A manual sync performs one guarded POST with no body or authority fields. In-flight controls are disabled and announced; there are no automatic sync retries. Completion refreshes session, leaderboard and an open profile using bounded GET requests.
- Complete, partial, no eligible PRs, busy, lost access/consent, authorization, rate-limit, unavailable and unrecognized results have distinct actionable copy. Unknown success payloads are not presented as confirmed completion. Only a bounded opaque support correlation ID may appear from an unavailable diagnostic; upstream messages and stage/category internals are not echoed.

## Accessibility and responsive review

Native month input, links, buttons, consent checkbox and fieldset remain keyboard reachable. Ranking table retains caption and column scopes inside a named focusable horizontal-scroll region. Status messages use polite live regions; busy state is exposed. Profile navigation focuses a stable heading; refreshes do not steal focus. Long names and repositories wrap, card/grid children permit shrinking, and horizontal overflow is isolated to the ranking table. At 760px and below the podium and workflow columns stack in API order; narrow-screen table scrolling is intentional rather than hiding repository or score information.

Palette regression checks cover primary/muted/accent/medal/status text and primary-button default/hover pairs at WCAG AA text contrast (at least 4.5:1). This is token-level evidence, not a rendered accessibility audit. Visible focus and reduced-motion rules are retained. No animation or fake live telemetry was added.

## Verification and limitations

Repository commands and final results:

- `npm test -- test/frontend.behavior.test.js` — 25/25 passed.
- `npm run check` — passed (`tsc --noEmit`).
- `node --check src/frontend/app.js` — passed.
- `npm test` — 74/74 passed across four test files on the concurrently integrated candidate (25 frontend, 16 security, 13 GitHub sync, 20 worker integration). Expected sanitized failure diagnostics appeared on stderr in backend error-path tests.
- `git diff --check` — passed.

The TypeScript command checks repository TypeScript only; the existing tsconfig excludes frontend JavaScript. Frontend syntax and behavior are checked separately. happy-dom tests establish DOM/state/contract evidence, not visual rendering. Browser inspection returned `execution_denied`, so there is no screenshot or rendered desktop/mobile proof. The independent `review_changes` tool was unavailable for this worktree and the fallback read-only helper timed out; a local source/diff completeness pass was performed instead. The integration owner should retain independent QA review of the combined candidate.

## USER_VISUAL_CHECK

1. At desktop width, confirm first place is prominent and centered between silver and bronze, and every returned participant still appears in the complete ranking.
2. At 320–390px and 760px widths, confirm the podium reads first/second/third, long names wrap, workflow cards do not overflow, and only the ranking table scrolls horizontally.
3. Tab through month selection, podium links, complete ranking, profile return navigation, connect/consent and sync/withdrawal. Verify visible focus, heading arrival on profile navigation, and default/hover contrast.
4. Switch UTC months and check response-month profile links; check empty, loading, failure/retry and one/two/three-plus participant states using real authorized data or development-only test mocks—not production fixtures.
5. For an opted-in test account, check pending/complete/partial/no eligible/busy/error sync feedback. One click must produce one POST; recovery is manual. Verify consent withdrawal still removes public participation.
