# Cloudflare Free deployment and operations

The repository contains the Cloudflare Worker, D1 migration, static assets, and `wrangler.toml`; it does not contain account credentials, a real D1 database ID, or deployed Cloudflare state. Cloudflare account access, project IDs, domain/DNS changes, GitHub credentials, and secret values remain owner-supplied and unvalidated.

## Free-plan target

Use the included single Worker for public API/UI and scheduled sync, with D1 for the small derived dataset. The configuration declares static assets, one D1 binding (`DB`), and an every-15-minutes Cron Trigger. Confirm current Free-plan quotas, runtime and D1 limits, and custom-domain requirements before launch; do not add paid resources implicitly.

Configure secrets only through Cloudflare secret storage, never committed files:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `SESSION_ENCRYPTION_KEY_BASE64`
- `PUBLIC_ORIGIN`

Replace the placeholder `database_id` in `wrangler.toml` with the owner-created D1 database ID. Keep preview/local and production databases separate, and verify exactly one production schedule is active.

## First deployment

1. Create/select a Free-compatible Worker and D1 database; record its ID outside Git.
2. Set the configuration/secrets above through Cloudflare, then review the callback origin and GitHub App permissions.
3. Apply the included migration once to the target D1 database:
   ```sh
   npx wrangler d1 migrations apply vibe-coder-league --remote
   ```
4. Bundle-check, then deploy the reviewed commit:
   ```sh
   npx wrangler deploy --dry-run
   npx wrangler deploy
   ```
5. Confirm the scheduled handler and only one production cron. Use a controlled public repo for an initial read-only/dry-run review, then permit the bounded sync.
6. Verify opt-in filtering, withdrawal deletion, visibility retraction, continuation cursor behavior, and absence of tokens/raw upstream payloads in observability before DNS/public announcement.

## Migration and rollback

- Record exact commit, schema migration, D1 target, and recovery point before applying a migration.
- Prefer additive, backward-compatible migrations. Do not manually edit production tables to make a migration pass.
- If deployment fails, preserve the last known good Worker. Code rollback is normally safe; D1 schema rollback requires an owner-approved recovery plan.

## Sync continuation and failure policy

Each scheduled run processes at most two GraphQL pages per consent and saves the D1 cursor. Runs derive rankings from stable PR IDs, so a retry is idempotent. A completed traversal removes stale records by generation. Private repositories retract records; GitHub ambiguity becomes `unknown` visibility and is excluded from public output until a later successful sync.

Inspect last success, cursor/status, page count, duration, rate-limit state, and error category—never tokens or raw payloads. On interruption, let the next cron continue from the committed cursor. Consent withdrawal remains authoritative over any concurrent sync.

## Boundaries

This change did not create a Cloudflare project, apply a remote migration, deploy, configure DNS, activate a live Cron Trigger, create a GitHub App, or validate credentials. Those actions require owner-controlled account state and are intentionally documented rather than claimed complete.
