# Sync diagnosis — 2026-10-04

## Candidate and scope

Local, uncommitted candidate on `feat/public-opt-in-leaderboard`, base
`fcd8fb00fb78e61d53af1c8a06c6974537d89617` at
`/Users/openclaw-bot/Documents/GrumpyzillaSoftwareLab/worktrees/VibeCoderLeague`.
Backend-owned changes: `src/github.ts`, `src/worker.ts`,
`test/github-sync.test.ts`, `test/worker.integration.test.ts`, and this document.
Concurrent frontend changes belong to the frontend agent. Existing untracked
`docs/deployment-smoke-2026-09-21.md` was preserved. No commit, push, deployment,
production D1 query/mutation, app permission change, or credential inspection.

## Verified evidence versus live hypotheses

### Reconciled deployment metadata (supplied read-only evidence)

Task tracking card: `17620429`, exclusively for this direct demand.
The requester's read-only `wrangler deployments list` reconciliation identifies
current newest listed deployment `2026-09-21T19:09:03.887Z`, with 100% assigned to
`f654f386-8d29-4c8d-adb1-9cde6c7545bd`; do not substitute historic `6137303b`.
This is supplied metadata, not an independently rerun CLI probe by this agent.
The requester also confirmed `GET /api/leaderboard?month=2026-10` at
2026-10-04 20:18 UTC returned HTTP 200 with `{"month":"2026-10","rows":[]}`.
Neither deployment metadata nor the empty public response proves successful sync.
Cloudflare CLI access is available for scoped read-only metadata; this does not
expand authority to secrets, authenticated browser data, mutations, or deployment.

Read-only anonymous probes against
`https://vibecoderleague.grumpzillax.workers.dev` returned:

- `GET /api/session`: HTTP 200,
  `{"authenticated":false,"connectUrl":"/api/auth/github"}`.
- `GET /api/leaderboard?month=2026-10`: HTTP 200,
  `{"month":"2026-10","rows":[]}`.
- An initial probe to `/api/me` returned 404; the actual session route is
  `/api/session`. No authenticated endpoint was invoked live.

The empty live leaderboard is **not evidence of successful synchronization or
of zero eligible PRs**. The precise live authenticated `sync_unavailable` cause
remains unproved: no human browser login/click evidence or safe upstream status
was supplied, and the local candidate has not been deployed.

Verified source defects, exercised with synthetic regression responses:

1. The original GraphQL wrapper checked HTTP status but not GraphQL `errors`.
   An HTTP-200 error with `data.repository=null` became `repo_inaccessible`,
   which the sync path interpreted as grounds for retraction. Partial data with
   errors could also be accepted. The candidate rejects both as upstream errors
   before any page persistence or retraction.
2. Missing/null PR nodes were defaulted to `[]`; malformed data could reach a
   successful empty completion. The candidate validates connection, cursor,
   merged timestamp, and minimal author metadata. Legitimate empty arrays remain
   valid. The User-only author fragment returns `{}` for non-User actors; these
   are normalized to ineligible/null rather than causing a false sync failure.
3. Missing repository `private` metadata was treated as public. Repository
   enumeration now requires explicit boolean visibility and valid minimal IDs.
4. An absent persisted COUNT row was treated as zero. It now fails explicitly.
5. Session decryption, initial consent selection, and consent recheck failures
   were outside the sync failure handler. They now yield sanitized stage evidence.
   Temporary visibility-check upstream failures are no longer labeled as a
   definite consent/access denial.

Locally reproduced plausible causes, **not proven live causes**: GitHub
401/403/429/5xx; transport failures; malformed JSON/metadata; GraphQL errors;
unusable synthetic signing key; stale session encryption configuration; stalled
request; and missing persistence result. Tests use only fake credentials and an
ephemeral generated test key. No actual secret was read or output.

## Additive frontend contract

Failure stays HTTP 503 with existing fields preserved:

```json
{
  "error": "sync_unavailable",
  "category": "upstream_or_persistence",
  "diagnostic": {
    "stage": "pull_fetch",
    "category": "graphql_error",
    "status": 200,
    "correlationId": "<random UUID>"
  }
}
```

- Stages: `consent_selection`, `session_decryption`, `repo_access`,
  `repo_visibility`, `consent_recheck`, `installation_token`, `pull_fetch`,
  `sync_persistence`, `result_read`.
- Categories: `http_error`, `transport_error`, `timeout`, `invalid_json`,
  `graphql_error`, `invalid_response`, `configuration_error`, `lease_lost`,
  `persistence_error`, `unknown_error`.
- `status` is upstream HTTP status when available; `0` means unavailable/not
  applicable, not an HTTP response code. GraphQL errors can arrive with 200.
- The same allowlisted object is logged with `sync_unavailable` for correlation.
  No raw error, stack, upstream body, token, cookie, user/repository ID, SQL,
  request URL, or PR content is included. Response uses `Cache-Control: no-store`.
- Frontend may ignore the optional object; diagnostics are not a new successful
  state. Existing complete/partial/no-eligible/busy response bodies are unchanged.
  Consent/access denial remains 409; busy remains 409.

PR sync remains limited to two 50-PR pages per manual request. GitHub sync
metadata/token requests now have a 10-second abort timeout, including response
body consumption, and timers are cleared. There are no retries. This is a
per-request deadline, not a global wall-clock deadline for all repository
discovery. Existing discovery enumerates one installations page and up to 100
repositories per installation; discovery pagination remains a known pre-existing
limitation (can hide an otherwise eligible selection, normally 409 rather than
`sync_unavailable`). This candidate does not expand permissions or collected fields.

## Validation and reproduction

From the candidate directory:

```sh
npm run check
npm test -- test/github-sync.test.ts test/worker.integration.test.ts test/security-contract.test.ts
git diff --check
```

Final results: TypeScript check passed; **50 tests passed across three backend
files** (13 GitHub sync, 21 Worker integration, 16 security contract); whitespace
check passed. Final run duration approximately 30 seconds. Earlier iteration
had one expected regression mismatch: a test asserted old `github_503` exception
text; updated it to assert typed `http_error` with status 503, retaining budget
and lease-release assertions. Frontend checks are owned by the frontend agent.

The API integration includes synthetic login/state/cookie flow, public opt-in,
two repeat syncs with one deduplicated contribution, exclusion of another author,
UTC boundary (September local timestamp ranks in October UTC), ranking, actual
withdrawal endpoint, immediate contribution removal, and rejected post-withdrawal
sync. Other tests preserve private/access denial, busy/partial/valid zero,
cursor-resumption budgets, upstream failure lease release and retry, and prior
contributions/consent after a GraphQL error. No titles/bodies/diffs/files/contents
are requested; the fixed GraphQL selection is unchanged.

Independent review tooling was unavailable for this absolute worktree; the
fallback read-only helper timed out without findings. Manual diff review was
performed, but **no independent COMPLETE verdict is claimed**. CTO should obtain
an integration review before certification. Repository-index/validation-plan
tools target a different base workspace, so their unrelated suggested tests were
not used. Platform repository-learning verification was fenced on an initial
terminal probe; the actual local command/test outputs above remain available,
but this is not a promoted platform-verified outcome.

## Exact next human steps (no credential export)

1. On the currently deployed site, use the ordinary browser GitHub login flow.
   Keep cookies/tokens in the browser; do not export HAR, request headers,
   session JSON/CSRF fields, or OAuth callback URLs.
2. Select an installed **public** repository and give explicit participation
   consent. Click **Sync now** once. In browser Network, inspect only the
   `/api/sync` response HTTP status and response JSON error/status fields.
3. Share only HTTP status, `error`/`status`, and (when present) the four diagnostic
   fields. Current deployment may have no diagnostic until an independently
   authorized deployment of the integrated candidate; this task does not deploy.
4. For a later authorized candidate smoke: complete should show eligible merged
   PRs in the UTC month; partial means resume with another bounded sync; busy
   means another lease is running; no eligible is valid only after completed
   upstream sync. Any failure remains an error, never a legitimate zero.
5. Repeat completed sync and verify stable ranking/count. Withdraw participation
   through the UI and verify exclusion. Public leaderboard responses cache for
   up to 60 seconds, so allow cache expiry when checking the deployed view.

Next backend action depends on the sanitized stage/status: investigate user
authorization for access 401/403, app signing/token exchange for installation
stage errors, GraphQL/runtime for pull-fetch errors, or persistence/schema/lease
for persistence errors. Do not rotate secrets, change permissions, or modify
production data on hypothesis alone.

All Miniflare fixtures dispose their temporary runtimes. No persistent server,
container, deployed resource, or background terminal job was created. Candidate
and evidence remain uncommitted for CTO-directed integration.
