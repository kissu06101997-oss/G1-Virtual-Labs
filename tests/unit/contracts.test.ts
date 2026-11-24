import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { createInitialSessionState, executeScienceAction } from "@/lib/science-adapters";
import type { ExperimentDefinition } from "@/lib/types";

function loadJson(relPath: string) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8"));
}

describe("JSON Schema Draft 2020-12 Contract Verification", () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);

  const expSchema = loadJson("specs/experiment_definition.schema.json");
  const actionSchema = loadJson("specs/lab_action.schema.json");
  const launchSchema = loadJson("specs/launch_and_event.schema.json");
  const scienceModelSchema = loadJson("specs/science_model_contract.schema.json");

  it("validates science_models.json against science_model_contract.schema.json", () => {
    const validate = ajv.compile(scienceModelSchema);
    const models = loadJson("specs/science_models.json");
    for (const model of models) {
      const ok = validate(model);
      expect(ok, JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it("validates accepted and rejected LabActionResult outputs against lab_action.schema.json", () => {
    const validateResult = ajv.compile({
      ...actionSchema,
      $ref: "#/$defs/result",
    });

    const sampleExp: ExperimentDefinition = loadJson(
      "project-brief/AI_Virtual_Labs_Labster_REA_Research_2026-11/specs/example_physics_experiment.json"
    );
    const validateExp = ajv.compile(expSchema);
    expect(validateExp(sampleExp), JSON.stringify(validateExp.errors)).toBe(true);

    const state = createInitialSessionState(sampleExp, "experiment");
    const accepted = executeScienceAction({
      definition: sampleExp,
      currentRevision: 4,
      currentState: state,
      request: {
        sessionId: "5c55a6fc-533f-44bf-b08b-ed61c639f0b0",
        labId: "physics",
        experimentId: "AP-PHYS-10-9.10",
        mode: "experiment",
        actorId: "6eecb0b3-d889-4256-8f68-89d1df20b368",
        targetObjectId: "phys.glass-slab:1",
        actionType: "select_incident_ray",
        parametersWithUnits: { angle: { value: 45, unit: "deg" } },
        expectedRevision: 4,
      },
    });
    expect(validateResult(accepted.result), JSON.stringify(validateResult.errors)).toBe(true);

    const rejected = executeScienceAction({
      definition: sampleExp,
      currentRevision: 4,
      currentState: state,
      request: {
        sessionId: "5c55a6fc-533f-44bf-b08b-ed61c639f0b0",
        labId: "physics",
        experimentId: "AP-PHYS-10-9.10",
        mode: "experiment",
        actorId: "6eecb0b3-d889-4256-8f68-89d1df20b368",
        targetObjectId: "phys.glass-slab:1",
        actionType: "select_incident_ray",
        parametersWithUnits: { angle: { value: 85, unit: "deg" } },
        expectedRevision: 4,
      },
    });
    expect(validateResult(rejected.result), JSON.stringify(validateResult.errors)).toBe(true);
  });

  it("validates launch schema structure", () => {
    const validateLaunch = ajv.compile({
      ...launchSchema,
      $ref: "#/$defs/launch",
    });
    const ok = validateLaunch({
      launchToken: "abcdefghijklmnopqrstuvwxyz0123456789",
      studentPseudonym: "84ac5fb7-d0f3-4c62-807a-fe4b07a5feb9",
      labId: "chemistry",
      experimentId: "AP-CHEM-10-2.3",
      mode: "simulation",
      attemptId: "66dfa156-986a-48c7-b520-44f3732c9d96",
      manifestSha256: "a".repeat(64),
      engineAbi: "lab@1",
      expiresAt: "2026-11-22T12:00:00Z",
      locale: "te-IN",
    });
    expect(ok, JSON.stringify(validateLaunch.errors)).toBe(true);
  });
});
