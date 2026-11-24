import { NextRequest, NextResponse } from "next/server";
import { apiError, getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ sessionId: string; revision: string }> }
) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");

  const { sessionId, revision: revStr } = await context.params;
  const revision = Number(revStr);
  if (!UUID_RE.test(sessionId) || !Number.isInteger(revision) || revision < 0) {
    return apiError(404, "NOT_FOUND", "Checkpoint not found.");
  }

  const res = await query<{
    school_id: string;
    session_id: string;
    revision: string;
    digest: string;
    state: Record<string, unknown>;
    owner_principal_id: string;
    class_id: string | null;
  }>(
    `SELECT
       cp.school_id,
       cp.session_id,
       cp.revision::text,
       cp.digest,
       cp.state,
       sl.principal_id AS owner_principal_id,
       a.class_id
     FROM checkpoint cp
     JOIN lab_session ls ON ls.school_id = cp.school_id AND ls.session_id = cp.session_id
     JOIN attempt a ON a.school_id = ls.school_id AND a.attempt_id = ls.attempt_id
     JOIN school_learner sl ON sl.school_id = a.school_id AND sl.learner_id = a.learner_id
     WHERE cp.session_id = $1 AND cp.revision = $2`,
    [sessionId, revision]
  );

  const row = res.rows[0];
  if (!row || row.school_id !== auth.schoolId) {
    return apiError(404, "NOT_FOUND", "Checkpoint not found.");
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
    return apiError(404, "NOT_FOUND", "Checkpoint not found.");
  }

  return NextResponse.json({
    sessionId: row.session_id,
    revision: Number(row.revision),
    stateSha256: row.digest,
    state: row.state,
  });
}
