# Cloudflare Deployment and Operations

The repository targets the Cloudflare Worker `vibecoderleague` attached to the canonical custom domain **`https://viberivals.com`**. It is bound to one dedicated D1 database, `vibe-coder-league` (`a5fcb38c-026a-4bd3-9f93-a2822cf067b4`). Any requests directed to the legacy `workers.dev` staging route are automatically intercepted and redirected to the canonical origin.

## Free-Plan Architecture

The application runs on Cloudflare Free infrastructure using:
- **Cloudflare Workers:** Serves the Hono JSON API (`/api/*`), static asset handling, and scheduled sync execution.
- **Cloudflare D1:** Serverless SQLite database for sessions, consents, and pull request aggregations.
- **Cloudflare Static Assets:** Bound via `ASSETS` to serve frontend HTML, CSS, JS, and media directly from `./src/frontend`.

Configuration in `wrangler.toml` declares:
- `name = "vibecoderleague"`
- `workers_dev = true`
- `PUBLIC_ORIGIN = "https://viberivals.com"`
- Dedicated D1 database binding `DB`
- Assets binding `ASSETS` with `run_worker_first = true`
- **No cron triggers** enabled by default until an end-to-end authorization and sync journey is verified.

### Secret Management

Configure production secrets exclusively through Cloudflare Worker Secret storage (`wrangler secret put`), never in committed repository files:

- `GITHUB_APP_ID`: Numeric App ID or client identifier.
- `GITHUB_APP_PRIVATE_KEY`: PKCS#8 PEM private key for signing installation tokens.
- `GITHUB_APP_CLIENT_ID`: GitHub App OAuth client ID.
- `GITHUB_APP_CLIENT_SECRET`: GitHub App OAuth client secret.
- `SESSION_ENCRYPTION_KEY_BASE64`: 32-byte Base64-encoded key for AES-256-GCM session token encryption.

`PUBLIC_ORIGIN` is a non-secret Worker environment variable (`https://viberivals.com`).

## Canonical Origin and Routing

The canonical production URLs are:

```text
Homepage: https://viberivals.com
OAuth Callback: https://viberivals.com/api/auth/github/callback
```

### Legacy Subdomain Redirection

The Worker enforces host-level canonicalization via `canonicalResponse`:
- Safe GET/HEAD requests to legacy `*.workers.dev` roots and static assets return HTTP `308 Permanent Redirect` to `https://viberivals.com`.
- OAuth callback requests hitting legacy origins return HTTP `303 See Other` redirecting to the canonical `/api/auth/github` route (discarding obsolete state parameters).
- Off-origin API mutations return HTTP `421 Misdirected Request` to protect against cross-origin confusion.

The browser authentication flow uses the GitHub App's client ID and client secret, not credentials from a separate OAuth App, private keys, or installation tokens.

## Controlled Deployment Sequence

1. **Verify Resources:** Ensure the deployment configuration targets Worker `vibecoderleague`, D1 database `vibe-coder-league` (`a5fcb38c-026a-4bd3-9f93-a2822cf067b4`), and `PUBLIC_ORIGIN = "https://viberivals.com"`.
2. **Apply Database Migrations:** Apply pending D1 migrations using Wrangler:
   ```sh
   npx wrangler d1 migrations apply vibe-coder-league --remote
   ```
3. **Configure Worker Secrets:** Populate required GitHub App secrets and session encryption key via `wrangler secret put`.
4. **Deploy Worker:**
   ```sh
   npx wrangler deploy
   ```
5. **Verify Endpoints:** Verify that `https://viberivals.com/` returns HTTP 200, `/api/rules` and `/api/leaderboard` return valid JSON, and OAuth initiation redirects cleanly to GitHub.

## Sync Continuation and Work Budget

Each scheduled invocation operates under a strict work budget of 20 units. It processes a deterministic cohort of opted-in public repositories, acquires leases in D1, and saves pagination cursors for resilient, resumable sync. Replays are idempotent based on immutable GitHub Pull Request IDs.
