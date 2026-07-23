import type {
  ArmView,
  OutcomeView,
  StudyDetailView,
} from "@/domains/app/lib/clinical-evidence/selectors";
import {
  canonicalizeClinicalAnalysisPopulation,
  canonicalizeClinicalEstimand,
} from "@/domains/clinical-evidence/lib/clinical-term-canonicalization.mjs";
import type { ClinicalStudyRecord } from "@/domains/clinical-evidence/lib/types";
import { getAnalysisPopulationRank, getEstimandRank } from "./policy";
import type { EfficacyBetweenArmValue, EfficacyValue } from "./representative";

/**
 * Direct head-to-head detection.
 *
 * Arm co-presence never qualifies a pair. Two distinct entities appearing in one
 * Study says nothing about whether they were compared — the Outcome graph has to
 * show it, either as a stored between-arm estimate or as arm-level results the
 * source reported together in one comparison group.
 */

export type ComparisonEntity = {
  key: string;
  label: string;
  /** Present when the entity resolves to a registry asset. */
  companyId?: string;
  assetId?: string;
  /** True when only free text identifies it, so the UI can flag it. */
  unresolved: boolean;
};

/**
 * Resolves one Arm to a comparison entity.
 *
 * Order matters: an internal `linkedAsset` wins, then a focal experimental Arm falls
 * back to the Study's own unit, then an external comparator keeps its authored free
 * text as an unresolved entity.
 *
 * `arm.label` is deliberately **never** an identity. Labels carry dose ("Semaglutide
 * 2.4 mg" vs "Semaglutide 1.0 mg"), so using them would turn every dose-ranging
 * study into a fake head-to-head.
 */
export function resolveArmEntity(
  arm: ArmView,
  study: ClinicalStudyRecord,
): ComparisonEntity | null {
  if (arm.role === "placebo") return null;

  if (arm.linkedAssetRef) {
    const { companyId, assetId } = arm.linkedAssetRef;
    return {
      key: `asset:${companyId}/${assetId}`,
      label: arm.linkedAssetName ?? assetId,
      companyId,
      assetId,
      unresolved: false,
    };
  }

  if (arm.role === "experimental") {
    if (study.regimenId) {
      return {
        key: `regimen:${study.regimenId}`,
        label: study.regimenId,
        unresolved: false,
      };
    }
    return {
      key: `asset:${study.companyId}/${study.assetId}`,
      label: study.assetId,
      companyId: study.companyId,
      assetId: study.assetId,
      unresolved: false,
    };
  }

  // External or unresolved comparator: keep the authored text verbatim. Dropping it
  // would silently lose real head-to-head studies whose comparator was never linked.
  const label = arm.linkedAssetName ?? arm.intervention;
  return { key: `external:${label}`, label, unresolved: true };
}

/**
 * Both proof kinds are reported when both exist, never one hiding the other — the
 * same rule the cross-trial rows use for their arm-level metric and any stored
 * between-arm estimate. `armLevel` is the shared arm-level metric; `betweenArm` is
 * whatever direct estimate the source published for the same pair, alongside it.
 */
export type HeadToHeadEvidence = {
  armLevel: EfficacyValue[];
  betweenArm: EfficacyBetweenArmValue[];
};

export type HeadToHeadPair = {
  studyId: string;
  studyTitle: string;
  phase: string;
  population: string;
  duration: string | null;
  endpointName: string;
  assessmentTimepoint: string;
  left: ComparisonEntity;
  right: ComparisonEntity;
  evidence: HeadToHeadEvidence;
  href: string;
};

function pairKey(a: ComparisonEntity, b: ComparisonEntity): string {
  return [a.key, b.key].sort().join(" :: ");
}

function toValue(view: OutcomeView, armById: Map<string, ArmView>): EfficacyValue {
  const label = view.groupLabel
    ? view.groupLabel
    : (view.outcome.armIds ?? [])
        .map((armId) => armById.get(armId)?.label ?? armId)
        .join(" / ");
  return {
    value: view.outcome.result.value,
    unit: view.outcome.result.unit,
    label,
    armRole: armById.get((view.outcome.armIds ?? [])[0])?.role ?? "other",
    outcomeId: view.outcome.id,
    resultType: view.outcome.result.resultType,
    armIds: view.outcome.armIds,
    analysisGroupId: view.outcome.analysisGroupId,
    maturity: view.outcome.maturity,
  };
}

function rankIsBetter(a: [number, number], b: [number, number]): boolean {
  return a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1];
}

/**
 * One (population, estimand) analysis axis within an endpoint. A Study can report
 * the same pair on more than one axis — SURMOUNT-5 publishes both a full-analysis-
 * set/modified-treatment-regimen estimate and a separate efficacy-analysis-set/
 * efficacy-estimand one for tirzepatide vs semaglutide, with different numbers on
 * each. Keeping axes apart, rather than pooling every Outcome that mentions the
 * pair, is what stops those two numbers from being shown as if they were one.
 */
type Axis = {
  populationRank: number;
  estimandRank: number;
  byEntity: Map<string, { entity: ComparisonEntity; views: OutcomeView[] }>;
  betweenArm: Map<
    string,
    { entities: [ComparisonEntity, ComparisonEntity]; views: OutcomeView[] }
  >;
};

/**
 * Finds every entity pair this Study actually compared, proven from its body-weight
 * Outcomes.
 *
 * Two qualifying proofs, and nothing else:
 *   (a) a stored between-arm Outcome whose arms resolve to two distinct entities;
 *   (b) arm-level Outcomes for two distinct entities inside one endpoint and one
 *       canonicalized analysis population + estimand — i.e. results the source
 *       reported together.
 *
 * When a pair is provable on more than one axis, only the best-ranked axis — by the
 * same population/estimand policy `selectRepresentative` uses — is reported. Its
 * arm-level and between-arm evidence are never pooled across axes: that would
 * attribute one axis's between-arm estimate to another axis's arm-level values, or
 * show the same two products twice with two different, uncombinable reductions.
 */
export function findHeadToHeadPairs(detail: StudyDetailView): HeadToHeadPair[] {
  const { study, arms } = detail;
  const armById = new Map(arms.map((arm) => [arm.id, arm]));
  const entityByArmId = new Map<string, ComparisonEntity>();
  for (const arm of arms) {
    const entity = resolveArmEntity(arm, study);
    if (entity) entityByArmId.set(arm.id, entity);
  }

  const pairs = new Map<string, HeadToHeadPair>();

  for (const endpointGroup of detail.endpointGroups) {
    if (endpointGroup.endpoint.domain !== "body weight") continue;

    const base = {
      studyId: study.id,
      studyTitle: study.acronym?.trim() || study.officialTitle,
      phase: study.phase,
      population: study.population,
      duration: study.overallDuration ?? null,
      endpointName: endpointGroup.endpoint.name,
      assessmentTimepoint: endpointGroup.endpoint.assessmentTimepoint,
      href: `/studies/${study.id}`,
    };

    const axisByKey = new Map<string, Axis>();
    const getAxis = (population: string, estimand: string | undefined): Axis => {
      const key = `${canonicalizeClinicalAnalysisPopulation(population)}|${canonicalizeClinicalEstimand(estimand)}`;
      const existing = axisByKey.get(key);
      if (existing) return existing;
      const created: Axis = {
        populationRank: getAnalysisPopulationRank(population),
        estimandRank: getEstimandRank(estimand),
        byEntity: new Map(),
        betweenArm: new Map(),
      };
      axisByKey.set(key, created);
      return created;
    };

    for (const view of endpointGroup.outcomes) {
      const { outcome } = view;

      if (outcome.result.resultType === "arm-level") {
        const axis = getAxis(outcome.analysisPopulation, outcome.estimand);
        for (const armId of outcome.armIds ?? []) {
          const entity = entityByArmId.get(armId);
          if (!entity) continue;
          const bucket = axis.byEntity.get(entity.key);
          if (bucket) bucket.views.push(view);
          else axis.byEntity.set(entity.key, { entity, views: [view] });
        }
        continue;
      }

      if (outcome.result.resultType !== "between-arm") continue;

      // A between-arm Outcome is ONE reported comparison, so it proves exactly one
      // pair. Enumerating its arms pairwise would copy a single stored number onto
      // several pairs and assert comparisons the source never made.
      const entities = Array.from(
        new Map(
          (outcome.armIds ?? [])
            .map((armId) => entityByArmId.get(armId))
            .filter((entity): entity is ComparisonEntity => Boolean(entity))
            .map((entity) => [entity.key, entity]),
        ).values(),
      );

      // Fewer than two entities: a dose comparison within one entity, or an
      // estimate anchored on placebo. Neither is a head-to-head.
      if (entities.length < 2) continue;

      if (entities.length > 2) {
        throw new Error(
          `Efficacy Comparison: between-arm Outcome "${outcome.id}" in study "${study.id}" ` +
            `resolves ${entities.length} distinct comparison entities ` +
            `(${entities.map((entity) => entity.key).join(", ")}); a single stored estimate ` +
            `cannot be attributed to more than one entity pair`,
        );
      }

      const axis = getAxis(outcome.analysisPopulation, outcome.estimand);
      const key = pairKey(entities[0], entities[1]);
      const bucket = axis.betweenArm.get(key) ?? {
        entities: [entities[0], entities[1]] as [ComparisonEntity, ComparisonEntity],
        views: [],
      };
      bucket.views.push(view);
      axis.betweenArm.set(key, bucket);
    }

    // For every pair provable on some axis, keep only the best-ranked axis.
    const bestAxisForPair = new Map<
      string,
      { rank: [number, number]; axisKey: string; entities: [ComparisonEntity, ComparisonEntity] }
    >();
    for (const [axisKey, axis] of axisByKey) {
      const rank: [number, number] = [axis.populationRank, axis.estimandRank];

      const entries = [...axis.byEntity.values()];
      for (let i = 0; i < entries.length; i += 1) {
        for (let j = i + 1; j < entries.length; j += 1) {
          const key = pairKey(entries[i].entity, entries[j].entity);
          const current = bestAxisForPair.get(key);
          if (!current || rankIsBetter(rank, current.rank)) {
            bestAxisForPair.set(key, {
              rank,
              axisKey,
              entities: [entries[i].entity, entries[j].entity],
            });
          }
        }
      }

      for (const [key, bucket] of axis.betweenArm) {
        const current = bestAxisForPair.get(key);
        if (!current || rankIsBetter(rank, current.rank)) {
          bestAxisForPair.set(key, { rank, axisKey, entities: bucket.entities });
        }
      }
    }

    // A pair already set by an earlier endpointGroup is left alone — dedup stays
    // scoped to the first endpointGroup that proved it, same as before.
    for (const [key, best] of bestAxisForPair) {
      if (pairs.has(key)) continue;
      const axis = axisByKey.get(best.axisKey)!;
      const betweenArmBucket = axis.betweenArm.get(key);
      const [entityA, entityB] = betweenArmBucket?.entities ?? best.entities;
      const armLevelViews = [
        ...(axis.byEntity.get(entityA.key)?.views ?? []),
        ...(axis.byEntity.get(entityB.key)?.views ?? []),
      ];

      pairs.set(key, {
        ...base,
        left: entityA,
        right: entityB,
        evidence: {
          armLevel: armLevelViews.map((view) => toValue(view, armById)),
          betweenArm: (betweenArmBucket?.views ?? []).map((view) => ({
            ...toValue(view, armById),
            effectMeasure: view.outcome.result.effectMeasure,
            comparisonType: view.outcome.result.comparisonType,
            confidenceInterval: view.outcome.result.confidenceInterval,
            pValue: view.outcome.result.pValue,
          })),
        },
      });
    }
  }

  return [...pairs.values()];
}
