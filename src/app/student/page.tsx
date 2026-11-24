import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { StudentActivityCards } from "@/components/StudentActivity";
import {
  StudentDashboardClient,
  type StudentDashboardData,
} from "@/components/StudentDashboardClient";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatStageLabel } from "@/lib/education-stages";
import { listStudentActivity } from "@/lib/student-activity";
import type { LabSubject } from "@/lib/types";

export default async function StudentDashboardPage() {
  const [auth, locale] = await Promise.all([getCurrentSession(), getRequestLocale()]);
  if (!auth) {
    redirect("/sign-in?next=/student");
  }
  if (auth.role !== "student" || !auth.schoolId || !auth.learnerId) {
    redirect(
      auth.role === "teacher"
        ? "/teacher"
        : auth.role === "content_editor" || auth.role === "content_reviewer"
          ? "/content"
          : "/admin"
    );
  }

  const [activeRes, assignRes, resultsRes, recent, structured, nextPracticals] = await Promise.all([
    query<{
      session_id: string;
      attempt_id: string;
      assignment_id: string | null;
      experiment_id: string;
      content_version: string;
      mode: "simulation" | "experiment";
      revision: string;
      state: { stepIndex?: number; totalSteps?: number; completedSteps?: number[] };
      saved_at: Date;
      subject: LabSubject;
      title: string;
      grade: string;
    }>(
      `SELECT
         ls.session_id, ls.attempt_id, a.assignment_id, a.experiment_id, a.content_version, a.mode::text,
         ls.revision::text, ls.state, ls.saved_at, ev.subject::text,
         ev.definition->>'title' AS title, ev.definition->>'grade' AS grade
       FROM lab_session ls
       JOIN attempt a ON a.school_id = ls.school_id AND a.attempt_id = ls.attempt_id
       JOIN experiment_version ev ON ev.experiment_id = a.experiment_id AND ev.content_version = a.content_version
       WHERE ls.school_id = $1 AND a.learner_id = $2 AND ls.status IN ('active','paused')
       ORDER BY ls.saved_at DESC LIMIT 5`,
      [auth.schoolId, auth.learnerId]
    ),
    query<{
      assignment_id: string;
      class_id: string;
      class_label: string;
      experiment_id: string;
      content_version: string;
      rubric_id: string;
      due_at: Date | null;
      is_past_due: boolean;
      late_policy: string;
      max_attempts: number;
      revision_number: number;
      subject: LabSubject;
      title: string;
      grade: string;
      modes: string[];
      active_session_id: string | null;
      submitted_attempts: string;
    }>(
      `SELECT
         asg.assignment_id, asg.class_id, cl.label AS class_label, asg.experiment_id,
         asg.content_version, asg.rubric_id, asg.due_at,
         (asg.due_at IS NOT NULL AND asg.due_at < now()) AS is_past_due,
         COALESCE(asg.late_policy, 'allow_late_flagged') AS late_policy,
         asg.max_attempts, COALESCE(asg.revision_number, 1) AS revision_number,
         ev.subject::text, ev.definition->>'title' AS title, ev.definition->>'grade' AS grade,
         ARRAY_AGG(DISTINCT am.mode::text ORDER BY am.mode::text) AS modes,
         (
           SELECT ls.session_id FROM attempt att
           JOIN lab_session ls ON ls.school_id = att.school_id AND ls.attempt_id = att.attempt_id
           WHERE att.school_id = asg.school_id AND att.assignment_id = asg.assignment_id
             AND att.learner_id = $2 AND ls.status IN ('active','paused')
           ORDER BY ls.saved_at DESC LIMIT 1
         ) AS active_session_id,
         (
           SELECT count(*)::text FROM attempt att
           WHERE att.school_id = asg.school_id AND att.assignment_id = asg.assignment_id
             AND att.learner_id = $2 AND att.submitted_at IS NOT NULL
         ) AS submitted_attempts
       FROM assignment asg
       JOIN enrollment en ON en.school_id = asg.school_id AND en.class_id = asg.class_id AND en.learner_id = $2 AND en.withdrawn_at IS NULL
       JOIN classroom cl ON cl.school_id = asg.school_id AND cl.class_id = asg.class_id
       JOIN experiment_version ev ON ev.experiment_id = asg.experiment_id AND ev.content_version = asg.content_version
       JOIN assignment_mode am ON am.school_id = asg.school_id AND am.assignment_id = asg.assignment_id
       WHERE asg.school_id = $1 AND asg.superseded_at IS NULL
       GROUP BY asg.school_id, asg.assignment_id, cl.label, ev.subject, ev.definition
       ORDER BY asg.due_at ASC NULLS LAST`,
      [auth.schoolId, auth.learnerId]
    ),
    query<{
      assessment_id: string;
      attempt_id: string;
      assignment_id: string | null;
      is_late: boolean;
      session_id: string;
      revision: string;
      experiment_id: string;
      content_version: string;
      mode: "simulation" | "experiment";
      subject: LabSubject;
      rubric_version: string;
      result: {
        gradeState: string;
        criteriaPassed?: number;
        criteriaTotal?: number;
        criteria?: Array<{ id: string; label: string; passed: boolean }>;
        summary?: string;
        evidenceIds?: string[];
      };
      observations: Array<{
        observationId: string;
        revision: number;
        payload: Record<string, unknown>;
      }>;
      created_at: Date;
    }>(
      `SELECT
         asm.assessment_id,
         asm.attempt_id,
         att.assignment_id,
         COALESCE(att.is_late, false) AS is_late,
         ls.session_id,
         ls.revision::text,
         att.experiment_id,
         att.content_version,
         att.mode::text,
         ev.subject::text,
         asm.rubric_version,
         asm.result,
         COALESCE(
           (
             SELECT JSONB_AGG(
               JSONB_BUILD_OBJECT(
                 'observationId', o.observation_id,
                 'revision', o.revision,
                 'payload', o.data
               )
               ORDER BY o.revision ASC
             )
             FROM observation o
             WHERE o.school_id = ls.school_id AND o.session_id = ls.session_id
           ),
           '[]'::jsonb
         ) AS observations,
         asm.created_at
       FROM assessment asm
       JOIN attempt att ON att.school_id = asm.school_id AND att.attempt_id = asm.attempt_id
       JOIN lab_session ls ON ls.school_id = att.school_id AND ls.attempt_id = att.attempt_id
       JOIN experiment_version ev ON ev.experiment_id = att.experiment_id AND ev.content_version = att.content_version
       WHERE asm.school_id = $1 AND att.learner_id = $2 AND asm.supersedes_id IS NULL
       ORDER BY asm.created_at DESC`,
      [auth.schoolId, auth.learnerId]
    ),
    listStudentActivity(auth),
    query<{ experiment_id: string; content_version: string; title: string; completed_stage: number; score: number | null }>(
      `SELECT lp.experiment_id, lp.content_version, lv.content->'title'->>$3 AS title, lp.completed_stage, lp.score
       FROM learning_progress lp JOIN learning_version lv USING (experiment_id, content_version)
       JOIN experiment_version ev USING (experiment_id, content_version)
       WHERE lp.school_id = $1 AND lp.learner_id = $2 AND ev.published_at IS NOT NULL AND ev.retired_at IS NULL
       ORDER BY lp.updated_at DESC`, [auth.schoolId, auth.learnerId, locale === "te-IN" ? "te" : "en"],
    ),
    query<{ experiment_id: string; title: string; grade: number; course: string; subject: LabSubject }>(
      `SELECT DISTINCT ON (ev.experiment_id) ev.experiment_id,
          COALESCE(lv.content->'title'->>$3, ev.definition->>'title') AS title, el.grade, el.subject,
          CASE WHEN $3 = 'te' THEN lesson.title_te ELSE lesson.title_en END AS course
        FROM school_learner sl JOIN experiment_lesson el ON el.grade = sl.grade
        JOIN experiment_version ev USING (experiment_id, content_version)
        JOIN lab_lesson lesson ON lesson.lesson_id = el.lesson_id
        LEFT JOIN learning_version lv USING (experiment_id, content_version)
        WHERE sl.school_id = $1 AND sl.learner_id = $2 AND ev.published_at IS NOT NULL
          AND ev.retired_at IS NULL AND lesson.published_at IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM attempt a WHERE a.school_id = sl.school_id
            AND a.learner_id = sl.learner_id AND a.experiment_id = ev.experiment_id AND a.submitted_at IS NOT NULL)
        ORDER BY ev.experiment_id, ev.published_at DESC LIMIT 3`,
      [auth.schoolId, auth.learnerId, locale === "te-IN" ? "te" : "en"],
    ),
  ]);

  const progressBySubject: Record<LabSubject, number> = {
    chemistry: 0,
    physics: 0,
    biology: 0,
  };
  for (const subj of ["chemistry", "physics", "biology"] as const) {
    if (resultsRes.rows.some((r) => r.subject === subj)) {
      progressBySubject[subj] = 100;
    } else {
      const active = activeRes.rows.find((r) => r.subject === subj);
      if (active) {
        const total = Math.max(1, active.state?.totalSteps ?? 5);
        const done = active.state?.completedSteps?.length ?? 0;
        progressBySubject[subj] = Math.min(100, Math.round((done / total) * 100));
      }
    }
  }

  const data: StudentDashboardData = {
    activeSessions: activeRes.rows.map((r) => ({
      sessionId: r.session_id,
      attemptId: r.attempt_id,
      assignmentId: r.assignment_id,
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
      isPastDue: Boolean(r.is_past_due),
      latePolicy: r.late_policy,
      maxAttempts: r.max_attempts,
      revisionNumber: Number(r.revision_number ?? 1),
      subject: r.subject,
      title: r.title,
      grade: Number(r.grade),
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
      assignmentId: r.assignment_id,
      isLate: r.is_late,
      sessionId: r.session_id,
      revision: Number(r.revision),
      experimentId: r.experiment_id,
      contentVersion: r.content_version,
      mode: r.mode,
      subject: r.subject,
      rubricId: r.rubric_version,
      gradeState: r.result.gradeState,
      criteriaPassed: r.result.criteriaPassed ?? 0,
      criteriaTotal: r.result.criteriaTotal ?? 0,
      criteria: r.result.criteria ?? [],
      evidenceCount: r.result.evidenceIds?.length ?? 0,
      observations: r.observations ?? [],
      summary: r.result.summary ?? "",
      submittedAt: r.created_at.toISOString(),
    })),
    progressBySubject,
  };

  return (
    <>
      <AppHeader variant="student" locale={locale} auth={auth} />
      <StudentDashboardClient
        data={data}
        locale={locale}
        displayName={auth.displayName}
        schoolName={auth.schoolName}
        journey={
          <section className="g1-public-section" aria-labelledby="dashboard-journey">
            <div className="g1-section-line">
              <h2 className="g1-section-title" id="dashboard-journey">{locale === "te-IN" ? "నా ప్రయోగాల ప్రయాణం" : "My laboratory journey"}</h2>
              <Link className="g1-text-link" href="/student/activity">{locale === "te-IN" ? "అన్ని కార్యకలాపాలు" : "View all activity"}</Link>
            </div>
            {!!recent.length && <StudentActivityCards items={recent} locale={locale} />}
            {!recent.length && <p>{locale === "te-IN" ? "మీ మొదటి ప్రయోగాన్ని కనుగొనండి." : "Your first lab will appear here when you begin."}</p>}
            {!!structured.rows.length && <ul className="g1-activity-grid mt-4">
              {structured.rows.map(row => <li className="g1-card g1-activity-card" key={row.experiment_id + "@" + row.content_version}>
                <h3>{row.title}</h3>
                <p>{row.completed_stage}/5 {locale === "te-IN" ? "సిమ్యులేషన్ దశలు" : "Simulation stages"}</p>
                <p>{row.completed_stage === 5 ? (locale === "te-IN" ? "ఎక్స్‌పెరిమెంట్ అందుబాటులో ఉంది" : "Experiment unlocked") :
                  (locale === "te-IN" ? "ఎక్స్‌పెరిమెంట్ ఇంకా లాక్‌లో ఉంది" : "Experiment locked")}</p>
                {row.score !== null && <p>{locale === "te-IN" ? "క్విజ్" : "Quiz"} · {row.score}/5</p>}
                <Link className="g1-text-link" href={"/experiments/" + row.experiment_id + "/learn/" + row.content_version}>
                  {locale === "te-IN" ? "సిమ్యులేషన్ తెరవండి" : "Open Simulation"}
                </Link>
                {row.completed_stage === 5 && <Link className="g1-btn g1-btn-green"
                  href={"/experiments/" + row.experiment_id + "?version=" + encodeURIComponent(row.content_version)}>
                  {locale === "te-IN" ? "ఎక్స్‌పెరిమెంట్ తెరవండి" : "Open Experiment"}
                </Link>}
              </li>)}
            </ul>}
            {!!nextPracticals.rows.length && <section className="g1-public-section" aria-labelledby="discover-next">
              <h2 id="discover-next" className="g1-section-title">{locale === "te-IN" ? "తదుపరి ప్రయోగాలు" : "Discover next"}</h2>
              <ul className="g1-activity-grid">
                {nextPracticals.rows.map(row => <li key={row.experiment_id} className="g1-card g1-activity-card g1-linked-card" data-subject={row.subject}>
                  <h3>{row.title}</h3>
                  <p>{formatStageLabel(row.grade, locale)} · {row.course}</p>
                  <Link className="g1-text-link g1-card-target" href={"/experiments/" + row.experiment_id}>{locale === "te-IN" ? "ప్రయోగం చూడండి" : "View experiment"}</Link>
                </li>)}
              </ul>
            </section>}
          </section>
        }
      />
    </>
  );
}
