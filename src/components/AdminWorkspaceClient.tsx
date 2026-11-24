"use client";

import { TableScroll } from "@/components/TableScroll";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Lock, Server, Shield, Users } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { formatStageLabel } from "@/lib/education-stages";
import type { Locale } from "@/lib/types";

export interface SchoolAdminData {
  scope: "school";
  schoolName: string | null;
  generatedAt: string;
  roster: Array<{
    principalId: string;
    email: string;
    displayName: string;
    role: string;
    enabled: boolean;
    grade: number | null;
  }>;
  devices: Array<{
    deviceId: string;
    label: string;
    ramGb: number;
    gpuClass: string;
    webgl2Supported: boolean;
    networkProfileMbps: number;
  }>;
  auditEvents: Array<{
    eventId: string;
    actionType: string;
    occurredAt: string;
    retentionClass: string;
  }>;
}

export interface AggregateAdminData {
  scope: "district" | "state";
  districtName: string | null;
  generatedAt: string;
  suppressionThreshold: number;
  note: string;
  schools: Array<{
    schoolCode: string;
    schoolName: string;
    districtName: string;
    activeLearners: { value: number | null; suppressed: boolean; display: string };
    assignmentsPublished: number;
    submittedAssessments: { value: number | null; suppressed: boolean; display: string };
  }>;
}

export function AdminWorkspaceClient({
  data,
  currentPrincipalId,
  locale = "en-IN",
}: {
  data: SchoolAdminData | AggregateAdminData;
  currentPrincipalId: string;
  locale?: Locale;
}) {
  const router = useRouter();
  const isTe = locale === "te-IN";
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function toggleEnabled(principalId: string, nextEnabled: boolean) {
    setBusyId(principalId);
    setNotice(null);
    try {
      const res = await apiFetch<{ updated?: boolean; detail?: string }>("/api/admin/overview", {
        method: "POST",
        body: { principalId, enabled: nextEnabled },
      });
      if (!res.ok) {
        setNotice(
          res.data.detail ||
            (isTe ? "ఖాతా స్థితిని అప్‌డేట్ చేయడం సాధ్యం కాలేదు." : "Unable to update account status.")
        );
      } else {
        setNotice(
          isTe
            ? "ఖాతా స్థితి అప్‌డేట్ చేయబడింది మరియు మార్పులేని audit_event లో నమోదు చేయబడింది."
            : "Account status updated and recorded in audit_event."
        );
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  const formattedGeneratedAt = new Date(data.generatedAt).toLocaleString(locale, {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (data.scope === "school") {
    return (
      <div className="space-y-6">
        <div className="g1-card g1-student-welcome flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="g1-eyebrow">
              {isTe ? "పాఠశాల నిర్వహణ" : "School Administration"}
            </div>
            <h1 className="mt-2.5 text-3xl font-extrabold text-[#0c2444]">
              {data.schoolName || (isTe ? "పాఠశాల నిర్వహణ" : "School Administration")}
            </h1>
            <p className="mt-1 text-sm text-[#4b637a]">
              {isTe
                ? "పాఠశాల-పరిమిత రోస్టర్ నియంత్రణలు, తరగతి గది పరికరాల సంసిద్ధత మరియు మార్పులేని భద్రతా ఆడిట్ లాగ్."
                : "School-scoped roster controls, classroom device readiness inventory, and immutable security audit log."}
            </p>
          </div>
          <span className="g1-tag font-mono text-[11px]">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {isTe ? `సమయం: ${formattedGeneratedAt} IST` : `Snapshot: ${formattedGeneratedAt} IST`}
            </span>
          </span>
        </div>

        {notice && (
          <div
            role="status"
            className="rounded-xl border border-[#b4e6cf] bg-[#eafbf2] px-4 py-3 text-sm font-semibold text-[#046c49]"
          >
            {notice}
          </div>
        )}

        <section className="g1-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[#e8f0f5] px-6 py-4">
            <Users className="h-5 w-5 text-[#007875]" aria-hidden="true" />
            <h2 className="text-lg font-extrabold text-[#0c2444]">
              {isTe ? "పాఠశాల రోస్టర్ & పాత్ర అనుమతులు" : "School roster & role grants"}
            </h2>
          </div>
          <TableScroll label={isTe ? "పాఠశాల ఖాతాలు" : "School accounts"} telugu={isTe}>
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#f2f8fc] text-[11px] font-bold uppercase tracking-wider text-[#4b637a]">
                  <th className="px-6 py-3">{isTe ? "ఖాతా (సింథటిక్)" : "Account (Synthetic)"}</th>
                  <th className="px-4 py-3">{isTe ? "పాత్ర & తరగతి" : "Role & Stage"}</th>
                  <th className="px-4 py-3">{isTe ? "స్థితి" : "Status"}</th>
                  <th className="px-6 py-3">{isTe ? "చర్య" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8f0f5]">
                {data.roster.map((r) => (
                  <tr key={r.principalId}>
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-[#0c2444]">{r.displayName}</div>
                      <div className="font-mono text-xs text-[#4b637a]">{r.email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="g1-tag">{r.role}</span>
                        {r.grade && (
                          <span className="g1-tag g1-tag-blue">
                            {formatStageLabel(r.grade, locale, true)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`g1-tag ${r.enabled ? "g1-tag-green" : "g1-tag-warn"}`}>
                        {r.enabled
                          ? isTe
                            ? "సక్రియం"
                            : "Active"
                          : isTe
                            ? "నిలిపివేయబడింది"
                            : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {r.principalId === currentPrincipalId ? (
                        <span className="text-xs text-[#4b637a]">
                          {isTe ? "ప్రస్తుత నిర్వాహకుడు" : "Current admin"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === r.principalId}
                          onClick={() => toggleEnabled(r.principalId, !r.enabled)}
                          className="rounded-lg border border-[#7894aa] bg-white px-3 py-1.5 text-xs font-bold text-[#0c2444] hover:bg-[#f2f8fc]"
                        >
                          {r.enabled
                            ? isTe
                              ? "నిలిపివేయి"
                              : "Disable"
                            : isTe
                              ? "తిరిగి ప్రారంభించు"
                              : "Re-enable"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="g1-card p-6">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-[#0663ab]" aria-hidden="true" />
              <h2 className="text-lg font-extrabold text-[#0c2444]">
                {isTe ? "పరికరాల సంసిద్ధత వివరాలు" : "Device readiness metadata"}
              </h2>
            </div>
            <ul className="mt-4 space-y-3">
              {data.devices.map((d) => (
                <li
                  key={d.deviceId}
                  className="rounded-xl border border-[#ddebf3] bg-[#f8fcff] p-3.5 text-xs"
                >
                  <div className="font-bold text-[#0c2444]">{d.label}</div>
                  <div className="mt-1 text-[#4b637a]">
                    {d.ramGb} GB RAM · {d.gpuClass} · {d.networkProfileMbps} Mbps · WebGL2{" "}
                    {d.webgl2Supported ? (isTe ? "అవును" : "Yes") : isTe ? "కాదు" : "No"}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="g1-card p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#046c49]" aria-hidden="true" />
              <h2 className="text-lg font-extrabold text-[#0c2444]">
                {isTe ? "ఇటీవలి పాఠశాల ఆడిట్ సంఘటనలు" : "Recent school audit events"}
              </h2>
            </div>
            <ul className="mt-4 divide-y divide-[#e8f0f5] text-xs">
              {data.auditEvents.map((ev) => (
                <li key={ev.eventId} className="flex items-center justify-between gap-2 py-2.5">
                  <div>
                    <span className="font-mono font-bold text-[#0c2444]">{ev.actionType}</span>
                    <span className="ml-2 rounded bg-[#eef6fb] px-1.5 py-0.5 font-mono text-[10px] text-[#4b637a]">
                      {ev.retentionClass}
                    </span>
                  </div>
                  <span className="text-[#4b637a]">
                    {new Date(ev.occurredAt).toLocaleString(locale, {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="g1-card g1-student-welcome flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="g1-eyebrow">
            {data.scope === "district"
              ? isTe
                ? "జిల్లా నిర్వహణ"
                : "District Administration"
              : isTe
                ? "రాష్ట్ర ప్రోగ్రామ్ సమీక్ష"
                : "State Programme Review"}
          </div>
          <h1 className="mt-2.5 text-3xl font-extrabold text-[#0c2444]">
            {data.scope === "district"
              ? isTe
                ? `${data.districtName || "జిల్లా"} — సమీకరించిన పాఠశాల గణాంకాలు`
                : `${data.districtName || "District"} — Aggregated School Roll-Up`
              : isTe
                ? "ఆంధ్రప్రదేశ్ — రాష్ట్ర సమీకరించిన గణాంకాలు"
                : "Andhra Pradesh — State Aggregate Roll-Up"}
          </h1>
          <p className="mt-1.5 text-sm text-[#4b637a]">{data.note}</p>
        </div>
        <span
          className="g1-tag font-mono text-[11px]"
          data-testid="admin-aggregate-freshness"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {isTe
              ? `డేటా తాజాదనం: ${formattedGeneratedAt} IST (PostgreSQL)`
              : `Data freshness: ${formattedGeneratedAt} IST (PostgreSQL)`}
          </span>
        </span>
      </div>

      <div className="g1-hint flex items-center gap-2.5">
        <Lock className="h-4 w-4 shrink-0 text-[#007875]" aria-hidden="true" />
        <span>
          {isTe ? (
            <>
              <strong>
                చిన్న-సెల్ గోప్యత నిరోధన సక్రియం (పరిమితి &lt; {data.suppressionThreshold}):
              </strong>{" "}
              {data.suppressionThreshold} కంటే తక్కువ మంది విద్యార్థులు లేదా సమర్పణలు ఉన్న సమూహాలు
              స్వయంచాలకంగా దాచబడతాయి. వ్యక్తిగత విద్యార్థి రికార్డులు జిల్లా లేదా రాష్ట్ర పాత్రలకు
              ఎప్పుడూ అందించబడవు.
            </>
          ) : (
            <>
              <strong>
                Small-cell privacy suppression active (threshold &lt; {data.suppressionThreshold}):
              </strong>{" "}
              Cohorts below {data.suppressionThreshold} learners or submissions are automatically
              masked. Individual student records are never returned to district or state roles.
            </>
          )}
        </span>
      </div>

      <section className="g1-card overflow-hidden">
        <TableScroll label={isTe ? "పాఠశాల వారీగా గణాంకాలు" : "School summary statistics"} telugu={isTe}>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#f2f8fc] text-[11px] font-bold uppercase tracking-wider text-[#4b637a]">
                <th className="px-6 py-3">{isTe ? "పాఠశాల కోడ్" : "School Code"}</th>
                <th className="px-4 py-3">{isTe ? "పాఠశాల" : "School"}</th>
                <th className="px-4 py-3">{isTe ? "జిల్లా" : "District"}</th>
                <th className="px-4 py-3">{isTe ? "సక్రియ విద్యార్థులు" : "Active Learners"}</th>
                <th className="px-4 py-3">{isTe ? "అసైన్‌మెంట్లు" : "Assignments"}</th>
                <th className="px-6 py-3">{isTe ? "సమర్పించిన మూల్యాంకనాలు" : "Submitted Assessments"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8f0f5]">
              {data.schools.map((s) => (
                <tr key={s.schoolCode}>
                  <td className="px-6 py-4 font-mono text-xs font-bold text-[#0c2444]">
                    {s.schoolCode}
                  </td>
                  <td className="px-4 py-4 font-bold text-[#0c2444]">{s.schoolName}</td>
                  <td className="px-4 py-4 text-[#4b637a]">{s.districtName}</td>
                  <td className="px-4 py-4">
                    <span
                      className={
                        s.activeLearners.suppressed
                          ? "g1-tag g1-tag-warn"
                          : "font-bold text-[#0c2444]"
                      }
                    >
                      {s.activeLearners.display}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-[#133354]">
                    {s.assignmentsPublished}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={
                        s.submittedAssessments.suppressed
                          ? "g1-tag g1-tag-warn"
                          : "font-bold text-[#046c49]"
                      }
                    >
                      {s.submittedAssessments.display}
                    </span>
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
