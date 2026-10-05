# VibeRivals migration — 2026-10-05

## Scope and checkpoint

Migration of public brand/origin; optional repository rename. Existing Worker `vibecoderleague`, dedicated D1 `vibe-coder-league` / `a5fcb38c-026a-4bd3-9f93-a2822cf067b4`, secret identities and encryption key preserved. No cron, paid plan, new permissions or new datastore.

Official Cloudflare account metadata uniquely identified active zone `viberivals.com` (`e904c01afe472c98f4448b644a196850`). Canonical candidate: `https://viberivals.com` (apex; no additional www binding). Direct DNS record listing returned HTTP 403; DNS absence was NOT inferred from that error. Official Wrangler Custom Domain changeset preview returned one addition and zero updated, removed or conflicting entries, establishing a non-conflicting apex binding.

Custom Domain attached 2026-10-05 after approval `adcbfc71-d0a4-4ee1-a897-efbb127f4a2b` was consumed with authorized=true. Exact operation: PUT existing Worker domains/records; override_scope=false, override_existing_origin=false, override_existing_dns_record=false. API returned success=true, domain ID `f9fb3d297c09ec2cd73bc1d82a165a43e8f0c2b1`, certificate ID `0a85f436-4f16-415e-b760-24884fb91af9`, enabled=true, service=vibecoderleague. Binding is preparation, NOT evidence of new branding deployment or completed OAuth.

## Candidate reconciliation

Authenticated GitHub login: `rapha83`. Repository numeric ID: `1378728806`. Default branch remains `feat/public-opt-in-leaderboard`; no change to default branch.

Remote base fetched: `a051d475586bde0cb17fe2062ee52bffa91b39c8` (merged docs PR #2). Existing local published code `60757750615f50031f107d4077eb678b53b8edc0` has merge base `fcd8fb00fb78e61d53af1c8a06c6974537d89617`. Candidate worktree `VibeRivals-migration-2026-10-05`, branch `migration/viberivals-2026-10-05`, reconciles both histories in local merge `a0a9815a7356e28bb56c2274e9b15c7a47cb1139`. Original worktree and isolated README worktree, including untracked artifacts, untouched. No untracked source copied into candidate.

## OAuth activation prerequisite

Required new callback: `https://viberivals.com/api/auth/github/callback`. Homepage: `https://viberivals.com`. Add callback while retaining old callback during preparation; no wildcard matching or permission changes. Setup URL only if an actual implemented installation-return flow supports it. Browser access was denied; no official settings-write API capability is available. Human confirmation of registered callback is required before publishing the new PUBLIC_ORIGIN. No user login/session/consent was synthesized. Host-only cookies do not transfer: human must reconnect after origin cutover.

## Official references inspected

- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/update/
- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-user-authorization-callback-url
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app

## Pending evidence

Frontend/backend implementation and proportional regression checks in progress. PR URL/author/frozen head/base/merge SHA, merged deployment version/traffic, canonical redirects/assets/API/TLS and human reconnection/sync/score evidence will be recorded when actually observed. Existing production version reported by task: `7216e296-7f7b-41aa-bda0-f8c127e3b8d6`; not yet revalidated in this checkpoint. Repo rename is optional and not performed; target repo GET returned 404, which is not a guarantee a rename will succeed.

## Backout

Restore previous merged code and old PUBLIC_ORIGIN by normal governed deployment if cutover fails; preserve database and encryption key, no DB rollback/delete. Remove only task-owned custom-domain binding if needed through a separately authorized external operation. Keep old OAuth callback registered until human new-origin journey succeeds. Never forward OAuth code/state between origins.

## Integrated implementation verification

CTO reran typecheck, complete suite (5 files, 109 tests passed), diff whitespace validation and Wrangler 3.114.17 dry-run successfully. Bundle 106.22 KiB / gzip 25.42 KiB. Installed schema accepts assets.run_worker_first=true. Canonical/exported-worker tests cover legacy root/assets/API/callback without code/state forwarding; exact-origin CSRF retained. GitHub GraphQL reads use immutable node ID (`R_kgDOUi27Zg` for this repo), never numeric REST ID, and lease-protected verified-name refresh preserves score/consent/installation identity across rename and duplicate sync.

Live domain preparation smoke: HTTPS HEAD root returned 200 with valid TLS; `/api/health` returned 404 (no health endpoint, not an application failure). Existing deployment independently revalidated as version `7216e296-7f7b-41aa-bda0-f8c127e3b8d6`, created 2026-10-05T00:47:28.821Z, deployment at 00:47:30.113Z, 100% traffic. This is OLD branding/code and does not prove migrated origin/login readiness.

Frontend has VibeRivals brand, exact subtitle, AI/tool/model focus, canonical/social metadata, transparent 1 eligible merged PR = 1 point monthly UTC. Existing visual identity and tool/model behavior retained. Rendered browser access denied; user visual review remains required.
