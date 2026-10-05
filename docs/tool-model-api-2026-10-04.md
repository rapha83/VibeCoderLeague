# Leaderboard Tool / Model API evidence — 2026-10-04

## Local candidate and boundary

- Candidate: `/Users/openclaw-bot/Documents/GrumpyzillaSoftwareLab/worktrees/VibeCoderLeague`
- Branch: `feat/public-opt-in-leaderboard`
- Base HEAD: `77f33046d703f41727f84b564adb58b42397591f`
- Backend changes: `src/worker.ts`, `test/worker.integration.test.ts`, this document.
- No commit, push, deployment, secrets inspection, live API request, or live database mutation performed. Existing untracked documentation and concurrent frontend changes were preserved.

## API contract

Every returned `/api/leaderboard` row now additionally contains:

```json
{"declarations":{"status":"self_declared_unverified","tooling":[],"models":[]}}
```

Both arrays contain distinct exact nonempty strings from **current** consent rows for that participant with `active=1 AND visibility='public'`. Null and empty strings contribute no value. Legacy/custom strings are not split, trimmed, truncated, or restricted to a catalog. Arrays may contain multiple values. Declarations do not assert verified usage.

The month filters scores, not declarations: an active public consent can supply a declaration even without contributions in the requested month. Historical requests read current consent values, never `pull_requests.declared_tooling` / `declared_model` snapshots. Declaration tuple ordering follows the existing profile endpoint's ordered consent selection; array indices do not imply tool/model pairings.

## Implementation and score/privacy invariants

The original leaderboard joins, `COUNT(*)`, month predicate, grouping, `score DESC, displayName ASC` ordering, rank assignment, and 100-row limit remain unchanged. A correlated scalar SQLite JSON aggregate adds declarations without adding rows to the scoring joins. This uses one database statement rather than per-row follow-up queries. The internal JSON column is removed from the public response.

Publication still requires participant consent and a public profile ID. Private, unknown-visibility, inactive, and withdrawn sources are excluded. Public cache remains `max-age=60` as before; this work does not claim immediate invalidation of responses already cached before withdrawal.

## Executed validation

Run from the candidate root:

```sh
npm test -- test/worker.integration.test.ts test/github-sync.test.ts test/security-contract.test.ts
npm run check
git diff --check
```

Results: **3 files / 51 tests passed** (22 worker integration, 13 GitHub sync, 16 security contract); TypeScript check passed; whitespace/conflict-marker check passed. Backend suite duration: 8.66 seconds. Negative sync tests intentionally emitted sanitized stage/category/status/correlation-ID warnings.

The new D1/Miniflare integration test verifies:

- Multiple distinct tools/models and exact deduplication across four public consents, including consents without current-month PRs.
- Commas, quotes, Unicode, HTML-looking custom text and a legacy model longer than the current input cap round-trip intact.
- Null-only and empty-string-only rows always have empty arrays and the required status.
- Stale PR snapshot values never appear; editing current consent updates historical-month declarations without changing score.
- Public score of two remains two despite multiple consents and retained private/unknown/inactive PRs.
- Tie ordering, ranks, repository aggregation, month isolation, invalid month rejection, and empty-month response.
- Private/unknown/inactive declarations do not publish; changing a consent to private removes its declarations; participant withdrawal removes its row even with PR records retained.
- Complete response equality detects leaked internal JSON or private identifiers.

Existing profile/leaderboard integration expectation was updated for the additive contract. Existing login/opt-in/sync/withdrawal and security regressions passed unchanged.

## Sync diagnostic inspection (no speculative patch)

Inspected `/api/sync` in `src/worker.ts`, GitHub request classification, and the existing integration tests. The handler tracks consent selection, session decryption, access, visibility, consent recheck, token creation, sync, and result-read boundaries; sync failures distinguish GitHub pull-fetch errors from sync persistence and lease loss. Public diagnostics/logs contain stage, category, numeric upstream status, and correlation ID rather than exception text or credentials.

Existing passing tests cover sanitized token failure, GraphQL pull-fetch failure with clean retry, upstream access/visibility failures, stale encrypted sessions/signing configuration, and missing persisted result count. **No defect explaining the live symptom was verified.** The supplied sanitized capture was inspected while in progress and provided no usable completed failure event; live diagnostics remain CTO-owned. No sync behavior was modified.

Optional follow-up test coverage, not a discovered defect: inject D1 failures specifically at initial consent selection/recheck, and exercise `sync_lease_lost` through the manual route to assert its public diagnostic category and log sanitization. These are not required API changes.

## Review and handoff limitations

Manual scoped diff review confirmed the unchanged scoring query clauses and isolated response enrichment. Automatic `review_changes` reported unavailable because its git tooling is pinned to a different workspace; an explicit-path read-only helper review timed out without returning a verdict. No independent COMPLETE verdict is claimed. The repository-index/validation-plan helpers also resolved an unrelated workspace; their suggested tests were not used. All command evidence above came from the explicit candidate directory.

Miniflare fixtures dispose their resources in `afterEach`; no persistent task server or live resources were started. Frontend integration and any final release remain with the Frontend Designer / CTO. The actual implementation diff is available via `git diff -- src/worker.ts test/worker.integration.test.ts` in this candidate; this document is intentionally untracked pending CTO handling.
