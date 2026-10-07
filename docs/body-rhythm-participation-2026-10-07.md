# Body rhythm and participation refinement — 2026-10-07

Scoped follow-up to PR10, baseline 753c9fc73599ec68ce4854a97dea18b05ebb9dd4.
Owner requested implementation of tighter vertical rhythm and a better balanced
logged-out participation section. Changes owned by Frontend Designer: HTML/CSS
and this receipt only. Existing app.js renderer, tests, backend, hero, assets,
scoring/session/privacy, Worker/D1/origin/secrets and cron OFF are unchanged.
Three pre-existing untracked release documents preserved without staging.

## Decisions

- Body section padding now 2.5–3.5rem rather than up to 6rem, scoped by section
  IDs so the approved hero remains untouched. Ranking subheading gap tightened.
- Participation title spans both desktop columns; steps and control panel start
  on the same row, avoiding a small connection card floating beside a large title.
- Existing connection/consent explanation and optional declarations disclaimer
  now accompany the actual control panel. No invented content or capabilities.
- Grid tracks remain shrinkable; <=760px stacks heading, steps and panel in
  logical DOM order. Form IDs, labels, status regions and consent remain intact.
- No new motion/assets/dependencies; no JS writers or interaction changes.

## Checks

`npm run check`, `npm test` (136/136, six files), `git diff --check` and installed
Wrangler deploy dry-run passed. Bundle unchanged 106.22 KiB/gzip25.42 KiB.
Existing sanitized failure-path logs and outdated Wrangler warning expected.
QA Release independent read-only source review: COMPLETE, no material issues;
responsive layout, semantics/forms and hero preservation checked. QA did not
rerun tests or perform rendered inspection; command evidence is Designer-run.

## Evidence limits and final receipt location

No claimed mobile/200% visual certification. Current browser tools do not expose
viewport resize/zoom. Desktop after-deploy observation/capture and public hash
smoke will be recorded in the SAME PR's final operational body, with merged SHA,
author/head/merge UTC, consumed approval IDs/times, deployment version/traffic.
That post-merge operational receipt supersedes this pre-publication checkpoint
without requiring a second PR or altering the code SHA deployed.

Owner UAT: desktop section-to-section rhythm, balanced deslogged participation,
mobile 320–390px stacking, 200% zoom/no page overflow, control and link focus,
approved hero unchanged. No visual pass for authenticated controls is asserted.
