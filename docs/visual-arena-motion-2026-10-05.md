# VibeRivals — open code arena / motion · 2026-10-05

## Candidate checkpoint — not a production release receipt

Standard frontend-only follow-up. Candidate `feat/visual-arena-motion-2026-10-05` in the supplied migration worktree. `git fetch origin` confirmed HEAD and remote default `feat/public-opt-in-leaderboard` at `9ed1ba34c89b77491822e61ddd2a56a920c66f49` (PR #6 merge). No reset, cleanup or overlapping writer was used. The pre-existing untracked `docs/visual-competition-art-release-2026-10-05.md` was preserved and excluded.

## Direction / before and after

Selected **open code arena** over two alternatives: a scoreboard-first sports poster (too little builder imagery) and a floating IDE collage (fake product UI and more visual noise). Keep real competition, AI-assisted building and the scoring disclaimer as the organizing content.

- Before: small contained rounded illustration above a rounded scoring card in the secondary column.
- After: art gets the larger 1.2fr column, a feathered edge into the hero field, two opposing cyan/violet code-lane ellipses, oversized HTML-decorative code brackets, and authored circuit paths traversing the hero background. The protocol becomes a quieter square-edged inset, not another competing tile. Title scale increases while all words/actions remain unchanged.
- Second and final background area: the first 7rem of the leaderboard transition, faded to transparent. Table/forms/podium data are not textured or animated. Participation and rules retain their existing surfaces.
- Risk/tradeoff: feathering deliberately softens raster margins, not independently moving or reinterpreting raster builders. Aesthetic boldness and exact crop require owner visual review; tests do not validate taste.

## Assets and provenance

| Path | Dimensions | Bytes | Role |
| --- | --- | ---: | --- |
| `src/frontend/competition-builders.webp` | 1200 × 800 | 62,474 | Existing original official-generated PR #6 artwork, unchanged |
| `src/frontend/arena-flows.svg` | 1440 × 760 viewBox | 982 | New hand-authored vector code-lane/circuit motif |

WebP SHA-256 `7eae15958a3134a31d5a74f29986be8f8e9f0ada00df70372c2931d6592e61cc`; SVG SHA-256 `2d31f6fe9049937d4d678a68240c058040bc9b3c84cc5dadd016bfb3bb63eec4`. Existing image generation provenance remains in `docs/visual-competition-art-2026-10-05.md`. No new image generation, stock asset, CDN, external SVG reference, photo, logo, paid service or package. The official generator is advertised but a new raster is unnecessary: this iteration reuses the approved original and authors separate transparent layers. The SVG has no text/script/image/animation and is reused at the same URL in two CSS backgrounds (no second raster download).

## Motion and accessibility contract

- Hero text entrance: 650ms, opacity .65→1 and 12px translation; never starts hidden.
- Cyan lane: 900ms, 20px entrance and -26°→-18° turn. Violet: 1100ms, opposite 20px entrance and 26°→18° turn.
- Code brackets: 800ms opacity entry with 150ms delay; separate keyframe preserves their stationary angles.
- Buttons: 180ms transform transition, 2px lift on primary hover/focus, 1px press. Podium: 3px lift on focus-within and hover-capable devices. No score/counter/data animation or layout animation.
- All entrances run once. No continuous motion, timer, scroll handler, particle loop or animation JS. Pause/offscreen/inactive-tab controls are unnecessary because there is no continuous animation; maximum entrance finishes at 1.1s.
- Motion is only enabled within `prefers-reduced-motion:no-preference`; reduced mode explicitly disables animation and transition for elements/pseudo-elements. Static lanes/brackets remain visible. No JS-disabled reveal dependency.
- Whole scene is `aria-hidden="true"`, with empty image alt and no focusable descendants; scoring/copy remain separate HTML. Native CTA/navigation/month/form semantics and focus outlines remain intact.
- Image keeps width/height attributes, 3:2 aspect ratio and high-priority single eager load. Stage reserves the same aspect ratio. No LCP image byte increase. No new JS.
- At ≤760px, one-column layout and zero stage inline negative margins. At 320–390px, the existing 16px gutters imply 288–358px image width and 192–239px height; full raster uses `object-fit:contain` and peripheral feathering, not a center-only crop. Hero contains decorative overflow. These are source calculations, **not rendered measurements**.

## Verification

Repository-native commands, no new tools installed:

1. `npm test -- test/frontend.hero-art.test.js test/frontend.behavior.test.js`: 39/39 pass; rerun after bracket-angle refinement also 39/39.
2. `npm run check`: TypeScript no-emit passes.
3. `npm test`: 116/116 pass across six files. Expected sanitized sync failure-path diagnostics only.
4. `git diff --check`: pass before and after refinement.
5. `npx --no-install wrangler deploy --dry-run`: pass, 106.22 KiB worker upload / 25.42 KiB gzip; existing D1 binding and canonical origin unchanged. This is not a deploy. Installed Wrangler 3.114.17 emits its existing out-of-date warning; no upgrade performed.
6. Asset byte/hash inspection confirms unchanged raster and small passive new vector. Shared CSS changes inspected against navigation, hidden states, podium, table, inputs and 760px cascade. Existing 33 behavioral tests cover successful interaction and recoverable errors; new tests remove the decorative scene and confirm essential HTML survives.

No lint/build script exists; check/tests plus Wrangler dry-run are the repository-supported verification. The generic repository-index/validation tools target the platform base tree, not this absolute worktree, so their unrelated suggestions were not used.

### Independent QA and rendering limitations

Current official `browser_open`, allowed origin `https://viberivals.com`, returned `execution_denied`, `retry:false`, `outcome:not_applied`. No browser session was admitted; no BEFORE/AFTER screenshots, desktop/mobile render, pixel contrast measurement, visual model review or reduced-motion rendered capture is claimed. No bypass/retry was attempted.

`review_changes` returned unavailable because its isolated git tooling targets the base workspace, not this worktree. A separate read-only QA delegation against the absolute candidate timed out after 300 seconds with no output. Neither is represented as a passed independent review. Self-review found and corrected bracket animation overriding the static rotation; focused tests were rerun. Independent QA remains a release handoff item, not a claim of visual approval.

## Publication state / continuation

Local implementation only at this checkpoint. GitHub `get_me` confirms `rapha83`; current open PR query for the expected base returned none. Change SHA is the commit containing this receipt (resolve with `git log -1 --format=%H -- docs/visual-arena-motion-2026-10-05.md`). No push/PR/merge/deploy has executed; no approval payload was reused. Production version/traffic/asset matching has not been reverified by this candidate and the previous runtime version is not proof of this change.

Next: exact candidate-SHA push approval; create PR as authenticated rapha83 to `feat/public-opt-in-leaderboard`; independent proportional QA and head checks; exact merge approval for verified head; deploy only merged SHA once to existing `vibecoderleague`, preserving D1, secrets, canonical origin and OFF cron. Record consumed approvals, PR/head/merge SHA, live version/100% traffic, HTTP status/assets hashes and smoke results in a final operational receipt, explicitly superseding this checkpoint. No backend/scoring/session/privacy/config changes are part of this candidate.

## USER_VISUAL_CHECK (owner/UAT)

At desktop and 320/390px: confirm two builders/code arena feel materially bolder than PR #6, both silhouettes remain recognizable, hero copy/CTA/protocol are clear, circuit art stops before ranking data, and no page-wide horizontal overflow occurs. Refresh with normal motion: short one-shot opposing lanes, stationary raster, no continuing loop. Enable reduced motion: immediately static scene, no hover lift. Disable JavaScript: title/actions/scoring/art remain visible (live ranking/forms retain their existing JS requirement). Keyboard-test CTA, month picker, populated podium and forms; check error/retry text and long tool/model names. Owner decides aesthetic success; this checkpoint does not assert it.
