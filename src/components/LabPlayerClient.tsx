"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { LabStageCanvas, type DispatchActionArgs } from "./LabStageCanvas";
import { apiFetch, generateIdempotencyKey } from "@/lib/client-api";
import { formatStageLabel } from "@/lib/education-stages";
import { getDictionary, getExperimentCopy } from "@/lib/i18n";
import type { LabSessionState } from "@/lib/science-adapters";
import type {
  AssessmentContract,
  ExperimentDefinition,
  LabActionResult,
  Locale,
  ObservationRecord,
  SessionContract,
} from "@/lib/types";

interface AssessmentSummary extends AssessmentContract {
  criteriaPassed?: number;
  criteriaTotal?: number;
  summary?: string;
}

interface LabPlayerClientProps {
  overviewHref: string;
  catalogueHref: string;
  initialSession: SessionContract;
  initialState: LabSessionState;
  initialObservations: ObservationRecord[];
  initialAssessment: AssessmentSummary | null;
  definition: ExperimentDefinition;
  actorId: string;
  locale: Locale;
  authoredTitle?: string;
  authoredActivity?: string;
}

export function LabPlayerClient({
  overviewHref,
  catalogueHref,
  initialSession,
  initialState,
  initialObservations,
  initialAssessment,
  definition,
  actorId,
  locale,
  authoredTitle,
  authoredActivity,
}: LabPlayerClientProps) {
  const dict = getDictionary(locale);
  const isTe = locale === "te-IN";
  const baseCopy = getExperimentCopy(definition.experimentId, locale, definition.subject);
  const copy = {
    ...baseCopy,
    shortTitle: authoredTitle ?? baseCopy.shortTitle,
    activityLabel: authoredActivity ?? baseCopy.activityLabel,
  };

  const [session, setSession] = useState<SessionContract>(initialSession);
  const [state, setState] = useState<LabSessionState>(initialState);
  const [observations, setObservations] = useState<ObservationRecord[]>(initialObservations);
  const [assessment, setAssessment] = useState<AssessmentSummary | null>(initialAssessment);

  // Bounded variable inputs for Experiment Mode
  const [zincUmol, setZincUmol] = useState<number>(initialState.zincUmol ?? 2.0);
  const [acidEqUmol, setAcidEqUmol] = useState<number>(initialState.acidEqUmol ?? 3.0);
  const [incidentAngle, setIncidentAngle] = useState<number>(initialState.incidentAngleDeg ?? 45);
  const [slabThickness, setSlabThickness] = useState<number>(initialState.slabThicknessMm ?? 20);
  const [bioField, setBioField] = useState<number>(initialState.selectedField ?? 0);
  const [bioPlane, setBioPlane] = useState<number>(initialState.acquiredPlane ?? 0);
  const [claimChoice, setClaimChoice] = useState<string>(
    initialState.claimNote || "supported_model_and_limits_verified"
  );

  const [busy, setBusy] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    args: DispatchActionArgs;
    idempotencyKey: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "info" | "error" | "success" | "offline";
    text: string;
  } | null>(null);

  useEffect(() => {
    function handleOffline() {
      setIsOffline(true);
    }
    function handleOnline() {
      setIsOffline(false);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("offline", handleOffline);
      window.addEventListener("online", handleOnline);
      return () => {
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("online", handleOnline);
      };
    }
  }, []);

  const isSim = session.mode === "simulation";
  const isSubmitted = session.status === "submitted" || assessment !== null;
  const steps = isSim
    ? definition.modeConfigurations.simulation.steps
    : definition.modeConfigurations.experiment.steps;
  const rubricId = isSim
    ? definition.modeConfigurations.simulation.rubricId
    : definition.modeConfigurations.experiment.rubricId;

  async function syncFromServer() {
    const res = await apiFetch<{
      session?: SessionContract;
      state?: LabSessionState;
      observations?: ObservationRecord[];
      assessment?: AssessmentSummary | null;
    }>(`/api/v1/sessions/${session.sessionId}?include=full`);
    if (res.networkError || res.status === 0) {
      setIsOffline(true);
      setFeedback({
        kind: "offline",
        text: isTe
          ? `ఆఫ్‌లైన్ / కనెక్షన్ లేదు: చివరిగా నిర్ధారించిన చెక్‌పాయింట్ రివిజన్ #${session.revision} వద్ద సురక్షితంగా ఉంది.`
          : `Offline / connection unavailable: Last confirmed checkpoint remains at revision #${session.revision}.`,
      });
      return false;
    }
    if (res.ok && res.data.session && res.data.state) {
      setIsOffline(false);
      setSession(res.data.session);
      setState(res.data.state);
      if (res.data.observations) setObservations(res.data.observations);
      if (res.data.assessment !== undefined) setAssessment(res.data.assessment);
      return true;
    }
    return false;
  }

  async function dispatchAction(
    args: DispatchActionArgs,
    explicitIdempotencyKey?: string
  ): Promise<boolean> {
    if (busy || isSubmitted) return false;
    setBusy(true);
    setFeedback(null);

    const idemKey = explicitIdempotencyKey ?? generateIdempotencyKey("act");

    try {
      const payload = {
        sessionId: session.sessionId,
        labId: session.labId,
        experimentId: session.experimentId,
        mode: session.mode,
        actorId,
        targetObjectId: args.targetObjectId,
        actionType: args.actionType,
        parametersWithUnits: args.parametersWithUnits ?? {},
        expectedRevision: session.revision,
        ...(args.interactionPort ? { interactionPort: args.interactionPort } : {}),
        ...(args.choiceId ? { choiceId: args.choiceId } : {}),
      };

      const res = await apiFetch<LabActionResult & { detail?: string }>(
        `/api/v1/sessions/${session.sessionId}/actions`,
        {
          method: "POST",
          body: payload,
          idempotencyKey: idemKey,
        }
      );

      // W05: Network disconnect / offline handling without unhandled rejection
      if (res.networkError || res.status === 0) {
        setIsOffline(true);
        setPendingAction({ args, idempotencyKey: idemKey });
        setFeedback({
          kind: "offline",
          text: isTe
            ? `ఆఫ్‌లైన్ / కనెక్షన్ పోయింది: ఈ చర్య ఇంకా సర్వర్‌లో సేవ్ కాలేదు. చివరిగా నిర్ధారించిన రివిజన్ #${session.revision}. నెట్‌వర్క్ తిరిగి వచ్చిన తర్వాత 'మళ్ళీ ప్రయత్నించండి' నొక్కండి.`
            : `Offline / connection lost: Action was not confirmed by server. Last confirmed checkpoint remains at revision #${session.revision} (unsaved intent pending retry).`,
        });
        return false;
      }

      setIsOffline(false);

      if (res.status === 409 && res.data.reasonCode === "REVISION_CONFLICT") {
        // Authoritative conflict recovery: fetch confirmed checkpoint!
        setPendingAction(null);
        setFeedback({
          kind: "error",
          text: isTe
            ? `రివిజన్ వైరుధ్యం (409): సర్వర్ రివిజన్ ${res.data.committedRevision} వద్ద ఉంది. నిర్ధారించిన చెక్‌పాయింట్‌తో సమకాలీకరిస్తోంది...`
            : `Revision conflict (409): server is at revision ${res.data.committedRevision}. Syncing confirmed checkpoint...`,
        });
        await syncFromServer();
        return false;
      }

      if (!res.ok || !res.data.accepted) {
        setPendingAction(null);
        setFeedback({
          kind: "error",
          text: `${res.data.reasonCode || "REJECTED"}: ${
            res.data.uncertainty?.note ||
            res.data.detail ||
            (isTe
              ? "సెషన్ స్థితిని మార్చకుండా చర్య తిరస్కరించబడింది."
              : "Action rejected without mutating session state.")
          }`,
        });
        return false;
      }

      // Refresh authoritative state + checkpoint from PostgreSQL
      setPendingAction(null);
      await syncFromServer();
      setFeedback({
        kind: "success",
        text: isTe
          ? `రివిజన్ ${res.data.committedRevision} వద్ద సర్వర్ నిర్ధారించింది (${res.data.reasonCode}).`
          : `Committed at revision ${res.data.committedRevision} (${res.data.reasonCode}).`,
      });
      return true;
    } catch {
      setIsOffline(true);
      setPendingAction({ args, idempotencyKey: idemKey });
      setFeedback({
        kind: "offline",
        text: isTe
          ? `ఆఫ్‌లైన్ / నెట్‌వర్క్ లోపం: చివరిగా నిర్ధారించిన రివిజన్ #${session.revision} సురక్షితంగా ఉంది.`
          : `Offline / network error: Last confirmed checkpoint remains at revision #${session.revision}.`,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryPendingAction() {
    if (pendingAction) {
      await dispatchAction(pendingAction.args, pendingAction.idempotencyKey);
    } else {
      await syncFromServer();
    }
  }

  async function handleGuidedStepAdvance() {
    const idx = state.stepIndex;
    if (idx === 0) {
      await dispatchAction({
        targetObjectId: definition.sceneId,
        actionType: "complete_aim",
      });
      return;
    }

    if (definition.subject === "chemistry") {
      if (idx === 1) {
        await dispatchAction({
          targetObjectId: "chem.transfer:1",
          actionType: "setup_apparatus",
          interactionPort: "port_soap_receiver",
        });
      } else if (idx === 2) {
        const ok1 = await dispatchAction({
          targetObjectId: "chem.reaction-tube:1",
          actionType: "identify_reagent",
          choiceId: "Zn",
        });
        if (ok1) {
          await dispatchAction({
            targetObjectId: "chem.reaction-tube:1",
            actionType: "identify_reagent",
            choiceId: "dilute_H2SO4",
          });
        }
      } else if (idx === 3) {
        await dispatchAction({
          targetObjectId: "chem.reaction-tube:1",
          actionType: "propose_virtual_amount",
          parametersWithUnits: {
            zincAmount: { value: 2.0, unit: "umol" },
            acidEquivalent: { value: 3.0, unit: "umol" },
          },
        });
      } else {
        await dispatchAction({
          targetObjectId: definition.sceneId,
          actionType: "record_claim",
          choiceId: claimChoice,
        });
      }
      return;
    }

    if (definition.subject === "physics") {
      if (idx === 1) {
        await dispatchAction({
          targetObjectId: "phys.glass-slab:1",
          actionType: "place_optic",
          interactionPort: "port_parallel_normal",
        });
      } else if (idx === 2) {
        await dispatchAction({
          targetObjectId: "phys.glass-slab:1",
          actionType: "select_incident_ray",
          parametersWithUnits: {
            angle: { value: 45, unit: "deg" },
            slabThickness: { value: 20, unit: "mm" },
          },
        });
      } else if (idx === 3) {
        await dispatchAction({
          targetObjectId: "phys.glass-slab:1",
          actionType: "observe_ray",
          parametersWithUnits: {
            angle: { value: 30, unit: "deg" },
            slabThickness: { value: 20, unit: "mm" },
          },
        });
      } else {
        await dispatchAction({
          targetObjectId: definition.sceneId,
          actionType: "record_claim",
          choiceId: claimChoice,
        });
      }
      return;
    }

    // Biology guided steps
    if (idx === 1) {
      await dispatchAction({
        targetObjectId: "bio.prepared-onion-slide:1",
        actionType: "select_field",
        parametersWithUnits: { fieldIndex: { value: 1, unit: "1" } },
      });
    } else if (idx === 2) {
      await dispatchAction({
        targetObjectId: "bio.compound-microscope:1",
        actionType: "select_acquired_plane",
        parametersWithUnits: { fixturePlaneIndex: { value: 1, unit: "1" } },
      });
    } else if (idx === 3) {
      await dispatchAction({
        targetObjectId: "bio.image-view:1",
        actionType: "mark_visible_boundary",
        choiceId: "cell_wall",
      });
    } else {
      await dispatchAction({
        targetObjectId: definition.sceneId,
        actionType: "record_claim",
        choiceId: claimChoice,
      });
    }
  }

  async function handleRunExperimentTrial(isComparison = false) {
    if (definition.subject === "chemistry") {
      await dispatchAction({
        targetObjectId: "chem.reaction-tube:1",
        actionType: isComparison ? "compare_observation" : "propose_virtual_amount",
        parametersWithUnits: {
          zincAmount: { value: zincUmol, unit: "umol" },
          acidEquivalent: { value: acidEqUmol, unit: "umol" },
        },
      });
    } else if (definition.subject === "physics") {
      await dispatchAction({
        targetObjectId: "phys.glass-slab:1",
        actionType: isComparison ? "observe_ray" : "select_incident_ray",
        parametersWithUnits: {
          angle: { value: incidentAngle, unit: "deg" },
          slabThickness: { value: slabThickness, unit: "mm" },
        },
      });
    } else {
      const ok1 = await dispatchAction({
        targetObjectId: "bio.prepared-onion-slide:1",
        actionType: "select_field",
        parametersWithUnits: { fieldIndex: { value: bioField, unit: "1" } },
      });
      if (ok1) {
        await dispatchAction({
          targetObjectId: "bio.compound-microscope:1",
          actionType: "select_acquired_plane",
          parametersWithUnits: { fixturePlaneIndex: { value: bioPlane, unit: "1" } },
        });
      }
    }
  }

  function useControlSettings() {
    const control = state.controlTrial;
    if (!control) return;
    if (typeof control.zincUmol === "number") setZincUmol(control.zincUmol);
    if (typeof control.acidEqUmol === "number") setAcidEqUmol(control.acidEqUmol);
    if (typeof control.incidentAngleDeg === "number") setIncidentAngle(control.incidentAngleDeg);
    if (typeof control.slabThicknessMm === "number") setSlabThickness(control.slabThicknessMm);
    if (typeof control.selectedField === "number") setBioField(control.selectedField);
    if (typeof control.acquiredPlane === "number") setBioPlane(control.acquiredPlane);
  }

  async function handleSubmitAttempt() {
    if (busy || isSubmitted) return;
    setBusy(true);
    setFeedback(null);
    try {
      const evidenceIds = observations.map((o) => o.observationId);
      const res = await apiFetch<AssessmentSummary & { detail?: string }>(
        `/api/v1/attempts/${session.attemptId}/submission`,
        {
          method: "POST",
          body: {
            expectedRevision: session.revision,
            rubricId,
            evidenceIds,
          },
        }
      );

      if (res.networkError || res.status === 0) {
        setIsOffline(true);
        setFeedback({
          kind: "offline",
          text: isTe
            ? `ఆఫ్‌లైన్ / కనెక్షన్ లేదు: సమర్పణ ఇంకా పూర్తి కాలేదు. చివరిగా నిర్ధారించిన రివిజన్ #${session.revision} సురక్షితంగా ఉంది.`
            : `Offline / connection unavailable: Submission could not reach server. Confirmed revision #${session.revision} is preserved.`,
        });
        return;
      }

      if (!res.ok) {
        setFeedback({
          kind: "error",
          text:
            res.data.detail ||
            (isTe ? "మూల్యాంకనాన్ని సమర్పించడం సాధ్యం కాలేదు." : "Unable to submit assessment."),
        });
        return;
      }

      await syncFromServer();
      setFeedback({
        kind: "success",
        text: isTe
          ? `మూల్యాంకనం సమర్పించబడింది మరియు లాక్ చేయబడింది (సమర్పణ ID ${res.data.submissionId}).`
          : `Assessment submitted and locked (Submission ID ${res.data.submissionId}).`,
      });
    } finally {
      setBusy(false);
    }
  }

  // Primary theoretical value readout for Experiment Mode right panel
  const primaryTheoryMetric =
    definition.subject === "chemistry"
      ? {
          label: isTe ? "గరిష్ట సైద్ధాంతిక H₂ పరిమితి" : "Maximum theoretical H₂",
          value:
            state.theoreticalH2Umol !== null && state.theoreticalH2Umol !== undefined
              ? `${state.theoreticalH2Umol} µmol`
              : isTe
                ? "ఇంకా గణించలేదు"
                : "Not computed",
          note: isTe
            ? "ప్రస్తుత పరిమిత స్టోయికియోమెట్రీ ఇన్‌పుట్‌లకు"
            : "For current synthetic stoichiometry inputs",
        }
      : definition.subject === "physics"
        ? {
            label: isTe ? "సైద్ధాంతిక పార్శ్వ విస్థాపనం" : "Theoretical transverse offset",
            value:
              state.transverseOffsetMm !== null && state.transverseOffsetMm !== undefined
                ? `${state.transverseOffsetMm} mm`
                : isTe
                  ? "ఇంకా గణించలేదు"
                  : "Not computed",
            note:
              state.refractedAngleDeg !== null && state.refractedAngleDeg !== undefined
                ? isTe
                  ? `వక్రీభవన కోణం r = ${state.refractedAngleDeg}° (నిర్గమ కోణం e = ${state.emergentAngleDeg}°)`
                  : `Refracted angle r = ${state.refractedAngleDeg}° (emergent e = ${state.emergentAngleDeg}°)`
                : isTe
                  ? "ఆదర్శ స్నెల్ జ్యామితి (n = 1.500)"
                  : "Ideal Snell geometry (n = 1.500)",
          }
        : {
            label: isTe ? "పరిమాణాత్మక స్కేల్ కాలిబ్రేషన్" : "Quantitative scale calibration",
            value: isTe ? "అందుబాటులో లేదు" : "Unavailable",
            note: isTe
              ? `గుణాత్మక పరిశీలన: ఫీల్డ్ ${state.selectedField ?? 0} · ప్లేన్ ${state.acquiredPlane ?? 0}`
              : `Qualitative inspection: Field ${state.selectedField ?? 0} · Plane ${state.acquiredPlane ?? 0}`,
          };

  function formatTrialSummary(trial: Record<string, unknown> | null | undefined): string {
    if (!trial) return isTe ? "నమోదు కాలేదు" : "Not recorded";
    if (definition.subject === "chemistry" && typeof trial.theoreticalH2Umol === "number") {
      return `${trial.theoreticalH2Umol} µmol H₂ (${trial.zincUmol} Zn, ${trial.acidEqUmol} H⁺)`;
    }
    if (definition.subject === "physics" && typeof trial.transverseOffsetMm === "number") {
      return `${trial.transverseOffsetMm} mm (i=${trial.incidentAngleDeg}°, d=${trial.slabThicknessMm} mm)`;
    }
    if (definition.subject === "biology") {
      return isTe
        ? `ఫీల్డ్ ${String(trial.selectedField ?? 0)} · ప్లేన్ ${String(trial.acquiredPlane ?? 0)} (గుణాత్మకం)`
        : `Field ${String(trial.selectedField ?? 0)} · Plane ${String(trial.acquiredPlane ?? 0)} (qualitative)`;
    }
    return isTe ? "నమోదు చేయబడింది" : "Recorded";
  }

  const stageLabel = formatStageLabel(definition.grade, locale);
  const subjName = dict.subjects[definition.subject].name;
  const currentStepNumber = Math.min(steps.length, state.stepIndex + 1);

  return (
    <main id="main-content" data-subject={definition.subject} data-mode={isSim ? "simulation" : "experiment"} className={`g1-premium mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-8 lg:px-10 ${isSim ? "g1-player-sim" : "g1-player-inquiry"}`}>
      {/* Top Breadcrumb + Authoritative Revision Row matching 03_Simulation_Player_Premium.png */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#e1ecf3] pb-3">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#38546c]"
        >
          <Link href="/laboratories" className="hover:text-[#007875] hover:underline">
            ‹ {dict.nav.laboratories}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={catalogueHref}
            className="hover:text-[#007875] hover:underline"
          >
            {subjName}
          </Link>
          <span aria-hidden="true">/</span>
          <strong className="text-[#0c2444]">
            {stageLabel} · {copy.activityLabel}
          </strong>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <span className="g1-tag" data-testid="player-status-chip">
            {isSim
              ? isTe
                ? `దశ ${currentStepNumber} / ${steps.length}`
                : `Step ${currentStepNumber} of ${steps.length}`
              : copy.modelScopeBadge}
          </span>
          <span
            className={`g1-tag font-mono ${
              isOffline || pendingAction ? "g1-tag-warn" : "g1-tag-green"
            }`}
            data-testid="player-revision-badge"
          >
            {isOffline || pendingAction ? "⚠ " : "✓ "}
            {dict.player.savedAtRevision} {session.revision}
          </span>
        </div>
      </div>

      {/* Title & Mode Indicator Row matching 03_Simulation_Player_Premium.png */}
      <div className={`g1-mode-heading mb-5 flex flex-wrap items-center justify-between gap-4 ${isSim ? "g1-mode-heading-sim" : "g1-mode-heading-exp"}`}>
        <div>
          <div className="g1-eyebrow">
            {isTe ? "ఇంటరాక్టివ్ ప్రయోగశాల వేదిక" : "INTERACTIVE LEARNING SPACE"}
          </div>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#0c2444] sm:text-[32px]">
            {copy.activityLabel} — {copy.shortTitle}
          </h1>
          <p className="mt-1 text-xs font-medium text-[#38546c]">
            {copy.modelLimitNote} · {stageLabel} · Manifest {session.manifestSha256.slice(0, 12)}…
          </p>
        </div>

        <span className={`g1-tag ${isSim ? "g1-tag-blue" : "g1-tag-green"}`}>
          {isSim ? dict.common.simulation : dict.common.experiment}
        </span>
      </div>

      {/* W05: Explicit Offline / Unsaved Intent Banner with Retry */}
      {(isOffline || pendingAction || feedback?.kind === "offline") && (
        <div
          role="alert"
          data-testid="player-offline-banner"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f5d5a3] bg-[#fff4d7] px-4 py-3 text-sm font-semibold text-[#805100]"
        >
          <div className="flex items-center gap-2.5">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {feedback?.kind === "offline"
                ? feedback.text
                : isTe
                  ? `నెట్‌వర్క్ కనెక్షన్ అందుబాటులో లేదు. చివరిగా నిర్ధారించిన చెక్‌పాయింట్ రివిజన్ #${session.revision} వద్ద సురక్షితంగా ఉంది.`
                  : `Network disconnected. Your last confirmed server checkpoint remains intact at revision #${session.revision}.`}
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleRetryPendingAction()}
            data-testid="player-retry-action-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#805100] bg-white px-3.5 py-1.5 text-xs font-extrabold text-[#805100] hover:bg-[#fffaf0]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {pendingAction
                ? isTe
                  ? "పెండింగ్ చర్యను మళ్ళీ ప్రయత్నించండి"
                  : "Retry pending action"
                : isTe
                  ? "సర్వర్‌తో సమకాలీకరించండి"
                  : "Reconnect & sync"}
            </span>
          </button>
        </div>
      )}

      {/* Live status / rejection / submitted rubric feedback */}
      {feedback && feedback.kind !== "offline" && (
        <div
          role={feedback.kind === "error" ? "alert" : "status"}
          data-testid="player-feedback-banner"
          className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            feedback.kind === "error"
              ? "border-[#fecdca] bg-[#fef3f2] text-[#b42318]"
              : "border-[#b4e6cf] bg-[#eafbf2] text-[#046c49]"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.kind === "error" ? (
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => void syncFromServer()}
            className="inline-flex items-center gap-1 text-xs underline"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isTe ? "సింక్" : "Sync"}</span>
          </button>
        </div>
      )}

      {isSubmitted && assessment && (
        <section
          aria-label="Submitted rubric feedback"
          data-testid="player-submitted-banner"
          className="mb-5 rounded-2xl border border-[#b4e6cf] bg-[#eafbf2] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#046c49]">
                {isTe
                  ? "సమర్పించబడింది · అధికారిక సర్వర్ రూబ్రిక్ ఫలితం"
                  : "Submitted · Authoritative Server Rubric"}
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-[#0c2444]">
                {assessment.rubricId} — {assessment.gradeState.toUpperCase()}
                {assessment.criteriaTotal
                  ? isTe
                    ? ` (${assessment.criteriaPassed}/${assessment.criteriaTotal} ప్రమాణాలు నెరవేరాయి)`
                    : ` (${assessment.criteriaPassed}/${assessment.criteriaTotal} criteria met)`
                  : ""}
              </h2>
              {assessment.summary && (
                <p className="mt-1 text-xs text-[#2a4f44]">{assessment.summary}</p>
              )}
            </div>
            <Link href="/student" className="g1-btn g1-btn-green min-h-[40px] text-xs">
              {isTe ? "డాష్‌బోర్డ్‌కు తిరిగి వెళ్ళండి →" : "Return to dashboard →"}
            </Link>
          </div>
        </section>
      )}

      {/* 3-Column Player Workspace matching 03_Simulation_Player_Premium.png */}
      <div className="g1-player-workspace grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* LEFT PANEL */}
        <section
          aria-label={isSim ? dict.player.currentStep : dict.player.inquirySetup}
          className="g1-card flex flex-col justify-between p-5 lg:col-span-3"
        >
          {isSim ? (
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#0663ab]">
                {dict.player.currentStep} &nbsp; {String(currentStepNumber).padStart(2, "0")} /{" "}
                {String(steps.length).padStart(2, "0")}
              </div>
              <h2 className="mt-2 text-lg font-extrabold text-[#0c2444]">
                {steps[Math.min(steps.length - 1, state.stepIndex)]}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[#4b637a]">
                {isTe
                  ? "వేదికపై ఉన్న హైలైట్ చేసిన నియంత్రణ లేదా అందుబాటులో ఉండే పరికరాల జాబితాను ఉపయోగించి ప్రతి మార్గదర్శక దశను పూర్తి చేయండి."
                  : "Complete each guided step using the highlighted bench control or the accessible Equipment list."}
              </p>

              <hr className="my-4 border-[#dfebf2]" />

              <ol className="space-y-2 text-xs">
                {steps.map((label, idx) => {
                  const done = state.completedSteps.includes(idx);
                  const active = idx === state.stepIndex && !isSubmitted;
                  return (
                    <li
                      key={label}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-semibold ${
                        active
                          ? "bg-[#e4f2ff] font-extrabold text-[#0663ab]"
                          : done
                            ? "text-[#007875]"
                            : "text-[#4b637a]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                          active
                            ? "bg-[#0663ab] text-white shadow-xs"
                            : done
                              ? "bg-[#e3f7f4] text-[#007875]"
                              : "bg-[#eef4f8] text-[#4b637a]"
                        }`}
                      >
                        {done ? "✓" : idx + 1}
                      </span>
                      <span>{label}</span>
                    </li>
                  );
                })}
              </ol>

              <div className="g1-hint mt-5">
                {isTe
                  ? "ⓘ హైలైట్ చేసిన పరికరాలు లేదా అందుబాటులో ఉండే పరికరాల జాబితాను ఉపయోగించండి. చెల్లని కనెక్షన్‌లు ప్రయోగ స్థితిని మార్చకుండా కారణాన్ని వివరిస్తాయి."
                  : "ⓘ Use highlighted apparatus or the accessible Equipment list. Invalid connections or unsupported reagents explain what to correct without mutating lab state."}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#046c49]">
                {dict.player.inquirySetup}
              </div>
              <h2 className="mt-2 text-lg font-extrabold leading-snug text-[#0c2444]">
                {copy.inquiryQuestion}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[#4b637a]">
                {isTe
                  ? "ఒక చరరాశిని స్థిరంగా ఉంచండి. పోలిక కోసం ఆమోదించబడిన పరిధిలో మరొక పారామీటర్‌ను మార్చండి."
                  : "Keep one variable fixed. Change one approved parameter within its admitted domain for comparison."}
              </p>

              <hr className="my-4 border-[#dfebf2]" />

              {definition.subject === "chemistry" && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="var-zinc" className="block text-xs font-bold text-[#133354]">
                      {isTe
                        ? "జింక్ పరిమాణం (µmol · 0–10, దశ 0.5)"
                        : "Zinc amount (µmol · 0–10, step 0.5)"}
                    </label>
                    <select
                      id="var-zinc"
                      disabled={isSubmitted}
                      value={zincUmol}
                      onChange={(e) => setZincUmol(Number(e.target.value))}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f3f9fb] px-3 text-sm font-semibold text-[#0c2444]"
                    >
                      {[0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((v) => (
                        <option key={v} value={v}>
                          {v.toFixed(1)} µmol
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="var-acid" className="block text-xs font-bold text-[#133354]">
                      {isTe
                        ? "ఆమ్ల సమానమైన పరిమాణం (µmol H⁺ eq · 0–10)"
                        : "Acid equivalents (µmol H⁺ eq · 0–10)"}
                    </label>
                    <select
                      id="var-acid"
                      disabled={isSubmitted}
                      value={acidEqUmol}
                      onChange={(e) => setAcidEqUmol(Number(e.target.value))}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f3f9fb] px-3 text-sm font-semibold text-[#0c2444]"
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 8, 10].map((v) => (
                        <option key={v} value={v}>
                          {v.toFixed(1)} µmol H⁺ equivalent
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {definition.subject === "physics" && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="var-angle" className="block text-xs font-bold text-[#133354]">
                      {isTe ? "పతన కోణం (deg · 0–60°)" : "Incident angle (deg · 0–60°)"}
                    </label>
                    <select
                      id="var-angle"
                      disabled={isSubmitted}
                      value={incidentAngle}
                      onChange={(e) => setIncidentAngle(Number(e.target.value))}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f3f9fb] px-3 text-sm font-semibold text-[#0c2444]"
                    >
                      {[0, 15, 30, 45, 60].map((v) => (
                        <option key={v} value={v}>
                          {v}°
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="var-thick" className="block text-xs font-bold text-[#133354]">
                      {isTe ? "గాజు దిమ్మె మందం (mm · 10–30 mm)" : "Slab thickness (mm · 10–30 mm)"}
                    </label>
                    <select
                      id="var-thick"
                      disabled={isSubmitted}
                      value={slabThickness}
                      onChange={(e) => setSlabThickness(Number(e.target.value))}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f3f9fb] px-3 text-sm font-semibold text-[#0c2444]"
                    >
                      {[10, 15, 20, 25, 30].map((v) => (
                        <option key={v} value={v}>
                          {v} mm
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {definition.subject === "biology" && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="var-field" className="block text-xs font-bold text-[#133354]">
                      {isTe ? "స్లైడ్ పరిశీలన ఫీల్డ్ (0–2)" : "Acquired slide field (0–2)"}
                    </label>
                    <select
                      id="var-field"
                      disabled={isSubmitted}
                      value={bioField}
                      onChange={(e) => setBioField(Number(e.target.value))}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f3f9fb] px-3 text-sm font-semibold text-[#0c2444]"
                    >
                      <option value={0}>
                        {isTe ? "ఫీల్డ్ 0 — తక్కువ-శక్తి వీక్షణ" : "Field 0 — Low-power overview"}
                      </option>
                      <option value={1}>
                        {isTe ? "ఫీల్డ్ 1 — బాహ్యచర్మపు అంచు" : "Field 1 — Epidermal sheet margin"}
                      </option>
                      <option value={2}>
                        {isTe ? "ఫీల్డ్ 2 — మధ్య కణ కవచాలు" : "Field 2 — Central polygonal walls"}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="var-plane" className="block text-xs font-bold text-[#133354]">
                      {isTe ? "ఫోకల్ ప్లేన్ సూచిక (0–2)" : "Focal plane index (0–2)"}
                    </label>
                    <select
                      id="var-plane"
                      disabled={isSubmitted}
                      value={bioPlane}
                      onChange={(e) => setBioPlane(Number(e.target.value))}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f3f9fb] px-3 text-sm font-semibold text-[#0c2444]"
                    >
                      <option value={0}>
                        {isTe ? "ప్లేన్ 0 (ఉపరితలం)" : "Plane 0 (Surface)"}
                      </option>
                      <option value={1}>
                        {isTe ? "ప్లేన్ 1 (మధ్య కణ కవచం)" : "Plane 1 (Mid cell wall)"}
                      </option>
                      <option value={2}>
                        {isTe ? "ప్లేన్ 2 (లోతైన ప్లేన్)" : "Plane 2 (Deep plane)"}
                      </option>
                    </select>
                  </div>
                </div>
              )}

              <div className="g1-hint mt-4">
                {isTe
                  ? "పరిమిత శాస్త్రీయ నమూనా. మద్దతు లేని రసాయనాలు, కాలిబ్రేషన్ లేని కొలతలు మరియు చర్య వేగం ఈ నమూనా పరిధిలో లేవు."
                  : "Synthetic validation fixture. Unsupported reagents, calibration-missing claims, and kinetics remain outside this model."}
              </div>

              <button
                type="button"
                disabled={busy || isSubmitted}
                onClick={() => void handleRunExperimentTrial(false)}
                className="g1-btn g1-btn-green mt-4 w-full"
                data-testid="exp-run-calculation-btn"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                <span>{dict.player.runCalculation}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </section>

        {/* CENTER STAGE */}
        <section
          aria-label={isTe ? "ప్రయోగశాల వేదిక" : "Laboratory stage"}
          className="lg:col-span-6"
        >
          <LabStageCanvas
            definition={definition}
            mode={session.mode}
            locale={locale}
            state={state}
            revision={session.revision}
            isOffline={isOffline}
            hasUnsavedIntent={Boolean(pendingAction)}
            disabled={busy || isSubmitted}
            onDispatch={async (args) => {
              await dispatchAction(args);
            }}
          />
        </section>

        {/* RIGHT PANEL: Observation Notebook / Theory-only Evidence */}
        <section
          aria-label={isSim ? dict.player.observationNotebook : dict.player.evidenceComparisons}
          className="g1-card flex flex-col justify-between p-5 lg:col-span-3"
        >
          <div>
            <div
              className={`text-[11px] font-extrabold uppercase tracking-[0.14em] ${
                isSim ? "text-[#057d98]" : "text-[#046c49]"
              }`}
            >
              {isSim ? dict.player.observationNotebook : dict.player.evidenceComparisons}
            </div>
            <h2 className="mt-2 text-lg font-extrabold text-[#0c2444]">
              {isSim ? dict.player.evidence : dict.player.theoryOnlyResults}
            </h2>

            {!isSim && (
              <>
                <div className="mt-3 rounded-2xl border border-[#c3e8d3] bg-[#effbf5] p-4">
                  <div className="text-xs font-semibold text-[#3d5c50]">
                    {primaryTheoryMetric.label}
                  </div>
                  <div
                    className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#046c49]"
                    data-testid="exp-primary-result"
                  >
                    {primaryTheoryMetric.value}
                  </div>
                  <div className="mt-1.5 text-xs text-[#426356]">{primaryTheoryMetric.note}</div>
                </div>

                {/* W09 / G1-23: Confirmed Two-Trial Comparison Table */}
                <div className="mt-4">
                  <h3 className="text-xs font-extrabold text-[#0c2444]">
                    {isTe ? "ట్రయల్ పోలిక పట్టిక" : "Trial comparison"}
                  </h3>
                  <dl className="mt-2 divide-y divide-[#e8f0f4] rounded-xl border border-[#dce8f0] bg-[#f8fcff] px-3 text-xs">
                    <div className="flex items-center justify-between gap-2 py-2.5">
                      <dt className="shrink-0 font-semibold text-[#4b637a]">
                        {isTe ? "నియంత్రణ (Control)" : "Control"}
                      </dt>
                      <dd className="text-right font-bold text-[#0c2444]">
                        {formatTrialSummary(state.controlTrial)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-2.5">
                      <dt className="shrink-0 font-semibold text-[#4b637a]">
                        {isTe ? "పోలిక (Comparison)" : "Comparison"}
                      </dt>
                      <dd className="text-right font-bold text-[#0c2444]">
                        {formatTrialSummary(state.comparisonTrial)}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    disabled={busy || isSubmitted}
                    onClick={() => void handleRunExperimentTrial(true)}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-extrabold text-[#046c49] hover:underline disabled:opacity-50"
                    data-testid="exp-record-comparison-btn"
                  >
                    <span>{dict.player.recordComparison}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {state.controlTrial && !isSubmitted && (
                    <button type="button" disabled={busy} onClick={useControlSettings}
                      className="g1-btn g1-btn-outline mt-2 w-full text-xs">
                      {isTe ? "నియంత్రణ సెట్టింగ్‌లను వాడండి" : "Use control settings"}
                    </button>
                  )}
                  {!!state.trialHistory?.length && <details className="mt-3 rounded-xl border border-[#dce8f0] p-3">
                    <summary className="cursor-pointer text-xs font-bold">
                      {isTe ? "నమోదైన ట్రయల్స్" : "Confirmed trial history"} ({state.trialHistory.length})
                    </summary>
                    <ol className="mt-2 space-y-2 text-xs">
                      {state.trialHistory.map((trial, index) => <li key={trial.revision}>
                        <strong>{isTe ? "ట్రయల్" : "Trial"} {index + 1}</strong> · {formatTrialSummary(trial.values)}
                      </li>)}
                    </ol>
                  </details>}
                </div>
              </>
            )}

            <hr className="my-4 border-[#dfebf2]" />

            {observations.length === 0 ? (
              <div className="g1-hint">{dict.player.noObservationYet}</div>
            ) : (
              <ul
                tabIndex={0}
                aria-label={isTe ? "నిర్ధారించిన సర్వర్ పరిశీలనలు" : "Confirmed server observations"}
                className="max-h-[210px] space-y-2.5 overflow-y-auto rounded-xl text-xs"
                data-testid="observation-list"
              >
                {observations.map((obs) => (
                  <li
                    key={obs.observationId}
                    className="rounded-xl border border-[#dcebf3] bg-[#f8fcff] p-3"
                  >
                    <div className="font-bold text-[#0c2444]">{obs.metric}</div>
                    <div className="mt-0.5 font-semibold text-[#0663ab]">
                      {obs.value === null
                        ? isTe
                          ? "అందుబాటులో లేదు"
                          : "Unavailable"
                        : typeof obs.value === "string"
                          ? obs.value
                          : `${obs.value.value} ${obs.value.unit}`}
                    </div>
                    <div className="mt-1 text-[11px] text-[#4b637a]">{obs.uncertainty.note}</div>
                  </li>
                ))}
              </ul>
            )}

            {/* Claim-Evidence-Reasoning reflection selector */}
            {!isSubmitted && (
              <div className="mt-4">
                <label
                  htmlFor="claim-select"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b637a]"
                >
                  {isTe ? "ముగింపు & పరిమితి నమోదు" : "Claim & limitation note"}
                </label>
                <select
                  id="claim-select"
                  value={claimChoice}
                  onChange={(e) => setClaimChoice(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-[#7894aa] bg-white px-2.5 text-xs text-[#0c2444]"
                >
                  <option value="supported_model_and_limits_verified">
                    {isTe
                      ? "పరిశీలించిన సాక్ష్యం నమూనా పరిధికి సరిపోతుంది; భౌతిక కాలిబ్రేషన్ పరిమితులు గుర్తించబడ్డాయి"
                      : "Observed evidence matches model scope; physical calibration/rate limits noted"}
                  </option>
                  <option value="control_and_comparison_explained">
                    {isTe
                      ? "స్పష్టమైన యూనిట్లతో నియంత్రిత మార్పును బేస్‌లైన్‌తో పోల్చడం జరిగింది"
                      : "Compared controlled change against baseline with explicit units"}
                  </option>
                </select>
              </div>
            )}
          </div>

          <div className="mt-5 space-y-3 border-t border-[#e5edf3] pt-4">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#057d98]">
                {dict.player.safety}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#4b637a]">
                {definition.safetyRules.join(" ")}
              </p>
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#057d98]">
                {isTe ? "తదుపరి దశ ఏమిటి?" : "WHAT HAPPENS NEXT?"}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#4b637a]">
                {isSim
                  ? isTe
                    ? "తదుపరి మార్గదర్శక దశకు వెళ్ళడానికి మీ పరికరాల అమరికను తనిఖీ చేసి, పరిశీలనలను సమర్పించండి."
                    : "Verify your apparatus setup to advance through each guided step, then submit your confirmed observations."
                  : isTe
                    ? "కనీసం ఒక నియంత్రణ మరియు ఒక పోలిక ట్రయల్‌ను నమోదు చేసి, ఆపై మూల్యాంకనం కోసం సమర్పించండి."
                    : "Record your control and comparison trials, select your conclusion, and submit for rubric evaluation."}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Action Bar matching 03_Simulation_Player_Premium.png */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <Link
          href={overviewHref}
          className="g1-btn g1-btn-outline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{dict.player.backToDetail}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {!isSim && (
            <span className="hidden text-xs text-[#4b637a] md:inline">
              {dict.player.provenanceFooter}
            </span>
          )}

          {isSim && !isSubmitted && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGuidedStepAdvance()}
              className="g1-btn g1-btn-blue"
              data-testid="sim-next-step-btn"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              <span>{dict.player.nextCheck}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {!isSubmitted && (
            <button
              type="button"
              disabled={busy || observations.length === 0}
              onClick={() => void handleSubmitAttempt()}
              className={`g1-btn ${isSim ? "g1-btn-teal" : "g1-btn-green"}`}
              data-testid="player-submit-attempt-btn"
            >
              <span>{dict.player.submitPractical}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
