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
  companyNameById,
  pipelineAssetKeys,
} from "./data";
import type {
  ClinicalAnalysisGroupRecord,
  ClinicalArmRecord,
  ClinicalEndpointRecord,
  ClinicalEndpointRole,
  ClinicalOutcomeRecord,
  ClinicalStudyRecord,
} from "./types";

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
  status: string;
  primaryRegistryId?: string;
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
  focalStudies: StudySummaryView[];
  linkedStudies: StudySummaryView[];
};

/** A study summary tagged with its relation to the asset it is previewed under. */
export type PreviewStudy = StudySummaryView & {
  relation: "focal" | "linked";
};

/**
 * Compact, asset-scoped clinical preview for the Program Drawer. Precomputed
 * server-side so the client drawer never imports the clinical data layer; the
 * merge/cap policy lives here in the read model, not in the UI.
 */
export type AssetStudyPreview = {
  companyId: string;
  assetId: string;
  /** Capped list (see {@link getAssetStudyPreview}); focal entries come first. */
  studies: PreviewStudy[];
  /** Uncapped focal + linked total, for the "View all" affordance. */
  totalCount: number;
  href: string;
};

/** Max studies shown in the drawer preview, and the reserved-linked split. */
const PREVIEW_LIMIT = 5;
const PREVIEW_LINKED_RESERVED = 1;

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

function toStudySummary(study: ClinicalStudyRecord): StudySummaryView {
  return {
    id: study.id,
    companyId: study.companyId,
    assetId: study.assetId,
    officialTitle: study.officialTitle,
    acronym: study.acronym,
    title: study.acronym?.trim() || study.officialTitle,
    phase: study.phase,
    status: study.status,
    primaryRegistryId: study.registryIdentifiers[0]?.id,
  };
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

  return {
    companyId,
    assetId,
    assetName: clinicalAssetNameByKey.get(key) ?? assetId,
    companyName: companyNameById.get(companyId),
    focalStudies: toSummaries(entry?.focalStudyIds ?? []),
    linkedStudies: toSummaries(entry?.linkedStudyIds ?? []),
  };
}

/**
 * Compact clinical preview for the Program Drawer. Caps at {@link PREVIEW_LIMIT}
 * studies: when linked/comparator studies exist, reserve up to
 * {@link PREVIEW_LINKED_RESERVED} slot(s) for them so the comparator relationship
 * is represented without crowding out focal studies; otherwise the whole budget
 * goes to focal studies. Returns `undefined` when the asset has no evidence.
 */
export function getAssetStudyPreview(
  companyId: string,
  assetId: string,
): AssetStudyPreview | undefined {
  const view = getAssetStudies(companyId, assetId);
  const totalCount =
    (view?.focalStudies.length ?? 0) + (view?.linkedStudies.length ?? 0);
  if (!view || totalCount === 0) {
    return undefined;
  }

  const linkedShown = view.linkedStudies.slice(
    0,
    Math.min(view.linkedStudies.length, PREVIEW_LINKED_RESERVED),
  );
  const focalShown = view.focalStudies.slice(0, PREVIEW_LIMIT - linkedShown.length);

  const studies: PreviewStudy[] = [
    ...focalShown.map((study) => ({ ...study, relation: "focal" as const })),
    ...linkedShown.map((study) => ({ ...study, relation: "linked" as const })),
  ];

  return {
    companyId,
    assetId,
    studies,
    totalCount,
    href: `/assets/${companyId}/${assetId}`,
  };
}

/** Entry-point gating: does this asset have any focal or linked clinical study. */
export function hasClinicalEvidence(
  companyId: string,
  assetId: string,
): boolean {
  const entry = clinicalAssetIndexByKey.get(assetKeyOf(companyId, assetId));
  return Boolean(
    entry &&
      (entry.focalStudyIds.length > 0 || entry.linkedStudyIds.length > 0),
  );
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
