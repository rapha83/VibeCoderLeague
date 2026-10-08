# Privacy, security, and retention

## Product boundary

Vibe Coder League publishes an opt-in monthly count of merged pull requests from repositories that are public at selection and at sync time. Tool/model labels are voluntary self-declarations and remain unverified. It is not an AI detector, a code-quality or productivity measure, or a source-code archive.

## Minimal data and retention

Store only what the MVP needs: an internal participant/consent record, a GitHub actor or installation reference, minimal merged-PR facts, and sync checkpoints. The active browser session retains its GitHub App user-authorization access token only as AES-GCM-encrypted D1 session data and for no longer than the configured eight-hour session; the session cookie is stored as a SHA-256 hash. GitHub App installation tokens are short-lived and memory-only. Do not store source code, PR titles/bodies, patch bodies, review text, repository contents, personal contact data, webhook payloads, or unrelated repository metadata. Never log tokens or full API payloads. Display names are user-controlled/untrusted text and must be escaped and length-limited.

A participant can withdraw at any time. Withdrawal deletes the participant's public contribution records for that consent. If a repository becomes private, inaccessible, or cannot be confirmed public, the system retracts/suppresses its public contribution records until public visibility is confirmed again.

## Access and secret handling

- Store `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_SECRET`, and session encryption material only as Cloudflare secrets; never in Git, D1 rows, frontend assets, logs, error output, or CI artifacts.
- Treat the GitHub App user-authorization client ID as configuration and do not use a separate OAuth App or broad `repo` scope.
- GitHub App installation tokens are minted at runtime, held only in memory for a sync request, and never committed or printed.
- Enforce repository/install scope and least privilege (see [GitHub App setup](github-app.md)).
- Restrict App permissions to Metadata read and Pull requests read; do not request Contents, write permissions, webhooks, code scanning, organization membership, or broad OAuth scopes.
- Set `PUBLIC_ORIGIN` only to the owner-controlled deployed HTTPS origin and validate CSRF against it.

## Security controls

The Worker uses a one-time, expiring authorization `state`, server-side code exchange, opaque `HttpOnly`, `Secure`, `SameSite=Lax` session cookies, session expiry, AES-GCM encrypted user-token storage, CSRF token and exact-origin checks for mutations, strict public-repository confirmation, and bounded per-IP mutation rate limits. Sync uses a lease and a bounded page count, fails closed on visibility ambiguity, and never requests PR content fields.

## Operational limits

The Free-plan design intentionally avoids paid services. Before launch, the owner must confirm current Cloudflare and GitHub limits, retention policy, abuse handling, incident contacts, and deletion/retraction monitoring. Do not expand repository scope or permissions to resolve ordinary authorization errors without an explicit product/security review.
