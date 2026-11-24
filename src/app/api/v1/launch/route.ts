import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  extractIdempotencyKey,
  getCurrentSession,
  recordAuditEvent,
  verifyCsrf,
} from "@/lib/auth";
import { canonicalJson, newUuid, randomToken, sha256Hex } from "@/lib/crypto";
import { withTransaction } from "@/lib/db";
import { isExperimentUnlocked } from "@/lib/learning";
import type { ExperimentDefinition } from "@/lib/types";

const launchRequestSchema = z
  .object({
    assignmentId: z.string().uuid().nullable(),
    experimentId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/),
    labId: z.enum(["chemistry", "physics", "biology"]),
    mode: z.enum(["simulation", "experiment"]),
    contentVersion: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/),
    manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    locale: z.enum(["en-IN", "te-IN"]),
    engineAbi: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required to launch a laboratory.");
  if (!verifyCsrf(req, auth)) return apiError(400, "NOT_AUTHORIZED", "Missing or invalid X-CSRF-Token.");

  const idempotencyKey = extractIdempotencyKey(req);
  if (!idempotencyKey) {
    return apiError(400, "STATE_CONFLICT", "Idempotency-Key header (16–128 chars) is required.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "STATE_CONFLICT", "Invalid JSON payload.");
  }

  const parsed = launchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "ACTION_UNSUPPORTED", "Launch request failed contract validation.");
  }

  const input = parsed.data;
  const requestDigest = sha256Hex(canonicalJson(input));
  const scope = `launch:${auth.principalId}`;

  if (auth.role !== "student" && auth.role !== "teacher") {
    return apiError(403, "NOT_AUTHORIZED", "Only students or teachers previewing a practical may launch a lab session.");
  }
  if (!auth.schoolId) {
    return apiError(403, "NOT_AUTHORIZED", "School context is required to launch a laboratory.");
  }

  const outcome = await withTransaction(async (client) => {
    // 1. Check idempotency record
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
            detail: "Idempotency-Key was previously used with a different launch payload.",
          },
        };
      }
      return {
        status: existingIdem.rows[0].status_code,
        body: existingIdem.rows[0].response_body,
      };
    }

    // 2. Verify experiment_version, manifest SHA-256 and engine ABI (AT-02)
    const expRes = await client.query<{
      subject: string;
      manifest_digest: string;
      abi: string;
      definition: ExperimentDefinition;
      published_at: Date | null;
      retired_at: Date | null;
    }>(
      `SELECT subject, manifest_digest, abi, definition, published_at, retired_at
       FROM experiment_version
       WHERE experiment_id = $1 AND content_version = $2`,
      [input.experimentId, input.contentVersion]
    );

    const expRow = expRes.rows[0];
    if (!expRow || expRow.subject !== input.labId) {
      return {
        status: 404,
        error: { reasonCode: "NOT_FOUND" as const, detail: "Experiment version not found for subject." },
      };
    }
    if (expRow.retired_at) {
      return {
        status: 410,
        error: { reasonCode: "VERSION_MISMATCH" as const, detail: "Experiment version has been retired." },
      };
    }
    if (expRow.definition.publicationStatus === "review_pending" || !expRow.published_at) {
      return {
        status: 422,
        error: {
          reasonCode: "MODEL_UNQUALIFIED" as const,
          detail: "Experiment is still under curriculum and scientific model review.",
        },
      };
    }
    if (expRow.manifest_digest !== input.manifestSha256 || expRow.abi !== input.engineAbi) {
      return {
        status: 409,
        error: {
          reasonCode: "VERSION_MISMATCH" as const,
          detail: "Manifest SHA-256 or engine ABI does not match the pinned immutable version.",
        },
      };
    }

    // 3. Resolve learner pseudonym within school scope (or teacher preview slot for unassigned preview)
    let learnerId = auth.learnerId;
    const isPreview = auth.role === "teacher";
    if (!learnerId && auth.role === "teacher") {
      if (input.assignmentId) {
        return {
          status: 403,
          error: {
            reasonCode: "NOT_AUTHORIZED" as const,
            detail: "Teachers preview experiments without attaching a student assignment.",
          },
        };
      }
      const existingPreview = await client.query<{ learner_id: string }>(
        `SELECT learner_id FROM school_learner WHERE school_id = $1 AND principal_id = $2`,
        [auth.schoolId, auth.principalId]
      );
      if (existingPreview.rows[0]) {
        learnerId = existingPreview.rows[0].learner_id;
      } else {
        learnerId = newUuid();
        await client.query(
          `INSERT INTO school_learner (school_id, learner_id, principal_id, grade, active)
           VALUES ($1, $2, $3, 10, true)`,
          [auth.schoolId, learnerId, auth.principalId]
        );
      }
    }

    if (!learnerId) {
      return {
        status: 403,
        error: { reasonCode: "NOT_AUTHORIZED" as const, detail: "No active school learner enrollment found." },
      };
    }

    if (!isPreview && input.mode === "experiment" &&
        !await isExperimentUnlocked(client, auth.schoolId!, learnerId, input.experimentId, input.contentVersion)) {
      return {
        status: 403,
        error: { reasonCode: "NOT_AUTHORIZED" as const, detail: "Complete Simulation Mode to unlock Experiment Mode for this version." },
      };
    }

    // 4. Validate assignment scope if assignmentId is supplied (W01 + W02)
    let classId: string | null = null;
    let isLate = false;
    if (input.assignmentId) {
      const assignRes = await client.query<{
        class_id: string;
        experiment_id: string;
        content_version: string;
        max_attempts: number;
        due_at: Date | null;
        late_policy: string;
      }>(
        `SELECT a.class_id, a.experiment_id, a.content_version, a.max_attempts, a.due_at,
                COALESCE(a.late_policy, 'allow_late_flagged') AS late_policy
         FROM assignment a
         JOIN enrollment e
           ON e.school_id = a.school_id
          AND e.class_id = a.class_id
          AND e.learner_id = $3
          AND e.withdrawn_at IS NULL
         JOIN assignment_mode am
           ON am.school_id = a.school_id
          AND am.assignment_id = a.assignment_id
          AND am.mode = $4::lab_mode
         WHERE a.school_id = $1 AND a.assignment_id = $2`,
        [auth.schoolId, input.assignmentId, learnerId, input.mode]
      );
      const assignRow = assignRes.rows[0];
      if (!assignRow) {
        return {
          status: 404,
          error: {
            reasonCode: "NOT_FOUND" as const,
            detail: "Assignment not found, learner not enrolled, or mode not enabled.",
          },
        };
      }
      if (
        assignRow.experiment_id !== input.experimentId ||
        assignRow.content_version !== input.contentVersion
      ) {
        return {
          status: 409,
          error: {
            reasonCode: "VERSION_MISMATCH" as const,
            detail: "Assignment pins a different experiment or content version.",
          },
        };
      }

      if (assignRow.due_at && new Date(assignRow.due_at).getTime() < Date.now()) {
        if (assignRow.late_policy === "block_new_after_due") {
          return {
            status: 409,
            error: {
              reasonCode: "STATE_CONFLICT" as const,
              detail: "Assignment due time (Asia/Kolkata) has passed and late launches are locked by class policy.",
            },
          };
        }
        isLate = true;
      }

      const countRes = await client.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt
         FROM attempt
         WHERE school_id = $1 AND learner_id = $2 AND assignment_id = $3 AND submitted_at IS NOT NULL`,
        [auth.schoolId, learnerId, input.assignmentId]
      );
      if (Number(countRes.rows[0]?.cnt ?? 0) >= assignRow.max_attempts) {
        return {
          status: 409,
          error: {
            reasonCode: "STATE_CONFLICT" as const,
            detail: "Maximum allowed attempts reached for this assignment.",
          },
        };
      }
      classId = assignRow.class_id;
    }

    // 5. Create new attempt and single-use hashed launch grant
    const attemptId = newUuid();
    await client.query(
      `INSERT INTO attempt
        (school_id, attempt_id, learner_id, assignment_id, class_id, experiment_id, content_version, mode, locale, opened_at, is_preview, is_late)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::lab_mode, $9, now(), $10, $11)`,
      [
        auth.schoolId,
        attemptId,
        learnerId,
        input.assignmentId,
        classId,
        input.experimentId,
        input.contentVersion,
        input.mode,
        input.locale,
        isPreview,
        isLate,
      ]
    );

    const launchToken = randomToken(36);
    const grantDigest = sha256Hex(launchToken);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const audience = process.env.APP_ORIGIN ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:3000");

    await client.query(
      `INSERT INTO launch_grant (grant_digest, school_id, attempt_id, audience, expire_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [grantDigest, auth.schoolId, attemptId, audience, expiresAt.toISOString()]
    );

    const responseBody = {
      launchToken,
      studentPseudonym: learnerId,
      labId: input.labId,
      experimentId: input.experimentId,
      mode: input.mode,
      attemptId,
      manifestSha256: expRow.manifest_digest,
      engineAbi: expRow.abi,
      expiresAt: expiresAt.toISOString(),
      locale: input.locale,
      isPreview,
      isLate,
    };

    await client.query(
      `INSERT INTO idempotency_record (scope, idempotency_key, request_digest, status_code, response_body)
       VALUES ($1, $2, $3, 200, $4::jsonb)`,
      [scope, idempotencyKey, requestDigest, JSON.stringify(responseBody)]
    );

    await recordAuditEvent(
      {
        schoolId: auth.schoolId,
        actionType: isPreview ? "lab.teacher_preview_issued" : "lab.launch_issued",
        actorId: auth.principalId,
        subjectKey: attemptId,
      },
      client
    );

    return { status: 200, body: responseBody };
  });

  if ("error" in outcome && outcome.error) {
    return apiError(outcome.status, outcome.error.reasonCode, outcome.error.detail);
  }
  return NextResponse.json(outcome.body, { status: outcome.status });
}
