# Deployment repair receipt — 2026-09-21

**Scope:** controlled repair of the existing Cloudflare Worker `vibecoderleague` at `https://vibecoderleague.grumpzillax.workers.dev`.

**Safety:** This receipt contains no credentials, cookies, OAuth state, tokens, client identifiers, private keys, or secret values. No old Worker name, unrelated D1 database, consent, synchronization, browser authentication, OAuth callback, or cron schedule was used or changed. The existing `SESSION_ENCRYPTION_KEY_BASE64` secret was neither read nor overwritten.

## Source and release identity

| Item | Result |
| --- | --- |
| Deployed source commit | `a6a7c85e8c8b800b6c4fd814f917becc2a59f7d7` — `fix: restore anonymous session contract` |
| Release-alignment commit | `0f75049686b3bc575abea1af927d14eb4d1a7b9a` — `fix: target verified vibecoderleague worker` |
| Deployment Worker | `vibecoderleague` |
| Deployed URL / `PUBLIC_ORIGIN` | `https://vibecoderleague.grumpzillax.workers.dev` exactly, without trailing slash |
| Cloudflare version ID | `20128954-56de-4fe1-9ddc-25071c2de249` |
| Deployment configuration | Assets `ASSETS`; D1 binding `DB` to `a5fcb38c-026a-4bd3-9f93-a2822cf067b4`; `PUBLIC_ORIGIN` exact; no cron declaration |
| Documentation receipt source | This is a post-deployment documentation commit and is **not** the deployed source commit. |

## Repository release gate

The release-alignment candidate was committed and pushed before remote mutation. After smoke exposed the missing session route required by the frontend contract, the focused repair was implemented, validated, committed, pushed, and deployed as the final exact source commit above. Full release validation ran for both source candidates; the final candidate results were:

| Check | Result |
| --- | --- |
| `npm test` | PASS — 3 files, 25 tests |
| `npm run check` | PASS — TypeScript no-emit |
| `node --check src/frontend/app.js` | PASS |
| Local D1 migrations | PASS — no migrations remaining after all four apply locally |
| `npx wrangler deploy --dry-run --name vibecoderleague` | PASS — resolves Worker target, dedicated D1 ID, assets, and exact public origin without deploying |
| `git diff --check` | PASS |

The Wrangler v3 CLI emitted its known out-of-date warning only; no package upgrade was performed during this controlled repair.

## Dedicated D1 migration repair

**Target only:** D1 `vibe-coder-league`, ID `a5fcb38c-026a-4bd3-9f93-a2822cf067b4`, confirmed account.

| Migration | Remote result |
| --- | --- |
| `0001_initial.sql` | Applied |
| `0002_rate_limits.sql` | Applied |
| `0003_sync_job_leases.sql` | Applied |
| `0004_oauth_transactions_and_public_profiles.sql` | Applied |
| Final remote migration status | PASS — no migrations remaining |
| Read-only schema check | PASS — `sessions`, `oauth_states`, `participants`, `consents`, `pull_requests`, `sync_jobs`, and `rate_limits` present |

No other D1 resource was queried or changed.

## Worker configuration and secret-source result

`PUBLIC_ORIGIN` is now deployed as the exact non-secret Worker variable. Approved secure source availability was checked by presence only; no candidate credential content was read. None of the required GitHub App entries was available from approved sources, and the deployed Worker secret-name listing shows only the pre-existing session-encryption secret.

| Required entry | Result |
| --- | --- |
| `GITHUB_APP_ID` | BLOCKED — owner must enter directly in Cloudflare Worker secret storage for `vibecoderleague` |
| `GITHUB_APP_CLIENT_ID` | BLOCKED — owner must enter directly in Cloudflare Worker secret storage for `vibecoderleague` |
| `GITHUB_APP_CLIENT_SECRET` | BLOCKED — owner must enter directly in Cloudflare Worker secret storage for `vibecoderleague` |
| `GITHUB_APP_PRIVATE_KEY` | BLOCKED — owner must enter directly in Cloudflare Worker secret storage for `vibecoderleague` |
| `SESSION_ENCRYPTION_KEY_BASE64` | PRESERVED — existing secret name remains present; value not read or changed |

## Post-deploy anonymous and OAuth-init smoke

All HTTP checks used the exact live origin. OAuth initiation was requested once with redirects disabled; no redirect was followed and no cookie value or state was recorded.

| Endpoint/check | Result | Sanitized observation |
| --- | --- | --- |
| `GET /` | PASS | HTTP 200, `text/html` |
| `GET /app.js` | PASS | HTTP 200, `application/javascript` |
| `GET /styles.css` | PASS | HTTP 200, `text/css` |
| `GET /api/rules` | PASS | HTTP 200, JSON rules object |
| `GET /api/leaderboard` | PASS | HTTP 200, JSON object with current month and empty rows |
| `GET /api/session` | PASS | HTTP 200, JSON anonymous session contract with relative GitHub-init route |
| `GET /api/auth/github`, redirects disabled | PARTIAL | HTTP 302 to the GitHub authorization host and a transaction cookie header were produced. It cannot be considered usable until all four GitHub App Worker secrets above are entered; no GitHub redirect was followed. |
| Cron | PASS / disabled | No `[triggers]` declaration in deployed configuration; no cron was enabled. |

## Outcome

The Worker-name mismatch, missing public origin, missing application D1 schema, leaderboard failure, and missing anonymous session route are repaired on the actual Worker and dedicated database. The activation is **not ready for owner login or opt-in**: the four GitHub App Worker secrets remain unavailable and must be entered directly by the owner in Cloudflare for `vibecoderleague`. Do not enable cron or proceed through OAuth until those blockers are resolved and a further controlled smoke validates the intended authorization journey.
