# Independent QA — direct demand — 2026-10-04

VERDICT: PASS (local candidate only; not production/release certification)

## SUMMARY

The combined local implementation passes full automated tests, TypeScript, frontend JavaScript syntax, diff whitespace checks, and Wrangler local bundle dry-run. Review supports the requested safeguards: sync failures stay failures (not zero/success), GraphQL and malformed responses fail closed before retraction/persistence, repeat sync is deduplicated, consent withdrawal removes public contributions, frontend top-three and complete list share server order/data, and diagnostics are allowlisted. No in-scope code defect was found in the reviewed diff. This is not evidence about the live authenticated failure or a deployed artifact.

## TARGET

- Repository: `/Users/openclaw-bot/Documents/GrumpyzillaSoftwareLab/worktrees/VibeCoderLeague`
- Branch: `feat/public-opt-in-leaderboard`
- Exact candidate HEAD: `fcd8fb00fb78e61d53af1c8a06c6974537d89617` (working-tree changes are uncommitted; reviewed delta is base-to-working-tree)
- Supplied live deployment metadata: newest deployment `f654f386-8d29-4c8d-adb1-9cde6c7545bd`; candidate remains undeployed.
- Scope reviewed: `src/github.ts`, `src/worker.ts`, `src/frontend/app.js`, `src/frontend/index.html`, `src/frontend/styles.css`, and their changed tests; docs `sync-diagnosis-2026-10-04.md`, `frontend-redesign-2026-10-04.md`. Preserved pre-existing untracked `docs/deployment-smoke-2026-09-21.md` untouched. Only this receipt was added by QA.

## EVIDENCE

- `npm test -- --testTimeout=15000`: **4 files, 75/75 tests passed** (13 GitHub sync, 16 security contract, 25 frontend behavior, 21 worker integration). Initial default-timeout run got 74/75 with a single 5-second timeout in the OAuth unusable-encryption test; this was a test-harness timeout, not an assertion failure. Reran the entire suite with a 15-second per-test limit; all passed (worker file 13.3s). Sanitized diagnostic test logs contained only stage/category/status/correlation ID; no secret or upstream content.
- `npm run check`: passed (`tsc --noEmit`).
- `node --check src/frontend/app.js`: passed.
- `git diff --check fcd8fb00fb78e61d53af1c8a06c6974537d89617`: passed.
- `npx wrangler deploy --dry-run`: passed local bundling, **102.68 KiB / 24.84 KiB gzip**; D1 binding and vars enumerated; Wrangler explicitly exited dry-run. No deployment performed.
- Source/test trace: sync tests exercise repeat sync and deduplication, UTC boundary, public opt-in, withdrawal and rejection after withdrawal; GraphQL failure preservation/retry; malformed/missing persisted count; busy/partial; visibility/access failure; failure stage sanitization. Frontend tests cover API-order exact top 3 and all rows for 0/1/2/3/5 participants, stale-request rejection, loading/failure clearing, and outcome interpretation.
- Static privacy review: fixed GraphQL query fields remain minimal (no PR title/body/files/patch/content); diagnostics contain only enumerated stage/category/status/random correlation ID, response is no-store. No raw error/upstream body, token/cookie, IDs, URL, SQL, or PR data flows into diagnostic object. Frontend exposes only bounded opaque correlation reference, not stage/category internals.
- Sync correctness review: GraphQL errors (including HTTP 200) are rejected, missing/malformed connection and repo metadata fail closed, absent count fails explicitly; only confirmed complete sync with valid count can yield legitimate no-eligible state. Visibility-check upstream failures are not collapsed into definite consent denial. Manual sync’s bounded page budget, lease/cursor shared path, idempotence, withdrawal behavior are covered by integration tests.
- Frontend implementation review: podium uses `rows.slice(0,3)` without sorting or recomputing; full list keeps every API row and score; response month feeds profile links; surfaces clear during load and stale requests are guarded. Semantic list/table, accessible named region, live status/busy state, labels and focus styles/reduced motion are present in source.
- Effective stylesheet cascade re-review: I retract the prior claimed input/select, primary-button, and error-text contrast defects. The full stylesheet later overrides them: inputs/selects use `#0d1524`; primary button text uses `#07111c` (including hover); error text uses `#ffb5bd` and success text `#90ecc8`. The token test explicitly checks primary foreground contrast against both cyan button backgrounds and error/success colors against the dark panel. The `.hero` gradient is also replaced by the later dark radial background. These were false positives from reading only earlier declarations; no demonstrated contrast defect remains from these pairs. Static/token evidence is not rendered contrast or a full accessibility audit.
- Backend bounded-request review: GitHub requests have 10-second per-call aborts and timers clear, but serial installation/repository discovery has no overall deadline; aggregate latency can accumulate with installations. Non-blocking operational risk. The existing one-page/100-repository cap is documented pre-existing and is not raised as scope.

## MUST / MAY / BACKLOG

### MUST

- No local-candidate blocker identified for the requested local validation gate.
- Before asserting the exact currently deployed authenticated sync cause or release readiness, obtain ordinary human-authenticated UAT evidence against the actual target and confirm authorized deployment of this reviewed candidate. Keep credentials/session data in browser; share only sanitized status/error/diagnostic fields.

### MAY

- Preserve the 15-second Vitest timeout adjustment for future full-suite runs; default timeout produced one transient timeout under this suite load.
- Keep response-timeout coverage and global repository-discovery wall-clock budget in mind; current 10-second abort is per GitHub request, not an overall discovery deadline.

### BACKLOG

- Browser rendering was denied (`execution_denied`); no screenshot, visual viewport, rendered accessibility, or real keyboard journey is claimed. Apply the short visual/UAT checklist in `docs/frontend-redesign-2026-10-04.md` on an authorized candidate environment.
- Existing accessible-repository enumeration is not fully paginated (one installations page and up to 100 repositories per installation), documented by implementation owner; not newly introduced by this diff.

## LIMITATIONS

- No authenticated live browser evidence. Anonymous deployed `/api/session` and empty October leaderboard do not establish sync success, valid zero, or the actual authenticated root cause. Exact live cause remains unproven.
- No rendered browser verification; style and accessibility confidence is static plus DOM/token tests.
- Dry-run proves local bundling only; not Cloudflare deployment, live bindings, migrations, credentials, or runtime behavior.
- Source-level integrated review is independent and manual; no full review tool verdict was available. The complete test suite and direct source/diff review were performed locally.

## RISKS

- Authentication, live upstream GitHub behavior, production configuration/schema, and end-to-end visual layout remain unverified.
- Wrangler 3.114.17 emitted its routine out-of-date warning; the dry-run itself succeeded.
- No changes to implementation, deployment, commit, push, or production data. No disposable long-lived resources were created.

## NEXT

1. Keep current candidate undeployed pending CTO integration decision.
2. For live diagnosis, have a human use normal GitHub login, select an installed public repository, explicitly opt in, and click Sync once; report only HTTP status, `error`/`status`, and the four sanitized diagnostic fields if present.
3. After separately authorized deployment, repeat sync and verify stable ranking/count, then withdraw consent and confirm exclusion (allow the documented cache interval). Perform visual checklist at desktop and narrow widths.
