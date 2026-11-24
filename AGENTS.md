# AGENTS.md — G1 Virtual Labs Project Rules

Every AI coding agent (Antigravity, Codex, or future specialist agents) working in this repository **must** follow these rules:

## 1. Non-Negotiable Brand & Visual Direction
- **Product Name:** Spell it **G1 Virtual Labs** everywhere.
- **Shared Logo:** Render the approved glossy G1 artwork via `src/components/BrandLogo.tsx`. The traced SVG supplies both the vector fallback and the 3D outlines. Preserve the previous `public/brand/g1-canonical-logo.png` for comparison and rollback.
- **Approved Bright Visual Direction:** Preserve the bright ice-white (`#F4FAFE`), clean card (`#FFFFFF`), dark navy ink (`#0C2444`), brand teal (`#007875`), and soft radial cyan-blue wash used in the approved website. Reject dark full-page wallpapers, neon clutter, fake dashboards, and decorative widgets.
- **Mode Semantics (Never Reverse):**
  - **Simulation Mode = BLUE (`#0E80D4` / accessible `#0663AB`)** — Guided curriculum practical.
  - **Experiment Mode = GREEN (`#058D60` / accessible `#046C49`)** — Bounded scientific inquiry.
  - Color must always supplement explicit text labels and icons, never act as the sole differentiator.

## 2. Usefulness Gate
- Every visible button, tab, filter, link, and control must execute a real action backed by a real route, state, or API. Update `UX_CONTROL_INVENTORY.md` whenever adding or modifying UI controls.
- Catalogue cards have **one** action (`View experiment →`). Mode selection occurs strictly on `/experiments/[experimentId]`. Homepage mode banners are non-clickable explanations.
- Never add fake promo videos, unverified ratings, unearned certificates, or fabricated analytics.

## 3. Scientific Authority & Andhra Pradesh Curriculum Discipline
- **AP = Andhra Pradesh** (English `en-IN` and Telugu `te-IN`). Never use Philippines/DepEd or US Advanced Placement labels.
- **Chemistry `AP-CHEM-10-2.3`:** Zinc (`Zn`) + **dilute sulfuric acid (`dilute_H2SO4`)** with gas routed to **soap solution**. Never substitute HCl or predict reaction kinetics, actual collected gas volume, pressure, or ignition.
- **Physics `AP-PHYS-10-9.10`:** Parallel glass slab refraction (`0–60°`, `10–30 mm`). Label ideal Snell results explicitly as theoretical pending physical calibration.
- **Biology `AP-BIO-09-5.1`:** Onion epidermis microscopy. Never fabricate cell length measurements (`422 CALIBRATION_MISSING` until rights-cleared calibrated micrographs are signed off).
- The browser renderer/UI **never** computes authoritative grades or mutates scientific state before server commit. Optional AI tutoring remains disabled (`ENABLE_OPTIONAL_TUTOR=false`) until legal, privacy, and cost approvals exist.

## 4. Security, Privacy & Local Boundaries
- Never store roles, auth tokens, or grades in `localStorage`. All protected routes and APIs enforce server-side session cookies (`httpOnly`, `SameSite=Lax`), `X-CSRF-Token`, `Idempotency-Key`, and PostgreSQL tenant/class ownership checks.
- Mask unauthorized cross-tenant / cross-class reads with HTTP `404 NOT_FOUND`.
- Enforce small-cell suppression (`< 5`) on district and state aggregate reports; never expose individual learner identifiers to district/state roles.
- Never commit `.env.local`, real student PII, or secrets. Use the official `kissu06101997-oss/G1-Virtual-Labs` remote. Develop, review visually and test locally, then publish only with explicit release approval. Do not touch any Unreal Engine or Unity project folders on `D:\`.

## 5. Accessibility (WCAG 2.2 AA & GIGW 3.0 Target)
- Every interactive laboratory action must remain 100% operable via keyboard and screen reader (`LabStageCanvas` Equipment List & 2D Accessible Controls) with identical API commands and rubric evaluation.
- Preserve visible `:focus-visible` outlines, 4.5:1 text contrast, `prefers-reduced-motion`, 200% zoom reflow, and proper Telugu script rendering (`Noto Sans Telugu`).
- Verify changes with `npm run typecheck`, `npm run test:unit`, `npm run build`, and `npm run test:e2e` (including `@axe-core/playwright`).
