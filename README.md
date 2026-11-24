# G1 Virtual Labs

**G1 Virtual Labs** is a browser-native, bilingual (**English `en-IN` / Telugu `te-IN`**) virtual science laboratory platform designed for **Andhra Pradesh** schools across **all seven learning stages** (**Classes 6–10** & **Intermediate 1st and 2nd Year**) and three science disciplines (**Chemistry, Physics, and Biology**).

Each launchable practical provides two clearly differentiated learning modes:

- **Simulation Mode (Blue `#0663AB`)** — Guided curriculum practical with step-by-step instructions, interactive apparatus hotspots, 2D Accessible DOM controls, server-validated observations, checkpoints, and rubric assessment.
- **Experiment Mode (Green `#046C49`)** — Bounded independent scientific inquiry with admitted variable domains, explicit units, control vs. comparison trials, theoretical/calibration disclaimers, and evidence-linked rubric evaluation.

> **Scope & Evidence Honesty Notice**
> This repository delivers the upgraded **G1 Virtual Labs Website Platform** (`W01–W13` + 7 education levels): bilingual public & authenticated routes, PostgreSQL 16+ persistence, tenant-scoped authentication and RBAC, OpenAPI 3.1 / `lab@1` lab contracts, server-resolved assignment mode/version pinning, per-mode rubrics and immutable assignment amendments, criterion/observation evidence drill-down, offline/retry checkpoint recovery, audited CSV exports, small-cell suppressed district/state aggregates, and two-person editorial review.
> **Stage-2 items intentionally gated:** Photorealistic 3D WebGL/Babylon.js laboratory scenes (`F-14`), physical optics calibration and rights-cleared onion micrographs (`G1-31`), final 2026–27 AP SCERT/BIEAP textbook edition sign-off (`G1-27`), external 1EdTech LTI 1.3 / AGS LMS integration (`F-15`), optional AI tutor (`ENABLE_OPTIONAL_TUTOR=false`), and independent government/DPDP/device certification (`G1-28`, `G1-29`). All seeded accounts are **synthetic local QA fixtures** with no real student data.

---

## Technology Stack & Architecture

- **Framework:** Next.js 16.4.6 (App Router + Turbopack), React 19, TypeScript 5, Tailwind CSS 4
- **Database:** PostgreSQL 16+ (`pg` driver) with an embedded local PGlite socket server (`@electric-sql/pglite-socket`) for zero-install local development (`db/migrations/001_initial_schema.sql`, `db/migrations/002_upgrade_w01_w13.sql`)
- **Design System:** G1 Scientific Observatory (`design-system/g1-virtua-labs/MASTER.md`). The shared header extrudes the outlines in `public/brand/g1-virtual-labs.svg` into the glossy 3D logo, with the same vector artwork available as a fallback. The original `public/brand/g1-canonical-logo.png` remains available for comparison and rollback (`278×50`, SHA-256 `94b8b12e4a13317df3e00b1a6e8604aec9fdb4074cf355b55658dc9739c77a65`).
- **Brand compatibility:** The website displays **G1 Virtual Labs** in English and Telugu. The npm package name `g1-virtua-labs`, existing local PostgreSQL database identifier `g1_virtua_labs`, and seeded `@g1virtualabs.test` usernames retain their established spellings.
- **Quality & Testing:** TypeScript (`tsc --noEmit`), ESLint 9 flat config (`eslint.config.mjs`), Vitest unit/contract tests (`tests/unit/`), Playwright E2E + `@axe-core/playwright` WCAG 2.2 AA accessibility scans (`tests/e2e/`)

---

## Quick Start (Any Computer — Windows / macOS / Linux)

### 1. Prerequisites
- **Node.js 22+** (or Node 24 LTS) and **npm 10+**
- **Git**

### 2. Clone & Install

```bash
git clone https://github.com/kissu06101997-oss/G1-Virtual-Labs.git
cd G1-Virtual-Labs
npm ci
```

### 3. Configure Local Environment Variables

Copy the non-secret template `.env.example` to `.env.local` (never commit `.env.local`!):

```bash
# macOS / Linux
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

Generate a random 32+ character `SESSION_SECRET` and place it in `.env.local`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Key environment variables in `.env.local`:

| Variable | Purpose | Local Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 16+ connection string | `postgres://postgres:postgres@127.0.0.1:54329/g1_virtua_labs` |
| `SESSION_SECRET` | HMAC key for HTTP-only session cookies (min 32 chars) | *(Generate locally — never commit)* |
| `APP_ORIGIN` | Same-origin audience for launch tokens | `http://127.0.0.1:3000` |
| `ENABLE_OPTIONAL_TUTOR` | Keeps optional AI tutor disabled | `false` |
| `ALLOW_LOCAL_SYNTHETIC_FIXTURES` | Enables seeded synthetic QA accounts locally (**must be `false` in production**) | `true` |

### 4. Start Locally (Database + Migrations + Seed + App)

```bash
# Development mode (auto-starts local PostgreSQL, runs migrations/seed, starts Next.js on http://127.0.0.1:3000)
npm run dev:local
```

Or run the production build locally:

```bash
npm run db:start    # In Terminal 1 (starts local PGlite PostgreSQL on 127.0.0.1:54329)
npm run db:migrate  # In Terminal 2 (applies all pending migrations)
npm run db:seed     # Adds local synthetic QA fixtures
npm run build
npm run start       # Serves production build at http://127.0.0.1:3000
```

See [SETUP_LOCAL.md](./SETUP_LOCAL.md) for standalone PostgreSQL 16+ setup and seeded synthetic QA accounts.

---

## Verification & Testing Commands

```bash
npm run typecheck   # TypeScript strict check (tsc --noEmit)
npm run lint        # ESLint 9 flat config check
npm run test:unit   # Vitest unit & contract tests (science adapters, OpenAPI/JSON schemas, 7 stages)
npm run build       # Production Next.js build verification
npm run test:e2e    # Playwright E2E + Axe WCAG 2.2 AA scans (requires running server on 127.0.0.1:3000)
```

*(On a fresh machine, install Playwright Chromium once via `npx playwright install chromium` before running `npm run test:e2e`.)*

---

## Ongoing Multi-Computer Development Workflow

Use this workflow whenever developing on another computer (in **Google Antigravity**, VS Code, or any editor) to keep `main` stable and synchronized:

### 1. First-Time Setup on a New Computer
```bash
git clone https://github.com/kissu06101997-oss/G1-Virtual-Labs.git
cd G1-Virtual-Labs
npm ci
Copy-Item .env.example .env.local   # Edit SESSION_SECRET locally
```

### 2. Before Starting Any Session
```bash
git checkout main
git pull --ff-only origin main
```

### 3. Work on a Feature Branch (Recommended for Upgrades)
```bash
# Create a descriptive branch from latest main
git checkout -b feat/your-upgrade-name

# Develop, then verify before committing
npm run typecheck
npm run lint
npm run test:unit
npm run build

# Stage, commit and push your feature branch
git status
git add <specific-files>
git commit -m "feat: concise description of change"
git push -u origin feat/your-upgrade-name
```

### 4. Review & Merge via Pull Request
- Open a Pull Request on GitHub (`feat/your-upgrade-name` → `main`), review diffs and checks, and merge cleanly without force-pushing `main`.
- Back on your machine, sync `main` and clean up merged branches:
  ```bash
  git checkout main
  git pull --ff-only origin main
  git branch -d feat/your-upgrade-name
  ```

### 5. Recovering an Earlier Version Safely
Never use `git push --force` on `main`. To safely undo a bad commit while preserving history:
```bash
git log --oneline -n 10
git revert <commit-hash>
git push origin main
```

---

## Deployment Guidelines
- **Never commit `.env`, `.env.local`, `.env.production`, or real credentials.** Configure production secrets strictly in your hosting provider's secret manager.
- Set `ALLOW_LOCAL_SYNTHETIC_FIXTURES=false` and `ENABLE_OPTIONAL_TUTOR=false` in any non-QA deployment.
- Point `DATABASE_URL` to a managed PostgreSQL 16+ instance and apply migrations with `npm run db:migrate` (do not run `db:seed` with synthetic accounts in production).
- Review [docs/g1-premium-upgrade/POLICY_AND_CONTENT_GATES.md](./docs/g1-premium-upgrade/POLICY_AND_CONTENT_GATES.md) before real school rollout.

---

## Key Documentation

| Document | Purpose |
|---|---|
| [AGENTS.md](./AGENTS.md) | Non-negotiable brand, security, accessibility, and scientific rules for AI coding agents |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, PostgreSQL schema, auth/RBAC, and API/player boundaries |
| [SETUP_LOCAL.md](./SETUP_LOCAL.md) | Detailed local setup, env vars, DB commands, and seeded synthetic QA accounts |
| [LAB_INTEGRATION_CONTRACT.md](./LAB_INTEGRATION_CONTRACT.md) | OpenAPI 3.1 / JSON Schema / `lab@1` integration protocol for Stage-2 3D rooms |
| [UX_CONTROL_INVENTORY.md](./UX_CONTROL_INVENTORY.md) | Usefulness-gate inventory of every visible interactive control |
| [FEATURE_TRACEABILITY_MATRIX.md](./FEATURE_TRACEABILITY_MATRIX.md) | All 39 rows (`F-01`..`F-15` & `G1-16`..`G1-39`) with verification status |
| [Deployment and recovery](./docs/release.md) | Preview, database, media and rollback workflow |
