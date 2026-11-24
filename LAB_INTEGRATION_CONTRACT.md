# Lab Integration Contract (`lab@1` Engine ABI)

This contract defines the exact runtime boundary between the **G1 Virtual Labs Website Foundation** (shipped in Gate W) and future **3D Browser Laboratory Scene Packs & Validated Scientific Adapters** (to be built by Codex in Stage 2 — Gates B, C, and S) without modifying the website routes, authentication, or PostgreSQL schema.

## 1. Architectural Boundary

- **The Website & API own:** Identity, school/class authorization, pinned immutable experiment manifests (`experiment_version`), single-use launch grants (`launch_grant`), authoritative session revisions (`lab_session`), transactional action ledger (`lab_action`), verified observations (`observation`), immutable checkpoints (`checkpoint`), deterministic rubric evaluation (`assessment`), and teacher/admin reports.
- **Future 3D Scene Packs own:** Loading fingerprinted `.glb`/KTX2 apparatus meshes (Babylon.js WebGL2 provisional candidate after 4 GB hardware pilot; Three.js fallback), rendering confirmed state deltas and `visualCueIds`, single-pointer / wrist-only PPE hand interaction, camera reset, and emitting typed `LabActionRequest` intents to the API.
- **Invariant:** The 3D renderer **never** mutates scientific state locally as authoritative truth, **never** computes scores, and **never** plays reaction FX before server commit (`accepted: true`). Every visual object/port action has an identical 2D keyboard/DOM equivalent (`LabStageCanvas.tsx`).

## 2. REST Endpoints (`/api/v1`)

All endpoints strictly follow `specs/website_lab_api.openapi.yaml` and the 4 Draft 2020-12 JSON Schemas in `specs/`.

| Method & Path | Auth & Headers | Purpose | Key Status Codes |
|---|---|---|---|
| `GET /api/v1/catalog` | Public (`?labId=&grade=&locale=&q=&meta=1`) | List experiment definitions (`ExperimentDefinition[]`) | `200`, `400` |
| `POST /api/v1/launch` | Session cookie + `X-CSRF-Token` + `Idempotency-Key` | Validate manifest SHA-256, ABI (`lab@1`), mode & enrollment; issue single-use `launchToken` | `200`, `401`, `403`, `404`, `409` (`VERSION_MISMATCH` / `IDEMPOTENCY_MISMATCH`), `410`, `422` (`MODEL_UNQUALIFIED`) |
| `POST /api/v1/launch/redeem` | Session cookie + `X-CSRF-Token` + `Idempotency-Key` | Same-origin POST body `{ launchToken }` (NEVER in URL); atomically redeem once, create `lab_session` + checkpoint rev 0 | `200`, `404`, `409` (replay blocked), `410` (expired) |
| `GET /api/v1/sessions/{sessionId}` | Owning learner or assigned class teacher | Read confirmed session (`?include=full` returns state, observations & assessment) | `200`, `401`, `404` (cross-tenant masked) |
| `POST /api/v1/sessions/{sessionId}/actions` | Owning learner + `X-CSRF-Token` + `Idempotency-Key` | Lock session row, check idempotency & `expectedRevision`, run bounded science adapter, commit delta/observation/checkpoint/outbox | `200`, `404`, `409` (`REVISION_CONFLICT` / `IDEMPOTENCY_MISMATCH` / `STATE_CONFLICT`), `422` (`BAD_PORT` / `INCOMPATIBLE_MATERIAL` / `OUTSIDE_DOMAIN` / `INVALID_UNITS` / `CALIBRATION_MISSING`) |
| `GET /api/v1/sessions/{sessionId}/checkpoints/{revision}` | Owning learner or assigned class teacher | Read immutable revision state & canonical SHA-256 digest | `200`, `404` |
| `POST /api/v1/attempts/{attemptId}/submission` | Owning learner + `X-CSRF-Token` + `Idempotency-Key` | Verify owned `evidenceIds`, evaluate server rubric, insert exactly one `assessment`, refresh `report_projection` | `200`, `404`, `409`, `422` |
| `POST /api/v1/teacher/classes/{classId}/assignments` | Assigned class teacher + `X-CSRF-Token` + `Idempotency-Key` | Publish version-pinned assignment with modes, rubric, dueAt, attemptLimit, locale bundle | `200`, `403`, `404`, `409`, `422` |
| `GET /api/v1/teacher/classes/{classId}/reports` | Assigned class teacher or same-school admin | Scoped class `Assessment[]` (`?detail=1` enriched; `?format=csv` audited export) | `200`, `403`, `404` (cross-school/cross-class masked) |

## 3. Exact Payload Examples

### 3.1 Launch Request (`POST /api/v1/launch`)
```json
{
  "assignmentId": null,
  "experimentId": "AP-PHYS-10-9.10",
  "labId": "physics",
  "mode": "experiment",
  "contentVersion": "0.1.0-research",
  "manifestSha256": "<64-hex-manifest-digest-from-catalog-meta>",
  "locale": "te-IN",
  "engineAbi": "lab@1"
}
```

### 3.2 Action Request (`POST /api/v1/sessions/{sessionId}/actions`)
```json
{
  "sessionId": "5c55a6fc-533f-44bf-b08b-ed61c639f0b0",
  "labId": "physics",
  "experimentId": "AP-PHYS-10-9.10",
  "mode": "experiment",
  "actorId": "a1000001-0000-4000-8000-000000000001",
  "targetObjectId": "phys.glass-slab:1",
  "actionType": "select_incident_ray",
  "parametersWithUnits": {
    "angle": { "value": 45, "unit": "deg" },
    "slabThickness": { "value": 20, "unit": "mm" }
  },
  "expectedRevision": 1
}
```

### 3.3 Accepted Action Result (`200 OK`)
```json
{
  "accepted": true,
  "reasonCode": "OK",
  "committedRevision": 2,
  "scientificStateDelta": [
    { "path": "/optics/refractedAngleDeg", "operation": "set", "value": 28.1255 },
    { "path": "/optics/emergentAngleDeg", "operation": "set", "value": 45 },
    { "path": "/optics/transverseOffsetMm", "operation": "set", "value": 6.5829 }
  ],
  "objectStateDelta": [
    { "path": "/optics/incidentAngleDeg", "operation": "set", "value": 45 },
    { "path": "/optics/slabThicknessMm", "operation": "set", "value": 20 }
  ],
  "observations": [
    {
      "observationId": "<uuid>",
      "metric": "transverse_offset_theoretical",
      "value": { "value": 6.5829, "unit": "mm" },
      "uncertainty": {
        "kind": "unknown",
        "lower": null,
        "upper": null,
        "note": "Ideal analytic Snell calculation (n_air=1.000, n_glass=1.500); independent physical slab and protractor calibration pending."
      }
    }
  ],
  "visualCueIds": ["ray-overlay-update"],
  "audioCueIds": [],
  "assessmentEvents": ["phys.ray.computed"],
  "modelProvenance": {
    "modelId": "PHYS-SLAB-RAY",
    "modelVersion": "0.1.0",
    "qualification": "theoretical",
    "sourceIds": ["AP-REF-10-PS", "R-SNELL"]
  },
  "uncertainty": {
    "kind": "unknown",
    "lower": null,
    "upper": null,
    "note": "Ideal analytic Snell calculation (n_air=1.000, n_glass=1.500); independent physical slab and protractor calibration pending."
  }
}
```

### 3.4 Conflict Recovery (`409 REVISION_CONFLICT`)
On `409 REVISION_CONFLICT`, `accepted` is `false`, deltas and observations are guaranteed empty, and `committedRevision` identifies the confirmed revision to fetch via `GET /api/v1/sessions/{sessionId}/checkpoints/{committedRevision}`.

## 4. Subject Station Object IDs & Visual Cue Registry

| Subject | Scene ID | Canonical `targetObjectId` Values | Server-Emitted `visualCueIds` |
|---|---|---|---|
| Chemistry (`AP-CHEM-10-2.3`) | `room-chemistry@1` | `chem.reaction-tube:1`, `chem.stand:1`, `chem.transfer:1`, `chem.gas-observation:1` | `apparatus-connected`, `reagent-confirmed`, `bubbles-soap-solution`, `ledger-updated` |
| Physics (`AP-PHYS-10-9.10`) | `room-physics@1` | `phys.glass-slab:1`, `phys.raycard:1`, `phys.protractor:1`, `phys.ruler:1` | `slab-mounted`, `ray-overlay-update` |
| Biology (`AP-BIO-09-5.1`) | `room-biology@1` | `bio.compound-microscope:1`, `bio.prepared-onion-slide:1`, `bio.image-view:1`, `bio.scale-overlay:1` | `bio-field-0..2`, `bio-plane-0..2`, `bio-annotated-cell_wall` |

## 5. Error Code Catalogue

| HTTP | `reasonCode` | Meaning |
|---|---|---|
| `401` | `NOT_AUTHORIZED` | Missing or expired HTTP-only session cookie |
| `403` | `NOT_AUTHORIZED` | Valid login but insufficient role or principal mismatch |
| `404` | `NOT_FOUND` | Absent resource or masked cross-tenant / cross-class attempt |
| `409` | `REVISION_CONFLICT` | Stale `expectedRevision`; client must fetch checkpoint at `committedRevision` |
| `409` | `VERSION_MISMATCH` | `manifestSha256` or `engineAbi` does not match immutable version |
| `409` | `IDEMPOTENCY_MISMATCH` | Reused `Idempotency-Key` with different canonical payload SHA-256 |
| `409` | `STATE_CONFLICT` | Token already redeemed or session already submitted |
| `410` | `SESSION_EXPIRED` | Launch token expired or experiment version retired |
| `422` | `BAD_PORT` | Invalid connection port (e.g. `port_open_air`) or unmounted optic |
| `422` | `INCOMPATIBLE_MATERIAL` | Unsupported reagent (e.g. HCl, HNO₃) blocked without mutation |
| `422` | `INVALID_UNITS` | Parameter unit does not match scientific model specification |
| `422` | `OUTSIDE_DOMAIN` | Input exceeds admitted variable range/step |
| `422` | `CALIBRATION_MISSING` | Quantitative Biology measurement blocked pending calibrated micrograph dataset |
| `422` | `MODEL_UNQUALIFIED` | Experiment is `review_pending` and locked against student launch |
| `429` | `RATE_LIMITED` | Authentication rate limit exceeded |
