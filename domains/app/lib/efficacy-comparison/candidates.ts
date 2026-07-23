import { comparisonGroupKeyOf } from "@/domains/app/lib/clinical-evidence/selectors";
import type {
  ArmView,
  OutcomeView,
  StudyDetailView,
} from "@/domains/app/lib/clinical-evidence/selectors";
import type {
  ClinicalArmRole,
  ClinicalEndpointRecord,
  ClinicalStudyRecord,
} from "@/domains/clinical-evidence/lib/types";
import {
  EFFICACY_OVERVIEW_UNIT,
  getEfficacyPhaseTier,
  isOverviewEligibleEndpointRole,
  isResponderResult,
  type EfficacyPhaseTier,
} from "./policy";

/**
 * Candidate discovery and eligibility gates for the cross-trial overview.
 *
 * The selection unit is an **evidence candidate** — one (Study, Endpoint,
 * comparison group) triple — not a Study. Choosing a Study first and an Outcome
 * second would let a Study win on a maturity or source signal that belongs to an
 * Outcome the later step then discards.
 */

/**
 * Why a candidate cannot enter the overview. Ordered as an escalating ladder in
 * `dispositionStages` below, so a unit with several studies can report the single
 * furthest point any of them reached rather than an unordered set of reasons.
 */
export type EfficacyDispositionReason =
  | "population-unclassified"
  | "population-age-restricted"
  | "population-with-type-2-diabetes"
  | "population-mixed-diabetes-status"
  | "population-diabetes-status-not-specified"
  | "population-requires-additional-condition"
  | "population-treatment-context"
  | "design-not-randomized-controlled"
  | "phase-unresolved"
  | "metric-unavailable-percent";

/**
 * How far a Study got. A unit's single reason is the **furthest** stage any of its
 * studies reached, so a unit blocked only by its metric reports that instead of an
 * unrelated sibling study's population.
 */
export const dispositionStages: EfficacyDispositionReason[] = [
  "population-unclassified",
  "population-age-restricted",
  "population-with-type-2-diabetes",
  "population-mixed-diabetes-status",
  "population-diabetes-status-not-specified",
  "population-requires-additional-condition",
  "population-treatment-context",
  "design-not-randomized-controlled",
  "phase-unresolved",
  "metric-unavailable-percent",
];

export type EvidenceCandidate = {
  study: ClinicalStudyRecord;
  studyIndex: number;
  endpoint: ClinicalEndpointRecord;
  endpointIndex: number;
  /** Every Outcome of one comparison group, in curated source order. */
  group: OutcomeView[];
  /** The shared comparison-group key, carried so consumers can cite the exact group. */
  comparisonGroupKey: string;
  groupIndex: number;
  phaseTier: EfficacyPhaseTier;
  arms: ArmView[];
};

/**
 * Resolves the arm roles behind one Outcome, following an analysis group to its
 * member arms when the Outcome is group-anchored.
 */
export function outcomeArmRoles(
  view: OutcomeView,
  arms: ArmView[],
  analysisGroups: { id: string; memberArmIds: string[] }[],
): Set<ClinicalArmRole> {
  const armById = new Map(arms.map((arm) => [arm.id, arm]));
  const armIds = view.outcome.analysisGroupId
    ? (analysisGroups.find((group) => group.id === view.outcome.analysisGroupId)
        ?.memberArmIds ?? [])
    : (view.outcome.armIds ?? []);
  return new Set(
    armIds
      .map((armId) => armById.get(armId)?.role)
      .filter((role): role is ClinicalArmRole => Boolean(role)),
  );
}

/**
 * A comparison group only becomes a candidate when it actually reports the focal
 * treatment.
 *
 * A group carrying only the placebo arm, or only an active comparator, is a real
 * comparison group but says nothing about this unit's efficacy — promoting it would
 * put another asset's number, or a control value, in this unit's row.
 */
function hasFocalTreatmentValue(
  group: OutcomeView[],
  arms: ArmView[],
  analysisGroups: { id: string; memberArmIds: string[] }[],
): boolean {
  return group.some((view) => {
    const roles = outcomeArmRoles(view, arms, analysisGroups);
    return roles.size === 1 && roles.has("experimental");
  });
}

/**
 * G1 — population. Requires an authored profile matching the adult, non-diabetic,
 * general obesity/overweight, initial-treatment boundary.
 *
 * `mixed` and `not-specified` each get their own reason and neither is read as
 * non-diabetic: `mixed` is a stated design fact about a population that includes
 * type 2 diabetes, `not-specified` is the absence of any stated criterion.
 * `regionRestriction` is deliberately **not** consulted — geography does not change
 * what the endpoint measures the way a diabetic or paediatric population does.
 */
function checkPopulation(
  study: ClinicalStudyRecord,
): EfficacyDispositionReason | null {
  const profile = study.populationProfile;
  if (!profile) return "population-unclassified";
  if (profile.ageGroup !== "adult") return "population-age-restricted";
  if (profile.diabetesStatus === "with-type-2-diabetes") {
    return "population-with-type-2-diabetes";
  }
  if (profile.diabetesStatus === "mixed") return "population-mixed-diabetes-status";
  if (profile.diabetesStatus === "not-specified") {
    return "population-diabetes-status-not-specified";
  }
  if (profile.requiresAdditionalCondition) {
    return "population-requires-additional-condition";
  }
  if (profile.treatmentContext !== "initial-treatment") {
    return "population-treatment-context";
  }
  return null;
}

/**
 * G2 — design control. A floor rather than a discriminator against current data,
 * but stated explicitly so uncontrolled or single-arm evidence can never enter.
 * `Randomized withdrawal` fails the exact match and is independently excluded by
 * G1's treatment context.
 */
function checkDesign(
  study: ClinicalStudyRecord,
  arms: ArmView[],
): EfficacyDispositionReason | null {
  const controlled = arms.some(
    (arm) => arm.role === "placebo" || arm.role === "active comparator",
  );
  if (study.design.randomization !== "Randomized" || !controlled) {
    return "design-not-randomized-controlled";
  }
  return null;
}

/**
 * G3 — the overview's single metric: an arm-level percent-change body-weight result.
 *
 * A responder proportion ("% achieving ≥5% reduction") is also arm-level, also
 * `percent`, and also under a body-weight endpoint, so it is excluded explicitly by
 * its `responderThreshold` — otherwise a 92% responder rate would enter the column as
 * a 92% weight change.
 */
function isOverviewOutcome(view: OutcomeView): boolean {
  return (
    view.outcome.result.resultType === "arm-level" &&
    view.outcome.result.unit === EFFICACY_OVERVIEW_UNIT &&
    !isResponderResult(view.outcome.result)
  );
}

export type StudyScreening =
  | { candidates: EvidenceCandidate[]; reason: null }
  | { candidates: []; reason: EfficacyDispositionReason };

/**
 * Screens one Study and returns its eligible candidates, or the single reason it
 * produced none. Gates run in ladder order so the reported reason is the furthest
 * the Study actually got.
 */
export function screenStudy(
  detail: StudyDetailView,
  studyIndex: number,
): StudyScreening {
  const { study, arms } = detail;

  const populationReason = checkPopulation(study);
  if (populationReason) return { candidates: [], reason: populationReason };

  const designReason = checkDesign(study, arms);
  if (designReason) return { candidates: [], reason: designReason };

  const phaseTier = getEfficacyPhaseTier(study.phase);
  if (phaseTier === null) return { candidates: [], reason: "phase-unresolved" };

  const candidates: EvidenceCandidate[] = [];

  detail.endpointGroups.forEach((endpointGroup, endpointIndex) => {
    if (endpointGroup.endpoint.domain !== "body weight") return;
    if (!isOverviewEligibleEndpointRole(endpointGroup.endpoint.role)) return;

    // Comparison-group boundaries come from the primitive the validator shares, so
    // this screen and the data validator always draw the same group.
    const groups = new Map<string, OutcomeView[]>();
    for (const view of endpointGroup.outcomes) {
      if (!isOverviewOutcome(view)) continue;
      const key = comparisonGroupKeyOf(view.outcome);
      const list = groups.get(key);
      if (list) list.push(view);
      else groups.set(key, [view]);
    }

    Array.from(groups.entries()).forEach(([comparisonGroupKey, group], groupIndex) => {
      if (!hasFocalTreatmentValue(group, arms, detail.analysisGroups)) return;
      candidates.push({
        study,
        studyIndex,
        endpoint: endpointGroup.endpoint,
        endpointIndex,
        group,
        comparisonGroupKey,
        groupIndex,
        phaseTier,
        arms,
      });
    });
  });

  if (candidates.length === 0) {
    return { candidates: [], reason: "metric-unavailable-percent" };
  }
  return { candidates, reason: null };
}

/** The furthest stage reached across a unit's studies — its single exclusion reason. */
export function furthestDisposition(
  reasons: EfficacyDispositionReason[],
): EfficacyDispositionReason {
  return reasons.reduce((furthest, reason) =>
    dispositionStages.indexOf(reason) > dispositionStages.indexOf(furthest)
      ? reason
      : furthest,
  );
}
