import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { GlassBack } from "@/components/GlassBack";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { query } from "@/lib/db";
import type { LearningContent } from "@/lib/learning-contract";

export default async function EditorialPreviewPage({ params }: { params: Promise<{ reviewId: string }> }) {
  const [{ reviewId }, auth, locale] = await Promise.all([params, getCurrentSession(), getRequestLocale()]);
  if (!auth) redirect("/sign-in?next=/content");
  if (auth.role !== "content_reviewer" || !z.uuid().safeParse(reviewId).success) notFound();
  const { rows: [row] } = await query<{ content: LearningContent; title_en: string; activity_number: string; subject: string; grade: number }>(
    `SELECT lv.content, lesson.title_en, el.activity_number, el.subject, el.grade
     FROM editorial_review er JOIN learning_version lv USING(experiment_id, content_version)
     JOIN experiment_lesson el USING(experiment_id, content_version)
     JOIN lab_lesson lesson ON lesson.lesson_id = el.lesson_id WHERE er.review_id = $1
     ORDER BY el.is_primary DESC LIMIT 1`, [reviewId],
  );
  if (!row) notFound();
  const { content } = row;
  return <>
    <AppHeader auth={auth} locale={locale} variant="content" />
    <main id="main-content" data-workspace="review" className="g1-premium g1-public-shell g1-review-detail" data-subject={row.subject}>
      <GlassBack href="/content" label={locale === "te-IN" ? "స్వతంత్ర సమీక్షకు తిరిగి" : "Return to independent review"} />
      <header className="g1-public-heading g1-subject-banner"><h1>{content.title.en}</h1><p>{row.subject} · Grade {row.grade} · {row.title_en} · Activity {row.activity_number}</p></header>
      <div className="g1-info-grid">
        {(["en", "te"] as const).map(lang => <section className="g1-card g1-info-card" lang={lang} key={lang}>
          <h2>{content.title[lang]}</h2><p>{content.description[lang]}</p>
          <h3>Aim</h3><p>{content.aim[lang]}</p>
          <h3>Theory and procedure</h3><p>{content.theory[lang]}</p>
          <ol className="g1-procedure">{content.procedure.map((step, index) => <li key={index}>{step[lang]}</li>)}</ol>
          <h3>Media alternative</h3><p>{content.alternateMedia[lang]}</p>
          <h3>Result and explanation</h3><p>{content.result[lang]}</p>
          <h3>Assessment</h3>
          <ol className="g1-procedure">{content.questions.map((question, index) => <li key={index}>
            <strong>{question.prompt[lang]}</strong>
            <ul>{question.options.map((option, i) => <li key={i}>{option[lang]}{i === question.correct && " ✓"}</li>)}</ul>
            <p>{question.feedback[lang]}</p>
          </li>)}</ol>
        </section>)}
      </div>
      <div className="g1-public-actions">
        {content.thumbnailId && <Link className="g1-btn g1-btn-outline" href={"/api/media/" + content.thumbnailId} target="_blank">Review thumbnail</Link>}
        {content.videoId && <Link className="g1-btn g1-btn-outline" href={"/api/media/" + content.videoId} target="_blank">Review video</Link>}
      </div>
    </main>
  </>;
}
