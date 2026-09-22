# OAuth completion validation reconciliation — 2026-09-21

**Scope:** sanitized reconciliation of the two OAuth repair commits on `feat/public-opt-in-leaderboard`. This is evidence-only documentation: no Worker, secret, D1 data, deployment, GitHub configuration, browser session, consent, sync, or cron setting was changed while producing it.

**Sanitization:** this receipt intentionally excludes OAuth client IDs, authorization codes, state values, cookies, access tokens, private keys, session values, and secret values.

## Repair source identity

| Item | Verified result |
| --- | --- |
| Starting branch/remote tip | At reconciliation start, local `feat/public-opt-in-leaderboard` and `origin/feat/public-opt-in-leaderboard` both resolved to `4287d647da49a384ef10169e0afa0071f2e01cda`. |
| Completion-classification repair | `70723a20ea9c98dd07b319ab42d4fa80eb2d144c` — `fix: classify OAuth completion failures safely` (2026-09-21 11:28:04 -03:00). |
| Initiation preflight repair | `4287d647da49a384ef10169e0afa0071f2e01cda` — `fix: preflight OAuth session encryption safely` (2026-09-21 11:32:44 -03:00). |
| What the source changes establish | The callback now returns only allowlisted completion stages (`viewer`, `session_encryption`, or `session_persistence`) with `oauth_completion_failed`, not exception details. The initiation route first validates the session-encryption key and, on invalid configuration, returns HTTP 503 with sanitized `oauth_configuration_invalid` / `session_encryption`, no redirect, and no transaction cookie. |

The source diff proves the implemented behavior above. It does **not** prove which stage occurred in a real owner callback, nor that either commit was deployed.

**Repository movement during reconciliation:** after the starting observation, `origin/feat/public-opt-in-leaderboard` advanced to `c26bcbb1cd00fb56d4c720a606e73832c65d2e1f` (`fix: add safe OAuth completion diagnostics`), which includes code changes outside this reconciliation scope. This reconciliation did not create, modify, deploy, validate, or otherwise act on those code changes. Its presence is not deployment evidence for any repair revision.

## Real owner-callback diagnosis

| Required evidence | Result |
| --- | --- |
| Exact observed completion stage in the real owner callback | **Not established.** No owner-callback response, Worker log, prior repair receipt, or execution artifact recording a real completion stage was recovered. |
| Exact root cause in the real owner callback | **Not established.** The repair tests model viewer, session-encryption, and session-persistence boundaries, but modeled failures are not evidence of the owner's production failure. |
| Safe conclusion | Do not label the actual failure as session encryption, persistence, viewer lookup, or any other root cause from the commit subjects or tests alone. |

## Deployment and live status

| Required evidence | Result |
| --- | --- |
| Deployed Worker version after `4287d647` | **Not established.** No deployment record links a post-repair Worker version to `70723a20` or `4287d647`. |
| Deployed Worker source SHA after repair | **Not established.** No deployed metadata or provenance record maps a live script to either repair commit. |
| Last recorded deployment evidence in the repository | `docs/deployment-repair-2026-09-21.md` records Cloudflare version `20128954-56de-4fe1-9ddc-25071c2de249` and source `a6a7c85e8c8b800b6c4fd814f917becc2a59f7d7`. That source predates both OAuth repair commits, so it cannot demonstrate that either repair is live. |
| Is the OAuth repair live? | **Not established; do not treat it as live.** |

## Test and run evidence

| Evidence | Result and boundary |
| --- | --- |
| Repair source tests | `70723a20` adds modeled assertions for the three sanitized callback stage categories. `4287d647` adds a modeled assertion that unusable session encryption fails initiation before redirect/cookie issuance. These are source-level test definitions, not a recorded test execution. |
| Recovered run output for the two repair commits | **Not found.** No `npm test`, type-check, or deployment output attributable to `70723a20` or `4287d647` was recovered. |
| Historical validation record | `docs/deployment-repair-2026-09-21.md` records `npm test` PASS (3 files, 25 tests), `npm run check` PASS, frontend syntax PASS, migration checks, dry-run deploy, and `git diff --check` for its recorded deployed source `a6a7c85`. This predates the repairs and is not validation of them. |

## Current live OAuth-initiation result

**Not observed in this reconciliation.** A current request to `GET /api/auth/github` was intentionally not sent.

The request is not provably non-mutating unless the live Worker is already running the `4287d647` preflight path *and* its encryption configuration is invalid. The last recorded deployed source is pre-repair `a6a7c85`; its initiation handler inserts an OAuth-state record and issues a transaction cookie before redirecting. Because repair deployment is unproven, an initiation request could write D1 state. Redirects disabled would prevent following GitHub authorization, but would not prevent that server-side write. Sending it would violate the reconciliation constraint.

The historical receipt records a sanitized HTTP 302 to GitHub with redirects disabled for an earlier deployment, but this is not a current result and does not establish callback completion, session encryption, token exchange, session persistence, or the repaired code path.

## Verified repository-selection behavior (source at `4287d647`)

| Layer | Verified behavior |
| --- | --- |
| GitHub App installation access | The authenticated GitHub user token calls `/user/installations`, then enumerates `/user/installations/{installation}/repositories` for **every** returned installation. Public repositories from all returned installations are aggregated. Therefore an installation can grant access to multiple repositories, and the backend can see public repositories across multiple installations accessible to that user. Actual access for the owner was not inspected. |
| API selection contract | `POST /api/selections` accepts exactly one `repoId` per request, verifies it is among the accessible public repositories, and persists one consent row keyed by `(github_id, repo_id)`. The data model/API can retain distinct consent rows if separately submitted, but this is not a statement that the UI exposes that workflow. |
| Current UI participation flow | The UI uses one ordinary `<select id="repo-select">` (not multi-select) and submits one `repoId`. After a successful selection, the session becomes participating and the UI hides the selection form, showing withdrawal instead. Thus the shipped UI supports selecting **one participating repository at a time**, not a multi-repository participation selection flow. |

## Exact next owner action

**First obtain or provide existing post-repair deployment provenance (the active `vibecoderleague` Worker version/script identity mapped to `4287d647`, plus any retained sanitized callback response/log). Do not attempt the owner OAuth callback yet.** Deployment provenance alone does not make initiation smoke non-mutating: with usable session encryption, `4287d647` writes an OAuth-state record and issues a transaction cookie before its redirect. A live initiation request remains outside this reconciliation unless pre-existing evidence independently establishes the encryption configuration is unusable; a real owner login/callback remains required to validate token exchange, viewer lookup, encryption, session persistence, and the final redirect.

## Evidence limits

This receipt reconciles retained repository evidence only. It makes no claim that GitHub App secrets are valid, that the GitHub App installation grants the owner any particular repository, that a callback completed, or that OAuth is ready for owner use.
