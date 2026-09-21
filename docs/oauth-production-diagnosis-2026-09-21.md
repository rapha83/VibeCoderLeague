# OAuth production diagnosis receipt — 2026-09-21

## Scope and safety

This is a sanitized production diagnosis receipt for the single Worker named `vibecoderleague`. It contains no secret values, OAuth callback URLs, authorization codes, states, cookies, tokens, PEM material, raw exceptions, upstream response data, or request/response header values.

No D1 data, secret, origin configuration, cron configuration, GitHub App configuration, consent, synchronization, or callback completion was intentionally changed during this diagnosis. The one permitted initiation-only smoke request did not follow a redirect or perform user authentication.

## Immediate control-plane snapshot

Observed at 2026-09-21T15:54Z:

| Item | Sanitized observation |
| --- | --- |
| Target Worker | `vibecoderleague` only |
| Active traffic allocation | 100% to version `1e8d5f2b-a837-43d9-8b92-0fbc6adba840` |
| Active deployment creation time | 2026-09-21T15:53:34Z |
| Active deployment provenance | Cloudflare Dashboard deployment triggered by a secret update; no source commit annotation was available |
| Prior control-plane deployment sources observed | Dashboard, Wrangler, and dashboard-template uploads; no connected-repository deployment was identified in the retained deployment list |
| Candidate source head | `23abd48f72978b85c65a25f7f4d14aae1e0ab5f8` on `feat/public-opt-in-leaderboard` |
| Diagnostic candidate commit | `c26bcbb1cd00fb56d4c720a606e73832c65d2e1f` |
| D1 binding | Present and unchanged in active-version metadata |
| Production-origin binding | Present and unchanged in active-version metadata |
| Cron | No configured trigger declaration in candidate configuration; active version reports only fetch and scheduled handlers, not a configured cron schedule |

## Source and active-artifact comparison

`c26bcbb1` is an ancestor of the current candidate head. Its callback source catches failures after token exchange at three internal boundaries, but emits its diagnostic stage and correlation identifier as response headers while retaining the exact bare JSON body `{ "error": "oauth_completion_failed" }`.

The owner observed exactly that bare JSON body. That observation is therefore **compatible** with the `c26bcbb1` candidate behavior, but does not prove it: Cloudflare version metadata exposes a script ETag and bindings but not retrievable source text or a Git commit mapping through the available CLI. No claim is made that `c26bcbb1`, current head, or any other candidate commit is the code in active version `1e8d5f2b-a837-43d9-8b92-0fbc6adba840`.

The active control-plane list has no pending-build status or connected-repository provenance endpoint available through the authenticated CLI. Repository inspection found no GitHub Actions deployment workflow and the remote branch set has only the feature branch and `main`. This establishes neither a connected-repository build nor its absence outside the inspected evidence. A documentation push is therefore recorded separately and must not be treated as deployment proof.

## Narrow release decision

A safe diagnostic response is required because the only owner-visible response remains bare and cannot supply the real completion stage. The minimal follow-up release will:

1. expose only `stage` with one of `viewer`, `session_encryption`, or `session_persistence`, plus a non-sensitive random `correlation_id`, alongside the existing error category;
2. retain sanitized configuration and exchange error categories;
3. include no exception, upstream, OAuth, credential, cookie, token, or secret material;
4. change no D1 binding/data, secrets, origin, or cron configuration; and
5. be deployed only after full repository validation, with active-version rechecks before and after the deployment.

## Initiation-only smoke result

A redirects-disabled request to the initiation route returned HTTP 302 with no response body, and no redirect target, cookie value, state, or header value was recorded. This is a valid initiation redirect result only. It does not validate callback completion, exchange, viewer lookup, encryption, persistence, or owner authentication.

## Next evidence required

After the exact validated diagnostic revision is the sole active `vibecoderleague` version, the owner should start a fresh login from the main site and return only either:

- the compact sanitized JSON error body; or
- `successful`.

Do not reuse or send any callback URL, code, state, cookie, token, or other login input.
