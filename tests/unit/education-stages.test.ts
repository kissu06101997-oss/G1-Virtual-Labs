import { describe, expect, it } from "vitest";
import {
  EDUCATION_STAGES,
  formatStageLabel,
  resolveEducationStage,
} from "../../src/lib/education-stages";

describe("Seven-level education stage mapping (Classes 6–10 & Intermediate 1st/2nd Year)", () => {
  it("defines all 7 canonical education levels in exact sequence", () => {
    expect(EDUCATION_STAGES).toHaveLength(7);
    expect(EDUCATION_STAGES.map((s) => s.id)).toEqual([
      "class-6",
      "class-7",
      "class-8",
      "class-9",
      "class-10",
      "intermediate-1",
      "intermediate-2",
    ]);
    expect(EDUCATION_STAGES.map((s) => s.grade)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it("resolves both numeric grade params and slug stage IDs cleanly", () => {
    expect(resolveEducationStage("6")?.id).toBe("class-6");
    expect(resolveEducationStage("class-10")?.grade).toBe(10);
    expect(resolveEducationStage("11")?.id).toBe("intermediate-1");
    expect(resolveEducationStage("intermediate-2")?.grade).toBe(12);
    expect(resolveEducationStage("all")).toBeNull();
    expect(resolveEducationStage("99")).toBeNull();
  });

  it("formats accurate bilingual English and Telugu stage labels", () => {
    expect(formatStageLabel(10, "en-IN")).toBe("Class 10");
    expect(formatStageLabel(10, "te-IN")).toBe("10వ తరగతి");
    expect(formatStageLabel(11, "en-IN")).toBe("Intermediate 1st Year");
    expect(formatStageLabel(11, "en-IN", true)).toBe("Inter 1st Year");
    expect(formatStageLabel(11, "te-IN")).toBe("ఇంటర్మీడియట్ 1వ సంవత్సరం");
    expect(formatStageLabel(12, "en-IN")).toBe("Intermediate 2nd Year");
    expect(formatStageLabel(12, "te-IN")).toBe("ఇంటర్మీడియట్ 2వ సంవత్సరం");
  });

  it("keeps unpublished levels honestly labeled as under_review or preview_only", () => {
    expect(resolveEducationStage("class-6")?.availability).toBe("under_review");
    expect(resolveEducationStage("class-7")?.availability).toBe("under_review");
    expect(resolveEducationStage("class-8")?.availability).toBe("preview_only");
    expect(resolveEducationStage("class-9")?.availability).toBe("available");
    expect(resolveEducationStage("class-10")?.availability).toBe("available");
    expect(resolveEducationStage("intermediate-1")?.availability).toBe("under_review");
    expect(resolveEducationStage("intermediate-2")?.availability).toBe("under_review");
  });
});
