# VibeRivals

A **public, opt-in monthly leaderboard** for merged GitHub pull requests from explicitly selected, currently public repositories.

- Participation and repository selection are explicit.
- A merged PR is credited once to its opted-in author in its `mergedAt` **UTC month**.
- Tooling/model attribution is optional, self-declared, and labelled **unverified**.
- Withdrawal or a repository becoming private/inaccessible removes affected contribution records from public output.

This Cloudflare Free MVP has Worker code, D1 migrations, static frontend, a dedicated D1 binding, and local tests. The canonical repository is [rapha83/VibeRivals](https://github.com/rapha83/VibeRivals) (clone with `git clone https://github.com/rapha83/VibeRivals.git`); its default branch is `feat/public-opt-in-leaderboard`. Production home is **https://viberivals.com**. The published Worker remains `vibecoderleague` and its dedicated database remains `vibe-coder-league` (`a5fcb38c-026a-4bd3-9f93-a2822cf067b4`). GitHub App configuration is stored only as Worker secrets; cron remains disabled until a separate, evidenced end-to-end authorization and opt-in journey.

## Canonical origin and OAuth status

The `https://viberivals.com` deployment is live: version `6e20d6e5-ae93-4017-a20d-010ee47f90d0` received 100% traffic after deployment at `2026-10-05T12:56:55.402Z`. A human App administrator confirmed the canonical homepage and OAuth callback settings at 12:52Z. Live publication and configured OAuth are not completion of user acceptance: human authenticated and visual UAT is still pending. CTO owns the supporting migration evidence; see the [migration record](docs/viberivals-migration-2026-10-05.md).

The existing GitHub App's **General** settings (personal owner: `https://github.com/settings/apps/<app-slug>`; organization owner: `https://github.com/organizations/<owner>/settings/apps/<app-slug>`) are configured as confirmed by the human App administrator:

- Homepage URL: `https://viberivals.com`
- Callback URL: `https://viberivals.com/api/auth/github/callback`

The App owner/slug cannot be inferred from the client ID here; use the existing App rather than creating another App. No setup URL endpoint is implemented, so do not configure a setup URL as a substitute for the OAuth callback. Keep permissions, installations, repository IDs, consents, PR IDs, scores, and the session encryption key unchanged.

All requests, including static assets, reach the Worker first. Off-origin root/assets GET/HEAD requests redirect to the canonical path without a query; off-origin APIs and mutations are rejected. An off-origin callback discards code/state and restarts login at the fixed canonical authorization endpoint. Sessions are host-bound, so users sign in again on the new host; the old origin is not accepted for CSRF. Local development retains the localhost override in `.dev.vars.example`.

Repository sync resolves immutable GitHub node IDs with the selected installation's token, not stored owner/name. Verified current names refresh the participant's consent and PR display metadata under the sync lease; rename does not create a new consent or retract contributions. Transport/GraphQL/shape errors remain retryable failures, not evidence that a repository is private/inaccessible.

## Ranking eligibility and manual validation

A contribution counts only when the PR is **merged**, its GitHub PR author has opted in, and its repository is explicitly selected and currently public. The merge timestamp determines the UTC ranking month; commit authors, the person who merges, standalone commits, and deployments do not earn points. Each eligible PR contributes one point, and repeating a sync must not count the same PR again.

After a real contribution is merged, sign in as the participant, confirm participation and repository selection, then click **Sync now**. View the ranking for the merge's UTC month; allow up to 60 seconds for the public cache to refresh. An empty ranking can be expected when there are no eligible merged PRs, even if commits or deployments already exist.

A useful documentation PR can validate ingestion and a one-point entry. This is a legitimate documentation/validation contribution, not evidence of productivity, quality, or a three-person podium; those require separate evidence. The application uses read-only GitHub access and does not create or merge PRs for participants.

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
