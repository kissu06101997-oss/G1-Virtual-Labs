import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen } from "lucide-react";
import { AppHeader } from "./AppHeader";
import { GlassBack } from "./GlassBack";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { parseScienceSubject, ScienceDestinations } from "./ScienceDestinations";
import { experimentReturnParams } from "@/lib/lab-discovery";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { listCatalogExperiments } from "@/lib/catalog";
import { formatStageLabel, resolveEducationStage } from "@/lib/education-stages";
import { getDictionary, getExperimentCopy } from "@/lib/i18n";
import { getExperimentLesson, listDiscoveryMetadata } from "@/lib/lessons";
import type { LabSubject } from "@/lib/types";

export type DiscoveryParams = { subject?: string; grade?: string; stage?: string; q?: string; lesson?: string; from?: string };

export async function PublicLaboratories({ params, subjectPath }: { params: DiscoveryParams; subjectPath?: LabSubject }) {
  const [auth, locale] = await Promise.all([getCurrentSession(), getRequestLocale()]);
  const te = locale === "te-IN";
  const lang = te ? "te" : "en";
  const dict = getDictionary(locale);
  const grade = resolveEducationStage(params.stage ?? params.grade)?.grade;
  const subject = subjectPath ?? parseScienceSubject(params.subject);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const lessonId = typeof params.lesson === "string" ? params.lesson : "";
  const laboratoriesHref = grade ? `/laboratories?grade=${grade}` : "/laboratories";
  const stageLabel = grade ? formatStageLabel(grade, locale) : undefined;
  if (!subject) return <>
    <AppHeader auth={auth} locale={locale} />
    <main className="g1-public-shell g1-libraries g1-premium g1-subject-chooser" id="main-content">
      <GlassBack href="/" label={te ? "ముఖపుటకు తిరిగి" : "Back to home"} />
      <header className="g1-public-heading g1-catalog-heading g1-chooser-banner">
        <h1>{stageLabel ?? (te ? "మీ సైన్స్ ప్రయోగశాలను ఎంచుకోండి" : "Choose your science laboratory.")}</h1>
        <p>{te ? "ప్రయోగాలను చూడటానికి ఒక విషయాన్ని ఎంచుకోండి." : "Choose a subject to explore its practicals."}</p>
      </header>
      <ScienceDestinations locale={locale} grade={grade} fixedClass={Boolean(grade)} />
    </main>
  </>;

  const fixedClass = Boolean(grade && params.from === "class");
  const [items, mappings] = await Promise.all([listCatalogExperiments(), listDiscoveryMetadata()]);
  const published = items.filter(item => item.publishedAt && item.publicationStatus !== "review_pending");
  const listings = published.flatMap(item => {
    const rows = mappings.filter(row => row.experiment_id === item.experimentId && row.content_version === item.contentVersion);
    const mapped = rows.length ? rows : [undefined];
    return mapped.map(meta => ({ item, meta, grade: meta?.grade ?? item.grade, lesson: getExperimentLesson(item, locale, meta) }));
  });
  const availableLessons = listings.flatMap(({ item, grade, lesson }) =>
    lesson && item.subject === subject ? [{ ...lesson, grade }] : []);
  const matches = listings.flatMap(({ item, meta, grade: mappedGrade, lesson }) => {
    const copy = getExperimentCopy(item.experimentId, locale, item.subject);
    const title = meta?.experiment_title?.[lang] ?? copy.shortTitle;
    const summary = meta?.description?.[lang] ?? copy.subtitle;
    const english = getExperimentCopy(item.experimentId, "en-IN", item.subject);
    const telugu = getExperimentCopy(item.experimentId, "te-IN", item.subject);
    const terms = [item.experimentId, item.title, title, summary, meta?.keywords, meta?.experiment_title?.te,
      english.shortTitle, telugu.shortTitle, getExperimentLesson(item, "en-IN", meta)?.title,
      getExperimentLesson(item, "te-IN", meta)?.title, lesson?.activity]
      .filter(Boolean).join(" ").toLocaleLowerCase();
    const matchesQuery = q.toLocaleLowerCase().split(/\s+/).every(term => terms.includes(term));
    return (!grade || mappedGrade === grade) && (!subject || item.subject === subject) &&
      (!lessonId || lesson?.id === lessonId) && matchesQuery ? [{ item, copy, lesson, meta, title, summary, grade: mappedGrade }] : [];
  }).sort((a, b) => a.grade - b.grade || (a.lesson?.order ?? 9999) - (b.lesson?.order ?? 9999) ||
    (a.lesson?.activity ?? a.item.experimentId).localeCompare(b.lesson?.activity ?? b.item.experimentId, locale, { numeric: true }));

  const groups = new Map<string, typeof matches>();
  for (const result of matches) {
    const key = [result.grade, result.item.subject, result.lesson?.id ?? ""].join(":");
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }
  return (
    <>
      <AppHeader auth={auth} locale={locale} />
      <main className="g1-public-shell g1-libraries g1-premium" id="main-content" data-subject={subject}>
        <GlassBack href={fixedClass ? laboratoriesHref : "/"} label={fixedClass
          ? (te ? "తరగతి విషయాలకు తిరిగి" : "Back to class subjects")
          : (te ? "ముఖపుటకు తిరిగి" : "Back to home")} />
        <header className="g1-public-heading g1-catalog-heading g1-subject-banner">
          {stageLabel && <p className="g1-catalog-stage">{stageLabel}</p>}
          <h1>{dict.subjects[subject].name}</h1>
          <p>{dict.subjects[subject].shortDesc}</p>
        </header>
        <DiscoveryFilters key={[grade, subject, q, lessonId, fixedClass].join(":")} locale={locale}
          lessons={availableLessons} subject={subject} fixedClass={fixedClass}
          initial={{ grade: grade ? String(grade) : "", q, lesson: lessonId }} />
          <section className="g1-public-section" aria-labelledby="discover-results">
            <h2 className="g1-section-title" id="discover-results">{te ? "అందుబాటులో ఉన్న ప్రయోగాలు" : "Available practicals"}</h2>
            {matches.length === 0 ? (
              <div className="g1-card g1-welcome">
                <BookOpen size={26} aria-hidden="true" />
                <h3>{te ? "ఈ ఎంపికకు ప్రయోగాలు లేవు" : "No published practicals match"}</h3>
                <p>{te ? "మరో తరగతి లేదా విషయాన్ని ఎంచుకోండి." : "Try a different lesson or search term, or browse another subject."}</p>
                <Link className="g1-text-link" href={fixedClass ? laboratoriesHref : "/laboratories"}>{te ? "అన్ని విషయాలు చూడండి" : "Browse subjects"}</Link>
              </div>
            ) : <div className="g1-result-groups">{Array.from(groups, ([key, rows]) => (
              <section className="g1-lesson-group" key={key}>
                <h3>{formatStageLabel(rows[0].grade, locale)} · {rows[0].lesson?.title ?? dict.subjects[rows[0].item.subject].name}</h3>
                <div className="g1-results-grid">
                  {rows.map(({ item, copy, lesson, meta, title, summary }) => (
                    <article className="g1-card g1-result-card" key={item.experimentId} data-subject={item.subject}>
                      <Image src={meta?.thumbnail_id ? "/api/media/" + meta.thumbnail_id : copy.thumbPath}
                        width={600} height={344} alt={meta?.thumbnail_alt?.[lang] ?? copy.mediaQualifier} className="g1-result-image" />
                      <div>
                        <p className="g1-result-meta">{lesson ? (te ? "కృత్యం " : "Activity ") + lesson.activity : copy.activityLabel} · {dict.subjects[item.subject].name}</p>
                        <h4>{title}</h4>
                        <p>{summary}</p>
                        <div className="g1-result-modes">
                          <span className="g1-tag g1-tag-blue">{te ? "సిమ్యులేషన్ మోడ్" : "Simulation Mode"}</span>
                          <span className="g1-tag g1-tag-green">{meta?.has_journey
                            ? (te ? "సిమ్యులేషన్ తర్వాత ఎక్స్‌పెరిమెంట్" : "Experiment after Simulation")
                            : (te ? "ఎక్స్‌పెరిమెంట్ మోడ్" : "Experiment Mode")}</span>
                        </div>
                        <Link className="g1-text-link g1-result-link"
                          aria-label={(te ? "ప్రయోగం చూడండి: " : "View experiment: ") + title}
                          href={"/experiments/" + encodeURIComponent(item.experimentId) + "?" + experimentReturnParams({
                            browseGrade: grade ? String(grade) : undefined, from: fixedClass ? "class" : undefined,
                            browseLesson: lessonId, browseQuery: q, lesson: lesson && meta && !meta.is_primary ? lesson.id : undefined,
                          })}>
                          {te ? "ప్రయోగం చూడండి" : "View experiment"} <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}</div>}
          </section>
        {!fixedClass && <section className="g1-public-section" aria-labelledby="browse-subjects">
          <h2 className="g1-section-title" id="browse-subjects">{te ? "విషయాల వారీగా ప్రయోగశాలలు" : "Laboratories by subject"}</h2>
          <ScienceDestinations locale={locale} grade={grade} current={subject} />
        </section>}
      </main>

    </>
  );
}
