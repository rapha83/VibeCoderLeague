# Cloudflare Free deployment and operations

The repository contains the Cloudflare Worker, D1 migrations, static assets, and `wrangler.toml`. It is bound to one dedicated D1 database, `vibe-coder-league` (`a5fcb38c-026a-4bd3-9f93-a2822cf067b4`), in the confirmed Cloudflare account. The Worker is not deployed, no Worker secrets are configured, and no remote migration has been applied.

## Free-plan target

Use the included single Worker for public API/UI and scheduled sync, with D1 for the small derived dataset. The configuration declares static assets, one D1 binding (`DB`), `workers_dev = true`, and **no cron trigger**. Cron remains deliberately disabled until an end-to-end GitHub App journey has direct live evidence. Do not add paid resources, custom domains, DNS routes, or other D1 databases.

Configure secrets only through Cloudflare secret storage, never committed files:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `SESSION_ENCRYPTION_KEY_BASE64`
- `PUBLIC_ORIGIN`

Keep preview/local and production databases separate, and verify exactly one production schedule only after activation is authorized by evidence.

## workers.dev activation gate

The confirmed account already has the Workers subdomain `grumpzillax`, as returned by Cloudflare's account API on 2026-09-21. The requested exact subdomain is `grumpuzillax`; it cannot be set because an account supports only one Workers subdomain. Do not deploy this Worker to `grumpzillax.workers.dev`, use another subdomain, add a route, or set a callback until the owner provides an explicit revised origin/authorization.

If a future approved origin is available, use the reported Worker origin exactly as `PUBLIC_ORIGIN`, with no trailing slash, and set the GitHub App's user authorization callback to:

```text
${PUBLIC_ORIGIN}/api/auth/github/callback
```

The browser flow uses the GitHub App's client ID and client secret, not credentials from a separate OAuth App, an App ID, private key, or installation token.

## Progressive activation sequence

Only after the origin gate is resolved and the existing GitHub App's installation and all secret values are securely available:

1. Apply the additive migrations to the dedicated database once:
   ```sh
   npx wrangler d1 migrations apply vibe-coder-league --remote
   ```
2. Set Worker secrets from an approved secure source, then deploy the reviewed commit with no cron configuration.
3. Confirm the static root, `GET /api/rules`, and `GET /api/leaderboard` return `200` before authentication.
4. Test one controlled public-repository user journey: GitHub App authorization, session, eligible public-repository selection, explicit opt-in, sync, monthly profile/count display, publication, and withdrawal/retraction. Confirm no tokens, private keys, or raw GitHub payloads appear in logs.
5. Only then add one bounded cron trigger, redeploy, and confirm exactly one production schedule. A `workers.dev` URL alone does not validate D1, GitHub authorization, App installation, or scheduled sync.

## Migration and rollback

- Record exact commit, schema migration, D1 target, and recovery point before applying a migration.
- Prefer additive, backward-compatible migrations. Do not manually edit production tables to make a migration pass.
- If deployment fails, preserve the last known good Worker. Code rollback is normally safe; D1 schema rollback requires an owner-approved recovery plan.
- To disable an activated Worker safely, remove the cron trigger first (or redeploy the reviewed no-cron configuration), then disable/delete its secrets or Worker deployment as appropriate. Worker rollback does not undo D1 migrations.

## Sync continuation and failure policy

Each scheduled invocation has one sequential work budget of 20 units. It charges before every installation-token mint and GitHub GraphQL page attempt, processes a deterministic bounded cohort, saves its D1 cursor, and releases its lease for partial/retryable work. Stable PR IDs make retries idempotent. A completed traversal removes stale records; private repositories retract records, and GitHub ambiguity becomes `unknown` visibility and is excluded from public output until a later successful sync.

Inspect last success, cursor/status, page count, duration, rate-limit state, and error category—never tokens or raw payloads. On interruption, let the next cron continue from the committed cursor. Consent withdrawal remains authoritative over any concurrent sync.
