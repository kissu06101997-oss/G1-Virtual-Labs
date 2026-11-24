# UX Control Inventory — G1 Virtual Labs (Upgraded Phase 2)

Every visible button, tab, link, input, and disclosure control in the upgraded application executes a real route, state change, or server API action. Zero decorative/fake controls exist.

| Route | Control / Component | Action & Backing Handler |
|---|---|---|
| Global Header (`AppHeader`) | G1 Virtual Labs logo (`BrandLogo`) | Navigates to `/` in the standard and player headers |
| Global Header (`AppHeader`) | Primary Nav (`Laboratories`, `For teachers`, `About`, `Help`, `Contact Us` and role links) | Opens the selected workspace, catalogue or public route. `Contact Us` opens `/contact` and its English label stays on one line. |
| Global Header (`AppHeader`) | `తెలుగు` or `English` (`LocaleToggle`) | Shows the language it switches to. `POST /api/locale` updates the `g1_locale` cookie and refreshes the current page. |
| Global Header (`AppHeader`) | `Student` | Opens `/student/profile` or signs a visitor in as a student first. |
| Global Header (`AppHeader`) | `Sign in` / Non-student role badge / `Sign out` | Routes to `/sign-in` or workspace; `POST /api/auth/sign-out` revokes DB session and redirects to `/` |
| Global Header (`AppHeader`) | Mobile Menu Toggle & Drawer | Opens/closes mobile navigation with `aria-current="page"` and `Escape` key dismissal + focus restoration |
| `/` (Homepage) | Explore by class (seven stage links) | Opens the class-specific chooser with three subject cards and a Back link to Home. The English row includes 1st Inter and 2nd Inter and scrolls on narrow screens. |
| `/` (Homepage) | `Browse laboratories →` and guest `Sign in` | Opens the laboratory catalogue or the student sign-in flow |
| `/` (Homepage) | Subject Cards (`Chemistry`, `Physics`, `Biology`) | Navigates to `/laboratories/chemistry`, `/laboratories/physics`, `/laboratories/biology` |
| `/` (Homepage) | Simulation and Experiment cards | Each entire card opens its own mode page at `/modes/simulation` or `/modes/experiment`. |
| `/` (Homepage) | Continue Learning | Entire cards resume or review up to three owned sessions. The signed-out card opens student sign-in. View all opens student activity. |
| `/modes/[mode]` | Practical links and launch | Selects a published practical and opens its guided journey or investigation through the existing authorized launcher. |
| `/laboratories` & `/laboratories/[subject]` | Illustrated Chemistry, Physics and Biology cards | The class chooser fixes the class on entry. The subject-first switcher keeps the selected class and clears the previous subject’s lesson. |
| `/laboratories/[subject]` | Keyword, class selector or fixed class badge, subject badge, Lesson, `Search`, `Clear filters` | The subject is fixed. Class is editable on the subject-first journey. Lesson options follow the current class and subject. Every Class and Lesson option uses the same subject-tinted fluid-glass treatment. Search submits URL filters. Clear preserves any fixed class. |
| `/laboratories` & `/laboratories/[subject]` | Full experiment card (`View experiment →`) | The visible link covers the entire card and opens the experiment overview. Detail, Simulation and the player carry the class, lesson and keyword for the in-app Back links. |
| `/experiments/[experimentId]` | `Start guided practical` / `Preview Simulation Mode` (Blue) | Calls `POST /api/v1/launch` (with pinned `contentVersion` & `manifestSha256`) → `POST /api/v1/launch/redeem` → `/player/[sessionId]` |
| `/experiments/[experimentId]` | `Start investigation` / `Preview Experiment Mode` (Green) | Same launch+redeem flow; disabled with explicit bilingual reason if disallowed by assignment, quota reached, locked past due, or review-pending |
| `/experiments/[experimentId]` | `Resume saved assignment session →` (when active) | Resumes existing open assignment session at `/player/[sessionId]` |
| `/experiments/[experimentId]` | Provenance `<details>` disclosure | Reveals experiment ID, science model ID, source edition references, and pinned manifest SHA-256 |
| `/player/[sessionId]` | Stage Pointer Hotspots (`stage-hotspot-*`), `Equipment list`, `Accessible controls` (2D DOM), `Check and continue`, `Run supported calculation`, `Record comparison` | All execute the exact same server action pipeline `POST /api/v1/sessions/[sessionId]/actions` with `X-CSRF-Token`, `Idempotency-Key`, and `expectedRevision` |
| `/player/[sessionId]` | `Reset view` | Resets canvas zoom and closes equipment drawer |
| `/player/[sessionId]` | `Retry pending action` / `Reconnect & sync` (`W05`) | Re-dispatches failed offline action with preserved `Idempotency-Key` or syncs latest confirmed server checkpoint |
| `/player/[sessionId]` | `Submit practical` | Calls `POST /api/v1/attempts/[attemptId]/submission` binding confirmed server observation IDs to rubric |
| `/student` | `Resume lab`, Assignment `Open`/`Resume lab`, expandable `View details` on `#results` | Resumes saved checkpoint, opens assignment-pinned detail page, expands own rubric criteria & confirmed observations + read-only session replay |
| `/teacher` | `+ Assign experiment`, `Preview`, `Inspect evidence`, `Open report & evidence` | Navigates to `/teacher/assignments`, `/experiments/[id]` (teacher preview), and `/teacher/reports` |
| `/teacher/assignments` | Assignment Builder (`class`, `experiment`, `Simulation`/`Experiment` checkboxes, IST date+time, `latePolicy`, `attemptLimit`, `Publish`, `Amend`) | Calls `POST /api/v1/teacher/classes/[classId]/assignments` creating version-pinned or immutable amended revision (`Rev #N`) |
| `/teacher/reports` | Class selector, Assignment filter, `Apply filter`, `Export audited CSV`, expandable `Inspect criteria & evidence`, `Open session replay` | Filters scoped reports, downloads formula-safe audited CSV, reveals criterion pass/fail and server observations |
| `/admin` | `Disable` / `Re-enable` (School Admin) | Calls `POST /api/admin/overview`, revokes active sessions on disable, writes `audit_event` |
| `/content` | Draft submission form + 5-point checklist (Editor); `Approve & publish`, `Rollback / Retire` (Reviewer) | Calls `POST /api/content/versions` and `POST /api/content/versions/[reviewId]/decision` enforcing two-person separation |
| `/help` | `Re-run check` (`DeviceCapabilityPanel`) | Queries `/api/health` and browser capabilities, updates live status region with IST timestamp |
# Local upgrade controls

| Surface | Controls and result |
| --- | --- |
| Home and Laboratories | The subject-only class chooser and the subject-first browser use different URL context. Keyword, class and lesson form submissions stay on the selected subject route. |
| Learning journey | Stage selection opens saved or next available content. Advance records the next server-verified milestone. Guided lab controls use the existing action API. The assessment submits five recorded choices once. |
| Experiment player | Record comparison executes a bounded engine action. Use control settings restores input values. Confirmed trial history reads saved results. |
| Student and teacher dashboards | Student progress links open the saved Simulation and the overview for unlocked experiments. Teachers can select an authorized class and open its roster. |
| Student account | Profile opens `/student/profile`. Save changes updates the signed-in student’s display name. Dashboard opens the existing student workspace at `/student`. |
| Student activity | Search, mode selection and pagination query owned history. Resume and Review open the existing authorized player. |
| Creator | Save draft and autosave persist revisions. Preview displays bilingual draft contents, validation shows specific errors, and submit starts independent review. Lesson and manifest controls validate the chosen mapping and model. |
| Media | Upload, pause, resume and cancel operate on a creator-owned local asset. A verified upload becomes selectable in the current editor tab. Playback controls and captions use verified media. |
| Help and About | Help searches its articles, links to the student and teacher workspaces and directs general inquiries to `/contact`. Diagnostics require an administrator session. |
| Contact Us | Back opens Home. The Email, Call and WhatsApp cards open the official channel. The inquiry form uses shared fluid-glass selection controls and records valid submissions through `POST /api/contact`. |
| Contact inquiries | Operator-only administration link opens `/admin/inquiries`. The inbox paginates saved inquiries and opens the inquiry’s email address in the operator’s mail app. |
