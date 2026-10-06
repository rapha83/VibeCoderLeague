# VibeRivals Documentation

Welcome to the **VibeRivals** documentation. This directory provides technical specifications, architectural designs, security guidelines, and historical audit records for the project.

---

## 📚 Core System Guides

These are the primary documents describing the system design and operational setup:

* **[Architecture](architecture.md):** Complete overview of the serverless architecture (Cloudflare Workers, Cloudflare D1, static assets), data flow, GraphQL querying boundary, and sync budgeting.
* **[Privacy, Security, and Retention](privacy-security-retention.md):** Detailed security policies, zero-code-collection guarantee, credential encryption in D1 with AES-256-GCM, hashed session cookies, and instant opt-out/withdrawal data deletion.
* **[GitHub App Setup](github-app.md):** Configuration checklist for the GitHub App (least-privilege read-only permissions for Metadata and Pull Requests; zero access to repository contents, diffs, or code).
* **[Cloudflare Deployment and Operations](cloudflare.md):** Production deployment guide for Cloudflare Workers, custom domain configuration (`https://viberivals.com`), Worker secrets, and D1 database migrations.
* **[Local Validation](local-validation.md):** Step-by-step instructions for running tests, static analysis, and local emulation with Wrangler and Miniflare.

---

## 🎨 Frontend & Design

* **[Frontend Redesign (2026-10-04)](frontend-redesign-2026-10-04.md):** Accessible design system, UX structure, and vanilla client architecture.
* **[Visual Competition Art (2026-10-05)](visual-competition-art-2026-10-05.md):** Local responsive hero artwork and asset optimization.
* **[Visual Arena Motion (2026-10-05)](visual-arena-motion-2026-10-05.md):** Accessible finite animations and motion styling respecting `prefers-reduced-motion`.

---

## 📜 Audit Trail & Historical Receipts

VibeRivals maintains open, transparent engineering receipts for all major milestones, migrations, and diagnostic resolutions:

* **[VibeRivals Migration (2026-10-05)](viberivals-migration-2026-10-05.md):** Migration of canonical brand origin to `https://viberivals.com` and host-level routing guard.
* **[Sync App Auth Followup (2026-10-05)](sync-app-auth-followup-2026-10-05.md):** GitHub App client ID issuer resolution.
* **[Ranking Count Brand Followup (2026-10-05)](ranking-count-brand-followup-2026-10-05.md):** Ranking eligibility rules and incremental sync hardening.
* **[Sync Tool & Model Demand (2026-10-04)](sync-tool-model-demand-2026-10-04.md):** Introduction of self-declared AI coding tool/model tagging.
* **[Manual Sync Activation (2026-09-21)](manual-sync-activation-2026-09-21.md):** Controlled on-demand sync activation.
* **[Deployment Repair (2026-09-21)](deployment-repair-2026-09-21.md):** Initial anonymous session contract release receipt.
