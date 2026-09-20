# Privacy, security, and data retention

## Opt-in contract

Participation is opt-in, not inferred. Until a person confirms opt-in, GitHub activity may be used only for bounded internal aggregation needed to evaluate an eligible record; it must not be published. The public view must include only opted-in participants and the minimum display fields documented by the product owner. Opt-out must immediately suppress public reads and stop future publication; it must not require a new GitHub sync.

Provide a clear opt-out/removal path that does not require exposing a secret in a URL. Authenticate a change with the mechanism chosen by the implementation owner, rate-limit it, and audit the outcome without recording sensitive request data. A removal request must remove the public identity and derived leaderboard data, or irreversibly detach it from the person, within the stated operational window. Re-sync must not recreate a removed participant without a new opt-in.

## Data minimization

Store only what the MVP needs: an internal participant/consent record, a GitHub actor or installation reference, minimal merged-PR facts, and sync checkpoints. The active browser session retains its GitHub OAuth access token only as AES-GCM-encrypted D1 session data and for no longer than the configured eight-hour session; the session cookie is stored as a SHA-256 hash. GitHub App installation tokens are short-lived and memory-only. Do not store source code, PR titles/bodies, patch bodies, review text, repository contents, personal contact data, webhook payloads, or unrelated repository metadata. Never log tokens or full API payloads. Display names are user-controlled/untrusted text and must be escaped and length-limited.

## Retention baseline

- **Consent and suppression state:** retain while needed to honor opt-in/opt-out and prevent reappearance; delete when the owner confirms the record is no longer needed and no suppression obligation remains.
- **Derived leaderboard aggregates:** retain only while opted in and needed for the published leaderboard; remove on opt-out/removal, subject to a documented owner-approved legal hold (none is defined by this MVP).
- **Sync checkpoints and operational logs:** retain only for troubleshooting and continuity, with bounded size and a short owner-selected period; never include credentials or raw GitHub payloads.
- **Provider logs/backups:** Cloudflare and GitHub may retain provider-level logs under their own terms. The owner must review provider retention controls before public launch; this repository does not configure or verify them.

The implementation must make the chosen durations/configuration explicit before launch. This document does not claim legal compliance or define a jurisdiction-specific rights process; the owner must obtain the appropriate review for the audience and deployment jurisdiction.

## Security controls

- GitHub App installation token is created at runtime and kept only in the platform secret store; never commit or print it.
- Enforce repository/install scope and least privilege (see [GitHub App setup](github-app.md)).
- Validate all identifiers and user input; use parameterized database queries; escape output; apply rate limits to opt-in/opt-out/removal endpoints.
- Keep production and local credentials separate. Rotate or revoke credentials after suspected exposure.
- Monitor failed syncs, unexpected row/count changes, repeated removal failures, and stale data. Preserve the last known good public state during sync failure.
- Treat a data-access or publication incident as an owner escalation: disable publication/sync if necessary, rotate credentials, preserve minimal evidence, and assess affected records.

No secrets, credentials, integration access, or provider settings were supplied or validated in this task.
