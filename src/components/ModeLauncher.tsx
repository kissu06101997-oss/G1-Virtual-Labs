"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { getDictionary } from "@/lib/i18n";
import type { LabMode, LabSubject, Locale } from "@/lib/types";

export interface ResolvedAssignmentContext {
  assignmentId: string;
  classLabel: string;
  contentVersion: string;
  dueAt: string | null;
  isPastDue: boolean;
  latePolicy: "allow_late_flagged" | "block_new_after_due";
  maxAttempts: number;
  usedAttempts: number;
  activeSessionId: string | null;
  activeSessionMode: LabMode | null;
  rubricByMode: Partial<Record<LabMode, string>>;
  revisionNumber: number;
}

interface ModeLauncherProps {
  experimentId: string;
  labId: LabSubject;
  contentVersion: string;
  manifestSha256: string;
  engineAbi: string;
  publicationStatus: "research_fixture" | "review_pending" | "approved";
  locale: Locale;
  isSignedIn: boolean;
  canLaunch: boolean;
  isTeacherPreview?: boolean;
  assignmentId?: string | null;
  allowedModes?: LabMode[];
  assignmentContext?: ResolvedAssignmentContext | null;
  assignmentAccessDenied?: boolean;
  learningHref?: string;
  journeyLocked?: boolean;
  onlyMode?: LabMode;
  returnHref?: string;
  browseQuery?: string;
}

export function ModeLauncher({
  experimentId,
  labId,
  contentVersion,
  manifestSha256,
  engineAbi,
  publicationStatus,
  locale,
  isSignedIn,
  canLaunch,
  isTeacherPreview = false,
  assignmentId = null,
  allowedModes,
  assignmentContext = null,
  assignmentAccessDenied = false,
  learningHref,
  journeyLocked = false,
  onlyMode,
  returnHref,
  browseQuery,
}: ModeLauncherProps) {
  const router = useRouter();
  const dict = getDictionary(locale);
  const isTe = locale === "te-IN";
  const [launchingMode, setLaunchingMode] = useState<LabMode | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isReviewPending = publicationStatus === "review_pending";
  const isQuotaReached =
    assignmentContext !== null &&
    assignmentContext.usedAttempts >= assignmentContext.maxAttempts;
  const isPastDue = Boolean(assignmentContext?.isPastDue);
  const isLockedByDuePolicy =
    isPastDue && assignmentContext?.latePolicy === "block_new_after_due";

  const simAllowedByAssignment = !allowedModes || allowedModes.includes("simulation");
  const expAllowedByAssignment = !allowedModes || allowedModes.includes("experiment");

  const simEnabled =
    !isReviewPending &&
    !assignmentAccessDenied &&
    !isQuotaReached &&
    !isLockedByDuePolicy &&
    simAllowedByAssignment;

  const expEnabled =
    !isReviewPending &&
    !journeyLocked &&
    !assignmentAccessDenied &&
    !isQuotaReached &&
    !isLockedByDuePolicy &&
    expAllowedByAssignment;

  function getDisabledReason(mode: LabMode, allowedByAssignment: boolean): string | null {
    if (isReviewPending) {
      return isTe
        ? "పాఠ్యప్రణాళిక మరియు శాస్త్రీయ సమీక్ష పూర్తయ్యే వరకు ఈ మోడ్ లాక్ చేయబడింది."
        : "Locked until two-person curriculum and scientific model review is completed.";
    }
    if (assignmentAccessDenied) {
      return isTe
        ? "మీరు ఈ తరగతి అసైన్‌మెంట్‌లో నమోదు కాలేదు లేదా అసైన్‌మెంట్ అందుబాటులో లేదు."
        : "Assignment not available for your current school/class enrollment.";
    }
    if (!allowedByAssignment) {
      return mode === "simulation"
        ? isTe
          ? "ఈ తరగతి అసైన్‌మెంట్‌లో సిమ్యులేషన్ మోడ్ అనుమతించబడలేదు (ఎక్స్‌పెరిమెంట్ మోడ్ మాత్రమే)."
          : "Not enabled in this class assignment (Experiment Mode only)."
        : isTe
          ? "ఈ తరగతి అసైన్‌మెంట్‌లో ఎక్స్‌పెరిమెంట్ మోడ్ అనుమతించబడలేదు (సిమ్యులేషన్ మోడ్ మాత్రమే)."
          : "Not enabled in this class assignment (Simulation Mode only).";
    }
    if (isQuotaReached && assignmentContext) {
      return isTe
        ? `అనుమతించబడిన గరిష్ట ప్రయత్నాలు పూర్తయ్యాయి (${assignmentContext.usedAttempts} / ${assignmentContext.maxAttempts}).`
        : `Maximum allowed attempts reached (${assignmentContext.usedAttempts} / ${assignmentContext.maxAttempts}).`;
    }
    if (isLockedByDuePolicy) {
      return isTe
        ? "గడువు సమయం (IST) ముగిసింది — తరగతి నిబంధన ప్రకారం కొత్త ప్రయత్నాలు నిలిపివేయబడ్డాయి."
        : "Past due time (Asia/Kolkata) — new attempts are locked by class late policy.";
    }
    if (mode === "experiment" && journeyLocked) {
      return isTe ? "ఎక్స్‌పెరిమెంట్ మోడ్ తెరవడానికి సిమ్యులేషన్ మోడ్ పూర్తి చేయండి."
        : "Complete Simulation Mode to unlock.";
    }
    return null;
  }

  const simDisabledReason = getDisabledReason("simulation", simAllowedByAssignment);
  const expDisabledReason = getDisabledReason("experiment", expAllowedByAssignment);

  async function handleLaunch(mode: LabMode) {
    setErrorMsg(null);
    if (isReviewPending || assignmentAccessDenied) return;
    if (mode === "experiment" && !expEnabled) return;
    if (mode === "simulation" && !simEnabled) return;
    if (mode === "simulation" && learningHref && (!isSignedIn || canLaunch)) {
      router.push(learningHref);
      return;
    }

    if (!isSignedIn) {
      const nextUrl = returnHref ?? (assignmentId
        ? `/experiments/${experimentId}?assignmentId=${assignmentId}`
        : `/experiments/${experimentId}`);
      router.push(`/sign-in?next=${encodeURIComponent(nextUrl)}`);
      return;
    }

    if (!canLaunch) {
      setErrorMsg(
        isTe
          ? "ప్రయోగాన్ని ప్రారంభించడానికి విద్యార్థి లేదా ఉపాధ్యాయ ఖాతా అవసరం."
          : "Sign in with a student or teacher account to launch a laboratory session."
      );
      return;
    }

    setLaunchingMode(mode);
    try {
      const launchRes = await apiFetch<{
        launchToken?: string;
        detail?: string;
      }>("/api/v1/launch", {
        method: "POST",
        body: {
          assignmentId: isTeacherPreview ? null : assignmentId || null,
          experimentId,
          labId,
          mode,
          contentVersion,
          manifestSha256,
          locale,
          engineAbi,
        },
      });

      if (!launchRes.ok || !launchRes.data.launchToken) {
        setErrorMsg(
          launchRes.data.detail ||
            (isTe
              ? "ప్రయోగశాల ప్రారంభాన్ని ధృవీకరించడం సాధ్యం కాలేదు."
              : "Unable to authorize laboratory launch.")
        );
        setLaunchingMode(null);
        return;
      }

      const redeemRes = await apiFetch<{
        sessionId?: string;
        detail?: string;
      }>("/api/v1/launch/redeem", {
        method: "POST",
        body: {
          launchToken: launchRes.data.launchToken,
        },
      });

      if (!redeemRes.ok || !redeemRes.data.sessionId) {
        setErrorMsg(
          redeemRes.data.detail ||
            (isTe
              ? "లాంచ్ టోకెన్‌ను ధృవీకరించడం సాధ్యం కాలేదు."
              : "Unable to redeem launch grant.")
        );
        setLaunchingMode(null);
        return;
      }

      router.push(`/player/${redeemRes.data.sessionId}` + (browseQuery ? "?" + browseQuery : ""));
    } catch {
      setErrorMsg(
        isTe
          ? "ప్రయోగశాలను తెరిచేటప్పుడు నెట్‌వర్క్ లోపం ఏర్పడింది."
          : "Network error while opening laboratory session."
      );
      setLaunchingMode(null);
    }
  }

  return (
    <section aria-labelledby="choose-mode-heading" className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="choose-mode-heading"
          className="text-xl font-extrabold tracking-tight text-[#0c2444]"
        >
          {onlyMode === "experiment" ? (isTe ? "ట్రయల్ నియంత్రణలు" : "Trial controls")
            : onlyMode === "simulation" ? (isTe ? "మార్గదర్శక ప్రయోగం" : "Guided practical") : dict.detail.chooseModeHeading}
        </h2>

        {isTeacherPreview && (
          <div
            data-testid="teacher-preview-badge"
            className="inline-flex items-center gap-2 rounded-xl border border-[#b8dce8] bg-[#eef9fc] px-3.5 py-1.5 text-xs font-extrabold text-[#00635f]"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span>
              {isTe
                ? "ఉపాధ్యాయ ప్రివ్యూ మోడ్ (గ్రేడింగ్ చేయబడదు · విద్యార్థి అసైన్‌మెంట్ కాదు)"
                : "Teacher Preview Mode (Ungraded · Separated from student assignments)"}
            </span>
          </div>
        )}
      </div>

      {/* Resolved Assignment Scope Banner (W01 + W02) */}
      {assignmentContext && (
        <div
          data-testid="resolved-assignment-banner"
          className="mt-3 rounded-2xl border border-[#b9d9eb] bg-[#f2f9fd] p-4 text-xs text-[#133354]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 font-extrabold text-[#0c2444]">
              <CheckCircle2 className="h-4 w-4 text-[#007875]" aria-hidden="true" />
              <span>
                {isTe
                  ? `తరగతి అసైన్‌మెంట్: ${assignmentContext.classLabel}`
                  : `Assigned practical for ${assignmentContext.classLabel}`}
              </span>
              <span className="g1-tag">
                {isTe ? `పిన్ చేసిన వెర్షన్ v${assignmentContext.contentVersion}` : `Pinned v${assignmentContext.contentVersion}`}
              </span>
              {assignmentContext.revisionNumber > 1 && (
                <span className="g1-tag g1-tag-blue">
                  {isTe ? `సవరణ #${assignmentContext.revisionNumber}` : `Amendment rev #${assignmentContext.revisionNumber}`}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 font-semibold text-[#38546c]">
              <span>
                {isTe
                  ? `ప్రయత్నాలు: ${assignmentContext.usedAttempts} / ${assignmentContext.maxAttempts}`
                  : `Submitted attempts: ${assignmentContext.usedAttempts} / ${assignmentContext.maxAttempts}`}
              </span>
              {assignmentContext.dueAt && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {isTe ? "గడువు (IST): " : "Due (IST): "}
                    {new Date(assignmentContext.dueAt).toLocaleString(locale, {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#38546c]">
            <span>
              {isPastDue
                ? assignmentContext.latePolicy === "block_new_after_due"
                  ? isTe
                    ? "ఆలస్య విధానం: గడువు తర్వాత కొత్త ప్రయత్నాలు లాక్ చేయబడ్డాయి."
                    : "Overdue policy: New attempts are locked after the due time."
                  : isTe
                    ? "ఆలస్య విధానం: గడువు తర్వాత ప్రయత్నాలు అనుమతించబడతాయి మరియు 'ఆలస్యం'గా గుర్తించబడతాయి."
                    : "Overdue policy: Past-due attempts are permitted and flagged as late for teacher review."
                : isTe
                  ? `అనుమతించబడిన మోడ్‌లు: ${allowedModes?.map((m) => (m === "simulation" ? "సిమ్యులేషన్" : "ఎక్స్‌పెరిమెంట్")).join(", ")}`
                  : `Authorized modes: ${allowedModes?.map((m) => (m === "simulation" ? "Simulation Mode" : "Experiment Mode")).join(", ")}`}
            </span>

            {assignmentContext.activeSessionId && (
              <Link
                href={`/player/${assignmentContext.activeSessionId}`}
                className="font-extrabold text-[#007875] underline"
                data-testid="resume-assigned-session-link"
              >
                {isTe ? "సేవ్ చేసిన సెషన్‌ను కొనసాగించండి →" : "Resume saved assignment session →"}
              </Link>
            )}
          </div>
        </div>
      )}

      {assignmentAccessDenied && (
        <div
          role="alert"
          data-testid="assignment-access-denied-banner"
          className="mt-3 flex items-center gap-2.5 rounded-2xl border border-[#fecdca] bg-[#fef3f2] px-4 py-3 text-sm font-semibold text-[#9b2119]"
        >
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {isTe
              ? "ఈ అసైన్‌మెంట్ మీ పాఠశాల/తరగతి నమోదు పరిధిలో లేదు. మీరు సాధారణ అభ్యాస మోడ్ కోసం అసైన్‌మెంట్ ID లేకుండా ప్రయోగాన్ని తెరవవచ్చు."
              : "This assignment does not belong to your enrolled class scope. Open the practical from the catalogue to launch personal practice."}
          </span>
        </div>
      )}

      {isReviewPending && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2.5 rounded-2xl border border-[#f5d5a3] bg-[#fff8ec] px-4 py-3 text-sm font-semibold text-[#7a4400]"
        >
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{dict.detail.reviewLocked}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="mt-3 rounded-2xl border border-[#fecdca] bg-[#fef3f2] px-4 py-3 text-sm font-semibold text-[#b42318]"
        >
          {errorMsg}
        </div>
      )}

      <div className={`mt-4 grid grid-cols-1 gap-5 ${onlyMode ? "" : "md:grid-cols-2"}`}>
        {/* Simulation Mode = BLUE */}
        {onlyMode !== "experiment" && <div className={`g1-mode-blue flex items-start gap-4 p-6 ${!simEnabled ? "opacity-80" : ""}`}>
          <Image className="g1-mode-illustration" src="/assets/homepage/simulation.webp" alt="" width={96} height={96} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-extrabold text-[#0663ab]">{dict.detail.simTitle}</h3>
              <span className="g1-tag g1-tag-blue">
                {isTe ? "మార్గదర్శక అభ్యాసం · Blue" : "Guided Practical · Blue"}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[#2d4d67]">
              {dict.detail.simDesc}
            </p>
            {assignmentContext?.rubricByMode.simulation && (
              <p className="mt-1.5 font-mono text-[11px] font-semibold text-[#38546c]">
                {isTe ? "రూబ్రిక్: " : "Rubric: "}
                {assignmentContext.rubricByMode.simulation}
              </p>
            )}
            <button
              type="button"
              onClick={() => handleLaunch("simulation")}
              disabled={!simEnabled || launchingMode !== null}
              className="g1-btn g1-btn-blue mt-4 min-h-[44px] px-5 text-sm"
              data-testid="launch-simulation-btn"
            >
              {launchingMode === "simulation" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span>
                {isTeacherPreview
                  ? isTe
                    ? "సిమ్యులేషన్ మోడ్ ప్రివ్యూ"
                    : "Preview Simulation Mode"
                  : dict.detail.simCta}
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {simDisabledReason && (
              <p
                data-testid="mode-disabled-reason-simulation"
                className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-[#7a4400]"
              >
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{simDisabledReason}</span>
              </p>
            )}
          </div>
        </div>}

        {/* Experiment Mode = GREEN */}
        {onlyMode !== "simulation" && <div className={`g1-mode-green flex items-start gap-4 p-6 ${!expEnabled ? "opacity-80" : ""}`}>
          <Image className="g1-mode-illustration" src="/assets/homepage/experiment.webp" alt="" width={96} height={96} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-extrabold text-[#046c49]">{dict.detail.expTitle}</h3>
              <span className="g1-tag g1-tag-green">
                {isTe ? "శాస్త్రీయ పరిశోధన · Green" : "Bounded Inquiry · Green"}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[#2a4f44]">
              {dict.detail.expDesc}
            </p>
            {assignmentContext?.rubricByMode.experiment && (
              <p className="mt-1.5 font-mono text-[11px] font-semibold text-[#38546c]">
                {isTe ? "రూబ్రిక్: " : "Rubric: "}
                {assignmentContext.rubricByMode.experiment}
              </p>
            )}
            <button
              type="button"
              onClick={() => handleLaunch("experiment")}
              disabled={!expEnabled || launchingMode !== null}
              className="g1-btn g1-btn-green mt-4 min-h-[44px] px-5 text-sm"
              data-testid="launch-experiment-btn"
            >
              {launchingMode === "experiment" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span>
                {isTeacherPreview
                  ? isTe
                    ? "ఎక్స్‌పెరిమెంట్ మోడ్ ప్రివ్యూ"
                    : "Preview Experiment Mode"
                  : dict.detail.expCta}
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {expDisabledReason && (
              <p
                data-testid="mode-disabled-reason-experiment"
                className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-[#7a4400]"
              >
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{expDisabledReason}</span>
              </p>
            )}
          </div>
        </div>}
      </div>
    </section>
  );
}
