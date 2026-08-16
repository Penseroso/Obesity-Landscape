import {
  getAssetStudies,
  getStudyDetail,
  listClinicalAssetKeys,
} from "@/domains/app/lib/clinical-evidence/selectors";
import type { StudyDetailView } from "@/domains/app/lib/clinical-evidence/selectors";
import {
  getEfficacyGlobalAssetMembership,
  type EfficacyGlobalAssetGroup,
} from "@/domains/app/config/efficacy-global-assets";
import {
  furthestDisposition,
  screenStudy,
  type EfficacyDispositionReason,
  type EvidenceCandidate,
} from "./candidates";
import {
  buildChartDoseSeries,
  buildChartTrajectorySeries,
  type ChartDosePoint,
  type ChartTrajectorySeries,
  type ChartUnitAsset,
} from "./chart-evidence";
import { findHeadToHeadGroups, type HeadToHeadGroup } from "./head-to-head";
import {
  efficacyMechanismFamilies,
  getAssetDisplay,
  getRegimenDisplay,
  resolveAssetMechanismFamily,
  resolveRegimenMechanismFamily,
  type EfficacyMechanismFamily,
} from "./mechanism-family";
import { selectRepresentative, type RepresentativeEvidence } from "./representative";

/**
 * Efficacy Comparison read model.
 *
 * Composes the mechanism family (Company/Pipeline) with the representative
 * weight-efficacy evidence (Clinical Evidence), mirroring how
 * `domains/app/lib/company-detail/read-model.ts` composes portfolio and clinical
 * rollup. All record-level joins stay behind the Clinical Evidence selectors; all
 * selection policy stays in this feature's sibling modules; all truncation and
 * layout belong to the component.
 *
 * The view returned here is **complete**: every treatment value, every stored
 * between-arm value, every coverage gap, and every head-to-head pair. How much of
 * it a screen shows is that screen's presentation policy.
 */

export type EfficacyUnitKind = "asset" | "global-asset" | "regimen";

export type EfficacyComparisonRow = {
  unitKey: string;
  unitKind: EfficacyUnitKind;
  name: string;
  companyName: string;
  /** Company slug for the `/companies/[companyId]` route. Display join only. */
  companyId: string;
  /** Stored `technical.mechanism`, verbatim. Null for a regimen. */
  mechanism: string | null;
  /** Asset route; regimens have no detail route today. */
  href: string | null;
  evidence: RepresentativeEvidence;
  /**
   * Chart-only dose evidence, gathered across every eligible candidate for
   * this unit — not just `evidence`'s single winner. Additive: the Overview
   * table never reads this field, and `evidence` above is unaffected by it.
   * See `chart-evidence.ts`.
   */
  chartDoseSeries: ChartDosePoint[];
  /**
   * Chart-only weight-loss-over-time evidence: the richest same-(dose,
   * estimand) series per dose, when one exists with 2+ timepoints. See
   * `buildChartTrajectorySeries`. Additive, same as `chartDoseSeries`.
   */
  chartTrajectorySeries: ChartTrajectorySeries[];
};

export type EfficacyFamilyGroup = {
  family: EfficacyMechanismFamily;
  rows: EfficacyComparisonRow[];
};

export type EfficacyCoverageGap = {
  unitKey: string;
  unitKind: EfficacyUnitKind;
  name: string;
  companyName: string;
  reason: EfficacyDispositionReason | "mechanism-undisclosed" | "regimen-family-unassigned";
  href: string | null;
};

export type EfficacyComparisonView = {
  families: EfficacyFamilyGroup[];
  gaps: EfficacyCoverageGap[];
  headToHead: HeadToHeadGroup[];
  totalUnits: number;
};

type UnitAccumulator = {
  unitKind: EfficacyUnitKind;
  companyId: string;
  assetId?: string;
  /** Set only for a plain "asset" unit — see the key comment below. */
  programId?: string;
  regimenId?: string;
  globalAssetGroup?: EfficacyGlobalAssetGroup;
  studyIds: string[];
};

/**
 * Builds the comparison units.
 *
 * A Study belongs to the regimen unit when it carries `regimenId`, and to the asset
 * unit otherwise — the focal asset/regimen split the Clinical Evidence contract
 * already enforces. Without this, a regimen-mapped Study would be counted under the
 * component asset it happens to be stored beneath.
 *
 * A plain asset unit further keys on `study.programId`. The Entities and Rows
 * contract defines `programId` as the stable combination of company, asset, route,
 * and dosage form — so two Studies under the same molecule but different Programs
 * (Novo Nordisk's subcutaneous-injection and oral-tablet semaglutide, each with its
 * own dose range and its own trials) are pharmacologically distinct products and
 * must never merge into one cross-trial row, which would let the page's single-
 * winner selection silently drop an entire route's evidence. A Study with no
 * `programId` (unmapped) still groups consistently: every such Study coerces to the
 * same `undefined` key segment. Global-asset-group and regimen units are unaffected
 * — they already carry their own explicit identity.
 */
function collectUnits(detailByStudyId: Map<string, StudyDetailView>) {
  const units = new Map<string, UnitAccumulator>();

  for (const { companyId, assetId } of listClinicalAssetKeys()) {
    const assetStudies = getAssetStudies(companyId, assetId);
    if (!assetStudies) continue;

    for (const summary of assetStudies.focalStudies) {
      const detail = getStudyDetail(summary.id);
      if (!detail) continue;
      detailByStudyId.set(summary.id, detail);

      const { study } = detail;
      const globalMembership = study.regimenId
        ? undefined
        : getEfficacyGlobalAssetMembership(study.companyId, study.assetId);
      const key = study.regimenId
        ? `regimen:${study.regimenId}`
        : globalMembership
          ? `global-asset:${globalMembership.group.id}`
          : `asset:${study.companyId}/${study.assetId}/${study.programId}`;

      const existing = units.get(key);
      if (existing) {
        existing.studyIds.push(study.id);
        continue;
      }
      units.set(key, {
        unitKind: study.regimenId
          ? "regimen"
          : globalMembership
            ? "global-asset"
            : "asset",
        companyId: study.companyId,
        assetId: study.regimenId ? undefined : study.assetId,
        programId: study.regimenId || globalMembership ? undefined : study.programId,
        regimenId: study.regimenId,
        globalAssetGroup: globalMembership?.group,
        studyIds: [study.id],
      });
    }
  }

  return units;
}

function resolveGlobalAssetMechanismFamily(group: EfficacyGlobalAssetGroup) {
  const resolutions = group.members.map((member) =>
    resolveAssetMechanismFamily(member.companyId, member.assetId),
  );
  const disclosed = resolutions.filter(
    (
      resolution,
    ): resolution is Extract<(typeof resolutions)[number], { family: object }> =>
      resolution.family !== null,
  );

  if (disclosed.length !== resolutions.length) {
    if (disclosed.length === 0) return resolutions[0];
    throw new Error(
      `Efficacy global asset group "${group.id}" mixes disclosed and undisclosed mechanisms`,
    );
  }

  const familyIds = new Set(disclosed.map((resolution) => resolution.family.id));
  if (familyIds.size !== 1) {
    throw new Error(
      `Efficacy global asset group "${group.id}" spans multiple mechanism families`,
    );
  }
  return disclosed[0];
}

export function getEfficacyComparison(): EfficacyComparisonView {
  const detailByStudyId = new Map<string, StudyDetailView>();
  const units = collectUnits(detailByStudyId);

  const rowsByFamilyId = new Map<string, EfficacyComparisonRow[]>();
  const gaps: EfficacyCoverageGap[] = [];
  const headToHead: HeadToHeadGroup[] = [];
  let evidenceBearingUnits = 0;

  for (const [unitKey, unit] of units) {
    const details = unit.studyIds
      .map((studyId) => detailByStudyId.get(studyId))
      .filter((detail): detail is StudyDetailView => Boolean(detail));

    // Head-to-head qualification is independent of the overview's population and
    // metric gates: a direct comparison is internally controlled, so a diabetic or
    // maintenance population does not invalidate it.
    for (const detail of details) {
      headToHead.push(...findHeadToHeadGroups(detail));
    }

    // Only units with recorded body-weight evidence are counted or dispositioned;
    // an inventory-only asset is simply not part of this surface.
    const weightBearing = details.filter((detail) =>
      detail.endpointGroups.some(
        (group) =>
          group.endpoint.domain === "body weight" && group.outcomes.length > 0,
      ),
    );
    if (weightBearing.length === 0) continue;
    evidenceBearingUnits += 1;

    const globalPrimaryMember = unit.globalAssetGroup?.members
      .slice()
      .sort((a, b) => a.evidencePriority - b.evidencePriority)[0];
    const display =
      unit.unitKind === "regimen"
        ? getRegimenDisplay(unit.regimenId!)
        : unit.unitKind === "global-asset"
          ? {
              ...getAssetDisplay(
                globalPrimaryMember!.companyId,
                globalPrimaryMember!.assetId,
              ),
              name: unit.globalAssetGroup!.displayName,
            }
          : getAssetDisplay(unit.companyId, unit.assetId!, unit.programId);
    const href =
      unit.unitKind === "regimen"
        ? null
        : unit.unitKind === "global-asset"
          ? `/assets/${globalPrimaryMember!.companyId}/${globalPrimaryMember!.assetId}`
          : `/assets/${unit.companyId}/${unit.assetId}`;

    const resolution =
      unit.unitKind === "regimen"
        ? resolveRegimenMechanismFamily(unit.regimenId!)
        : unit.unitKind === "global-asset"
          ? resolveGlobalAssetMechanismFamily(unit.globalAssetGroup!)
          : resolveAssetMechanismFamily(unit.companyId, unit.assetId!);

    if (resolution.family === null) {
      gaps.push({
        unitKey,
        unitKind: unit.unitKind,
        name: display.name,
        companyName: display.companyName,
        reason:
          resolution.reason === "family-unassigned"
            ? "regimen-family-unassigned"
            : "mechanism-undisclosed",
        href,
      });
      continue;
    }

    const candidates: EvidenceCandidate[] = [];
    const reasons: EfficacyDispositionReason[] = [];
    weightBearing.forEach((detail, index) => {
      const globalMember = unit.globalAssetGroup?.members.find(
        (member) =>
          member.companyId === detail.study.companyId &&
          member.assetId === detail.study.assetId,
      );
      const screening = screenStudy(detail, index, globalMember);
      if (screening.reason) reasons.push(screening.reason);
      else candidates.push(...screening.candidates);
    });

    if (candidates.length === 0) {
      gaps.push({
        unitKey,
        unitKind: unit.unitKind,
        name: display.name,
        companyName: display.companyName,
        reason: furthestDisposition(reasons),
        href,
      });
      continue;
    }

    const evidence = selectRepresentative(candidates, detailByStudyId);
    const evidenceDisplay = getAssetDisplay(
      evidence.studyCompanyId,
      evidence.studyAssetId,
    );

    // Chart-only widening target: which asset(s) a registry-linked active
    // comparator arm must resolve to for its evidence to count as this
    // unit's own. A regimen has no single asset identity to match against,
    // so it gets none — see `chart-evidence.ts`.
    const chartUnitAssets: ChartUnitAsset[] =
      unit.unitKind === "regimen"
        ? []
        : unit.unitKind === "global-asset"
          ? unit.globalAssetGroup!.members.map((member) => ({
              companyId: member.companyId,
              assetId: member.assetId,
            }))
          : [{ companyId: unit.companyId, assetId: unit.assetId! }];
    const chartDoseSeries = buildChartDoseSeries(
      candidates,
      detailByStudyId,
      chartUnitAssets,
    );
    const chartTrajectorySeries = buildChartTrajectorySeries(
      candidates,
      detailByStudyId,
      chartUnitAssets,
    );

    const row: EfficacyComparisonRow = {
      unitKey,
      unitKind: unit.unitKind,
      name: display.name,
      companyName:
        unit.unitKind === "global-asset"
          ? evidenceDisplay.companyName
          : display.companyName,
      companyId:
        unit.unitKind === "global-asset"
          ? evidence.studyCompanyId
          : unit.companyId,
      mechanism: display.mechanism,
      href:
        unit.unitKind === "global-asset"
          ? `/assets/${evidence.studyCompanyId}/${evidence.studyAssetId}`
          : href,
      evidence,
      chartDoseSeries,
      chartTrajectorySeries,
    };

    const list = rowsByFamilyId.get(resolution.family.id);
    if (list) list.push(row);
    else rowsByFamilyId.set(resolution.family.id, [row]);
  }

  const families: EfficacyFamilyGroup[] = efficacyMechanismFamilies
    .filter((family) => rowsByFamilyId.has(family.id))
    .map((family) => ({ family, rows: rowsByFamilyId.get(family.id)! }));

  assertUnitPartition(families, gaps, evidenceBearingUnits);

  return {
    families,
    gaps: gaps.sort((a, b) => a.unitKey.localeCompare(b.unitKey)),
    headToHead,
    totalUnits: evidenceBearingUnits,
  };
}

/**
 * Rows plus gaps must account for every evidence-bearing unit exactly once.
 *
 * The retargeted form of the study-family partition invariant in the Clinical
 * Evidence selectors: a future change to family resolution or gating must not be
 * able to render a unit twice — under two mechanism families, say — or drop one
 * silently out of both the comparison and its coverage-gap list.
 */
function assertUnitPartition(
  families: EfficacyFamilyGroup[],
  gaps: EfficacyCoverageGap[],
  expectedUnits: number,
): void {
  const keys = [
    ...families.flatMap((group) => group.rows.map((row) => row.unitKey)),
    ...gaps.map((gap) => gap.unitKey),
  ];
  const unique = new Set(keys);

  if (keys.length !== unique.size || keys.length !== expectedUnits) {
    const counts = new Map<string, number>();
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    const duplicates = [...counts].filter(([, count]) => count > 1).map(([key]) => key);
    throw new Error(
      `Efficacy Comparison unit partition failed: expected ${expectedUnits} units, ` +
        `got ${keys.length} (${unique.size} unique); duplicates [${duplicates.join(", ")}]`,
    );
  }
}
