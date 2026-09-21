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

## Source/deployment lineage

- **Pre-fix parent source SHA:** `71e0a7c04f7f14c56c5d633cccaab12683606ac7`
- **Fix source SHA:** recorded after the reviewed correction is committed.
- **Active Worker version before deploy:** `0a04ce62-aede-49a3-8a73-032740e1a0ce`
- **Deployed Worker version:** recorded only after deployment status confirms the new version receives 100% traffic.

## Owner next step

After the exact reviewed SHA is deployed and activation is verified, perform **one fresh normal owner login**. Do not send any OAuth URL, authorization code, state, cookie, token, account detail, screenshot containing them, or correlation ID. Report only whether the login completed or the existing safe error category/stage/status if it failed.
