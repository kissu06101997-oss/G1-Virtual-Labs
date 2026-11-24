"use client";

import { GlassBack } from "@/components/GlassBack";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Atom,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FlaskConical,
  HelpCircle,
  Home,
  Leaf,
  XCircle,
} from "lucide-react";
import { formatStageLabel } from "@/lib/education-stages";
import { getDictionary, getExperimentCopy } from "@/lib/i18n";
import type { LabSubject, Locale } from "@/lib/types";

export interface StudentDashboardData {
  activeSessions: Array<{
    sessionId: string;
    attemptId: string;
    assignmentId: string | null;
    experimentId: string;
    contentVersion: string;
    mode: "simulation" | "experiment";
    revision: number;
    stepIndex: number;
    totalSteps: number;
    savedAt: string;
    subject: LabSubject;
    title: string;
    grade: number;
  }>;
  assignments: Array<{
    assignmentId: string;
    classId: string;
    classLabel: string;
    experimentId: string;
    contentVersion: string;
    rubricId: string;
    dueAt: string | null;
    isPastDue: boolean;
    latePolicy: string;
    maxAttempts: number;
    revisionNumber: number;
    subject: LabSubject;
    title: string;
    grade: number;
    modes: string[];
    activeSessionId: string | null;
    submittedAttempts: number;
    status: "not_started" | "in_progress" | "submitted";
  }>;
  results: Array<{
    assessmentId: string;
    attemptId: string;
    assignmentId: string | null;
    isLate: boolean;
    sessionId: string;
    revision: number;
    experimentId: string;
    contentVersion: string;
    mode: "simulation" | "experiment";
    subject: LabSubject;
    rubricId: string;
    gradeState: string;
    criteriaPassed: number;
    criteriaTotal: number;
    criteria: Array<{ id: string; label: string; passed: boolean }>;
    evidenceCount: number;
    observations: Array<{
      observationId: string;
      revision: number;
      payload: Record<string, unknown>;
    }>;
    summary: string;
    submittedAt: string;
  }>;
  progressBySubject: Record<LabSubject, number>;
}

interface StudentDashboardClientProps {
  data: StudentDashboardData;
  locale: Locale;
  displayName: string;
  schoolName: string | null;
  journey: ReactNode;
}

export function StudentDashboardClient({
  data,
  locale,
  displayName,
  schoolName,
  journey,
}: StudentDashboardClientProps) {
  const dict = getDictionary(locale);
  const isTe = locale === "te-IN";
  const resume = data.activeSessions[0] ?? null;

  const subjectIcon = (subject: LabSubject) =>
    subject === "chemistry" ? (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e4f4ff] text-[#0663ab]"
        aria-hidden="true"
      >
        <FlaskConical className="h-5 w-5" />
      </div>
    ) : subject === "physics" ? (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e4f4ff] text-[#0663ab]"
        aria-hidden="true"
      >
        <Atom className="h-5 w-5" />
      </div>
    ) : (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e0f8ee] text-[#046c49]"
        aria-hidden="true"
      >
        <Leaf className="h-5 w-5" />
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col lg:flex-row">
      <aside
        aria-label={dict.student.sidebarHeading}
        className="g1-dashboard-sidebar px-4 py-5 lg:w-[220px] lg:shrink-0"
      >
        <div className="px-2 pb-4">
          <div className="g1-eyebrow">
            {dict.student.workspaceEyebrow}
          </div>
          <div className="g1-dashboard-scope mt-3 p-3.5">
            <div className="text-xs font-semibold text-[#38546c]">
              {isTe ? "ప్రస్తుత పాఠశాల పరిధి" : "Current scope"}
            </div>
            <div className="mt-0.5 text-sm font-extrabold">
              {schoolName || (isTe ? "G1 పాఠశాల" : "G1 Partner School")}
            </div>
            <div className="mt-0.5 text-xs text-[#38546c]">{displayName}</div>
          </div>
        </div>
        <nav aria-label="Student sections" className="flex flex-wrap gap-1.5 lg:flex-col">
          <a
            href="#top"
            className="g1-dashboard-nav-active"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            <span>{dict.nav.dashboard}</span>
          </a>
          <a
            href="#assignments"
            className="g1-dashboard-nav-link"
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            <span>{dict.nav.assignments}</span>
          </a>
          <a
            href="#progress"
            className="g1-dashboard-nav-link"
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>{dict.student.progressHeading}</span>
          </a>
          <a
            href="#results"
            className="g1-dashboard-nav-link"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            <span>{dict.nav.results}</span>
          </a>
          <Link
            href="/help"
            className="g1-dashboard-nav-link"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            <span>{dict.nav.help}</span>
          </Link>
        </nav>
      </aside>

      {/* Main student content */}
      <main id="main-content" data-workspace="student" className="g1-premium min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10">
        <GlassBack href="/" label={locale === "te-IN" ? "ముఖపుటకు తిరిగి" : "Back to home"} />
        <div className="g1-card g1-student-welcome g1-workspace-banner flex flex-wrap items-start justify-between gap-4">
          <div>
            <div id="top" className="g1-eyebrow">
              {dict.student.workspaceEyebrow}
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0c2444] sm:text-[38px]">
              {isTe ? "స్వాగతం, " : "Welcome, "}{displayName}
            </h1>
            <p className="mt-1.5 text-sm text-[#4b637a]">
              {dict.student.welcomeSub}
            </p>
          </div>

          <Link href="/laboratories" className="g1-btn g1-btn-outline min-h-[42px] px-4 text-xs">
            <span>{dict.home.exploreLabsCta}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Existing summary cards calculated from the student's real records */}
        <div className="g1-workspace-stats mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="g1-card p-5">
            <div className="text-xs font-bold text-[#4b637a]">
              {isTe ? "కేటాయించిన పనులు" : "Assigned tasks"}
            </div>
            <div className="mt-2 font-mono text-3xl font-extrabold text-[#0c2444]">
              {String(data.assignments.length).padStart(2, "0")}
            </div>
            <div className="mt-1 text-xs text-[#5a7288]">
              {isTe ? "తరగతి అసైన్‌మెంట్‌లు" : "Class-scoped assignments"}
            </div>
          </div>
          <div className="g1-card p-5">
            <div className="text-xs font-bold text-[#4b637a]">
              {isTe ? "కొనసాగుతున్నవి" : "In progress"}
            </div>
            <div className="mt-2 font-mono text-3xl font-extrabold text-[#0c2444]">
              {String(data.activeSessions.length).padStart(2, "0")}
            </div>
            <div className="mt-1 text-xs text-[#5a7288]">
              {isTe ? "నిర్ధారించిన పురోగతి మాత్రమే" : "Confirmed checkpoint state"}
            </div>
          </div>
          <div className="g1-card p-5">
            <div className="text-xs font-bold text-[#4b637a]">
              {isTe ? "సమర్పించినవి" : "Submitted"}
            </div>
            <div className="mt-2 font-mono text-3xl font-extrabold text-[#0c2444]">
              {String(data.results.length).padStart(2, "0")}
            </div>
            <div className="mt-1 text-xs text-[#5a7288]">
              {isTe ? "రూబ్రిక్ మూల్యాంకనం పూర్తయింది" : "Server-evaluated submissions"}
            </div>
          </div>
        </div>

        {/* Dominant Continue Your Laboratory Card matching 05_Student_Dashboard.png */}
        {resume ? (
          <section
            aria-label={isTe ? "ప్రయోగాన్ని కొనసాగించండి" : "Continue your laboratory"}
            className="g1-card g1-resume-panel mt-6 p-6" data-subject={resume.subject}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-[#0c2444]">
                {isTe ? "మీ ప్రయోగశాలను కొనసాగించండి" : "Continue your laboratory"}
              </h2>
              <span className="g1-tag g1-tag-green">
                ✓ {dict.player.savedAtRevision} {resume.revision}
              </span>
            </div>

            <div
              className="mt-4 flex flex-col gap-5 rounded-2xl border border-[#d8eaf2] p-4 md:flex-row md:items-center"
              style={{ background: "linear-gradient(108deg, #edfafd 0%, #ffffff 72%)" }}
            >
              <div className="h-[152px] w-full shrink-0 overflow-hidden rounded-xl bg-[#e3f4fa] md:w-[220px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getExperimentCopy(resume.experimentId, locale).thumbPath}
                  alt={getExperimentCopy(resume.experimentId, locale).title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`g1-tag ${resume.mode === "experiment" ? "g1-tag-green" : "g1-tag-blue"}`}
                  >
                    {resume.mode === "experiment"
                      ? dict.student.continueTagExp
                      : dict.student.continueTagSim}
                  </span>
                  <span className="g1-tag">
                    {resume.assignmentId
                      ? isTe
                        ? "తరగతి అసైన్‌మెంట్"
                        : "Class Assignment"
                      : isTe
                        ? "వ్యక్తిగత అభ్యాసం"
                        : "Personal Practice"}
                  </span>
                  <span className="g1-tag">v{resume.contentVersion}</span>
                </div>
                <h3 className="mt-2.5 text-2xl font-extrabold tracking-tight text-[#0c2444]">
                  {getExperimentCopy(resume.experimentId, locale).activityLabel} —{" "}
                  {getExperimentCopy(resume.experimentId, locale).shortTitle}
                </h3>
                <p className="mt-1 text-sm text-[#4b637a]">
                  {isTe
                    ? `దశ ${Math.min(resume.totalSteps, resume.stepIndex + 1)} / ${resume.totalSteps} · మీ నిర్ధారించిన పరిశీలనలు భద్రపరచబడ్డాయి`
                    : `Step ${Math.min(resume.totalSteps, resume.stepIndex + 1)} of ${resume.totalSteps} · Your confirmed observations are preserved`}
                </p>
                <div className="g1-progress mt-3.5 max-w-[440px]">
                  <span
                    className={`g1-progress-bar ${resume.mode === "experiment" ? "g1-progress-bar-green" : ""}`}
                    style={{
                      width: `${Math.min(100, Math.max(20, Math.round(((resume.stepIndex + 1) / Math.max(1, resume.totalSteps)) * 100)))}%`,
                    }}
                  />
                </div>
                <div className="mt-4">
                  <Link
                    href={`/player/${resume.sessionId}`}
                    className={`g1-btn ${resume.mode === "experiment" ? "g1-btn-green" : "g1-btn-teal"}`}
                    data-testid="student-resume-cta"
                  >
                    <span>{dict.student.resumeCta}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="g1-card mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="text-xl font-extrabold text-[#0c2444]">
                {isTe ? "కొత్త ప్రయోగాన్ని ప్రారంభించడానికి సిద్ధంగా ఉంది" : "Ready to start a new practical"}
              </h2>
              <p className="mt-1 text-sm text-[#4b637a]">
                {isTe
                  ? "క్రింద కేటాయించిన ప్రయోగాన్ని తెరవండి లేదా రసాయన, భౌతిక, జీవ శాస్త్ర ప్రయోగశాలలను అన్వేషించండి."
                  : "Open an assigned practical below or browse Chemistry, Physics and Biology laboratories."}
              </p>
            </div>
            <Link href="/laboratories" className="g1-btn g1-btn-teal">
              <span>{dict.home.exploreLabsCta}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        )}

        {journey}

        {/* 2-Column Grid: My Assignments + My Progress */}
        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-12">
          <section
            id="assignments"
            aria-labelledby="upcoming-heading"
            className="g1-card p-6 xl:col-span-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="upcoming-heading" className="text-xl font-extrabold text-[#0c2444]">
                {dict.student.upcomingHeading}
              </h2>
              <Link
                href="/laboratories"
                className="inline-flex items-center gap-1 text-xs font-extrabold text-[#007875] hover:underline"
              >
                <span>{dict.home.browseAll}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {data.assignments.length === 0 ? (
              <p className="mt-5 text-sm text-[#4b637a]">
                {isTe ? "ఇంకా తరగతి అసైన్‌మెంట్‌లు ప్రచురించబడలేదు." : "No class assignments published yet."}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[#e7eff5]">
                {data.assignments.map((asg) => {
                  const copy = getExperimentCopy(asg.experimentId, locale);
                  const statusLabel =
                    asg.status === "submitted"
                      ? dict.student.submitted
                      : asg.status === "in_progress"
                        ? dict.student.inProgress
                        : dict.student.notStarted;
                  const targetHref = asg.activeSessionId
                    ? `/player/${asg.activeSessionId}`
                    : `/experiments/${asg.experimentId}?assignmentId=${asg.assignmentId}`;
                  const isPastDue = asg.isPastDue;
                  const bothModes = asg.modes.length > 1;
                  const onlyExp = asg.modes.length === 1 && asg.modes[0] === "experiment";
                  const modeBadge = bothModes
                    ? isTe
                      ? "సిమ్యులేషన్ + ఎక్స్‌పెరిమెంట్"
                      : "SIMULATION + EXPERIMENT"
                    : onlyExp
                      ? isTe
                        ? "ఎక్స్‌పెరిమెంట్ మాత్రమే"
                        : "EXPERIMENT ONLY"
                      : isTe
                        ? "సిమ్యులేషన్ మాత్రమే"
                        : "SIMULATION ONLY";

                  return (
                    <li
                      key={asg.assignmentId}
                      className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3.5">
                        {subjectIcon(asg.subject)}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`g1-tag ${
                                bothModes || onlyExp ? "g1-tag-green" : "g1-tag-blue"
                              }`}
                            >
                              {modeBadge}
                            </span>
                            <span className="g1-tag">v{asg.contentVersion}</span>
                            {isPastDue && asg.status !== "submitted" && (
                              <span className="g1-tag g1-tag-warn">
                                {isTe ? "గడువు ముగిసింది" : "Past due (IST)"}
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1.5 truncate text-sm font-extrabold text-[#0c2444]">
                            {copy.shortTitle}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#4b637a]">
                            {dict.subjects[asg.subject].name} · {formatStageLabel(asg.grade, locale)} ·{" "}
                            {isTe
                              ? `ప్రయత్నాలు: ${asg.submittedAttempts}/${asg.maxAttempts}`
                              : `Attempts: ${asg.submittedAttempts}/${asg.maxAttempts}`}
                            {asg.dueAt
                              ? ` · ${isTe ? "గడువు (IST): " : "Due (IST): "}${new Date(
                                  asg.dueAt
                                ).toLocaleDateString(locale, {
                                  timeZone: "Asia/Kolkata",
                                })}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`g1-tag ${
                            asg.status === "submitted"
                              ? "g1-tag-green"
                              : asg.status === "in_progress"
                                ? "g1-tag-blue"
                                : ""
                          }`}
                        >
                          {statusLabel}
                        </span>
                        <Link
                          href={targetHref}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#bad5e4] bg-white px-3.5 py-2 text-xs font-extrabold text-[#0b6c99] hover:bg-[#f0f8fc]"
                        >
                          <span>
                            {asg.activeSessionId ? dict.student.resumeCta : dict.student.viewAction}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            id="progress"
            aria-labelledby="progress-heading"
            className="g1-card p-6 xl:col-span-5"
          >
            <h2 id="progress-heading" className="text-xl font-extrabold text-[#0c2444]">
              {dict.student.progressHeading}
            </h2>
            <p className="mt-1 text-xs text-[#4b637a]">{dict.student.progressSub}</p>

            <div className="mt-6 space-y-5">
              {(["chemistry", "physics", "biology"] as const).map((subj) => {
                const pct = data.progressBySubject[subj];
                return (
                  <div key={subj}>
                    <div className="mb-2 flex justify-between text-xs font-bold text-[#0c2444]">
                      <span>{dict.subjects[subj].name}</span>
                      <span>{pct}%</span>
                    </div>
                    <div
                      className="g1-progress"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${dict.subjects[subj].name} progress`}
                    >
                      <span
                        className={`g1-progress-bar ${subj === "biology" ? "g1-progress-bar-green" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Submitted rubric results & evidence drill-down section (W03 + G1-21 + G1-35) */}
        <section id="results" aria-labelledby="results-heading" className="g1-card mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="results-heading" className="text-xl font-extrabold text-[#0c2444]">
                {dict.student.resultsHeading}
              </h2>
              <p className="mt-1 text-xs text-[#4b637a]">
                {isTe
                  ? "మీ సమర్పణలను అనుసరించండి, రూబ్రిక్ ప్రమాణాలను సమీక్షించండి మరియు మీ నిర్ధారించిన ప్రయోగశాల పరిశీలనలను తనిఖీ చేయండి."
                  : "Follow your submissions, review rubric criteria, and inspect your confirmed server observations."}
              </p>
            </div>
          </div>

          {data.results.length === 0 ? (
            <p className="mt-4 text-sm text-[#4b637a]">
              {isTe
                ? "ఇంకా సమర్పించిన మూల్యాంకనాలు లేవు. ప్రయోగాన్ని పూర్తి చేసి మీ నిర్ధారించిన పరిశీలనలను సమర్పించండి."
                : "No submitted assessments yet. Complete a practical and submit your confirmed observations to see server-evaluated rubric feedback here."}
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[#e8f0f5]">
              {data.results.map((r) => (
                <div key={r.assessmentId} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[#046c49]" aria-hidden="true" />
                        <strong className="text-sm text-[#0c2444]">
                          {getExperimentCopy(r.experimentId, locale).shortTitle}
                        </strong>
                        <span
                          className={`g1-tag ${r.mode === "experiment" ? "g1-tag-green" : "g1-tag-blue"}`}
                        >
                          {r.mode === "experiment" ? dict.common.experiment : dict.common.simulation}
                        </span>
                        <span className="g1-tag">
                          {r.assignmentId
                            ? isTe
                              ? "తరగతి అసైన్‌మెంట్"
                              : "Class Assignment"
                            : isTe
                              ? "వ్యక్తిగత అభ్యాసం"
                              : "Personal Practice"}
                        </span>
                        <span className="g1-tag">{r.rubricId}</span>
                        {r.isLate && (
                          <span className="g1-tag g1-tag-warn">
                            {isTe ? "ఆలస్య సమర్పణ" : "Submitted late"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#4b637a]">{r.summary}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-extrabold text-[#046c49]">
                        {r.criteriaPassed} / {r.criteriaTotal}{" "}
                        {isTe ? "ప్రమాణాలు" : "criteria"} · {r.gradeState}
                      </div>
                      <div className="text-xs text-[#4b637a]">
                        {r.evidenceCount}{" "}
                        {isTe ? "నిర్ధారించిన పరిశీలనలు" : "confirmed evidence"} ·{" "}
                        {new Date(r.submittedAt).toLocaleDateString(locale, {
                          timeZone: "Asia/Kolkata",
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Student-owned evidence & rubric criterion drill-down (G1-21) */}
                  <details
                    className="mt-3 rounded-xl border border-[#d6e7f2] bg-[#f7fbfe] p-3.5 text-xs"
                    data-testid={`student-result-detail-${r.assessmentId}`}
                  >
                    <summary className="cursor-pointer font-extrabold text-[#007875]">
                      {isTe
                        ? "రూబ్రిక్ ప్రమాణాలు & నా నిర్ధారించిన పరిశీలనల వివరాలు చూడండి →"
                        : "View details — Rubric criteria & confirmed observations →"}
                    </summary>

                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <div className="font-extrabold text-[#0c2444]">
                          {isTe ? "రూబ్రిక్ ప్రమాణాలు:" : "Rubric criteria breakdown:"}
                        </div>
                        <ul className="mt-1.5 space-y-1">
                          {r.criteria.map((c) => (
                            <li key={c.id} className="flex items-center gap-1.5">
                              {c.passed ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#046c49]" aria-hidden="true" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 shrink-0 text-[#9b2119]" aria-hidden="true" />
                              )}
                              <span className="font-mono font-bold">{c.id}:</span>
                              <span>{c.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="font-extrabold text-[#0c2444]">
                          {isTe
                            ? `నా నిర్ధారించిన పరిశీలనలు (రివిజన్ #${r.revision}):`
                            : `My confirmed server observations (Revision #${r.revision}):`}
                        </div>
                        {r.observations.length === 0 ? (
                          <p className="mt-1 text-[#4b637a]">
                            {isTe ? "పరిశీలనలు నమోదు కాలేదు." : "No observation records."}
                          </p>
                        ) : (
                          <ul className="mt-1.5 space-y-1 font-mono text-[11px]">
                            {r.observations.map((obs) => (
                              <li key={obs.observationId} className="rounded bg-white px-2.5 py-1.5">
                                Rev #{obs.revision}: {JSON.stringify(obs.payload).slice(0, 140)}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-2.5">
                          <Link
                            href={`/player/${r.sessionId}`}
                            className="inline-flex items-center gap-1 font-extrabold text-[#007875] hover:underline"
                          >
                            <span>
                              {isTe ? "చదవడానికి మాత్రమే సెషన్ రికార్డును తెరవండి" : "Open read-only session record"}
                            </span>
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="mt-6 text-xs text-[#5a7288]">{dict.student.syntheticNotice}</p>
      </main>
    </div>
  );
}
