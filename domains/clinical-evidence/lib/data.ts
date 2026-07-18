import clinicalEvidenceData from "@/data/generated/clinical-evidence.json";
import clinicalAssetStudyIndexData from "@/data/generated/clinical-evidence-asset-studies.json";
import { companies, pipelinePrograms } from "@/domains/company-pipeline/lib/data";
import type {
  ClinicalAnalysisGroupRecord,
  ClinicalArmRecord,
  ClinicalAssetStudyIndex,
  ClinicalAssetStudyIndexEntry,
  ClinicalEndpointRecord,
  ClinicalEvidenceAggregate,
  ClinicalOutcomeRecord,
  ClinicalStudyRecord,
} from "./types";

/**
 * Data-access boundary for the Clinical Evidence read model.
 *
 * This is the ONLY module that reads the generated Clinical Evidence JSON and
 * indexes it. `selectors.ts` consumes these exports and returns view models;
 * pages and components consume selectors only and never touch the raw arrays
 * or the derived index directly.
 */

export const clinicalEvidence =
  clinicalEvidenceData as ClinicalEvidenceAggregate;
export const clinicalStudies = clinicalEvidence.studies;
export const clinicalArms = clinicalEvidence.arms;
export const clinicalAnalysisGroups = clinicalEvidence.analysisGroups;
export const clinicalEndpoints = clinicalEvidence.endpoints;
export const clinicalOutcomes = clinicalEvidence.outcomes;

/**
 * Derived projection, not canonical data: reciprocal asset -> studies discovery
 * regenerated from the canonical internal links (ADR-0037).
 */
export const clinicalAssetStudyIndex =
  clinicalAssetStudyIndexData as ClinicalAssetStudyIndex;

/** Composite key for the company-scoped asset identity used across the index. */
export function assetKeyOf(companyId: string, assetId: string) {
  return `${companyId}|${assetId}`;
}

function groupByStudyId<T extends { studyId: string }>(records: T[]) {
  const map = new Map<string, T[]>();
  for (const record of records) {
    const list = map.get(record.studyId);
    if (list) {
      list.push(record);
    } else {
      map.set(record.studyId, [record]);
    }
  }
  return map;
}

function groupStudiesByExplicitMapping(
  field: "programId" | "regimenId",
) {
  const map = new Map<string, ClinicalStudyRecord[]>();
  for (const study of clinicalStudies) {
    const id = study[field];
    if (!id) continue;
    const list = map.get(id);
    if (list) list.push(study);
    else map.set(id, [study]);
  }
  return map;
}

// id / studyId indexes so selectors never rescan the flat arrays per lookup.
export const clinicalStudiesById = new Map<string, ClinicalStudyRecord>(
  clinicalStudies.map((study) => [study.id, study]),
);
/** Explicit focal mappings only; selectors must never infer these joins. */
export const clinicalStudiesByProgramId = groupStudiesByExplicitMapping("programId");
export const clinicalStudiesByRegimenId = groupStudiesByExplicitMapping("regimenId");
export const clinicalArmsByStudyId = groupByStudyId<ClinicalArmRecord>(
  clinicalArms,
);
export const clinicalEndpointsByStudyId =
  groupByStudyId<ClinicalEndpointRecord>(clinicalEndpoints);
export const clinicalOutcomesByStudyId = groupByStudyId<ClinicalOutcomeRecord>(
  clinicalOutcomes,
);
export const clinicalAnalysisGroupsByStudyId =
  groupByStudyId<ClinicalAnalysisGroupRecord>(clinicalAnalysisGroups);

export const clinicalAssetIndexByKey = new Map<
  string,
  ClinicalAssetStudyIndexEntry
>(
  clinicalAssetStudyIndex.assets.map((entry) => [
    assetKeyOf(entry.companyId, entry.assetId),
    entry,
  ]),
);

// Asset display names + asset existence come from the Company/Pipeline registry,
// the naming authority; Clinical Evidence records carry only companyId/assetId.
// This is the single cross-module join site (mirrors companiesById in
// lib/programs/data.ts).
export const clinicalAssetNameByKey = new Map<string, string>(
  pipelinePrograms.map((program) => [
    assetKeyOf(program.companyId, program.assetId),
    program.assetName,
  ]),
);

/** Every valid Company/Pipeline asset key; authority for "does this asset exist". */
export const pipelineAssetKeys = new Set<string>(clinicalAssetNameByKey.keys());

export const companyNameById = new Map<string, string>(
  companies.map((company) => [company.id, company.name]),
);
