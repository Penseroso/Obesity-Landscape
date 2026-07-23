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
import {
  getAnalysisPopulationRank,
  getEstimandRank,
  isResponderResult,
} from "./policy";
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

/** One entity in a group, with the arm-level values the source reported for it. */
export type HeadToHeadEntityValues = {
  entity: ComparisonEntity;
  values: EfficacyValue[];
};

/**
 * A stored between-arm estimate, attributed to the exact pair it compares. Kept
 * pair-scoped inside the group so a 3-arm study can carry, say, only the one direct
 * estimate the source actually published without implying the others.
 */
export type HeadToHeadBetweenArm = {
  left: ComparisonEntity;
  right: ComparisonEntity;
  values: EfficacyBetweenArmValue[];
};

/**
 * One study's direct comparison, as a single card rather than a card per entity pair.
 *
 * A 3-arm study is ONE comparison the source ran, so it is ONE group listing every
 * entity's arm-level value together; enumerating it as C(n,2) pair cards repeated the
 * study and duplicated each bold number. Both proof kinds ride together when both
 * exist — arm-level per entity, and whatever between-arm estimates the source
 * published for specific pairs — never one hiding the other.
 */
export type HeadToHeadGroup = {
  studyId: string;
  studyTitle: string;
  phase: string;
  population: string;
  duration: string | null;
  endpointName: string;
  assessmentTimepoint: string;
  entities: HeadToHeadEntityValues[];
  betweenArm: HeadToHeadBetweenArm[];
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

type GroupBase = Omit<HeadToHeadGroup, "entities" | "betweenArm">;

/**
 * Builds one group from a single axis, or null when the axis holds no comparison
 * (fewer than two distinct entities across its arm-level and between-arm evidence).
 *
 * Entity order is arm-level entities first, in source order, then any entity that
 * appears only in a between-arm estimate — so the heading lists everyone the study
 * compared even when one arm has no standalone arm-level value on this axis.
 */
function buildGroupFromAxis(
  axis: Axis,
  base: GroupBase,
  armById: Map<string, ArmView>,
): HeadToHeadGroup | null {
  const order: ComparisonEntity[] = [];
  const seen = new Set<string>();
  const valuesByKey = new Map<string, EfficacyValue[]>();

  for (const { entity, views } of axis.byEntity.values()) {
    order.push(entity);
    seen.add(entity.key);
    valuesByKey.set(entity.key, views.map((view) => toValue(view, armById)));
  }

  const betweenArm: HeadToHeadBetweenArm[] = [];
  for (const { entities, views } of axis.betweenArm.values()) {
    for (const entity of entities) {
      if (!seen.has(entity.key)) {
        order.push(entity);
        seen.add(entity.key);
      }
    }
    betweenArm.push({
      left: entities[0],
      right: entities[1],
      values: views.map((view) => ({
        ...toValue(view, armById),
        effectMeasure: view.outcome.result.effectMeasure,
        comparisonType: view.outcome.result.comparisonType,
        confidenceInterval: view.outcome.result.confidenceInterval,
        pValue: view.outcome.result.pValue,
      })),
    });
  }

  if (order.length < 2) return null;

  return {
    ...base,
    entities: order.map((entity) => ({
      entity,
      values: valuesByKey.get(entity.key) ?? [],
    })),
    betweenArm,
  };
}

/**
 * Finds the direct comparison this Study reported, proven from its body-weight
 * Outcomes, as one group per study.
 *
 * Two qualifying proofs, and nothing else:
 *   (a) a stored between-arm Outcome whose arms resolve to two distinct entities;
 *   (b) arm-level Outcomes for two distinct entities inside one endpoint and one
 *       canonicalized analysis population + estimand — i.e. results the source
 *       reported together.
 *
 * A study's whole comparison is ONE card. Its entities are read from a single
 * best-ranked (population, estimand) axis — the same policy `selectRepresentative`
 * uses — so numbers are never pooled across two analysis sets (SURMOUNT-5 reports
 * tirzepatide vs semaglutide on both a full-analysis and an efficacy-analysis axis,
 * with different reductions on each). The first body-weight endpoint that yields a
 * comparison wins, mirroring the earlier first-endpoint-wins dedup.
 */
export function findHeadToHeadGroups(detail: StudyDetailView): HeadToHeadGroup[] {
  const { study, arms } = detail;
  const armById = new Map(arms.map((arm) => [arm.id, arm]));
  const entityByArmId = new Map<string, ComparisonEntity>();
  for (const arm of arms) {
    const entity = resolveArmEntity(arm, study);
    if (entity) entityByArmId.set(arm.id, entity);
  }

  for (const endpointGroup of detail.endpointGroups) {
    if (endpointGroup.endpoint.domain !== "body weight") continue;

    const base: GroupBase = {
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

      // A responder proportion shares the body-weight endpoint and percent unit but
      // is a different measure; never mix it into a card of change values.
      if (isResponderResult(outcome.result)) continue;

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

    // Pick the single best-ranked axis that actually holds a comparison, build the
    // study's one group from it, and stop at the first endpoint that yields one.
    let best: { rank: [number, number]; group: HeadToHeadGroup } | null = null;
    for (const axis of axisByKey.values()) {
      const group = buildGroupFromAxis(axis, base, armById);
      if (!group) continue;
      const rank: [number, number] = [axis.populationRank, axis.estimandRank];
      if (!best || rankIsBetter(rank, best.rank)) best = { rank, group };
    }
    if (best) return [best.group];
  }

  return [];
}
