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

export type HeadToHeadEvidence =
  | { kind: "between-arm"; outcomeId: string; values: EfficacyBetweenArmValue[] }
  | { kind: "arm-level"; groupKey: string; values: EfficacyValue[] };

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
    armRole:
      armById.get((view.outcome.armIds ?? [])[0])?.role ?? "other",
    outcomeId: view.outcome.id,
  };
}

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
 * Arm-level results from different comparison groups are never combined, and the Arm
 * list is never enumerated pairwise.
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

    // (a) stored direct estimates
    for (const view of endpointGroup.outcomes) {
      if (view.outcome.result.resultType !== "between-arm") continue;
      const entities = Array.from(
        new Map(
          (view.outcome.armIds ?? [])
            .map((armId) => entityByArmId.get(armId))
            .filter((entity): entity is ComparisonEntity => Boolean(entity))
            .map((entity) => [entity.key, entity]),
        ).values(),
      );
      for (let i = 0; i < entities.length; i += 1) {
        for (let j = i + 1; j < entities.length; j += 1) {
          const key = pairKey(entities[i], entities[j]);
          if (pairs.has(key)) continue;
          pairs.set(key, {
            ...base,
            left: entities[i],
            right: entities[j],
            evidence: {
              kind: "between-arm",
              outcomeId: view.outcome.id,
              values: [
                {
                  ...toValue(view, armById),
                  effectMeasure: view.outcome.result.effectMeasure,
                  comparisonType: view.outcome.result.comparisonType,
                  confidenceInterval: view.outcome.result.confidenceInterval,
                  pValue: view.outcome.result.pValue,
                },
              ],
            },
          });
        }
      }
    }

    // (b) arm-level results the source reported together
    const coReported = new Map<string, OutcomeView[]>();
    for (const view of endpointGroup.outcomes) {
      if (view.outcome.result.resultType !== "arm-level") continue;
      const key = [
        endpointGroup.endpoint.id,
        canonicalizeClinicalAnalysisPopulation(view.outcome.analysisPopulation),
        canonicalizeClinicalEstimand(view.outcome.estimand),
      ].join("|");
      const list = coReported.get(key);
      if (list) list.push(view);
      else coReported.set(key, [view]);
    }

    for (const [groupKey, group] of coReported) {
      const byEntity = new Map<string, { entity: ComparisonEntity; views: OutcomeView[] }>();
      for (const view of group) {
        for (const armId of view.outcome.armIds ?? []) {
          const entity = entityByArmId.get(armId);
          if (!entity) continue;
          const bucket = byEntity.get(entity.key);
          if (bucket) bucket.views.push(view);
          else byEntity.set(entity.key, { entity, views: [view] });
        }
      }

      const entries = [...byEntity.values()];
      for (let i = 0; i < entries.length; i += 1) {
        for (let j = i + 1; j < entries.length; j += 1) {
          const key = pairKey(entries[i].entity, entries[j].entity);
          if (pairs.has(key)) continue;
          pairs.set(key, {
            ...base,
            left: entries[i].entity,
            right: entries[j].entity,
            evidence: {
              kind: "arm-level",
              groupKey,
              values: [...entries[i].views, ...entries[j].views].map((view) =>
                toValue(view, armById),
              ),
            },
          });
        }
      }
    }
  }

  return [...pairs.values()];
}
