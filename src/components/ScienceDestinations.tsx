import { HomeSubjectCards } from "./HomeSubjectCards";
import { getDictionary } from "@/lib/i18n";
import type { LabSubject, Locale } from "@/lib/types";

export const scienceSubjects = ["chemistry", "physics", "biology"] as const;

export function ScienceDestinations({ locale, grade, current, fixedClass }: { locale: Locale; grade?: number; current?: LabSubject; fixedClass?: boolean }) {
  const dict = getDictionary(locale);
  return <HomeSubjectCards grade={grade} current={current} fixedClass={fixedClass} cards={scienceSubjects.map(subject => ({
    subject,
    title: dict.subjects[subject].name,
    description: dict.subjects[subject].shortDesc,
  }))} />;
}

export function parseScienceSubject(value?: string): LabSubject | undefined {
  return scienceSubjects.find(subject => subject === value);
}
