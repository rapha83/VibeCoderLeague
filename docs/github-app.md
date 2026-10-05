# VibeRivals GitHub App operating guidance (owner-run)

Use the existing GitHub App and installation for the origin migration; do not create a replacement App or rotate credentials as part of this cutover. Configuration stays in existing Cloudflare secrets. Historical validation receipts are separate from this current operating checklist.

## Required permissions

Configure only:

- **Repository permissions → Metadata: Read-only**
- **Repository permissions → Pull requests: Read-only**
- **Contents: no access**
- **Webhooks:** not required; do not enable one for this MVP

Install the App only on chosen repositories; do not grant organization-wide access by default. Do not add issues, actions, checks, deployments, members, administration, or any write permission.

## Owner checklist

1. Locate the existing GitHub App in its owner-controlled account/organization: personal owner `https://github.com/settings/apps/<app-slug>` or organization owner `https://github.com/organizations/<owner>/settings/apps/<app-slug>`. Open **General**. Repository administrator access does not establish GitHub App ownership; a settings/API 404 is not confirmation of the App configuration.
2. Set the permissions above and leave webhook delivery disabled.
3. Retain the existing App private key and `GITHUB_APP_PRIVATE_KEY` Cloudflare secret. Never commit, paste, or log it.
4. Enable the GitHub App's user authorization web flow and use **that App's** client ID and client secret for `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`. Do not create or use a separate OAuth App, and do not substitute the App ID, private key, or an installation token.
5. Set **Homepage URL** to `https://viberivals.com` and the user authorization **Callback URL** to `https://viberivals.com/api/auth/github/callback`. A human App administrator must confirm this before the Worker `PUBLIC_ORIGIN` cutover. No setup URL endpoint is implemented; do not substitute a setup URL for the callback.
6. Install the App only on deliberately permitted repositories. The Worker still enforces accessible-installation membership and public visibility on every selection.
7. Rotate the App key or user-authorization client secret on exposure or according to owner policy.

## Callback and browser flow

Set the GitHub App **user authorization callback URL** to the exact HTTPS value:

```text
${PUBLIC_ORIGIN}/api/auth/github/callback
```

`PUBLIC_ORIGIN` must be the exact origin, without a trailing slash or path. The actual legacy origin is `https://vibecoderleague.grumpzillax.workers.dev`; its callback is `https://vibecoderleague.grumpzillax.workers.dev/api/auth/github/callback`.

The canonical VibeRivals values are:

- Homepage: `https://viberivals.com`
- User authorization callback: `https://viberivals.com/api/auth/github/callback`

The domain is officially attached to the existing Worker `vibecoderleague`, with no overrides or changeset conflicts. TLS/root HTTP 200 was verified against the existing old-brand deployment. This does **not** confirm the GitHub callback or mean this candidate was deployed. **Do not deploy the `PUBLIC_ORIGIN` cutover until human callback confirmation.** Browser access was denied and no App configuration edit capability is available; use the human settings checklist above. CTO owns the supporting migration evidence.

After cutover, legacy root/assets safe requests redirect to the canonical path without query parameters. Legacy APIs/mutations are rejected; a callback on the wrong host discards code/state and restarts login on the canonical host. Cookies and authorization transactions are host-bound. Users must sign in again; never forward code/state across hosts or accept both origins for CSRF.

The Worker directs the visitor to GitHub's authorization endpoint using the GitHub App client ID, creates a one-time 10-minute `state` record, validates and consumes it server-side, and exchanges the returned code server-side using the same GitHub App client secret. It sets an opaque secure session cookie. No token or private key appears in the callback URL or browser response. This is a GitHub App user authorization web flow, not a broad separate-OAuth-App token flow; no broad `repo` scope is requested.

This browser user token is only used to identify the visitor and enumerate repositories from their accessible App installations. The scheduled sync separately mints a short-lived GitHub App installation token from the App ID/private key and installation ID. It does not use the browser token for sync.

## Repository identity

Sync resolves a repository's immutable GraphQL `node_id` within its existing installation token scope. For the operational repository, that ID is `R_kgDOUi27Zg`; REST numeric repository ID `1378728806` is a different identifier and must not replace the stored GraphQL ID. Preserve installation IDs, consent records, PR IDs, scores, and the session encryption key. Owner/name is mutable display metadata and refreshes after verified ID-based sync. Keep the operational repository reference unchanged until rename is confirmed.

## Validation boundary

Domain attachment and a TLS/root 200 check establish routing to the existing deployment, not successful OAuth on the new origin. After human confirmation of the exact callback and the CTO-authorized cutover, run public root/assets/API smoke checks at `https://viberivals.com`, then a controlled sign-in/opt-in/sync/withdrawal journey. Verify rename/idempotence without replacing the repository or installation identity. Confirm logs contain neither tokens/private keys nor raw GitHub payloads. A GitHub 403/404 is not a reason to broaden permissions or recreate the App.
