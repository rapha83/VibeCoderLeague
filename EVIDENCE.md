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

## Intended verification
Record exact commands, results, final commit, remote revision, and pull request link below after implementation integration.
