import type { ComponentReference, RecordMetadata } from "@/lib/programs/types";

/** Canonical Clinical Evidence schema version. v1 records do not validate under v2.0. */
export const CLINICAL_EVIDENCE_SCHEMA_VERSION = "2.0";

export type ClinicalEvidenceAggregate = {
  schemaVersion: string;
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
  status: string;
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
  dose: string;
  titration?: string;
  route: string;
  dosingFrequency: string;
  treatmentDuration: string;
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
  /** Machine-readable value; null when the source reports a narrative value. */
  numericValue?: number | null;
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
 * is never authored, and is not part of the canonical v2.0 contract.
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
  schemaVersion: string;
  assets: ClinicalAssetStudyIndexEntry[];
};
