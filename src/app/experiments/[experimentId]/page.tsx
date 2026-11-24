import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassBack } from "@/components/GlassBack";
import { experimentCatalogueHref, experimentReturnParams, type ExperimentReturnContext } from "@/lib/lab-discovery";
import { AppHeader } from "@/components/AppHeader";
import { ModeLauncher, type ResolvedAssignmentContext } from "@/components/ModeLauncher";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { getExperimentById } from "@/lib/catalog";
import { query } from "@/lib/db";
import { formatStageLabel } from "@/lib/education-stages";
import { getDictionary, getExperimentCopy } from "@/lib/i18n";
import { getExperimentLesson, listDiscoveryMetadata } from "@/lib/lessons";
import { getLearningContent, getLearningProgress } from "@/lib/learning";
import type { LabMode } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ExperimentDetailPage(props: {
  params: Promise<{ experimentId: string }>;
  searchParams: Promise<ExperimentReturnContext & { assignmentId?: string; version?: string }>;
}) {
  const [{ experimentId }, auth, locale, sp] = await Promise.all([
    props.params,
    getCurrentSession(),
    getRequestLocale(),
    props.searchParams,
  ]);

  let assignmentContext: ResolvedAssignmentContext | null = null;
  let allowedModes: LabMode[] | undefined = undefined;
  let assignmentAccessDenied = false;
  let pinnedVersion: string | undefined = sp.version;

  // W01: Resolve assigned modes, pinned contentVersion, attempt quota and due policy server-side
  if (sp.assignmentId) {
    if (!UUID_RE.test(sp.assignmentId)) {
      assignmentAccessDenied = true;
    } else if (auth?.role === "student" && auth.schoolId && auth.learnerId) {
      const assignRes = await query<{
        assignment_id: string;
        class_label: string;
        experiment_id: string;
        content_version: string;
        rubric_id: string;
        due_at: Date | null;
        is_past_due: boolean;
        late_policy: "allow_late_flagged" | "block_new_after_due";
        max_attempts: number;
        revision_number: number;
        modes: LabMode[];
        mode_rubrics: Array<{ mode: LabMode; rubric_id: string | null }>;
        used_attempts: string;
        active_session_id: string | null;
        active_session_mode: LabMode | null;
      }>(
        `SELECT
           a.assignment_id,
           cl.label AS class_label,
           a.experiment_id,
           a.content_version,
           a.rubric_id,
           a.due_at,
           (a.due_at IS NOT NULL AND a.due_at < now()) AS is_past_due,
           COALESCE(a.late_policy, 'allow_late_flagged') AS late_policy,
           a.max_attempts,
           COALESCE(a.revision_number, 1) AS revision_number,
           ARRAY_AGG(DISTINCT am.mode::text ORDER BY am.mode::text) AS modes,
           JSONB_AGG(JSONB_BUILD_OBJECT('mode', am.mode::text, 'rubric_id', am.rubric_id)) AS mode_rubrics,
           (
             SELECT count(*)::text
             FROM attempt att
             WHERE att.school_id = a.school_id
               AND att.assignment_id = a.assignment_id
               AND att.learner_id = $3
               AND att.submitted_at IS NOT NULL
           ) AS used_attempts,
           (
             SELECT ls.session_id
             FROM attempt att
             JOIN lab_session ls ON ls.school_id = att.school_id AND ls.attempt_id = att.attempt_id
             WHERE att.school_id = a.school_id
               AND att.assignment_id = a.assignment_id
               AND att.learner_id = $3
               AND ls.status IN ('active', 'paused')
             ORDER BY ls.saved_at DESC
             LIMIT 1
           ) AS active_session_id,
           (
             SELECT att.mode::text
             FROM attempt att
             JOIN lab_session ls ON ls.school_id = att.school_id AND ls.attempt_id = att.attempt_id
             WHERE att.school_id = a.school_id
               AND att.assignment_id = a.assignment_id
               AND att.learner_id = $3
               AND ls.status IN ('active', 'paused')
             ORDER BY ls.saved_at DESC
             LIMIT 1
           ) AS active_session_mode
         FROM assignment a
         JOIN classroom cl
           ON cl.school_id = a.school_id
          AND cl.class_id = a.class_id
         JOIN enrollment e
           ON e.school_id = a.school_id
          AND e.class_id = a.class_id
          AND e.learner_id = $3
          AND e.withdrawn_at IS NULL
         JOIN assignment_mode am
           ON am.school_id = a.school_id
          AND am.assignment_id = a.assignment_id
         WHERE a.school_id = $1
           AND a.assignment_id = $2
           AND a.experiment_id = $4
         GROUP BY a.school_id, a.assignment_id, cl.label`,
        [auth.schoolId, sp.assignmentId, auth.learnerId, experimentId]
      );

      const row = assignRes.rows[0];
      if (!row) {
        assignmentAccessDenied = true;
      } else {
        pinnedVersion = row.content_version;
        allowedModes = row.modes;
        const rubricByMode: Partial<Record<LabMode, string>> = {};
        for (const mr of row.mode_rubrics ?? []) {
          rubricByMode[mr.mode] = mr.rubric_id || row.rubric_id;
        }
        assignmentContext = {
          assignmentId: row.assignment_id,
          classLabel: row.class_label,
          contentVersion: row.content_version,
          dueAt: row.due_at ? row.due_at.toISOString() : null,
          isPastDue: Boolean(row.is_past_due),
          latePolicy: row.late_policy,
          maxAttempts: row.max_attempts,
          usedAttempts: Number(row.used_attempts ?? 0),
          activeSessionId: row.active_session_id,
          activeSessionMode: row.active_session_mode,
          rubricByMode,
          revisionNumber: Number(row.revision_number ?? 1),
        };
      }
    }
  }

  const exp = await getExperimentById(experimentId, pinnedVersion);
  if (!exp) {
    notFound();
  }

  const dict = getDictionary(locale);
  const isTe = locale === "te-IN";
  if (exp.experimentId.startsWith("creator-") && (!exp.publishedAt || exp.retiredAt)) notFound();
  const copy = getExperimentCopy(exp.experimentId, locale, exp.subject);
  const subjName = dict.subjects[exp.subject].name;
  const [learning, progress, mappings] = await Promise.all([
    getLearningContent(exp.experimentId, exp.contentVersion),
    getLearningProgress(auth, exp.experimentId, exp.contentVersion),
    listDiscoveryMetadata(),
  ]);
  const versionLessons = mappings.filter(row => row.experiment_id === exp.experimentId && row.content_version === exp.contentVersion);
  const mapping = versionLessons.find(row => row.lesson_id === sp.lesson) ?? versionLessons[0];
  const lesson = getExperimentLesson(exp, locale, mapping);
  const displayGrade = mapping?.grade ?? exp.grade;
  const stageLabel = formatStageLabel(displayGrade, locale);
  const lang = isTe ? "te" : "en";
  const title = learning?.title[lang] ?? copy.title;
  const activity = lesson ? (isTe ? "కృత్యం " : "Activity ") + lesson.activity : copy.activityLabel;
  const catalogueHref = experimentCatalogueHref(exp.subject, sp);
  const browse = experimentReturnParams(sp);
  const detailParams = new URLSearchParams(browse);
  if (typeof sp.assignmentId === "string") detailParams.set("assignmentId", sp.assignmentId);
  if (typeof sp.version === "string") detailParams.set("version", exp.contentVersion);
  const detailPath = "/experiments/" + encodeURIComponent(exp.experimentId);
  const learningParams = new URLSearchParams(detailParams);
  learningParams.delete("version");
  const learningHref = learning && auth?.role !== "teacher"
    ? detailPath + "/learn/" + encodeURIComponent(exp.contentVersion) + (learningParams.size ? "?" + learningParams : "")
    : undefined;

  return (
    <>
      <AppHeader variant="public" locale={locale} auth={auth} />

      <main id="main-content" data-subject={exp.subject} className="g1-premium mx-auto w-full max-w-[1440px] flex-1 px-4 pb-14 pt-7 sm:px-8 lg:px-12">
        <GlassBack href={catalogueHref} label={isTe ? "ప్రయోగశాలకు తిరిగి" : "Back to laboratory"} />
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#4b637a]">
          <Link href="/laboratories" className="hover:text-[#007875] hover:underline">
            {dict.nav.laboratories}
          </Link>
          <span aria-hidden="true">›</span>
          <Link href={catalogueHref} className="hover:text-[#007875] hover:underline">
            {subjName}
          </Link>
          <span aria-hidden="true">›</span>
          <Link href={`/laboratories?grade=${displayGrade}`} className="hover:text-[#007875] hover:underline">
            {stageLabel}
          </Link>
          <span aria-hidden="true">›</span>
          <span className="text-[#0c2444]">{activity}</span>
        </nav>

        {/* Top 2-column hero matching 03_Experiment_Detail.png */}
        <section className="g1-card g1-detail-hero mt-5 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="g1-eyebrow">
              {stageLabel} · {subjName} · {activity}
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#0c2444] sm:text-[41px] sm:leading-[1.12]">
              {title}
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#4b637a]">
              {learning?.description[lang] ?? copy.subtitle}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {lesson && <span className="g1-tag">{lesson.title}</span>}
              <span className="g1-tag" data-testid="detail-version-tag">
                v{exp.contentVersion}
              </span>
              {exp.publicationStatus === "review_pending" ? (
                <span className="g1-tag g1-tag-warn">
                  {isTe ? "పాఠ్యప్రణాళిక సమీక్ష పెండింగ్" : "Curriculum review pending"}
                </span>
              ) : (
                <span className="g1-tag g1-tag-green">
                  {isTe ? "ప్రారంభించగల తటస్థ ప్రయోగం" : "Launchable neutral practical"}
                </span>
              )}
            </div>

            <p className="g1-hint mt-5">{copy.modelLimitNote}</p>
          </div>

          <div className="lg:col-span-7">
            <div
              className="g1-apparatus-display flex h-[230px] items-center justify-center overflow-hidden p-3 sm:h-[348px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={learning?.thumbnailId ? "/api/media/" + learning.thumbnailId : copy.imagePath}
                alt={learning?.thumbnailAlt?.[lang] ?? (title + (isTe ? " — పరికరాల నమూనా చిత్రం" : " — illustrative apparatus diagram"))}
                className="h-full w-full rounded-2xl object-contain"
              />
            </div>
          </div>
        </section>

        {/* Two-mode chooser (Blue Simulation vs Green Experiment) */}
        <ModeLauncher
          experimentId={exp.experimentId}
          labId={exp.labId}
          contentVersion={exp.contentVersion}
          manifestSha256={exp.manifestSha256}
          engineAbi={exp.engineAbi}
          publicationStatus={exp.publicationStatus}
          locale={locale}
          isSignedIn={Boolean(auth)}
          canLaunch={auth?.role === "student" || auth?.role === "teacher"}
          isTeacherPreview={auth?.role === "teacher"}
          assignmentId={sp.assignmentId ?? null}
          allowedModes={allowedModes}
          assignmentContext={assignmentContext}
          assignmentAccessDenied={assignmentAccessDenied}
          learningHref={learningHref}
          browseQuery={browse.toString()}
          returnHref={detailPath + (detailParams.size ? "?" + detailParams : "")}
          journeyLocked={Boolean(learning && auth?.role !== "teacher" && progress?.completed_stage !== 5)}
        />

        {/* Bottom 3-column summary card matching 03_Experiment_Detail.png */}
        <section
          aria-label={isTe ? "ప్రయోగ సారాంశం" : "Experiment summary"}
          className="g1-card mt-6 grid grid-cols-1 gap-6 p-6 md:grid-cols-3"
        >
          <div>
            <h2 className="text-sm font-extrabold text-[#0c2444]">{dict.detail.objectiveHeading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4b637a]">
              {learning?.aim[lang] ?? exp.learningObjectives.join(" ")}
            </p>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#0c2444]">{dict.detail.apparatusHeading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4b637a]">
              {copy.apparatusText}
            </p>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#0c2444]">{dict.detail.safetyHeading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4b637a]">
              {exp.safetyRules.join(" ")}
            </p>
          </div>
        </section>

        {/* Progressive disclosure for provenance, manifest digest & accessibility */}
        <details className="g1-card mt-4 p-5">
          <summary className="cursor-pointer text-sm font-bold text-[#1a3b59]">
            {dict.detail.provenanceToggle}
          </summary>
          <dl className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-bold text-[#4b637a]">
                {isTe ? "ప్రయోగ ID" : "Experiment ID"}
              </dt>
              <dd className="mt-1 font-mono text-[#0c2444]">{exp.experimentId}</dd>
            </div>
            <div>
              <dt className="font-bold text-[#4b637a]">
                {isTe ? "శాస్త్రీయ నమూనా ID" : "Science Model ID"}
              </dt>
              <dd className="mt-1 font-mono text-[#0c2444]">{exp.scienceModelIds.join(", ")}</dd>
            </div>
            <div>
              <dt className="font-bold text-[#4b637a]">
                {isTe ? "పాఠ్యపుస్తక ఆధార రిఫరెన్స్" : "Source Edition Reference"}
              </dt>
              <dd className="mt-1 text-[#0c2444]">
                {exp.curriculumReferences.map((r) => `${r.sourceId}: ${r.locator}`).join("; ")}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-[#4b637a]">
                {isTe ? "పిన్ చేసిన మేనిఫెస్ట్ SHA-256" : "Pinned Manifest SHA-256"}
              </dt>
              <dd className="mt-1 break-all font-mono text-[11px] text-[#0c2444]">
                {exp.manifestSha256}
              </dd>
            </div>
          </dl>
        </details>
      </main>

    </>
  );
}
