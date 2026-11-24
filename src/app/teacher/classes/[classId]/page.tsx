import { GlassBack } from "@/components/GlassBack";
import { TableScroll } from "@/components/TableScroll";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TeacherSidebar } from "@/components/TeacherSidebar";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { query } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TeacherClassDetailPage(props: {
  params: Promise<{ classId: string }>;
}) {
  const [{ classId }, auth, locale] = await Promise.all([
    props.params,
    getCurrentSession(),
    getRequestLocale(),
  ]);

  if (!auth) redirect(`/sign-in?next=/teacher/classes/${classId}&role=teacher`);
  if (auth.role !== "teacher" || !auth.schoolId || !UUID_RE.test(classId)) {
    notFound();
  }

  // Enforce strict class_teacher ownership inside teacher's school (masked 404 otherwise)
  const classRes = await query<{ label: string; grade: number }>(
    `SELECT cl.label, cl.grade
     FROM classroom cl
     JOIN class_teacher ct ON ct.school_id = cl.school_id AND ct.class_id = cl.class_id
     WHERE cl.school_id = $1 AND cl.class_id = $2 AND ct.principal_id = $3`,
    [auth.schoolId, classId, auth.principalId]
  );

  const cls = classRes.rows[0];
  if (!cls) notFound();

  const rosterRes = await query<{
    learner_id: string;
    display_name: string;
    grade: number;
    enrolled_at: Date;
    submissions: string;
  }>(
    `SELECT
       sl.learner_id, pc.display_name, sl.grade, en.enrolled_at,
       (SELECT count(*)::text FROM assessment asm JOIN attempt att ON att.school_id = asm.school_id AND att.attempt_id = asm.attempt_id WHERE att.school_id = en.school_id AND att.class_id = en.class_id AND att.learner_id = en.learner_id AND asm.supersedes_id IS NULL) AS submissions
     FROM enrollment en
     JOIN school_learner sl ON sl.school_id = en.school_id AND sl.learner_id = en.learner_id
     JOIN principal_credential pc ON pc.principal_id = sl.principal_id
     WHERE en.school_id = $1 AND en.class_id = $2 AND en.withdrawn_at IS NULL
     ORDER BY pc.display_name`,
    [auth.schoolId, classId]
  );

  return (
    <>
      <AppHeader variant="teacher" locale={locale} auth={auth} />
      <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col lg:flex-row">
        <TeacherSidebar active="classes" locale={locale} schoolName={auth.schoolName} />

        <main id="main-content" data-workspace="teacher" className="g1-premium flex-1 space-y-6 px-4 py-8 sm:px-8 lg:px-10">
          <GlassBack href="/teacher" label={locale === "te-IN" ? "తరగతులకు తిరిగి" : "Back to classes"} />

          <div className="g1-card g1-student-welcome flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-[#0c2444]">{cls.label}</h1>
              <p className="mt-1 text-sm text-[#4b637a]">
                Class {cls.grade} · {rosterRes.rows.length} enrolled synthetic learners
              </p>
            </div>
            <Link href={`/teacher/reports?classId=${classId}`} className="g1-btn g1-btn-teal">
              <span>View class report</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <section className="g1-card overflow-hidden">
            <TableScroll label={locale === "te-IN" ? "తరగతి జాబితా" : "Class roster"} telugu={locale === "te-IN"}>
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f2f8fc] text-[11px] font-bold uppercase tracking-wider text-[#4b637a]">
                    <th className="px-6 py-3">Learner (Synthetic)</th>
                    <th className="px-4 py-3">Pseudonym ID</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-6 py-3">Submitted assessments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8f0f5]">
                  {rosterRes.rows.map((r) => (
                    <tr key={r.learner_id}>
                      <td className="px-6 py-3.5 font-bold text-[#0c2444]">{r.display_name}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-[#4b637a]">{r.learner_id}</td>
                      <td className="px-4 py-3.5">Class {r.grade}</td>
                      <td className="px-6 py-3.5 font-bold text-[#046c49]">{r.submissions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </section>
        </main>
      </div>
    </>
  );
}
