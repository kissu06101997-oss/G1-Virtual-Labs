import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GlassBack } from "@/components/GlassBack";
import { AppHeader } from "@/components/AppHeader";
import { CreatorEditor, CreatorMediaLibrary, type CreatorAsset, type CreatorLesson } from "@/components/CreatorWorkspace";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { emptyCreatorDraft, type CreatorDraftBody } from "@/lib/creator-contract";
import { newUuid } from "@/lib/crypto";
import { query } from "@/lib/db";
import { formatStageLabel } from "@/lib/education-stages";
import { getDictionary } from "@/lib/i18n";

export default async function CreatorPage({ searchParams }: { searchParams: Promise<{ draft?: string; q?: string }> }) {
  const [auth, locale, params] = await Promise.all([getCurrentSession(), getRequestLocale(), searchParams]);
  if (!auth) redirect("/sign-in?next=/creator&role=creator");
  if (auth.role !== "creator") notFound();
  const te = locale === "te-IN";
  const dict = getDictionary(locale);

  const [drafts, media, lessons, publicationHistory] = await Promise.all([
    query<{ draft_id: string; revision: number; body: CreatorDraftBody; status: string | null; notes: string | null; updated_at: Date }>(
      `SELECT d.draft_id, d.revision, d.body, d.updated_at, er.status, er.notes
       FROM creator_draft d LEFT JOIN editorial_review er ON er.review_id = d.review_id
       WHERE d.owner_principal_id = $1 ORDER BY d.updated_at DESC`, [auth.principalId],
    ),
    query<CreatorAsset>(
      `SELECT asset_id AS id, filename, media_type AS type, expected_bytes::text AS bytes, status
       FROM creator_media WHERE owner_principal_id = $1 AND status <> 'canceled' ORDER BY created_at DESC`, [auth.principalId],
    ),
    query<CreatorLesson>(
      `SELECT lesson_id AS id, subject, grade, title_en AS "titleEn", title_te AS "titleTe", curriculum_order AS "order",
        published_at IS NOT NULL AS published
       FROM lab_lesson WHERE published_at IS NOT NULL OR owner_principal_id = $1 ORDER BY grade, curriculum_order`, [auth.principalId],
    ),
    query<{ experiment_id: string; content_version: string; status: string; submitted_at: Date }>(
      `SELECT experiment_id, content_version, status, submitted_at FROM editorial_review
       WHERE editor_principal_id = $1 ORDER BY submitted_at DESC`, [auth.principalId],
    ),
  ]);
  const row = params.draft && params.draft !== "new" ? drafts.rows.find(draft => draft.draft_id === params.draft) : null;
  if (params.draft && params.draft !== "new" && !row) notFound();
  const draftId = row?.draft_id ?? newUuid();
  const options = [{ label: te ? "ముసాయిదాలు" : "Drafts", value: null }, { label: te ? "సమీక్షలో" : "In review", value: "submitted" },
    { label: te ? "ప్రచురించినవి" : "Published", value: "approved" }, { label: te ? "సవరణ అవసరం" : "Needs revision", value: "rework" }];
  const text = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const matches = drafts.rows.filter(item => [item.body.learning.title.en, item.body.learning.title.te,
    item.body.subject, item.body.grade, item.body.lessonId, item.status ?? "draft"].join(" ").toLowerCase().includes(text.toLowerCase()));

  return (
    <>
      <AppHeader auth={auth} locale={locale} />
      <main id="main-content" data-workspace="creator" className="g1-premium g1-public-shell g1-creator">
        {!params.draft && <GlassBack href="/" label={te ? "ముఖపుటకు తిరిగి" : "Back to home"} />}
        <header className="g1-public-heading g1-mode-heading g1-workspace-banner">
          <h1>{te ? "ప్రయోగ రచయిత కార్యస్థలం" : "Creator Workspace"}</h1>
          <p>{te ? "ప్రయోగాన్ని రూపొందించండి, ధృవీకరించిన మీడియాను జోడించండి, స్వతంత్ర సమీక్షకు పంపండి."
            : "Author a practical, attach verified media and send a complete version for independent review."}</p>
        </header>
        {params.draft ? (
          <>
            <GlassBack href="/creator" label={te ? "నా ప్రయోగాలకు తిరిగి" : "Back to my experiments"} />
            <CreatorEditor key={params.draft} id={draftId} revision={row?.revision ?? 0}
              initial={row?.body ?? emptyCreatorDraft()} review={row?.status ?? null} reviewerNotes={row?.notes ?? null}
              initialLessons={lessons.rows} assets={media.rows} locale={locale} />
          </>
        ) : (
          <>
            <div className="g1-editor-tabs">
              <Link className="g1-btn g1-btn-teal" href="/creator?draft=new">{te ? "ప్రయోగం రూపొందించండి" : "Create experiment"}</Link>
              <Link className="g1-text-link" href="#my-experiments">{te ? "ప్రయోగాలను నిర్వహించండి" : "Manage experiments"}</Link>
              <Link className="g1-text-link" href="#media-library">{te ? "మీడియా గ్రంథాలయం" : "Media library"}</Link>
              <Link className="g1-text-link" href="#lesson-mappings">{te ? "పాఠాలు, తరగతి అనుసంధానాలు" : "Lessons & mappings"}</Link>
              <Link className="g1-text-link" href="#publication-history">{te ? "ప్రచురణ చరిత్ర" : "Publication history"}</Link>
            </div>
            <dl className="g1-creator-counts">
              {options.map(item => <div className="g1-card" key={item.label}><dt>{item.label}</dt><dd>
                {drafts.rows.filter(draft => draft.status === item.value).length}
              </dd></div>)}
            </dl>
            <section id="my-experiments" className="g1-public-section">
              <h2 className="g1-section-title">{te ? "నా ప్రయోగాలు" : "My experiments"}</h2>
              <form action="/creator" className="g1-help-search">
                <label>{te ? "ముసాయిదా వెతకండి" : "Find a draft"}<input type="search" name="q" maxLength={120} defaultValue={text} placeholder={te ? "శీర్షిక, తరగతి, విషయం లేదా పాఠం" : "Title, class, subject or lesson"} /></label>
                <button className="g1-btn g1-btn-outline">{te ? "వెతకండి" : "Search"}</button>
              </form>
              <ul className="g1-creator-list">
                {matches.map(draft => <li className="g1-card g1-info-card g1-linked-card" data-subject={draft.body.subject} key={draft.draft_id}>
                  <h3>{(te ? draft.body.learning.title.te : draft.body.learning.title.en) || (te ? "పేరు లేని ప్రయోగం" : "Untitled experiment")}</h3>
                  <p>{options.find(option => option.value === draft.status)?.label ?? draft.status} · {dict.subjects[draft.body.subject].name} · {formatStageLabel(draft.body.grade, locale)}</p>
                  <Link className="g1-text-link g1-card-target" href={"/creator?draft=" + draft.draft_id}>
                    {draft.status && draft.status !== "rework" ? (te ? "వెర్షన్ తెరవండి" : "Open version") : (te ? "ముసాయిదా తెరవండి" : "Open draft")}
                  </Link>
                </li>)}
              </ul>
              {!matches.length && <p className="mt-3">{text ? (te ? "సరిపోలే ముసాయిదాలు లేవు." : "No matching drafts.") : (te ? "మీ ముసాయిదాలు ఇక్కడ కనిపిస్తాయి." : "Your drafts will appear here.")}</p>}
            </section>
            <section id="media-library" className="g1-public-section">
              <h2 className="g1-section-title">{te ? "మీడియా గ్రంథాలయం" : "Media library"}</h2>
              <CreatorMediaLibrary assets={media.rows} locale={locale} />
            </section>
            <section id="lesson-mappings" className="g1-public-section g1-card g1-info-card">
              <h2>{te ? "పాఠాలు, తరగతి అనుసంధానాలు" : "Lessons & mappings"}</h2>
              <p>{te ? "ప్రయోగ ఎడిటర్‌లో సరైన తరగతి, విషయం కింద కొత్త పాఠాన్ని జోడించండి." : "Add a new lesson under a matching class and subject from the experiment editor."}</p>
              <ul>{lessons.rows.map(lesson => <li key={lesson.id}>{te ? lesson.titleTe : lesson.titleEn} · {dict.subjects[lesson.subject].name} · {formatStageLabel(lesson.grade, locale)} · {lesson.published ? (te ? "జాబితాలో ఉంది" : "Listed") : options[0].label}</li>)}</ul>
            </section>
            <section id="publication-history" className="g1-public-section g1-card g1-info-card">
              <h2>{te ? "ప్రచురణ చరిత్ర" : "Publication history"}</h2>
              {!publicationHistory.rows.length && <p>{te ? "ఇంకా ఏ వెర్షన్ సమర్పించలేదు." : "No submitted versions yet."}</p>}
              <ul>{publicationHistory.rows.map(row => <li key={row.experiment_id + "@" + row.content_version}>
                {row.experiment_id} · {row.content_version} · {row.status} · {row.submitted_at.toISOString().slice(0, 10)}
              </li>)}</ul>
            </section>
          </>
        )}
      </main>
    </>
  );
}
