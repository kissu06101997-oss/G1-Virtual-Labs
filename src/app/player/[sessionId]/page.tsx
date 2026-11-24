import { notFound, redirect } from "next/navigation";
import { experimentCatalogueHref, experimentReturnParams, type ExperimentReturnContext } from "@/lib/lab-discovery";
import { AppHeader } from "@/components/AppHeader";
import { LabPlayerClient } from "@/components/LabPlayerClient";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getLearningContent } from "@/lib/learning";
import { listDiscoveryMetadata } from "@/lib/lessons";
import type { LabSessionState } from "@/lib/science-adapters";
import type {
  AssessmentContract,
  ExperimentDefinition,
  LabMode,
  LabSubject,
  ObservationRecord,
  SessionContract,
} from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlayerPage(props: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<ExperimentReturnContext>;
}) {
  const [{ sessionId }, auth, locale, search] = await Promise.all([
    props.params,
    getCurrentSession(),
    getRequestLocale(),
    props.searchParams,
  ]);

  const browse = experimentReturnParams(search);
  if (!auth) {
    const next = "/player/" + encodeURIComponent(sessionId) + (browse.size ? "?" + browse : "");
    redirect("/sign-in?next=" + encodeURIComponent(next));
  }
  if (!UUID_RE.test(sessionId) || !auth.schoolId) {
    notFound();
  }

  const res = await query<{
    school_id: string;
    session_id: string;
    attempt_id: string;
    revision: string;
    state: LabSessionState;
    status: "active" | "paused" | "submitted" | "revoked";
    saved_at: Date;
    experiment_id: string;
    content_version: string;
    mode: LabMode;
    class_id: string | null;
    assignment_id: string | null;
    subject: LabSubject;
    manifest_digest: string;
    abi: string;
    definition: ExperimentDefinition;
    owner_principal_id: string;
    checkpoint_digest: string | null;
  }>(
    `SELECT
       ls.school_id, ls.session_id, ls.attempt_id, ls.revision::text, ls.state, ls.status, ls.saved_at,
       a.experiment_id, a.content_version, a.mode, a.class_id, a.assignment_id,
       ev.subject, ev.manifest_digest, ev.abi, ev.definition,
       sl.principal_id AS owner_principal_id,
       cp.digest AS checkpoint_digest
     FROM lab_session ls
     JOIN attempt a ON a.school_id = ls.school_id AND a.attempt_id = ls.attempt_id
     JOIN school_learner sl ON sl.school_id = a.school_id AND sl.learner_id = a.learner_id
     JOIN experiment_version ev ON ev.experiment_id = a.experiment_id AND ev.content_version = a.content_version
     LEFT JOIN checkpoint cp ON cp.school_id = ls.school_id AND cp.session_id = ls.session_id AND cp.revision = ls.revision
     WHERE ls.session_id = $1`,
    [sessionId]
  );

  const row = res.rows[0];
  if (!row || row.school_id !== auth.schoolId) {
    notFound();
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
    notFound();
  }

  const [obsRes, assessRes, learning, mappings] = await Promise.all([
    query<{ data: ObservationRecord }>(
      `SELECT data FROM observation WHERE school_id = $1 AND session_id = $2 ORDER BY revision ASC, observation_id ASC`,
      [row.school_id, row.session_id]
    ),
    query<{ result: AssessmentContract & { criteriaPassed?: number; criteriaTotal?: number; summary?: string } }>(
      `SELECT result FROM assessment WHERE school_id = $1 AND attempt_id = $2 AND supersedes_id IS NULL LIMIT 1`,
      [row.school_id, row.attempt_id]
    ),
    row.experiment_id.startsWith("creator-") ? getLearningContent(row.experiment_id, row.content_version) : null,
    row.experiment_id.startsWith("creator-") ? listDiscoveryMetadata() : [],
  ]);
  const versionMappings = mappings.filter(item => item.experiment_id === row.experiment_id && item.content_version === row.content_version);
  const mapping = versionMappings.find(item => item.lesson_id === browse.get("lesson")) ?? versionMappings[0];
  const detailPath = "/experiments/" + encodeURIComponent(row.experiment_id);
  const journeyParams = new URLSearchParams(browse);
  if (row.assignment_id) journeyParams.set("assignmentId", row.assignment_id);
  const detailParams = new URLSearchParams(journeyParams);
  detailParams.set("version", row.content_version);
  const overviewHref = detailPath + "?" + detailParams;
  const journeyHref = learning && auth.role === "student" && row.mode === "simulation" ? detailPath + "/learn/" + encodeURIComponent(row.content_version) + (journeyParams.size ? "?" + journeyParams : "") : null;

  const rev = Number(row.revision);
  const initialSession: SessionContract = {
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

  const dict = getDictionary(locale);
  const headerSub = `${dict.common.classWord} ${mapping?.grade ?? row.definition.grade} · ${dict.subjects[row.subject].name}`;

  return (
    <>
      <AppHeader
        variant="player"
        locale={locale}
        auth={auth}
        playerMeta={{
          subtitle: headerSub,
          exitHref: journeyHref ?? (auth.role === "student" && !browse.size ? "/student" : overviewHref),
        }}
      />
      <LabPlayerClient
        overviewHref={overviewHref}
        catalogueHref={experimentCatalogueHref(row.subject, search)}
        initialSession={initialSession}
        initialState={row.state}
        initialObservations={obsRes.rows.map((r) => r.data)}
        initialAssessment={assessRes.rows[0]?.result ?? null}
        definition={row.definition}
        actorId={auth.principalId}
        locale={locale}
        authoredTitle={learning?.title[locale === "te-IN" ? "te" : "en"]}
        authoredActivity={mapping ? (locale === "te-IN" ? "కృత్యం " : "Activity ") + mapping.activity_number : undefined}
      />
    </>
  );
}
