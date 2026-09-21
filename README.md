# Vibe Coder League

A **public, opt-in monthly leaderboard** for merged GitHub pull requests from explicitly selected, currently public repositories.

- Participation and repository selection are explicit.
- A merged PR is credited once to its opted-in author in its `mergedAt` **UTC month**.
- Tooling/model attribution is optional, self-declared, and labelled **unverified**.
- Withdrawal or a repository becoming private/inaccessible removes affected contribution records from public output.

This Cloudflare Free MVP has Worker code, D1 migrations, static frontend, a dedicated D1 binding, and local tests. Production targets the existing Worker `vibecoderleague` at `https://vibecoderleague.grumpzillax.workers.dev` and its dedicated database `vibe-coder-league` (`a5fcb38c-026a-4bd3-9f93-a2822cf067b4`). GitHub App configuration is stored only as Worker secrets; cron remains disabled until a separate, evidenced end-to-end authorization and opt-in journey.

## Quick start

```sh
npm ci
cp .dev.vars.example .dev.vars # fill values locally; never commit this file
npm test
npm run check
npx wrangler d1 migrations apply vibe-coder-league --local
npx wrangler dev --local
```

## Documentation

- [Architecture](docs/architecture.md)
- [Privacy, security, and retention](docs/privacy-security-retention.md)
- [GitHub App setup](docs/github-app.md)
- [Cloudflare deployment and operations](docs/cloudflare.md)
- [Local validation](docs/local-validation.md)
- [Delivery evidence](EVIDENCE.md)

## Non-goals

Private repositories; GitHub write access; source-code, diff, patch or PR-text collection; AI detection; verified model/tool attribution or line attribution; quality/productivity claims; prizes; GitLab and Bitbucket.
