# Architecture

## Runtime and storage

One TypeScript Cloudflare Worker serves both the Hono JSON API (`/api/*`) and static frontend assets from `src/frontend`. Cloudflare D1 stores the minimum required session, consent, repository-eligibility, pull-request fact, and resumable-sync state. The design fits Cloudflare Free: no queues, paid databases, or external analytics service.

The Worker uses a GitHub OAuth browser flow only to identify the visitor and enumerate repositories available through their installed GitHub App. The scheduled Worker uses short-lived GitHub App installation tokens for sync. App permissions are strictly **Metadata: read** and **Pull requests: read**.

## Public journey

1. A visitor reads public rules and a UTC-month leaderboard.
2. They connect GitHub, receive an opaque, secure session cookie, and see only server-enumerated public repositories from accessible App installations.
3. They select a repository and explicitly consent to public participation. Optional tooling/model labels are self-declared and unverified.
4. The cron job uses a fixed GraphQL field allowlist, bounded to two pages per selected repository per run, and records a continuation cursor.
5. Public output is derived from unique merged PR facts for active consent/public visibility. One merged PR credits its opted-in author in its `mergedAt` UTC month.
6. Withdrawal, loss of access, or a private/unknown repository visibility suppresses/retracts contributions.

## Data boundary

The GitHub query requests only stable PR ID, `mergedAt`, author stable ID/login/avatar, and repository ID/name/visibility. It does not request code, Contents, diffs, patches, PR title/body, files, review text, or full upstream payloads. D1 stores no PR content.

OAuth access tokens are retained only as AES-GCM encrypted session data for the active 8-hour browser session so the user can enumerate eligible repos; session lookup stores only a SHA-256 cookie-token hash. GitHub App installation tokens are short-lived and held only in memory during sync. No token or private key is logged.

## Correctness and failure policy

`pull_requests.pr_id` is a unique stable identity. Sync derives counts from those rows rather than incrementing counters, so a replay is idempotent. Completion uses generation cleanup; partial runs continue using D1 cursor state. GitHub ambiguity changes visibility to `unknown`, which fails closed by excluding the consent from public reads until a later successful sync.
