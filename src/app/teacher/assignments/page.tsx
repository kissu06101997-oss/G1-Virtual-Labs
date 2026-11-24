import { GlassBack } from "@/components/GlassBack";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AssignmentBuilder, type ExistingAssignmentRow } from "@/components/AssignmentBuilder";
import { TeacherSidebar } from "@/components/TeacherSidebar";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { listCatalogExperiments } from "@/lib/catalog";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";

export default async function TeacherAssignmentsPage() {
  const [auth, locale] = await Promise.all([getCurrentSession(), getRequestLocale()]);
  if (!auth) redirect("/sign-in?next=/teacher/assignments&role=teacher");
  if (auth.role !== "teacher" || !auth.schoolId) redirect("/");

  const dict = getDictionary(locale);

  const [classesRes, experiments] = await Promise.all([
    query<{ class_id: string; label: string; grade: number }>(
      `SELECT cl.class_id, cl.label, cl.grade
       FROM classroom cl
       JOIN class_teacher ct ON ct.school_id = cl.school_id AND ct.class_id = cl.class_id
       WHERE cl.school_id = $1 AND ct.principal_id = $2
       ORDER BY cl.grade DESC`,
      [auth.schoolId, auth.principalId]
    ),
    listCatalogExperiments(),
  ]);

  const classIds = classesRes.rows.map((c) => c.class_id);
  const existingRes =
    classIds.length > 0
      ? await query<{
          assignment_id: string;
          class_id: string;
          class_label: string;
          experiment_id: string;
          content_version: string;
          rubric_id: string;
          due_at: Date | null;
          late_policy: "allow_late_flagged" | "block_new_after_due";
          max_attempts: number;
          revision_number: number;
          supersedes_assignment_id: string | null;
          superseded_at: Date | null;
          revision_notes: string | null;
          modes: string[];
        }>(
          `SELECT
             a.assignment_id, a.class_id, cl.label AS class_label, a.experiment_id, a.content_version,
             a.rubric_id, a.due_at, COALESCE(a.late_policy, 'allow_late_flagged') AS late_policy,
             a.max_attempts, COALESCE(a.revision_number, 1) AS revision_number,
             a.supersedes_assignment_id, a.superseded_at, a.revision_notes,
             ARRAY_AGG(DISTINCT am.mode::text ORDER BY am.mode::text) AS modes
           FROM assignment a
           JOIN classroom cl ON cl.school_id = a.school_id AND cl.class_id = a.class_id
           JOIN assignment_mode am ON am.school_id = a.school_id AND am.assignment_id = a.assignment_id
           WHERE a.school_id = $1 AND a.class_id = ANY($2::uuid[])
           GROUP BY a.school_id, a.assignment_id, cl.label
           ORDER BY a.created_at DESC`,
          [auth.schoolId, classIds]
        )
      : { rows: [] };

  const existingAssignments: ExistingAssignmentRow[] = existingRes.rows.map((row) => ({
    assignmentId: row.assignment_id,
    classId: row.class_id,
    classLabel: row.class_label,
    experimentId: row.experiment_id,
    contentVersion: row.content_version,
    rubricId: row.rubric_id,
    dueAt: row.due_at ? row.due_at.toISOString() : null,
    latePolicy: row.late_policy,
    maxAttempts: row.max_attempts,
    revisionNumber: Number(row.revision_number ?? 1),
    supersedesAssignmentId: row.supersedes_assignment_id,
    supersededAt: row.superseded_at ? row.superseded_at.toISOString() : null,
    revisionNotes: row.revision_notes,
    modes: row.modes,
  }));

  return (
    <>
      <AppHeader variant="teacher" locale={locale} auth={auth} />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col lg:flex-row">
        <TeacherSidebar active="assignments" locale={locale} schoolName={auth.schoolName} />

        <main id="main-content" data-workspace="teacher" className="g1-premium flex-1 space-y-6 px-4 py-8 sm:px-8 lg:px-10">
        <GlassBack href="/teacher" label={locale === "te-IN" ? "ఉపాధ్యాయ కార్యస్థలానికి తిరిగి" : "Back to teacher workspace"} />
          <div className="g1-card g1-student-welcome">
            <div className="g1-eyebrow">{dict.teacher.workspaceEyebrow}</div>
            <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-[#0c2444]">
              {dict.teacher.assignmentsHeading}
            </h1>
          </div>

          <AssignmentBuilder
            classes={classesRes.rows.map((c) => ({
              classId: c.class_id,
              label: c.label,
              grade: c.grade,
            }))}
            experiments={experiments}
            existingAssignments={existingAssignments}
            locale={locale}
          />
        </main>
      </div>
    </>
  );
}
