# Cloudflare Free deployment and operations

The repository contains the Cloudflare Worker, D1 migration, static assets, and `wrangler.toml`; it does not contain account credentials, a real D1 database ID, or deployed Cloudflare state. Cloudflare account access, project IDs, domain/DNS changes, GitHub credentials, and secret values remain owner-supplied and unvalidated.

## Free-plan target

Use the included single Worker for public API/UI and scheduled sync, with D1 for the small derived dataset. The configuration declares static assets, one D1 binding (`DB`), an every-15-minutes Cron Trigger, and `workers_dev = true`. The first deployment is therefore reachable at the account's `workers.dev` subdomain; no route or custom domain is configured or needed for the initial smoke path. Confirm current Free-plan quotas, runtime and D1 limits before launch; do not add paid resources implicitly.

Configure secrets only through Cloudflare secret storage, never committed files:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `SESSION_ENCRYPTION_KEY_BASE64`
- `PUBLIC_ORIGIN`

Replace the placeholder `database_id` in `wrangler.toml` with the owner-created D1 database ID. Keep preview/local and production databases separate, and verify exactly one production schedule is active.

## First deployment: workers.dev activation and smoke path

These are owner-run instructions. They do not authorize deployment in this change.

1. In the intended Cloudflare account, enable/select that account's Workers subdomain when prompted by Wrangler. The resulting origin has the form `https://vibe-coder-league.<account-subdomain>.workers.dev`; record the exact origin outside Git.
2. Create/select the D1 database, replace the `database_id` placeholder locally, and apply all migrations exactly once to that database:
   ```sh
   npx wrangler d1 migrations apply vibe-coder-league --remote
   ```
3. Deploy the reviewed commit. Confirm Wrangler reports the `workers.dev` URL; do not add a route or custom domain for this initial path:
   ```sh
   npx wrangler deploy --dry-run
   npx wrangler deploy
   ```
4. Set `PUBLIC_ORIGIN` to that exact HTTPS `workers.dev` origin (no trailing slash). In the GitHub App's **user authorization callback URL** setting, set exactly:
   ```text
   ${PUBLIC_ORIGIN}/api/auth/github/callback
   ```
   The browser flow uses the GitHub App's client ID and client secret, not credentials from a separate OAuth App, an App ID, private key, or installation token.
5. Perform public smoke checks against the deployed origin before authentication. Expected results are a `200` from the static root and `GET /api/rules`; a current-month `GET /api/leaderboard` also returns `200` with a JSON response. For example:
   ```sh
   curl -i "${PUBLIC_ORIGIN}/"
   curl -i "${PUBLIC_ORIGIN}/api/rules"
   curl -i "${PUBLIC_ORIGIN}/api/leaderboard"
   ```
6. Then validate the GitHub App browser sign-in by opening `${PUBLIC_ORIGIN}/api/auth/github`. Confirm it redirects to GitHub with the App client ID and a one-time `state`, returns to the exact callback above, creates the secure session, and allows selection only from accessible, currently public App installations. Complete one explicit opt-in and verify it can be withdrawn.
7. Confirm the scheduled handler and only one production cron. Use a controlled public repo for an initial read-only review, then permit the bounded sync. Verify opt-in filtering, withdrawal deletion, visibility retraction, continuation cursor behavior, and absence of tokens/raw upstream payloads in observability before public announcement.

A workers.dev URL being reachable does not establish D1, GitHub authorization, App installation, or scheduled sync correctness; each remains a separate validation step.

## Migration and rollback

- Record exact commit, schema migration, D1 target, and recovery point before applying a migration.
- Prefer additive, backward-compatible migrations. Do not manually edit production tables to make a migration pass.
- If deployment fails, preserve the last known good Worker. Code rollback is normally safe; D1 schema rollback requires an owner-approved recovery plan.

## Sync continuation and failure policy

Each scheduled run processes at most two GraphQL pages per consent and saves the D1 cursor. Runs derive rankings from stable PR IDs, so a retry is idempotent. A completed traversal removes stale records by generation. Private repositories retract records; GitHub ambiguity becomes `unknown` visibility and is excluded from public output until a later successful sync.

Inspect last success, cursor/status, page count, duration, rate-limit state, and error category—never tokens or raw payloads. On interruption, let the next cron continue from the committed cursor. Consent withdrawal remains authoritative over any concurrent sync.

## Boundaries

This change did not enable a Workers subdomain, create a Cloudflare project, apply a remote migration, deploy, configure DNS, activate a live Cron Trigger, create a GitHub App, or validate credentials. Those actions require owner-controlled account state and are intentionally documented rather than claimed complete.
