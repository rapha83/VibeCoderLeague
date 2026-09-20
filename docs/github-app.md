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
4. Create the OAuth client needed for browser sign-in, and store `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` in Cloudflare configuration/secrets.
5. Install the App only on deliberately permitted repositories. The Worker still enforces accessible-installation membership and public visibility on every selection.
6. Rotate the App key or OAuth secret on exposure or according to owner policy.

## Callback

Set the GitHub OAuth callback URL to the exact HTTPS value:

```text
${PUBLIC_ORIGIN}/api/auth/github/callback
```

`PUBLIC_ORIGIN` must be the owner-controlled deployed origin, with no trailing path. The Worker creates a one-time, 10-minute OAuth state record, validates and consumes it server-side, exchanges the code server-side, and sets an opaque secure session cookie. No token or private key appears in the callback URL or browser response.

## Validation boundary

A real App installation, OAuth exchange, repository scope, rate limit, and live API response were not tested because credentials were deliberately not supplied. Before public launch, run a controlled read-only check and confirm logs contain neither tokens/private keys nor raw GitHub payloads. A GitHub 403/404 is a least-privilege signal, not a reason to broaden permissions.
