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

Expected current result: Vitest runs the security/data-boundary contract suite, including the explicit `workers_dev = true` activation assertion and the GitHub App user-authorization configuration contract. TypeScript and frontend syntax pass, all three local D1 migrations apply, Wrangler bundles without deploying and recognizes the D1 binding, and whitespace validation passes. The current Wrangler v3 CLI may print an out-of-date-version warning; that is not deployment proof.

GitHub App user authorization and Cloudflare production integration require owner-supplied secrets and a real D1 database ID. They are deliberately not validated by these local commands. Do not use production credentials in local tests. The initial public activation and smoke sequence is documented in [Cloudflare deployment and operations](cloudflare.md).
