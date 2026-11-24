import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  extractIdempotencyKey,
  getCurrentSession,
  verifyCsrf,
} from "@/lib/auth";
import { canonicalJson, newUuid, sha256Hex } from "@/lib/crypto";
import { withTransaction } from "@/lib/db";
import { executeScienceAction, type LabSessionState } from "@/lib/science-adapters";
import type { ExperimentDefinition, LabActionResult, LabMode, LabSubject } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const unitEnum = z.enum(["mol", "umol", "mL", "g", "mm", "deg", "um", "px", "1", "K", "Pa"]);

const actionRequestSchema = z
  .object({
    sessionId: z.string().uuid(),
    labId: z.enum(["chemistry", "physics", "biology"]),
    experimentId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/),
    mode: z.enum(["simulation", "experiment"]),
    actorId: z.string().uuid(),
    targetObjectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/),
    actionType: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/),
    parametersWithUnits: z.record(
      z.string(),
      z
        .object({
          value: z.number().finite(),
          unit: unitEnum,
        })
        .strict()
    ),
    expectedRevision: z.number().int().min(0),
    receiverObjectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/).optional(),
    interactionPort: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/).optional(),
    reservationId: z.string().uuid().optional(),
    choiceId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/).optional(),
  })
  .strict();

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (!verifyCsrf(req, auth)) return apiError(400, "NOT_AUTHORIZED", "Missing or invalid X-CSRF-Token.");

  const idempotencyKey = extractIdempotencyKey(req);
  if (!idempotencyKey) {
    return apiError(400, "STATE_CONFLICT", "Idempotency-Key header (16–128 chars) is required.");
  }

  const { sessionId } = await context.params;
  if (!UUID_RE.test(sessionId)) {
    return apiError(404, "NOT_FOUND", "Session not found.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "STATE_CONFLICT", "Invalid JSON body.");
  }

  const parsed = actionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "INVALID_UNITS", "Lab action request failed schema or unit validation.");
  }

  const input = parsed.data;
  if (input.sessionId !== sessionId) {
    return apiError(400, "STATE_CONFLICT", "Body sessionId must match URL sessionId.");
  }
  if (input.actorId !== auth.principalId) {
    return apiError(403, "NOT_AUTHORIZED", "actorId must match authenticated session principal.");
  }

  const requestDigest = sha256Hex(canonicalJson(input));

  const outcome = await withTransaction(async (client) => {
    // Lock owning lab_session row
    const sessRes = await client.query<{
      school_id: string;
      session_id: string;
      attempt_id: string;
      revision: string;
      state: LabSessionState;
      status: string;
      experiment_id: string;
      mode: LabMode;
      subject: LabSubject;
      definition: ExperimentDefinition;
      owner_principal_id: string;
    }>(
      `SELECT
         ls.school_id,
         ls.session_id,
         ls.attempt_id,
         ls.revision::text,
         ls.state,
         ls.status,
         a.experiment_id,
         a.mode,
         ev.subject,
         ev.definition,
         sl.principal_id AS owner_principal_id
       FROM lab_session ls
       JOIN attempt a ON a.school_id = ls.school_id AND a.attempt_id = ls.attempt_id
       JOIN school_learner sl ON sl.school_id = a.school_id AND sl.learner_id = a.learner_id
       JOIN experiment_version ev
         ON ev.experiment_id = a.experiment_id AND ev.content_version = a.content_version
       WHERE ls.session_id = $1
       FOR UPDATE OF ls`,
      [sessionId]
    );

    const row = sessRes.rows[0];
    if (!row || row.school_id !== auth.schoolId || row.owner_principal_id !== auth.principalId) {
      return { kind: "error" as const, status: 404, reasonCode: "NOT_FOUND" as const, detail: "Session not found." };
    }

    const currentRev = Number(row.revision);

    // Check idempotency key on committed actions
    const prevAction = await client.query<{
      request_digest: string;
      result: LabActionResult;
    }>(
      `SELECT request_digest, result
       FROM lab_action
       WHERE school_id = $1 AND session_id = $2 AND idempotency_key = $3`,
      [row.school_id, row.session_id, idempotencyKey]
    );

    if (prevAction.rows[0]) {
      if (prevAction.rows[0].request_digest !== requestDigest) {
        const conflict: LabActionResult = {
          accepted: false,
          reasonCode: "IDEMPOTENCY_MISMATCH",
          committedRevision: currentRev,
          scientificStateDelta: [],
          objectStateDelta: [],
          observations: [],
          visualCueIds: [],
          audioCueIds: [],
          assessmentEvents: [],
          modelProvenance: null,
          uncertainty: {
            kind: "not_applicable",
            lower: null,
            upper: null,
            note: "Idempotency-Key reused with different action payload.",
          },
        };
        return { kind: "result" as const, status: 409, result: conflict };
      }
      return { kind: "result" as const, status: 200, result: prevAction.rows[0].result };
    }

    // Verify session is active
    if (row.status !== "active") {
      const closed: LabActionResult = {
        accepted: false,
        reasonCode: "STATE_CONFLICT",
        committedRevision: currentRev,
        scientificStateDelta: [],
        objectStateDelta: [],
        observations: [],
        visualCueIds: [],
        audioCueIds: [],
        assessmentEvents: [],
        modelProvenance: null,
        uncertainty: {
          kind: "not_applicable",
          lower: null,
          upper: null,
          note: `Session status is '${row.status}'; mutations are closed.`,
        },
      };
      return { kind: "result" as const, status: 409, result: closed };
    }

    // Verify subject/experiment/mode match pinned session
    if (row.subject !== input.labId || row.experiment_id !== input.experimentId || row.mode !== input.mode) {
      const wrongMode: LabActionResult = {
        accepted: false,
        reasonCode: "WRONG_MODE",
        committedRevision: currentRev,
        scientificStateDelta: [],
        objectStateDelta: [],
        observations: [],
        visualCueIds: [],
        audioCueIds: [],
        assessmentEvents: [],
        modelProvenance: null,
        uncertainty: {
          kind: "not_applicable",
          lower: null,
          upper: null,
          note: "Action labId, experimentId or mode does not match the pinned session.",
        },
      };
      return { kind: "result" as const, status: 422, result: wrongMode };
    }

    // Verify expectedRevision matches authoritative revision
    if (input.expectedRevision !== currentRev) {
      const conflict: LabActionResult = {
        accepted: false,
        reasonCode: "REVISION_CONFLICT",
        committedRevision: currentRev,
        scientificStateDelta: [],
        objectStateDelta: [],
        observations: [],
        visualCueIds: [],
        audioCueIds: [],
        assessmentEvents: [],
        modelProvenance: null,
        uncertainty: {
          kind: "not_applicable",
          lower: null,
          upper: null,
          note: `Retrieve confirmed checkpoint ${currentRev}.`,
        },
      };
      return { kind: "result" as const, status: 409, result: conflict };
    }

    // Execute bounded deterministic domain adapter
    const evalOut = executeScienceAction({
      request: input,
      definition: row.definition,
      currentRevision: currentRev,
      currentState: row.state,
    });

    if (!evalOut.result.accepted) {
      // Rejected action MUST NOT mutate state or advance revision!
      return { kind: "result" as const, status: evalOut.httpStatus, result: evalOut.result };
    }

    const nextRev = evalOut.result.committedRevision;
    const savedAt = new Date().toISOString();
    const stateDigest = sha256Hex(canonicalJson(evalOut.nextState));

    await client.query(
      `UPDATE lab_session
       SET revision = $1, state = $2::jsonb, saved_at = $3
       WHERE school_id = $4 AND session_id = $5`,
      [nextRev, JSON.stringify(evalOut.nextState), savedAt, row.school_id, row.session_id]
    );

    await client.query(
      `INSERT INTO lab_action
        (school_id, session_id, committed_revision, idempotency_key, request_digest, command, result, committed_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
      [
        row.school_id,
        row.session_id,
        nextRev,
        idempotencyKey,
        requestDigest,
        JSON.stringify(input),
        JSON.stringify(evalOut.result),
        savedAt,
      ]
    );

    for (const obs of evalOut.result.observations) {
      await client.query(
        `INSERT INTO observation (school_id, session_id, observation_id, revision, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [row.school_id, row.session_id, obs.observationId, nextRev, JSON.stringify(obs)]
      );
    }

    await client.query(
      `INSERT INTO checkpoint (school_id, session_id, revision, digest, state, saved_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [row.school_id, row.session_id, nextRev, stateDigest, JSON.stringify(evalOut.nextState), savedAt]
    );

    await client.query(
      `INSERT INTO event_outbox (event_id, school_id, event_type, resource_key, payload)
       VALUES ($1, $2, 'checkpoint.committed', $3, $4::jsonb)`,
      [
        newUuid(),
        row.school_id,
        `${row.session_id}:${nextRev}`,
        JSON.stringify({
          eventId: newUuid(),
          sessionId: row.session_id,
          attemptId: row.attempt_id,
          type: "checkpoint.committed",
          occurredAt: savedAt,
          revision: nextRev,
          idempotencyKey,
          evidenceIds: evalOut.result.observations.map((o) => o.observationId),
          retentionClass: "attempt_record",
        }),
      ]
    );

    return { kind: "result" as const, status: 200, result: evalOut.result };
  });

  if (outcome.kind === "error") {
    return apiError(outcome.status, outcome.reasonCode, outcome.detail);
  }
  return NextResponse.json(outcome.result, { status: outcome.status });
}
