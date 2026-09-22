# Manual post-consent sync activation receipt — 2026-09-21

## Scope and safety boundary

This release adds the bounded, user-triggered collection path for the existing Worker **`vibecoderleague`**. It does not add a cron trigger or change `wrangler.toml`, the D1 binding/schema, the public origin, GitHub App permissions/settings, or any Worker secret. It does not create a production session, consent, selection, or sync any owner data.

`POST /api/sync` accepts no identity, repository, installation, or tooling/model authority from the browser. It derives the user from the encrypted server session, requires the existing Origin plus CSRF-token defense, rate-limits the mutation, and requires exactly one current active public consent. It rechecks that consent against the session user's current GitHub-App installation membership and current public visibility before minting an in-memory installation token. It uses the existing bounded two-page `syncConsent()` lease and cursor path.

The response is deliberately small and contains neither upstream response payloads nor repository, installation, account, PR, or token details:

- `complete`
- `partial` (click **Sync now** again to continue)
- `no_eligible_prs`
- a sanitized consent/access or upstream/persistence failure category

A selection revalidation upsert now also refreshes its `installation_id`, supporting a GitHub App reinstall. Selecting a different repository deactivates previous selections for that user and retracts their stored contribution rows, retaining one active selected repository only.

## Candidate validation before deployment

| Command | Result |
| --- | --- |
| `npm run check` | PASS — TypeScript no-emit |
| `npm test` | PASS — 3 files, 40 tests |
| `node --check src/frontend/app.js` | PASS |
| `npx wrangler deploy --dry-run` | PASS — Worker `vibecoderleague`, assets, dedicated D1 binding, exact origin; no deployment performed |
| `git diff --check` | PASS |

Coverage includes unauthenticated and CSRF rejection, browser-supplied authority being ignored, withdrawn/access-lost consent rejection, selection reinstallation update, a concurrent/lease-busy sync, bounded cursor continuation, zero eligible PRs, and replay without duplicate scores. The frontend tests cover inactive hiding, bodyless CSRF request, pending/success/partial/no-eligible/busy/error states, and non-looping safe refresh.

## Deployment record

| Item | Result |
| --- | --- |
| **Exact deployed source SHA** | `86bf239a54ae464d4f933d2f16a48e0739059292` (`fix: refresh active profile after manual sync` (includes `d6da548` manual-sync delivery)) |
| **Published branch** | `origin/feat/public-opt-in-leaderboard` |
| **Target Worker** | `vibecoderleague` |
| **Origin** | `https://vibecoderleague.grumpzillax.workers.dev` |
| **Cloudflare version ID** | `f654f386-8d29-4c8d-adb1-9cde6c7545bd` |
| **Deployment command** | `npx wrangler deploy` — PASS; 98.61 KiB / 23.99 KiB gzip |
| **Cron** | remains absent/off; no `[triggers]` declaration changed |
| **Anonymous root smoke** | `GET /` → HTTP 200, `text/html` |
| **Anonymous session smoke** | `GET /api/session` → HTTP 200, `{"authenticated":false,"connectUrl":"/api/auth/github"}` |
| **Anonymous leaderboard smoke** | `GET /api/leaderboard` → HTTP 200, current month, empty rows |
| **Anonymous mutation smoke** | `POST /api/sync` → HTTP 401, `{"error":"authentication_required"}` |

The smoke checks were read-only except the intentional unauthenticated rejection probe; no production session, consent, selection, sync, or owner data was created. This receipt is included in the deployed source commit; any later receipt-only commit must be distinguished from this deployed SHA.

## Owner UAT (do not create test data)

1. Open `https://vibecoderleague.grumpzillax.workers.dev` and choose **Connect GitHub**.
2. Complete the normal GitHub App authorization in the browser.
3. In **Participation**, select the one public repository shown by the app, check the explicit consent control, and submit the opt-in.
4. Confirm the participation panel appears, then click **Sync now** once.
5. Wait for its status: **Sync complete**, **Sync finished with partial results** (click **Sync now** again deliberately), or **No eligible merged pull requests**. A busy message means an earlier request still owns the lease; wait and choose the button again. No status exposes GitHub payloads.
6. Confirm the refreshed current-month leaderboard and the public profile. Only merged PRs authored by the opted-in participant in the selected public repository are eligible. A zero result is expected for no eligible merged PRs.
7. Use **Withdraw consent** to verify retraction if desired; it removes public participation and stored contribution rows.

## Follow-up recommendation (do not change during this release)

An `oauth_invalid` response encountered while initiating GitHub App installation is most likely an install-flow callback collision: the installation path may be returning to the user-authorization OAuth callback without its expected transaction. After the above user-authorized path works, review the GitHub App configuration and consider disabling **Request user authorization (OAuth) during installation** and using a non-OAuth **Setup URL**. This is a recommendation only; no GitHub App setting was changed by this release.
