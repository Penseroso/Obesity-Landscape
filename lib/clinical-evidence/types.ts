import type { RecordMetadata } from "@/domains/shared/lib/record-metadata";
import type { ComponentReference } from "@/domains/company-pipeline/lib/types";

/**
 * Canonical Clinical Evidence schema version. Earlier records require migration.
 *
 * Namespaced as `clinicalEvidenceSchemaVersion` (not a bare `schemaVersion`) because
 * this project separately versions the Company/Pipeline data shape as "Contract 1.1"
 * (ADR-0030) — a generic field name here could be misread as versioning that whole
 * registry contract rather than just this domain (ADR-0038).
 */
export const CLINICAL_EVIDENCE_SCHEMA_VERSION = "3.0";

export type ClinicalEvidenceAggregate = {
  clinicalEvidenceSchemaVersion: string;
  studies: ClinicalStudyRecord[];
  arms: ClinicalArmRecord[];
  analysisGroups: ClinicalAnalysisGroupRecord[];
  endpoints: ClinicalEndpointRecord[];
  outcomes: ClinicalOutcomeRecord[];
};

export type ClinicalRegistryIdentifier = {
  registry: string;
  id: string;
};

export type ClinicalStudyDesign = {
  randomization: string;
  masking: string;
  comparator: string;
  description?: string;
};

export type ClinicalRegistryStatusCode =
  | "not-yet-recruiting"
  | "recruiting"
  | "enrolling-by-invitation"
  | "active-not-recruiting"
  | "suspended"
  | "terminated"
  | "withdrawn"
  | "completed"
  | "unknown";

/** Status from the single registry chosen as the Study's tracking authority. */
export type ClinicalRegistryStatus = {
  registry: string;
  registryId: string;
  overallStatus: ClinicalRegistryStatusCode;
  /** Exact registry wording, retained alongside the normalized status. */
  sourceStatus: string;
  /** Registry-published status update date; research checks stay on source.checkedAt. */
  statusUpdatedAt?: string;
};

export type ClinicalStudyRecord = {
  id: string;
  companyId: string;
  assetId: string;
  programId?: string;
  regimenId?: string;
  officialTitle: string;
  acronym?: string;
  registryIdentifiers: ClinicalRegistryIdentifier[];
  protocolIdentifiers?: string[];
  phase: string;
  registryStatus: ClinicalRegistryStatus;
  design: ClinicalStudyDesign;
  population: string;
  overallDuration?: string;
  followUpDuration?: string;
  safetySummary?: string;
  metadata: RecordMetadata;
};

export type ClinicalArmRole =
  | "experimental"
  | "placebo"
  | "active comparator"
  | "other";

export type ClinicalArmRecord = {
  id: string;
  studyId: string;
  role: ClinicalArmRole;
  label: string;
  intervention: string;
  /**
   * A comparator or component that resolves to a registry asset must carry both
   * companyId and assetId, including across companies. Free-text assetName /
   * externalCompanyName is reserved for genuinely external or unresolved assets.
   */
  linkedAsset?: ComponentReference;
  dose?: string;
  titration?: string;
  route?: string;
  dosingFrequency?: string;
  treatmentDuration?: string;
  plannedN?: number;
  analyzedN?: number;
};

/** Source-reported construction of an analysis group. Never inferred. */
export type ClinicalAnalysisGroupKind =
  | "pooled"
  | "derived"
  | "starting-dose-subgroup"
  | "other";

/**
 * A study-scoped analysis unit that is not a protocol-defined Arm: a pooled group,
 * a starting-dose subgroup, or another source-reported derived group. Members are
 * protocol Arms of the same study; groups do not nest.
 */
export type ClinicalAnalysisGroupRecord = {
  id: string;
  studyId: string;
  kind: ClinicalAnalysisGroupKind;
  label: string;
  memberArmIds: string[];
  description?: string;
  analyzedN?: number;
};

/** Prespecified role of an endpoint, confirmed from the study's cited sources. */
export type ClinicalEndpointRole =
  | "primary"
  | "co-primary"
  | "key-secondary"
  | "secondary"
  | "exploratory"
  | "safety"
  | "other";

/** Clinical domain the endpoint measures. Separates weight from comorbidity endpoints. */
export type ClinicalEndpointDomain =
  | "body weight"
  | "body composition"
  | "glycemic"
  | "cardiovascular"
  | "renal"
  | "hepatic"
  | "respiratory"
  | "musculoskeletal"
  | "patient-reported"
  | "safety"
  | "other";

export type ClinicalEndpointRecord = {
  id: string;
  studyId: string;
  name: string;
  role: ClinicalEndpointRole;
  domain?: ClinicalEndpointDomain;
  /** Legacy free-text descriptor. Superseded by role/domain; not a role authority. */
  classification?: string;
  assessmentTimepoint: string;
};

export type ClinicalResultMaturity =
  | "interim"
  | "topline"
  | "final"
  | "registry result"
  | "conference result"
  | "peer-reviewed publication";

export type ClinicalReportedResult = {
  /** Source-reported display text, preserved verbatim. */
  value: string;
  /**
   * Machine-readable value. Required: explicitly `null` when the source reports a
   * narrative value that has no machine-readable number, never omitted.
   */
  numericValue: number | null;
  /** Actual unit of measurement. Never an effect measure. */
  unit: string;
  /** Effect measure of a between-arm estimate, e.g. "Hazard ratio". */
  effectMeasure?: string;
  resultType: "arm-level" | "between-arm";
  /** Effect measure plus reference direction, e.g. "Hazard ratio, drug versus placebo". */
  comparisonType?: string;
  confidenceInterval?: string;
  pValue?: string;
  responderThreshold?: string;
};

/**
 * An Outcome anchors either to protocol Arms (armIds) or to one AnalysisGroup
 * (analysisGroupId) — never both.
 */
export type ClinicalOutcomeRecord = {
  id: string;
  studyId: string;
  endpointId: string;
  armIds?: string[];
  analysisGroupId?: string;
  analysisPopulation: string;
  estimand?: string;
  result: ClinicalReportedResult;
  maturity: ClinicalResultMaturity;
  metadata: RecordMetadata;
};

/**
 * Derived projection (ADR-0037 / audit R2b): reciprocal asset -> studies discovery,
 * computed from canonical internal links only. It is regenerated deterministically,
 * is never authored, and is not part of the canonical v3.0 contract.
 */
export type ClinicalAssetStudyIndexEntry = {
  companyId: string;
  assetId: string;
  /** Studies whose canonical anchor is this asset. */
  focalStudyIds: string[];
  /** Studies where this asset appears only as an internally linked Arm asset. */
  linkedStudyIds: string[];
};

export type ClinicalAssetStudyIndex = {
  /**
   * This projection's own format version — independent of
   * ClinicalEvidenceAggregate.clinicalEvidenceSchemaVersion by design, since the
   * projection is not part of the canonical v3.0 contract and may change shape on its
   * own (ADR-0038).
   */
  projectionSchemaVersion: string;
  assets: ClinicalAssetStudyIndexEntry[];
};
