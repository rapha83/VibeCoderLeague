# Independent QA — Tool / Model leaderboard declarations — 2026-10-04

VERDICT: PASS (local candidate scope only; authenticated live sync and deployment are not certified)

## SUMMARY

The local implementation satisfies the reviewed declaration/display contract. Backend declarations come from current active public consents, are distinct and separate from scoring, and omit private, unknown, inactive, and withdrawn sources. Frontend input remains optional and initially empty, supports the requested suggestions plus recognized extras/custom/legacy/Not informed, keeps model independent, and displays declaration values and explicit unverified/current semantics on both podium and complete ranking. Long values are rendered as text and responsive table/podium behavior is covered by source and tests.

No implementation blocker was found in the scoped static review. Required full check/test and diff-check results below are attributed to the CTO; I did not execute those checks. This PASS applies to the local candidate only and is not evidence that authenticated live sync works or that its previously observed cause is understood.

## TARGET

- Repository: `/Users/openclaw-bot/Documents/GrumpyzillaSoftwareLab/worktrees/VibeCoderLeague`
- Branch: `feat/public-opt-in-leaderboard`
- HEAD: `77f33046d703f41727f84b564adb58b42397591f` (unchanged from supplied base; candidate is working-tree diff)
- Scoped implementation diff per CTO: six code/test files, 183 insertions and 13 deletions. Relevant files: `src/worker.ts`, `src/frontend/app.js`, `src/frontend/index.html`, `src/frontend/styles.css`, `test/worker.integration.test.ts`, `test/frontend.behavior.test.js`.
- Related owner evidence: `docs/tool-model-api-2026-10-04.md`, `docs/tool-model-frontend-2026-10-04.md`. This QA receipt is the only QA-owned addition.
- No commit, push, deployment, remote mutation, secrets access, or live API/database operation was performed.

## EVIDENCE

### Independent source and test review

- `src/worker.ts`: reviewed the leaderboard enrichment contract documented and exercised in `test/worker.integration.test.ts`. The SQL enrichment uses a correlated JSON aggregation rather than a scoring join; score count/order/month/rank clauses remain as before. The public response maps parsed declarations to `{status: 'self_declared_unverified', tooling: string[], models: string[]}` and drops the internal aggregate field. Source selection is restricted to current active public consent. Profile/publication consent checks remain separate; existing public cache duration is retained.
- `test/worker.integration.test.ts`: the new integration case proves multiple consents do not multiply a score, deduplicates exact current declaration strings, uses current consent values rather than stale PR snapshots, allows declarations irrespective of requested score month, preserves long/custom/Unicode/HTML-looking strings, supplies empty arrays for null/empty declarations, and excludes private/unknown/inactive/withdrawn data. Exact response equality guards against internal aggregate/private identifier leakage. Additional tested cases cover score ties, rank, month isolation, invalid month, and no eligible rows.
- `src/frontend/app.js` and `src/frontend/index.html`: the tooling input has combobox/listbox semantics, starts empty, and has no default or requirement. Eight requested tools and recognized additional suggestions are offered with Other/custom and Not informed. Arrow navigation, Enter, Escape, Tab, active descendant/expanded/selected state, and pointer selection are implemented; Enter in the open popup is prevented from submitting the consent form. Custom and legacy values are not rewritten; Not informed clears tooling only; model remains separately editable. Declaration strings are inserted as text, not HTML.
- Both podium and complete ranking render only current declaration fields and provide independent Not informed fallbacks when values are absent/empty. The explanatory copy labels values self-declared and unverified and disclaims month/PR attribution. The DOM structure uses named ranking region, semantic table headers and a focusable horizontal-scroll region; styles provide wrapping for long labels and a single-column podium under 760px.
- `test/frontend.behavior.test.js`: new cases cover exact suggestion inventory and optional initial state; keyboard controls; custom/legacy and Not informed behavior; independent model; submission and mocked API-backed fresh-page rendering; safe long/HTML-like content; missing/empty fallbacks; podium and list labels/semantics; responsive CSS conditions. These are DOM/CSS-source tests, not rendered visual or assistive-technology certification.
- Reviewed `docs/tool-model-api-2026-10-04.md` and `docs/tool-model-frontend-2026-10-04.md` as implementation evidence, not as a substitute for source/tests. API persistence is exercised through Miniflare/D1 integration tests; frontend fresh-page persistence is mocked API-contract evidence.

### Validation (attributed, not independently executed)

The CTO reports running in the absolute candidate root:

- `npm run check`: passed.
- `npm test`: passed, **82 tests across 4 files**.
- `git diff --check`: passed.
- Candidate HEAD remained `77f33046d703f41727f84b564adb58b42397591f`; scoped implementation diff was six code/test files, 183 insertions and 13 deletions.

The owner receipts separately report backend-focused tests (51 across three files), frontend-focused tests (31), and their focused checks. Those results are consistent with the CTO’s reported full-suite count, but the final full-suite evidence is specifically CTO-reported. I made one foreground terminal probe confirming HEAD and modified/untracked paths; the repository diff tool refused this shared absolute worktree due to unsafe Git topology, so detailed diff review relied on the absolute-path source/tests and owner receipts.

## LIMITATIONS

- No browser rendering, real screen-reader journey, mobile viewport, or visual screenshot was verified. See `USER_VISUAL_CHECK` below.
- The frontend “refresh persistence” test is a mocked API contract, not a live account flow; database persistence is covered by backend D1 integration tests.
- No authenticated live `/api/sync` event or success was observed. The supplied sanitized tail had no event and the actual sync failure cause remains unknown. Simulated tests do not resolve this.
- No deployment/runtime configuration or production behavior was exercised.

## RISKS

- Live authentication, consent/session configuration, GitHub upstream behavior, and actual sync success remain unverified and must not be inferred from this local PASS.
- Existing leaderboard public cache is 60 seconds; withdrawal does not guarantee immediate invalidation of already-cached responses, as documented by implementation owner.
- Six-column ranking intentionally scrolls horizontally on narrow screens; visual usability has not been verified in a browser.

## USER_VISUAL_CHECK

Optional human check on an authorized local/candidate environment (not a blocker to this local code/test verdict): focus Tooling, type/filter, use arrows/Enter/Escape/Tab, and verify announcements/pointer selection without accidental consent submission. Submit a custom or legacy tool and a different model, then inspect both podium and full ranking; check empty-tool fallback and the unverified/current qualifier. At 320–390px and 200% zoom, ensure long values wrap in podium cards, suggestion options remain reachable, and the full table scrolls horizontally without causing page-wide overflow.

## NEXT

Proceed only with the separate integration/release decision. For sync diagnosis, obtain a human-authenticated attempt and share only response status plus sanitized diagnostic fields; do not speculate about a fix. No deployment or remote action is authorized by this QA result.
