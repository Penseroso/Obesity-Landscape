import type {
  ArmView,
  StudyDetailView,
} from "@/domains/app/lib/clinical-evidence/selectors";
import type { ClinicalResultMaturity } from "@/domains/clinical-evidence/lib/types";
import type { EvidenceCandidate } from "./candidates";
import {
  compareScoredCandidates,
  scoreCandidate,
  type ScoredCandidate,
} from "./representative";

/**
 * Chart-only dose evidence.
 *
 * The Overview table's single-representative semantics (`representative.ts`,
 * `read-model.ts`) are unchanged by this module: `selectRepresentative` still
 * picks exactly one (Study, Endpoint, comparison group) per unit, and that
 * remains every row's `evidence`. This module is an **additional**,
 * chart-only consumer of the same per-unit `candidates` list, built for the
 * "Compare programs" chart alone (`EfficacyCompareChart.tsx`), which needs
 * more than one Study's dose evidence to plot a program's tested doses
 * together — something the single winner cannot supply. Nothing here creates
 * a new row, changes ranking semantics, or touches Company/Pipeline or
 * Clinical Evidence identity.
 */

export type ChartSourceRole = "experimental" | "active-comparator";

/** One dose's chart-eligible evidence, with the provenance a tooltip needs. */
export type ChartDosePoint = {
  dose: string;
  outcomeId: string;
  value: string;
  unit: string;
  /** Always "arm-level" — a group-anchored or between-arm Outcome never
   * passes the single-arm dose gate above. */
  resultType: "arm-level";
  label: string;
  /**
   * Preserved, never elided: an active-comparator-sourced point must never
   * render as if it were the trial's own experimental result.
   */
  sourceRole: ChartSourceRole;
  studyId: string;
  studyTitle: string;
  phase: string;
  assessmentTimepoint: string;
  href: string;
  maturity: ClinicalResultMaturity;
};

/**
 * An asset this unit is prepared to accept a **registry-linked active
 * comparator** arm's evidence for, in addition to its own experimental arms.
 * A plain asset unit passes its own single `{companyId, assetId}`; a
 * global-asset unit passes every member; a regimen unit passes none — a
 * regimen has no single asset identity to match an arm's `linkedAssetRef`
 * against, so this widening is skipped for it rather than guessed.
 */
export type ChartUnitAsset = { companyId: string; assetId: string };

/**
 * Conservative "one explicit nominal dose" gate.
 *
 * `EfficacyValue.dose !== undefined` (the existing table-side signal) proves
 * only that the Outcome anchors to exactly one arm — it does **not** prove
 * that arm's `dose` text names a single administered amount. A single arm
 * can still carry an ambiguous range or a maximum-tolerated-dose alternative
 * verbatim, e.g. `"1.7 mg or 2.4 mg maximum tolerated dose"` (live in the
 * dataset: SURMOUNT-5's semaglutide active-comparator arm) or `"10 mg or 15
 * mg maximum tolerated dose"` (its own tirzepatide arm). Admitting either as
 * "2.4 mg" or "15 mg" would be an inference this dataset's Study-level
 * dose text was never authored to support.
 *
 * Two independent, deliberately simple checks — never a full parser:
 * - no ambiguity marker (an alternative-dose or ceiling phrase);
 * - exactly one numeric token in the whole string, so a range ("X to Y"),
 *   an alternative ("X or Y"), or a titration/cohort list ("2/5/10/20 mg")
 *   fails even without matching a marker word.
 *
 * A dose that passes both is grouped by its **exact, verbatim** text — never
 * parsed, reformatted, or reduced further — matching this codebase's
 * existing exact-string-only precedent for other free-text fields (see
 * `entities-and-rows.md#mechanism-family`).
 */
const DOSE_AMBIGUITY_MARKERS =
  /\bor\b|\bmaximum tolerated\b|\bmtd\b|\bup to\b|titrat|escalat|\brange\b/i;

export function isSingleNominalDose(doseText: string): boolean {
  const trimmed = doseText.trim();
  if (trimmed.length === 0) return false;
  if (DOSE_AMBIGUITY_MARKERS.test(trimmed)) return false;
  if (trimmed.includes("/")) return false;
  const numbers = trimmed.match(/\d+(\.\d+)?/g) ?? [];
  return numbers.length === 1;
}

function resolveChartRole(
  arm: ArmView,
  unitAssets: ChartUnitAsset[],
): ChartSourceRole | null {
  if (arm.role === "experimental") return "experimental";
  if (arm.role !== "active comparator") return null;
  if (!arm.linkedAssetRef) return null;
  const isThisUnitsAsset = unitAssets.some(
    (asset) =>
      asset.companyId === arm.linkedAssetRef!.companyId &&
      asset.assetId === arm.linkedAssetRef!.assetId,
  );
  return isThisUnitsAsset ? "active-comparator" : null;
}

/**
 * Builds every chart-eligible dose observation for one unit, across **every**
 * eligible candidate for that unit — not just the winner `selectRepresentative`
 * would pick. Candidates are the exact same list `getEfficacyComparison`
 * already screens per unit (`screenStudy`); this function adds no new
 * eligibility gate beyond the dose check above; it only widens *which arm
 * role* within an already-eligible candidate may supply a point.
 *
 * When more than one point lands on the same exact dose text, the winner is
 * chosen by `compareScoredCandidates` — the page's one evidence ranking,
 * reused unmodified — with source role (experimental before active
 * comparator) as one further, chart-local tie-break after it.
 */
export function buildChartDoseSeries(
  candidates: EvidenceCandidate[],
  detailByStudyId: Map<string, StudyDetailView>,
  unitAssets: ChartUnitAsset[],
): ChartDosePoint[] {
  type Candidate = {
    point: ChartDosePoint;
    rank: ScoredCandidate;
    roleRank: number;
  };

  const byDose = new Map<string, Candidate[]>();

  for (const candidate of candidates) {
    const detail = detailByStudyId.get(candidate.study.id);
    if (!detail) continue;
    const armById = new Map(detail.arms.map((arm) => [arm.id, arm]));
    const rank = scoreCandidate(candidate);

    for (const view of candidate.group) {
      const { outcome } = view;
      const armIds = outcome.armIds ?? [];
      if (outcome.analysisGroupId || armIds.length !== 1) continue;

      const arm = armById.get(armIds[0]);
      if (!arm || !arm.dose) continue;

      const sourceRole = resolveChartRole(arm, unitAssets);
      if (!sourceRole) continue;

      if (!isSingleNominalDose(arm.dose)) continue;

      const point: ChartDosePoint = {
        dose: arm.dose.trim(),
        outcomeId: outcome.id,
        value: outcome.result.value,
        unit: outcome.result.unit,
        resultType: "arm-level",
        label: arm.label,
        sourceRole,
        studyId: candidate.study.id,
        studyTitle: candidate.study.acronym?.trim() || candidate.study.officialTitle,
        phase: candidate.study.phase,
        assessmentTimepoint: candidate.endpoint.assessmentTimepoint,
        href: `/studies/${candidate.study.id}`,
        maturity: outcome.maturity,
      };

      const list = byDose.get(point.dose) ?? [];
      list.push({
        point,
        rank,
        // Experimental evidence wins a same-dose tie over an active
        // comparator's — it is the trial's own headline result for that
        // dose, not a value it happened to also report.
        roleRank: sourceRole === "experimental" ? 0 : 1,
      });
      byDose.set(point.dose, list);
    }
  }

  const winners = Array.from(byDose.values()).map((points) => {
    points.sort(
      (a, b) => compareScoredCandidates(a.rank, b.rank) || a.roleRank - b.roleRank,
    );
    return points[0].point;
  });

  return winners.sort((a, b) => {
    const aNum = Number.parseFloat(a.dose.match(/\d+(\.\d+)?/)?.[0] ?? "");
    const bNum = Number.parseFloat(b.dose.match(/\d+(\.\d+)?/)?.[0] ?? "");
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
      return aNum - bNum;
    }
    return a.dose.localeCompare(b.dose);
  });
}
