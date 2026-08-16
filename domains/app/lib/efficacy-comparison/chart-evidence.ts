import type {
  ArmView,
  StudyDetailView,
} from "@/domains/app/lib/clinical-evidence/selectors";
import type {
  ClinicalEndpointRole,
  ClinicalResultMaturity,
} from "@/domains/clinical-evidence/lib/types";
import type { EvidenceCandidate } from "./candidates";
import { UNRANKED_ESTIMAND_RANK } from "./policy";
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
  /**
   * The arm's full, verbatim titration text. This stays separate from the
   * resolved dose so same-dose arms can be disambiguated on the chart while
   * the tooltip preserves the complete authored schedule.
   */
  titration?: string;
  /** Protocol Arm identity; distinct arms may share one resolved dose. */
  armId: string;
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
  /** The winning Endpoint's prespecified role — a tooltip-disclosure field
   * only; it plays no part in the dose-axis chart's own selection (that is
   * `compareScoredCandidates`, reused unmodified). */
  role: ClinicalEndpointRole;
  /** Source-reported estimand, verbatim, when the Outcome carries one. */
  estimand?: string;
  assessmentTimepoint: string;
  /**
   * `Endpoint.assessmentTimepointWeeks` (ADR-0067), carried through for the
   * duration-axis trajectory view (`buildChartTrajectorySeries`); `null`
   * wherever the source timepoint has no single on-drug week count.
   */
  assessmentTimepointWeeks: number | null;
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

/** One chart-eligible (dose, arm) observation plus the ranking context both
 * `buildChartDoseSeries` and `buildChartTrajectorySeries` collapse from. */
type ChartEntry = {
  point: ChartDosePoint;
  rank: ScoredCandidate;
  roleRank: number;
  candidateKey: string;
};

/**
 * Gathers every chart-eligible (dose, arm) observation for one unit, across
 * **every** eligible candidate for that unit — not just the winner
 * `selectRepresentative` would pick. Candidates are the exact same list
 * `getEfficacyComparison` already screens per unit (`screenStudy`); this adds
 * no new eligibility gate beyond the dose check below; it only widens *which
 * arm role* within an already-eligible candidate may supply a point.
 *
 * Shared by `buildChartDoseSeries` (collapses to one candidate per resolved
 * dose) and `buildChartTrajectorySeries` (collapses to one estimand-matched
 * group per resolved dose) so the dose/role resolution rules — and any future
 * change to them — can never drift between the two chart views.
 */
function gatherChartEntries(
  candidates: EvidenceCandidate[],
  detailByStudyId: Map<string, StudyDetailView>,
  unitAssets: ChartUnitAsset[],
): ChartEntry[] {
  const entries: ChartEntry[] = [];

  for (const candidate of candidates) {
    const detail = detailByStudyId.get(candidate.study.id);
    if (!detail) continue;
    const armById = new Map(detail.arms.map((arm) => [arm.id, arm]));
    const rank = scoreCandidate(candidate);
    const candidateKey = [
      candidate.study.id,
      candidate.endpoint.id,
      candidate.comparisonGroupKey,
    ].join(" ");

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
        titration: arm.titration?.trim() || undefined,
        armId: arm.id,
        outcomeId: outcome.id,
        value: outcome.result.value,
        unit: outcome.result.unit,
        resultType: "arm-level",
        label: arm.label,
        sourceRole,
        studyId: candidate.study.id,
        studyTitle: candidate.study.acronym?.trim() || candidate.study.officialTitle,
        phase: candidate.study.phase,
        role: candidate.endpoint.role,
        estimand: outcome.estimand,
        assessmentTimepoint: candidate.endpoint.assessmentTimepoint,
        assessmentTimepointWeeks: candidate.endpoint.assessmentTimepointWeeks,
        href: `/studies/${candidate.study.id}`,
        maturity: outcome.maturity,
      };

      entries.push({
        point,
        rank,
        // Experimental evidence wins a same-dose tie over an active
        // comparator's — it is the trial's own headline result for that
        // dose, not a value it happened to also report.
        roleRank: sourceRole === "experimental" ? 0 : 1,
        candidateKey,
      });
    }
  }

  return entries;
}

/**
 * Builds every chart-eligible dose observation for one unit.
 *
 * **The resolved dose is a chart-positioning key, never an evidence-identity
 * key.** `resolveNominalDose` deliberately reduces a deterministic escalation
 * schedule to its final step so it can be placed on a dose axis at all — but
 * two arms that both happen to reach the same final step are not the same
 * evidence. Retatrutide's `"4 mg (2 mg starting dose)"` and `"4 mg (4 mg
 * starting dose)"` are two distinct, separately source-authored Outcomes in
 * the *same* Study testing whether the ramp schedule itself matters;
 * eloralintide's plain `"9 mg"` arm and its two `"X mg escalating to 9 mg"`
 * arms are three distinct Outcomes. Collapsing same-Study arms that resolve
 * to one dose would silently discard exactly the comparison those arms
 * exist to support, so **every arm from the same Study is kept**, however
 * many resolve to the same dose.
 *
 * `compareScoredCandidates` — the page's one evidence ranking, reused
 * unmodified — instead chooses one evidence candidate (Study, Endpoint,
 * comparison group) for a resolved dose. This prevents the same protocol Arm
 * from appearing again through a second timepoint or estimand, while every
 * distinct arm in the winning candidate survives. Source role is a final
 * chart-local tie-break between otherwise equal candidates.
 */
export function buildChartDoseSeries(
  candidates: EvidenceCandidate[],
  detailByStudyId: Map<string, StudyDetailView>,
  unitAssets: ChartUnitAsset[],
): ChartDosePoint[] {
  const byDose = new Map<string, ChartEntry[]>();
  for (const entry of gatherChartEntries(candidates, detailByStudyId, unitAssets)) {
    const list = byDose.get(entry.point.dose) ?? [];
    list.push(entry);
    byDose.set(entry.point.dose, list);
  }

  const winners: ChartDosePoint[] = [];
  for (const entries of byDose.values()) {
    const byCandidate = new Map<string, ChartEntry[]>();
    for (const entry of entries) {
      const list = byCandidate.get(entry.candidateKey) ?? [];
      list.push(entry);
      byCandidate.set(entry.candidateKey, list);
    }

    if (byCandidate.size === 1) {
      // Every entry belongs to one evidence candidate, so each is a distinct
      // protocol Arm in that candidate and all survive.
      winners.push(...entries.map((entry) => entry.point));
      continue;
    }

    // Rank evidence candidates, then keep every same-dose Arm from the winner.
    const candidatesAtDose = Array.from(byCandidate.values()).map((candidateEntries) => {
      const [best] = candidateEntries.slice().sort((a, b) => a.roleRank - b.roleRank);
      return { best, candidateEntries };
    });
    candidatesAtDose.sort(
      (a, b) =>
        compareScoredCandidates(a.best.rank, b.best.rank) ||
        a.best.roleRank - b.best.roleRank,
    );
    winners.push(...candidatesAtDose[0].candidateEntries.map((entry) => entry.point));
  }

  return winners.sort((a, b) => {
    const aNum = Number.parseFloat(a.dose.match(/\d+(\.\d+)?/)?.[0] ?? "");
    const bNum = Number.parseFloat(b.dose.match(/\d+(\.\d+)?/)?.[0] ?? "");
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
      return aNum - bNum;
    }
    return a.dose.localeCompare(b.dose) || a.outcomeId.localeCompare(b.outcomeId);
  });
}

/**
 * One protocol Arm's weight-loss-over-time trajectory: every timepoint the
 * *same* (Arm, estimand) pairing reports, sourced only from `experimental`
 * arms (an active comparator is a different drug; splicing its dose-response
 * into this unit's own trajectory would misrepresent it as the row's own
 * asset).
 */
export type ChartTrajectorySeries = {
  /** Protocol Arm identity — the series' own grouping key, not `dose`. Two
   * arms that resolve to the same nominal dose (retatrutide's "4 mg (2 mg
   * starting dose)" and "4 mg (4 mg starting dose)") are two distinct
   * Outcomes and therefore two distinct series, never one connected line. */
  armId: string;
  dose: string;
  /** Source-reported estimand shared by every point in this series, verbatim. */
  estimand: string;
  /** Sorted by `assessmentTimepointWeeks` ascending. */
  points: ChartDosePoint[];
};

/**
 * Builds, for each protocol Arm, the single richest same-estimand time series
 * available — the "weight-loss-over-time" alternative to
 * `buildChartDoseSeries`'s one-timepoint-per-dose bars.
 *
 * Grouped by **Arm, not resolved dose**: `resolveNominalDose` deliberately
 * collapses distinct arms to one axis position for the dose chart (see its
 * own doc comment), but a trajectory is a claim that the connected points
 * describe *the same treated cohort over time* — two arms that only happen
 * to reach the same final nominal dose are not that, and connecting them
 * would draw one continuous line through two different populations on two
 * different titration schedules.
 *
 * Within one Arm, points are further split by estimand: a candidate whose
 * estimand is absent or unrecognised (`UNRANKED_ESTIMAND_RANK`) never joins a
 * group, and two candidates that both merely omit an estimand are never
 * treated as a match — see `compareDurationTiebreak`'s identical guard in
 * `representative.ts`, which this mirrors rather than imports (that function
 * is a pairwise comparator for picking one overall winner; this is an N-way
 * partition, a different job over the same rule). Splicing two genuinely
 * different estimands into one line would connect two different analysis
 * assumptions as if they were one continuous measurement.
 *
 * Among one Arm's estimand groups, the group with the most **distinct**
 * timepoints wins — not the group `compareScoredCandidates` would rank
 * highest. That ranking answers "which is the single best evidence," not
 * "which group has the richest time series," and the two questions can
 * disagree: a trial's confirmatory (best-ranked) analysis is often reported
 * at one timepoint while a lower-ranked analysis is reported at several. A
 * tie in timepoint count falls back to the existing estimand preference
 * order (`getEstimandRank`, via `ScoredCandidate.estimandRank`). An Arm whose
 * winning group still has only one timepoint is omitted — a single point is
 * not a trajectory.
 */
export function buildChartTrajectorySeries(
  candidates: EvidenceCandidate[],
  detailByStudyId: Map<string, StudyDetailView>,
  unitAssets: ChartUnitAsset[],
): ChartTrajectorySeries[] {
  const byArm = new Map<string, ChartEntry[]>();
  for (const entry of gatherChartEntries(candidates, detailByStudyId, unitAssets)) {
    if (entry.point.sourceRole !== "experimental") continue;
    if (entry.point.assessmentTimepointWeeks === null) continue;
    if (entry.rank.estimandRank === UNRANKED_ESTIMAND_RANK) continue;
    const list = byArm.get(entry.point.armId) ?? [];
    list.push(entry);
    byArm.set(entry.point.armId, list);
  }

  const series: ChartTrajectorySeries[] = [];
  for (const [armId, armEntries] of byArm) {
    const byEstimandRank = new Map<number, ChartEntry[]>();
    for (const entry of armEntries) {
      const list = byEstimandRank.get(entry.rank.estimandRank) ?? [];
      list.push(entry);
      byEstimandRank.set(entry.rank.estimandRank, list);
    }

    const distinctWeekCount = (group: ChartEntry[]) =>
      new Set(group.map((entry) => entry.point.assessmentTimepointWeeks)).size;

    let winner: ChartEntry[] | null = null;
    let winnerEstimandRank = Number.POSITIVE_INFINITY;
    for (const [estimandRank, group] of byEstimandRank) {
      if (
        !winner ||
        distinctWeekCount(group) > distinctWeekCount(winner) ||
        (distinctWeekCount(group) === distinctWeekCount(winner) &&
          estimandRank < winnerEstimandRank)
      ) {
        winner = group;
        winnerEstimandRank = estimandRank;
      }
    }
    if (!winner || distinctWeekCount(winner) < 2) continue;

    const points = winner
      .map((entry) => entry.point)
      .sort(
        (a, b) => (a.assessmentTimepointWeeks ?? 0) - (b.assessmentTimepointWeeks ?? 0),
      );
    series.push({ armId, dose: points[0].dose, estimand: points[0].estimand ?? "", points });
  }

  return series.sort((a, b) => {
    const aNum = Number.parseFloat(a.dose.match(/\d+(\.\d+)?/)?.[0] ?? "");
    const bNum = Number.parseFloat(b.dose.match(/\d+(\.\d+)?/)?.[0] ?? "");
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
      return aNum - bNum;
    }
    return a.dose.localeCompare(b.dose) || a.armId.localeCompare(b.armId);
  });
}
