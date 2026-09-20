# GitHub App setup (owner-run)

This is a setup checklist, not evidence that an App exists. The owner must perform it in the intended GitHub account/organization and supply the resulting configuration through Cloudflare secrets.

## Required permissions

Configure only:

- **Repository permissions → Metadata: Read-only**
- **Repository permissions → Pull requests: Read-only**
- **Contents: no access**
- **Webhooks:** not required; do not enable one for this MVP

Install the App only on chosen repositories; do not grant organization-wide access by default. Do not add issues, actions, checks, deployments, members, administration, or any write permission.

## Owner checklist

1. Create the GitHub App in an owner-controlled account/organization.
2. Set the permissions above and leave webhook delivery disabled.
3. Generate the App private key once; store it only as the `GITHUB_APP_PRIVATE_KEY` Cloudflare secret. Never commit, paste, or log it.
4. Enable the GitHub App's user authorization web flow and use **that App's** client ID and client secret for `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`. Do not create or use a separate OAuth App, and do not substitute the App ID, private key, or an installation token.
5. Set the GitHub App's user authorization callback URL to the exact deployed HTTPS origin plus `/api/auth/github/callback`, as described below.
6. Install the App only on deliberately permitted repositories. The Worker still enforces accessible-installation membership and public visibility on every selection.
7. Rotate the App key or user-authorization client secret on exposure or according to owner policy.

## Callback and browser flow

Set the GitHub App **user authorization callback URL** to the exact HTTPS value:

```text
${PUBLIC_ORIGIN}/api/auth/github/callback
```

`PUBLIC_ORIGIN` must be the owner-controlled deployed origin, with no trailing path. For initial Free-plan activation, this is the exact `https://vibe-coder-league.<account-subdomain>.workers.dev` URL reported by Wrangler; configure it before attempting browser sign-in.

The Worker directs the visitor to GitHub's authorization endpoint using the GitHub App client ID, creates a one-time 10-minute `state` record, validates and consumes it server-side, and exchanges the returned code server-side using the same GitHub App client secret. It sets an opaque secure session cookie. No token or private key appears in the callback URL or browser response. This is a GitHub App user authorization web flow, not a broad separate-OAuth-App token flow; no broad `repo` scope is requested.

This browser user token is only used to identify the visitor and enumerate repositories from their accessible App installations. The scheduled sync separately mints a short-lived GitHub App installation token from the App ID/private key and installation ID. It does not use the browser token for sync.

## Validation boundary

A real App installation, user authorization exchange, repository scope, rate limit, and live API response were not tested because credentials were deliberately not supplied. Before public launch, use the deployed `workers.dev` origin to run the documented public smoke checks, then test one controlled sign-in/opt-in/withdrawal journey. Confirm logs contain neither tokens/private keys nor raw GitHub payloads. A GitHub 403/404 is a least-privilege signal, not a reason to broaden permissions.
