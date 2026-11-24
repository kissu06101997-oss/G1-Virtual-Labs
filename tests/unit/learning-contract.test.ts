import { expect, test } from "vitest";
import { emptyCreatorDraft, trustedLabManifestSchema } from "../../src/lib/creator-contract";
import { assessmentQuestion, stageSubmission } from "../../src/lib/learning-contract";

const translated = (en: string, te: string) => ({ en, te });

test("assessment contract requires exactly five answer slots and exactly four distinct options", () => {
  const empty = emptyCreatorDraft();
  expect(empty.learning.questions).toHaveLength(5);
  expect(empty.learning.questions.every(question => question.options.length === 4)).toBe(true);
  expect(stageSubmission.safeParse({ stage: 5, answers: [0, 1, 2, 3] }).success).toBe(false);
  expect(stageSubmission.safeParse({ stage: 5, answers: [0, 1, 2, 3, 3] }).success).toBe(true);
  const options = [translated("Red", "ఎరుపు"), translated("Blue", "నీలం"), translated("Green", "ఆకుపచ్చ"), translated("White", "తెలుపు")];
  const question = { prompt: translated("Which colour?", "ఏ రంగు?"), options, correct: 1,
    feedback: translated("Compare the labels.", "లేబుల్‌లను పోల్చండి.") };
  expect(assessmentQuestion.safeParse(question).success).toBe(true);
  expect(assessmentQuestion.safeParse({ ...question, correct: 4 }).success).toBe(false);
  expect(assessmentQuestion.safeParse({ ...question, options: [options[0], ...options.slice(0, 3)] }).success).toBe(false);
});

test("registered lab manifests name both typed mode entrypoints", () => {
  const manifest = {
    engine: "physics", engineAbi: "lab@1", sourceExperimentId: "AP-PHYS-10-9.10", sourceVersion: "0.1.0-research",
    simulationEntry: "guided-player@1", experimentEntry: "inquiry-player@1", manifestSha256: "1".repeat(64),
  };
  expect(trustedLabManifestSchema.safeParse(manifest).success).toBe(true);
  expect(trustedLabManifestSchema.safeParse({ ...manifest, experimentEntry: manifest.simulationEntry }).success).toBe(false);
});
