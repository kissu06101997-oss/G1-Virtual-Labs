# Feature Traceability Matrix — G1 Virtual Labs (All 39 Rows)

Updated after Phase 2 Premium Upgrade (W01–W13). Every row reflects verified local synthetic QA status honestly separated from future Stage-2 gates.

| ID | Requirement / Capability | Status After Upgrade | Verification Evidence |
|---|---|---|---|
| **F-01** | Bilingual subject hubs & filterable 7-stage curriculum catalogue | **WORKS** | `U01`, `U02`, `AT-01`; balanced 2-col subject hubs, 7 stages, URL Back history |
| **F-02** | Experiment overview, objectives, citation, safety, modes & status | **WORKS** | `U03`, `AT-01`; clear edition/review badges, provenance disclosure, assignment scope |
| **F-03** | Separate Simulation (Blue) & Experiment (Green) modes with pinned version | **WORKS** | `U03`, `AT-02`; W01 one-mode lock & older pinned version launch after newer publish |
| **F-04** | Sequential guided mission, objectives, instructions & hints | **PARTIAL** | `AT-02`, `U04`; full 5-step guided flow & hints working; expanded theory chapters staged |
| **F-05** | Server checkpoint, reload resume & stale-revision recovery | **WORKS** | `AT-02`, `U04`; reload preserves revision & evidence; 409 conflict syncs checkpoint |
| **F-06** | Versioned bounded server science models & qualification guards | **WORKS** | 8 Vitest adapter tests + `AT-02` 422 guards (`HCl`, `75°`, `CALIBRATION_MISSING`) |
| **F-07** | Confirmed evidence submission, rubric feedback & single report receipt | **WORKS** | `AT-02`, `AT-03`, `U03`; criterion-level breakdown on student & teacher views |
| **F-08** | Scoped assignment publication with modes, IST schedule, per-mode rubric & attempts | **WORKS** | `U03`, `AT-03`; per-mode rubric, IST time, overdue policy & publish preview |
| **F-09** | Scoped class reporting, evidence drill-down & audited formula-safe CSV | **WORKS** | `U03`, `AT-03`; class switcher, assignment filter, criterion/observation trace, masked 404 |
| **F-10** | School roster & district/state aggregates with small-cell suppression (`< 5`) | **PARTIAL** | `U04`, `AT-04`; roster toggle + instant revoke + IST freshness verified; full provisioning staged |
| **F-11** | Equivalent keyboard/2D DOM action path, Telugu script & reduced motion | **WORKS** | `AT-01`, `AT-02`, `U02`, `U04`; 0 Axe WCAG 2.2 AA violations; manual AT QA pending |
| **F-12** | Two-person publication workflow, rights checklist, history & rollback | **WORKS** | `U03`, `AT-07`; self-approval blocked, checklist & linked attempt replay counts shown |
| **F-13** | CSRF, manifest/ABI match & one-use hashed launch grants | **WORKS** | `AT-07` API invariants; manifest mismatch 409, token replay 409, no grant in URL |
| **F-14** | Qualified 3D WebGL/Babylon scene runtime & 4/8/16 GB device gates | **FUTURE LAB** | Deferred Stage-2 gate; neutral stage preserves typed `LabStageCanvas` boundary |
| **F-15** | External LMS integration (1EdTech LTI 1.3 / AGS) | **DEFERRED** | Honestly disclosed as inactive; event outbox contract preserved |
| **G1-16** | Additional course/skill taxonomy filters | **PARTIAL** | Subject, 7-stage class, availability & free-text live; skill tags gated on AP review |
| **G1-17** | Fully bilingual English/Telugu critical tasks & error feedback | **PARTIAL** | Full `te-IN` implemented across all pages & tasks (`U02`); native educator review pending |
| **G1-18** | Multi-role / multi-school context switching | **PARTIAL** | API `requestedRole` added in `/api/auth/sign-in`; multi-school UI switcher staged |
| **G1-19** | Dedicated Teacher Preview separated from student assignment/grade | **WORKS** | `U03`; `Teacher Preview Mode` badge, `Preview` CTA labels, `attempt.is_preview = true` |
| **G1-20** | Immutable assignment amendment retaining prior pinned attempts | **WORKS** | `U03`; `Rev #2` created with `supersedes_assignment_id` preserving prior attempts |
| **G1-21** | Student-owned result history with criterion & observation drill-down | **WORKS** | `U03`; expandable rubric criteria & confirmed observations on `/student#results` |
| **G1-22** | Scaffolded theory, independent concept checks & reflection notebook | **PARTIAL** | Observation notebook & CER reflection selector live; extra concept quizzes staged |
| **G1-23** | Inquiry variable controls, 2-trial comparison table & uncertainty disclosure | **PARTIAL** | Control vs Comparison table live (`U04`); plots gated on calibrated quantitative datasets |
| **G1-24** | Truthful offline notice, preserved checkpoint & one-click retry | **WORKS** | `U04`; 0 uncaught errors, amber offline banner/badge, `Retry pending action` verified |
| **G1-25** | School admin roster, disable/revoke & audit confirmation | **PARTIAL** | Disable revokes active sessions immediately + writes audit log; bulk import staged |
| **G1-26** | District/state aggregate roll-up with provenance, freshness & suppression | **PARTIAL** | IST freshness timestamp & `< 5` suppression verified (`U04`); rollout operations staged |
| **G1-27** | AP candidate/edition/version disclosure before approved claims | **PARTIAL** | Honest `research_fixture` / `review_pending` / `Under review` badges; AP sign-off pending |
| **G1-28** | Production governance, DPDP compliance, RLS & security sign-off | **DEFERRED** | Gated for real school deployment |
| **G1-29** | Physical school hardware load & disaster recovery benchmarks | **DEFERRED** | Gated for deployment infrastructure phase |
| **G1-30** | Optional filtered AI tutor remains disabled by default | **WORKS** | `/api/health` confirms `optionalTutorEnabled: false`; zero learner AI controls |
| **G1-31** | Real physical apparatus calibration & rights-cleared micrograph datasets | **FUTURE LAB** | Deferred Stage-2 scientific qualification gate |
| **G1-32** | Exact canonical logo, G1 Scientific Observatory palette & mode colors | **WORKS** | `U01`, `U04`; SHA-256 verified, 0 Axe contrast violations |
| **G1-33** | Header navigation, mobile menu `Escape` close, Help readiness check | **WORKS** | `U02`; mobile `Escape` + `aria-current="page"`, Help IST status check |
| **G1-34** | Pointer hotspot & keyboard/2D DOM action parity | **WORKS** | `U03`, `U04`, `AT-02`; stage hotspots & 2D DOM call identical `dispatchAction` |
| **G1-35** | Practice attempts clearly separated from graded class assignments | **WORKS** | `U03`; `Class Assignment` vs `Personal Practice` tags & scoped class reports |
| **G1-36** | Exact content readiness & preview lock across all subjects | **WORKS** | `AT-01`, `U01`; all 3 `review_pending` details lock both launch buttons |
| **G1-37** | Real HTTP-only session cookies, logout & active role/revocation checks | **WORKS** | `AT-02`, `W04`; revoked grants & disabled principals immediately lose access |
| **G1-38** | Responsive layout across `1600`, `768`, `390`, `360` without clipping | **WORKS** | `U02`; 768px Sign in unclipped, 0 horizontal overflow on all tested viewports |
| **G1-39** | Educator-approved learning efficacy study | **DEFERRED** | Requires formal classroom pilot after website acceptance |
