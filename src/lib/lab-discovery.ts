import { resolveEducationStage } from "./education-stages";
import type { LabSubject } from "./types";

export function subjectCatalogueHref(subject: LabSubject, grade?: number, fixedClass = false) {
  const query = new URLSearchParams();
  if (grade) query.set("grade", String(grade));
  if (grade && fixedClass) query.set("from", "class");
  return "/laboratories/" + subject + (query.size ? "?" + query : "");
}

export type ExperimentReturnContext = Partial<Record<"browseGrade" | "browseLesson" | "browseQuery" | "from" | "lesson", string>>;

export function experimentReturnParams(values: ExperimentReturnContext) {
  const params = new URLSearchParams();
  const stage = resolveEducationStage(values.browseGrade);
  if (stage) params.set("browseGrade", String(stage.grade));
  if (stage && values.from === "class") params.set("from", "class");
  for (const key of ["browseLesson", "browseQuery", "lesson"] as const) {
    if (typeof values[key] === "string" && values[key]) params.set(key, values[key].slice(0, 120));
  }
  return params;
}

export function experimentCatalogueHref(subject: LabSubject, values: ExperimentReturnContext) {
  const query = experimentReturnParams(values);
  const url = subjectCatalogueHref(subject, Number(query.get("browseGrade")), query.get("from") === "class");
  const filters = new URLSearchParams();
  if (query.has("browseLesson")) filters.set("lesson", query.get("browseLesson")!);
  if (query.has("browseQuery")) filters.set("q", query.get("browseQuery")!);
  return url + (filters.size ? (url.includes("?") ? "&" : "?") + filters : "");
}
