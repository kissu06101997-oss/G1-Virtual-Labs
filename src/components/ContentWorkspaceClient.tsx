"use client";

import { TableScroll } from "@/components/TableScroll";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FilePlus2, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import type { ApCorpusSummary } from "@/lib/catalog";
import { formatStageLabel } from "@/lib/education-stages";
import { getExperimentCopy } from "@/lib/i18n";
import type { Locale, PrincipalRole } from "@/lib/types";

interface ContentWorkspaceProps {
  role: PrincipalRole;
  principalId: string;
  locale?: Locale;
  apCorpusSummary: ApCorpusSummary;
  versions: Array<{
    experimentId: string;
    contentVersion: string;
    subject: string;
    grade: number;
    manifestSha256: string;
    publicationStatus: string;
    title: string;
    curriculumRefs: string;
    modelIds: string;
    linkedAttempts: number;
    publishedAt: string | null;
    retiredAt: string | null;
  }>;
  reviews: Array<{
    reviewId: string;
    experimentId: string;
    contentVersion: string;
    editorPrincipalId: string;
    editorName: string;
    reviewerName: string | null;
    status: string;
    checklist: Record<string, boolean>;
    notes: string | null;
    submittedAt: string;
    reviewedAt: string | null;
  }>;
}

export function ContentWorkspaceClient({
  role,
  principalId,
  locale = "en-IN",
  apCorpusSummary,
  versions,
  reviews,
}: ContentWorkspaceProps) {
  const router = useRouter();
  const isTe = locale === "te-IN";

  const [experimentId, setExperimentId] = useState("AP-CHEM-10-2.3");
  const [newVersion, setNewVersion] = useState("0.2.0-candidate");
  const [notes, setNotes] = useState(
    "Proposed edition and bilingual glossary update for independent reviewer sign-off."
  );
  const [editionVerified, setEditionVerified] = useState(true);
  const [bilingualChecked, setBilingualChecked] = useState(true);
  const [safetyReviewed, setSafetyReviewed] = useState(true);
  const [modelBounded, setModelBounded] = useState(true);
  const [rightsCleared, setRightsCleared] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleProposeDraft(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const base = versions.find((v) => v.experimentId === experimentId);
      const res = await apiFetch<{ reviewId?: string; detail?: string }>("/api/content/versions", {
        method: "POST",
        body: {
          experimentId,
          baseVersion: base?.contentVersion ?? "0.1.0-research",
          newContentVersion: newVersion.trim(),
          notes: notes.trim(),
          checklist: {
            editionVerified,
            bilingualChecked,
            safetyReviewed,
            modelBounded,
            rightsCleared,
          },
        },
      });
      if (!res.ok) {
        setError(
          res.data.detail ||
            (isTe ? "డ్రాఫ్ట్ వెర్షన్‌ను సమర్పించడం సాధ్యం కాలేదు." : "Unable to submit draft version.")
        );
      } else {
        setMessage(
          isTe
            ? `డ్రాఫ్ట్ ${experimentId}@${newVersion} స్వతంత్ర సమీక్షకుడి ఆమోదం కోసం సమర్పించబడింది.`
            : `Draft ${experimentId}@${newVersion} submitted for independent reviewer sign-off.`
        );
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDecision(
    reviewId: string,
    decision: "approved" | "rework" | "revoked"
  ) {
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ status?: string; detail?: string }>(
        `/api/content/versions/${reviewId}/decision`,
        {
          method: "POST",
          body: {
            decision,
            notes: `Independent reviewer marked as ${decision} during local Gate W workflow verification.`,
          },
        }
      );
      if (!res.ok) {
        setError(
          res.data.detail ||
            (isTe ? "సమీక్ష నిర్ణయాన్ని నమోదు చేయడం సాధ్యం కాలేదు." : "Unable to record review decision.")
        );
      } else {
        setMessage(
          isTe
            ? `సమీక్ష నిర్ణయం '${decision}' భద్రపరచబడింది మరియు ఆడిట్ లాగ్‌లో నమోదు చేయబడింది.`
            : `Review decision '${decision}' persisted and audited.`
        );
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="g1-card g1-student-welcome">
        <div className="g1-eyebrow">
          {isTe
            ? "పాఠ్యప్రణాళిక & శాస్త్రీయ పాలన (AT-07)"
            : "Curriculum & Science Governance (AT-07)"}
        </div>
        <h1 className="mt-2.5 text-3xl font-extrabold text-[#0c2444]">
          {isTe
            ? "కంటెంట్ ఎడిటోరియల్ & ఇద్దరు వ్యక్తుల ప్రచురణ సమీక్ష"
            : "Content Editorial & Two-Person Publication Review"}
        </h1>
        <p className="mt-1.5 text-sm text-[#4b637a]">
          {isTe ? (
            <>
              <strong>{role}</strong> గా సైన్ ఇన్ చేశారు. సమర్పించిన ఎడిటర్ మరియు ఆమోదించే సమీక్షకుడు
              వేర్వేరు వ్యక్తులుగా ఉండాలని PostgreSQL నిర్ధారిస్తుంది. వెర్షన్ ఉపసంహరణ జరిగినప్పుడు
              పాత విద్యార్థి ప్రయత్నాలు రీప్లే చేయడానికి సురక్షితంగా ఉంటాయి.
            </>
          ) : (
            <>
              Signed in as <strong>{role}</strong>. PostgreSQL enforces that the approving reviewer
              must be a distinct principal from the submitting editor, and rollbacks preserve
              replayability of existing sessions.
            </>
          )}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#fecdca] bg-[#fef3f2] px-4 py-3 text-sm font-semibold text-[#b42318]"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="rounded-xl border border-[#b4e6cf] bg-[#eafbf2] px-4 py-3 text-sm font-semibold text-[#046c49]"
        >
          {message}
        </div>
      )}

      {/* Normalized AP candidate corpus summary */}
      <section className="g1-card p-6">
        <h2 className="text-lg font-extrabold text-[#0c2444]">
          {isTe
            ? "ఆంధ్రప్రదేశ్ పరిశోధన అభ్యర్థుల సంగ్రహం (అంతర్గత రిఫరెన్స్ మాత్రమే)"
            : "Andhra Pradesh Candidate Research Corpus (Internal Reference Only)"}
        </h2>
        <p className="mt-1 text-xs text-[#4b637a]">
          {isTe
            ? "13 అధికారిక సంపుటాల నుండి సేకరించిన 340 పరిశోధన అభ్యర్థులు. ఇద్దరు వ్యక్తుల స్వతంత్ర ఆమోదం పూర్తయ్యే వరకు ఇవి విద్యార్థులకు ప్రచురించబడవు."
            : "Unapproved research candidates from 13 official volumes. Literal \"null\" CSV fields are normalized to typed nulls; candidates never appear as deployable student content until independent two-person sign-off."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="rounded-xl bg-[#f4fafe] p-3.5">
            <div className="text-xs font-bold text-[#4b637a]">
              {isTe ? "మొత్తం అభ్యర్థులు" : "Total candidates"}
            </div>
            <div className="mt-1 text-2xl font-extrabold text-[#0c2444]">
              {apCorpusSummary.totalCandidates}
            </div>
          </div>
          <div className="rounded-xl bg-[#eaf7ff] p-3.5">
            <div className="text-xs font-bold text-[#0663ab]">
              {isTe ? "రసాయన శాస్త్రం" : "Chemistry"}
            </div>
            <div className="mt-1 text-2xl font-extrabold text-[#0663ab]">
              {apCorpusSummary.bySubject.chemistry}
            </div>
          </div>
          <div className="rounded-xl bg-[#eaf7ff] p-3.5">
            <div className="text-xs font-bold text-[#0663ab]">
              {isTe ? "భౌతిక శాస్త్రం" : "Physics"}
            </div>
            <div className="mt-1 text-2xl font-extrabold text-[#0663ab]">
              {apCorpusSummary.bySubject.physics}
            </div>
          </div>
          <div className="rounded-xl bg-[#eafbf2] p-3.5">
            <div className="text-xs font-bold text-[#046c49]">
              {isTe ? "జీవ శాస్త్రం" : "Biology"}
            </div>
            <div className="mt-1 text-2xl font-extrabold text-[#046c49]">
              {apCorpusSummary.bySubject.biology}
            </div>
          </div>
          <div className="rounded-xl bg-[#f4fafe] p-3.5">
            <div className="text-xs font-bold text-[#4b637a]">
              {isTe ? "ప్రస్తుత vs పాత ఎడిషన్" : "Current vs Prior"}
            </div>
            <div className="mt-1 text-lg font-extrabold text-[#0c2444]">
              {apCorpusSummary.currentEditionCount} / {apCorpusSummary.priorEditionCount}
            </div>
          </div>
        </div>
      </section>

      {role === "content_editor" && (
        <form onSubmit={handleProposeDraft} className="g1-card space-y-4 p-6">
          <div className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-[#007875]" aria-hidden="true" />
            <h2 className="text-lg font-extrabold text-[#0c2444]">
              {isTe
                ? "సమీక్ష కోసం కొత్త డ్రాఫ్ట్ వెర్షన్‌ను సమర్పించండి"
                : "Submit new draft version for review"}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="draft-exp" className="block text-xs font-bold text-[#133354]">
                {isTe ? "ప్రయోగం" : "Experiment"}
              </label>
              <select
                id="draft-exp"
                value={experimentId}
                onChange={(e) => setExperimentId(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3 text-sm"
              >
                <option value="AP-CHEM-10-2.3">
                  AP-CHEM-10-2.3 — {getExperimentCopy("AP-CHEM-10-2.3", locale).shortTitle}
                </option>
                <option value="AP-PHYS-10-9.10">
                  AP-PHYS-10-9.10 — {getExperimentCopy("AP-PHYS-10-9.10", locale).shortTitle}
                </option>
                <option value="AP-BIO-09-5.1">
                  AP-BIO-09-5.1 — {getExperimentCopy("AP-BIO-09-5.1", locale).shortTitle}
                </option>
                <option value="AP-CHEM-10-2.1">
                  AP-CHEM-10-2.1 — {getExperimentCopy("AP-CHEM-10-2.1", locale).shortTitle}
                </option>
              </select>
            </div>
            <div>
              <label htmlFor="draft-ver" className="block text-xs font-bold text-[#133354]">
                {isTe ? "కొత్త మార్పులేని వెర్షన్ ట్యాగ్" : "New immutable version tag"}
              </label>
              <input
                id="draft-ver"
                type="text"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                required
                className="mt-1 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3 font-mono text-sm"
              />
            </div>
          </div>

          <fieldset className="rounded-xl border border-[#d6e6f0] bg-[#f8fcff] p-3.5">
            <legend className="px-1 text-xs font-bold text-[#133354]">
              {isTe
                ? "ఎడిటోరియల్ & హక్కుల ధృవీకరణ చెక్‌లిస్ట్ (W06)"
                : "Editorial, Rights & Scientific Scope Checklist (W06)"}
            </legend>
            <div className="mt-1.5 grid grid-cols-1 gap-2 text-xs font-semibold text-[#133354] sm:grid-cols-3 lg:grid-cols-5">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editionVerified}
                  onChange={(e) => setEditionVerified(e.target.checked)}
                />
                <span>{isTe ? "2026–27 ఎడిషన్ తనిఖీ" : "Edition source verified"}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bilingualChecked}
                  onChange={(e) => setBilingualChecked(e.target.checked)}
                />
                <span>{isTe ? "ఇంగ్లీష్/తెలుగు పదజాలం" : "EN/TE bilingual glossary"}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={safetyReviewed}
                  onChange={(e) => setSafetyReviewed(e.target.checked)}
                />
                <span>{isTe ? "భద్రతా నియమాలు" : "Safety rules verified"}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={modelBounded}
                  onChange={(e) => setModelBounded(e.target.checked)}
                />
                <span>{isTe ? "శాస్త్రీయ నమూనా పరిమితులు" : "Bounded model domain"}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rightsCleared}
                  onChange={(e) => setRightsCleared(e.target.checked)}
                />
                <span>{isTe ? "చిత్ర/మీడియా హక్కులు" : "Asset rights cleared"}</span>
              </label>
            </div>
          </fieldset>

          <div>
            <label htmlFor="draft-notes" className="block text-xs font-bold text-[#133354]">
              {isTe
                ? "సవరణ సారాంశం & పాఠ్యపుస్తక ఎడిషన్ రిఫరెన్స్"
                : "Editorial change summary & edition citation"}
            </label>
            <input
              id="draft-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              className="mt-1 h-11 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="g1-btn g1-btn-teal"
            data-testid="submit-draft-btn"
          >
            {isTe ? "సమీక్షకుల క్యూకు డ్రాఫ్ట్ సమర్పించండి" : "Submit draft to reviewer queue"}
          </button>
        </form>
      )}

      {/* Editorial Review Queue */}
      <section className="g1-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#e8f0f5] px-6 py-4">
          <ShieldCheck className="h-5 w-5 text-[#046c49]" aria-hidden="true" />
          <h2 className="text-lg font-extrabold text-[#0c2444]">
            {isTe ? "ఇద్దరు వ్యక్తుల సమీక్ష క్యూ & నిర్ణయ చరిత్ర" : "Two-person review queue & decision timeline"}
          </h2>
        </div>
        <div className="divide-y divide-[#e8f0f5]">
          {reviews.map((rev) => {
            const isSelfSubmission = rev.editorPrincipalId === principalId;
            return (
              <div
                key={rev.reviewId}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="font-mono text-sm text-[#0c2444]">
                      {rev.experimentId}@{rev.contentVersion}
                    </strong>
                    <span
                      className={`g1-tag ${
                        rev.status === "approved"
                          ? "g1-tag-green"
                          : rev.status === "revoked"
                            ? "g1-tag-warn"
                            : "g1-tag-blue"
                      }`}
                    >
                      {rev.status}
                    </span>
                    {role === "content_reviewer" && rev.experimentId.startsWith("creator-") && (
                      <Link className="g1-text-link" href={"/content/review/" + rev.reviewId}>Review learning content</Link>
                    )}
                  </div>
                  <p className="text-xs text-[#4b637a]">
                    {isTe ? "ఎడిటర్: " : "Editor: "}
                    <strong>{rev.editorName}</strong>
                    {" · "}
                    {isTe ? "సమర్పణ: " : "Submitted: "}
                    {new Date(rev.submittedAt).toLocaleString(locale, {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {rev.reviewerName
                      ? ` · ${isTe ? "సమీక్షకుడు: " : "Reviewer: "}${rev.reviewerName}${
                          rev.reviewedAt
                            ? ` (${new Date(rev.reviewedAt).toLocaleString(locale, {
                                timeZone: "Asia/Kolkata",
                                dateStyle: "medium",
                                timeStyle: "short",
                              })})`
                            : ""
                        }`
                      : ` · ${isTe ? "స్వతంత్ర సమీక్షకుడి కోసం వేచి ఉంది" : "Awaiting independent reviewer"}`}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {Object.entries(rev.checklist).map(([k, val]) => (
                      <span
                        key={k}
                        className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                          val
                            ? "bg-[#e8f7ef] text-[#046c49]"
                            : "bg-[#fff4d7] text-[#805100]"
                        }`}
                      >
                        {val ? "✓" : "!"} {k}
                      </span>
                    ))}
                  </div>
                  {rev.notes && <p className="text-xs text-[#133354]">{rev.notes}</p>}
                </div>

                {role === "content_reviewer" && !isSelfSubmission ? (
                  <div className="flex flex-wrap gap-2">
                    {rev.status !== "approved" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDecision(rev.reviewId, "approved")}
                        className="g1-btn g1-btn-green min-h-[38px] px-3.5 text-xs"
                        data-testid={`approve-review-${rev.reviewId}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isTe ? "ఆమోదించు & ప్రచురించు" : "Approve & publish"}</span>
                      </button>
                    )}
                    {rev.status !== "revoked" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDecision(rev.reviewId, "revoked")}
                        className="g1-btn g1-btn-outline min-h-[38px] px-3.5 text-xs"
                        data-testid={`revoke-review-${rev.reviewId}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isTe ? "ఉపసంహరించు / రిటైర్" : "Rollback / Retire"}</span>
                      </button>
                    )}
                  </div>
                ) : isSelfSubmission ? (
                  <span className="inline-flex items-center gap-1 rounded-xl border border-[#dce8f0] bg-[#f8fcff] px-3 py-1.5 text-xs font-semibold text-[#5a7288]">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {isTe
                        ? "స్వీయ-ఆమోదం నిరోధించబడింది (స్వతంత్ర సమీక్షకుడు అవసరం)"
                        : "Self-approval blocked (requires independent reviewer)"}
                    </span>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Published manifests table with provenance & linked attempt replay counts */}
      <section className="g1-card overflow-hidden">
        <div className="border-b border-[#e8f0f5] px-6 py-4">
          <h2 className="text-lg font-extrabold text-[#0c2444]">
            {isTe
              ? "మార్పులేని వెర్షన్ మేనిఫెస్ట్‌లు & పాఠ్యపుస్తక మూలాలు"
              : "Immutable version manifests, edition provenance & replay counts"}
          </h2>
        </div>
        <TableScroll label={isTe ? "ప్రయోగ వెర్షన్‌లు" : "Experiment versions"} telugu={isTe}>
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f2f8fc] font-bold uppercase tracking-wider text-[#4b637a]">
                <th className="px-6 py-3">{isTe ? "ప్రయోగం & తరగతి" : "Experiment & Stage"}</th>
                <th className="px-4 py-3">{isTe ? "వెర్షన్" : "Version"}</th>
                <th className="px-4 py-3">{isTe ? "పాఠ్యపుస్తక మూలం & మోడల్" : "Source Edition & Model"}</th>
                <th className="px-4 py-3">{isTe ? "స్థితి" : "Status"}</th>
                <th className="px-4 py-3">{isTe ? "లింక్ అయిన ప్రయత్నాలు" : "Linked Attempts"}</th>
                <th className="px-6 py-3">{isTe ? "మేనిఫెస్ట్ SHA-256" : "Manifest SHA-256"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8f0f5]">
              {versions.map((v) => (
                <tr key={`${v.experimentId}-${v.contentVersion}`}>
                  <td className="px-6 py-3">
                    <div className="font-bold text-[#0c2444]">{v.experimentId}</div>
                    <div className="text-[11px] text-[#4b637a]">
                      {getExperimentCopy(v.experimentId, locale).shortTitle} ·{" "}
                      {formatStageLabel(v.grade, locale)}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-[#133354]">
                    {v.contentVersion}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[#38546c]">
                    <div>{v.curriculumRefs || "AP SCERT 2026–27 pending"}</div>
                    <div className="font-mono text-[10px] text-[#5a7288]">{v.modelIds}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`g1-tag ${
                        v.retiredAt
                          ? "g1-tag-warn"
                          : v.publicationStatus === "review_pending"
                            ? "g1-tag-warn"
                            : "g1-tag-green"
                      }`}
                    >
                      {v.retiredAt
                        ? isTe
                          ? "రిటైర్ చేయబడింది (రీప్లే భద్రం)"
                          : "retired (replay preserved)"
                        : v.publicationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-[#0c2444]">
                    {v.linkedAttempts}
                  </td>
                  <td className="px-6 py-3 font-mono text-[11px] text-[#4b637a]">
                    {v.manifestSha256.slice(0, 24)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </section>
    </div>
  );
}
