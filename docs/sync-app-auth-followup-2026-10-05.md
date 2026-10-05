# Installation authentication investigation — 2026-10-05

## Updated outcome — demonstrated missing-issuer defect

**This update supersedes the initial investigation outcome below.** CTO supplied new official binding-name metadata: `wrangler secret list` lists Client ID, Client Secret, private key and session key only; `wrangler versions view` for active version `a5c22ca5` shows the same secrets and only `PUBLIC_ORIGIN` in vars. `GITHUB_APP_ID` is absent. This is evidence attributed to CTO, not independently queried here; no secret values were accessed.

Before correction, manual and scheduled callers passed `env.GITHUB_APP_ID` directly. An absent binding becomes `undefined`, and `JSON.stringify` omits `iss`. The missing-issuer configuration/code mismatch is demonstrated and is a likely explanation for the reported 401, **not live proof of causality or a verified production fix**.

Minimum correction on this same candidate:

- `src/github.ts`: shared `resolveGitHubAppIssuer` selects trimmed, nonblank legacy `GITHUB_APP_ID` first, otherwise trimmed, nonblank `GITHUB_APP_CLIENT_ID` (the official recommended issuer). Explicit legacy precedence preserves existing deployments; both absent/blank yields generic `configuration_error`, status `0`.
- `installationToken` independently rejects absent/blank issuer before key import, signing or fetch. Signature algorithm, PEM parser and timing are unchanged.
- `src/worker.ts`: App ID is optional in `Env`; both manual and scheduled callers use the shared resolver. OAuth handling is unchanged.
- `test/github-app-auth.test.ts`: now 15 cases, including real signed/public-key-verified JWTs for missing-App-ID Client ID fallback, blank-App-ID fallback and legacy App ID precedence. Direct missing/empty/whitespace issuer checks assert no import/sign/fetch; neither binding present fails safely without HTTP access.
- `test/worker.integration.test.ts`: three added cases verify both callers choose the same fallback/legacy issuer and neither invokes mint/sync when no issuer exists. Existing Tool+Model edits in this file and `src/worker.ts` were preserved with surgical additions.

Regression before correction: `npm test -- test/github-app-auth.test.ts` ran 12 cases; **3 failed, 9 passed**. All three absent/blank issuer cases incorrectly signed and reached the synthetic exchange, resolving its synthetic token rather than rejecting. No JWT/header/key was printed.

Validation after correction:

```text
npm test -- test/github-app-auth.test.ts test/github-sync.test.ts test/worker.integration.test.ts
  PASS: 3 files, 53 tests (15 auth + 13 sync + 25 worker integration)
npm run check
  PASS: tsc --noEmit
git diff --check
  PASS
```

The built-in review tool could not inspect this isolated candidate because it is pinned to the base workspace. A read-only independent helper reviewed the exact auth implementation, both callers and new tests: **COMPLETE, no blocking gaps**. Whitespace fallback is covered through the resolver and real signer, not separately parameterized at the caller integration layer.

No live patch/deploy or retry occurred. The CTO owns the next authorized release/verification and central receipt. Key/App pairing, installation association and clock skew remain residual hypotheses only if authentication still fails after the corrected candidate is deployed and verified; this evidence does not justify rotation or secret changes. No requirement for human key intervention is established by the missing binding alone. All additions remain uncommitted on the same branch and HEAD recorded below. Tests used disposable local emulated databases only; no live D1 operation was performed and fixtures disposed their Miniflare instances.

## Initial investigation record (historical; before CTO metadata)

## Outcome and candidate

No local signing/request code defect explaining the reported installation-token HTTP 401 was proven. No production implementation, issuer, timing, binding, or credential was changed. This is a focused investigation, not a live-authentication fix or a central receipt.

- Candidate: `/Users/openclaw-bot/Documents/GrumpyzillaSoftwareLab/worktrees/VibeCoderLeague`
- Branch: `feat/public-opt-in-leaderboard`
- Base HEAD: `77f33046d703f41727f84b564adb58b42397591f`
- Added: `test/github-app-auth.test.ts` and this document, uncommitted.
- Existing six Tool+Model modified files and pre-existing untracked artifacts were preserved.
- Supplied diagnostic, not re-executed: `2026-10-05T00:10Z`, stage `installation_token`, category `http_error`, status `401`, correlation `f1fa8ff7-b298-4f81-9dad-fe9ea3dbb3ee`.

## Source findings

`src/github.ts` imports PKCS#8 DER with WebCrypto `RSASSA-PKCS1-v1_5` / SHA-256 and signs the UTF-8 JWT header/payload. Encoding strips padding and uses URL-safe substitutions. Claims use integer seconds: `iat = floor(Date.now()/1000) - 30`, `exp = iat + 540`, hence `exp = now + 510`. Issuer is the supplied string unchanged. The exchange POST is `/app/installations/{encoded installationId}/access_tokens` with Bearer JWT authentication.

`src/worker.ts` declares separate App ID, private-key and OAuth Client ID/Client Secret bindings. Both manual and scheduled installation exchanges pass `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and the selected/stored installation ID. OAuth uses the Client ID/Secret separately. Only declarations and call sites were inspected, not deployed binding values.

The official contract supplied by CTO accepts App ID **or** Client ID as issuer, requires RS256 and expiry no more than 600 seconds ahead, and recommends backdating `iat` by 60 seconds. Current 30-second backdating differs from that recommendation but does not establish a defect or explain the observed rejection. No speculative issuer or timing patch was made.

## Independent synthetic tests

Nine new cases generate an ephemeral 2048-bit RSA pair in memory using Node crypto, while production signs through WebCrypto. Node `verify` with the public key and explicit RSA PKCS#1 padding independently verifies the emitted signature; tampered signing input fails.

Coverage:

- Exact RS256/JWT header, unchanged numeric-looking App ID and synthetic Client ID issuer strings, only `iat`/`exp`/`iss` claims.
- Integer-second claims with a fractional-millisecond clock, exact current offsets and expiry within the supplied 600-second limit.
- Three nonempty unpadded base64url segments; exact installation-ID URL, POST and Bearer prefix.
- PKCS#8 PEM with LF, CRLF and whitespace succeeds.
- PKCS#1 `RSA PRIVATE KEY`, literal escaped newlines and invalid DER fail with `configuration_error`, status `0`, before fetch.
- Upstream synthetic 401 returns only `http_error`, status `401`, generic `github_request_failed`, with no cause or sensitive body exposure. Neither response `text()` nor `json()` is invoked; its body remains unread.

PKCS#1 is an unsupported local configuration format. This limitation is demonstrated, but it produces a different failure than the reported HTTP 401. Plain PKCS#1 supplied to this implementation cannot explain a request that reached the upstream exchange. Supporting additional key formats was not required or added.

Tests never log PEM, JWT, Authorization or actual credentials. Captured synthetic authorization is inspected inside the mock using boolean assertions to avoid dumping it on ordinary assertion failure. No real HTTP requests are made.

## Validation and independent review

Executed on this candidate:

```text
npm test -- test/github-app-auth.test.ts test/github-sync.test.ts
  PASS: 2 files, 22 tests (9 new + 13 existing), Vitest 2.1.9
npm run check
  PASS: tsc --noEmit
git diff --check
  PASS
```

A read-only independent helper reviewed the scoped new tests and authentication implementation and found no code defect explaining 401. It confirmed the coverage above. Limitations: formatting-specific PEM cases assert exchange success rather than repeating independent signature verification; no explicit canonical decode/re-encode test, encoded nonnumeric installation-ID case, logger spy, or sensitive-response-header sentinel was added. These are coverage boundaries, not demonstrated implementation faults. No runtime before/after regression exists because no production correction was warranted. The prior 82-test Tool+Model validation was supplied context, not rerun or claimed as new evidence.

## Precise remaining hypotheses and next owner action

HTTP 401 establishes that local signing completed and the fetch returned a rejection. It does **not** identify which upstream credential condition failed.

1. **Issuer/key App mismatch, removed/revoked key, or wrong deployment binding provenance:** syntactically valid PKCS#8 can sign locally even if GitHub does not associate its public key with the issuer. Authorized human/CTO verification must establish that the active issuer and configured key belong to the same intended App and deployment. This investigation did not inspect or prove any such mismatch.
2. **Installation/App association:** verify the selected installation belongs to the intended App using safe official configuration metadata. Locally, the code uses the installation ID in the correct endpoint position; synthetic tests cannot establish real association. Do not infer the exact upstream status for every association failure from this one 401.
3. **Runtime clock skew:** local claim arithmetic is correct, but these tests cannot measure the deployed clock relative to GitHub. A sufficiently ahead/behind clock could affect claim acceptance. The 60-second recommendation is not evidence that changing 30 to 60 would fix this case.
4. **Deployment differs from inspected candidate:** candidate tests do not certify deployed source, bindings or middleware/header behavior. Correlate deployment provenance with the supplied diagnostic before attributing it to this source.

The remaining unblock is authorized configuration/provenance verification, including possible human key/App pairing intervention **if a mismatch is confirmed**, not a proven code repair. CTO owns official metadata research and the central receipt. Do not rotate/rebind keys or retry live writes based solely on these hypotheses.

## Safety and cleanup

No secret files, PEM files, environment credential files or actual token/header values were read or printed. No raw GitHub upstream messages/bodies were retrieved. No commit, push, deploy, live mutation, rotation, permissions change or D1 action occurred. Ephemeral key material lived only in the completed test process; no servers, containers, extra worktrees or persistent key artifacts were created. New tests and this document remain on the same recoverable candidate.
