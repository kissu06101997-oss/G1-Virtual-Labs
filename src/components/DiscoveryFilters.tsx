"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { FluidSelect } from "./FluidSelect";
import { subjectCatalogueHref } from "@/lib/lab-discovery";
import { EDUCATION_STAGES, formatStageLabel } from "@/lib/education-stages";
import { getDictionary } from "@/lib/i18n";
import type { LabSubject, Locale } from "@/lib/types";

interface FilterProps {
  locale: Locale;
  subject: LabSubject;
  fixedClass: boolean;
  initial: { grade: string; lesson: string; q: string };
  lessons: Array<{ id: string; title: string; grade: number; order: number }>;
}

export function DiscoveryFilters({ locale, initial, lessons, subject, fixedClass }: FilterProps) {
  const te = locale === "te-IN";
  const dict = getDictionary(locale);
  const [grade, setGrade] = useState(initial.grade);
  const [lesson, setLesson] = useState(initial.lesson);
  const matchingLessons = lessons.filter(row => !grade || String(row.grade) === grade);
  const lessonOptions = Array.from(new Map(matchingLessons.map(option => [option.id, option])).values())
    .sort((a, b) => a.grade - b.grade || a.order - b.order);
  const selectedLesson = lessonOptions.some(option => option.id === lesson) ? lesson : "";
  const allLessons = te ? "అన్ని పాఠాలు" : "All lessons";
  const noLessons = te ? "పాఠాలు అందుబాటులో లేవు" : "No lessons available";

  return (
    <form className="g1-discovery-form" role="search" aria-label={te ? "ప్రయోగాల కోసం వెతకండి" : "Search experiments"} action={subjectCatalogueHref(subject)}>
      {fixedClass && <>
        <input type="hidden" name="from" value="class" />
        <input type="hidden" name="grade" value={initial.grade} />
      </>}
      <label className="g1-discovery-search">
        <span>{te ? "ప్రయోగాల కోసం వెతకండి" : "Search experiments"}</span>
        <span className="g1-search-field">
          <Search size={18} aria-hidden="true" />
          <input type="search" name="q" maxLength={120} defaultValue={initial.q}
            placeholder={te ? "పేరు, కృత్యం లేదా పాఠం" : "Name, activity or lesson"} />
        </span>
      </label>
      {fixedClass ? <div className="g1-discovery-context">
        <span>{te ? "తరగతి" : "Class"}</span>
        <strong data-testid="fixed-class">{formatStageLabel(Number(initial.grade), locale)}</strong>
      </div> : <FluidSelect name="grade" label={te ? "తరగతి" : "Class"} value={grade}
        onChange={value => { setGrade(value); setLesson(""); }} options={[
          { value: "", label: te ? "అన్ని తరగతులు" : "All classes" },
          ...EDUCATION_STAGES.map(stage => ({ value: String(stage.grade), label: te ? stage.labelTe : stage.labelEn })),
        ]} />}
      <div className="g1-discovery-context">
        <span>{te ? "విషయం" : "Subject"}</span>
        <strong data-testid="fixed-subject">{dict.subjects[subject].name}</strong>
      </div>
      <FluidSelect name="lesson" label={te ? "పాఠం" : "Lesson"} value={selectedLesson}
        onChange={setLesson} disabled={!lessonOptions.length} options={[
          { value: "", label: lessonOptions.length ? allLessons : noLessons },
          ...lessonOptions.map(option => ({ value: option.id, label: option.title })),
        ]} />
      <div className="g1-discovery-actions">
        <button className="g1-btn g1-btn-teal">{te ? "వెతకండి" : "Search"}</button>
        <Link className="g1-text-link" href={subjectCatalogueHref(subject, fixedClass ? Number(initial.grade) : undefined, fixedClass)}>{te ? "ఫిల్టర్‌లు తొలగించండి" : "Clear filters"}</Link>
      </div>
    </form>
  );
}
