# OAuth viewer verification receipt — 2026-09-21

## Scope

One focused diagnosis and diagnostic-only release for the existing Worker `vibecoderleague`. This receipt intentionally contains no OAuth callback URL, authorization code, state, cookie value, token, PEM material, secret value, upstream body, upstream header, exception text, or personal data.

No session was created, no OAuth callback was completed, no sync was triggered, and no cron schedule was enabled.

## Source diagnosis

| Check | Result |
| --- | --- |
| Validated source SHA | `92f41d7ece984b0b24c351c0f4e283198e631ed1` |
| Git remote | pushed to `origin/feat/public-opt-in-leaderboard` |
| Active initial boundary | The OAuth callback constructs `GitHubClient` directly from the newly exchanged access token before any session encryption or persistence work. |
| Viewer request | `GET https://api.github.com/user` with `Authorization: Bearer <fresh user token>`, `Accept: application/vnd.github+json`, and `User-Agent: vibe-coder-league`. |
| User contract | Requires non-empty string `node_id` and `login`; optional string `avatar_url` remains allowed. |
| Demonstrated request defect | None. The existing request method, destination, Bearer source, and required headers were correct. |
| Historical correlation lookup | No stored, allowlisted observability artifact was available through the inspected repository/Wrangler records. Raw-tail or raw-callback collection was not attempted. |

## Released diagnostic

The release adds a viewer-only allowlist, correlated by the already-safe `correlation_id` generated for the callback failure:

```text
viewer.category = http_error | transport_error | invalid_json | invalid_user_shape
viewer.status   = integer
```

`status: 0` means no HTTP response was received for `transport_error`. It is not an upstream HTTP status. The callback continues to return `Cache-Control: no-store`.

No other upstream detail is emitted or logged by this diagnostic: no response body, response header, callback URL, code, state, cookie, token, PEM, exception/cause text, or user field.

## Validation

| Check | Result |
| --- | --- |
| Valid viewer contract and exact request assertions | PASS |
| HTTP 401 viewer failure | PASS: `http_error`, status `401` |
| HTTP 403 viewer failure | PASS: `http_error`, status `403` |
| Invalid JSON | PASS: `invalid_json`, status `200` |
| Invalid user shape | PASS: `invalid_user_shape`, status `200` |
| Transport failure | PASS: `transport_error`, status `0` |
| OAuth callback no-store and no-leakage response assertions | PASS |
| Full test suite | PASS: 29 tests across 3 files |
| TypeScript | PASS: `tsc --noEmit` |
| Worker bundle | PASS: Wrangler dry-run |
| Independent QA | PASS |

## Deployment and preservation checks

| Check | Result |
| --- | --- |
| Deployed Worker | `vibecoderleague` only |
| Deployment version | `0a04ce62-aede-49a3-8a73-032740e1a0ce` |
| Traffic allocation | 100% to that version at verification |
| D1 binding | Preserved: existing `DB` binding to the existing database ID |
| Origin | Preserved: `https://vibecoderleague.grumpzillax.workers.dev` |
| Secrets | Preserved by name only; no values read or changed |
| Cron | Still disabled: no trigger declaration; no schedule enabled |
| Sync | Not invoked |
| OAuth initiation smoke | PASS: redirects-disabled request returned HTTP `302`, issued the expected secure transaction-cookie attributes, and had a redirect location. No location, cookie value, state, or body was recorded; no redirect or login was followed. |

## Exact next owner action

1. Start a **new** browser login from `https://vibecoderleague.grumpzillax.workers.dev`.
2. Complete the GitHub authorization once.
3. Report only either `successful` or the compact sanitized JSON failure response.

Do **not** send a callback URL, authorization code, state, cookie, token, account details, or screenshot containing those values. A new viewer failure will now identify only its category and status safely; it does not itself prove a root cause until the fresh result is returned.
