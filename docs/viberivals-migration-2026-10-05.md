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

## PR/merge receipt — post-merge local checkpoint

PR https://github.com/rapha83/VibeCoderLeague/pull/3 authored by `rapha83`, created 2026-10-05T02:25:02Z. Frozen head `7c59ad9b2fd1962155337fa373bcb2efb20f3f55`, base `a051d475586bde0cb17fe2062ee52bffa91b39c8`, exact official compare merge base=base, status=ahead, 22 changed files. No GitHub check runs existed; no bypass/false check was used. Independent QA PASS for merge only, with 109 tests/typecheck/dryrun and source review; deployment explicitly excluded.

Real normal merge executed with expected frozen head and merge method=merge. GitHub returned merged=true, merge SHA `7e542bcf586fd5493b243fcd580b28b6c1619a86`. Official PR reread confirms author/merged_by `rapha83`, merged_at/closed_at `2026-10-05T02:29:08Z`. Candidate fast-forwarded to that actual remote merged SHA. Push approval `d065ba80-ca7d-4f14-bad7-edca0f93a708` consumed authorized=true; concrete GitHub PR/merge tools executed through runtime policy.

No new-origin deployment executed: hard blocker is human confirmation that existing GitHub App registers new callback/home URLs. Runtime remains version `7216e296-7f7b-41aa-bda0-f8c127e3b8d6` at 100%. Repo rename deferred until rename-safe merged code is actually deployed. No points claimed: human reconnection and sync must verify PR #2 and PR #3 current-UTC ranking without duplicates. This post-merge receipt remains a local checkpoint for next legitimate docs PR, not an extra points-farming PR.

Durable Board handoff: `0ee69e82`, needs_input. Resume same candidate, no recovery fork. Obtain callback confirmation, request exact merged-SHA deployment gate, publish merged SHA, verify TLS/root/assets/API/canonical oldhost/OAuth redirect, then human UAT. Repo rename optional with separate precise gate only after safe runtime is active.

## Activation and repository rename — 2026-10-05 after 12:52Z confirmation

Earlier pending/deployment-gated sections above are historical checkpoints, superseded by this activation receipt. Raphael confirmed the existing GitHub App homepage `https://viberivals.com` and callback `https://viberivals.com/api/auth/github/callback` at 2026-10-05T12:52Z. No agent login, user session or consent was synthesized.

Before publishing, official remote default-branch HEAD and candidate HEAD both equalled merged SHA `7e542bcf586fd5493b243fcd580b28b6c1619a86`. Only this receipt was modified; application/config/assets remained at the merged SHA. Prior implementation and QA jobs were completed; process-list inspection was OS-denied, so no claim of a full host process inventory is made. GitHub authenticated login revalidated as `rapha83`.

Exact deployment approval `7241fefa-f8ea-4559-bf5f-9559db517c66` was consumed with authorized=true before `npx --no-install wrangler deploy` on this candidate. One deployment was executed (a background-tool refusal occurred before execution; foreground command then ran once). Worker version `6e20d6e5-ae93-4017-a20d-010ee47f90d0` created `2026-10-05T12:56:54.052Z`, deployed `2026-10-05T12:56:55.402Z`, independently listed at 100% traffic. Bundle 106.22 KiB / gzip 25.42 KiB. PUBLIC_ORIGIN `https://viberivals.com`; same Worker, dedicated D1 ID, secret configuration and no cron. No migration or manual D1 mutation was executed.

Live HTTPS smoke using curl: TLS verification result=0 on every checked URL; canonical root, app.js, styles.css, rules, unauthenticated session and October leaderboard all HTTP 200. Root contains VibeRivals and The vibe coding competition. Session reports authenticated=false. Old workers.dev root/assets return 308 to matching canonical paths, without query. Old-host API returns 421. Old-host callback returns 303 to fixed `https://viberivals.com/api/auth/github`, without query. New-host auth returns 302 to GitHub authorization with sanitized configured redirect_uri exactly `https://viberivals.com/api/auth/github/callback`. No OAuth code/state/cookie values, credentials or raw headers were persisted. Python urllib probes received edge 403; curl probes succeeded, so this was a client-specific probe limitation, not evidence of application failure.

After safe runtime activation, rename approval `6493dcf3-515f-4bc3-b7a4-19b6486c2bc4` was consumed with authorized=true before official PATCH repos/rapha83/VibeCoderLeague body name=VibeRivals. Result and subsequent GET by immutable ID confirm `https://github.com/rapha83/VibeRivals`, numeric ID `1378728806`, node ID `R_kgDOUi27Zg`, and unchanged default branch `feat/public-opt-in-leaderboard`. No replacement repository or permission/installation change was made. Shared git origin is now `https://github.com/rapha83/VibeRivals.git`; verified in candidate, original source worktree and isolated README worktree. Existing paths/branches/untracked files were not renamed/reset/cleaned.

PR #2 and #3 official metadata now use `/VibeRivals/pull/2` and `/VibeRivals/pull/3`; old public URLs return 301 to those exact new URLs. Both remain merged and authored by rapha83. Rename-safe application sync resolves GitHub repository node ID rather than relying on redirect/name. No post-rename authenticated sync or persistence outcome is claimed.

Remaining acceptance is human-owned: reconnect on the new host, review/retain consent and selected renamed repository, Sync, verify October 2026 PR #2/#3 points and unchanged results on repeated Sync; review profile/ranking, responsive page, keyboard/combobox and podium. The public smoke is not authenticated or visual UAT. Keep old App callback until the new-host journey succeeds. Backout remains normal governed old-code/origin deployment with the same D1/key, never DB rollback; repository rename back would require a separate precise approval. Installed Wrangler 3.114.17 warns outdated but deployed successfully; no upgrade or added cost was introduced.
