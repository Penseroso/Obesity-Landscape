import clinicalEvidenceData from "@/data/generated/clinical-evidence.json";
import clinicalAssetStudyIndexData from "@/data/generated/clinical-evidence-asset-studies.json";
import type { ClinicalAssetStudyIndex, ClinicalEvidenceAggregate } from "./types";

export const clinicalEvidence = clinicalEvidenceData as ClinicalEvidenceAggregate;
export const clinicalStudies = clinicalEvidence.studies;
export const clinicalArms = clinicalEvidence.arms;
export const clinicalAnalysisGroups = clinicalEvidence.analysisGroups;
export const clinicalEndpoints = clinicalEvidence.endpoints;
export const clinicalOutcomes = clinicalEvidence.outcomes;

/**
 * Derived projection, not canonical data: reciprocal asset -> studies discovery regenerated
 * from the canonical internal links (ADR-0037).
 */
export const clinicalAssetStudyIndex =
  clinicalAssetStudyIndexData as ClinicalAssetStudyIndex;
