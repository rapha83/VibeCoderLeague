# Cloudflare Free deployment and operations

The repository targets the existing Cloudflare Worker `vibecoderleague` in the confirmed account, whose public origin is exactly `https://vibecoderleague.grumpzillax.workers.dev`. It is bound to one dedicated D1 database, `vibe-coder-league` (`a5fcb38c-026a-4bd3-9f93-a2822cf067b4`). The similarly named Worker and D1 resources must not be substituted or recreated.

## Free-plan target

Use the included single Worker for public API/UI and scheduled sync, with D1 for the small derived dataset. The configuration declares static assets, one D1 binding (`DB`), `workers_dev = true`, and `PUBLIC_ORIGIN` as the exact production URL with no trailing slash. It declares **no cron trigger**. Cron remains deliberately disabled until an end-to-end GitHub App journey has direct live evidence. Do not add paid resources, custom domains, DNS routes, or other D1 databases.

Configure the GitHub entries only through Cloudflare Worker secret storage, never committed files:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `SESSION_ENCRYPTION_KEY_BASE64`

`PUBLIC_ORIGIN` is a non-secret Worker variable. Do not replace an existing `SESSION_ENCRYPTION_KEY_BASE64` while configuring the other entries.

## workers.dev activation

The Worker origin and GitHub App user-authorization callback are:

```text
https://vibecoderleague.grumpzillax.workers.dev
https://vibecoderleague.grumpzillax.workers.dev/api/auth/github/callback
```

The browser flow uses the GitHub App's client ID and client secret, not credentials from a separate OAuth App, an App ID, private key, or installation token.

## Controlled activation sequence

1. Confirm the selected configuration resolves to Worker `vibecoderleague`, D1 `vibe-coder-league` ID `a5fcb38c-026a-4bd3-9f93-a2822cf067b4`, and no cron declaration.
2. Validate and push the exact candidate commit before production mutation. Inspect any automation to ensure the push does not deploy a different Worker.
3. Inspect migration status, then apply migrations `0001` through `0004` only to the dedicated D1 database:
   ```sh
   npx wrangler d1 migrations apply vibe-coder-league --remote
   ```
4. Set `PUBLIC_ORIGIN` to the exact origin and set the four GitHub App entries as Worker secrets only when their values are available through an approved secure source. Do not read, print, or replace `SESSION_ENCRYPTION_KEY_BASE64`.
5. Deploy the exact validated source commit to `vibecoderleague` with no cron configuration. Verify the static root, assets, `/api/rules`, `/api/leaderboard`, `/api/session`, and OAuth initiation without following redirects.
6. Commit and push a sanitized repair receipt afterward. Its SHA is documentation-only and is not the deployed source SHA.

Do not follow OAuth redirects, create consent, sync repositories, or enable cron in this activation repair.

## Migration and rollback

- Record exact commit, schema migration, D1 target, and recovery point before applying a migration.
- Prefer additive, backward-compatible migrations. Do not manually edit production tables to make a migration pass.
- If deployment fails, preserve the last known good Worker. Code rollback is normally safe; D1 schema rollback requires an owner-approved recovery plan.
- To disable an activated Worker safely, remove the cron trigger first (or redeploy the reviewed no-cron configuration), then disable/delete its secrets or Worker deployment as appropriate. Worker rollback does not undo D1 migrations.

## Sync continuation and failure policy

Each scheduled invocation has one sequential work budget of 20 units. It charges before every installation-token mint and GitHub GraphQL page attempt, processes a deterministic bounded cohort, saves its D1 cursor, and releases its lease for partial/retryable work. Stable PR IDs make retries idempotent. A completed traversal removes stale records; private repositories retract records, and GitHub ambiguity becomes `unknown` visibility and is excluded from public output until a later successful sync.

Inspect last success, cursor/status, page count, duration, rate-limit state, and error category—never tokens or raw payloads. On interruption, let the next cron continue from the committed cursor. Consent withdrawal remains authoritative over any concurrent sync.
