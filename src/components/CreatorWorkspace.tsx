"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { submissionSchema, trustedLabBindings, trustedLabManifestSchema, type CreatorDraftBody } from "@/lib/creator-contract";
import { EDUCATION_STAGES } from "@/lib/education-stages";
import { getDictionary } from "@/lib/i18n";
import type { LabSubject, Locale } from "@/lib/types";
import type { BlobUpload } from "@/lib/blob-media";

export type CreatorAsset = { id: string; filename: string; type: string; bytes: string; status: string };
export type CreatorLesson = { id: string; subject: LabSubject; grade: number; titleEn: string; titleTe: string; order: number; published: boolean };
type Pair = { en: string; te: string };
type Learning = CreatorDraftBody["learning"];

function PairField({ name, value, onChange, multiline = false }: {
  name: string; value: Pair; onChange: (value: Pair) => void; multiline?: boolean;
}) {
  return <fieldset className="g1-author-pair">
    <legend>{name}</legend>
    {(["en", "te"] as const).map(language => <label key={language}>
      <span>{language === "en" ? "English" : "తెలుగు"}</span>
      {multiline
        ? <textarea rows={3} value={value[language]} onChange={event => onChange({ ...value, [language]: event.target.value })} />
        : <input value={value[language]} onChange={event => onChange({ ...value, [language]: event.target.value })} />}
    </label>)}
  </fieldset>;
}

export function CreatorMediaLibrary({ assets, onReady, locale }: { assets: CreatorAsset[]; onReady?: (asset: CreatorAsset) => void; locale: Locale }) {
  const te = locale === "te-IN";
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [existing, setExisting] = useState("");
  const [current, setCurrent] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const controller = useRef<AbortController | null>(null);

  async function upload() {
    if (!file) return;
    const pending = assets.find(asset => asset.id === (existing || current));
    if (pending && (pending.filename !== file.name || Number(pending.bytes) !== file.size || pending.type !== file.type)) {
      setStatus("Select the same file to resume this upload.");
      return;
    }
    setWorking(true);
    setStatus("Preparing upload…");
    const signal = new AbortController();
    controller.current = signal;
    let id = existing || current;
    try {
      const prepared = await apiFetch<{ id: string; uploadUrl?: string; hosted?: BlobUpload & { token: string }; detail?: string }>("/api/creator/media", {
        method: "POST", body: id ? { operation: "resume", id } :
          { operation: "prepare", filename: file.name, type: file.type, bytes: file.size },
      });
      if (!prepared.ok) throw new Error(prepared.data.detail || "Unable to prepare upload.");
      id = prepared.data.id;
      setCurrent(id);
      setStatus("Uploading…");
      const { uploadUrl, hosted } = prepared.data;
      if (hosted) {
        const { uploadPart } = await import("@vercel/blob/client");
        let offset = Math.min(file.size, hosted.partSize * hosted.parts.length);
        setProgress(offset / file.size);
        for (let number = hosted.parts.length + 1; offset < file.size; number++) {
          const body = file.slice(offset, offset + hosted.partSize, file.type);
          const part = await uploadPart(hosted.pathname, body, {
            access: "private", token: hosted.token, key: hosted.key, uploadId: hosted.uploadId,
            partNumber: number, contentType: file.type, abortSignal: signal.signal,
          });
          const confirmed = await apiFetch<{ detail?: string }>("/api/creator/media", {
            method: "POST", body: { operation: "part", id, partNumber: number, etag: part.etag },
          });
          if (!confirmed.ok) throw new Error(confirmed.data.detail || "Upload interrupted. Select Resume to continue.");
          offset += body.size;
          setProgress(offset / file.size);
        }
      } else if (uploadUrl) {
        const head = await fetch(uploadUrl, { method: "HEAD", signal: signal.signal });
        if (!head.ok) throw new Error("Local upload store is unavailable. Check the media service.");
        let offset = Number(head.headers.get("Upload-Offset") ?? 0);
        setProgress(offset / file.size);
        while (offset < file.size) {
          const part = file.slice(offset, offset + 8 * 1024 * 1024);
          const response = await fetch(uploadUrl, {
            method: "PUT", headers: { "Content-Type": "application/octet-stream", "Upload-Offset": String(offset) },
            body: part, signal: signal.signal,
          });
          if (!response.ok) throw new Error(response.status === 507 ? "The object store is out of disk space." : "Upload interrupted. Select Resume to continue.");
          offset += part.size;
          setProgress(offset / file.size);
        }
      } else {
        throw new Error("Upload storage is unavailable.");
      }
      setStatus("Verifying file…");
      const complete = await apiFetch<{ detail?: string }>("/api/creator/media", { method: "POST", body: { operation: "finish", id } });
      if (!complete.ok) throw new Error(complete.data.detail || "Media verification failed.");
      onReady?.({ id, filename: file.name, type: file.type, bytes: String(file.size), status: "ready" });
      setCurrent("");
      setExisting("");
      setStatus("Ready");
      if (!onReady) router.refresh();
    } catch (error) {
      setStatus(signal.signal.aborted ? "Paused. Select Resume to continue." : (error instanceof Error ? error.message : "Upload interrupted."));
      router.refresh();
    } finally {
      setWorking(false);
      controller.current = null;
    }
  }

  async function cancel() {
    const id = existing || current;
    if (!id) return;
    const response = await apiFetch<{ detail?: string }>("/api/creator/media", { method: "POST", body: { operation: "cancel", id } });
    setStatus(response.ok ? "Upload canceled." : response.data.detail || "Unable to cancel.");
    if (response.ok) { setCurrent(""); setExisting(""); setProgress(0); router.refresh(); }
  }

  return <div className="g1-card g1-info-card g1-author-stack">
    <label>{te ? "చిత్రం లేదా వీడియో" : "Image or video"}
      <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
        disabled={working} onChange={event => { setFile(event.target.files?.[0] ?? null); if (!existing) setCurrent(""); }} />
    </label>
    {assets.some(item => item.status === "uploading") &&
      <label>{te ? "పెండింగ్ అప్‌లోడ్ కొనసాగించండి" : "Resume a pending upload"}
        <select value={existing} onChange={event => { setExisting(event.target.value); setCurrent(""); }} disabled={working}>
          <option value="">{te ? "కొత్త అప్‌లోడ్" : "New upload"}</option>
          {assets.filter(item => item.status === "uploading").map(item => <option key={item.id} value={item.id}>{item.filename}</option>)}
        </select>
      </label>}
    <div className="g1-learning-buttons">
      <button type="button" className="g1-btn g1-btn-teal" disabled={!file || working} onClick={upload}>{existing || current ? (te ? "అప్‌లోడ్ కొనసాగించండి" : "Resume upload") : (te ? "మీడియా అప్‌లోడ్ చేయండి" : "Upload media")}</button>
      {working && progress < 1 && <button type="button" className="g1-btn g1-btn-outline" onClick={() => controller.current?.abort()}>{te ? "తాత్కాలికంగా ఆపండి" : "Pause"}</button>}
      {!working && (current || existing) && <button type="button" className="g1-btn g1-btn-outline" onClick={cancel}>{te ? "అప్‌లోడ్ రద్దు చేయండి" : "Cancel upload"}</button>}
    </div>
    {status && <p aria-live="polite">{status}</p>}
    {(working || progress > 0) && <progress value={progress} max={1} aria-label={te ? "అప్‌లోడ్ పురోగతి" : "Upload progress"} />}
    {assets.length > 0 && <ul className="g1-file-list">
      {assets.map(asset => <li key={asset.id}>
        <span>{asset.filename}</span><span>{asset.status}</span>
        {asset.status === "ready" && <Link className="g1-text-link" href={"/api/media/" + asset.id} target="_blank">{te ? "తెరవండి" : "Open"}</Link>}
      </li>)}
    </ul>}
  </div>;
}

export function CreatorEditor({ id: initialId, revision, initial, review, reviewerNotes, initialLessons, assets, locale }: {
  id: string; revision: number; initial: CreatorDraftBody; review: string | null; reviewerNotes: string | null;
  initialLessons: CreatorLesson[]; assets: CreatorAsset[]; locale: Locale;
}) {
  const te = locale === "te-IN";
  const dict = getDictionary(locale);
  const router = useRouter();
  const [id] = useState(initialId);
  const [body, setBody] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [lessonList, setLessonList] = useState(initialLessons);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState(revision ? (te ? "ముసాయిదా తెరిచారు" : "Draft loaded") : (te ? "కొత్త ముసాయిదా" : "New draft"));
  const [issues, setIssues] = useState<string[]>([]);
  const [availableAssets, setAvailableAssets] = useState<CreatorAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewLanguage, setPreviewLanguage] = useState<"en" | "te">(te ? "te" : "en");
  const [quizPreviewAnswers, setQuizPreviewAnswers] = useState<Record<number, number>>({});
  const [lessonCode, setLessonCode] = useState("");
  const [lessonTitle, setLessonTitle] = useState<Pair>({ en: "", te: "" });
  const [lessonOrder, setLessonOrder] = useState(1);
  const [lessonBusy, setLessonBusy] = useState(false);
  const version = useRef(revision);
  const lastFailed = useRef<CreatorDraftBody | null>(null);
  const locked = submitted || Boolean(review && review !== "rework");
  const dirty = body !== saved;
  const pages = te ? ["వర్గీకరణ", "మీడియా", "సిమ్యులేషన్", "ప్రయోగశాల అనుసంధానం", "సమీక్ష"]
    : ["Classification", "Media", "Simulation", "Lab binding", "Review"];
  const binding = trustedLabBindings[body.subject];
  const selectedLessons = lessonList.filter(lesson => lesson.grade === body.grade && lesson.subject === body.subject);
  const mediaAssets = [...new Map([...assets, ...availableAssets].map(item => [item.id, item])).values()];
  const ready = mediaAssets.filter(item => item.status === "ready");

  function edit<K extends keyof CreatorDraftBody>(key: K, value: CreatorDraftBody[K]) {
    setBody(current => ({ ...current, [key]: value }));
  }
  function learning<K extends keyof Learning>(key: K, value: Learning[K]) {
    setBody(current => ({ ...current, learning: { ...current.learning, [key]: value } }));
  }

  const save = useCallback(async () => {
    if (locked || saving) return false;
    if (body === saved && version.current > 0) return true;
    setSaving(true);
    setStatus("Saving draft…");
    const response = await apiFetch<{ revision: number; detail?: string }>("/api/creator/drafts",
      { method: "POST", body: { operation: "save", id, revision: version.current, body } });
    setSaving(false);
    if (!response.ok) { lastFailed.current = body; setStatus(response.data.detail || "Unable to save draft."); return false; }
    lastFailed.current = null;
    version.current = response.data.revision;
    setSaved(body);
    setStatus("Draft saved");
    if (version.current === 1) {
      const url = new URL(window.location.href);
      url.searchParams.set("draft", id);
      window.history.replaceState(null, "", url);
    }
    return true;
  }, [body, id, locked, saved, saving]);

  useEffect(() => {
    if (!dirty || locked || saving || lastFailed.current === body) return;
    const timer = window.setTimeout(() => { void save(); }, 850);
    return () => window.clearTimeout(timer);
  }, [body, dirty, locked, save, saving]);

  useEffect(() => {
    if (!dirty || locked) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, locked]);

  async function addLesson() {
    setLessonBusy(true);
    const response = await apiFetch<CreatorLesson & { detail?: string }>("/api/creator/drafts", {
      method: "POST", body: { operation: "lesson", lesson: {
        code: lessonCode, subject: body.subject, grade: body.grade,
        titleEn: lessonTitle.en, titleTe: lessonTitle.te, order: lessonOrder,
      } },
    });
    setLessonBusy(false);
    if (!response.ok) return setStatus(response.data.detail || "Unable to create lesson.");
    setLessonList(current => [...current, { ...response.data, published: false }]);
    edit("lessonId", response.data.id);
    setStatus("Lesson draft created");
    setLessonCode("");
    setLessonTitle({ en: "", te: "" });
  }

  function validation() {
    const result = submissionSchema.safeParse(body);
    const errors = result.success ? [] : result.error.issues.map(issue => issue.path.join(".") + " — " + issue.message);
    setIssues(errors);
    setStatus(errors.length ? "Complete the fields listed below." : "Content fields are complete. Submit for server validation.");
    return !errors.length;
  }

  async function submit() {
    if (!validation() || !await save()) return;
    setSaving(true);
    const response = await apiFetch<{ detail?: string; issues?: string[] }>("/api/creator/drafts",
      { method: "POST", body: { operation: "submit", id, revision: version.current } });
    setSaving(false);
    if (!response.ok) { setStatus(response.data.detail ?? "Unable to submit."); setIssues(response.data.issues ?? []); return; }
    setIssues([]);
    setSubmitted(true);
    setStatus("Submitted for independent review");
    router.refresh();
  }

  return <>
    <div className="g1-creator-editor" data-subject={body.subject}>
    <nav className="g1-editor-tabs g1-editor-sidebar" aria-label={te ? "ప్రయోగ రచన దశలు" : "Experiment authoring steps"}>
      <h2>{te ? "ప్రయోగ రచన" : "Creator studio"}</h2>
      {pages.map((label, index) => <button type="button" key={label}
        className="g1-btn g1-btn-outline" aria-current={index === page ? "step" : undefined}
        onClick={() => { setPreview(false); setPage(index); }}>{index + 1}. {label}</button>)}
    </nav>
    <div className="g1-card g1-info-card g1-author-stack g1-editor-panel">
      <div className="g1-section-line">
        <h2>{pages[page]}</h2>
        <span className={`g1-tag ${locked ? "g1-tag-blue" : "g1-tag-green"}`}>
          {locked ? (te ? "సమీక్ష స్థితి" : "Review status") : (te ? "ముసాయిదా" : "Draft")}
        </span>
      </div>
      {review && <p>Review status: {review}{reviewerNotes && " · " + reviewerNotes}</p>}
      <fieldset disabled={locked} className="g1-author-stack">
        {page === 0 && <>
          <div className="g1-author-grid">
            <label>{te ? "ప్రధాన తరగతి" : "Primary class"}<select value={body.grade} onChange={event => setBody(current => ({ ...current, grade: Number(event.target.value), lessonId: "",
              additionalLessons: current.additionalLessons?.filter(mapping => mapping.grade !== Number(event.target.value)) }))}>
              {EDUCATION_STAGES.map(stage => <option key={stage.id} value={stage.grade}>{te ? stage.labelTe : stage.labelEn}</option>)}
            </select></label>
            <label>{te ? "విషయం" : "Subject"}<select value={body.subject} onChange={event => setBody(current => ({
              ...current, subject: event.target.value as CreatorDraftBody["subject"], lessonId: "", additionalLessons: [], modelConfirmed: false, labManifest: null,
            }))}>{(Object.keys(trustedLabBindings) as LabSubject[]).map(subject => <option value={subject} key={subject}>{dict.subjects[subject].name}</option>)}</select></label>
            <label>{te ? "పాఠం" : "Lesson"}<select value={body.lessonId} onChange={event => edit("lessonId", event.target.value)}>
              <option value="">{te ? "పాఠాన్ని ఎంచుకోండి" : "Choose a lesson"}</option>
              {selectedLessons.map(lesson => <option key={lesson.id} value={lesson.id}>{te ? lesson.titleTe : lesson.titleEn}{lesson.published ? "" : " (Draft)"}</option>)}
            </select></label>
            <label>{te ? "కృత్యం సంఖ్య" : "Activity number"}<input value={body.activity} onChange={event => edit("activity", event.target.value)} /></label>
            <label>{te ? "ప్రయోగ లింకు పేరు" : "Experiment slug"}<input value={body.slug} placeholder="my-science-lab" onChange={event => edit("slug", event.target.value)} /></label>
            <label>{te ? "వెర్షన్" : "Version"}<input value={body.version} onChange={event => edit("version", event.target.value)} /></label>
          </div>
          <PairField name={te ? "ప్రయోగం శీర్షిక" : "Experiment title"} value={body.learning.title} onChange={value => learning("title", value)} />
          <PairField name={te ? "చిన్న వివరణ" : "Short description"} value={body.learning.description} onChange={value => learning("description", value)} multiline />
          <label>{te ? "శోధన పదాలు" : "Search keywords"}<input value={body.keywords} onChange={event => edit("keywords", event.target.value)} /></label>
          <details className="g1-author-details"><summary>{te ? "మరిన్ని తరగతులకు జోడించండి" : "Map to additional classes"}</summary>
            <div className="g1-author-grid">
              {EDUCATION_STAGES.filter(stage => stage.grade !== body.grade).map(stage => {
                const options = lessonList.filter(lesson => lesson.subject === body.subject && lesson.grade === stage.grade);
                return <label key={stage.id}>{te ? stage.labelTe : stage.labelEn}<select disabled={!options.length}
                  value={body.additionalLessons?.find(mapping => mapping.grade === stage.grade)?.lessonId ?? ""}
                  onChange={event => {
                    const rest = (body.additionalLessons ?? []).filter(mapping => mapping.grade !== stage.grade);
                    edit("additionalLessons", event.target.value ? [...rest, { grade: stage.grade, lessonId: event.target.value }] : rest);
                  }}><option value="">{options.length ? "No mapping" : "No matching lessons"}</option>
                  {options.map(lesson => <option key={lesson.id} value={lesson.id}>{te ? lesson.titleTe : lesson.titleEn}</option>)}</select></label>;
              })}
            </div>
          </details>
          <details className="g1-author-details"><summary>{te ? "పాఠం ముసాయిదా జోడించండి" : "Add a draft lesson"}</summary>
            <div className="g1-author-stack">
              <label>{te ? "పాఠం కోడ్" : "Lesson code"}<input value={lessonCode} onChange={event => setLessonCode(event.target.value)} /></label>
              <PairField name={te ? "పాఠం శీర్షిక" : "Lesson title"} value={lessonTitle} onChange={setLessonTitle} />
              <label>{te ? "పాఠ్యక్రమంలో స్థానం" : "Curriculum order"}<input type="number" min={1} max={9999} value={lessonOrder} onChange={event => setLessonOrder(Number(event.target.value))} /></label>
              <button className="g1-btn g1-btn-outline" type="button" disabled={lessonBusy} onClick={addLesson}>{te ? "పాఠం ముసాయిదాను సేవ్ చేయండి" : "Save draft lesson"}</button>
            </div>
          </details>
        </>}
        {page === 1 && <>
          <label>{te ? "ధృవీకరించిన ముఖచిత్రం" : "Verified thumbnail"}<select value={body.learning.thumbnailId ?? ""} onChange={event => learning("thumbnailId", event.target.value || null)}>
            <option value="">{te ? "చిత్రాన్ని ఎంచుకోండి" : "Choose an image"}</option>{ready.filter(item => item.type.startsWith("image/")).map(item => <option key={item.id} value={item.id}>{item.filename}</option>)}
          </select></label>
          <PairField name={te ? "ముఖచిత్ర వివరణ" : "Thumbnail alt text"} value={body.learning.thumbnailAlt ?? { en: "", te: "" }} onChange={value => learning("thumbnailAlt", value)} />
          <label>{te ? "ధృవీకరించిన వీడియో" : "Verified video"}<select value={body.learning.videoId ?? ""} onChange={event => learning("videoId", event.target.value || null)}>
            <option value="">{te ? "అందుబాటులో ఉండే ప్రత్యామ్నాయాన్ని వాడండి" : "Use the accessible alternative"}</option>{ready.filter(item => item.type.startsWith("video/")).map(item => <option key={item.id} value={item.id}>{item.filename}</option>)}
          </select></label>
          <PairField name={te ? "వీడియో పాఠ్యం లేదా ప్రత్యామ్నాయ కృత్యం" : "Transcript or equivalent text activity"} value={body.learning.alternateMedia} onChange={value => learning("alternateMedia", value)} multiline />
          {body.learning.videoId && <PairField name={te ? "వీడియో శీర్షికలు (WebVTT)" : "Video captions (WebVTT)"} value={body.learning.captions ?? { en: "", te: "" }}
            onChange={value => learning("captions", value)} multiline />}
          <label className="g1-author-check"><input type="checkbox" checked={body.rightsConfirmed} onChange={event => edit("rightsConfirmed", event.target.checked)} />I have permission to use these materials.</label>
          <CreatorMediaLibrary assets={mediaAssets} locale={locale} onReady={item => setAvailableAssets(current => [...current, item])} />
        </>}
        {page === 2 && <>
          <PairField name={te ? "1. లక్ష్యం మరియు అభ్యాస ఉద్దేశాలు" : "1. Aim and learning objectives"} value={body.learning.aim} onChange={value => learning("aim", value)} multiline />
          <PairField name={te ? "2. సిద్ధాంతం" : "2. Theory"} value={body.learning.theory} onChange={value => learning("theory", value)} multiline />
          {body.learning.procedure.map((step, index) => <div key={index}>
            <PairField name={"Procedure step " + (index + 1)} value={step} onChange={value => learning("procedure", body.learning.procedure.map((old, i) => i === index ? value : old))} multiline />
            {body.learning.procedure.length > 1 && <button type="button" className="g1-text-link"
              onClick={() => learning("procedure", body.learning.procedure.filter((_, i) => index !== i))}>Remove step {index + 1}</button>}
          </div>)}
          <button type="button" className="g1-btn g1-btn-outline" disabled={body.learning.procedure.length >= 30}
            onClick={() => learning("procedure", [...body.learning.procedure, { en: "", te: "" }])}>{te ? "విధానానికి ఒక దశ జోడించండి" : "Add a procedure step"}</button>
          <p>3. Animation / Video uses the verified media and accessible alternative in the Media tab.</p>
          <PairField name={te ? "4. ఫలితం, వివరణ" : "4. Result and explanation"} value={body.learning.result} onChange={value => learning("result", value)} multiline />
          <h3>{te ? "5. మూల్యాంకనం" : "5. Assessment"}</h3>
          {body.learning.questions.map((question, index) => {
            const replaceQuestion = (value: typeof question) => learning("questions", body.learning.questions.map((item, i) => i === index ? value : item) as Learning["questions"]);
            return <details key={index} className="g1-author-details" open={index === 0 ? true : undefined}>
              <summary>Question {index + 1}</summary>
              <div className="g1-author-stack">
                <PairField name={te ? "ప్రశ్న" : "Question"} value={question.prompt} onChange={value => replaceQuestion({ ...question, prompt: value })} />
                {question.options.map((option, i) => <PairField key={i} name={"Option " + "ABCD"[i]} value={option} onChange={value => {
                  const options = [...question.options] as typeof question.options;
                  options[i] = value;
                  replaceQuestion({ ...question, options });
                }} />)}
                <label>{te ? "సరైన ఎంపిక" : "Correct option"}<select value={question.correct ?? ""} onChange={event => replaceQuestion({ ...question, correct: event.target.value === "" ? null : Number(event.target.value) })}>
                  <option value="">{te ? "ఒకటి ఎంచుకోండి" : "Choose one"}</option>{"ABCD".split("").map((label, i) => <option key={label} value={i}>{label}</option>)}
                </select></label>
                <PairField name={te ? "అభ్యాస సూచనలు" : "Formative feedback"} value={question.feedback} onChange={value => replaceQuestion({ ...question, feedback: value })} multiline />
              </div>
            </details>;
          })}
        </>}
        {page === 3 && <>
          <p>Built-in lab: <strong>{binding.name}</strong> · {binding.model}</p>
          <ul className="g1-procedure"><li>Simulation: guided player and confirmed checkpoints</li><li>Experiment: inquiry player and the engine’s existing variable rules</li></ul>
          <label>{te ? "నమోదైన ప్రయోగశాల మానిఫెస్ట్‌ను జోడించండి (JSON)" : "Import a registered lab manifest (JSON)"}<input type="file" accept="application/json,.json" onChange={async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 16384) throw new Error("Manifest does not match the registered schema.");
              const parsed = trustedLabManifestSchema.parse(JSON.parse(await file.text()));
              if (parsed.engine !== body.subject || parsed.sourceExperimentId !== binding.experimentId) {
                throw new Error("The manifest must match the analytical model for this subject.");
              }
              edit("labManifest", parsed);
              edit("modelConfirmed", false);
              setStatus("Manifest attached. Its fingerprint is verified during submission.");
            } catch (error) { setStatus(error instanceof Error && error.name !== "ZodError" ? error.message : "Invalid registered lab manifest."); }
          }} /></label>
          {body.labManifest && <p>{body.labManifest.sourceExperimentId} · {body.labManifest.sourceVersion}
            <button type="button" className="g1-text-link ms-3" onClick={() => { edit("labManifest", null); edit("modelConfirmed", false); }}>{te ? "మానిఫెస్ట్ తొలగించండి" : "Remove manifest"}</button>
          </p>}
          <label className="g1-author-check"><input type="checkbox" checked={body.modelConfirmed} onChange={event => edit("modelConfirmed", event.target.checked)} />
            This content uses this lab and its existing scientific limits.</label>
        </>}
        {page === 4 && <>
          <label>{te ? "స్వతంత్ర సమీక్షకుడికి గమనికలు" : "Notes for the independent reviewer"}<textarea rows={3} value={body.notes} onChange={event => edit("notes", event.target.value)} /></label>
          <p>Save the draft before submitting it. The assigned reviewer decides whether it can appear in the catalogue.</p>
        </>}
      </fieldset>
      <div className="g1-learning-buttons">
        {!locked && <button type="button" className="g1-btn g1-btn-outline" disabled={saving} onClick={() => void save()}>{te ? "ముసాయిదా సేవ్ చేయండి" : "Save draft"}</button>}
        <button type="button" className="g1-btn g1-btn-outline" aria-expanded={preview} aria-controls={preview ? "creator-student-preview" : undefined}
          onClick={() => setPreview(!preview)}>{preview ? (te ? "మునుజూపు మూసివేయండి" : "Close preview") : (te ? "విద్యార్థి మునుజూపు" : "Preview as student")}</button>
        {!locked && <button type="button" className="g1-btn g1-btn-outline" onClick={validation}>{te ? "వివరాలను తనిఖీ చేయండి" : "Check validation"}</button>}
        {page === 4 && !locked && <button type="button" className="g1-btn g1-btn-teal" disabled={saving} onClick={submit}>{te ? "సమీక్షకు పంపండి" : "Submit for review"}</button>}
      </div>
      <p aria-live="polite">{status}</p>
      {issues.length > 0 && <ul>{issues.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    </div>
    </div>
    {preview && <section id="creator-student-preview" className="g1-card g1-info-card g1-public-section">
      <h2>{te ? "విద్యార్థి మునుజూపు" : "Student preview"}</h2>
      <label className="g1-author-check">Language<select value={previewLanguage} onChange={event => setPreviewLanguage(event.target.value as "en" | "te")}><option value="en">English</option><option value="te">తెలుగు</option></select></label>
      <h3>{body.learning.title[previewLanguage]}</h3><p>{body.learning.description[previewLanguage]}</p>
      <h4>Aim</h4><p>{body.learning.aim[previewLanguage]}</p>
      <h4>Theory &amp; Procedure</h4><p>{body.learning.theory[previewLanguage]}</p>
      <ol className="g1-procedure">{body.learning.procedure.map((step, index) => <li key={index}>{step[previewLanguage]}</li>)}</ol>
      <h4>Animation / Video</h4>
      {body.learning.videoId && <video className="g1-about-image" controls preload="metadata" src={"/api/media/" + body.learning.videoId} />}
      <p>{body.learning.alternateMedia[previewLanguage]}</p>
      <h4>Result &amp; Explanation</h4><p>{body.learning.result[previewLanguage]}</p>
      <h4>Assessment</h4>
      {body.learning.questions.map((question, index) => <fieldset key={index} className="g1-quiz-question mt-4">
        <legend>{index + 1}. {question.prompt[previewLanguage] || "Untitled question"}</legend>
        {question.options.map((option, i) => <label key={i}><input type="radio" name={"preview-question-" + index}
          checked={quizPreviewAnswers[index] === i} onChange={() => setQuizPreviewAnswers(current => ({ ...current, [index]: i }))} />{"ABCD"[i]}. {option[previewLanguage]}</label>)}
        {quizPreviewAnswers[index] !== undefined && <p>{question.feedback[previewLanguage]}</p>}
      </fieldset>)}
    </section>}
  </>;
}
