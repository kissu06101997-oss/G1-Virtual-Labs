"use client";

import { TableScroll } from "@/components/TableScroll";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Edit3, Loader2, PlusCircle, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { formatStageLabel } from "@/lib/education-stages";
import { getExperimentCopy } from "@/lib/i18n";
import type { CatalogItem, LabMode, Locale } from "@/lib/types";

export interface ExistingAssignmentRow {
  assignmentId: string;
  classId: string;
  classLabel: string;
  experimentId: string;
  contentVersion: string;
  rubricId: string;
  dueAt: string | null;
  latePolicy: "allow_late_flagged" | "block_new_after_due";
  maxAttempts: number;
  revisionNumber: number;
  supersedesAssignmentId: string | null;
  supersededAt: string | null;
  revisionNotes: string | null;
  modes: string[];
}

interface AssignmentBuilderProps {
  classes: Array<{ classId: string; label: string; grade: number }>;
  experiments: CatalogItem[];
  existingAssignments?: ExistingAssignmentRow[];
  locale?: Locale;
}

export function AssignmentBuilder({
  classes,
  experiments,
  existingAssignments = [],
  locale = "en-IN",
}: AssignmentBuilderProps) {
  const router = useRouter();
  const isTe = locale === "te-IN";
  const publishable = experiments.filter((e) => e.publicationStatus !== "review_pending");

  const [classId, setClassId] = useState(classes[0]?.classId ?? "");
  const [experimentId, setExperimentId] = useState(publishable[0]?.experimentId ?? "");
  const [allowSim, setAllowSim] = useState(true);
  const [allowExp, setAllowExp] = useState(true);
  const [dueDate, setDueDate] = useState("2026-12-28");
  const [dueTime, setDueTime] = useState("17:00");
  const [latePolicy, setLatePolicy] = useState<"allow_late_flagged" | "block_new_after_due">(
    "allow_late_flagged"
  );
  const [attemptLimit, setAttemptLimit] = useState(3);
  const [amendingAssignment, setAmendingAssignment] = useState<ExistingAssignmentRow | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedExp = publishable.find((e) => e.experimentId === experimentId) ?? publishable[0];

  const simRubric = selectedExp?.modeConfigurations.simulation.rubricId ?? "rubric-sim@1";
  const expRubric = selectedExp?.modeConfigurations.experiment.rubricId ?? "rubric-exp@1";

  function startAmend(row: ExistingAssignmentRow) {
    setAmendingAssignment(row);
    setClassId(row.classId);
    setExperimentId(row.experimentId);
    setAllowSim(row.modes.includes("simulation"));
    setAllowExp(row.modes.includes("experiment"));
    if (row.dueAt) {
      const isoDate = new Date(row.dueAt).toLocaleDateString("sv-SE", {
        timeZone: "Asia/Kolkata",
      });
      setDueDate(isoDate);
    }
    setLatePolicy(row.latePolicy || "allow_late_flagged");
    setAttemptLimit(row.maxAttempts);
    setRevisionNotes(
      isTe
        ? "గడువు తేదీ మరియు అనుమతించబడిన మోడ్‌ల సవరణ (మునుపటి విద్యార్థి ప్రయత్నాలు భద్రపరచబడ్డాయి)."
        : "Updated schedule/mode settings while preserving earlier student attempts."
    );
    setError(null);
    setSuccessMsg(null);
  }

  function cancelAmend() {
    setAmendingAssignment(null);
    setRevisionNotes("");
    setError(null);
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!classId || !selectedExp) {
      setError(
        isTe
          ? "తరగతిని మరియు ఆమోదించబడిన ప్రయోగాన్ని ఎంచుకోండి."
          : "Select a class and an approved/pilot experiment."
      );
      return;
    }

    const modes: LabMode[] = [];
    if (allowSim) modes.push("simulation");
    if (allowExp) modes.push("experiment");
    if (modes.length === 0) {
      setError(
        isTe
          ? "కనీసం ఒక అభ్యాస మోడ్‌ను ఎంచుకోండి (సిమ్యులేషన్ మోడ్ లేదా ఎక్స్‌పెరిమెంట్ మోడ్)."
          : "Enable at least one learning mode (Simulation Mode or Experiment Mode)."
      );
      return;
    }

    const primaryRubricId = allowExp && !allowSim ? expRubric : simRubric;
    const rubricByMode: { simulation?: string; experiment?: string } = {};
    if (allowSim) rubricByMode.simulation = simRubric;
    if (allowExp) rubricByMode.experiment = expRubric;

    setBusy(true);
    try {
      const res = await apiFetch<{
        assignmentId?: string;
        status?: string;
        revisionNumber?: number;
        detail?: string;
      }>(`/api/v1/teacher/classes/${classId}/assignments`, {
        method: "POST",
        body: {
          experimentId: selectedExp.experimentId,
          contentVersion: selectedExp.contentVersion,
          rubricId: primaryRubricId,
          rubricByMode,
          modes,
          dueAt: `${dueDate}T${dueTime || "17:00"}:00+05:30`,
          latePolicy,
          attemptLimit,
          localeBundleVersion: "locale-en-te@1.0.0",
          ...(amendingAssignment
            ? {
                supersedesAssignmentId: amendingAssignment.assignmentId,
                revisionNotes: revisionNotes.trim() || "Teacher amendment",
              }
            : {}),
        },
      });

      if (!res.ok) {
        setError(
          res.data.detail ||
            (isTe ? "అసైన్‌మెంట్‌ను ప్రచురించడం సాధ్యం కాలేదు." : "Unable to publish assignment.")
        );
        setBusy(false);
        return;
      }

      const revNum = res.data.revisionNumber ?? 1;
      setSuccessMsg(
        isTe
          ? `${selectedExp.experimentId} (v${selectedExp.contentVersion}, సవరణ #${revNum}) ప్రచురించబడింది — అసైన్‌మెంట్ ID ${res.data.assignmentId}.`
          : `Published ${selectedExp.experimentId} (v${selectedExp.contentVersion}, rev #${revNum}, rubric ${primaryRubricId}) — Assignment ID ${res.data.assignmentId}.`
      );
      setAmendingAssignment(null);
      setRevisionNotes("");
      router.refresh();
    } catch {
      setError(
        isTe
          ? "నెట్‌వర్క్ లోపం కారణంగా అసైన్‌మెంట్ ప్రచురించబడలేదు."
          : "Network error while publishing assignment."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handlePublish} className="g1-card space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#0c2444]">
              {amendingAssignment
                ? isTe
                  ? `అసైన్‌మెంట్ సవరణ (సవరణ #${amendingAssignment.revisionNumber + 1})`
                  : `Amend published assignment (Revision #${amendingAssignment.revisionNumber + 1})`
                : isTe
                  ? "వెర్షన్-పిన్ చేసిన తరగతి అసైన్‌మెంట్‌ను ప్రచురించండి"
                  : "Publish versioned class assignment"}
            </h2>
            <p className="mt-1 text-xs text-[#4b637a]">
              {isTe
                ? "PostgreSQL లో ఖచ్చితమైన ప్రయోగ వెర్షన్, మోడ్-వారీ రూబ్రిక్ ID, అనుమతించబడిన మోడ్‌లు, ప్రయత్న పరిమితి మరియు IST గడువు విధానాన్ని పిన్ చేస్తుంది."
                : "Pins exact experiment version, per-mode rubric IDs, allowed modes, attempt quota, and IST overdue policy in PostgreSQL."}
            </p>
          </div>
          {amendingAssignment && (
            <button
              type="button"
              onClick={cancelAmend}
              className="g1-btn g1-btn-outline min-h-[38px] px-3 text-xs"
              data-testid="cancel-amend-btn"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isTe ? "సవరణ రద్దు" : "Cancel amendment"}</span>
            </button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-[#fecdca] bg-[#fef3f2] px-4 py-3 text-sm font-semibold text-[#b42318]"
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            data-testid="assignment-published-banner"
            className="flex items-center gap-2 rounded-xl border border-[#b4e6cf] bg-[#eafbf2] px-4 py-3 text-sm font-semibold text-[#046c49]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="assign-class" className="block text-xs font-bold text-[#133354]">
              {isTe ? "అధికారిక తరగతి" : "Authorized class"}
            </label>
            <select
              id="assign-class"
              value={classId}
              disabled={Boolean(amendingAssignment)}
              onChange={(e) => setClassId(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3.5 text-sm font-semibold text-[#0c2444]"
            >
              {classes.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.label} ({formatStageLabel(c.grade, locale)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="assign-experiment" className="block text-xs font-bold text-[#133354]">
              {isTe ? "అర్హత కలిగిన ప్రయోగం & పిన్ చేసిన వెర్షన్" : "Qualified experiment & pinned version"}
            </label>
            <select
              id="assign-experiment"
              value={experimentId}
              onChange={(e) => setExperimentId(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3.5 text-sm font-semibold text-[#0c2444]"
            >
              {publishable.map((exp) => {
                const copy = getExperimentCopy(exp.experimentId, locale);
                return (
                  <option key={exp.experimentId} value={exp.experimentId}>
                    {exp.experimentId} — {copy.shortTitle} (v{exp.contentVersion})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <fieldset className="rounded-2xl border border-[#cbdce8] bg-[#f8fcff] p-4">
          <legend className="px-1 text-xs font-bold text-[#133354]">
            {isTe ? "అనుమతించబడిన అభ్యాస మోడ్‌లు & మోడ్-వారీ రూబ్రిక్" : "Allowed learning modes & per-mode rubrics"}
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#c6e2f7] bg-[#eaf5ff] p-3 text-sm font-bold text-[#0663ab]">
              <input
                type="checkbox"
                checked={allowSim}
                onChange={(e) => setAllowSim(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#0663ab]"
                data-testid="assign-mode-simulation"
              />
              <div>
                <span>
                  {isTe
                    ? "సిమ్యులేషన్ మోడ్ (Blue · మార్గదర్శక అభ్యాసం)"
                    : "Simulation Mode (Blue · Guided practical)"}
                </span>
                <span className="mt-0.5 block font-mono text-[11px] font-semibold text-[#38546c]">
                  {isTe ? "రూబ్రిక్: " : "Rubric: "}
                  {simRubric}
                </span>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#c4e8d4] bg-[#e8f7ef] p-3 text-sm font-bold text-[#046c49]">
              <input
                type="checkbox"
                checked={allowExp}
                onChange={(e) => setAllowExp(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#046c49]"
                data-testid="assign-mode-experiment"
              />
              <div>
                <span>
                  {isTe
                    ? "ఎక్స్‌పెరిమెంట్ మోడ్ (Green · శాస్త్రీయ పరిశోధన)"
                    : "Experiment Mode (Green · Bounded inquiry)"}
                </span>
                <span className="mt-0.5 block font-mono text-[11px] font-semibold text-[#38546c]">
                  {isTe ? "రూబ్రిక్: " : "Rubric: "}
                  {expRubric}
                </span>
              </div>
            </label>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="assign-due" className="block text-xs font-bold text-[#133354]">
              {isTe ? "గడువు తేదీ (IST · Asia/Kolkata)" : "Due date (IST · Asia/Kolkata)"}
            </label>
            <input
              id="assign-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3.5 text-sm text-[#0c2444]"
            />
          </div>
          <div>
            <label htmlFor="assign-due-time" className="block text-xs font-bold text-[#133354]">
              {isTe ? "గడువు సమయం (IST +05:30)" : "Due time (IST +05:30)"}
            </label>
            <input
              id="assign-due-time"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              required
              className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3.5 text-sm text-[#0c2444]"
            />
          </div>
          <div>
            <label htmlFor="assign-late-policy" className="block text-xs font-bold text-[#133354]">
              {isTe ? "గడువు ముగిసిన తర్వాత విధానం" : "Overdue / late policy"}
            </label>
            <select
              id="assign-late-policy"
              value={latePolicy}
              onChange={(e) =>
                setLatePolicy(e.target.value as "allow_late_flagged" | "block_new_after_due")
              }
              data-testid="assign-late-policy"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3 text-xs font-semibold text-[#0c2444]"
            >
              <option value="allow_late_flagged">
                {isTe
                  ? "అనుమతించి 'ఆలస్యం'గా గుర్తించు"
                  : "Allow past-due (flag as late)"}
              </option>
              <option value="block_new_after_due">
                {isTe
                  ? "గడువు తర్వాత కొత్త ప్రయత్నాలు లాక్ చేయి"
                  : "Lock new attempts after due time"}
              </option>
            </select>
          </div>
          <div>
            <label htmlFor="assign-attempts" className="block text-xs font-bold text-[#133354]">
              {isTe ? "ప్రయత్న పరిమితి (1–20)" : "Attempt limit (1–20)"}
            </label>
            <input
              id="assign-attempts"
              type="number"
              min={1}
              max={20}
              value={attemptLimit}
              onChange={(e) => setAttemptLimit(Number(e.target.value))}
              className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3.5 text-sm text-[#0c2444]"
            />
          </div>
        </div>

        {amendingAssignment && (
          <div>
            <label htmlFor="assign-revision-notes" className="block text-xs font-bold text-[#133354]">
              {isTe
                ? "సవరణ కారణం (మునుపటి విద్యార్థి ప్రయత్నాలు భద్రపరచబడతాయి)"
                : "Amendment note (prior student attempts remain pinned & replayable)"}
            </label>
            <input
              id="assign-revision-notes"
              type="text"
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              required
              data-testid="assign-revision-notes"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3.5 text-sm text-[#0c2444]"
            />
          </div>
        )}

        {/* Publish Preview Summary (W02) */}
        {selectedExp && (
          <div
            data-testid="assignment-publish-preview"
            className="rounded-2xl border border-[#cbe0ec] bg-[#f3f9fd] p-4 text-xs text-[#133354]"
          >
            <div className="font-extrabold text-[#0c2444]">
              {isTe ? "ప్రచురణ ముందస్తు సమీక్ష (Publish Preview)" : "Publish Preview — Pinned Contract Summary"}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="font-semibold text-[#4b637a]">
                  {isTe ? "ప్రయోగం & వెర్షన్: " : "Experiment & version: "}
                </span>
                <strong className="font-mono">
                  {selectedExp.experimentId}@v{selectedExp.contentVersion}
                </strong>
              </div>
              <div>
                <span className="font-semibold text-[#4b637a]">
                  {isTe ? "మోడ్‌లు: " : "Modes: "}
                </span>
                <strong>
                  {[
                    allowSim ? (isTe ? "సిమ్యులేషన్" : "Simulation") : null,
                    allowExp ? (isTe ? "ఎక్స్‌పెరిమెంట్" : "Experiment") : null,
                  ]
                    .filter(Boolean)
                    .join(" + ") || (isTe ? "ఏదీ లేదు" : "None")}
                </strong>
              </div>
              <div>
                <span className="font-semibold text-[#4b637a]">
                  {isTe ? "గడువు (IST): " : "Due (IST): "}
                </span>
                <strong className="font-mono">
                  {dueDate} {dueTime} +05:30
                </strong>
              </div>
              <div>
                <span className="font-semibold text-[#4b637a]">
                  {isTe ? "భాషా బండిల్: " : "Locale bundle: "}
                </span>
                <strong className="font-mono">locale-en-te@1.0.0</strong>
              </div>
            </div>
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={busy}
            className="g1-btn g1-btn-teal"
            data-testid="publish-assignment-submit"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {amendingAssignment
                ? isTe
                  ? `సవరణ #${amendingAssignment.revisionNumber + 1} ప్రచురించండి`
                  : `Publish amended revision #${amendingAssignment.revisionNumber + 1}`
                : isTe
                  ? "తరగతికి అసైన్‌మెంట్‌ను ప్రచురించండి"
                  : "Publish assignment to class"}
            </span>
          </button>
        </div>
      </form>

      {/* Published Class Assignments Table with Immutable Revision Lineage */}
      {existingAssignments.length > 0 && (
        <section className="g1-card overflow-hidden">
          <div className="border-b border-[#e8f0f5] px-6 py-4">
            <h2 className="text-lg font-extrabold text-[#0c2444]">
              {isTe ? "ప్రచురించబడిన తరగతి అసైన్‌మెంట్‌లు & సవరణ చరిత్ర" : "Published class assignments & revision history"}
            </h2>
          </div>
          <TableScroll label={isTe ? "అసైన్‌మెంట్ చరిత్ర" : "Assignment history"} telugu={isTe}>
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#f2f8fc] text-[11px] font-bold uppercase tracking-wider text-[#4b637a]">
                  <th className="px-6 py-3">{isTe ? "తరగతి" : "Class"}</th>
                  <th className="px-4 py-3">{isTe ? "ప్రయోగం & వెర్షన్" : "Experiment & Version"}</th>
                  <th className="px-4 py-3">{isTe ? "రూబ్రిక్ & సవరణ" : "Rubric & Revision"}</th>
                  <th className="px-4 py-3">{isTe ? "మోడ్‌లు" : "Modes"}</th>
                  <th className="px-4 py-3">{isTe ? "ప్రయత్నాలు" : "Attempts"}</th>
                  <th className="px-4 py-3">{isTe ? "గడువు (IST)" : "Due (IST)"}</th>
                  <th className="px-6 py-3">{isTe ? "చర్య" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8f0f5]">
                {existingAssignments.map((row) => {
                  const isSuperseded = Boolean(row.supersededAt);
                  return (
                    <tr key={row.assignmentId} className={isSuperseded ? "bg-[#f9fbfd] opacity-75" : ""}>
                      <td className="px-6 py-3.5 font-semibold text-[#0c2444]">{row.classLabel}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#0c2444]">
                          {getExperimentCopy(row.experimentId, locale).shortTitle}
                        </div>
                        <div className="font-mono text-xs text-[#4b637a]">
                          {row.experimentId} · v{row.contentVersion}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-xs text-[#133354]">{row.rubricId}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="g1-tag">
                            {isTe ? `సవరణ #${row.revisionNumber}` : `Rev #${row.revisionNumber}`}
                          </span>
                          {isSuperseded && (
                            <span className="g1-tag g1-tag-warn">
                              {isTe ? "సవరించబడింది (పాత ప్రయత్నాలు భద్రం)" : "Superseded · prior attempts preserved"}
                            </span>
                          )}
                        </div>
                        {row.revisionNotes && (
                          <div className="mt-1 text-[11px] text-[#4b637a]">{row.revisionNotes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {row.modes.map((m) => (
                            <span
                              key={m}
                              className={`g1-tag ${m === "experiment" ? "g1-tag-green" : "g1-tag-blue"}`}
                            >
                              {m === "experiment"
                                ? isTe
                                  ? "ఎక్స్‌పెరిమెంట్"
                                  : "Experiment"
                                : isTe
                                  ? "సిమ్యులేషన్"
                                  : "Simulation"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[#133354]">{row.maxAttempts}</td>
                      <td className="px-4 py-3.5 text-xs text-[#4b637a]">
                        {row.dueAt
                          ? new Date(row.dueAt).toLocaleString(locale, {
                              timeZone: "Asia/Kolkata",
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                        <div className="text-[11px] text-[#5a7288]">
                          {row.latePolicy === "block_new_after_due"
                            ? isTe
                              ? "గడువు తర్వాత లాక్"
                              : "Locked after due"
                            : isTe
                              ? "ఆలస్యం అనుమతి"
                              : "Late flagged"}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        {!isSuperseded ? (
                          <button
                            type="button"
                            onClick={() => startAmend(row)}
                            data-testid={`amend-assignment-${row.assignmentId}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#7894aa] bg-white px-2.5 py-1.5 text-xs font-extrabold text-[#007875] hover:bg-[#eef8fc]"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{isTe ? "సవరించు" : "Amend"}</span>
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-[#5a7288]">
                            {isTe ? "చరిత్ర రికార్డు" : "Historical record"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </section>
      )}
    </div>
  );
}
