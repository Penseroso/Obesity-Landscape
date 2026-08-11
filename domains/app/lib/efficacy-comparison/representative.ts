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
  getEndpointRoleRank,
  getEstimandRank,
  getMaturityRank,
} from "./policy";

/**
 * One stored value plus the analysis unit it belongs to. Never a derived figure.
 *
 * `outcomeId` plus the anchor (`armIds` xor `analysisGroupId`) are carried so a
 * consumer or probe can resolve the exact source record. Checking a rendered number
 * against "some value somewhere in the aggregate" would pass even if the row showed
 * a different study's result.
 */
export type EfficacyValue = {
  /** `outcome.result.value`, exactly as stored. */
  value: string;
  unit: string;
  /** Arm label, or analysis-group label for a group-anchored Outcome. */
  label: string;
  armRole: ClinicalArmRole;
  outcomeId: string;
  resultType: "arm-level" | "between-arm";
  armIds?: string[];
  analysisGroupId?: string;
  maturity: ClinicalResultMaturity;
};

export type EfficacyBetweenArmValue = EfficacyValue & {
  effectMeasure?: string;
  comparisonType?: string;
  confidenceInterval?: string;
  pValue?: string;
};

export type RepresentativeEvidence = {
  studyId: string;
  studyCompanyId: string;
  studyAssetId: string;
  sponsorName?: string;
  studyRegion: string;
  developmentScope?: string;
  studyTitle: string;
  phase: string;
  population: string;
  duration: string | null;
  /** Identity of the selected endpoint, not just its display name. */
  endpointId: string;
  endpointName: string;
  endpointRole: ClinicalEndpointRole;
  assessmentTimepoint: string;
  /** The exact comparison group this evidence came from. */
  comparisonGroupKey: string;
  estimand?: string;
  analysisPopulation: string;
  /**
   * The group's **best** maturity — the same figure the ranking used. Reporting the
   * first Outcome's maturity instead would let the row disclose a weaker source than
   * the one that won it its position.
   */
  maturity: ClinicalResultMaturity;
  /** Every distinct maturity in the group, so a mixed group is not flattened. */
  groupMaturities: ClinicalResultMaturity[];
  sourceCount: number;
  /** Experimental arms of the selected group, in authored dose-ascending order. */
  treatmentValues: EfficacyValue[];
  /** Placebo arms of the same Study and the same comparison group. */
  placeboValues: EfficacyValue[];
  /**
   * Active-comparator arms of the same Study and the same comparison group — e.g.
   * liraglutide in STEP 8, semaglutide in SURMOUNT-5. Surfaced as its own
   * same-group reference rather than dropped: an active-comparator study is still a
   * representative arm-level row, and hiding the comparator arm would leave the row's
   * between-arm estimate with no in-group reference to read it against.
   */
  activeComparatorValues: EfficacyValue[];
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
    resultType: view.outcome.result.resultType,
    armIds: view.outcome.armIds,
    analysisGroupId: view.outcome.analysisGroupId,
    maturity: view.outcome.maturity,
  };
}

/**
 * Ranks candidates and builds the representative evidence for the winner.
 *
 * Keys, in order: authored global-development priority, phase tier, endpoint role,
 * estimand, analysis population, source completeness, maturity, then curated source
 * order. Maturity sits late deliberately — the
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
    endpointRoleRank: getEndpointRoleRank(candidate.endpoint.role),
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
      a.candidate.globalEvidencePriority - b.candidate.globalEvidencePriority ||
      a.candidate.phaseTier - b.candidate.phaseTier ||
      a.endpointRoleRank - b.endpointRoleRank ||
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
  const activeComparatorValues = values.filter(
    (value) => value.armRole === "active comparator",
  );

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

  // The ranking used the group's best maturity, so that is what the row discloses.
  // Surfacing the first Outcome's maturity instead would let a row advertise a
  // weaker source than the one that actually won it its position.
  const groupMaturities = Array.from(
    new Set(candidate.group.map((view) => view.outcome.maturity)),
  ).sort((a, b) => getMaturityRank(a) - getMaturityRank(b));
  const bestMaturity = groupMaturities[0];

  // User-facing rationale: the clinical facts the ranking turned on, not the
  // ranking's own plumbing (phase *tier* numbers, candidate counts, tie-break
  // order) — that machinery means nothing to a reader outside this codebase.
  const rationale = [
    ...(candidate.developmentScope
      ? [`Development scope priority: ${candidate.developmentScope}`]
      : []),
    `Phase: ${candidate.study.phase}`,
    `Endpoint role: ${candidate.endpoint.role}`,
    `Estimand: ${anchor.estimand ?? "not reported"}`,
    `Analysis population: ${anchor.analysisPopulation}`,
    `Sources supporting this group: ${winner.sourceCount}`,
    `Best maturity in group: ${bestMaturity}` +
      (groupMaturities.length > 1 ? ` (also ${groupMaturities.slice(1).join(", ")})` : ""),
  ];

  return {
    studyId: candidate.study.id,
    studyCompanyId: candidate.study.companyId,
    studyAssetId: candidate.study.assetId,
    sponsorName: candidate.sponsorName,
    studyRegion:
      candidate.study.populationProfile?.regionRestriction ?? "Not specified",
    developmentScope: candidate.developmentScope,
    studyTitle: candidate.study.acronym?.trim() || candidate.study.officialTitle,
    phase: candidate.study.phase,
    population: candidate.study.population,
    duration: candidate.study.overallDuration ?? null,
    endpointId: candidate.endpoint.id,
    endpointName: candidate.endpoint.name,
    endpointRole: candidate.endpoint.role,
    assessmentTimepoint: candidate.endpoint.assessmentTimepoint,
    comparisonGroupKey: candidate.comparisonGroupKey,
    estimand: anchor.estimand,
    analysisPopulation: anchor.analysisPopulation,
    maturity: bestMaturity,
    groupMaturities,
    sourceCount: winner.sourceCount,
    treatmentValues,
    placeboValues,
    activeComparatorValues,
    storedBetweenArmValues,
    selectionRationale: rationale,
    href: `/studies/${candidate.study.id}`,
  };
}

/** Re-exported so probes can assert both sides draw the same comparison group. */
export { comparisonGroupKeyOf };
