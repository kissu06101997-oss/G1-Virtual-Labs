"use client";

import Link from "next/link";
import { GlassBack } from "./GlassBack";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import type { LearnerJourneyState } from "@/lib/learning";
import type { LabSubject, Locale } from "@/lib/types";

type GuidedSession = { session_id: string; status: string };
interface JourneyProps {
  locale: Locale;
  browseQuery: string;
  progress: LearnerJourneyState | null;
  guided: GuidedSession | null;
  identity: {
    experimentId: string; contentVersion: string; assignmentId: string | null;
    labId: LabSubject; manifestSha256: string; engineAbi: string;
  };
  content: {
    title: string; aim: string; theory: string; procedure: string[]; alternateMedia: string;
    videoId: string | null; thumbnailId: string | null; apparatus: { src: string; alt: string }; captions: ("en" | "te")[]; result: string;
    questions: { prompt: string; options: string[]; correct?: number; feedback?: string }[];
  };
}

export function LearningJourney({ locale, progress, guided, identity, content, browseQuery }: JourneyProps) {
  const te = locale === "te-IN";
  const router = useRouter();
  const [saved, setSaved] = useState(progress);
  const [view, setView] = useState(Math.min(5, (progress?.completed_stage ?? 0) + 1));
  const [answers, setAnswers] = useState<number[]>(progress?.answers ?? Array(5).fill(-1));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const done = saved?.completed_stage ?? 0;
  const labels = te ? ["లక్ష్యం", "సిద్ధాంతం, విధానం", "యానిమేషన్ / వీడియో", "ఫలితం, వివరణ", "మూల్యాంకనం"]
    : ["Aim", "Theory & Procedure", "Animation / Video", "Result & Explanation", "Assessment"];
  const overviewParams = new URLSearchParams(browseQuery);
  overviewParams.set("version", identity.contentVersion);
  if (identity.assignmentId) overviewParams.set("assignmentId", identity.assignmentId);
  const overviewHref = "/experiments/" + encodeURIComponent(identity.experimentId) + "?" + overviewParams;
  const playerSuffix = browseQuery ? "?" + browseQuery : "";
  const question = content.questions[questionIndex];

  async function advance() {
    setBusy(true);
    setMessage("");
    const response = await apiFetch<LearnerJourneyState & { detail?: string }>(
      "/api/learning/" + encodeURIComponent(identity.experimentId) + "/" + encodeURIComponent(identity.contentVersion),
      { method: "POST", body: view === 5 ? { stage: view, answers } : { stage: view } },
    );
    setBusy(false);
    if (!response.ok) {
      setMessage(response.data.detail || (te ? "మళ్లీ ప్రయత్నించండి." : "Unable to save. Please try again."));
      return;
    }
    setSaved(response.data);
    setView(Math.min(5, response.data.completed_stage + 1));
    if (view === 5) router.refresh();
  }

  async function openGuidedLab() {
    setBusy(true);
    setMessage("");
    const launch = await apiFetch<{ launchToken?: string; detail?: string }>("/api/v1/launch", {
      method: "POST", body: { ...identity, locale, mode: "simulation" },
    });
    if (launch.ok && launch.data.launchToken) {
      const redeem = await apiFetch<{ sessionId?: string; detail?: string }>("/api/v1/launch/redeem", {
        method: "POST", body: { launchToken: launch.data.launchToken },
      });
      if (redeem.ok && redeem.data.sessionId) {
        router.push("/player/" + redeem.data.sessionId + playerSuffix);
        return;
      }
      setMessage(redeem.data.detail || (te ? "ప్రయోగాన్ని తెరవలేకపోయాము." : "Unable to open the guided lab."));
    } else {
      setMessage(launch.data.detail || (te ? "ప్రయోగాన్ని తెరవలేకపోయాము." : "Unable to open the guided lab."));
    }
    setBusy(false);
  }

  return (
    <main id="main-content" className="g1-premium g1-public-shell g1-journey" data-subject={identity.labId} data-mode="simulation">
      <GlassBack href={overviewHref} label={te ? "ప్రయోగ వివరాలు" : "Experiment overview"} />
      <header className="g1-public-heading g1-mode-heading g1-mode-heading-sim g1-mode-banner">
        <p className="g1-tag g1-tag-blue">{te ? "సిమ్యులేషన్ మోడ్" : "Simulation Mode"}</p>
        <h1>{content.title}</h1>
      </header>
      <div className="g1-journey-layout">
      <ol className="g1-learning-steps" aria-label={te ? "సిమ్యులేషన్ దశలు" : "Simulation stages"}>
        {labels.map((label, index) => (
          <li key={label}>
            <button type="button" aria-current={view === index + 1 ? "step" : undefined}
              disabled={busy || index > done} onClick={() => { setView(index + 1); setMessage(""); }}>
              {index < done ? <CheckCircle2 size={16} aria-hidden="true" /> : index > done ? <Lock size={15} aria-hidden="true" /> : <span>{index + 1}</span>}
              {label}
            </button>
          </li>
        ))}
      </ol>
      <section className="g1-card g1-info-card g1-learning-content">
        <h2>{labels[view - 1]}</h2>
        {view === 1 && <>
          <p>{content.aim}</p>
          <Image className="g1-journey-apparatus" src={content.apparatus.src} alt={content.apparatus.alt} width={760} height={360} />
        </>}
        {view === 2 && <>
          <p>{content.theory}</p>
          <ol className="g1-procedure">{content.procedure.map((step, i) => <li key={i}>{step}</li>)}</ol>
          {guided && guided.status !== "submitted" ? <Link href={"/player/" + guided.session_id + playerSuffix} className="g1-btn g1-btn-outline">
            {te ? "సాధన కొనసాగించండి" : "Resume guided lab"}
          </Link> : <button type="button" disabled={busy} className="g1-btn g1-btn-blue" onClick={openGuidedLab}>
            {te ? "సాధనను తెరవండి" : "Open guided lab"}
          </button>}
        </>}
        {view === 3 && <>
          {content.videoId && <video controls preload="metadata" src={"/api/media/" + content.videoId}
            poster={content.thumbnailId ? "/api/media/" + content.thumbnailId : undefined} aria-label={labels[2]}>
            {content.captions.map(lang => <track key={lang} kind="captions" srcLang={lang} label={lang === "te" ? "తెలుగు" : "English"}
              src={"/api/learning/" + encodeURIComponent(identity.experimentId) + "/" + encodeURIComponent(identity.contentVersion) + "/captions/" + lang}
              default={lang === (te ? "te" : "en")} />)}
          </video>}
          <p>{content.alternateMedia}</p>
        </>}
        {view === 4 && <><p className="g1-tag">{te ? "పాఠ్య వివరణ" : "Learning explanation"}</p><p>{content.result}</p></>}
        {view === 5 && <>
          {done === 5 ? <>
            <p>{te ? "సమర్పించారు" : "Submitted"} · {saved?.score}/5</p>
            <ol className="g1-procedure">{content.questions.map((item, index) => (
              <li key={index}><strong>{item.prompt}</strong><p>{te ? "మీ సమాధానం" : "Your answer"} · {item.options[saved?.answers?.[index] ?? 0]}</p>
                {item.correct !== undefined && <p>{te ? "సరైన సమాధానం" : "Correct answer"} · {item.options[item.correct]}</p>}
                {item.feedback && <p>{item.feedback}</p>}</li>
            ))}</ol>
            <Link href={overviewHref} className="g1-btn g1-btn-green">{te ? "ఎక్స్‌పెరిమెంట్ మోడ్ తెరవండి" : "Open Experiment Mode"} <ArrowRight size={17} aria-hidden="true" /></Link>
          </> : <>
            <fieldset className="g1-quiz-question">
              <legend>{questionIndex + 1}/5 · {question.prompt}</legend>
              {question.options.map((option, i) => <label key={i}>
                <input type="radio" name={"question-" + questionIndex} checked={answers[questionIndex] === i}
                  onChange={() => setAnswers(current => current.map((answer, index) => index === questionIndex ? i : answer))} />
                <span>{String.fromCharCode(65 + i)}. {option}</span>
              </label>)}
            </fieldset>
            <div className="g1-learning-buttons">
              {questionIndex > 0 && <button type="button" className="g1-btn g1-btn-outline" onClick={() => setQuestionIndex(i => i - 1)}>{te ? "మునుపటి ప్రశ్న" : "Previous question"}</button>}
              {questionIndex < 4 && <button type="button" className="g1-btn g1-btn-blue" disabled={answers[questionIndex] < 0}
                onClick={() => setQuestionIndex(i => i + 1)}>{te ? "తదుపరి ప్రశ్న" : "Next question"}</button>}
              {questionIndex === 4 && <button type="button" className="g1-btn g1-btn-blue" disabled={busy || answers.includes(-1)} onClick={advance}>{te ? "సమాధానాలు సమర్పించండి" : "Submit five answers"}</button>}
            </div>
          </>}
        </>}
        {message && <p role="alert" className="g1-hint">{message}</p>}
        {view < 5 && <div className="g1-learning-buttons">
          <button type="button" className="g1-btn g1-btn-blue" disabled={busy}
            onClick={view <= done ? () => setView(view + 1) : advance}>
            {busy ? (te ? "సేవ్ చేస్తోంది" : "Saving…") : (te ? "కొనసాగించండి" : "Continue")} <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>}
      </section>
      <aside className="g1-card g1-info-card g1-journey-progress" aria-labelledby="journey-progress-label">
        <h2 id="journey-progress-label">{te ? "మీ అభ్యాస పురోగతి" : "Your learning progress"}</h2>
        <progress value={done} max={5} aria-labelledby="journey-progress-label" />
        <p aria-live="polite">{done}/5 {te ? "దశలు పూర్తయ్యాయి" : "stages complete"}</p>
      </aside>
      </div>
    </main>
  );
}
