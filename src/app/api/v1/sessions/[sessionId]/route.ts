import { NextRequest, NextResponse } from "next/server";
import { apiError, getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import type { LabMode, LabSubject, SessionContract } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");

  const { sessionId } = await context.params;
  if (!UUID_RE.test(sessionId)) {
    return apiError(404, "NOT_FOUND", "Session not found.");
  }

  const res = await query<{
    school_id: string;
    session_id: string;
    attempt_id: string;
    revision: string;
    state: Record<string, unknown>;
    status: "active" | "paused" | "submitted" | "revoked";
    saved_at: Date;
    experiment_id: string;
    content_version: string;
    mode: LabMode;
    class_id: string | null;
    subject: LabSubject;
    manifest_digest: string;
    abi: string;
    owner_principal_id: string;
    checkpoint_digest: string | null;
  }>(
    `SELECT
       ls.school_id,
       ls.session_id,
       ls.attempt_id,
       ls.revision::text,
       ls.state,
       ls.status,
       ls.saved_at,
       a.experiment_id,
       a.content_version,
       a.mode,
       a.class_id,
       ev.subject,
       ev.manifest_digest,
       ev.abi,
       sl.principal_id AS owner_principal_id,
       cp.digest AS checkpoint_digest
     FROM lab_session ls
     JOIN attempt a ON a.school_id = ls.school_id AND a.attempt_id = ls.attempt_id
     JOIN school_learner sl ON sl.school_id = a.school_id AND sl.learner_id = a.learner_id
     JOIN experiment_version ev
       ON ev.experiment_id = a.experiment_id AND ev.content_version = a.content_version
     LEFT JOIN checkpoint cp
       ON cp.school_id = ls.school_id AND cp.session_id = ls.session_id AND cp.revision = ls.revision
     WHERE ls.session_id = $1`,
    [sessionId]
  );

  const row = res.rows[0];
  if (!row || row.school_id !== auth.schoolId) {
    // Mask cross-tenant resource existence with 404
    return apiError(404, "NOT_FOUND", "Session not found.");
  }

  let authorized = row.owner_principal_id === auth.principalId;
  if (!authorized && auth.role === "teacher" && row.class_id) {
    const ct = await query(
      `SELECT 1 FROM class_teacher WHERE school_id = $1 AND class_id = $2 AND principal_id = $3`,
      [row.school_id, row.class_id, auth.principalId]
    );
    authorized = ct.rows.length > 0;
  }

  if (!authorized) {
    return apiError(404, "NOT_FOUND", "Session not found.");
  }

  const rev = Number(row.revision);
  const sessionContract: SessionContract = {
    sessionId: row.session_id,
    attemptId: row.attempt_id,
    revision: rev,
    labId: row.subject,
    experimentId: row.experiment_id,
    mode: row.mode,
    contentVersion: row.content_version,
    manifestSha256: row.manifest_digest,
    engineAbi: row.abi,
    status: row.status,
    checkpoint: {
      revision: rev,
      stateSha256: row.checkpoint_digest ?? "0".repeat(64),
      snapshotPath: `/api/v1/sessions/${row.session_id}/checkpoints/${rev}`,
    },
    savedAt: row.saved_at.toISOString(),
  };

  const includeState = new URL(req.url).searchParams.get("include") === "full";
  if (!includeState) {
    return NextResponse.json(sessionContract);
  }

  const obsRes = await query<{ data: unknown }>(
    `SELECT data FROM observation WHERE school_id = $1 AND session_id = $2 ORDER BY revision ASC, observation_id ASC`,
    [row.school_id, row.session_id]
  );

  const assessRes = await query<{ result: unknown }>(
    `SELECT result FROM assessment WHERE school_id = $1 AND attempt_id = $2 AND supersedes_id IS NULL LIMIT 1`,
    [row.school_id, row.attempt_id]
  );

  return NextResponse.json({
    session: sessionContract,
    state: row.state,
    observations: obsRes.rows.map((r) => r.data),
    assessment: assessRes.rows[0]?.result ?? null,
  });
}
