import { GlassBack } from "@/components/GlassBack";
import { TableScroll } from "@/components/TableScroll";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Download, ExternalLink, FileCheck2, ShieldCheck, XCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TeacherSidebar } from "@/components/TeacherSidebar";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatStageLabel } from "@/lib/education-stages";
import { getDictionary, getExperimentCopy } from "@/lib/i18n";

export default async function TeacherReportsPage(props: {
  searchParams: Promise<{ classId?: string; assignmentId?: string; inspect?: string }>;
}) {
  const [auth, locale, sp] = await Promise.all([
    getCurrentSession(),
    getRequestLocale(),
    props.searchParams,
  ]);
  if (!auth) redirect("/sign-in?next=/teacher/reports&role=teacher");
  if (auth.role !== "teacher" || !auth.schoolId) redirect("/");

  const dict = getDictionary(locale);
  const isTe = locale === "te-IN";

  const classesRes = await query<{ class_id: string; label: string; grade: number }>(
    `SELECT cl.class_id, cl.label, cl.grade
     FROM classroom cl
     JOIN class_teacher ct ON ct.school_id = cl.school_id AND ct.class_id = cl.class_id
     WHERE cl.school_id = $1 AND ct.principal_id = $2
     ORDER BY cl.grade DESC, cl.label ASC`,
    [auth.schoolId, auth.principalId]
  );

  const activeClass =
    classesRes.rows.find((c) => c.class_id === sp.classId) ?? classesRes.rows[0] ?? null;

  const classAssignmentsRes = activeClass
    ? await query<{
        assignment_id: string;
        experiment_id: string;
        content_version: string;
        revision_number: number;
      }>(
        `SELECT assignment_id, experiment_id, content_version, COALESCE(revision_number, 1) AS revision_number
         FROM assignment
         WHERE school_id = $1 AND class_id = $2
         ORDER BY created_at DESC`,
        [auth.schoolId, activeClass.class_id]
      )
    : { rows: [] };

  const activeAssignmentId =
    sp.assignmentId &&
    classAssignmentsRes.rows.some((a) => a.assignment_id === sp.assignmentId)
      ? sp.assignmentId
      : null;

  const reportsRes = activeClass
    ? await query<{
        assessment_id: string;
        attempt_id: string;
        assignment_id: string | null;
        is_late: boolean;
        learner_id: string;
        display_name: string;
        experiment_id: string;
        content_version: string;
        mode: string;
        rubric_version: string;
        session_id: string;
        revision: string;
        claim_note: string | null;
        result: {
          submissionId?: string;
          gradeState: string;
          criteriaPassed?: number;
          criteriaTotal?: number;
          criteria?: Array<{ id: string; label: string; passed: boolean }>;
          evidenceIds?: string[];
          summary?: string;
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
           att.learner_id,
           pc.display_name,
           att.experiment_id,
           att.content_version,
           att.mode::text,
           asm.rubric_version,
           ls.session_id,
           ls.revision::text,
           ls.state->>'claimNote' AS claim_note,
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
         JOIN school_learner sl ON sl.school_id = att.school_id AND sl.learner_id = att.learner_id
         JOIN principal_credential pc ON pc.principal_id = sl.principal_id
         WHERE asm.school_id = $1
           AND att.class_id = $2
           AND asm.supersedes_id IS NULL
           AND ($3::uuid IS NULL OR att.assignment_id = $3::uuid)
         ORDER BY asm.created_at DESC`,
        [auth.schoolId, activeClass.class_id, activeAssignmentId]
      )
    : { rows: [] };

  const inspectedRow =
    reportsRes.rows.find((r) => r.assessment_id === sp.inspect) ?? reportsRes.rows[0] ?? null;

  return (
    <>
      <AppHeader variant="teacher" locale={locale} auth={auth} />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col lg:flex-row">
        <TeacherSidebar active="reports" locale={locale} schoolName={auth.schoolName} />

        <main id="main-content" data-workspace="teacher" className="g1-premium flex-1 space-y-6 px-4 py-8 sm:px-8 lg:px-10">
        <GlassBack href="/teacher" label={locale === "te-IN" ? "ఉపాధ్యాయ కార్యస్థలానికి తిరిగి" : "Back to teacher workspace"} />
          <div className="g1-card g1-student-welcome flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="g1-eyebrow">{dict.teacher.workspaceEyebrow}</div>
              <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-[#0c2444]">
                {dict.teacher.evidenceReportsHeading}
              </h1>
              <p className="mt-1 text-sm text-[#4b637a]">
                {activeClass
                  ? `${activeClass.label} (${formatStageLabel(activeClass.grade, locale)})`
                  : isTe
                    ? "అధికారిక తరగతి లేదు"
                    : "No authorized class"}{" "}
                · {dict.teacher.evidenceReportsDesc}
              </p>
            </div>
            {activeClass && (
              <a
                href={`/api/v1/teacher/classes/${activeClass.class_id}/reports?format=csv`}
                className="g1-btn g1-btn-outline"
                data-testid="teacher-export-csv"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>{dict.teacher.exportCsv}</span>
              </a>
            )}
          </div>

          {/* Class switcher & Assignment filter strip (W03) */}
          {classesRes.rows.length > 0 && (
            <form
              method="GET"
              action="/teacher/reports"
              className="g1-card flex flex-wrap items-end gap-4 p-4"
              data-testid="teacher-report-filter-bar"
            >
              <div className="min-w-[200px] flex-1">
                <label htmlFor="report-class-select" className="block text-xs font-bold text-[#133354]">
                  {isTe ? "అధికారిక తరగతి ఎంపిక" : "Authorized class"}
                </label>
                <select
                  id="report-class-select"
                  name="classId"
                  defaultValue={activeClass?.class_id ?? ""}
                  className="mt-1 h-10 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3 text-xs font-semibold text-[#0c2444]"
                >
                  {classesRes.rows.map((c) => (
                    <option key={c.class_id} value={c.class_id}>
                      {c.label} ({formatStageLabel(c.grade, locale)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[220px] flex-1">
                <label htmlFor="report-assignment-select" className="block text-xs font-bold text-[#133354]">
                  {isTe ? "అసైన్‌మెంట్ వారీగా ఫిల్టర్" : "Filter by assignment"}
                </label>
                <select
                  id="report-assignment-select"
                  name="assignmentId"
                  defaultValue={activeAssignmentId ?? ""}
                  className="mt-1 h-10 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3 text-xs font-semibold text-[#0c2444]"
                >
                  <option value="">
                    {isTe ? "అన్ని తరగతి అసైన్‌మెంట్‌లు" : "All class assignments"}
                  </option>
                  {classAssignmentsRes.rows.map((a) => (
                    <option key={a.assignment_id} value={a.assignment_id}>
                      {a.experiment_id} (v{a.content_version} · Rev #{a.revision_number})
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="g1-btn g1-btn-teal min-h-[40px] px-4 text-xs">
                {isTe ? "నివేదికను అప్‌డేట్ చేయి" : "Apply filter"}
              </button>
            </form>
          )}

          <div className="g1-hint flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#007875]" aria-hidden="true" />
            <span>
              {isTe
                ? `పాఠశాల-పరిమిత నివేదిక: ${auth.schoolName} లో మీ ఖాతాకు కేటాయించిన తరగతుల సమర్పణలు మాత్రమే ఇక్కడ కనిపిస్తాయి. CSV ఎగుమతులు audit_event లో నమోదు చేయబడతాయి.`
                : `Tenant-isolated report: only submissions from classes assigned to your account in ${auth.schoolName} appear here. CSV exports write an immutable entry to audit_event.`}
            </span>
          </div>

          <section className="g1-card overflow-hidden">
            <TableScroll label={isTe ? "విద్యార్థుల ప్రయోగ ఆధారాలు" : "Submitted learner evidence"} telugu={isTe}>
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f2f8fc] text-[11px] font-bold uppercase tracking-wider text-[#4b637a]">
                    <th className="px-6 py-3">{isTe ? "విద్యార్థి (మారుపేరు ID)" : "Learner (Pseudonymous)"}</th>
                    <th className="px-4 py-3">{isTe ? "ప్రయోగం & వెర్షన్" : "Experiment & Version"}</th>
                    <th className="px-4 py-3">{isTe ? "మోడ్" : "Mode"}</th>
                    <th className="px-4 py-3">{isTe ? "రూబ్రిక్ ఫలితం" : "Rubric Result"}</th>
                    <th className="px-4 py-3">{isTe ? "నిర్ధారించిన పరిశీలనలు" : "Confirmed Evidence"}</th>
                    <th className="px-6 py-3">{isTe ? "సమర్పణ & విశ్లేషణ" : "Submitted & Drill-Down"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8f0f5]">
                  {reportsRes.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-[#4b637a]">
                        {isTe
                          ? "ఈ తరగతికి ఇంకా సమర్పించిన ప్రయత్నాలు నమోదు కాలేదు."
                          : "No submitted attempts recorded yet for this class."}
                      </td>
                    </tr>
                  ) : (
                    reportsRes.rows.map((r) => (
                      <tr key={r.assessment_id} className="align-top">
                        <td className="px-6 py-4">
                          <div className="font-bold text-[#0c2444]">{r.display_name}</div>
                          <div className="font-mono text-[11px] text-[#4b637a]">
                            {r.learner_id.slice(0, 13)}…
                          </div>
                          {r.is_late && (
                            <span className="g1-tag g1-tag-warn mt-1">
                              {isTe ? "గడువు తర్వాత (ఆలస్యం)" : "Submitted past due"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-[#0c2444]">
                            {getExperimentCopy(r.experiment_id, locale).shortTitle}
                          </div>
                          <div className="font-mono text-xs text-[#4b637a]">
                            {r.experiment_id} · v{r.content_version}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`g1-tag ${r.mode === "experiment" ? "g1-tag-green" : "g1-tag-blue"}`}>
                            {r.mode === "experiment" ? dict.common.experiment : dict.common.simulation}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-extrabold text-[#046c49]">
                            {r.result.criteriaPassed ?? 0} / {r.result.criteriaTotal ?? 0} · {r.result.gradeState}
                          </div>
                          <div className="font-mono text-[11px] text-[#4b637a]">{r.rubric_version}</div>
                        </td>
                        <td className="px-4 py-4 text-xs text-[#133354]">
                          <div className="font-bold">
                            {r.result.evidenceIds?.length ?? 0}{" "}
                            {isTe ? "నిర్ధారించిన రికార్డులు" : "confirmed record(s)"}
                          </div>
                          <div className="text-[11px] text-[#4b637a]">
                            {isTe ? `సెషన్ రివిజన్ #${r.revision}` : `Session rev #${r.revision}`}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-[#4b637a]">
                          <div>
                            {new Date(r.created_at).toLocaleString(locale, {
                              timeZone: "Asia/Kolkata",
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </div>
                          <details className="mt-2" data-testid={`evidence-drilldown-${r.assessment_id}`}>
                            <summary className="cursor-pointer font-extrabold text-[#007875] hover:underline">
                              {isTe ? "రూబ్రిక్ & సాక్ష్యాలను పరిశీలించండి ▾" : "Inspect criteria & evidence ▾"}
                            </summary>
                            <div className="mt-2.5 space-y-2.5 rounded-xl border border-[#cbe0ec] bg-[#f5fbfe] p-3 text-xs text-[#133354]">
                              {r.result.summary && (
                                <p className="font-semibold text-[#0c2444]">{r.result.summary}</p>
                              )}
                              {r.result.criteria && r.result.criteria.length > 0 && (
                                <div>
                                  <div className="font-extrabold text-[#0c2444]">
                                    {isTe ? "రూబ్రిక్ ప్రమాణాల తనిఖీ:" : "Rubric Criterion Breakdown:"}
                                  </div>
                                  <ul className="mt-1 space-y-1">
                                    {r.result.criteria.map((c) => (
                                      <li key={c.id} className="flex items-center gap-1.5">
                                        {c.passed ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#046c49]" aria-hidden="true" />
                                        ) : (
                                          <XCircle className="h-3.5 w-3.5 shrink-0 text-[#9b2119]" aria-hidden="true" />
                                        )}
                                        <span className="font-mono text-[11px] font-bold">{c.id}:</span>
                                        <span>{c.label}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {r.observations && r.observations.length > 0 && (
                                <div>
                                  <div className="font-extrabold text-[#0c2444]">
                                    {isTe ? "నిర్ధారించిన ప్రయోగశాల పరిశీలనలు:" : "Confirmed Server Observations:"}
                                  </div>
                                  <ul className="mt-1 space-y-1 font-mono text-[11px]">
                                    {r.observations.map((obs) => (
                                      <li key={obs.observationId} className="rounded bg-white px-2 py-1">
                                        Rev #{obs.revision}: {JSON.stringify(obs.payload).slice(0, 140)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {r.claim_note && (
                                <div>
                                  <span className="font-extrabold text-[#0c2444]">
                                    {isTe ? "విద్యార్థి ముగింపు నమోదు: " : "Recorded learner claim: "}
                                  </span>
                                  <span className="font-mono">{r.claim_note}</span>
                                </div>
                              )}
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableScroll>
          </section>

          {/* Featured Evidence Inspector Card matching 04_Teacher_Dashboard.png */}
          {inspectedRow && (
            <section
              aria-labelledby="featured-evidence-heading"
              className="g1-card p-6"
              data-testid="teacher-featured-evidence-inspector"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="g1-tag g1-tag-blue">
                    {isTe ? "సాక్ష్య విశ్లేషణ · నిర్ధారించబడిన రికార్డు" : "EVIDENCE TRACE · SERVER CONFIRMED"}
                  </span>
                  <h2 id="featured-evidence-heading" className="mt-2 text-xl font-extrabold text-[#0c2444]">
                    {isTe ? "సమర్పించిన ప్రయోగ సాక్ష్యాల వివరాలు" : "Review a submitted attempt — Lab evidence detail"}
                  </h2>
                </div>
                <Link
                  href={`/player/${inspectedRow.session_id}`}
                  className="g1-btn g1-btn-outline min-h-[38px] px-3.5 text-xs"
                >
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  <span>{isTe ? "సెషన్ రీప్లే తెరవండి" : "Open session replay"}</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[#dce8f0] bg-[#f8fcff] p-4">
                  <div className="text-xs font-extrabold text-[#0c2444]">
                    {inspectedRow.display_name} · {getExperimentCopy(inspectedRow.experiment_id, locale).shortTitle} (v{inspectedRow.content_version})
                  </div>
                  <p className="mt-1 text-xs text-[#4b637a]">
                    {isTe ? "రూబ్రిక్: " : "Rubric: "}
                    <code className="font-mono">{inspectedRow.rubric_version}</code> ·{" "}
                    {isTe ? "సేవ్ చేసిన రివిజన్: " : "Saved revision: "}
                    <strong>#{inspectedRow.revision}</strong>
                  </p>
                  <div className="g1-progress mt-3">
                    <span
                      className="g1-progress-bar g1-progress-bar-green"
                      style={{
                        width: `${Math.round(
                          ((inspectedRow.result.criteriaPassed ?? 1) /
                            Math.max(1, inspectedRow.result.criteriaTotal ?? 1)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs">
                    {(inspectedRow.result.criteria ?? []).map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#133354]">{c.label}</span>
                        <span className={`g1-tag ${c.passed ? "g1-tag-green" : "g1-tag-warn"}`}>
                          {c.passed ? (isTe ? "ఉత్తీర్ణత" : "Confirmed") : isTe ? "సమీక్ష అవసరం" : "Needs review"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-[#dce8f0] bg-[#f8fcff] p-4">
                  <div className="text-xs font-extrabold text-[#0c2444]">
                    {isTe ? "నిర్ధారించిన ప్రయోగశాల పరిశీలనల టైమ్‌లైన్" : "Confirmed observation timeline"}
                  </div>
                  {inspectedRow.observations.length === 0 ? (
                    <p className="mt-2 text-xs text-[#4b637a]">
                      {isTe ? "పరిశీలనలు నమోదు కాలేదు." : "No observations recorded."}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-xs">
                      {inspectedRow.observations.map((obs) => (
                        <li
                          key={obs.observationId}
                          className="rounded-xl border border-[#e1ecf3] bg-white p-2.5"
                        >
                          <div className="flex items-center justify-between font-bold text-[#0c2444]">
                            <span>{isTe ? `రివిజన్ #${obs.revision}` : `Committed rev #${obs.revision}`}</span>
                            <span className="font-mono text-[10px] text-[#4b637a]">
                              {obs.observationId.slice(0, 12)}…
                            </span>
                          </div>
                          <div className="mt-1 break-all font-mono text-[11px] text-[#38546c]">
                            {JSON.stringify(obs.payload)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          )}

          <p className="text-xs text-[#5a7288]">
            {isTe ? (
              <>
                బాహ్య LMS గ్రేడ్ సింక్ (1EdTech LTI 1.3 / AGS) అనేది విడిగా ఆమోదించబడే భవిష్యత్
                ఇంటిగ్రేషన్ మరియు ఈ స్థానిక పైలట్‌లో సక్రియంగా లేదు.{" "}
                <Link href="/help" className="font-bold text-[#007875] hover:underline">
                  ప్లాట్‌ఫారమ్ సంసిద్ధత &amp; పాలన
                </Link>
              </>
            ) : (
              <>
                External LMS grade sync (1EdTech LTI 1.3 / AGS) is a separately authorized future
                integration contract and is not active in this local pilot.{" "}
                <Link href="/help" className="font-bold text-[#007875] hover:underline">
                  Platform readiness &amp; governance
                </Link>
              </>
            )}
          </p>
        </main>
      </div>
    </>
  );
}
