export type LabSubject = "chemistry" | "physics" | "biology";
export type LabMode = "simulation" | "experiment";
export type Locale = "en-IN" | "te-IN";

export type PrincipalRole =
  | "student"
  | "teacher"
  | "school_admin"
  | "district_admin"
  | "state_admin"
  | "content_editor"
  | "content_reviewer"
  | "creator"
  | "operator";

export type AllowedUnit =
  | "mol"
  | "umol"
  | "mL"
  | "g"
  | "mm"
  | "deg"
  | "um"
  | "px"
  | "1"
  | "K"
  | "Pa";

export type ReasonCode =
  | "OK"
  | "REVISION_CONFLICT"
  | "WRONG_MODE"
  | "NOT_AUTHORIZED"
  | "ACTION_UNSUPPORTED"
  | "MODEL_UNQUALIFIED"
  | "INVALID_UNITS"
  | "OUTSIDE_DOMAIN"
  | "BAD_PORT"
  | "CAPACITY_EXCEEDED"
  | "INCOMPATIBLE_MATERIAL"
  | "CALIBRATION_MISSING"
  | "IDEMPOTENCY_MISMATCH"
  | "STATE_CONFLICT"
  | "VERSION_MISMATCH"
  | "CANCELLED"
  | "PAYLOAD_TOO_LARGE"
  | "NOT_FOUND"
  | "SESSION_EXPIRED"
  | "RATE_LIMITED";

export interface Quantity {
  value: number;
  unit: AllowedUnit;
}

export interface ExperimentDefinition {
  experimentId: string;
  labId: LabSubject;
  subject: LabSubject;
  title: string;
  grade: number;
  curriculumReferences: Array<{
    sourceId: string;
    locator: string;
    editionStatus: string;
  }>;
  modeConfigurations: {
    simulation: {
      summary: string;
      actionTypes: string[];
      steps: string[];
      rubricId: string;
    };
    experiment: {
      summary: string;
      actionTypes: string[];
      steps: string[];
      rubricId: string;
    };
  };
  sceneId: string;
  requiredApparatus: string[];
  allowedSubstances: string[];
  initialInventory: Array<{
    objectId: string;
    materialId: string;
    quantity: Quantity;
  }>;
  supportedVariableRanges: Record<
    string,
    {
      min: number;
      max: number;
      step: number;
      unit: AllowedUnit;
      admission: "synthetic_fixture_only" | "pending_approval" | "reviewed";
    }
  >;
  scienceModelIds: string[];
  learningObjectives: string[];
  safetyRules: string[];
  assessmentIds: string[];
  contentVersion: string;
  publicationStatus: "research_fixture" | "review_pending" | "approved";
  datasetIds: string[];
}

export interface CatalogItem extends ExperimentDefinition {
  manifestSha256: string;
  engineAbi: string;
  publishedAt: string | null;
  retiredAt: string | null;
}

export interface UncertaintyInfo {
  kind: "known" | "interval" | "unknown" | "not_applicable";
  lower: number | null;
  upper: number | null;
  note: string;
}

export interface ModelProvenance {
  modelId: string;
  modelVersion: string;
  qualification: "synthetic" | "theoretical" | "empirical" | "unavailable";
  sourceIds: string[];
  modelDigest?: string;
  datasetDigest?: string;
}

export interface StateDelta {
  path: string;
  operation: "set" | "remove";
  value: unknown;
}

export interface ObservationRecord {
  observationId: string;
  metric: string;
  value: Quantity | string | null;
  uncertainty: UncertaintyInfo;
}

export interface LabActionRequest {
  sessionId: string;
  labId: LabSubject;
  experimentId: string;
  mode: LabMode;
  actorId: string;
  targetObjectId: string;
  actionType: string;
  parametersWithUnits: Record<string, Quantity>;
  expectedRevision: number;
  receiverObjectId?: string;
  interactionPort?: string;
  reservationId?: string;
  choiceId?: string;
}

export interface LabActionResult {
  accepted: boolean;
  reasonCode: ReasonCode;
  committedRevision: number;
  scientificStateDelta: StateDelta[];
  objectStateDelta: StateDelta[];
  observations: ObservationRecord[];
  visualCueIds: string[];
  audioCueIds: string[];
  assessmentEvents: string[];
  modelProvenance: ModelProvenance | null;
  uncertainty: UncertaintyInfo;
}

export interface SessionContract {
  sessionId: string;
  attemptId: string;
  revision: number;
  labId: LabSubject;
  experimentId: string;
  mode: LabMode;
  contentVersion: string;
  manifestSha256: string;
  engineAbi: string;
  status: "active" | "paused" | "submitted" | "revoked";
  checkpoint: {
    revision: number;
    stateSha256: string;
    snapshotPath: string;
  };
  savedAt: string;
}

export interface AssessmentContract {
  submissionId: string;
  attemptId: string;
  gradeState: "pending_review" | "committed" | "rejected";
  rubricId: string;
  evidenceIds: string[];
}

export interface AuthContext {
  principalId: string;
  email: string;
  displayName: string;
  role: PrincipalRole;
  schoolId: string | null;
  schoolName: string | null;
  districtId: string | null;
  districtName: string | null;
  learnerId: string | null;
  preferredLocale: Locale;
  csrfToken: string;
  isSynthetic: boolean;
}
