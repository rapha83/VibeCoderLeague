# VibeRivals

[![Tests](https://img.shields.io/badge/tests-116%20passed-brightgreen.svg)](test/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](tsconfig.json)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%26%20D1-orange.svg)](wrangler.toml)
[![Production](https://img.shields.io/badge/Production-viberivals.com-success.svg)](https://viberivals.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**The vibe coding competition** — Compete with builders using AI.

VibeRivals is an open-source, privacy-first, opt-in monthly leaderboard for developers shipping software with AI coding assistants.

- 🌐 **Live Website:** [viberivals.com](https://viberivals.com)
- 📦 **Repository:** [github.com/rapha83/VibeRivals](https://github.com/rapha83/VibeRivals)

---

## ⚡ The Scoring Protocol

1. **1 eligible merged PR = 1 point** counted in its `mergedAt` **UTC month**.
2. **Strictly Opt-In:** Participation is explicit. Only repositories that the participant explicitly selects and that are currently public are included.
3. **Self-Declared AI Tools & Models:** Participants can optionally share which AI coding assistants (e.g. Claude Code, Cursor, Codex, OpenClaw, Antigravity, Devin, Copilot) and models they use. These declarations are labelled as **self-declared and unverified**.
4. **Privacy-First & Fail-Closed:** VibeRivals collects zero source code, diffs, PR titles, or comments. If a repository becomes private or inaccessible, its contributions are immediately suppressed.
5. **Instant Withdrawal:** Consent can be withdrawn at any time with a single click, instantly deleting all public contribution records.

---

## 🏗️ Architecture & Tech Stack

VibeRivals is engineered to run entirely on **Cloudflare Free tier infrastructure**:

- **Edge Runtime:** Cloudflare Workers running [Hono](https://hono.dev/) for fast, type-safe API routing.
- **Database:** [Cloudflare D1](https://developers.cloudflare.com/d1/) (Serverless SQLite) for storing minimal session, consent, and pull request facts.
- **Frontend:** Vanilla HTML, CSS, and modern JavaScript with zero build-step or runtime dependencies, featuring WCAG-compliant accessible design and `prefers-reduced-motion` animations.
- **GitHub Integration:** GitHub App web flow with least-privilege read-only permissions (`Metadata: read`, `Pull requests: read`). Zero access to repository contents, diffs, or code.

---

## 🚀 Quick Start & Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- Wrangler CLI (`npm i -g wrangler` or via `npx wrangler`)

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/rapha83/VibeRivals.git
   cd VibeRivals
   ```

2. **Install dependencies:**
   ```sh
   npm ci
   ```

3. **Configure local environment variables:**
   ```sh
   cp .dev.vars.example .dev.vars
   ```
   *(Fill in your local development variables. `.dev.vars` is git-ignored and must never be committed).*

4. **Run tests and type checking:**
   ```sh
   npm test        # Runs Vitest (116 tests)
   npm run check   # Runs tsc --noEmit
   ```

5. **Start local development server:**
   ```sh
   # Apply migrations to local SQLite D1 database
   npx wrangler d1 migrations apply vibe-coder-league --local

   # Launch local development worker
   npx wrangler dev
   ```

---

## 📁 Project Structure

```text
VibeRivals/
├── src/
│   ├── worker.ts              # Hono API routes, auth, rate limiting, and scheduled sync
│   ├── github.ts              # GitHub API client with strict data query boundaries
│   └── frontend/              # Static frontend assets (HTML, styles, scripts, visuals)
│       ├── index.html         # Accessible competition interface
│       ├── app.js             # Vanilla client-side state and UI interaction
│       ├── styles.css         # Modern dark-mode styling and motion tokens
│       └── competition-builders.webp
├── migrations/                # Cloudflare D1 SQL schema migrations
│   ├── 0001_initial.sql
│   ├── 0002_rate_limits.sql
│   ├── 0003_sync_job_leases.sql
│   └── 0004_oauth_transactions_and_public_profiles.sql
├── test/                      # Vitest unit, contract, and integration tests
│   ├── security-contract.test.ts
│   ├── worker.integration.test.ts
│   ├── github-sync.test.ts
│   ├── github-app-auth.test.ts
│   └── frontend.behavior.test.js
├── docs/                      # Architectural specs, operational guides, and audit logs
│   ├── README.md              # Documentation directory index
│   ├── architecture.md
│   ├── cloudflare.md
│   ├── github-app.md
│   ├── privacy-security-retention.md
│   └── local-validation.md
├── wrangler.toml              # Cloudflare Worker configuration
└── EVIDENCE.md                # System audit and verification evidence
```

---

## 🔌 API Reference

| Endpoint | Method | Auth | Description |
| :--- | :---: | :---: | :--- |
| `/api/rules` | `GET` | Public | Returns the competition rules and scoring protocol. |
| `/api/leaderboard?month=YYYY-MM` | `GET` | Public | Returns monthly leaderboard rankings and self-declared configurations. |
| `/api/profiles/:id?month=YYYY-MM` | `GET` | Public | Returns public participant profile and published contributions. |
| `/api/session` | `GET` | Session | Returns session state and CSRF token. |
| `/api/repos` | `GET` | Session | Returns accessible public repositories for the authenticated user. |
| `/api/auth/github` | `GET` | Public | Initiates GitHub App OAuth authorization flow. |
| `/api/auth/github/callback` | `GET` | Public | Completes OAuth code exchange server-side. |
| `/api/selections` | `POST` | CSRF | Confirms repository selection, consent, and optional tool/model tags. |
| `/api/sync` | `POST` | CSRF | Triggers an on-demand sync of eligible merged PRs. |
| `/api/consent` | `DELETE` | CSRF | Withdraws consent and purges public contribution data. |

---

## 🔒 Security & Privacy by Design

- **Zero Source Code Access:** GitHub API queries request only `id`, `mergedAt`, and author identity. No code, diffs, patches, file paths, or PR comments are ever fetched or stored.
- **Credential Protection:** GitHub user tokens are encrypted at rest with **AES-256-GCM** using a 32-byte key. Ephemeral GitHub App installation tokens are generated in memory and never persisted.
- **Session Integrity:** Session cookies use the secure `__Host-` prefix (`__Host-vcl`) with `HttpOnly`, `Secure`, and `SameSite=Lax`. Tokens are stored in the database as **SHA-256** hashes.
- **Strict Host Canonicalization:** All incoming requests are guarded by host verification. Requests to legacy domains are automatically redirected to `https://viberivals.com`.
- **Durable Rate Limiting:** All mutation routes are rate-limited via Cloudflare D1 with IP-based hashing before CSRF or processing execution.

---

## 📖 Documentation

For in-depth technical details, check the [Documentation Index](docs/README.md):

- [Architecture & Data Boundaries](docs/architecture.md)
- [Privacy, Security, and Retention Policy](docs/privacy-security-retention.md)
- [GitHub App Configuration](docs/github-app.md)
- [Cloudflare Deployment Guide](docs/cloudflare.md)
- [Local Validation & Testing](docs/local-validation.md)
- [VibeRivals Origin Migration](docs/viberivals-migration-2026-10-05.md)

---

## 🎯 Non-Goals

- Collecting or archiving private repositories or proprietary source code.
- Automatic AI detection or code quality evaluation.
- Commercial rankings, prizes, or sponsored placements.
- Broad third-party write permissions to participant repositories.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). Feel free to use, study, fork, and contribute.
