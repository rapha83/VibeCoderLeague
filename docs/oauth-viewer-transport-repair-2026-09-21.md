# OAuth viewer transport repair receipt — 2026-09-21

**Scope:** a single binding-safe default fetch correction for Worker `vibecoderleague`. This record intentionally excludes OAuth URLs, codes, state, cookies, tokens, PEM material, secret values, GitHub response bodies/headers, and exception details.

## Observed cause class

The OAuth callback had already completed its code exchange and then failed at the viewer boundary, before session encryption or persistence.

An isolated credential-free reproduction ran the actual `GitHubClient` invocation shape inside **Miniflare 3.20250718.3 / workerd 1.20250718.0**, using the repository compatibility date **2024-12-18**:

| Variant | Sanitized outcome |
| --- | --- |
| Existing default: store native `fetch` and invoke it as a client member | `TypeError` at invocation, before an HTTP response |
| Binding-safe wrapper: `(input, init) => globalThis.fetch(input, init)` | HTTP response reached; status `403` |

The wrapper result was `403`, not the expected unauthenticated `401`; that is treated as an upstream/environment response difference rather than a transport failure. The decisive differential is that the existing member-call shape fails before HTTP whereas the wrapper reaches HTTP under the same workerd-compatible runtime. No upstream body, header, or exception text was collected.

## Bounded correction

`GitHubClient` now defaults its injected fetch dependency to:

```ts
(input, init) => globalThis.fetch(input, init)
```

Only the default native-fetch path changed. Explicitly injected fetch functions, request method/headers, viewer parsing, HTTP classification, diagnostics, OAuth configuration, D1 bindings, origin, and Cron configuration are unchanged.

## Verification before deployment

| Check | Result |
| --- | --- |
| Receiver-sensitive actual-client regression in Miniflare/workerd | PASS — default fetch observed the global receiver; valid viewer contract returned |
| Existing mocked viewer and HTTP semantics | PASS |
| Full test suite | PASS — 3 files, 30 tests |
| Type check | PASS — `tsc --noEmit` |
| Diff whitespace check | PASS |
| Worker dry-run package/config inspection | PASS — target `vibecoderleague`; existing D1 binding and exact public origin retained; no Cron trigger added |
| Independent QA review | PASS — minimal scope and injected-fetch behavior verified independently |

## Deployment and activation

| Check | Result |
| --- | --- |
| Deployment target | PASS — only `vibecoderleague` at the configured Workers URL |
| Source used for deployment | `029c1440317a3563a91bd0ab972ef4b51a48aade` |
| Active Worker version | PASS — `c57a064c-49a6-461e-a274-6ad65648c1b1` receives 100% traffic |
| OAuth initiation | PASS — a single non-followed initiation request returned an HTTP redirect and set a transaction cookie; redirect target, cookie value, and headers were not recorded |
| D1, secrets, origin, Cron | Preserved — no migration, secret/config update, origin change, or Cron trigger change was performed |

This receipt was updated after deployment. Its documentation-only commit is distinct from the exact source SHA above and was not part of the deployed Worker.

## Owner next step

Perform **one fresh normal owner login**. Do not send any OAuth URL, authorization code, state, cookie, token, account detail, screenshot containing them, or correlation ID. Report only whether the login completed or the existing safe error category/stage/status if it failed.
