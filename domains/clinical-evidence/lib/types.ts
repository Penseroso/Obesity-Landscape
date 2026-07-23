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
export const CLINICAL_EVIDENCE_SCHEMA_VERSION = "3.1";

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

export type ClinicalPopulationAgeGroup = "adult" | "adolescent" | "pediatric";

/**
 * Diabetes criterion as the source states it. `mixed` means the source
 * explicitly admits both ("with or without type 2 diabetes"); `not-specified`
 * means the source states no diabetes criterion at all. The two are kept apart
 * because only the first is a stated design fact, and neither may be read as
 * "non-diabetic".
 */
export type ClinicalPopulationDiabetesStatus =
  | "without-type-2-diabetes"
  | "with-type-2-diabetes"
  | "mixed"
  | "not-specified";

export type ClinicalPopulationTreatmentContext =
  | "initial-treatment"
  | "maintenance-or-continuation"
  | "post-lifestyle-intervention"
  | "randomized-withdrawal-or-switch";

/**
 * Authored structured reading of `population`, stored alongside it rather than
 * replacing it — the source wording stays verbatim and is never parsed.
 *
 * Four axes rather than one enum: real populations combine them independently
 * ("East Asian adults with obesity or overweight", "adults with obesity and knee
 * osteoarthritis"), and a single enum would need either an unstable
 * combinatorial value list or lossy collapsing.
 *
 * Absent means unclassified. A consumer that needs this must disposition such a
 * Study as a coverage gap; it must never be treated as a permissive default or
 * selected as a low-ranked fallback.
 */
export type ClinicalPopulationProfile = {
  ageGroup: ClinicalPopulationAgeGroup;
  diabetesStatus: ClinicalPopulationDiabetesStatus;
  /**
   * A non-diabetes disease is an enrolment requirement (knee osteoarthritis,
   * heart failure, psoriasis, inflammatory bowel disease). A weight-related
   * comorbidity admitted as one of several qualifying options is not one.
   */
  requiresAdditionalCondition: boolean;
  treatmentContext: ClinicalPopulationTreatmentContext;
  /** Source-stated geographic restriction, e.g. "China". Display only, never a filter. */
  regionRestriction?: string;
};

export type ClinicalStudyRecord = {
  id: string;
  companyId: string;
  assetId: string;
  programId?: string;
  regimenId?: string;
  officialTitle: string;
  acronym?: string;
  /**
   * Explicit sponsor study-series name (SURMOUNT, STEP, REDEFINE). Authored only —
   * never inferred from acronym or title. Absent means the Study is unclassified,
   * not that its family is unknown pending research.
   */
  studyFamily?: string;
  registryIdentifiers: ClinicalRegistryIdentifier[];
  protocolIdentifiers?: string[];
  phase: string;
  registryStatus: ClinicalRegistryStatus;
  design: ClinicalStudyDesign;
  population: string;
  /**
   * Authored structured reading of `population`. Optional at schema level so an
   * inventory Study needs no authoring; consumers that require it disposition an
   * absent profile rather than assuming one.
   */
  populationProfile?: ClinicalPopulationProfile;
  overallDuration?: string;
  followUpDuration?: string;
  safetySummary?: string;
  /**
   * Concise source-reported incidence text (e.g. a range across arms), not a
   * per-arm structured result — the module still does not model exhaustive
   * adverse-event capture. Present only when the study's cited sources report
   * it; omit rather than write "not reported".
   */
  seriousAdverseEventIncidence?: string;
  /** Same shape and omission rule as `seriousAdverseEventIncidence`, for nausea/vomiting incidence. */
  nauseaVomitingIncidence?: string;
  /** Same shape and omission rule as `seriousAdverseEventIncidence`, for anti-drug antibody (immunogenicity) incidence. */
  antiDrugAntibodyIncidence?: string;
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
 * is never authored, and is not part of the canonical Clinical Evidence contract.
 */
export type ClinicalAssetStudyIndexEntry = {
  companyId: string;
  assetId: string;
  /**
   * Studies whose canonical anchor is this asset. Order is meaningful: each id is
   * ordered by its position in the canonical `studies` array, i.e. curated source order.
   */
  focalStudyIds: string[];
  /**
   * Studies where this asset appears only as an internally linked Arm asset. Membership
   * is reciprocal discovery with no authored order of its own; ordering follows the same
   * canonical `studies`-array position as `focalStudyIds`.
   */
  linkedStudyIds: string[];
};

export type ClinicalAssetStudyIndex = {
  /**
   * This projection's own format version — independent of
   * ClinicalEvidenceAggregate.clinicalEvidenceSchemaVersion by design, since the
   * projection is not part of the canonical Clinical Evidence contract and may change shape on its
   * own (ADR-0038).
   */
  projectionSchemaVersion: string;
  assets: ClinicalAssetStudyIndexEntry[];
};
