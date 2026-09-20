# Local validation

Run from the repository root:

```sh
npm ci
npm test
npm run check
node --check src/frontend/app.js
npx wrangler deploy --dry-run
git diff --check
```

Expected current result: Vitest runs six security/data-boundary contract tests, TypeScript and frontend syntax pass, Wrangler bundles without deploying and recognizes the D1 binding, and whitespace validation passes. The current Wrangler v3 CLI may print an out-of-date-version warning; that is not deployment proof.

For local D1 setup:

```sh
npx wrangler d1 execute vibe-coder-league --local --file migrations/0001_initial.sql
```

GitHub OAuth/App and Cloudflare production integration require owner-supplied secrets and a real D1 database ID. They are deliberately not validated by these local commands. Do not use production credentials in local tests.
