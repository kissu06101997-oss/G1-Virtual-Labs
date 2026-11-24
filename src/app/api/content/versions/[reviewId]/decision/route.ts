import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getCurrentSession, recordAuditEvent, verifyCsrf } from "@/lib/auth";
import { canonicalJson, sha256Hex } from "@/lib/crypto";
import { withTransaction } from "@/lib/db";
import type { ExperimentDefinition } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const decisionSchema = z
  .object({
    decision: z.enum(["approved", "rework", "revoked"]),
    notes: z.string().min(3).max(500),
  })
  .strict();

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ reviewId: string }> }
) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (!verifyCsrf(req, auth)) return apiError(400, "NOT_AUTHORIZED", "Invalid CSRF token.");
  if (auth.role !== "content_reviewer") {
    return apiError(403, "NOT_AUTHORIZED", "Independent content reviewer role required.");
  }

  const { reviewId } = await context.params;
  if (!UUID_RE.test(reviewId)) return apiError(404, "NOT_FOUND", "Editorial review not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "STATE_CONFLICT", "Invalid JSON payload.");
  }
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "ACTION_UNSUPPORTED", "Review decision payload failed validation.");
  }

  const out = await withTransaction(async (client) => {
    const revRes = await client.query<{
      review_id: string;
      experiment_id: string;
      content_version: string;
      editor_principal_id: string;
      definition: ExperimentDefinition;
      status: string;
      published_at: Date | null;
      learning: unknown | null;
      manifest_digest: string;
    }>(
      `SELECT er.review_id, er.experiment_id, er.content_version, er.editor_principal_id, ev.definition,
              er.status, ev.published_at, lv.content AS learning, ev.manifest_digest
       FROM editorial_review er
       JOIN experiment_version ev
         ON ev.experiment_id = er.experiment_id AND ev.content_version = er.content_version
       LEFT JOIN learning_version lv ON lv.experiment_id = ev.experiment_id AND lv.content_version = ev.content_version
       WHERE er.review_id = $1
       FOR UPDATE OF er`,
      [reviewId]
    );
    const row = revRes.rows[0];
    if (!row) return { status: 404, reason: "NOT_FOUND" as const, detail: "Review record not found." };

    // Enforce two-person publication gate (AT-07)
    if (row.editor_principal_id === auth.principalId) {
      return {
        status: 403,
        reason: "NOT_AUTHORIZED" as const,
        detail: "Two-person publication rule: editor cannot independently approve their own draft.",
      };
    }

    if (row.learning && (
      (parsed.data.decision !== "revoked" && (row.status !== "submitted" || row.published_at)) ||
      (parsed.data.decision === "revoked" && row.status !== "approved")
    )) {
      return { status: 409, reason: "STATE_CONFLICT" as const, detail: "This version has already received a decision. Submit a new version to revise it." };
    }

    await client.query(
      `UPDATE editorial_review
       SET reviewer_principal_id = $1, status = $2, notes = $3, reviewed_at = now()
       WHERE review_id = $4`,
      [auth.principalId, parsed.data.decision, parsed.data.notes, reviewId]
    );

    if (parsed.data.decision === "approved") {
      const updatedDef: ExperimentDefinition = {
        ...row.definition,
        publicationStatus: "approved",
      };
      const digest = sha256Hex(canonicalJson(row.learning ? { definition: updatedDef, reviewedSubmission: row.manifest_digest } : updatedDef));
      await client.query(
        `UPDATE experiment_version
         SET definition = $1::jsonb, manifest_digest = $2, published_at = now(), retired_at = NULL
         WHERE experiment_id = $3 AND content_version = $4`,
        [JSON.stringify(updatedDef), digest, row.experiment_id, row.content_version]
      );
      if (row.learning) {
        await client.query(`UPDATE lab_lesson SET published_at = COALESCE(published_at, now())
          WHERE lesson_id IN (SELECT lesson_id FROM experiment_lesson WHERE experiment_id = $1 AND content_version = $2)`,
          [row.experiment_id, row.content_version]);
      }
    } else if (parsed.data.decision === "revoked") {
      // Rollback/retire leaves prior attempts replayable while blocking future launches
      await client.query(
        `UPDATE experiment_version
         SET retired_at = now()
         WHERE experiment_id = $1 AND content_version = $2`,
        [row.experiment_id, row.content_version]
      );
    }

    await recordAuditEvent(
      {
        schoolId: null,
        actionType: `content.review_${parsed.data.decision}`,
        actorId: auth.principalId,
        subjectKey: `${row.experiment_id}@${row.content_version}`,
      },
      client
    );

    return {
      status: 200,
      body: {
        reviewId,
        experimentId: row.experiment_id,
        contentVersion: row.content_version,
        status: parsed.data.decision,
      },
    };
  });

  if ("detail" in out && out.detail) {
    return apiError(out.status, out.reason, out.detail);
  }
  return NextResponse.json(out.body, { status: out.status });
}
