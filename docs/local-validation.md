# Local validation

Run from the repository root:

```sh
npm ci
npm test
npm run check
node --check src/frontend/app.js
npx wrangler d1 migrations apply vibe-coder-league --local
npx wrangler deploy --dry-run
git diff --check
```

Expected current result: Vitest runs the security/data-boundary contract suite, including the explicit `workers_dev = true` activation assertion, profile/count/month behavior, bounded scheduled-sync behavior, and GitHub App user-authorization configuration contract. TypeScript and frontend syntax pass; all four local D1 migrations apply; Wrangler bundles without deploying and recognizes the dedicated D1 binding; and whitespace validation passes. The current Wrangler v3 CLI may print an out-of-date-version warning; that is not deployment proof.

GitHub App user authorization and Cloudflare production integration require securely available App secrets, a real App installation, and an approved exact `workers.dev` origin. They are deliberately not validated by these local commands. Do not use production credentials in local tests. The current requested `grumpuzillax` origin is unavailable because the confirmed account is already configured with a different Workers subdomain; see [Cloudflare deployment and operations](cloudflare.md).
