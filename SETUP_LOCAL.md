# Local Setup Guide (Windows)

## Prerequisites

- **Node.js LTS** (verified on Node `v24.14.1` and npm `11.11.0`)
- **No external PostgreSQL or Docker installation required** for default local development (embedded PostgreSQL runs via `@electric-sql/pglite-socket`). A standalone PostgreSQL 16+ server is also supported by updating `DATABASE_URL` in `.env.local`.

## 1. Environment Configuration

Copy `.env.example` to `.env.local` if `.env.local` is not already present, and set a random 64-character hex `SESSION_SECRET`:

```powershell
Copy-Item .env.example .env.local
```

Default local settings in `.env.local`:
```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/g1_virtua_labs
G1_PG_HOST=127.0.0.1
G1_PG_PORT=54329
G1_PG_DATA_DIR=.data/pgdata
SESSION_SECRET=<64-hex-random-local-secret>
APP_ORIGIN=http://127.0.0.1:3000
ENABLE_OPTIONAL_TUTOR=false
ALLOW_LOCAL_SYNTHETIC_FIXTURES=true
```

## 2. Install Dependencies

```powershell
cd "E:\G1 Virtual Labs website"
npm ci
npx playwright install chromium
```

## 3. Launch Locally (One Command)

### Development mode
```powershell
npm run dev:local
```

### Production build mode
```powershell
npm run build
npm run start:local
```

Both commands automatically:
1. Start the embedded local PostgreSQL server on `127.0.0.1:54329` (if not already running).
2. Apply SQL migrations (`db/migrations/001_initial_schema.sql`).
3. Seed idempotent synthetic AP fixtures.
4. Launch the Next.js server at **http://127.0.0.1:3000**.

## 4. Database Management Commands

While the PostgreSQL server (`npm run db:start` or `dev:local`) is running:

```powershell
npm run db:migrate   # Apply pending SQL migrations
npm run db:seed      # Seed synthetic districts, schools, classes, users & experiments (idempotent)
npm run db:reset     # Drop public schema, re-migrate, and re-seed fresh synthetic state
```

## 5. Verification Commands

```powershell
npm run typecheck    # Strict TypeScript check
npm run test:unit    # Vitest science adapter & JSON Schema Draft 2020-12 contract tests
npm run build        # Clean Next.js production build
npm run test:e2e     # Full Playwright E2E + Axe WCAG 2.2 AA + cross-tenant security tests
```

> **Note:** Ensure the Next.js server (`http://127.0.0.1:3000`) and PostgreSQL server (`127.0.0.1:54329`) are running before executing `npm run test:e2e`. Run `node scripts/test-local-upgrade.mjs` to verify a production build with an isolated synthetic database.

## 6. Seeded Synthetic Local QA Accounts

> **Synthetic Fixtures Only:** No real student, teacher, or school data exists in this database. All accounts share the local development fixture password **`G1LocalTest!2026`**.

| Email | Role | Tenant Scope | Purpose |
|---|---|---|---|
| `student.a@school-guntur-01.test` | `student` | School A (Guntur), Class 10-A | Primary student workspace, seeded resumable Activity 2.3 session, 6 mode launches |
| `student.a2@school-guntur-01.test` … `student.a6@...` | `student` | School A (Guntur) | Populates School A with 6 active learners (`>= 5` threshold for aggregate reporting) and 1 pre-submitted fixture assessment |
| `student.b@school-vijayawada-02.test` | `student` | School B (Vijayawada), Class 10-A | Cross-school isolation + small-cell suppression (`1 < 5`) |
| `teacher.a@school-guntur-01.test` | `teacher` | School A, Class 10-A only | Teacher dashboard, assignment builder, class report, audited CSV export, same-school cross-class denial against Class 9-A |
| `teacher.b@school-vijayawada-02.test` | `teacher` | School B, Class 10-A | Cross-school denial tests against School A classes (`404`) |
| `schooladmin.a@school-guntur-01.test` | `school_admin` | School A | Roster enable/disable, device readiness profiles, school audit log |
| `district.guntur@ap-edu.test` | `district_admin` | Guntur District | District roll-up with small-cell suppression |
| `state.ap@ap-edu.test` | `state_admin` | Andhra Pradesh | Statewide aggregate roll-up with `< 5` small-cell suppression |
| `editor@g1virtualabs.test` | `content_editor` | Platform Editorial | Submit new draft experiment versions for review |
| `reviewer@g1virtualabs.test` | `content_reviewer` | Platform Editorial | Independent two-person approval and rollback |
