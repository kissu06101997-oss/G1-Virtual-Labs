import { NextRequest, NextResponse } from "next/server";
import { apiError, getCurrentSession, recordAuditEvent } from "@/lib/auth";
import { query } from "@/lib/db";
import type { AssessmentContract } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function csvEscape(val: unknown): string {
  const s = String(val ?? "");
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ classId: string }> }
) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (auth.role !== "teacher" && auth.role !== "school_admin") {
    return apiError(403, "NOT_AUTHORIZED", "Teacher or school administrator role required.");
  }

  const { classId } = await context.params;
  if (!UUID_RE.test(classId) || !auth.schoolId) {
    return apiError(404, "NOT_FOUND", "Class not found.");
  }

  // Strict tenant + class isolation (AT-03: cross-school & same-school cross-class masked 404!)
  if (auth.role === "teacher") {
    const owns = await query(
      `SELECT 1 FROM class_teacher WHERE school_id = $1 AND class_id = $2 AND principal_id = $3`,
      [auth.schoolId, classId, auth.principalId]
    );
    if (owns.rows.length === 0) {
      return apiError(404, "NOT_FOUND", "Class not found.");
    }
  } else {
    const exists = await query(
      `SELECT 1 FROM classroom WHERE school_id = $1 AND class_id = $2`,
      [auth.schoolId, classId]
    );
    if (exists.rows.length === 0) {
      return apiError(404, "NOT_FOUND", "Class not found.");
    }
  }

  const res = await query<{
    assessment_id: string;
    attempt_id: string;
    rubric_version: string;
    result: AssessmentContract & {
      criteriaPassed?: number;
      criteriaTotal?: number;
      summary?: string;
    };
    created_at: Date;
    learner_id: string;
    display_name: string;
    experiment_id: string;
    content_version: string;
    mode: string;
    assignment_id: string | null;
    session_id: string;
    revision: string;
  }>(
    `SELECT
       asm.assessment_id,
       asm.attempt_id,
       asm.rubric_version,
       asm.result,
       asm.created_at,
       att.learner_id,
       pc.display_name,
       att.experiment_id,
       att.content_version,
       att.mode::text,
       att.assignment_id,
       ls.session_id,
       ls.revision::text
     FROM assessment asm
     JOIN attempt att
       ON att.school_id = asm.school_id AND att.attempt_id = asm.attempt_id
     JOIN lab_session ls
       ON ls.school_id = att.school_id AND ls.attempt_id = att.attempt_id
     JOIN school_learner sl
       ON sl.school_id = att.school_id AND sl.learner_id = att.learner_id
     JOIN principal_credential pc
       ON pc.principal_id = sl.principal_id
     WHERE asm.school_id = $1
       AND att.class_id = $2
       AND asm.supersedes_id IS NULL
     ORDER BY asm.created_at DESC`,
    [auth.schoolId, classId]
  );

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");
  const detailed = searchParams.get("detail") === "1";

  if (format === "csv") {
    await recordAuditEvent({
      schoolId: auth.schoolId,
      actionType: "teacher.report_exported_csv",
      actorId: auth.principalId,
      subjectKey: `${auth.schoolId}:${classId}:${res.rows.length}`,
      retentionClass: "attempt_record",
    });

    const header = [
      "submission_id",
      "attempt_id",
      "learner_pseudonym",
      "experiment_id",
      "content_version",
      "mode",
      "rubric_id",
      "grade_state",
      "criteria_passed",
      "criteria_total",
      "evidence_count",
      "submitted_at_utc",
    ].join(",");

    const lines = res.rows.map((r) =>
      [
        r.result.submissionId,
        r.attempt_id,
        r.learner_id,
        r.experiment_id,
        r.content_version,
        r.mode,
        r.result.rubricId,
        r.result.gradeState,
        r.result.criteriaPassed ?? "",
        r.result.criteriaTotal ?? "",
        r.result.evidenceIds?.length ?? 0,
        r.created_at.toISOString(),
      ]
        .map(csvEscape)
        .join(",")
    );

    return new NextResponse([header, ...lines].join("\r\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="g1-class-report-${classId.slice(0, 8)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Strict OpenAPI Assessment[] items
  const items: AssessmentContract[] = res.rows.map((r) => ({
    submissionId: r.result.submissionId,
    attemptId: r.result.attemptId,
    gradeState: r.result.gradeState,
    rubricId: r.result.rubricId,
    evidenceIds: r.result.evidenceIds ?? [],
  }));

  if (!detailed) {
    return NextResponse.json({
      items,
      nextCursor: null,
    });
  }

  return NextResponse.json({
    items,
    nextCursor: null,
    details: res.rows.map((r) => ({
      submissionId: r.result.submissionId,
      attemptId: r.attempt_id,
      sessionId: r.session_id,
      learnerPseudonym: r.learner_id,
      learnerLabel: r.display_name,
      experimentId: r.experiment_id,
      contentVersion: r.content_version,
      mode: r.mode,
      assignmentId: r.assignment_id,
      revision: Number(r.revision),
      rubricId: r.result.rubricId,
      gradeState: r.result.gradeState,
      criteriaPassed: r.result.criteriaPassed ?? 0,
      criteriaTotal: r.result.criteriaTotal ?? 0,
      evidenceIds: r.result.evidenceIds ?? [],
      summary: r.result.summary ?? "",
      submittedAt: r.created_at.toISOString(),
    })),
  });
}
