# Ranking count and competition copy follow-up — 2026-10-05

## Scope and candidate

Standard follow-up, not a migration restart. Single candidate `fix/ranking-count-brand-2026-10-05`, existing `VibeRivals-migration-2026-10-05` worktree, from remote default HEAD `a01d9f2d1ee32718f478502abb78a441b8bed46f`, confirmed with `git ls-remote origin refs/heads/feat/public-opt-in-leaderboard`. Frontend Designer owned frontend assets/frontend test; Senior Coder owned backend regression; CTO owns this document. No database migration/mutation, permission/secret/domain/repository change, paid resources or cron activation.

## Read-only first milestone

`npx wrangler deployments list --name vibecoderleague`: active version `6e20d6e5-ae93-4017-a20d-010ee47f90d0`, created 2026-10-05T12:56:54.052Z, deployed 12:56:55.402Z, 100%. Prior receipt associates this with merged SHA `7e542bcf586fd5493b243fcd580b28b6c1619a86`; deployment list itself does not expose Git SHA. `git diff 7e542bc..a01d9f2 -- src/github.ts src/worker.ts` is empty: production-associated and candidate-base backend source identical.

Public GitHub REST `/repos/rapha83/VibeRivals/pulls/{number}`, minimal selected metadata:

| PR | author | merged UTC | stable REST ID | node ID |
|---|---|---|---|---|
| #2 | rapha83 | 2026-10-05T01:28:58Z | 4739098916 | PR_kwDOUi27Zs8AAAABGnjpJA |
| #3 | rapha83 | 2026-10-05T02:29:08Z | 4739435823 | PR_kwDOUi27Zs8AAAABGn4NLw |
| #4 | rapha83 | 2026-10-05T13:04:06Z | 4745316179 | PR_kwDOUi27Zs8AAAABGtfHUw |

Public `GET https://viberivals.com/api/leaderboard?month=2026-10`: score3, public displayName rapha83, repository rapha83/VibeRivals. Following only its publicly returned profile ID, `GET /api/profiles/{publicProfileId}?month=2026-10`: same month/repository, pullRequests3. One `sleep 60` then repeat at **2026-10-05T13:23:11Z**: both still3. Leaderboard HTTP200 `Cache-Control: public, max-age=60`; profile source uses `no-store`. Coder independently observed leaderboard3 at13:36:06Z.

Frontend profile sums repositories for the selected UTC month; podium/table use API score, not all-time aggregate. Human display1 is not reproduced. Expected public merged set now #2/#3/#4 (three); aggregate supports3 but does not identify individual ingested PRs. No production D1 query performed. No authenticated sync response inspected. Cache/stale UI/cursor/filter/persistence remain hypotheses, not proven causes. No scoring fix invented.

## Pipeline diagnosis and changes

GraphQL selects `repository:node(id:$id)` and merged PRs with `first:50,after:$after`; stable author-ID filter, current public visibility, lease-protected name refresh and PR-ID uniqueness retain identity across rename. Completed jobs restart cursor at null/increment generation; partial jobs resume cursor; complete generations retract stale rows. Public SQL filters merged-at UTC month and active public consent. API sync complete/no-eligible decision uses repository author aggregate; displayed scores are monthly. No demonstrated defect in these paths.

Frontend: prominent H1 **Vibe Coding Rivals**, subtitle **The vibe coding competition**, competing AI builders/merged-PR hook and explicit self-declared-unverified tools/models. Compact VibeRivals wordmark/site name/domain retained. Join the vibe coding race/View the leaderboard are navigation; Sync my PRs remains consent-gated manual action, restores label after success/failure. Title/social metadata/headings and wrapping CTA CSS/test assertions updated. No scoring/API logic change, quality/productivity or validated-AI claim.

Miniflare regression in `test/worker.integration.test.ts`: one PR→1, two new plus same-ID rename→3, page limit partial/resume, complete restart, replay→3. Verifies nodeID query/cursors, wrong stable author excluded despite matching login, correct stable ID counted despite changed login, rename persistence, PR row identity, selected-month leaderboard/profile agreement, visibility gating. Three is a fixture expectation only; the follow-up PR may itself count once merged and synced.

## Integrated verification / independent QA

QA Release independent source review of all five modified files and this document: **PASS for merge readiness**, no blocker. Actual commands:
- `npm test`: 5 files, **110 tests passed**.
- `npm run check`: TypeScript passed.
- `node --check src/frontend/app.js`: passed (also independently rerun by CTO).
- `git diff --check`: passed (also CTO).
- `npx wrangler deploy --dry-run`: passed, expected D1/public origin; no deploy. Wrangler3.114.17 out-of-date warning non-blocking.

`review_changes` inspected the workspace root rather than this absolute worktree and returned no pending changes; harness limitation, not clean candidate evidence. Independent QA directly inspected actual candidate diff. No rendered/browser or authenticated sync proof; dryrun is not runtime proof.

USER_VISUAL_CHECK: desktop compact wordmark/clear hero/scoring panel; mobile320–390px wrapped CTAs/no page overflow/table-region scroll; keyboard visible focus and meaningful Join/View destinations; participant Sync my PRs→Syncing…→Sync my PRs.

## Publication state

Authenticated GitHub connector identity verified `rapha83`. No commit/push/PR/merge/deployment yet at this checkpoint. Fresh exact publication authorization required for external effects, never reuse migration approvals. Frozen head/PR URL/author/merge UTC/SHA and merged-only deployment version/traffic/smoke must be recorded when observed. Same Worker/D1/secrets/free plan/canonical origin, cron OFF. UAT must compare current expected PR set (including eligible follow-up PR), then repeat sync without duplicates; do not declare authenticated score correction before verified.
