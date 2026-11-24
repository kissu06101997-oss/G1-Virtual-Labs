import { GlassBack } from "@/components/GlassBack";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Eye, FileCheck2, PlusCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TeacherSidebar } from "@/components/TeacherSidebar";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatStageLabel } from "@/lib/education-stages";
import { getDictionary, getExperimentCopy } from "@/lib/i18n";

export default async function TeacherDashboardPage(props: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const [auth, locale, sp] = await Promise.all([
    getCurrentSession(),
    getRequestLocale(),
    props.searchParams,
  ]);
  if (!auth) redirect("/sign-in?next=/teacher&role=teacher");
  if (auth.role !== "teacher" || !auth.schoolId) {
    redirect(auth.role === "student" ? "/student" : "/admin");
  }

  const dict = getDictionary(locale);
  const isTe = locale === "te-IN";

  const classesRes = await query<{
    class_id: string;
    label: string;
    grade: number;
    enrolled_learners: string;
    assigned_practicals: string;
    submitted_assessments: string;
  }>(
    `SELECT
       cl.class_id, cl.label, cl.grade,
       (SELECT count(*)::text FROM enrollment e WHERE e.school_id = cl.school_id AND e.class_id = cl.class_id AND e.withdrawn_at IS NULL) AS enrolled_learners,
       (SELECT count(*)::text FROM assignment a WHERE a.school_id = cl.school_id AND a.class_id = cl.class_id AND a.superseded_at IS NULL) AS assigned_practicals,
       (SELECT count(*)::text FROM assessment asm JOIN attempt att ON att.school_id = asm.school_id AND att.attempt_id = asm.attempt_id WHERE asm.school_id = cl.school_id AND att.class_id = cl.class_id AND asm.supersedes_id IS NULL) AS submitted_assessments
     FROM classroom cl
     JOIN class_teacher ct ON ct.school_id = cl.school_id AND ct.class_id = cl.class_id
     WHERE cl.school_id = $1 AND ct.principal_id = $2
     ORDER BY cl.grade DESC, cl.label ASC`,
    [auth.schoolId, auth.principalId]
  );

  const primaryClass =
    classesRes.rows.find((c) => c.class_id === sp.classId) ?? classesRes.rows[0] ?? null;

  const assignmentsRes = primaryClass
    ? await query<{
        assignment_id: string;
        experiment_id: string;
        content_version: string;
        due_at: Date | null;
        late_policy: string;
        revision_number: number;
        superseded_at: Date | null;
        modes: string[];
        submissions: string;
      }>(
        `SELECT
           a.assignment_id, a.experiment_id, a.content_version, a.due_at,
           COALESCE(a.late_policy, 'allow_late_flagged') AS late_policy,
           COALESCE(a.revision_number, 1) AS revision_number,
           a.superseded_at,
           ARRAY_AGG(DISTINCT am.mode::text ORDER BY am.mode::text) AS modes,
           (
             SELECT count(DISTINCT asm.attempt_id)::text
             FROM assessment asm
             JOIN attempt att ON att.school_id = asm.school_id AND att.attempt_id = asm.attempt_id
             WHERE asm.school_id = a.school_id AND att.assignment_id = a.assignment_id AND asm.supersedes_id IS NULL
           ) AS submissions
         FROM assignment a
         JOIN assignment_mode am ON am.school_id = a.school_id AND am.assignment_id = a.assignment_id
         WHERE a.school_id = $1 AND a.class_id = $2
         GROUP BY a.school_id, a.assignment_id
         ORDER BY (a.superseded_at IS NULL) DESC, a.created_at DESC`,
        [auth.schoolId, primaryClass.class_id]
      )
    : { rows: [] };

  const latestSubmissionRes = primaryClass
    ? await query<{
        assessment_id: string;
        display_name: string;
        experiment_id: string;
        content_version: string;
        mode: string;
        rubric_version: string;
        revision: string;
        result: {
          gradeState: string;
          criteriaPassed?: number;
          criteriaTotal?: number;
          criteria?: Array<{ id: string; label: string; passed: boolean }>;
          evidenceIds?: string[];
          summary?: string;
        };
        created_at: Date;
      }>(
        `SELECT
           asm.assessment_id, pc.display_name, att.experiment_id, att.content_version,
           att.mode::text, asm.rubric_version, ls.revision::text, asm.result, asm.created_at
         FROM assessment asm
         JOIN attempt att ON att.school_id = asm.school_id AND att.attempt_id = asm.attempt_id
         JOIN lab_session ls ON ls.school_id = att.school_id AND ls.attempt_id = att.attempt_id
         JOIN school_learner sl ON sl.school_id = att.school_id AND sl.learner_id = att.learner_id
         JOIN principal_credential pc ON pc.principal_id = sl.principal_id
         WHERE asm.school_id = $1 AND att.class_id = $2 AND asm.supersedes_id IS NULL
         ORDER BY asm.created_at DESC
         LIMIT 1`,
        [auth.schoolId, primaryClass.class_id]
      )
    : { rows: [] };

  const latestSub = latestSubmissionRes.rows[0] ?? null;
  const enrolledCount = Number(primaryClass?.enrolled_learners ?? 0);
  const assignedCount = Number(primaryClass?.assigned_practicals ?? 0);
  const submittedCount = Number(primaryClass?.submitted_assessments ?? 0);

  return (
    <>
      <AppHeader variant="teacher" locale={locale} auth={auth} />

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col lg:flex-row">
        <TeacherSidebar active="classes" locale={locale} schoolName={auth.schoolName} />

        <main id="main-content" data-workspace="teacher" className="g1-premium min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10">
        <GlassBack href="/" label={locale === "te-IN" ? "ముఖపుటకు తిరిగి" : "Back to home"} />
          <div className="g1-card g1-student-welcome g1-workspace-banner flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="g1-eyebrow">{dict.teacher.workspaceEyebrow}</div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0c2444] sm:text-[38px]">
                {isTe ? "శాస్త్రాన్ని ఆత్మవిశ్వాసంతో బోధించండి." : "Teach science with confidence."}
              </h1>
              <p className="mt-1.5 text-sm text-[#4b637a]">
                {primaryClass
                  ? `${primaryClass.label} (${formatStageLabel(primaryClass.grade, locale)}) · `
                  : ""}
                {dict.teacher.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {classesRes.rows.length > 0 && (
                <div className="flex items-center gap-2 rounded-2xl border border-[#c8e1e9] bg-white px-3.5 py-2 text-xs font-extrabold text-[#1f4e63] shadow-xs">
                  <span>{primaryClass?.label}</span>
                  <span className="text-[#5a7288]">·</span>
                  <span>
                    {primaryClass ? formatStageLabel(primaryClass.grade, locale, true) : ""}
                  </span>
                </div>
              )}
              {primaryClass && <Link className="g1-btn g1-btn-outline" href={`/teacher/classes/${primaryClass.class_id}`}>
                {isTe ? "తరగతి జాబితా" : "Class roster"}
              </Link>}
              <Link
                href="/teacher/assignments"
                className="g1-btn g1-btn-teal min-h-[46px] px-5"
                data-testid="teacher-assign-cta"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                <span>{dict.teacher.assignCta}</span>
              </Link>
            </div>
          </div>
          {classesRes.rows.length > 1 && <nav aria-label={isTe ? "తరగతి ఎంచుకోండి" : "Choose a class"} className="mt-4 flex flex-wrap gap-2">
            {classesRes.rows.map(classroom => <Link key={classroom.class_id} href={`/teacher?classId=${classroom.class_id}`}
              aria-current={classroom.class_id === primaryClass?.class_id ? "true" : undefined}
              className={`g1-btn ${classroom.class_id === primaryClass?.class_id ? "g1-btn-teal" : "g1-btn-outline"}`}>
              {classroom.label}
            </Link>)}
          </nav>}

          <div className="g1-workspace-stats mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="g1-card p-5">
              <div className="text-xs font-bold text-[#4b637a]">{dict.teacher.assignedPracticals}</div>
              <div className="mt-2 font-mono text-3xl font-extrabold tracking-tight text-[#0c2444]">
                {String(assignedCount).padStart(2, "0")}
              </div>
              <div className="mt-1 text-xs text-[#5a7288]">
                {isTe ? "వెర్షన్-పిన్ చేసిన అసైన్‌మెంట్‌లు" : "Version-pinned active assignments"}
              </div>
            </div>
            <div className="g1-card p-5">
              <div className="text-xs font-bold text-[#4b637a]">{dict.teacher.submissionsCount}</div>
              <div className="mt-2 font-mono text-3xl font-extrabold tracking-tight text-[#0c2444]">
                {String(submittedCount).padStart(2, "0")}
              </div>
              <div className="mt-1 text-xs text-[#5a7288]">
                {isTe ? "సర్వర్-మూల్యాంకనం చేసిన సమర్పణలు" : "Server-evaluated class receipts"}
              </div>
            </div>
            <div className="g1-card p-5">
              <div className="text-xs font-bold text-[#4b637a]">{dict.teacher.enrolledLearners}</div>
              <div className="mt-2 font-mono text-3xl font-extrabold tracking-tight text-[#0c2444]">
                {String(enrolledCount).padStart(2, "0")}
              </div>
              <div className="mt-1 text-xs text-[#5a7288]">
                {isTe ? "తరగతి జాబితాలో నమోదు" : "Active learners in class roster"}
              </div>
            </div>
          </div>

          {/* Two-column layout matching 04_Teacher_Dashboard.png */}
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* Left column: Assignments & student evidence */}
            <section
              aria-labelledby="teacher-assignments-heading"
              className="g1-card overflow-hidden p-6 xl:col-span-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="teacher-assignments-heading" className="text-xl font-extrabold text-[#0c2444]">
                    {isTe ? "అసైన్‌మెంట్‌లు & విద్యార్థి సాక్ష్యాలు" : "Assignments & student evidence"}
                  </h2>
                  <p className="mt-1 text-xs text-[#4b637a]">{dict.teacher.assignmentsSub}</p>
                </div>
                <Link
                  href="/teacher/assignments"
                  className="g1-btn g1-btn-teal min-h-[40px] px-4 text-xs"
                >
                  <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isTe ? "+ కొత్త అసైన్‌మెంట్" : "+ New assignment"}</span>
                </Link>
              </div>

              <div className="mt-4 divide-y divide-[#e7eff5]">
                {assignmentsRes.rows.map((asg) => {
                  const copy = getExperimentCopy(asg.experiment_id, locale);
                  const subCount = Number(asg.submissions);
                  const bothModes = asg.modes.length > 1;
                  const onlyExp = asg.modes.length === 1 && asg.modes[0] === "experiment";
                  const modeBadgeText = bothModes
                    ? isTe
                      ? "మార్గదర్శక + పరిశోధన"
                      : "GUIDED + INQUIRY"
                    : onlyExp
                      ? isTe
                        ? "పరిశోధన · ఎక్స్‌పెరిమెంట్ మాత్రమే"
                        : "INQUIRY · EXPERIMENT ONLY"
                      : isTe
                        ? "మార్గదర్శక · సిమ్యులేషన్ మాత్రమే"
                        : "GUIDED · SIMULATION ONLY";

                  return (
                    <div
                      key={asg.assignment_id}
                      className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`g1-tag ${
                              bothModes || onlyExp ? "g1-tag-green" : "g1-tag-blue"
                            }`}
                          >
                            {modeBadgeText}
                          </span>
                          <span className="g1-tag">
                            v{asg.content_version} · Rev #{asg.revision_number}
                          </span>
                          {asg.superseded_at && (
                            <span className="g1-tag g1-tag-warn">
                              {isTe ? "సవరించబడింది" : "Superseded"}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-base font-extrabold text-[#0c2444]">
                          {copy.activityLabel} · {copy.shortTitle}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#4b637a]">
                          {primaryClass?.label} ·{" "}
                          {isTe
                            ? `సమర్పణలు: ${subCount} / ${enrolledCount}`
                            : `Submissions: ${subCount} / ${enrolledCount}`}
                          {asg.due_at
                            ? ` · ${isTe ? "గడువు (IST): " : "Due (IST): "}${new Date(
                                asg.due_at
                              ).toLocaleDateString(locale, {
                                timeZone: "Asia/Kolkata",
                              })}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/experiments/${asg.experiment_id}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#c6dcea] bg-white px-3 py-2 text-xs font-extrabold text-[#30516b] hover:bg-[#f2f8fc]"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{isTe ? "ప్రివ్యూ" : "Preview"}</span>
                        </Link>
                        <Link
                          href={`/teacher/reports?classId=${primaryClass?.class_id}&assignmentId=${asg.assignment_id}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#007875] bg-[#eef9f8] px-3.5 py-2 text-xs font-extrabold text-[#007875] hover:bg-[#ddf3f1]"
                        >
                          <span>{isTe ? "సాక్ష్యాలు పరిశీలించు" : "Inspect evidence"}</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 border-t border-[#e7eff5] pt-3 text-xs text-[#5a7288]">
                {isTe
                  ? "సాక్ష్యాలు ప్రతి అధికారిక తరగతికి పరిమితం చేయబడ్డాయి. వ్యక్తిగత అభ్యాసం గ్రేడెడ్ అసైన్‌మెంట్‌ల నుండి వేరుగా ఉంటుంది."
                  : "Evidence is scoped to each authorized class. Student personal practice remains separated from graded assignments."}
              </p>
            </section>

            {/* Right column: Review a submitted attempt / Lab evidence detail matching 04_Teacher_Dashboard.png */}
            <section
              aria-labelledby="review-attempt-heading"
              className="g1-card flex flex-col justify-between p-6 xl:col-span-5"
            >
              <div>
                <span className="g1-tag g1-tag-blue">
                  {isTe ? "సాక్ష్య ట్రేస్ · నిర్ధారించబడింది" : "EVIDENCE TRACE · SERVER CONFIRMED"}
                </span>
                <h2 id="review-attempt-heading" className="mt-2.5 text-xl font-extrabold text-[#0c2444]">
                  {isTe ? "సమర్పించిన ప్రయత్నాన్ని సమీక్షించండి" : "Review a submitted attempt"}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#4b637a]">
                  {isTe
                    ? "చదవడానికి మాత్రమే యాక్టివిటీ టైమ్‌లైన్ మరియు రూబ్రిక్ సమీక్ష. విద్యార్థి పరిశీలనలు సర్వర్-నిర్ధారణలో ఉంటాయి."
                    : "Read-only activity timeline and rubric criterion breakdown. Student-owned observations stay server-confirmed."}
                </p>

                {latestSub ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-[#dce8f0] bg-[#f4f9fc] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-[#0c2444]">{latestSub.display_name}</strong>
                        <span className="g1-tag g1-tag-green">
                          {latestSub.result.criteriaPassed ?? 0} / {latestSub.result.criteriaTotal ?? 0} ·{" "}
                          {latestSub.result.gradeState}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#4b637a]">
                        {getExperimentCopy(latestSub.experiment_id, locale).shortTitle} (v
                        {latestSub.content_version}) ·{" "}
                        {isTe ? `రివిజన్ #${latestSub.revision}` : `Saved rev #${latestSub.revision}`}
                      </p>
                      <div className="g1-progress mt-3">
                        <span
                          className="g1-progress-bar g1-progress-bar-green"
                          style={{
                            width: `${Math.round(
                              ((latestSub.result.criteriaPassed ?? 1) /
                                Math.max(1, latestSub.result.criteriaTotal ?? 1)) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between border-b border-[#e8f0f5] pb-2">
                        <span className="font-bold text-[#0c2444]">
                          {isTe ? "శాస్త్రీయ పరిశీలనలు" : "Scientific observations"}
                        </span>
                        <span className="g1-tag g1-tag-green">
                          {latestSub.result.evidenceIds?.length ?? 0}{" "}
                          {isTe ? "నిర్ధారించబడ్డాయి" : "Confirmed"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-[#e8f0f5] pb-2">
                        <span className="font-bold text-[#0c2444]">
                          {isTe ? "రూబ్రిక్ ప్రమాణాల మూల్యాంకనం" : "Rubric criteria evaluation"}
                        </span>
                        <span className="g1-tag g1-tag-blue">{latestSub.rubric_version}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-[#dce8f0] bg-[#f8fcff] p-4 text-xs text-[#4b637a]">
                    {isTe
                      ? "ఈ తరగతిలో ఇంకా సమర్పణలు లేవు. విద్యార్థి సమర్పించిన వెంటనే ఇక్కడ రూబ్రిక్ మరియు పరిశీలనల విశ్లేషణ కనిపిస్తుంది."
                      : "No submissions yet for this class. Once a learner submits confirmed observations, criterion-level evidence appears here."}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={primaryClass ? `/teacher/reports?classId=${primaryClass.class_id}` : "/teacher/reports"}
                  className="g1-btn g1-btn-outline w-full justify-center"
                >
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  <span>{dict.teacher.openClassReport}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </section>
          </div>

          <p className="mt-6 text-xs text-[#5a7288]">{dict.teacher.syntheticNotice}</p>
        </main>
      </div>
    </>
  );
}
