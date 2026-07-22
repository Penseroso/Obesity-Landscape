import {
  canonicalizeClinicalAnalysisPopulation,
  canonicalizeClinicalEstimand,
} from "@/domains/clinical-evidence/lib/clinical-term-canonicalization.mjs";
import type { ClinicalResultMaturity } from "@/domains/clinical-evidence/lib/types";

/**
 * Ordered preference tables for the Efficacy Comparison page.
 *
 * Every table here is a **presentation policy owned by this feature**, not a
 * Clinical Evidence contract rule. Nothing in this file changes what the data
 * means; it only fixes a deterministic order so the same stored records always
 * yield the same representative selection.
 */

/** Rank a candidate's trial design. Lower is preferred. */
export type EfficacyPhaseTier = 1 | 2 | 3 | 4;

/**
 * Trial-phase tiers, keyed on the exact stored `study.phase` text.
 *
 * Deliberately **feature-local**: `study.phase` is open free text in the Clinical
 * Evidence contract, and giving it a global normalized authority would make every
 * future phase spelling a dataset-wide validation failure. An unrecognised phase
 * therefore dispositions one candidate here and leaves the dataset valid.
 *
 * `Phase 4` sits in tier 4 rather than above Phase 3: it is post-approval
 * evidence, and letting it outrank the pivotal development programme would pick a
 * maintenance or label-expansion trial as an asset's representative result.
 */
const phaseTierByPhase = new Map<string, EfficacyPhaseTier>([
  ["Phase 3", 1],
  ["Phase 3a", 1],
  ["Phase 3b", 1],
  ["Phase 2", 2],
  ["Phase 2b", 2],
  ["Phase 1", 3],
  ["Phase 1/Phase 2", 3],
  ["Phase 1b/2a", 3],
  ["Phase 4", 4],
]);

/** Returns null when the stored phase text has no tier — the caller dispositions it. */
export function getEfficacyPhaseTier(phase: string): EfficacyPhaseTier | null {
  return phaseTierByPhase.get(phase) ?? null;
}

/**
 * Estimand preference, in canonicalized form. Treatment-policy first because it is
 * the ICH E9(R1) default and the most consistently reported here; the rest follow
 * in decreasing closeness to "what happened to randomised participants".
 *
 * Matched through the shared canonicalization, so "Treatment-policy estimand",
 * "Treatment policy estimand", and "Treatment policy" are one entry.
 */
const estimandOrder = [
  "treatment policy",
  "treatment regimen",
  "modified treatment regimen",
  "efficacy",
  "trial product",
  "hypothetical",
  "treatment",
];

export function getEstimandRank(estimand: string | undefined): number {
  const canonical = canonicalizeClinicalEstimand(estimand);
  const index = estimandOrder.indexOf(canonical);
  // An unlisted or absent estimand sorts last rather than being rejected: the
  // vocabulary is open by contract, and a candidate may still be the only one.
  return index === -1 ? estimandOrder.length : index;
}

/**
 * Analysis-set preference. Ranked on the **analysis set only**; a trailing
 * subgroup parenthetical does not change the rank, so two analyses of the same
 * set fall through to curated source order rather than being ordered by a
 * judgement about which subgroup matters.
 */
const analysisSetOrder = [
  "full analysis set",
  "intention to treat",
  "modified intention to treat",
  "efficacy analysis set",
  "all randomized participants",
];

export function getAnalysisPopulationRank(analysisPopulation: string): number {
  const canonical = canonicalizeClinicalAnalysisPopulation(analysisPopulation);
  const setText = canonical.split("(")[0];
  const index = analysisSetOrder.indexOf(setText);
  return index === -1 ? analysisSetOrder.length : index;
}

/**
 * Maturity preference, venue-first.
 *
 * Used only as a **late tie-breaker**, after source completeness. The Clinical
 * Evidence contract documents that `maturity` conflates finality with publication
 * venue, so it is too coarse to decide between candidates that differ on anything
 * more meaningful.
 */
const maturityOrder: ClinicalResultMaturity[] = [
  "peer-reviewed publication",
  "registry result",
  "conference result",
  "final",
  "topline",
  "interim",
];

export function getMaturityRank(maturity: ClinicalResultMaturity): number {
  const index = maturityOrder.indexOf(maturity);
  return index === -1 ? maturityOrder.length : index;
}

/** Best (lowest) maturity rank across a set of outcomes. */
export function getBestMaturityRank(
  maturities: ClinicalResultMaturity[],
): number {
  return maturities.reduce(
    (best, maturity) => Math.min(best, getMaturityRank(maturity)),
    maturityOrder.length,
  );
}

/**
 * The one metric the cross-trial overview compares: percent change from baseline
 * in body weight.
 *
 * `kg` is not a fallback and `percentage points` is not a substitute — absolute
 * change, relative change, and a placebo-adjusted difference are three different
 * measures, and putting them in one column would make the column meaningless.
 * Converting between them is forbidden outright.
 */
export const EFFICACY_OVERVIEW_UNIT = "percent";
