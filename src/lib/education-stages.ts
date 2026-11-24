import type { Locale } from "./types";

export type EducationStageId =
  | "class-6"
  | "class-7"
  | "class-8"
  | "class-9"
  | "class-10"
  | "intermediate-1"
  | "intermediate-2";

export interface EducationStageSpec {
  id: EducationStageId;
  grade: number;
  labelEn: string;
  shortLabelEn: string;
  labelTe: string;
  shortLabelTe: string;
  boardBandEn: string;
  boardBandTe: string;
  subjectStructureEn: string;
  subjectStructureTe: string;
  availability: "available" | "preview_only" | "under_review";
  statusNoteEn: string;
  statusNoteTe: string;
}

export const EDUCATION_STAGES: readonly EducationStageSpec[] = [
  {
    id: "class-6",
    grade: 6,
    labelEn: "Class 6",
    shortLabelEn: "Class 6",
    labelTe: "6వ తరగతి",
    shortLabelTe: "6వ తరగతి",
    boardBandEn: "AP SCERT Upper Primary",
    boardBandTe: "AP SCERT ప్రాథమికోన్నత పాఠశాల",
    subjectStructureEn: "General Science (Chemistry, Physics & Biology foundations)",
    subjectStructureTe: "సామాన్య శాస్త్రం (రసాయన, భౌతిక, జీవ శాస్త్ర ప్రాథమికాలు)",
    availability: "under_review",
    statusNoteEn: "Under AP SCERT curriculum & safety review — no approved virtual practicals published yet.",
    statusNoteTe: "AP SCERT పాఠ్యప్రణాళిక మరియు భద్రతా సమీక్షలో ఉంది — ఇంకా ఆమోదించబడిన ప్రయోగాలు ప్రచురించబడలేదు.",
  },
  {
    id: "class-7",
    grade: 7,
    labelEn: "Class 7",
    shortLabelEn: "Class 7",
    labelTe: "7వ తరగతి",
    shortLabelTe: "7వ తరగతి",
    boardBandEn: "AP SCERT Upper Primary",
    boardBandTe: "AP SCERT ప్రాథమికోన్నత పాఠశాల",
    subjectStructureEn: "General Science (Chemistry, Physics & Biology foundations)",
    subjectStructureTe: "సామాన్య శాస్త్రం (రసాయన, భౌతిక, జీవ శాస్త్ర ప్రాథమికాలు)",
    availability: "under_review",
    statusNoteEn: "Under AP SCERT curriculum & safety review — no approved virtual practicals published yet.",
    statusNoteTe: "AP SCERT పాఠ్యప్రణాళిక మరియు భద్రతా సమీక్షలో ఉంది — ఇంకా ఆమోదించబడిన ప్రయోగాలు ప్రచురించబడలేదు.",
  },
  {
    id: "class-8",
    grade: 8,
    labelEn: "Class 8",
    shortLabelEn: "Class 8",
    labelTe: "8వ తరగతి",
    shortLabelTe: "8వ తరగతి",
    boardBandEn: "AP SCERT High School",
    boardBandTe: "AP SCERT ఉన్నత పాఠశాల",
    subjectStructureEn: "Physical Science (Chemistry & Physics) · Biological Science",
    subjectStructureTe: "భౌతిక రసాయన శాస్త్రం · జీవ శాస్త్రం",
    availability: "preview_only",
    statusNoteEn: "1 review-pending Biology preview (AP-BIO-08-2.1) catalogued; interactive launch remains locked until two-person sign-off.",
    statusNoteTe: "1 జీవ శాస్త్ర సమీక్ష-పెండింగ్ ప్రివ్యూ (AP-BIO-08-2.1) ఉంది; ఇద్దరు సమీక్షకుల ఆమోదం తర్వాత ప్రయోగం అందుబాటులోకి వస్తుంది.",
  },
  {
    id: "class-9",
    grade: 9,
    labelEn: "Class 9",
    shortLabelEn: "Class 9",
    labelTe: "9వ తరగతి",
    shortLabelTe: "9వ తరగతి",
    boardBandEn: "AP SCERT High School",
    boardBandTe: "AP SCERT ఉన్నత పాఠశాల",
    subjectStructureEn: "Physical Science (Chemistry & Physics) · Biological Science",
    subjectStructureTe: "భౌతిక రసాయన శాస్త్రం · జీవ శాస్త్రం",
    availability: "available",
    statusNoteEn: "1 launchable Biology activity (AP-BIO-09-5.1 Onion Epidermis) available in Simulation & Experiment Modes.",
    statusNoteTe: "1 ప్రారంభించగల జీవ శాస్త్ర ప్రయోగం (AP-BIO-09-5.1 ఉల్లిపాయ పొర) సిమ్యులేషన్ & ఎక్స్‌పెరిమెంట్ మోడ్‌లలో అందుబాటులో ఉంది.",
  },
  {
    id: "class-10",
    grade: 10,
    labelEn: "Class 10",
    shortLabelEn: "Class 10",
    labelTe: "10వ తరగతి",
    shortLabelTe: "10వ తరగతి",
    boardBandEn: "AP SCERT Secondary (SSC)",
    boardBandTe: "AP SCERT పదవ తరగతి (SSC)",
    subjectStructureEn: "Physical Science (Chemistry & Physics) · Biological Science",
    subjectStructureTe: "భౌతిక రసాయన శాస్త్రం · జీవ శాస్త్రం",
    availability: "available",
    statusNoteEn: "2 launchable Chemistry & Physics practicals (AP-CHEM-10-2.3, AP-PHYS-10-9.10) + 2 review-pending previews available.",
    statusNoteTe: "2 ప్రారంభించగల రసాయన, భౌతిక శాస్త్ర ప్రయోగాలు + 2 సమీక్ష-పెండింగ్ ప్రివ్యూలు అందుబాటులో ఉన్నాయి.",
  },
  {
    id: "intermediate-1",
    grade: 11,
    labelEn: "Intermediate 1st Year",
    shortLabelEn: "Inter 1st Year",
    labelTe: "ఇంటర్మీడియట్ 1వ సంవత్సరం",
    shortLabelTe: "ఇంటర్ 1వ సం.",
    boardBandEn: "BIEAP Junior Intermediate",
    boardBandTe: "BIEAP జూనియర్ ఇంటర్మీడియట్",
    subjectStructureEn: "Chemistry · Physics · Biology (Botany & Zoology)",
    subjectStructureTe: "రసాయన శాస్త్రం · భౌతిక శాస్త్రం · జీవ శాస్త్రం (వృక్ష, జంతు శాస్త్రాలు)",
    availability: "under_review",
    statusNoteEn: "BIEAP Intermediate 1st Year practical candidates are under scientific model & rights review.",
    statusNoteTe: "BIEAP ఇంటర్మీడియట్ 1వ సంవత్సరం ప్రయోగాలు శాస్త్రీయ నమూనా మరియు హక్కుల సమీక్షలో ఉన్నాయి.",
  },
  {
    id: "intermediate-2",
    grade: 12,
    labelEn: "Intermediate 2nd Year",
    shortLabelEn: "Inter 2nd Year",
    labelTe: "ఇంటర్మీడియట్ 2వ సంవత్సరం",
    shortLabelTe: "ఇంటర్ 2వ సం.",
    boardBandEn: "BIEAP Senior Intermediate",
    boardBandTe: "BIEAP సీనియర్ ఇంటర్మీడియట్",
    subjectStructureEn: "Chemistry · Physics · Biology (Botany & Zoology)",
    subjectStructureTe: "రసాయన శాస్త్రం · భౌతిక శాస్త్రం · జీవ శాస్త్రం (వృక్ష, జంతు శాస్త్రాలు)",
    availability: "under_review",
    statusNoteEn: "BIEAP Intermediate 2nd Year practical candidates are under scientific model & rights review.",
    statusNoteTe: "BIEAP ఇంటర్మీడియట్ 2వ సంవత్సరం ప్రయోగాలు శాస్త్రీయ నమూనా మరియు హక్కుల సమీక్షలో ఉన్నాయి.",
  },
] as const;

export function getEducationStageByGrade(grade: number | null | undefined): EducationStageSpec | null {
  if (grade === null || grade === undefined) return null;
  return EDUCATION_STAGES.find((s) => s.grade === grade) ?? null;
}

export function getEducationStageById(id: string | null | undefined): EducationStageSpec | null {
  if (!id) return null;
  return EDUCATION_STAGES.find((s) => s.id === id) ?? null;
}

export function resolveEducationStage(param: string | number | null | undefined): EducationStageSpec | null {
  if (typeof param === "number") return getEducationStageByGrade(param);
  if (typeof param !== "string" || param === "" || param === "all") return null;
  const trimmed = param.trim().toLowerCase();
  const byId = getEducationStageById(trimmed);
  if (byId) return byId;
  const num = Number(trimmed);
  if (Number.isInteger(num)) return getEducationStageByGrade(num);
  return null;
}

export function formatStageLabel(grade: number, locale: Locale, short = false): string {
  const stage = getEducationStageByGrade(grade);
  if (!stage) {
    return locale === "te-IN" ? `${grade}వ తరగతి` : `Class ${grade}`;
  }
  if (locale === "te-IN") {
    return short ? stage.shortLabelTe : stage.labelTe;
  }
  return short ? stage.shortLabelEn : stage.labelEn;
}
