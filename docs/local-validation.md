# Local validation

Run from the repository root:

```sh
npm ci
npm test
npm run check
node --check src/frontend/app.js
npx wrangler d1 migrations apply vibe-coder-league --local
npx wrangler deploy --dry-run
npx wrangler deployments list --name vibecoderleague
git diff --check
```

Expected current result: Vitest runs the security/data-boundary contract suite, including the explicit `workers_dev = true` activation assertion, profile/count/month behavior, bounded scheduled-sync behavior, and GitHub App user-authorization configuration contract. TypeScript and frontend syntax pass; all four local D1 migrations apply; Wrangler bundles without deploying and recognizes the dedicated D1 binding; and whitespace validation passes. The current Wrangler v3 CLI may print an out-of-date-version warning; that is not deployment proof.

Production integration uses the exact Worker `vibecoderleague` and origin `https://vibecoderleague.grumpzillax.workers.dev`. The production deployment configuration declares no cron schedule. GitHub App user authorization requires securely available App secrets and a real App installation; it is deliberately not validated by local commands. Do not use production credentials in local tests and do not follow OAuth redirects during smoke checks.
