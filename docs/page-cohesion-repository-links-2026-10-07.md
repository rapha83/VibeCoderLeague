# Page cohesion and public repository links — 2026-10-07

## Candidate checkpoint (not a published-release receipt)

Frontend implementation passed independent QA Release review (COMPLETE, no
MUST gaps) and awaits gated publication.
No push, PR creation, merge or deployment was performed by this frontend stage.
No approval was requested or consumed by this stage. PR author/head/merge UTC,
merged SHA, approval IDs/payload hashes/consumption UTC and active deployment
version/traffic must be supplied by the publishing stage after those actions.
Do not treat the previous deployment version as this candidate's release.

Reconciled baseline: `bda7115` on
`feat/page-cohesion-repository-links-2026-10-07`. Two pre-existing untracked
release documents were preserved without staging or edits. No reset/cleanup.

## Section decisions

- **Hero:** preserve markup, illustration, backgrounds and existing finite entry
  animations exactly. No new assets and no additional hero styles.
- **Leaderboard / podium:** a ruled section header and contained UTC selector
  separate season control from results. Sharper, left-aligned podium cards make
  names and declarations easier to scan. A single real participant occupies a
  full-width desktop result rather than a lone center card; no fake competitors.
  Table headers and keyboard-focused rows have deliberate surface contrast.
- **Public profile:** retain its route, public API schema, data and totals;
  align its panel and statistics spacing with the controls surface.
- **Rules:** replace a second generic boxed panel with an open briefing. Rules
  remain service-provided, separated by quiet rules, without invented content.
- **Participation / controls:** numbered steps have shared rhythm; the actual
  controls panel has a named heading, restrained depth and a consent grouping.
  Withdrawal remains distinct from sync and clearly labeled, not emphasized as
  the next primary action. All existing session/error/consent behavior retained.
- **Footer:** compact brand and opt-in reminder paired with real in-page
  navigation to ranking, rules and participation. Stacks on narrow screens.

## Motion rationale and provenance

No continuous loop was adopted. The approved arena entrance already establishes
the competition's character; beneath it, people are reading scores, comparing
repositories and choosing consent. Persistent orbital movement would compete
with those tasks rather than add meaningful continuity. Composition, typography,
surfaces and spacing carry the hero-to-body transition instead. Existing finite
hero animations and reduced-motion override are unchanged. No new timers,
observers, animation dependencies or moving data/CTAs were added.

## Link contract and security

The current public leaderboard returns `repository` via
`GROUP_CONCAT(DISTINCT pr.repo_name)` with a comma separator. Valid GitHub owner
and repository components cannot contain commas, making valid full-name tokens
unambiguous. Validate every token before linking any token; malformed or mixed
payloads remain safe plain text. No trim-based guessing or arbitrary URL parsing.

Owners: 1–39 ASCII alphanumeric/hyphen characters, alphanumeric endpoints, no
consecutive hyphens. Repository: 1–100 ASCII alphanumeric/dot/underscore/hyphen
characters, excluding `.` and `..`. All whitespace is rejected, including final
newlines that could otherwise match a JavaScript `$` anchor. URLs are constructed
from the fixed `https://github.com/` origin and separately encoded components.
Text uses DOM `textContent`; no raw HTML/href interpolation. Every repository
receives its own underlined, keyboard-focusable link with `View owner/repo on
GitHub` accessible name. Links use the same tab (no new-window announcement or
opener risk). Podium and Repository cells share the same renderer.

No API/SQL/backend changes, GitHub per-row requests, consent/filter changes,
secrets/repository IDs or score/order changes. Public/withdrawn/private behavior
remains covered by the existing integration suite.

## Commands and checks

Actual candidate results:

- `npm run check`: pass (`tsc --noEmit`).
- `node --check src/frontend/app.js`: pass.
- `npm test`: **136/136 tests, six files passed**. Frontend behavior: 53 tests;
  hero integrity: six tests. New cases cover single/multiple repositories,
  malformed aggregate segments, HTML characters, unsafe protocols, URL/query/
  fragment/encoded-separator attempts, whitespace, missing/schema fallbacks,
  focusability, accessible names, unchanged score and no external row fetches.
- `git diff --check`: pass.
- Installed Wrangler `3.114.17`, `wrangler deploy --dry-run --outdir
  /tmp/viberivals-page-cohesion-2026-10-07-bundle`: pass. Worker bundle 106.22 KiB,
  gzip 25.42 KiB; same `vibecoderleague`, PUBLIC_ORIGIN and D1 binding. No upload,
  database mutation/migration, cron or dependency update. Existing Wrangler
  outdated-version warning is informational; failure-path test logs expected.

Independent QA Release reviewed this exact worktree/diff via `converse` on
2026-10-07: **COMPLETE, no MUST gaps**. QA independently reran the full 136 tests,
typecheck, JS syntax check and `git diff --check bda7115`, all passing. It verified
safe links, hero integrity, unchanged scoring/privacy, responsive rules and
keyboard affordances. No rendered mobile/zoom aesthetic certification. Earlier
root-bound `review_changes` and capacity-rejected delegation were superseded by
this successful independent review; they are not current blockers.

## Assets and static/rendered evidence

No asset additions. `arena-flows.svg`: 982 bytes, SHA256
`2d31f6fe9049937d4d678a68240c058040bc9b3c84cc5dadd016bfb3bb63eec4`.
`competition-builders.webp`: 62,474 bytes, SHA256
`7eae15958a3134a31d5a74f29986be8f8e9f0ada00df70372c2931d6592e61cc`.

Current browser admission **succeeded**, so previous browser-denied reports do
not apply. Official canonical site navigation returned HTTP 200. Before-change
desktop capture at 1280×800: hero observation
`eb1ea9be-2713-40f1-8e1c-35d0c8b88df0`, screenshot SHA256
`c7c433243d48ba2a959772c5d36349cf27cfb4c819e5dd3a43e0bbb3349545d9`;
body at scroll y=780 observation `0b48446f-be00-4b78-a80e-452e93ac880a`, SHA256
`2e0ecfee3dd3a888581fedfbf5934f465a5c1d7c27a068af8fed09f163468a0b`.
The transport returned ephemeral-image metadata, not a persistent screenshot
file, so these are capture facts rather than proof of visual aesthetic review.
DOM observation showed one real participant, `rapha83/VibeRivals`, score eight,
and the existing plain-text repository. No participants were created.

Candidate after-render, mobile screenshots and 200% browser zoom were **not
verified** in this frontend stage. Static CSS review: minmax(0,…) grid tracks,
mobile stacking at 760px, break-anywhere long names, local horizontal table
scroll region, no new fixed page widths, and unchanged reduced-motion behavior.
JS-disabled fallback explicitly explains live-data/control dependency instead
of suggesting enrollment occurred. Asset-blocked hero text remains intact.
Build and happy-dom checks are not visual passes. Browser close returned
`session_not_found`; no cleanup effect was retried.

## Next owner / precise UAT

Publication: independent QA passed; next is one gated coherent PR authored
by `rapha83`, normal frozen-head merge to real default branch and deploy only
that merged SHA. Append the PR/approval/deploy/smoke facts above, replacing this
checkpoint status with a final operational receipt. Preserve Worker, origin,
D1/secrets, Free plan and cron OFF. Do not promise points or create test users.

Owner visual check after authorized deployment: inspect the whole desktop and
320–390px page, 200% zoom, approved hero unchanged, single and multi-person
podium balance, ranking link legibility/focus, local table scrolling without
page overflow, public profile, open rules, consent/withdrawal hierarchy and
footer. Open each actual public Repository link and confirm its GitHub path.
Check reduced-motion/static presentation and keyboard navigation. Aesthetic
judgment remains the owner's UAT; no aesthetic pass is asserted here.
