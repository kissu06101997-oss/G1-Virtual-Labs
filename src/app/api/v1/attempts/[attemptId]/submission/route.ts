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
import { evaluateSubmissionRubric, type LabSessionState } from "@/lib/science-adapters";
import type { AssessmentContract, LabMode, LabSubject } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const submissionSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    rubricId: z.string().min(1).max(350),
    evidenceIds: z.array(z.string().uuid()).max(128),
  })
  .strict();

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (!verifyCsrf(req, auth)) return apiError(400, "NOT_AUTHORIZED", "Missing or invalid X-CSRF-Token.");

  const idempotencyKey = extractIdempotencyKey(req);
  if (!idempotencyKey) {
    return apiError(400, "STATE_CONFLICT", "Idempotency-Key header (16–128 chars) is required.");
  }

  const { attemptId } = await context.params;
  if (!UUID_RE.test(attemptId)) {
    return apiError(404, "NOT_FOUND", "Attempt not found.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "STATE_CONFLICT", "Invalid JSON body.");
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "ACTION_UNSUPPORTED", "Submission payload failed schema validation.");
  }

  const input = parsed.data;
  const requestDigest = sha256Hex(canonicalJson(input));
  const scope = `submit:${attemptId}`;

  const outcome = await withTransaction(async (client) => {
    const existingIdem = await client.query<{
      request_digest: string;
      status_code: number;
      response_body: unknown;
    }>(
      `SELECT request_digest, status_code, response_body
       FROM idempotency_record
       WHERE scope = $1 AND idempotency_key = $2`,
      [scope, idempotencyKey]
    );
    if (existingIdem.rows[0]) {
      if (existingIdem.rows[0].request_digest !== requestDigest) {
        return {
          status: 409,
          error: {
            reasonCode: "IDEMPOTENCY_MISMATCH" as const,
            detail: "Idempotency-Key reused with different submission payload.",
          },
        };
      }
      return { status: existingIdem.rows[0].status_code, body: existingIdem.rows[0].response_body };
    }

    const rowRes = await client.query<{
      school_id: string;
      attempt_id: string;
      assignment_id: string | null;
      class_id: string | null;
      mode: LabMode;
      submitted_at: Date | null;
      session_id: string;
      revision: string;
      state: LabSessionState;
      status: string;
      subject: LabSubject;
      owner_principal_id: string;
    }>(
      `SELECT
         a.school_id,
         a.attempt_id,
         a.assignment_id,
         a.class_id,
         a.mode,
         a.submitted_at,
         ls.session_id,
         ls.revision::text,
         ls.state,
         ls.status,
         ev.subject,
         sl.principal_id AS owner_principal_id
       FROM attempt a
       JOIN lab_session ls ON ls.school_id = a.school_id AND ls.attempt_id = a.attempt_id
       JOIN school_learner sl ON sl.school_id = a.school_id AND sl.learner_id = a.learner_id
       JOIN experiment_version ev
         ON ev.experiment_id = a.experiment_id AND ev.content_version = a.content_version
       WHERE a.attempt_id = $1
       FOR UPDATE OF ls`,
      [attemptId]
    );

    const row = rowRes.rows[0];
    if (!row || row.school_id !== auth.schoolId || row.owner_principal_id !== auth.principalId) {
      return { status: 404, error: { reasonCode: "NOT_FOUND" as const, detail: "Attempt not found." } };
    }

    const currentRev = Number(row.revision);
    if (row.submitted_at || row.status === "submitted") {
      // Check if an authoritative assessment already exists for this attempt+rubric
      const existingAssessment = await client.query<{ result: AssessmentContract }>(
        `SELECT result FROM assessment
         WHERE school_id = $1 AND attempt_id = $2 AND rubric_version = $3 AND supersedes_id IS NULL
         LIMIT 1`,
        [row.school_id, row.attempt_id, input.rubricId]
      );
      if (existingAssessment.rows[0]) {
        const existing = existingAssessment.rows[0].result;
        const contractResponse: AssessmentContract = {
          submissionId: existing.submissionId,
          attemptId: existing.attemptId,
          gradeState: existing.gradeState,
          rubricId: existing.rubricId,
          evidenceIds: existing.evidenceIds,
        };
        return { status: 200, body: contractResponse };
      }
      return {
        status: 409,
        error: {
          reasonCode: "STATE_CONFLICT" as const,
          detail: "Attempt has already been submitted.",
          currentRevision: currentRev,
        },
      };
    }

    if (input.expectedRevision !== currentRev) {
      return {
        status: 409,
        error: {
          reasonCode: "REVISION_CONFLICT" as const,
          detail: `Expected revision ${input.expectedRevision} does not match authoritative revision ${currentRev}.`,
          currentRevision: currentRev,
        },
      };
    }

    // Verify all submitted evidenceIds exist as authoritative server observations for this session
    const obsRes = await client.query<{ observation_id: string }>(
      `SELECT observation_id FROM observation WHERE school_id = $1 AND session_id = $2`,
      [row.school_id, row.session_id]
    );
    const ownedObs = new Set(obsRes.rows.map((r) => r.observation_id));
    for (const eid of input.evidenceIds) {
      if (!ownedObs.has(eid)) {
        return {
          status: 422,
          error: {
            reasonCode: "ACTION_UNSUPPORTED" as const,
            detail: `Evidence ID '${eid}' does not belong to confirmed observations of this session.`,
          },
        };
      }
    }

    // Use submitted verified evidence IDs (or all owned confirmed observations if client passed subset)
    const verifiedEvidenceIds =
      input.evidenceIds.length > 0 ? input.evidenceIds : Array.from(ownedObs);

    const evaluated = evaluateSubmissionRubric({
      subject: row.subject,
      mode: row.mode,
      rubricId: input.rubricId,
      state: row.state,
      confirmedEvidenceIds: verifiedEvidenceIds,
    });

    const submissionId = newUuid();
    const submittedAt = new Date().toISOString();

    const storedResult = {
      submissionId,
      attemptId: row.attempt_id,
      gradeState: evaluated.gradeState,
      rubricId: input.rubricId,
      evidenceIds: verifiedEvidenceIds,
      criteriaPassed: evaluated.criteriaPassed,
      criteriaTotal: evaluated.criteriaTotal,
      criteria: evaluated.criteria,
      summary: evaluated.summary,
    };

    await client.query(
      `INSERT INTO assessment (school_id, attempt_id, assessment_id, rubric_version, result, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [row.school_id, row.attempt_id, submissionId, input.rubricId, JSON.stringify(storedResult), submittedAt]
    );

    await client.query(
      `UPDATE attempt SET submitted_at = $1 WHERE school_id = $2 AND attempt_id = $3`,
      [submittedAt, row.school_id, row.attempt_id]
    );

    await client.query(
      `UPDATE lab_session SET status = 'submitted', saved_at = $1 WHERE school_id = $2 AND session_id = $3`,
      [submittedAt, row.school_id, row.session_id]
    );

    await client.query(
      `INSERT INTO event_outbox (event_id, school_id, event_type, resource_key, payload)
       VALUES ($1, $2, 'assessment.submitted', $3, $4::jsonb)`,
      [
        newUuid(),
        row.school_id,
        row.attempt_id,
        JSON.stringify({
          eventId: newUuid(),
          sessionId: row.session_id,
          attemptId: row.attempt_id,
          type: "assessment.submitted",
          occurredAt: submittedAt,
          revision: currentRev,
          idempotencyKey,
          evidenceIds: verifiedEvidenceIds,
          retentionClass: "attempt_record",
        }),
      ]
    );

    // Refresh class report_projection when linked to an assignment
    if (row.assignment_id && row.class_id) {
      const countRes = await client.query<{ submitted_count: string }>(
        `SELECT count(*)::text AS submitted_count
         FROM assessment asm
         JOIN attempt att ON att.school_id = asm.school_id AND att.attempt_id = asm.attempt_id
         WHERE asm.school_id = $1 AND att.assignment_id = $2 AND asm.supersedes_id IS NULL`,
        [row.school_id, row.assignment_id]
      );
      await client.query(
        `INSERT INTO report_projection (school_id, class_id, assignment_id, refreshed_at, payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (school_id, class_id, assignment_id)
         DO UPDATE SET refreshed_at = EXCLUDED.refreshed_at, payload = EXCLUDED.payload`,
        [
          row.school_id,
          row.class_id,
          row.assignment_id,
          submittedAt,
          JSON.stringify({
            submittedCount: Number(countRes.rows[0]?.submitted_count ?? 0),
            lastSubmissionId: submissionId,
          }),
        ]
      );
    }

    const contractResponse: AssessmentContract = {
      submissionId,
      attemptId: row.attempt_id,
      gradeState: evaluated.gradeState,
      rubricId: input.rubricId,
      evidenceIds: verifiedEvidenceIds,
    };

    await client.query(
      `INSERT INTO idempotency_record (scope, idempotency_key, request_digest, status_code, response_body)
       VALUES ($1, $2, $3, 200, $4::jsonb)`,
      [scope, idempotencyKey, requestDigest, JSON.stringify(contractResponse)]
    );

    return { status: 200, body: contractResponse };
  });

  if ("error" in outcome && outcome.error) {
    return apiError(
      outcome.status,
      outcome.error.reasonCode,
      outcome.error.detail,
      outcome.error.currentRevision ?? null
    );
  }
  return NextResponse.json(outcome.body, { status: outcome.status });
}
