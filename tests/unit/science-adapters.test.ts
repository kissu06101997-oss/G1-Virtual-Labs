import { describe, expect, it } from "vitest";
import {
  computeSnellSlabGeometry,
  computeZincSulfuricBound,
  createInitialSessionState,
  evaluateSubmissionRubric,
  executeScienceAction,
} from "@/lib/science-adapters";
import { normalizeResearchNull } from "@/lib/catalog";
import type { ExperimentDefinition } from "@/lib/types";

const chemDef: ExperimentDefinition = {
  experimentId: "AP-CHEM-10-2.3",
  labId: "chemistry",
  subject: "chemistry",
  title: "Reaction of zinc with dilute sulfuric acid",
  grade: 10,
  curriculumReferences: [{ sourceId: "AP-REF-10-PS", locator: "Activity 2.3", editionStatus: "Pending" }],
  modeConfigurations: {
    simulation: { summary: "Guided", actionTypes: ["setup_apparatus", "identify_reagent", "propose_virtual_amount"], steps: ["Aim", "Setup", "Reactants", "Observe", "Explain"], rubricId: "CHE-GUIDED@1" },
    experiment: { summary: "Inquiry", actionTypes: ["identify_reagent", "propose_virtual_amount", "compare_observation"], steps: ["Hypothesize", "Compare", "Explain"], rubricId: "CHE-INQUIRY@1" },
  },
  sceneId: "room-chemistry@1",
  requiredApparatus: ["chem.reaction-tube", "chem.transfer"],
  allowedSubstances: ["Zn", "acid_equivalent"],
  initialInventory: [
    { objectId: "chem.reaction-tube:1", materialId: "chem.reaction-tube", quantity: { value: 1, unit: "1" } },
    { objectId: "chem.transfer:1", materialId: "chem.transfer", quantity: { value: 1, unit: "1" } },
  ],
  supportedVariableRanges: {
    amount: { min: 0, max: 10, step: 0.5, unit: "umol", admission: "synthetic_fixture_only" },
  },
  scienceModelIds: ["CHEM-ZN-ACID-BOUND@0.1.0"],
  learningObjectives: ["Compare ideal bound with qualitative observation"],
  safetyRules: ["Virtual only"],
  assessmentIds: ["CHE-GUIDED@1", "CHE-INQUIRY@1"],
  contentVersion: "0.1.0-research",
  publicationStatus: "research_fixture",
  datasetIds: [],
};

const physDef: ExperimentDefinition = {
  ...chemDef,
  experimentId: "AP-PHYS-10-9.10",
  labId: "physics",
  subject: "physics",
  title: "Refraction in a parallel glass slab",
  sceneId: "room-physics@1",
  initialInventory: [
    { objectId: "phys.glass-slab:1", materialId: "phys.glass-slab", quantity: { value: 1, unit: "1" } },
  ],
  scienceModelIds: ["PHYS-SLAB-RAY@0.1.0"],
};

const bioDef: ExperimentDefinition = {
  ...chemDef,
  experimentId: "AP-BIO-09-5.1",
  labId: "biology",
  subject: "biology",
  grade: 9,
  title: "Onion epidermis through a compound microscope",
  sceneId: "room-biology@1",
  initialInventory: [
    { objectId: "bio.prepared-onion-slide:1", materialId: "bio.prepared-onion-slide", quantity: { value: 1, unit: "1" } },
    { objectId: "bio.compound-microscope:1", materialId: "bio.compound-microscope", quantity: { value: 1, unit: "1" } },
    { objectId: "bio.image-view:1", materialId: "bio.image-view", quantity: { value: 1, unit: "1" } },
    { objectId: "bio.scale-overlay:1", materialId: "bio.scale-overlay", quantity: { value: 1, unit: "1" } },
  ],
  scienceModelIds: ["BIO-ONION-STACK@0.1.0"],
};

describe("Chemistry CHEM-ZN-ACID-BOUND@0.1.0", () => {
  it("computes exact rational stoichiometric upper bounds for research golden fixtures", () => {
    // 2 umol Zn + 3 umol H+ -> min(2, 1.5) = 1.5 umol H2, 0.5 umol excess Zn
    expect(computeZincSulfuricBound(2, 3)).toEqual({
      theoreticalH2Umol: 1.5,
      excessZnUmol: 0.5,
      excessAcidEqUmol: 0,
      limitingReactant: "acid_equivalent",
    });

    // 2 umol Zn + 5 umol H+ -> min(2, 2.5) = 2 umol H2, 1 umol excess H+
    expect(computeZincSulfuricBound(2, 5)).toEqual({
      theoreticalH2Umol: 2,
      excessZnUmol: 0,
      excessAcidEqUmol: 1,
      limitingReactant: "Zn",
    });
  });

  it("rejects HCl or HNO3 substitution with 422 INCOMPATIBLE_MATERIAL and zero mutation", () => {
    const state = createInitialSessionState(chemDef, "simulation");
    const out = executeScienceAction({
      definition: chemDef,
      currentRevision: 1,
      currentState: state,
      request: {
        sessionId: "5c55a6fc-533f-44bf-b08b-ed61c639f0b0",
        labId: "chemistry",
        experimentId: "AP-CHEM-10-2.3",
        mode: "simulation",
        actorId: "6eecb0b3-d889-4256-8f68-89d1df20b368",
        targetObjectId: "chem.reaction-tube:1",
        actionType: "identify_reagent",
        choiceId: "HCl",
        parametersWithUnits: {},
        expectedRevision: 1,
      },
    });
    expect(out.httpStatus).toBe(422);
    expect(out.result.accepted).toBe(false);
    expect(out.result.reasonCode).toBe("INCOMPATIBLE_MATERIAL");
    expect(out.result.committedRevision).toBe(1);
    expect(out.result.scientificStateDelta).toHaveLength(0);
    expect(out.nextState).toEqual(state);
  });

  it("rejects bad port and out-of-domain units without mutating state", () => {
    const state = createInitialSessionState(chemDef, "experiment");
    const badPort = executeScienceAction({
      definition: chemDef,
      currentRevision: 2,
      currentState: state,
      request: {
        sessionId: "5c55a6fc-533f-44bf-b08b-ed61c639f0b0",
        labId: "chemistry",
        experimentId: "AP-CHEM-10-2.3",
        mode: "experiment",
        actorId: "6eecb0b3-d889-4256-8f68-89d1df20b368",
        targetObjectId: "chem.transfer:1",
        actionType: "setup_apparatus",
        interactionPort: "port_open_air",
        parametersWithUnits: {},
        expectedRevision: 2,
      },
    });
    expect(badPort.result.reasonCode).toBe("BAD_PORT");

    const badUnit = executeScienceAction({
      definition: chemDef,
      currentRevision: 2,
      currentState: state,
      request: {
        sessionId: "5c55a6fc-533f-44bf-b08b-ed61c639f0b0",
        labId: "chemistry",
        experimentId: "AP-CHEM-10-2.3",
        mode: "experiment",
        actorId: "6eecb0b3-d889-4256-8f68-89d1df20b368",
        targetObjectId: "chem.reaction-tube:1",
        actionType: "propose_virtual_amount",
        parametersWithUnits: {
          zincAmount: { value: 2, unit: "mL" },
        },
        expectedRevision: 2,
      },
    });
    expect(badUnit.result.reasonCode).toBe("INVALID_UNITS");
  });
});

describe("Physics PHYS-SLAB-RAY@0.1.0", () => {
  it("matches analytic Snell reference geometry at 45 deg and 0 deg", () => {
    const g45 = computeSnellSlabGeometry(45, 20, 1.5);
    expect(g45.refractedAngleDeg).toBeCloseTo(28.1255, 3);
    expect(g45.emergentAngleDeg).toBe(45);
    expect(g45.transverseOffsetMm).toBeCloseTo(6.5829, 3);

    const g0 = computeSnellSlabGeometry(0, 20, 1.5);
    expect(g0).toEqual({
      incidentAngleDeg: 0,
      refractedAngleDeg: 0,
      emergentAngleDeg: 0,
      transverseOffsetMm: 0,
    });
  });

  it("rejects out-of-domain incident angle > 60 deg", () => {
    const state = createInitialSessionState(physDef, "experiment");
    const out = executeScienceAction({
      definition: physDef,
      currentRevision: 0,
      currentState: state,
      request: {
        sessionId: "5c55a6fc-533f-44bf-b08b-ed61c639f0b0",
        labId: "physics",
        experimentId: "AP-PHYS-10-9.10",
        mode: "experiment",
        actorId: "6eecb0b3-d889-4256-8f68-89d1df20b368",
        targetObjectId: "phys.glass-slab:1",
        actionType: "select_incident_ray",
        parametersWithUnits: { angle: { value: 75, unit: "deg" } },
        expectedRevision: 0,
      },
    });
    expect(out.httpStatus).toBe(422);
    expect(out.result.reasonCode).toBe("OUTSIDE_DOMAIN");
  });
});

describe("Biology BIO-ONION-STACK@0.1.0", () => {
  it("blocks uncalibrated quantitative measurements with CALIBRATION_MISSING", () => {
    const state = createInitialSessionState(bioDef, "experiment");
    const out = executeScienceAction({
      definition: bioDef,
      currentRevision: 0,
      currentState: state,
      request: {
        sessionId: "5c55a6fc-533f-44bf-b08b-ed61c639f0b0",
        labId: "biology",
        experimentId: "AP-BIO-09-5.1",
        mode: "experiment",
        actorId: "6eecb0b3-d889-4256-8f68-89d1df20b368",
        targetObjectId: "bio.scale-overlay:1",
        actionType: "measure_cell_length",
        parametersWithUnits: { distance: { value: 100, unit: "px" } },
        expectedRevision: 0,
      },
    });
    expect(out.httpStatus).toBe(422);
    expect(out.result.reasonCode).toBe("CALIBRATION_MISSING");
  });
});

describe("Data hygiene & server rubric evaluator", () => {
  it("normalizes literal 'null' strings from REA CSV corpus into typed null", () => {
    expect(normalizeResearchNull("null")).toBeNull();
    expect(normalizeResearchNull(" NULL ")).toBeNull();
    expect(normalizeResearchNull("")).toBeNull();
    expect(normalizeResearchNull("Activity 2.3")).toBe("Activity 2.3");
  });

  it("evaluates rubric deterministically from confirmed evidence only", () => {
    const state = createInitialSessionState(chemDef, "simulation");
    state.apparatusConnected = true;
    state.claimNote = "supported_model_and_limits_verified";
    const ev = evaluateSubmissionRubric({
      subject: "chemistry",
      mode: "simulation",
      rubricId: "CHE-GUIDED@1",
      state,
      confirmedEvidenceIds: ["55000001-0000-4000-8000-000000000001"],
    });
    expect(ev.gradeState).toBe("committed");
    expect(ev.criteriaPassed).toBe(3);
    expect(ev.criteriaTotal).toBe(3);
  });
});
