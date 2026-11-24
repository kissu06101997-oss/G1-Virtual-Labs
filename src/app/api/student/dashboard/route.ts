import { NextResponse } from "next/server";
import { apiError, getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (auth.role !== "student" || !auth.schoolId || !auth.learnerId) {
    return apiError(403, "NOT_AUTHORIZED", "Student workspace requires an active student account.");
  }

  // Active resumable sessions
  const activeRes = await query<{
    session_id: string;
    attempt_id: string;
    experiment_id: string;
    content_version: string;
    mode: string;
    revision: string;
    state: { stepIndex?: number; totalSteps?: number; completedSteps?: number[] };
    saved_at: Date;
    subject: string;
    title: string;
    grade: string;
  }>(
    `SELECT
       ls.session_id,
       ls.attempt_id,
       a.experiment_id,
       a.content_version,
       a.mode::text,
       ls.revision::text,
       ls.state,
       ls.saved_at,
       ev.subject::text,
       ev.definition->>'title' AS title,
       ev.definition->>'grade' AS grade
     FROM lab_session ls
     JOIN attempt a ON a.school_id = ls.school_id AND a.attempt_id = ls.attempt_id
     JOIN experiment_version ev
       ON ev.experiment_id = a.experiment_id AND ev.content_version = a.content_version
     WHERE ls.school_id = $1 AND a.learner_id = $2 AND ls.status IN ('active','paused')
     ORDER BY ls.saved_at DESC
     LIMIT 5`,
    [auth.schoolId, auth.learnerId]
  );

  // Authorized assignments for classes where this learner is actively enrolled
  const assignRes = await query<{
    assignment_id: string;
    class_id: string;
    class_label: string;
    experiment_id: string;
    content_version: string;
    rubric_id: string;
    due_at: Date | null;
    max_attempts: number;
    subject: string;
    title: string;
    grade: string;
    manifest_digest: string;
    abi: string;
    modes: string[];
    active_session_id: string | null;
    submitted_attempts: string;
  }>(
    `SELECT
       asg.assignment_id,
       asg.class_id,
       cl.label AS class_label,
       asg.experiment_id,
       asg.content_version,
       asg.rubric_id,
       asg.due_at,
       asg.max_attempts,
       ev.subject::text,
       ev.definition->>'title' AS title,
       ev.definition->>'grade' AS grade,
       ev.manifest_digest,
       ev.abi,
       ARRAY_AGG(DISTINCT am.mode::text ORDER BY am.mode::text) AS modes,
       (
         SELECT ls.session_id
         FROM attempt att
         JOIN lab_session ls ON ls.school_id = att.school_id AND ls.attempt_id = att.attempt_id
         WHERE att.school_id = asg.school_id
           AND att.assignment_id = asg.assignment_id
           AND att.learner_id = $2
           AND ls.status IN ('active','paused')
         ORDER BY ls.saved_at DESC
         LIMIT 1
       ) AS active_session_id,
       (
         SELECT count(*)::text
         FROM attempt att
         WHERE att.school_id = asg.school_id
           AND att.assignment_id = asg.assignment_id
           AND att.learner_id = $2
           AND att.submitted_at IS NOT NULL
       ) AS submitted_attempts
     FROM assignment asg
     JOIN enrollment en
       ON en.school_id = asg.school_id
      AND en.class_id = asg.class_id
      AND en.learner_id = $2
      AND en.withdrawn_at IS NULL
     JOIN classroom cl ON cl.school_id = asg.school_id AND cl.class_id = asg.class_id
     JOIN experiment_version ev
       ON ev.experiment_id = asg.experiment_id AND ev.content_version = asg.content_version
     JOIN assignment_mode am
       ON am.school_id = asg.school_id AND am.assignment_id = asg.assignment_id
     WHERE asg.school_id = $1
     GROUP BY asg.school_id, asg.assignment_id, cl.label, ev.subject, ev.definition, ev.manifest_digest, ev.abi
     ORDER BY asg.due_at ASC NULLS LAST`,
    [auth.schoolId, auth.learnerId]
  );

  // Submitted rubric results
  const resultsRes = await query<{
    assessment_id: string;
    attempt_id: string;
    experiment_id: string;
    content_version: string;
    mode: string;
    subject: string;
    rubric_version: string;
    result: {
      gradeState: string;
      criteriaPassed?: number;
      criteriaTotal?: number;
      summary?: string;
      evidenceIds?: string[];
    };
    created_at: Date;
  }>(
    `SELECT
       asm.assessment_id,
       asm.attempt_id,
       att.experiment_id,
       att.content_version,
       att.mode::text,
       ev.subject::text,
       asm.rubric_version,
       asm.result,
       asm.created_at
     FROM assessment asm
     JOIN attempt att ON att.school_id = asm.school_id AND att.attempt_id = asm.attempt_id
     JOIN experiment_version ev
       ON ev.experiment_id = att.experiment_id AND ev.content_version = att.content_version
     WHERE asm.school_id = $1 AND att.learner_id = $2 AND asm.supersedes_id IS NULL
     ORDER BY asm.created_at DESC`,
    [auth.schoolId, auth.learnerId]
  );

  // Compute genuine progress per subject from saved sessions and submissions (never fake numbers!)
  const progressBySubject: Record<"chemistry" | "physics" | "biology", number> = {
    chemistry: 0,
    physics: 0,
    biology: 0,
  };
  for (const subj of ["chemistry", "physics", "biology"] as const) {
    const submitted = resultsRes.rows.some((r) => r.subject === subj);
    if (submitted) {
      progressBySubject[subj] = 100;
      continue;
    }
    const active = activeRes.rows.find((r) => r.subject === subj);
    if (active) {
      const total = Math.max(1, active.state?.totalSteps ?? 5);
      const done = Math.max(1, (active.state?.completedSteps?.length ?? 0) + 1);
      progressBySubject[subj] = Math.min(90, Math.round((done / total) * 100));
    }
  }

  return NextResponse.json({
    activeSessions: activeRes.rows.map((r) => ({
      sessionId: r.session_id,
      attemptId: r.attempt_id,
      experimentId: r.experiment_id,
      contentVersion: r.content_version,
      mode: r.mode,
      revision: Number(r.revision),
      stepIndex: r.state?.stepIndex ?? 0,
      totalSteps: r.state?.totalSteps ?? 5,
      savedAt: r.saved_at.toISOString(),
      subject: r.subject,
      title: r.title,
      grade: Number(r.grade),
    })),
    assignments: assignRes.rows.map((r) => ({
      assignmentId: r.assignment_id,
      classId: r.class_id,
      classLabel: r.class_label,
      experimentId: r.experiment_id,
      contentVersion: r.content_version,
      rubricId: r.rubric_id,
      dueAt: r.due_at ? r.due_at.toISOString() : null,
      maxAttempts: r.max_attempts,
      subject: r.subject,
      title: r.title,
      grade: Number(r.grade),
      manifestSha256: r.manifest_digest,
      engineAbi: r.abi,
      modes: r.modes,
      activeSessionId: r.active_session_id,
      submittedAttempts: Number(r.submitted_attempts),
      status:
        Number(r.submitted_attempts) > 0
          ? "submitted"
          : r.active_session_id
            ? "in_progress"
            : "not_started",
    })),
    results: resultsRes.rows.map((r) => ({
      assessmentId: r.assessment_id,
      attemptId: r.attempt_id,
      experimentId: r.experiment_id,
      contentVersion: r.content_version,
      mode: r.mode,
      subject: r.subject,
      rubricId: r.rubric_version,
      gradeState: r.result.gradeState,
      criteriaPassed: r.result.criteriaPassed ?? 0,
      criteriaTotal: r.result.criteriaTotal ?? 0,
      evidenceCount: r.result.evidenceIds?.length ?? 0,
      summary: r.result.summary ?? "",
      submittedAt: r.created_at.toISOString(),
    })),
    progressBySubject,
  });
}
