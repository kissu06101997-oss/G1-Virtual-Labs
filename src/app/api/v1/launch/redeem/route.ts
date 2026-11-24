import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  extractIdempotencyKey,
  getCurrentSession,
  recordAuditEvent,
  verifyCsrf,
} from "@/lib/auth";
import { canonicalJson, newUuid, sha256Hex } from "@/lib/crypto";
import { withTransaction } from "@/lib/db";
import { createInitialSessionState } from "@/lib/science-adapters";
import type { ExperimentDefinition, LabMode, LabSubject, SessionContract } from "@/lib/types";

const redeemSchema = z
  .object({
    launchToken: z.string().min(32).max(1024),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required to redeem a launch grant.");
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

  const parsed = redeemSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "STATE_CONFLICT", "launchToken must be 32–1024 characters in POST body.");
  }

  const grantDigest = sha256Hex(parsed.data.launchToken);
  const scope = `redeem:${auth.principalId}`;

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
      if (existingIdem.rows[0].request_digest !== grantDigest) {
        return {
          status: 409,
          error: {
            reasonCode: "IDEMPOTENCY_MISMATCH" as const,
            detail: "Idempotency-Key already used for a different launch grant.",
          },
        };
      }
      return {
        status: existingIdem.rows[0].status_code,
        body: existingIdem.rows[0].response_body,
      };
    }

    // Row-lock the launch grant to prevent concurrent replay
    const grantRes = await client.query<{
      school_id: string;
      attempt_id: string;
      audience: string;
      expire_at: Date;
      redeemed_at: Date | null;
      principal_id: string;
      experiment_id: string;
      content_version: string;
      mode: LabMode;
      subject: LabSubject;
      manifest_digest: string;
      abi: string;
      definition: ExperimentDefinition;
    }>(
      `SELECT
         lg.school_id,
         lg.attempt_id,
         lg.audience,
         lg.expire_at,
         lg.redeemed_at,
         sl.principal_id,
         a.experiment_id,
         a.content_version,
         a.mode,
         ev.subject,
         ev.manifest_digest,
         ev.abi,
         ev.definition
       FROM launch_grant lg
       JOIN attempt a ON a.school_id = lg.school_id AND a.attempt_id = lg.attempt_id
       JOIN school_learner sl ON sl.school_id = a.school_id AND sl.learner_id = a.learner_id
       JOIN experiment_version ev
         ON ev.experiment_id = a.experiment_id AND ev.content_version = a.content_version
       WHERE lg.grant_digest = $1
       FOR UPDATE OF lg`,
      [grantDigest]
    );

    const row = grantRes.rows[0];
    if (!row || row.principal_id !== auth.principalId || row.school_id !== auth.schoolId) {
      return {
        status: 404,
        error: { reasonCode: "NOT_FOUND" as const, detail: "Launch grant not found." },
      };
    }

    if (row.redeemed_at) {
      await recordAuditEvent(
        {
          schoolId: row.school_id,
          actionType: "lab.launch_replay_blocked",
          actorId: auth.principalId,
          subjectKey: row.attempt_id,
        },
        client
      );
      return {
        status: 409,
        error: {
          reasonCode: "STATE_CONFLICT" as const,
          detail: "Launch token has already been redeemed (single-use replay blocked).",
        },
      };
    }

    if (row.expire_at.getTime() < Date.now()) {
      return {
        status: 410,
        error: { reasonCode: "SESSION_EXPIRED" as const, detail: "Launch token has expired." },
      };
    }

    await client.query(`UPDATE launch_grant SET redeemed_at = now() WHERE grant_digest = $1`, [
      grantDigest,
    ]);

    const sessionId = newUuid();
    const initialState = createInitialSessionState(row.definition, row.mode);
    const stateSha256 = sha256Hex(canonicalJson(initialState));
    const savedAt = new Date().toISOString();

    await client.query(
      `INSERT INTO lab_session (school_id, session_id, attempt_id, revision, state, status, saved_at)
       VALUES ($1, $2, $3, 0, $4::jsonb, 'active', $5)`,
      [row.school_id, sessionId, row.attempt_id, JSON.stringify(initialState), savedAt]
    );

    await client.query(
      `INSERT INTO checkpoint (school_id, session_id, revision, digest, state, saved_at)
       VALUES ($1, $2, 0, $3, $4::jsonb, $5)`,
      [row.school_id, sessionId, stateSha256, JSON.stringify(initialState), savedAt]
    );

    await client.query(
      `INSERT INTO event_outbox (event_id, school_id, event_type, resource_key, payload)
       VALUES ($1, $2, 'attempt.opened', $3, $4::jsonb)`,
      [
        newUuid(),
        row.school_id,
        sessionId,
        JSON.stringify({
          eventId: newUuid(),
          sessionId,
          attemptId: row.attempt_id,
          type: "attempt.opened",
          occurredAt: savedAt,
          revision: 0,
          idempotencyKey,
          evidenceIds: [],
          retentionClass: "attempt_record",
        }),
      ]
    );

    const sessionResponse: SessionContract = {
      sessionId,
      attemptId: row.attempt_id,
      revision: 0,
      labId: row.subject,
      experimentId: row.experiment_id,
      mode: row.mode,
      contentVersion: row.content_version,
      manifestSha256: row.manifest_digest,
      engineAbi: row.abi,
      status: "active",
      checkpoint: {
        revision: 0,
        stateSha256,
        snapshotPath: `/api/v1/sessions/${sessionId}/checkpoints/0`,
      },
      savedAt,
    };

    await client.query(
      `INSERT INTO idempotency_record (scope, idempotency_key, request_digest, status_code, response_body)
       VALUES ($1, $2, $3, 200, $4::jsonb)`,
      [scope, idempotencyKey, grantDigest, JSON.stringify(sessionResponse)]
    );

    return { status: 200, body: sessionResponse };
  });

  if ("error" in outcome && outcome.error) {
    return apiError(outcome.status, outcome.error.reasonCode, outcome.error.detail);
  }
  return NextResponse.json(outcome.body, { status: outcome.status });
}
