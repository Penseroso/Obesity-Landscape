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
  /**
   * Resolved nominal dose: the final, highest-administered step for a
   * deterministic escalation schedule, or the arm's `dose` text verbatim
   * when it already named exactly one amount. This is the exact-match
   * bucket key and the axis label — see `resolveNominalDose`.
   */
  dose: string;
  /**
   * The arm's full, verbatim `dose` text, set only when it differs from
   * `dose` above (i.e. `dose` was resolved from a multi-step schedule) — so
   * a bar showing "20 mg" still discloses the full "2 mg, 5 mg, 10 mg, and
   * 20 mg" schedule it was reduced from, rather than silently dropping it.
   * Never itself parsed or rewritten.
   */
  doseSchedule?: string;
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
 * Conservative dose resolution: returns the arm's resolved nominal dose, or
 * `null` when the text cannot be conservatively attributed to one.
 *
 * `EfficacyValue.dose !== undefined` (the existing table-side signal) proves
 * only that the Outcome anchors to exactly one arm — it does **not** prove
 * that arm's `dose` text names a single administered amount. A single arm
 * can still carry a genuinely **individualized, uncertain** alternative —
 * e.g. `"1.7 mg or 2.4 mg maximum tolerated dose"` (live in the dataset:
 * SURMOUNT-5's semaglutide active-comparator arm), where which dose a given
 * participant actually received varies by tolerability and is not fixed by
 * protocol. That is never resolvable, so it is rejected outright, regardless
 * of number count.
 *
 * A **deterministic escalation schedule** is different: every participant in
 * the arm follows the same protocol-defined steps to the same final,
 * highest-administered dose (`"2 mg, 5 mg, 10 mg, and 20 mg"`, live for
 * ASC30's MAD cohort; `"6 mg escalating to 9 mg"`, live for eloralintide).
 * That final step is resolved and used, mirroring this codebase's own
 * existing precedent for exactly this shape in `extractDoseAxisLabel`
 * (`EfficacyCompareChart.tsx`), which already reduces a slash-joined
 * escalation to its highest step for axis-label purposes. The full schedule
 * is preserved verbatim in `ChartDosePoint.doseSchedule` so a bar reading
 * "20 mg" still discloses, on hover, that it reflects a ramp through lower
 * doses first — never silently presented as if the arm were dosed at 20 mg
 * from day one.
 *
 * Checks, never a full parser:
 * - reject outright on an individualized/uncertain-alternative marker ("or",
 *   "maximum tolerated dose", "MTD", "up to") — applied first and
 *   unconditionally, so nothing below ever overrides it;
 * - otherwise, two narrow, explicit shapes that name exactly one
 *   configuration despite carrying more than one number:
 *   - **combination**: two or more named components each at their own fixed
 *     amount, joined by "plus" (`"Cagrilintide 2.4 mg plus semaglutide
 *     2.4 mg"`, live for CagriSema) — accepted, verbatim, only when every
 *     `"plus"`-separated segment independently carries exactly one number;
 *   - **split/multiplier**: a small integer count of one fixed amount
 *     (`"2 x 25 mg"`, live for amycretin's split-tablet MAD cohort) —
 *     accepted verbatim;
 * - otherwise, every `number+unit` token in the string (`"20 mg"`, `"9 mg"`)
 *   is extracted; one token resolves to itself, two or more resolve to the
 *   **last** (a deterministic schedule's final step, per the ASC30/
 *   eloralintide precedent above) — this also transparently covers a
 *   compact slash-joined list (`"2/5/10/20 mg"`) with no special-casing,
 *   since only its trailing number carries an adjacent unit.
 *
 * A resolved dose is grouped by its **exact** resolved text — never parsed,
 * reformatted, or reduced further beyond the one step above — matching this
 * codebase's existing exact-string-only precedent for other free-text
 * fields (see `entities-and-rows.md#mechanism-family`).
 */
const DOSE_UNCERTAINTY_MARKERS = /\bor\b|\bmaximum tolerated\b|\bmtd\b|\bup to\b/i;

const SPLIT_DOSE_PATTERN =
  /^\d+\s*[x×]\s*\d+(\.\d+)?\s*(mg|mcg|µg|g|mL|IU|units?)\b/i;

const DOSE_TOKEN_PATTERN = /\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|mL|IU|units?)\b/gi;

function isCombinationDose(trimmed: string): boolean {
  const segments = trimmed.split(/\bplus\b/i);
  if (segments.length < 2) return false;
  return segments.every(
    (segment) => (segment.match(/\d+(\.\d+)?/g) ?? []).length === 1,
  );
}

export function resolveNominalDose(doseText: string): string | null {
  const trimmed = doseText.trim();
  if (trimmed.length === 0) return null;
  if (DOSE_UNCERTAINTY_MARKERS.test(trimmed)) return null;
  if (isCombinationDose(trimmed)) return trimmed;
  if (SPLIT_DOSE_PATTERN.test(trimmed)) return trimmed;
  const tokens = trimmed.match(DOSE_TOKEN_PATTERN) ?? [];
  if (tokens.length === 0) return null;
  return tokens[tokens.length - 1].trim();
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

      const resolvedDose = resolveNominalDose(arm.dose);
      if (!resolvedDose) continue;

      const point: ChartDosePoint = {
        dose: resolvedDose,
        doseSchedule: resolvedDose === arm.dose.trim() ? undefined : arm.dose.trim(),
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
