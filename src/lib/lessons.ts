import { query } from "./db";
import type { CatalogItem, LabSubject, Locale } from "./types";

export interface DiscoveryMetadata {
  experiment_id: string;
  content_version: string;
  lesson_id: string;
  title_en: string;
  title_te: string;
  curriculum_order: number;
  activity_number: string;
  subject: LabSubject;
  grade: number;
  experiment_title: { en: string; te: string } | null;
  description: { en: string; te: string } | null;
  thumbnail_id: string | null;
  thumbnail_alt: { en: string; te: string } | null;
  keywords: string | null;
  has_journey: boolean;
  is_primary: boolean;
}

export async function listDiscoveryMetadata() {
  const result = await query<DiscoveryMetadata>(`SELECT el.experiment_id, el.content_version, el.lesson_id,
    l.title_en, l.title_te, l.curriculum_order, el.activity_number, el.subject, el.grade,
    lv.content->'title' AS experiment_title, lv.content->'description' AS description,
    lv.content->>'thumbnailId' AS thumbnail_id, lv.content->'thumbnailAlt' AS thumbnail_alt,
    lv.content->>'keywords' AS keywords, lv.content IS NOT NULL AS has_journey, el.is_primary
    FROM experiment_lesson el
    JOIN experiment_version ev USING (experiment_id, content_version)
    JOIN lab_lesson l ON l.lesson_id = el.lesson_id
    LEFT JOIN learning_version lv USING (experiment_id, content_version)
    WHERE ev.published_at IS NOT NULL AND ev.retired_at IS NULL AND l.published_at IS NOT NULL
    ORDER BY el.is_primary DESC, el.grade, l.curriculum_order, el.lesson_id`);
  return result.rows;
}

// The three existing launchable fixtures are mapped to their documented source chapters.
// Source: project-brief/AI_Virtual_Labs_Labster_REA_Research_2026-11/data/ap_experiment_catalog.csv
const legacyLessons: Record<string, { id: string; en: string; te: string; order: number; activity: string }> = {
  "AP-CHEM-10-2.3": { id: "acids-bases-salts", en: "Acids, bases and salts", te: "ఆమ్లాలు, క్షారాలు మరియు లవణాలు", order: 2, activity: "2.3" },
  "AP-BIO-09-5.1": { id: "fundamental-unit-of-life", en: "The fundamental unit of life", te: "జీవం యొక్క ప్రాథమిక ప్రమాణం", order: 5, activity: "5.1" },
  "AP-PHYS-10-9.10": { id: "light-reflection-refraction", en: "Light reflection and refraction", te: "కాంతి పరావర్తనం మరియు వక్రీభవనం", order: 9, activity: "9.10" },
};

export function getExperimentLesson(exp: Pick<CatalogItem, "experimentId">, locale: Locale, meta?: DiscoveryMetadata) {
  if (meta) return { id: meta.lesson_id, title: locale === "te-IN" ? meta.title_te : meta.title_en,
    order: meta.curriculum_order, activity: meta.activity_number };
  const lesson = legacyLessons[exp.experimentId];
  return lesson ? { id: lesson.id, title: locale === "te-IN" ? lesson.te : lesson.en, order: lesson.order, activity: lesson.activity } : null;
}
