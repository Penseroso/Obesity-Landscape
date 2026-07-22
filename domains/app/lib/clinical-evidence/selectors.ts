import {
  assetKeyOf,
  clinicalAnalysisGroupsByStudyId,
  clinicalArmsByStudyId,
  clinicalAssetIndexByKey,
  clinicalAssetNameByKey,
  clinicalAssetStudyIndex,
  clinicalEndpointsByStudyId,
  clinicalOutcomesByStudyId,
  clinicalStudies,
  clinicalStudiesById,
  clinicalStudiesByProgramId,
  companyNameById,
  pipelineAssetKeys,
} from "@/domains/clinical-evidence/lib/data";
import {
  canonicalizeClinicalAnalysisPopulation,
  canonicalizeClinicalEstimand,
} from "@/domains/clinical-evidence/lib/clinical-term-canonicalization.mjs";
import { pipelinePrograms, regimens } from "@/domains/company-pipeline/lib/data";
import type {
  ClinicalAnalysisGroupRecord,
  ClinicalArmRecord,
  ClinicalEndpointRecord,
  ClinicalEndpointRole,
  ClinicalOutcomeRecord,
  ClinicalRegistryStatus,
  ClinicalStudyRecord,
} from "@/domains/clinical-evidence/lib/types";

/**
 * Clinical Evidence read model.
 *
 * These are the only functions pages/components may call to read clinical data.
 * All multi-array joins (study <-> arms <-> endpoints <-> outcomes <-> groups)
 * and reciprocal focal/linked resolution happen here, against the indexes built
 * once in `data.ts`.
 */

/** A registry asset reference that can be linked to its asset route. */
export type ClinicalAssetRef = {
  companyId: string;
  assetId: string;
  assetName: string;
  companyName?: string;
};

/**
 * Study-intrinsic summary. Deliberately carries NO focal/linked relation: that
 * relationship exists only relative to an asset context, not as a property of
 * the study. Asset-context views express it via array membership instead.
 */
export type StudySummaryView = {
  id: string;
  companyId: string;
  assetId: string;
  officialTitle: string;
  acronym?: string;
  /** Preferred short label: acronym when present, else official title. */
  title: string;
  phase: string;
  population: string;
  /** `study.overallDuration`; never reconstructed from Arm durations. */
  duration: string | null;
  treatment: StudyTreatmentView;
  /** Null when the Study has no recorded Outcome; the UI renders "Not reported". */
  primaryFinding: PrimaryFindingView | null;
  /** Authored sponsor series; absent means the Study is unclassified. */
  studyFamily?: string;
  /** Program relationship, carried as row metadata rather than a grouping boundary. */
  programContext?: StudyProgramContext;
  /** Regimen relationship for a regimen-mapped Study; mutually exclusive with the above. */
  regimenContext?: StudyRegimenContext;
  registryStatus: ClinicalRegistryStatus;
  /** Derived solely from whether at least one Outcome is recorded. */
  hasReportedOutcomes: boolean;
  /** The UI/tracking authority registry id — always study.registryStatus.registryId. */
  referenceRegistryId?: string;
};

export type StudyProgramContext = {
  programId: string;
  route: string;
  dosageForm: string;
  dosingInterval: string | null;
};

export type StudyRegimenContext = {
  regimenId: string;
  name: string;
};

export type StudyTreatmentView = {
  /** Experimental arms as authored (dose when stored, else the arm label). */
  experimentalArms: string[];
  /** Experimental arms beyond the display limit, so the UI can say "+N more". */
  hiddenArmCount: number;
  /** `study.design.comparator`, verbatim. */
  comparator: string;
};

/** One reported value plus the analysis unit it belongs to. Never a derived figure. */
export type PrimaryFindingValueView = {
  /** `outcome.result.value`, exactly as stored. */
  value: string;
  unit: string;
  /** Arm label, or analysis-group label for a group-anchored Outcome. */
  label: string;
};

/** One comparison group of the selected endpoint. */
export type PrimaryFindingGroupView = {
  /**
   * Every value of this group's comparison family, in curated source order. All are
   * stored values for stored anchors: this is selection, never calculation.
   */
  values: PrimaryFindingValueView[];
  effectMeasure?: string;
  /** The shared comparator/anchor arm, when the values are between-arm estimates. */
  comparatorLabel?: string;
  /**
   * The analysis axes this group belongs to. Surfaced because a Study may report the
   * same endpoint under several estimands, populations, or cohorts with no stored
   * designation of which one is primary — the reader must be able to tell them apart.
   */
  estimand?: string;
  analysisPopulation: string;
};

export type PrimaryFindingView = {
  endpointName: string;
  assessmentTimepoint: string;
  endpointRole: ClinicalEndpointRole;
  /**
   * Every comparison group of the selected endpoint, in curated source order and never
   * merged across analysis population, estimand, or cohort. The read model does not drop
   * a group for being one too many to show: truncation is a per-screen presentation
   * policy, owned by the consuming view.
   */
  groups: PrimaryFindingGroupView[];
};

export type StudyFamilyGroupView = {
  /** Authored family text, or null for the trailing unclassified group. */
  family: string | null;
  studies: StudySummaryView[];
};

export type ArmView = ClinicalArmRecord & {
  /** Resolved display name of the linked asset, when it resolves. */
  linkedAssetName?: string;
  /**
   * Present only when the linkedAsset is an internal registry asset. Preserves
   * companyId + assetId so the UI can link the arm to that asset route.
   */
  linkedAssetRef?: { companyId: string; assetId: string };
};

export type OutcomeView = {
  outcome: ClinicalOutcomeRecord;
  endpoint: ClinicalEndpointRecord;
  /** Labels of the arms this outcome anchors to (arm-level or between-arm). */
  armLabels: string[];
  /** Label of the analysis group this outcome anchors to, when group-anchored. */
  groupLabel?: string;
};

export type EndpointGroupView = {
  endpoint: ClinicalEndpointRecord;
  outcomes: OutcomeView[];
};

export type AnalysisGroupView = ClinicalAnalysisGroupRecord & {
  /** Labels of the protocol arms that make up this analysis group. */
  memberArmLabels: string[];
};

export type StudyDetailView = {
  study: ClinicalStudyRecord;
  /** The study's canonical focal asset (back-link target). */
  asset: ClinicalAssetRef;
  arms: ArmView[];
  analysisGroups: AnalysisGroupView[];
  endpointGroups: EndpointGroupView[];
  /** Reciprocal: other assets that link to this study via an Arm linkedAsset. */
  linkedFromAssets: ClinicalAssetRef[];
};

export type AssetStudiesView = {
  companyId: string;
  assetId: string;
  assetName: string;
  companyName?: string;
  /** Canonical flat focal list; the family groups are a partition of exactly this. */
  focalStudies: StudySummaryView[];
  focalFamilyGroups: StudyFamilyGroupView[];
  linkedStudies: StudySummaryView[];
  linkedFamilyGroups: StudyFamilyGroupView[];
};

/**
 * Compact, explicitly program-scoped clinical preview for the Program Drawer.
 * No asset/title/indication/comparator fallback is permitted.
 */
export type ProgramStudyPreview = {
  programId: string;
  companyId: string;
  assetId: string;
  studies: StudySummaryView[];
  totalCount: number;
  href: string;
};

export type AssetClinicalRollup = {
  companyId: string;
  assetId: string;
  hasStudies: boolean;
  hasClinicalEvidence: boolean;
  focalStudyIds: string[];
  linkedStudyIds: string[];
  focalStudyCount: number;
  linkedStudyCount: number;
  href: string;
};

/** Max explicitly linked studies shown in the drawer preview. */
const PREVIEW_LIMIT = 5;

/** Application-owned Program lookup for cross-domain Clinical Evidence composition. */
const pipelineProgramsById = new Map(
  pipelinePrograms.map((program) => [program.id, program]),
);

/** Regimen lookup, so a regimen-mapped Study can name its regimen on the row. */
const regimensById = new Map(regimens.map((regimen) => [regimen.id, regimen]));

/** Experimental arms listed inline before the row collapses the remainder. */
const TREATMENT_ARM_DISPLAY_LIMIT = 4;

/**
 * Presentation ranking for endpoint groups. Deliberately role-only, with no
 * tie-breaker: `Array.prototype.sort` is stable, so endpoints sharing a role keep
 * the curated source order they arrive in. Adding a tie-breaker here would
 * override that curation.
 */
const endpointRoleRank: Record<ClinicalEndpointRole, number> = {
  primary: 0,
  "co-primary": 1,
  "key-secondary": 2,
  secondary: 3,
  exploratory: 4,
  safety: 5,
  other: 6,
};

function assetRef(companyId: string, assetId: string): ClinicalAssetRef {
  const key = assetKeyOf(companyId, assetId);
  return {
    companyId,
    assetId,
    assetName: clinicalAssetNameByKey.get(key) ?? assetId,
    companyName: companyNameById.get(companyId),
  };
}

/**
 * Treatment summary for the list table: the Study's experimental Arms plus its
 * source-reported comparator. `dose` is preferred over `label` because the authored
 * dose is what distinguishes sibling arms; arms keep their curated (dose-ascending)
 * order, which the generator preserves (ADR-0040).
 */
function toTreatmentView(study: ClinicalStudyRecord): StudyTreatmentView {
  const experimental = (clinicalArmsByStudyId.get(study.id) ?? []).filter(
    (arm) => arm.role === "experimental",
  );
  const labels = Array.from(
    new Set(experimental.map((arm) => arm.dose?.trim() || arm.label)),
  );
  return {
    experimentalArms: labels.slice(0, TREATMENT_ARM_DISPLAY_LIMIT),
    hiddenArmCount: Math.max(labels.length - TREATMENT_ARM_DISPLAY_LIMIT, 0),
    comparator: study.design.comparator,
  };
}

/**
 * Grouping key for Outcomes a single source would report together, mirroring the
 * validator's `getClinicalComparisonGroupKey`. The endpoint is fixed by the caller, so
 * only the analysis axes remain, and they enter the key through the **same shared
 * canonicalization the validator uses**: both must draw the same group boundary, or a
 * casing or hyphenation variant would split a group here that the validator treats as one.
 */
export function comparisonGroupKeyOf(outcome: ClinicalOutcomeRecord): string {
  return [
    outcome.result.resultType,
    canonicalizeClinicalAnalysisPopulation(outcome.analysisPopulation),
    canonicalizeClinicalEstimand(outcome.estimand),
  ].join("|");
}

/**
 * Deterministic Primary finding for the Asset Clinical Detail table.
 *
 * Selection only — never calculation. Every value rendered is a stored
 * `result.value` for a stored anchor; the low/high pair is two reported results, not a
 * computed range. A Study with no Outcome yields null, which the UI renders as
 * "Not reported" (outcome existence is the only authority, per the contract).
 */
function toPrimaryFinding(study: ClinicalStudyRecord): PrimaryFindingView | null {
  const outcomes = clinicalOutcomesByStudyId.get(study.id) ?? [];
  if (outcomes.length === 0) {
    return null;
  }

  const outcomesByEndpointId = new Map<string, ClinicalOutcomeRecord[]>();
  for (const outcome of outcomes) {
    const list = outcomesByEndpointId.get(outcome.endpointId);
    if (list) list.push(outcome);
    else outcomesByEndpointId.set(outcome.endpointId, [outcome]);
  }

  // Highest-ranked role that actually carries a result. Sort is stable, so endpoints
  // sharing a role keep curated source order. Studies whose prespecified primary
  // endpoint has no recorded Outcome fall through to the next role rather than
  // reporting nothing.
  const endpoint = (clinicalEndpointsByStudyId.get(study.id) ?? [])
    .filter((candidate) => (outcomesByEndpointId.get(candidate.id) ?? []).length > 0)
    .sort(
      (a, b) => (endpointRoleRank[a.role] ?? 99) - (endpointRoleRank[b.role] ?? 99),
    )[0];
  if (!endpoint) {
    return null;
  }

  const studyArms = clinicalArmsByStudyId.get(study.id) ?? [];
  const armLabelById = new Map(studyArms.map((arm) => [arm.id, arm.label]));
  const experimentalArmIds = new Set(
    studyArms.filter((arm) => arm.role === "experimental").map((arm) => arm.id),
  );
  const groupLabelById = new Map(
    (clinicalAnalysisGroupsByStudyId.get(study.id) ?? []).map((group) => [
      group.id,
      group.label,
    ]),
  );

  const comparisonGroups = new Map<string, ClinicalOutcomeRecord[]>();
  for (const outcome of outcomesByEndpointId.get(endpoint.id) ?? []) {
    const key = comparisonGroupKeyOf(outcome);
    const list = comparisonGroups.get(key);
    if (list) list.push(outcome);
    else comparisonGroups.set(key, [outcome]);
  }

  // Every comparison group of the endpoint is returned, in curated source order. Groups
  // separated by analysis population, estimand, or cohort are distinct results by
  // contract, so the read model neither merges nor discards them; how many a given
  // screen shows is that screen's presentation policy, not a data decision.
  const toGroupView = (
    group: ClinicalOutcomeRecord[],
  ): PrimaryFindingGroupView => {
    // Comparison family, defined as the validator defines it: the subset sharing an
    // anchor arm (typically the pooled placebo). Reporting across a family keeps the
    // comparison context that a bare value range would lose.
    let family = group;
    let anchorArmId: string | undefined;
    if (group[0].result.resultType === "arm-level") {
      // An arm-level group also carries the comparator's own value. Spanning treatment
      // and placebo would read as a dose range, so keep the experimental arms only and
      // let the Treatment column carry the comparator. A group with no experimental arm
      // at all — a cohort-scoped placebo group, say — keeps its outcomes as authored.
      const experimentalOnly = group.filter((outcome) =>
        (outcome.armIds ?? []).every((armId) => experimentalArmIds.has(armId)),
      );
      if (experimentalOnly.length > 0) {
        family = experimentalOnly;
      }
    } else if (group[0].result.resultType === "between-arm" && group.length > 1) {
      const occurrences = new Map<string, number>();
      for (const outcome of group) {
        for (const armId of outcome.armIds ?? []) {
          occurrences.set(armId, (occurrences.get(armId) ?? 0) + 1);
        }
      }
      anchorArmId = Array.from(occurrences.entries()).find(
        ([, count]) => count > 1,
      )?.[0];
      if (anchorArmId) {
        family = group.filter((outcome) =>
          (outcome.armIds ?? []).includes(anchorArmId as string),
        );
      }
    }

    const labelOf = (outcome: ClinicalOutcomeRecord): string => {
      if (outcome.analysisGroupId) {
        return (
          groupLabelById.get(outcome.analysisGroupId) ?? outcome.analysisGroupId
        );
      }
      const armIds = (outcome.armIds ?? []).filter(
        (armId) => armId !== anchorArmId,
      );
      return armIds.map((armId) => armLabelById.get(armId) ?? armId).join(" vs ");
    };

    // Every Outcome of the family, in curated source order (dose-ascending, ADR-0040).
    // Showing only the extremes would silently drop middle doses, leaving the cell
    // disagreeing with the dose list in the Treatment column; each value carries its
    // own unit and anchor, so no ordering or comparability is derived here.
    return {
      effectMeasure: family[0].result.effectMeasure,
      comparatorLabel: anchorArmId ? armLabelById.get(anchorArmId) : undefined,
      estimand: family[0].estimand,
      analysisPopulation: family[0].analysisPopulation,
      values: family.map((outcome) => ({
        value: outcome.result.value,
        unit: outcome.result.unit,
        label: labelOf(outcome),
      })),
    };
  };

  return {
    endpointName: endpoint.name,
    assessmentTimepoint: endpoint.assessmentTimepoint,
    endpointRole: endpoint.role,
    groups: Array.from(comparisonGroups.values()).map(toGroupView),
  };
}

/**
 * Program / regimen mapping for one Study. Both relationships remain explicit and
 * fail loud: a Study naming a Program that does not exist is corrupt generated data,
 * not something to render as a blank row.
 */
function toMappingContext(study: ClinicalStudyRecord): {
  programContext?: StudyProgramContext;
  regimenContext?: StudyRegimenContext;
} {
  if (study.programId) {
    const program = pipelineProgramsById.get(study.programId);
    if (!program) {
      throw new Error(
        `Clinical Evidence Study "${study.id}" references missing Program "${study.programId}"`,
      );
    }
    return {
      programContext: {
        programId: study.programId,
        route: program.administration.route,
        dosageForm: program.administration.dosageForm,
        dosingInterval: program.administration.dosingInterval,
      },
    };
  }

  if (study.regimenId) {
    const regimen = regimensById.get(study.regimenId);
    if (!regimen) {
      throw new Error(
        `Clinical Evidence Study "${study.id}" references missing regimen "${study.regimenId}"`,
      );
    }
    return {
      regimenContext: { regimenId: study.regimenId, name: regimen.name },
    };
  }

  return {};
}

function toStudySummary(study: ClinicalStudyRecord): StudySummaryView {
  return {
    id: study.id,
    companyId: study.companyId,
    assetId: study.assetId,
    officialTitle: study.officialTitle,
    acronym: study.acronym,
    title: study.acronym?.trim() || study.officialTitle,
    phase: study.phase,
    population: study.population,
    duration: study.overallDuration ?? null,
    treatment: toTreatmentView(study),
    primaryFinding: toPrimaryFinding(study),
    studyFamily: study.studyFamily,
    ...toMappingContext(study),
    registryStatus: study.registryStatus,
    hasReportedOutcomes:
      (clinicalOutcomesByStudyId.get(study.id) ?? []).length > 0,
    referenceRegistryId: study.registryStatus.registryId,
  };
}

/**
 * Groups Studies by their authored family, preserving canonical order: groups appear
 * in order of first membership, and the unclassified group is always last. Family is
 * never inferred — an absent `studyFamily` means unclassified, so those Studies stay
 * visible in their own group rather than being dropped or bucketed by guesswork.
 */
function toFamilyGroups(studies: StudySummaryView[]): StudyFamilyGroupView[] {
  const groups: StudyFamilyGroupView[] = [];
  const groupByFamily = new Map<string, StudyFamilyGroupView>();
  const unclassified: StudySummaryView[] = [];

  for (const study of studies) {
    if (!study.studyFamily) {
      unclassified.push(study);
      continue;
    }
    let group = groupByFamily.get(study.studyFamily);
    if (!group) {
      group = { family: study.studyFamily, studies: [] };
      groupByFamily.set(study.studyFamily, group);
      groups.push(group);
    }
    group.studies.push(study);
  }

  if (unclassified.length > 0) {
    groups.push({ family: null, studies: unclassified });
  }
  return groups;
}

/**
 * Family groups must remain an exact, duplicate-free partition of the canonical list
 * they were built from. This is the retargeted form of the Program-grouping invariant:
 * a future grouping change must not be able to hide or double-render a Study.
 */
function assertFamilyPartition(
  groups: StudyFamilyGroupView[],
  canonicalStudyIds: string[],
  context: string,
): void {
  const groupedIds = groups.flatMap((group) =>
    group.studies.map((study) => study.id),
  );
  const canonicalIdSet = new Set(canonicalStudyIds);
  const counts = new Map<string, number>();
  for (const id of groupedIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const duplicateIds = Array.from(counts)
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  const groupedIdSet = new Set(groupedIds);
  const missingIds = canonicalStudyIds.filter((id) => !groupedIdSet.has(id));
  const unexpectedIds = groupedIds.filter((id) => !canonicalIdSet.has(id));

  if (
    groupedIds.length !== canonicalStudyIds.length ||
    duplicateIds.length > 0 ||
    missingIds.length > 0 ||
    unexpectedIds.length > 0
  ) {
    throw new Error(
      `Clinical Evidence study-family partition failed for ${context}: ` +
        `expected ${canonicalStudyIds.length}, got ${groupedIds.length}; ` +
        `duplicates [${duplicateIds.join(", ")}], missing [${missingIds.join(", ")}], ` +
        `unexpected [${unexpectedIds.join(", ")}]`,
    );
  }
}

export function getStudySummary(studyId: string): StudySummaryView | undefined {
  const study = clinicalStudiesById.get(studyId);
  return study ? toStudySummary(study) : undefined;
}

export function getStudyDetail(studyId: string): StudyDetailView | undefined {
  const study = clinicalStudiesById.get(studyId);
  if (!study) {
    return undefined;
  }

  const arms = (clinicalArmsByStudyId.get(studyId) ?? []).map<ArmView>((arm) => {
    const linked = arm.linkedAsset;
    if (linked?.companyId && linked.assetId) {
      const key = assetKeyOf(linked.companyId, linked.assetId);
      return {
        ...arm,
        linkedAssetRef: { companyId: linked.companyId, assetId: linked.assetId },
        linkedAssetName:
          clinicalAssetNameByKey.get(key) ??
          linked.assetName ??
          linked.codeName,
      };
    }
    return {
      ...arm,
      linkedAssetName: linked?.assetName ?? linked?.codeName,
    };
  });

  const armLabelById = new Map(arms.map((arm) => [arm.id, arm.label]));

  // Resolve an arm id to its label, failing loud on a dangling reference. A
  // missing arm means the generated data is corrupt (mirrors the orphan-endpoint
  // hardening below), not something to paper over with a raw id in the UI.
  const resolveArmLabel = (armId: string, context: string): string => {
    const label = armLabelById.get(armId);
    if (label === undefined) {
      throw new Error(
        `Clinical Evidence ${context} references missing arm "${armId}" in study "${studyId}"`,
      );
    }
    return label;
  };

  const analysisGroupRecords =
    clinicalAnalysisGroupsByStudyId.get(studyId) ?? [];
  const groupLabelById = new Map(
    analysisGroupRecords.map((group) => [group.id, group.label]),
  );
  const analysisGroups: AnalysisGroupView[] = analysisGroupRecords.map(
    (group) => ({
      ...group,
      memberArmLabels: group.memberArmIds.map((armId) =>
        resolveArmLabel(armId, `analysis group "${group.id}"`),
      ),
    }),
  );

  const endpointsById = new Map(
    (clinicalEndpointsByStudyId.get(studyId) ?? []).map((endpoint) => [
      endpoint.id,
      endpoint,
    ]),
  );

  const outcomesByEndpointId = new Map<string, OutcomeView[]>();
  for (const outcome of clinicalOutcomesByStudyId.get(studyId) ?? []) {
    const endpoint = endpointsById.get(outcome.endpointId);
    if (!endpoint) {
      // The contract guarantees every outcome resolves an endpoint in the same
      // study; a violation means the generated data is corrupt, not something
      // to silently hide from the UI.
      throw new Error(
        `Clinical Evidence outcome "${outcome.id}" references missing endpoint "${outcome.endpointId}" in study "${studyId}"`,
      );
    }
    let groupLabel: string | undefined;
    if (outcome.analysisGroupId) {
      groupLabel = groupLabelById.get(outcome.analysisGroupId);
      if (groupLabel === undefined) {
        throw new Error(
          `Clinical Evidence outcome "${outcome.id}" references missing analysis group "${outcome.analysisGroupId}" in study "${studyId}"`,
        );
      }
    }
    const view: OutcomeView = {
      outcome,
      endpoint,
      armLabels: (outcome.armIds ?? []).map((id) =>
        resolveArmLabel(id, `outcome "${outcome.id}"`),
      ),
      groupLabel,
    };
    const list = outcomesByEndpointId.get(endpoint.id);
    if (list) {
      list.push(view);
    } else {
      outcomesByEndpointId.set(endpoint.id, [view]);
    }
  }

  const endpointGroups: EndpointGroupView[] = Array.from(endpointsById.values())
    .map((endpoint) => ({
      endpoint,
      outcomes: outcomesByEndpointId.get(endpoint.id) ?? [],
    }))
    .sort(
      (a, b) =>
        (endpointRoleRank[a.endpoint.role] ?? 99) -
        (endpointRoleRank[b.endpoint.role] ?? 99),
    );

  // Reciprocal discovery: assets whose index entry lists this study as a linked
  // (comparator / head-to-head) study.
  const linkedFromAssets = clinicalAssetStudyIndex.assets
    .filter((entry) => entry.linkedStudyIds.includes(studyId))
    .map((entry) => assetRef(entry.companyId, entry.assetId));

  return {
    study,
    asset: assetRef(study.companyId, study.assetId),
    arms,
    analysisGroups,
    endpointGroups,
    linkedFromAssets,
  };
}

export function getAssetStudies(
  companyId: string,
  assetId: string,
): AssetStudiesView | undefined {
  const key = assetKeyOf(companyId, assetId);
  const entry = clinicalAssetIndexByKey.get(key);

  // A valid Company/Pipeline asset with no clinical evidence yields an empty
  // view (rendered as an empty state); only a genuinely unknown asset is 404.
  if (!entry && !pipelineAssetKeys.has(key)) {
    return undefined;
  }

  const toSummaries = (ids: string[]) =>
    ids
      .map((id) => getStudySummary(id))
      .filter((summary): summary is StudySummaryView => Boolean(summary));

  const canonicalFocalStudyIds = entry?.focalStudyIds ?? [];
  const canonicalLinkedStudyIds = entry?.linkedStudyIds ?? [];
  const focalStudies = toSummaries(canonicalFocalStudyIds);
  const linkedStudies = toSummaries(canonicalLinkedStudyIds);

  // Focal mapping stays explicit and asset-owned. Grouping moved to study family, but
  // these ownership checks did not: a focal Study must still resolve exactly one
  // Program or regimen, and a Program must still belong to this very asset.
  for (const summary of focalStudies) {
    const study = clinicalStudiesById.get(summary.id);
    if (!study) {
      throw new Error(
        `Clinical Evidence focal Study "${summary.id}" is missing for asset "${companyId}/${assetId}"`,
      );
    }

    if (study.programId) {
      const program = pipelineProgramsById.get(study.programId);
      if (!program) {
        throw new Error(
          `Clinical Evidence Study "${study.id}" references missing Program "${study.programId}"`,
        );
      }
      if (program.companyId !== companyId || program.assetId !== assetId) {
        throw new Error(
          `Clinical Evidence Study "${study.id}" Program "${study.programId}" does not belong to asset "${companyId}/${assetId}"`,
        );
      }
    } else if (!study.regimenId) {
      throw new Error(
        `Clinical Evidence focal Study "${study.id}" has no Program or regimen mapping`,
      );
    }
  }

  const focalFamilyGroups = toFamilyGroups(focalStudies);
  const linkedFamilyGroups = toFamilyGroups(linkedStudies);
  assertFamilyPartition(
    focalFamilyGroups,
    canonicalFocalStudyIds,
    `focal studies of asset "${companyId}/${assetId}"`,
  );
  assertFamilyPartition(
    linkedFamilyGroups,
    canonicalLinkedStudyIds,
    `linked studies of asset "${companyId}/${assetId}"`,
  );

  return {
    companyId,
    assetId,
    assetName: clinicalAssetNameByKey.get(key) ?? assetId,
    companyName: companyNameById.get(companyId),
    focalStudies,
    focalFamilyGroups,
    linkedStudies,
    linkedFamilyGroups,
  };
}

/**
 * Compact clinical preview for the Program Drawer. Uses only explicit programId
 * mappings and intentionally excludes regimen-linked and asset-linked studies.
 *
 * `records` arrives in curated source order, so the preview shows the first
 * PREVIEW_LIMIT studies as authored, and `records[0]` supplies the companyId /
 * assetId / href. This is positional truncation, not a clinical ranking: which
 * studies are dropped follows authoring order, not relevance.
 */
export function getProgramStudyPreview(
  programId: string,
): ProgramStudyPreview | undefined {
  const records = clinicalStudiesByProgramId.get(programId) ?? [];
  if (records.length === 0) return undefined;
  const first = records[0];
  return {
    programId,
    companyId: first.companyId,
    assetId: first.assetId,
    studies: records.slice(0, PREVIEW_LIMIT).map(toStudySummary),
    totalCount: records.length,
    href: `/assets/${first.companyId}/${first.assetId}`,
  };
}

/** Entry-point gating: does this asset have any focal or linked clinical study. */
export function hasClinicalEvidence(
  companyId: string,
  assetId: string,
): boolean {
  const view = getAssetStudies(companyId, assetId);
  return Boolean(
    view &&
      [...view.focalStudies, ...view.linkedStudies].some(
        (study) => study.hasReportedOutcomes,
      ),
  );
}

/**
 * Minimal asset-level clinical association model for cross-domain composition.
 * IDs let callers deduplicate across focal/linked relationships and assets
 * without importing or joining clinical raw arrays.
 */
export function getAssetClinicalRollup(
  companyId: string,
  assetId: string,
): AssetClinicalRollup | undefined {
  const view = getAssetStudies(companyId, assetId);
  if (!view) return undefined;

  const focalStudyIds = Array.from(
    new Set(view.focalStudies.map((study) => study.id)),
  );
  const linkedStudyIds = Array.from(
    new Set(view.linkedStudies.map((study) => study.id)),
  );
  const associatedStudies = [...view.focalStudies, ...view.linkedStudies];

  return {
    companyId,
    assetId,
    hasStudies: associatedStudies.length > 0,
    hasClinicalEvidence: associatedStudies.some(
      (study) => study.hasReportedOutcomes,
    ),
    focalStudyIds,
    linkedStudyIds,
    focalStudyCount: focalStudyIds.length,
    linkedStudyCount: linkedStudyIds.length,
    href: `/assets/${companyId}/${assetId}`,
  };
}

export function listClinicalStudyIds(): string[] {
  return clinicalStudies.map((study) => study.id);
}

export function listClinicalAssetKeys(): {
  companyId: string;
  assetId: string;
}[] {
  return clinicalAssetStudyIndex.assets.map((entry) => ({
    companyId: entry.companyId,
    assetId: entry.assetId,
  }));
}
