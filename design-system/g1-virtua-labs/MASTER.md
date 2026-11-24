# Design System Master File — G1 Scientific Observatory

> Maintain the current site’s shared color, type and interaction tokens.

---

**Project:** G1 Virtual Labs
**Design Direction:** G1 Scientific Observatory (Premium Bright Ice-White & Scientific Depth)
**Generated & Adapted:** 2026-11-22
**Token files:** `tokens.json`, `tokens.css`

---

## Global Rules & Tokens

### Color Palette (G1 Scientific Observatory)

| Role | Hex | CSS Variable | Contrast / Semantic Rule |
|------|-----|--------------|--------------------------|
| Page Canvas | `#F4FAFE` | `--g1-bg` / `--color-background` | Calm ice-white starting surface |
| Reading Surface / Card | `#FFFFFF` | `--g1-surface` / `--color-card` | Header, cards, tables, long reading |
| Warm Secondary Section | `#FBFAF5` | `--g1-surface-warm` | Quiet lower-content band |
| Ice Section | `#E6F2FA` | `--g1-ice-section` | Bounded hero & workspace accent (`radial-gradient(#D3E8F6, #E6F2FA 58%)`) |
| Deep Ice Stage | `#D8EAF4` | `--g1-deep-ice` | Apparatus & station backdrop inside white surround |
| Primary Navy Ink | `#0C2444` | `--g1-ink` / `--color-foreground` | Primary headings & body (>13:1 on white) |
| Secondary Slate Ink | `#38546C` | `--g1-ink-muted` / `--color-muted-foreground` | Supporting copy, labels, captions (>7.2:1 on white) |
| Brand Teal | `#007875` / `#00635F` | `--g1-teal` / `--g1-teal-dark` | Brand CTAs, active stage pill, active navigation (~5.3:1 with white text) |
| Simulation Mode (Blue) | `#0663AB` | `--g1-sim-blue` | Guided curriculum practical (~6.2:1 with white text); fill `#EAF5FF`, border `#C6E2F7` |
| Experiment Mode (Green) | `#046C49` | `--g1-exp-green` | Bounded scientific inquiry (~6.5:1 with white text); fill `#E8F7EF`, border `#C4E8D4` |
| Functional Boundary | `#7894AA` | `--g1-border-strong` | Interactive input/button boundaries (≥3:1 non-text contrast) |
| Panel Divider | `#CBDDE8` | `--g1-border` | Card and table dividers |
| Focus Ring | `#0663AB` | `--g1-focus-ring` | `3px solid #0663AB` with `3px` offset |
| Error Status | `#9B2119` on `#FFF1EE` | `--g1-error` / `--g1-error-bg` | Validation, admission rejection, offline warning |
| Pending / Review Status | `#805100` on `#FFF4D7` | `--g1-amber` / `--g1-amber-bg` | Under review, calibration pending, due warning |
| Confirmed / Saved Status | `#046C49` on `#E8F7EF` | `--g1-success` / `--g1-success-bg` | Server-confirmed checkpoint revision & verified evidence |

### Typography (Bilingual Latin + Telugu)

- **Latin Font:** `Inter`, system-ui, sans-serif (overruling raw UI/UX Pro Max `Exo` + `Roboto Mono` recommendation to preserve academic readability and tabular numeral clarity).
- **Telugu Font:** `Noto Sans Telugu`, sans-serif (`line-height: 1.32` headings, `1.65` body, `letter-spacing: 0` so Telugu ottulu/matras never clip).
- **Numeric Discipline:** `font-variant-numeric: tabular-nums` on all revision counters, deadlines (`Asia/Kolkata`), apparatus parameters, and report tables.

### Seven-Level Education Stage Deck (`EducationStageRail`)

- **Canonical Stages:**
  1. `class-6` (`Class 6` / `6వ తరగతి` — Grade 6)
  2. `class-7` (`Class 7` / `7వ తరగతి` — Grade 7)
  3. `class-8` (`Class 8` / `8వ తరగతి` — Grade 8)
  4. `class-9` (`Class 9` / `9వ తరగతి` — Grade 9)
  5. `class-10` (`Class 10` / `10వ తరగతి` — Grade 10)
  6. `intermediate-1` (`Intermediate 1st Year` / `ఇంటర్మీడియట్ 1వ సంవత్సరం` — Grade 11)
  7. `intermediate-2` (`Intermediate 2nd Year` / `ఇంటర్మీడియట్ 2వ సంవత్సరం` — Grade 12)
- **Tactile Dimensional Styling:** Raised 3D-style CSS pill buttons (`background: linear-gradient(180deg, #FFFFFF 0%, #EDF4F8 100%)`, `border: 1px solid #C5D9E6`, `box-shadow: 0 4px 0 #C8DBE6, 0 8px 16px rgba(12, 36, 68, 0.06)`), active state in Brand Teal (`linear-gradient(155deg, #0A8F8A 0%, #00635F 100%)`, `box-shadow: 0 4px 0 #034946, 0 10px 22px rgba(0, 120, 117, 0.28)`).

### Shared Brand Mark

The shared header uses the approved glossy G1 mark, wordmark and ® as a single link to Home. `BrandLogo` displays the SVG immediately and uses the same outlines for the desktop 3D render. The SVG covers touch layouts, reduced motion and unavailable WebGL.

### Layout & Breakpoint Rules

- **Container Cap:** `1440px` (`max-w-[1440px]`), responsive horizontal padding (`16px` mobile, `24px` tablet, `48px` desktop).
- **Header Breakpoint Guard (`768px`):** Compact navigation spacing and responsive action layout at `768px` so `Sign in` and language controls never clip or cause horizontal overflow (`scrollWidth <= clientWidth` at `1600`, `1440`, `1024`, `768`, `390`, `360`, and `320` CSS px).
- **Subject Hub Grid:** Balanced 2-column layout (`grid-cols-1 md:grid-cols-2`) when a subject hub has 2 cards, avoiding an orphan 3rd column.
- **Laboratory Player Layout:** 3-panel desktop layout (`270px` task/step rail, `minmax(0, 1fr)` apparatus viewport, `310px` evidence & submission notebook) collapsing cleanly into workflow order on tablet/mobile.
