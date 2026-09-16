import clinicalEvidenceData from "@/data/generated/clinical-evidence.json";
import clinicalAssetStudyIndexData from "@/data/generated/clinical-evidence-asset-studies.json";
import { companies, pipelinePrograms, regimens } from "@/domains/company-pipeline/lib/data";
import type {
  ClinicalAnalysisGroupRecord,
  ClinicalArmRecord,
  ClinicalAssetStudyIndex,
  ClinicalAssetStudyIndexEntry,
  ClinicalEndpointRecord,
  ClinicalEvidenceAggregate,
  ClinicalOutcomeRecord,
  ClinicalRegimenStudyIndexEntry,
  ClinicalStudyProgramRecord,
  ClinicalStudyRecord,
  ClinicalStudyRegimenRecord,
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

/**
 * Composite key for the company-scoped regimen identity (Regimen-native
 * anchoring; ADR-0075 follow-up). Deliberately the same shape as
 * `assetKeyOf` — asset and regimen keys are never compared against each
 * other, only looked up within their own map, so sharing a format is a
 * convenience, not a collision risk in practice.
 */
export function regimenKeyOf(companyId: string, regimenId: string) {
  return `${companyId}|${regimenId}`;
}

/**
 * Append-only accumulator: each bucket keeps records in the exact order they appear
 * in the generated array, which is how curated source order reaches the read model
 * and the UI. Never sort here — that would discard the authored ordering the
 * generator preserves.
 */
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

/**
 * Groups Studies by an explicit focal mapping, narrowed to the matching union
 * member (`ClinicalStudyProgramRecord`/`ClinicalStudyRegimenRecord`) rather
 * than the general `ClinicalStudyRecord` union — narrows on `!== undefined`,
 * not truthiness, for the same reason noted throughout the app layer: only an
 * explicit `undefined` comparison narrows a discriminated union correctly.
 */
function groupProgramStudies(): Map<string, ClinicalStudyProgramRecord[]> {
  const map = new Map<string, ClinicalStudyProgramRecord[]>();
  for (const study of clinicalStudies) {
    if (study.programId === undefined) continue;
    const list = map.get(study.programId);
    if (list) list.push(study);
    else map.set(study.programId, [study]);
  }
  return map;
}

function groupRegimenStudies(): Map<string, ClinicalStudyRegimenRecord[]> {
  const map = new Map<string, ClinicalStudyRegimenRecord[]>();
  for (const study of clinicalStudies) {
    if (study.regimenId === undefined) continue;
    const list = map.get(study.regimenId);
    if (list) list.push(study);
    else map.set(study.regimenId, [study]);
  }
  return map;
}

// id / studyId indexes so selectors never rescan the flat arrays per lookup.
export const clinicalStudiesById = new Map<string, ClinicalStudyRecord>(
  clinicalStudies.map((study) => [study.id, study]),
);
/** Explicit focal mappings only; selectors must never infer these joins. */
export const clinicalStudiesByProgramId = groupProgramStudies();
export const clinicalStudiesByRegimenId = groupRegimenStudies();
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

/** Regimen-native sibling of `clinicalAssetIndexByKey` (ADR-0075 follow-up). */
export const clinicalRegimenIndexByKey = new Map<
  string,
  ClinicalRegimenStudyIndexEntry
>(
  clinicalAssetStudyIndex.regimens.map((entry) => [
    regimenKeyOf(entry.companyId, entry.regimenId),
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

/** Regimen-native sibling of `clinicalAssetNameByKey` (ADR-0075 follow-up). */
export const clinicalRegimenNameByKey = new Map<string, string>(
  regimens.map((regimen) => [regimenKeyOf(regimen.companyId, regimen.id), regimen.name]),
);

/** Every valid Company/Pipeline regimen key; authority for "does this regimen exist". */
export const pipelineRegimenKeys = new Set<string>(clinicalRegimenNameByKey.keys());

export const companyNameById = new Map<string, string>(
  companies.map((company) => [company.id, company.name]),
);
