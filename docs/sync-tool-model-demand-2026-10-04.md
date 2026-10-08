# Sync + Tool/Model direct demand — 2026-10-04

## Candidate and authority
New direct standard demand; no old managed delivery/workflow/job resumed.
Repo `/Users/openclaw-bot/Documents/GrumpyzillaSoftwareLab/worktrees/VibeCoderLeague`, branch `feat/public-opt-in-leaderboard`, base HEAD `77f33046d703f41727f84b564adb58b42397591f`. Existing artifacts preserved. Changes local/uncommitted. No push/deploy, production mutations, secrets rotation, migration, permissions, cron or paid services.

## Previous checkpoints (2026-10-04)
Official deployments list reconciled version `a5c22ca5-87c4-4e2b-8eab-d6db9741f185` at 100%, deployed 21:07:15.046Z.
Background capability checked once: denied by repository verification prerequisite; no detach workaround. Foreground bounded official tail connected 22:08:50Z and stopped 22:09:07Z with no sync events. `docs/sync-tool-model-tail-2026-10-04.sanitized.jsonl` contains allowlisted capture lifecycle records only. Sanitizer discarded raw logs through a `.log` symlink to `/dev/null`; no raw logs persisted.
Historical reference `e672503e-b4d1-4952-b844-213ed937a815` was not retrieved; no stage/category/status or retroactive causal attribution is claimed.
Tool/model implementation originally modified six code/test files, 183 insertions /13 deletions. Historical tracked diff hash `a55612e0e8179566d032b76159b28cbcbcbae209e8a7f208ff445fcc94d7f9c2` identifies that checkpoint only, NOT the subsequent auth correction.
CTO executed full check/test/diff-check twice: PASS82/82 across four files. Independent QA local PASS by source/test review, execution attributed CTO. Receipts `docs/tool-model-api-2026-10-04.md`, `docs/tool-model-frontend-2026-10-04.md`, `docs/qa-sync-tool-model-2026-10-04.md` remain preserved.

## Tool/model implementation preserved
Leaderboard rows add `declarations:{status:'self_declared_unverified',tooling:string[],models:string[]}` solely from current active public consents, independently aggregated to prevent score multiplication. Count/order/UTC month/tiebreak and row limit unchanged. No snapshots/inference/PR-month attribution; missing arrays rendered Not informed.
Accessible editable tooling combobox includes Codex, Claude Code, Antigravity, Nimrava, OpenClaw, Hermes, Pi, OpenCode plus recognized suggestions Cursor, GitHub Copilot, Aider, Cline, Roo Code, Devin Desktop (formerly Windsurf). Optional/no default; Other/custom and Not informed; free/legacy strings preserved; Model independent. Tool and Model shown on list and top3, labeled current/self-declared/unverified by PR. Keyboard navigation, safe text and responsive long-value handling implemented.
Sources: https://cursor.com/, https://github.com/features/copilot, https://aider.chat/, https://cline.bot/, https://github.com/RooCodeInc/Roo-Code, https://devin.ai/desktop, https://devin.ai/blog/windsurf-is-now-devin-desktop. Official Devin Desktop FAQ confirms rename. Saved Windsurf values never rewritten. Roo Code remains recognized legacy suggestion, not current availability recommendation. No quantitative popularity claim.
Coverage includes distinct/duplicate/current declarations, long/custom/legacy/empty values, score/order/month invariants, private/unknown/inactive/withdrawn exclusion, keyboard and fresh-page API-backed persistence rendering. Synthetic warning diagnostics are fixtures, never live events. Unsaved drafts/form hydration not added.

## 2026-10-05 — authenticated evidence and official metadata
Human supplied at00:10Z: `error:sync_unavailable`, top category `upstream_or_persistence`; diagnostic `stage:installation_token,category:http_error,status:401,correlationId:f1fa8ff7-b298-4f81-9dad-fe9ea3dbb3ee`.
401 is the upstream diagnostic status; external `/api/sync` HTTP status was not supplied. It localizes rejection before PR collection/D1, without proving wrong key/App pairing by itself.
CTO executed official foreground commands against exact Worker/config:
- `wrangler secret list --name vibecoderleague --config /Users/openclaw-bot/Documents/GrumpyzillaSoftwareLab/worktrees/VibeCoderLeague/wrangler.toml`
- `wrangler versions view a5c22ca5-87c4-4e2b-8eab-d6db9741f185 --name vibecoderleague --config /Users/openclaw-bot/Documents/GrumpyzillaSoftwareLab/worktrees/VibeCoderLeague/wrangler.toml`
Both returned ONLY names for secrets: GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_APP_PRIVATE_KEY, SESSION_ENCRYPTION_KEY_BASE64. Version metadata vars contain only PUBLIC_ORIGIN; GITHUB_APP_ID is absent from both secrets and vars. Origin and D1 metadata match the authorized candidate. Secret values were never requested/read/printed; presence does not prove validity or pairing.

## Demonstrated defect and minimal correction
Inspected code passed `env.GITHUB_APP_ID` directly to signing in both manual and scheduled sync. Given absent binding, value is undefined; JSON.stringify omits `iss`. This is a demonstrated configuration/code mismatch and strong causal candidate for the401, not authenticated live proof of resolution.
`src/github.ts` now has shared `resolveGitHubAppIssuer`: nonblank trimmed legacy App ID first, otherwise existing Client ID. Both are officially accepted; Client ID is recommended. Neither => safe configuration_error before mint/fetch. `installationToken` also independently rejects missing/blank issuer before import/sign/fetch. `src/worker.ts` makes App ID optional and both callers use resolver. Tool/model changes retained.
RS256 signature, base64url, PKCS#8 parser and timing are unchanged: iat=epoch seconds-30, exp=now+510. GitHub recommends backdating60 seconds, but observed evidence does not establish skew or justify speculative timing changes. PKCS#1, literal-backslash-newline and invalid DER fail locally with configuration_error, not upstream401. Tests verify this distinction. Host UTC observation does not certify deployed runtime skew.
Official sources consulted this turn:
https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app
Endpoint verified POST /app/installations/{installationId}/access_tokens, Bearer App JWT. No permission, collection, D1 or OAuth changes.
Detailed followup and before/after regression: [sync-app-auth-followup-2026-10-05.md](sync-app-auth-followup-2026-10-05.md). Implementer reported3 missing/blank issuer tests fail before correction; all pass after. New `test/github-app-auth.test.ts` uses ephemeral keys and independently verifies signature and claims; no actual JWT/header/PEM logged.

## Final local validation after auth correction
CTO independently inspected actual auth diff and executed:
- `npm --prefix /Users/openclaw-bot/Documents/GrumpyzillaSoftwareLab/worktrees/VibeCoderLeague test`: PASS100/100, five files (15auth,13GitHub sync,16security,31frontend,25worker).
- same prefix `run check`: PASS tsc--noEmit.
- `git -C /Users/openclaw-bot/Documents/GrumpyzillaSoftwareLab/worktrees/VibeCoderLeague diff --check`: PASS.
Independent QA Release reviewed actual implementation/callers and executed auth+worker tests: PASS40/40, two files; type check PASS. Verdict PASS local tested worktree, not immutable HEAD or live GitHub certification. Missing issuer, fallback/legacy precedence/fail-closed, supported PEM, claims/signature, sanitized401 and retained leaderboard behavior covered. Independent scoped completeness review reported COMPLETE.
Platform repository verified-outcome promotion is fenced (`terminal_target_discovery_unavailable`); concrete tool results above returned successfully, but no durable learning/workflow verified-outcome certification is claimed. No bypass.

## Remaining release boundary and human verification
Local correction validated. No push/commit/deploy or human session operation performed. Publication requires exact approval/gate for this new candidate, including Tool/model and auth correction; no prior authorization reused. Live sync is NOT yet declared resolved.
After authorized release, human retries Sync in their own session. If rejected, return ONLY HTTP status and diagnostic(stage/category/status/correlationId), never HAR/headers/tokens/cookies/OAuthURL. If401 persists, check in GitHub App settings: intended App identity, active private key belongs to the same App (do not share values), selected installation belongs to that App; check Cloudflare correct Worker/environment binding association. No automatic rotation or new permissions. Missing binding alone does not establish key intervention necessary.
No rendered browser/screen-reader/device verification. USER_VISUAL_CHECK: arrows/Enter/Escape/Tab and announcements; save custom/legacy tool with unrelated model then refresh and inspect both ranking surfaces;320–390px/200% zoom long wrapping and table-only scroll.
Existing public cache60 seconds preserved; no immediate cached-response revocation promise. No new claim of active deployment version beyond metadata query; no candidate publication occurred.
