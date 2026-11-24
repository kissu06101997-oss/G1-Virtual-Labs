# Curriculum Stage Mapping — All 7 Education Levels

Source of truth: `src/lib/education-stages.ts` (verified by `tests/unit/education-stages.test.ts` and `tests/e2e/upgrade-w01-w13.spec.ts`).

## 1. Seven-Stage Structure & Actual Publication Coverage

| Order | Stage Slug (`stage=`) | DB / API `grade` | English Label | Telugu Label (`te-IN`) | Board / Curriculum Band | Subject Taxonomy | Current Local Catalogued Coverage | Honest UI Availability State |
|---:|---|---:|---|---|---|---|---|---|
| 1 | `class-6` | `6` | Class 6 | 6వ తరగతి | AP SCERT Upper Primary | General Science (Chemistry, Physics & Biology foundations) | 0 published, 0 preview | `Under review` (honest empty state) |
| 2 | `class-7` | `7` | Class 7 | 7వ తరగతి | AP SCERT Upper Primary | General Science (Chemistry, Physics & Biology foundations) | 0 published, 0 preview | `Under review` (honest empty state) |
| 3 | `class-8` | `8` | Class 8 | 8వ తరగతి | AP SCERT High School | Physical Science (Chemistry & Physics) · Biological Science | 0 launchable, 1 review-pending preview (`AP-BIO-08-2.1`) | `Preview only` |
| 4 | `class-9` | `9` | Class 9 | 9వ తరగతి | AP SCERT High School | Physical Science (Chemistry & Physics) · Biological Science | 1 launchable (`AP-BIO-09-5.1` Onion epidermis) | `Labs available` |
| 5 | `class-10` | `10` | Class 10 | 10వ తరగతి | AP SCERT Secondary (SSC) | Physical Science (Chemistry & Physics) · Biological Science | 2 launchable (`AP-CHEM-10-2.3`, `AP-PHYS-10-9.10`), 2 review-pending previews (`AP-CHEM-10-2.1`, `AP-PHYS-10-12.1`) | `Labs available` |
| 6 | `intermediate-1` | `11` | Intermediate 1st Year (`Inter 1st Year`) | ఇంటర్మీడియట్ 1వ సంవత్సరం (`ఇంటర్ 1వ సం.`) | BIEAP Junior Intermediate | Chemistry · Physics · Biology (Botany & Zoology) | 0 published, 0 preview | `Under review` (honest empty state) |
| 7 | `intermediate-2` | `12` | Intermediate 2nd Year (`Inter 2nd Year`) | ఇంటర్మీడియట్ 2వ సంవత్సరం (`ఇంటర్ 2వ సం.`) | BIEAP Senior Intermediate | Chemistry · Physics · Biology (Botany & Zoology) | 0 published, 0 preview | `Under review` (honest empty state) |

---

## 2. API & URL Query Compatibility
- `/laboratories` and `/laboratories/[subject]` accept both numeric `?grade=6`..`?grade=12` and semantic `?stage=class-6`..`?stage=intermediate-2`.
- `/api/v1/catalog` accepts `grade` (`6..12`) or `stage` (`class-6..intermediate-2`) alongside `labId`/`subject` and `q`.
- Selecting an unpublished stage (`Class 6`, `Class 7`, `Intermediate 1st Year`, `Intermediate 2nd Year`) displays an honest bilingual status card explaining that AP SCERT / BIEAP alignment and safety review are in progress, with one-click recovery buttons (`Reset filters` / `Explore Class 10 labs`).
- No placeholder practicals or fabricated approval badges are generated for unreviewed classes.
