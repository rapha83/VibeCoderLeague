# Delivery evidence — public opt-in leaderboard MVP

## Scope
Public opt-in monthly leaderboard for merged pull requests from explicitly selected public GitHub repositories. Self-declared tooling/model labels are unverified. Private repositories and pull-request content are excluded.

## Architecture decision (2026-09-20)
- **Runtime:** one TypeScript Cloudflare Worker using Hono; static frontend assets served by the Worker.
- **Storage:** Cloudflare D1 only, with migrations for identity/session, public-ranking consent, selected repository eligibility, minimal merged-PR records, and resumable sync state.
- **Integration:** GitHub App server-side. Configuration requires only app ID, installation client ID and private key as Worker secrets. App permission boundary is Metadata: read and Pull requests: read. The integration does not request `Contents`, clone code, or request diff/patch endpoints.
- **Sync:** Free-plan Cron Trigger calls a bounded, resumable worker job. Sync derives rankings from unique minimal PR records rather than mutating counters. Stable PR ID makes replays idempotent. A PR is credited once to its opted-in author in its `mergedAt` UTC month.
- **Privacy/retraction:** access, public visibility, selected repo, and profile/ranking consent are revalidated server-side. Withdrawal, visibility loss, or access loss retracts contributions from public output.

## Initial repository evidence
- GitHub repository API reported an empty repository (409) on 2026-09-20; no remote branches or PRs were present.
- Created the initial local baseline commit `c54c9dc` (`chore: initialize repository`) and feature branch `feat/public-opt-in-leaderboard`. No remote state was overwritten.
- Managed-delivery draft ID was unavailable in the supplied context and `get_software_delivery` could not resolve a server-pinned/delivery ID. This is an orchestration traceability limitation, not an implementation authorization gap.

## Release-preparation evidence (2026-09-21)
- Candidate began at remote-tracking `feat/public-opt-in-leaderboard` SHA `a45854732a91a9df262d3a46b5bf5311566c5325`, with a clean worktree.
- Dedicated Cloudflare D1 database created for this product only: `vibe-coder-league`, ID `a5fcb38c-026a-4bd3-9f93-a2822cf067b4`, location `ENAM`. The pre-existing `nimrava-early-access` D1 database was inspected but not reused or changed.
- `wrangler.toml` binds only that dedicated D1 database. No cron trigger is declared in the deployable configuration; it remains intentionally disabled until the GitHub App authentication, consent, and controlled-public-repository journey has direct live evidence.
- Profile responses now resolve and return the requested UTC month; the profile UI displays returned published-repository and merged-PR totals, including zeroes, and labels the returned month. Profile links preserve the selected leaderboard month.
- Scheduled sync now enforces one sequential shared work budget (`20` work units) for a single invocation, charging before token minting and each GitHub page request; it stores partial cursor state and releases leases when budget is exhausted or a retryable page failure occurs.

## Local release validation (2026-09-21)
All commands were run from the candidate worktree after a clean dependency install:

```text
npm ci
npm run check                         # passed: tsc --noEmit
npm test                              # passed: 3 files, 24 tests
node --check src/frontend/app.js      # passed
npx wrangler d1 migrations apply vibe-coder-league --local
                                      # passed: 0001–0004 applied / later run no migrations
npx wrangler deploy --dry-run         # passed: bundle 92.31 KiB (23.01 KiB gzip)
```

`npm ci` reported 11 dependency audit advisories (4 moderate, 5 high, 2 critical). They are not changed by this candidate and do not alter the above build/test results; they need a separately scoped dependency-upgrade review.

## Activation gate and rollback
No remote migration, Worker deployment, GitHub secret configuration, login, or cron enablement is recorded here. Activation requires direct evidence that the exact `grumpuzillax` account Workers subdomain is available/configured safely and that the existing GitHub App callback, installation on a controlled public repository, and required secret values are accessible through an approved secure source.

To disable a future activation: remove the Worker cron trigger first (or redeploy the last reviewed no-cron configuration), then disable/delete the Worker secrets or Worker deployment as appropriate. Worker rollback does **not** undo D1 migrations; migrations are additive and require a separately reviewed data-recovery plan before any schema rollback.
