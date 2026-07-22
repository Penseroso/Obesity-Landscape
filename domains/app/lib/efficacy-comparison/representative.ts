import { comparisonGroupKeyOf } from "@/domains/app/lib/clinical-evidence/selectors";
import type {
  ArmView,
  OutcomeView,
  StudyDetailView,
} from "@/domains/app/lib/clinical-evidence/selectors";
import {
  canonicalizeClinicalAnalysisPopulation,
  canonicalizeClinicalEstimand,
} from "@/domains/clinical-evidence/lib/clinical-term-canonicalization.mjs";
import type {
  ClinicalArmRole,
  ClinicalEndpointRole,
  ClinicalResultMaturity,
} from "@/domains/clinical-evidence/lib/types";
import type { EvidenceCandidate } from "./candidates";
import {
  getAnalysisPopulationRank,
  getBestMaturityRank,
  getEstimandRank,
} from "./policy";

/** One stored value plus the analysis unit it belongs to. Never a derived figure. */
export type EfficacyValue = {
  /** `outcome.result.value`, exactly as stored. */
  value: string;
  unit: string;
  /** Arm label, or analysis-group label for a group-anchored Outcome. */
  label: string;
  armRole: ClinicalArmRole;
  outcomeId: string;
};

export type EfficacyBetweenArmValue = EfficacyValue & {
  effectMeasure?: string;
  comparisonType?: string;
  confidenceInterval?: string;
  pValue?: string;
};

export type RepresentativeEvidence = {
  studyId: string;
  studyTitle: string;
  phase: string;
  population: string;
  duration: string | null;
  endpointName: string;
  endpointRole: ClinicalEndpointRole;
  assessmentTimepoint: string;
  estimand?: string;
  analysisPopulation: string;
  maturity: ClinicalResultMaturity;
  sourceCount: number;
  /** Experimental arms of the selected group, in authored dose-ascending order. */
  treatmentValues: EfficacyValue[];
  /** Placebo arms of the same Study and the same comparison group. */
  placeboValues: EfficacyValue[];
  /** Stored between-arm results for the same endpoint/estimand/population. Never computed. */
  storedBetweenArmValues: EfficacyBetweenArmValue[];
  /** One line per ranking key, in the order they were applied. */
  selectionRationale: string[];
  href: string;
};

/** Distinct source URLs backing a group — the "source completeness" ranking key. */
function countSources(group: OutcomeView[]): number {
  const urls = new Set<string>();
  for (const view of group) {
    for (const source of view.outcome.metadata.sources) urls.add(source.url);
  }
  return urls.size;
}

/**
 * Resolves the arm role behind an Outcome.
 *
 * A group-anchored Outcome has no `armIds`, so its role comes from its member arms:
 * a pooled group of experimental arms is a treatment value, a pooled placebo group
 * is a placebo value. A group mixing roles is left as `other` rather than guessed
 * into one side.
 */
function resolveArmRole(
  view: OutcomeView,
  detail: StudyDetailView,
): ClinicalArmRole {
  const armById = new Map(detail.arms.map((arm) => [arm.id, arm]));
  let armIds = view.outcome.armIds ?? [];

  if (view.outcome.analysisGroupId) {
    const group = detail.analysisGroups.find(
      (candidate) => candidate.id === view.outcome.analysisGroupId,
    );
    armIds = group?.memberArmIds ?? [];
  }

  const roles = new Set(
    armIds.map((armId) => armById.get(armId)?.role).filter(Boolean),
  );
  if (roles.size === 1) return [...roles][0] as ClinicalArmRole;
  return "other";
}

function toValue(
  view: OutcomeView,
  detail: StudyDetailView,
  armById: Map<string, ArmView>,
): EfficacyValue {
  const label = view.groupLabel
    ? view.groupLabel
    : (view.outcome.armIds ?? [])
        .map((armId) => armById.get(armId)?.label ?? armId)
        .join(" / ");
  return {
    value: view.outcome.result.value,
    unit: view.outcome.result.unit,
    label,
    armRole: resolveArmRole(view, detail),
    outcomeId: view.outcome.id,
  };
}

/**
 * Ranks candidates and builds the representative evidence for the winner.
 *
 * Keys, in order: phase tier, estimand, analysis population, source completeness,
 * maturity, then curated source order. Maturity sits late deliberately — the
 * contract documents that it conflates finality with venue, so it is too coarse to
 * decide anything more meaningful. Duration and assessment timepoint are **not**
 * keys: both are free text ("Approximately 59 weeks", "Week 68 (48 weeks after
 * randomization)") and ranking them would mean parsing them.
 */
export function selectRepresentative(
  candidates: EvidenceCandidate[],
  detailByStudyId: Map<string, StudyDetailView>,
): RepresentativeEvidence {
  const scored = candidates.map((candidate) => ({
    candidate,
    estimandRank: getEstimandRank(candidate.group[0].outcome.estimand),
    populationRank: getAnalysisPopulationRank(
      candidate.group[0].outcome.analysisPopulation,
    ),
    sourceCount: countSources(candidate.group),
    maturityRank: getBestMaturityRank(
      candidate.group.map((view) => view.outcome.maturity),
    ),
  }));

  scored.sort(
    (a, b) =>
      a.candidate.phaseTier - b.candidate.phaseTier ||
      a.estimandRank - b.estimandRank ||
      a.populationRank - b.populationRank ||
      b.sourceCount - a.sourceCount ||
      a.maturityRank - b.maturityRank ||
      a.candidate.studyIndex - b.candidate.studyIndex ||
      a.candidate.endpointIndex - b.candidate.endpointIndex ||
      a.candidate.groupIndex - b.candidate.groupIndex,
  );

  const winner = scored[0];
  const { candidate } = winner;
  const detail = detailByStudyId.get(candidate.study.id)!;
  const armById = new Map(detail.arms.map((arm) => [arm.id, arm]));

  const values = candidate.group.map((view) => toValue(view, detail, armById));
  // Treatment and placebo are partitioned rather than filtered: reusing the
  // experimental-only logic from the asset table would silently drop the placebo
  // value this page needs to display as its own labelled reference.
  const treatmentValues = values.filter((value) => value.armRole === "experimental");
  const placeboValues = values.filter((value) => value.armRole === "placebo");

  const anchor = candidate.group[0].outcome;
  const anchorEstimand = canonicalizeClinicalEstimand(anchor.estimand);
  const anchorPopulation = canonicalizeClinicalAnalysisPopulation(
    anchor.analysisPopulation,
  );

  // Stored between-arm results for the same endpoint and analysis axes. Present only
  // when the source published them; a difference is never computed from the
  // arm-level values above.
  const endpointGroup = detail.endpointGroups.find(
    (group) => group.endpoint.id === candidate.endpoint.id,
  );
  const storedBetweenArmValues: EfficacyBetweenArmValue[] = (
    endpointGroup?.outcomes ?? []
  )
    .filter(
      (view) =>
        view.outcome.result.resultType === "between-arm" &&
        canonicalizeClinicalEstimand(view.outcome.estimand) === anchorEstimand &&
        canonicalizeClinicalAnalysisPopulation(view.outcome.analysisPopulation) ===
          anchorPopulation,
    )
    .map((view) => ({
      ...toValue(view, detail, armById),
      effectMeasure: view.outcome.result.effectMeasure,
      comparisonType: view.outcome.result.comparisonType,
      confidenceInterval: view.outcome.result.confidenceInterval,
      pValue: view.outcome.result.pValue,
    }));

  const rationale = [
    `Phase tier ${candidate.phaseTier} (${candidate.study.phase})`,
    `Estimand: ${anchor.estimand ?? "not reported"}`,
    `Analysis population: ${anchor.analysisPopulation}`,
    `Sources supporting this group: ${winner.sourceCount}`,
    `Maturity: ${anchor.maturity}`,
    scored.length > 1
      ? `Chosen from ${scored.length} eligible candidates; ties fall to curated source order`
      : "Only eligible candidate for this unit",
  ];

  return {
    studyId: candidate.study.id,
    studyTitle: candidate.study.acronym?.trim() || candidate.study.officialTitle,
    phase: candidate.study.phase,
    population: candidate.study.population,
    duration: candidate.study.overallDuration ?? null,
    endpointName: candidate.endpoint.name,
    endpointRole: candidate.endpoint.role,
    assessmentTimepoint: candidate.endpoint.assessmentTimepoint,
    estimand: anchor.estimand,
    analysisPopulation: anchor.analysisPopulation,
    maturity: anchor.maturity,
    sourceCount: winner.sourceCount,
    treatmentValues,
    placeboValues,
    storedBetweenArmValues,
    selectionRationale: rationale,
    href: `/studies/${candidate.study.id}`,
  };
}

/** Re-exported so probes can assert both sides draw the same comparison group. */
export { comparisonGroupKeyOf };
