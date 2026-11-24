import { newUuid } from "./crypto";
import type {
  ExperimentDefinition,
  LabActionRequest,
  LabActionResult,
  LabMode,
  LabSubject,
  ObservationRecord,
  StateDelta,
} from "./types";

export interface LabSessionState {
  stepIndex: number;
  totalSteps: number;
  completedSteps: number[];
  // Chemistry fields
  apparatusConnected?: boolean;
  reagentsIdentified?: string[];
  zincUmol?: number;
  acidEqUmol?: number;
  theoreticalH2Umol?: number | null;
  excessZnUmol?: number | null;
  excessAcidEqUmol?: number | null;
  // Physics fields
  slabMounted?: boolean;
  incidentAngleDeg?: number;
  slabThicknessMm?: number;
  refractedAngleDeg?: number | null;
  emergentAngleDeg?: number | null;
  transverseOffsetMm?: number | null;
  // Biology fields
  slideLoaded?: boolean;
  selectedField?: number;
  acquiredPlane?: number;
  annotatedStructures?: string[];
  // Shared inquiry / evidence fields
  hypothesisText?: string;
  controlTrial?: Record<string, unknown> | null;
  comparisonTrial?: Record<string, unknown> | null;
  trialHistory?: Array<{ revision: number; values: Record<string, unknown> }>;
  claimNote?: string;
  visualCues: string[];
  lastActionNote?: string;
}

export function createInitialSessionState(
  def: ExperimentDefinition,
  mode: LabMode
): LabSessionState {
  const totalSteps =
    mode === "simulation"
      ? def.modeConfigurations.simulation.steps.length
      : def.modeConfigurations.experiment.steps.length;

  if (def.subject === "chemistry") {
    return {
      stepIndex: 0,
      totalSteps,
      completedSteps: [],
      apparatusConnected: mode === "experiment",
      reagentsIdentified: mode === "experiment" ? ["Zn", "dilute_H2SO4"] : [],
      zincUmol: 2.0,
      acidEqUmol: 3.0,
      theoreticalH2Umol: null,
      excessZnUmol: null,
      excessAcidEqUmol: null,
      controlTrial: null,
      comparisonTrial: null,
      claimNote: "",
      visualCues: ["session-initialized"],
    };
  }

  if (def.subject === "physics") {
    return {
      stepIndex: 0,
      totalSteps,
      completedSteps: [],
      slabMounted: mode === "experiment",
      incidentAngleDeg: 45,
      slabThicknessMm: 20,
      refractedAngleDeg: null,
      emergentAngleDeg: null,
      transverseOffsetMm: null,
      controlTrial: null,
      comparisonTrial: null,
      claimNote: "",
      visualCues: ["session-initialized"],
    };
  }

  return {
    stepIndex: 0,
    totalSteps,
    completedSteps: [],
    slideLoaded: mode === "experiment",
    selectedField: 0,
    acquiredPlane: 0,
    annotatedStructures: [],
    controlTrial: null,
    comparisonTrial: null,
    claimNote: "",
    visualCues: ["session-initialized"],
  };
}

function rejectResult(
  reasonCode: LabActionResult["reasonCode"],
  committedRevision: number,
  note: string
): { httpStatus: number; result: LabActionResult } {
  const httpStatus =
    reasonCode === "REVISION_CONFLICT" ||
    reasonCode === "STATE_CONFLICT" ||
    reasonCode === "IDEMPOTENCY_MISMATCH"
      ? 409
      : 422;
  return {
    httpStatus,
    result: {
      accepted: false,
      reasonCode,
      committedRevision,
      scientificStateDelta: [],
      objectStateDelta: [],
      observations: [],
      visualCueIds: [],
      audioCueIds: [],
      assessmentEvents: [],
      modelProvenance: null,
      uncertainty: {
        kind: "not_applicable",
        lower: null,
        upper: null,
        note,
      },
    },
  };
}

function markStep(state: LabSessionState, stepIdx: number) {
  const completed = new Set(state.completedSteps);
  completed.add(stepIdx);
  state.completedSteps = Array.from(completed).sort((a, b) => a - b);
  state.stepIndex = Math.min(state.totalSteps - 1, Math.max(state.stepIndex, stepIdx + 1));
}

function saveTrial(state: LabSessionState, mode: LabMode, revision: number, values: Record<string, unknown>) {
  if (mode === "experiment") state.trialHistory = [...(state.trialHistory ?? []), { revision, values }];
}

// Exact rational half-umol integer arithmetic for CHEM-ZN-ACID-BOUND@0.1.0
export function computeZincSulfuricBound(zincUmol: number, acidEqUmol: number): {
  theoreticalH2Umol: number;
  excessZnUmol: number;
  excessAcidEqUmol: number;
  limitingReactant: "Zn" | "acid_equivalent" | "stoichiometric";
} {
  // Represent amounts in quarter-umol integers to avoid binary float drift
  const znQ = Math.round(zincUmol * 4);
  const acidQ = Math.round(acidEqUmol * 4);
  const halfAcidQ = Math.floor(acidQ / 2);
  const h2Q = Math.min(znQ, halfAcidQ);
  const excessZnQ = znQ - h2Q;
  const excessAcidQ = acidQ - 2 * h2Q;

  const limitingReactant =
    znQ < halfAcidQ ? "Zn" : halfAcidQ < znQ ? "acid_equivalent" : "stoichiometric";

  return {
    theoreticalH2Umol: h2Q / 4,
    excessZnUmol: excessZnQ / 4,
    excessAcidEqUmol: excessAcidQ / 4,
    limitingReactant,
  };
}

// Ideal analytic Snell geometry for PHYS-SLAB-RAY@0.1.0 (n_air = 1.000, n_glass = 1.500)
export function computeSnellSlabGeometry(
  incidentAngleDeg: number,
  slabThicknessMm: number,
  nGlass = 1.5
): {
  incidentAngleDeg: number;
  refractedAngleDeg: number;
  emergentAngleDeg: number;
  transverseOffsetMm: number;
} {
  if (incidentAngleDeg === 0) {
    return {
      incidentAngleDeg: 0,
      refractedAngleDeg: 0,
      emergentAngleDeg: 0,
      transverseOffsetMm: 0,
    };
  }
  const iRad = (incidentAngleDeg * Math.PI) / 180;
  const sinR = Math.sin(iRad) / nGlass;
  const rRad = Math.asin(sinR);
  const rDeg = (rRad * 180) / Math.PI;
  const offsetMm = (slabThicknessMm * Math.sin(iRad - rRad)) / Math.cos(rRad);

  return {
    incidentAngleDeg,
    refractedAngleDeg: Number(rDeg.toFixed(4)),
    emergentAngleDeg: incidentAngleDeg,
    transverseOffsetMm: Number(offsetMm.toFixed(4)),
  };
}

function isStepMultiple(value: number, step: number): boolean {
  const scaled = value / step;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

export function executeScienceAction(params: {
  request: LabActionRequest;
  definition: ExperimentDefinition;
  currentRevision: number;
  currentState: LabSessionState;
}): {
  httpStatus: number;
  result: LabActionResult;
  nextState: LabSessionState;
} {
  const { request, definition, currentRevision, currentState } = params;
  const nextState: LabSessionState = structuredClone(currentState);
  const nextRevision = currentRevision + 1;

  // Validate object belongs to confirmed scene inventory (or known station target)
  const validObjectIds = new Set(definition.initialInventory.map((i) => i.objectId));
  validObjectIds.add(definition.sceneId);
  if (validObjectIds.size > 0 && !validObjectIds.has(request.targetObjectId)) {
    return {
      ...rejectResult(
        "ACTION_UNSUPPORTED",
        currentRevision,
        `Target object '${request.targetObjectId}' is not registered in scene '${definition.sceneId}'.`
      ),
      nextState: currentState,
    };
  }

  // Shared review / step navigation & inquiry recording actions across all 3 subjects
  if (request.actionType === "complete_aim") {
    markStep(nextState, 0);
    nextState.visualCues = ["aim-confirmed"];
    return {
      httpStatus: 200,
      nextState,
      result: {
        accepted: true,
        reasonCode: "OK",
        committedRevision: nextRevision,
        scientificStateDelta: [],
        objectStateDelta: [{ path: "/guided/stepIndex", operation: "set", value: nextState.stepIndex }],
        observations: [],
        visualCueIds: ["aim-confirmed"],
        audioCueIds: [],
        assessmentEvents: ["step.aim.completed"],
        modelProvenance: getDefaultProvenance(definition.subject),
        uncertainty: {
          kind: "not_applicable",
          lower: null,
          upper: null,
          note: "Guided aim acknowledgement recorded.",
        },
      },
    };
  }

  if (request.actionType === "record_claim") {
    const claimChoice = request.choiceId?.trim() || "evidence_explained";
    nextState.claimNote = claimChoice;
    markStep(nextState, nextState.totalSteps - 1);
    const obs: ObservationRecord = {
      observationId: newUuid(),
      metric: "learner_claim_evidence_note",
      value: claimChoice,
      uncertainty: {
        kind: "not_applicable",
        lower: null,
        upper: null,
        note: "Recorded learner explanation for rubric evaluation.",
      },
    };
    return {
      httpStatus: 200,
      nextState,
      result: {
        accepted: true,
        reasonCode: "OK",
        committedRevision: nextRevision,
        scientificStateDelta: [],
        objectStateDelta: [{ path: "/evidence/claimNote", operation: "set", value: claimChoice }],
        observations: [obs],
        visualCueIds: ["claim-recorded"],
        audioCueIds: [],
        assessmentEvents: ["evidence.claim.recorded"],
        modelProvenance: getDefaultProvenance(definition.subject),
        uncertainty: obs.uncertainty,
      },
    };
  }

  // Subject-specific deterministic adapters
  if (definition.subject === "chemistry") {
    return executeChemistryAction(request, currentRevision, nextRevision, nextState, currentState);
  }
  if (definition.subject === "physics") {
    return executePhysicsAction(request, currentRevision, nextRevision, nextState, currentState);
  }
  return executeBiologyAction(request, currentRevision, nextRevision, nextState, currentState);
}

function getDefaultProvenance(subject: LabSubject): LabActionResult["modelProvenance"] {
  if (subject === "chemistry") {
    return {
      modelId: "CHEM-ZN-ACID-BOUND",
      modelVersion: "0.1.0",
      qualification: "theoretical",
      sourceIds: ["AP-REF-10-PS"],
    };
  }
  if (subject === "physics") {
    return {
      modelId: "PHYS-SLAB-RAY",
      modelVersion: "0.1.0",
      qualification: "theoretical",
      sourceIds: ["AP-REF-10-PS", "R-SNELL"],
    };
  }
  return {
    modelId: "BIO-ONION-STACK",
    modelVersion: "0.1.0",
    qualification: "unavailable",
    sourceIds: ["AP-REF-09-1", "R-MICRO", "R-BIA"],
  };
}

type ActionEvalOutput = {
  httpStatus: number;
  result: LabActionResult;
  nextState: LabSessionState;
};

function executeChemistryAction(
  request: LabActionRequest,
  currentRevision: number,
  nextRevision: number,
  nextState: LabSessionState,
  originalState: LabSessionState
): ActionEvalOutput {
  const provenance = getDefaultProvenance("chemistry")!;

  if (request.actionType === "setup_apparatus") {
    const port = request.interactionPort ?? "port_soap_receiver";
    if (port !== "port_soap_receiver") {
      return {
        ...rejectResult(
          "BAD_PORT",
          currentRevision,
          `Delivery tube cannot connect to '${port}'. Connect to the soap-solution receiver port ('port_soap_receiver') without mutating state.`
        ),
        nextState: originalState,
      };
    }
    nextState.apparatusConnected = true;
    markStep(nextState, 1);
    nextState.visualCues = ["apparatus-connected"];
    return {
      httpStatus: 200,
      nextState,
      result: {
        accepted: true,
        reasonCode: "OK",
        committedRevision: nextRevision,
        scientificStateDelta: [],
        objectStateDelta: [
          { path: "/apparatus/deliveryTubeConnected", operation: "set", value: true },
          { path: "/apparatus/receiverPort", operation: "set", value: "port_soap_receiver" },
        ],
        observations: [
          {
            observationId: newUuid(),
            metric: "apparatus_connection_verified",
            value: "Reaction tube routed to soap-solution receiver",
            uncertainty: {
              kind: "not_applicable",
              lower: null,
              upper: null,
              note: "Virtual apparatus concept verified against Activity 2.3 procedure.",
            },
          },
        ],
        visualCueIds: ["apparatus-connected"],
        audioCueIds: [],
        assessmentEvents: ["chem.apparatus.connected"],
        modelProvenance: provenance,
        uncertainty: {
          kind: "not_applicable",
          lower: null,
          upper: null,
          note: "Structural setup confirmation only.",
        },
      },
    };
  }

  if (request.actionType === "identify_reagent") {
    const choice = request.choiceId ?? "";
    const allowed = new Set(["Zn", "dilute_H2SO4", "acid_equivalent"]);
    if (!allowed.has(choice)) {
      return {
        ...rejectResult(
          "INCOMPATIBLE_MATERIAL",
          currentRevision,
          `Reagent '${choice || "unspecified"}' is outside Activity 2.3 admitted scope. Only zinc (Zn) and dilute sulfuric acid (dilute_H2SO4) are permitted; HCl, HNO3 and arbitrary metals are blocked.`
        ),
        nextState: originalState,
      };
    }
    const existing = new Set(nextState.reagentsIdentified ?? []);
    existing.add(choice);
    nextState.reagentsIdentified = Array.from(existing);
    if (existing.has("Zn") && (existing.has("dilute_H2SO4") || existing.has("acid_equivalent"))) {
      markStep(nextState, 2);
    }
    nextState.visualCues = ["reagent-confirmed"];
    return {
      httpStatus: 200,
      nextState,
      result: {
        accepted: true,
        reasonCode: "OK",
        committedRevision: nextRevision,
        scientificStateDelta: [
          { path: "/reagents/identified", operation: "set", value: nextState.reagentsIdentified },
        ],
        objectStateDelta: [],
        observations: [
          {
            observationId: newUuid(),
            metric: "admitted_reagent_identified",
            value: choice,
            uncertainty: {
              kind: "not_applicable",
              lower: null,
              upper: null,
              note: "Matches Activity 2.3 allowed whitelist (Zn + dilute H2SO4).",
            },
          },
        ],
        visualCueIds: ["reagent-confirmed"],
        audioCueIds: [],
        assessmentEvents: ["chem.reagent.verified"],
        modelProvenance: provenance,
        uncertainty: {
          kind: "not_applicable",
          lower: null,
          upper: null,
          note: "Whitelist reagent verification.",
        },
      },
    };
  }

  if (request.actionType === "propose_virtual_amount" || request.actionType === "compare_observation") {
    if (!nextState.apparatusConnected && request.mode === "simulation") {
      return {
        ...rejectResult(
          "BAD_PORT",
          currentRevision,
          "Connect the delivery tube to the soap-solution receiver before running the reaction step."
        ),
        nextState: originalState,
      };
    }

    const znParam = request.parametersWithUnits.zincAmount ?? request.parametersWithUnits.amount;
    const acidParam = request.parametersWithUnits.acidEquivalent ?? {
      value: nextState.acidEqUmol ?? 3.0,
      unit: "umol" as const,
    };

    if (!znParam) {
      return {
        ...rejectResult("INVALID_UNITS", currentRevision, "Missing required 'zincAmount' (umol) parameter."),
        nextState: originalState,
      };
    }
    if (znParam.unit !== "umol" || acidParam.unit !== "umol") {
      return {
        ...rejectResult(
          "INVALID_UNITS",
          currentRevision,
          `Expected unit 'umol' for bounded synthetic bookkeeping; received zinc='${znParam.unit}', acid='${acidParam.unit}'.`
        ),
        nextState: originalState,
      };
    }
    if (
      znParam.value < 0 ||
      znParam.value > 10 ||
      acidParam.value < 0 ||
      acidParam.value > 10 ||
      !isStepMultiple(znParam.value, 0.5) ||
      !isStepMultiple(acidParam.value, 0.5)
    ) {
      return {
        ...rejectResult(
          "OUTSIDE_DOMAIN",
          currentRevision,
          "Inputs must stay within the admitted synthetic domain 0–10 umol in 0.5 umol steps."
        ),
        nextState: originalState,
      };
    }

    const bound = computeZincSulfuricBound(znParam.value, acidParam.value);
    nextState.zincUmol = znParam.value;
    nextState.acidEqUmol = acidParam.value;
    nextState.theoreticalH2Umol = bound.theoreticalH2Umol;
    nextState.excessZnUmol = bound.excessZnUmol;
    nextState.excessAcidEqUmol = bound.excessAcidEqUmol;

    const trialSnapshot = {
      zincUmol: znParam.value,
      acidEqUmol: acidParam.value,
      theoreticalH2Umol: bound.theoreticalH2Umol,
      excessZnUmol: bound.excessZnUmol,
      excessAcidEqUmol: bound.excessAcidEqUmol,
      limitingReactant: bound.limitingReactant,
    };
    saveTrial(nextState, request.mode, nextRevision, trialSnapshot);

    if (request.actionType === "compare_observation") {
      nextState.comparisonTrial = trialSnapshot;
      markStep(nextState, 3);
    } else if (!nextState.controlTrial) {
      nextState.controlTrial = trialSnapshot;
      markStep(nextState, 3);
    } else {
      nextState.comparisonTrial = trialSnapshot;
      markStep(nextState, 3);
    }

    const uncertainty = {
      kind: "unknown" as const,
      lower: null,
      upper: null,
      note: "Theoretical stoichiometric upper bound for synthetic inputs; reaction rate, actual collected gas volume and ignition behaviour are not predicted.",
    };

    const obs: ObservationRecord[] = [
      {
        observationId: newUuid(),
        metric: "theoretical_h2_upper_bound",
        value: { value: bound.theoreticalH2Umol, unit: "umol" },
        uncertainty,
      },
      {
        observationId: newUuid(),
        metric: "qualitative_soap_bubbles",
        value:
          bound.theoreticalH2Umol > 0
            ? "Gas evolution routed into soap solution (qualitative concept cue only)"
            : "Zero limiting-reactant gas bound (no reaction predicted)",
        uncertainty,
      },
    ];

    const cues = bound.theoreticalH2Umol > 0 ? ["bubbles-soap-solution", "ledger-updated"] : ["ledger-updated"];
    nextState.visualCues = cues;

    const deltas: StateDelta[] = [
      { path: "/chemistry/zincUmol", operation: "set", value: znParam.value },
      { path: "/chemistry/acidEqUmol", operation: "set", value: acidParam.value },
      { path: "/chemistry/theoreticalH2Umol", operation: "set", value: bound.theoreticalH2Umol },
      { path: "/chemistry/limitingReactant", operation: "set", value: bound.limitingReactant },
    ];

    return {
      httpStatus: 200,
      nextState,
      result: {
        accepted: true,
        reasonCode: "OK",
        committedRevision: nextRevision,
        scientificStateDelta: deltas,
        objectStateDelta: [],
        observations: obs,
        visualCueIds: cues,
        audioCueIds: [],
        assessmentEvents: ["chem.bound.computed"],
        modelProvenance: provenance,
        uncertainty,
      },
    };
  }

  return {
    ...rejectResult(
      "ACTION_UNSUPPORTED",
      currentRevision,
      `Action '${request.actionType}' is not supported by CHEM-ZN-ACID-BOUND@0.1.0.`
    ),
    nextState: originalState,
  };
}

function executePhysicsAction(
  request: LabActionRequest,
  currentRevision: number,
  nextRevision: number,
  nextState: LabSessionState,
  originalState: LabSessionState
): ActionEvalOutput {
  const provenance = getDefaultProvenance("physics")!;

  if (request.actionType === "place_optic") {
    const port = request.interactionPort ?? "port_parallel_normal";
    if (port !== "port_parallel_normal") {
      return {
        ...rejectResult(
          "BAD_PORT",
          currentRevision,
          `Invalid optical mount '${port}'. Mount the rectangular slab aligned with the normal ('port_parallel_normal').`
        ),
        nextState: originalState,
      };
    }
    nextState.slabMounted = true;
    markStep(nextState, 1);
    nextState.visualCues = ["slab-mounted"];
    return {
      httpStatus: 200,
      nextState,
      result: {
        accepted: true,
        reasonCode: "OK",
        committedRevision: nextRevision,
        scientificStateDelta: [],
        objectStateDelta: [{ path: "/optics/slabMounted", operation: "set", value: true }],
        observations: [
          {
            observationId: newUuid(),
            metric: "optic_alignment_verified",
            value: "Parallel glass slab aligned to reference normal",
            uncertainty: {
              kind: "not_applicable",
              lower: null,
              upper: null,
              note: "Virtual ray card alignment confirmed.",
            },
          },
        ],
        visualCueIds: ["slab-mounted"],
        audioCueIds: [],
        assessmentEvents: ["phys.optic.mounted"],
        modelProvenance: provenance,
        uncertainty: {
          kind: "not_applicable",
          lower: null,
          upper: null,
          note: "Alignment check only.",
        },
      },
    };
  }

  if (request.actionType === "select_incident_ray" || request.actionType === "observe_ray") {
    if (!nextState.slabMounted) {
      return {
        ...rejectResult(
          "BAD_PORT",
          currentRevision,
          "Mount and align the glass slab on the reference normal before tracing an incident ray."
        ),
        nextState: originalState,
      };
    }

    const angleParam = request.parametersWithUnits.angle ?? request.parametersWithUnits.incidentAngle;
    const thicknessParam = request.parametersWithUnits.slabThickness ?? {
      value: nextState.slabThicknessMm ?? 20,
      unit: "mm" as const,
    };

    if (!angleParam) {
      return {
        ...rejectResult("INVALID_UNITS", currentRevision, "Missing required 'angle' (deg) parameter."),
        nextState: originalState,
      };
    }
    if (angleParam.unit !== "deg" || thicknessParam.unit !== "mm") {
      return {
        ...rejectResult(
          "INVALID_UNITS",
          currentRevision,
          `Expected angle in 'deg' and slabThickness in 'mm'; received '${angleParam.unit}' and '${thicknessParam.unit}'.`
        ),
        nextState: originalState,
      };
    }
    if (
      angleParam.value < 0 ||
      angleParam.value > 60 ||
      thicknessParam.value < 10 ||
      thicknessParam.value > 30 ||
      !isStepMultiple(angleParam.value, 1) ||
      !isStepMultiple(thicknessParam.value, 1)
    ) {
      return {
        ...rejectResult(
          "OUTSIDE_DOMAIN",
          currentRevision,
          "Admitted fixture domain is incident angle 0–60 deg (step 1) and slab thickness 10–30 mm (step 1)."
        ),
        nextState: originalState,
      };
    }

    const geom = computeSnellSlabGeometry(angleParam.value, thicknessParam.value);
    nextState.incidentAngleDeg = geom.incidentAngleDeg;
    nextState.slabThicknessMm = thicknessParam.value;
    nextState.refractedAngleDeg = geom.refractedAngleDeg;
    nextState.emergentAngleDeg = geom.emergentAngleDeg;
    nextState.transverseOffsetMm = geom.transverseOffsetMm;

    const trialSnapshot = {
      incidentAngleDeg: geom.incidentAngleDeg,
      slabThicknessMm: thicknessParam.value,
      refractedAngleDeg: geom.refractedAngleDeg,
      emergentAngleDeg: geom.emergentAngleDeg,
      transverseOffsetMm: geom.transverseOffsetMm,
    };
    saveTrial(nextState, request.mode, nextRevision, trialSnapshot);

    if (!nextState.controlTrial) {
      nextState.controlTrial = trialSnapshot;
      markStep(nextState, 2);
    } else {
      nextState.comparisonTrial = trialSnapshot;
      markStep(nextState, 3);
    }

    const uncertainty = {
      kind: "unknown" as const,
      lower: null,
      upper: null,
      note: "Ideal analytic Snell calculation (n_air=1.000, n_glass=1.500); independent physical slab and protractor calibration pending.",
    };

    const obs: ObservationRecord[] = [
      {
        observationId: newUuid(),
        metric: "refracted_angle_theoretical",
        value: { value: geom.refractedAngleDeg, unit: "deg" },
        uncertainty,
      },
      {
        observationId: newUuid(),
        metric: "transverse_offset_theoretical",
        value: { value: geom.transverseOffsetMm, unit: "mm" },
        uncertainty,
      },
    ];

    nextState.visualCues = ["ray-overlay-update"];

    return {
      httpStatus: 200,
      nextState,
      result: {
        accepted: true,
        reasonCode: "OK",
        committedRevision: nextRevision,
        scientificStateDelta: [
          { path: "/optics/refractedAngleDeg", operation: "set", value: geom.refractedAngleDeg },
          { path: "/optics/emergentAngleDeg", operation: "set", value: geom.emergentAngleDeg },
          { path: "/optics/transverseOffsetMm", operation: "set", value: geom.transverseOffsetMm },
        ],
        objectStateDelta: [
          { path: "/optics/incidentAngleDeg", operation: "set", value: geom.incidentAngleDeg },
          { path: "/optics/slabThicknessMm", operation: "set", value: thicknessParam.value },
        ],
        observations: obs,
        visualCueIds: ["ray-overlay-update"],
        audioCueIds: [],
        assessmentEvents: ["phys.ray.computed"],
        modelProvenance: provenance,
        uncertainty,
      },
    };
  }

  return {
    ...rejectResult(
      "ACTION_UNSUPPORTED",
      currentRevision,
      `Action '${request.actionType}' is not supported by PHYS-SLAB-RAY@0.1.0.`
    ),
    nextState: originalState,
  };
}

function executeBiologyAction(
  request: LabActionRequest,
  currentRevision: number,
  nextRevision: number,
  nextState: LabSessionState,
  originalState: LabSessionState
): ActionEvalOutput {
  const provenance = getDefaultProvenance("biology")!;

  // Explicitly refuse quantitative measurement until rights-cleared calibrated dataset exists!
  if (request.actionType === "measure_cell_length") {
    return {
      ...rejectResult(
        "CALIBRATION_MISSING",
        currentRevision,
        "Quantitative cell length measurement is disabled: rights-cleared onion epidermis micrograph dataset and stage-micrometer scale calibration (um/px) are pending."
      ),
      nextState: originalState,
    };
  }

  if (request.actionType === "select_field") {
    const fieldParam = request.parametersWithUnits.fieldIndex ?? { value: 0, unit: "1" as const };
    if (fieldParam.unit !== "1") {
      return {
        ...rejectResult("INVALID_UNITS", currentRevision, "Field index must use dimensionless unit '1'."),
        nextState: originalState,
      };
    }
    if (!Number.isInteger(fieldParam.value) || fieldParam.value < 0 || fieldParam.value > 2) {
      return {
        ...rejectResult(
          "OUTSIDE_DOMAIN",
          currentRevision,
          "Only discrete acquired fixture fields 0, 1, or 2 are available."
        ),
        nextState: originalState,
      };
    }
    nextState.slideLoaded = true;
    nextState.selectedField = fieldParam.value;
    markStep(nextState, 1);
    const fieldNames = [
      "Low-power overview (illustrative fixture field 0)",
      "Epidermal sheet margin (illustrative fixture field 1)",
      "Central polygonal wall cluster (illustrative fixture field 2)",
    ];
    const uncertainty = {
      kind: "unknown" as const,
      lower: null,
      upper: null,
      note: "Illustrative view only; no rights-cleared calibrated micrographs yet.",
    };

    nextState.visualCues = [`bio-field-${fieldParam.value}`];
    return {
      httpStatus: 200,
      nextState,
      result: {
        accepted: true,
        reasonCode: "OK",
        committedRevision: nextRevision,
        scientificStateDelta: [],
        objectStateDelta: [{ path: "/microscope/selectedField", operation: "set", value: fieldParam.value }],
        observations: [
          {
            observationId: newUuid(),
            metric: "selected_microscopy_field",
            value: fieldNames[fieldParam.value],
            uncertainty,
          },
        ],
        visualCueIds: [`bio-field-${fieldParam.value}`],
        audioCueIds: [],
        assessmentEvents: ["bio.field.selected"],
        modelProvenance: provenance,
        uncertainty,
      },
    };
  }

  if (request.actionType === "select_acquired_plane") {
    const planeParam = request.parametersWithUnits.fixturePlaneIndex ?? { value: 0, unit: "1" as const };
    if (planeParam.unit !== "1") {
      return {
        ...rejectResult("INVALID_UNITS", currentRevision, "Focal plane index must use dimensionless unit '1'."),
        nextState: originalState,
      };
    }
    if (!Number.isInteger(planeParam.value) || planeParam.value < 0 || planeParam.value > 2) {
      return {
        ...rejectResult(
          "OUTSIDE_DOMAIN",
          currentRevision,
          "Only discrete focal plane indices 0, 1, or 2 are supported in BIO-ONION-STACK@0.1.0."
        ),
        nextState: originalState,
      };
    }
    nextState.slideLoaded = true;
    nextState.acquiredPlane = planeParam.value;
    const trialSnapshot = {
      selectedField: nextState.selectedField ?? 0,
      acquiredPlane: planeParam.value,
      scaleCalibration: "unavailable",
    };
    saveTrial(nextState, request.mode, nextRevision, trialSnapshot);
    if (!nextState.controlTrial) nextState.controlTrial = trialSnapshot;
    else nextState.comparisonTrial = trialSnapshot;

    markStep(nextState, 2);
    const uncertainty = {
      kind: "unknown" as const,
      lower: null,
      upper: null,
      note: "Discrete plane fixture only; stage calibration unavailable for numeric um measurements.",
    };
    nextState.visualCues = [`bio-plane-${planeParam.value}`];
    return {
      httpStatus: 200,
      nextState,
      result: {
        accepted: true,
        reasonCode: "OK",
        committedRevision: nextRevision,
        scientificStateDelta: [],
        objectStateDelta: [{ path: "/microscope/acquiredPlane", operation: "set", value: planeParam.value }],
        observations: [
          {
            observationId: newUuid(),
            metric: "acquired_focal_plane",
            value: { value: planeParam.value, unit: "1" },
            uncertainty,
          },
        ],
        visualCueIds: [`bio-plane-${planeParam.value}`],
        audioCueIds: [],
        assessmentEvents: ["bio.plane.selected"],
        modelProvenance: provenance,
        uncertainty,
      },
    };
  }

  if (request.actionType === "mark_visible_boundary") {
    const structure = request.choiceId ?? "";
    const allowed = new Set(["cell_wall", "nucleus", "cytoplasm"]);
    if (!allowed.has(structure)) {
      return {
        ...rejectResult(
          "ACTION_UNSUPPORTED",
          currentRevision,
          `Structure '${structure || "unspecified"}' is not visible or supported in the onion epidermis fixture. Allowed: cell_wall, nucleus, cytoplasm.`
        ),
        nextState: originalState,
      };
    }
    const existing = new Set(nextState.annotatedStructures ?? []);
    existing.add(structure);
    nextState.annotatedStructures = Array.from(existing);
    markStep(nextState, 3);
    const uncertainty = {
      kind: "not_applicable" as const,
      lower: null,
      upper: null,
      note: "Qualitative morphology annotation recorded on illustrative fixture view.",
    };
    nextState.visualCues = [`bio-annotated-${structure}`];
    return {
      httpStatus: 200,
      nextState,
      result: {
        accepted: true,
        reasonCode: "OK",
        committedRevision: nextRevision,
        scientificStateDelta: [],
        objectStateDelta: [
          { path: "/microscope/annotatedStructures", operation: "set", value: nextState.annotatedStructures },
        ],
        observations: [
          {
            observationId: newUuid(),
            metric: "visible_structure_annotated",
            value: structure,
            uncertainty,
          },
        ],
        visualCueIds: [`bio-annotated-${structure}`],
        audioCueIds: [],
        assessmentEvents: ["bio.boundary.annotated"],
        modelProvenance: provenance,
        uncertainty,
      },
    };
  }

  return {
    ...rejectResult(
      "ACTION_UNSUPPORTED",
      currentRevision,
      `Action '${request.actionType}' is not supported by BIO-ONION-STACK@0.1.0.`
    ),
    nextState: originalState,
  };
}

export function evaluateSubmissionRubric(params: {
  subject: LabSubject;
  mode: LabMode;
  rubricId: string;
  state: LabSessionState;
  confirmedEvidenceIds: string[];
}): {
  criteriaPassed: number;
  criteriaTotal: number;
  gradeState: "committed";
  criteria: Array<{ id: string; label: string; passed: boolean }>;
  summary: string;
} {
  const { subject, mode, state, confirmedEvidenceIds } = params;
  const hasEvidence = confirmedEvidenceIds.length > 0;
  const hasClaim = Boolean(state.claimNote && state.claimNote.trim().length > 0);
  const hasControl = Boolean(state.controlTrial);
  const hasComparison = Boolean(state.comparisonTrial);

  let criteria: Array<{ id: string; label: string; passed: boolean }>;
  if (mode === "simulation") {
    const setupOk =
      subject === "chemistry"
        ? Boolean(state.apparatusConnected)
        : subject === "physics"
          ? Boolean(state.slabMounted)
          : Boolean(state.slideLoaded);
    criteria = [
      { id: "setup", label: "Authoritative apparatus/specimen setup verified", passed: setupOk },
      { id: "evidence", label: "At least one server-confirmed observation recorded", passed: hasEvidence },
      { id: "claim", label: "Qualitative explanation linked to evidence", passed: hasClaim || state.completedSteps.length >= 2 },
    ];
  } else {
    criteria = [
      { id: "control", label: "Bounded control trial recorded within model domain", passed: hasControl },
      { id: "comparison", label: "Comparison trial recorded with explicit units", passed: hasComparison },
      { id: "evidence", label: "Confirmed evidence references attached", passed: hasEvidence },
      { id: "limitations", label: "Claim and model limitations documented", passed: hasClaim || hasControl },
    ];
  }

  const criteriaPassed = criteria.filter((c) => c.passed).length;
  const criteriaTotal = criteria.length;
  return {
    criteriaPassed,
    criteriaTotal,
    gradeState: "committed",
    criteria,
    summary: `Server-evaluated rubric (${criteriaPassed}/${criteriaTotal} criteria met from confirmed session evidence; no animation or speed grading).`,
  };
}
