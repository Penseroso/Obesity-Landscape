import {
  getAssetStudies,
  getStudyDetail,
  listClinicalAssetKeys,
} from "@/domains/app/lib/clinical-evidence/selectors";
import type { StudyDetailView } from "@/domains/app/lib/clinical-evidence/selectors";
import {
  furthestDisposition,
  screenStudy,
  type EfficacyDispositionReason,
  type EvidenceCandidate,
} from "./candidates";
import { findHeadToHeadPairs, type HeadToHeadPair } from "./head-to-head";
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

export type EfficacyUnitKind = "asset" | "regimen";

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
  headToHead: HeadToHeadPair[];
  totalUnits: number;
};

type UnitAccumulator = {
  unitKind: EfficacyUnitKind;
  companyId: string;
  assetId?: string;
  regimenId?: string;
  studyIds: string[];
};

/**
 * Builds the comparison units.
 *
 * A Study belongs to the regimen unit when it carries `regimenId`, and to the asset
 * unit otherwise — the focal asset/regimen split the Clinical Evidence contract
 * already enforces. Without this, a regimen-mapped Study would be counted under the
 * component asset it happens to be stored beneath.
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
      const key = study.regimenId
        ? `regimen:${study.regimenId}`
        : `asset:${study.companyId}/${study.assetId}`;

      const existing = units.get(key);
      if (existing) {
        existing.studyIds.push(study.id);
        continue;
      }
      units.set(key, {
        unitKind: study.regimenId ? "regimen" : "asset",
        companyId: study.companyId,
        assetId: study.regimenId ? undefined : study.assetId,
        regimenId: study.regimenId,
        studyIds: [study.id],
      });
    }
  }

  return units;
}

export function getEfficacyComparison(): EfficacyComparisonView {
  const detailByStudyId = new Map<string, StudyDetailView>();
  const units = collectUnits(detailByStudyId);

  const rowsByFamilyId = new Map<string, EfficacyComparisonRow[]>();
  const gaps: EfficacyCoverageGap[] = [];
  const headToHead: HeadToHeadPair[] = [];
  let evidenceBearingUnits = 0;

  for (const [unitKey, unit] of units) {
    const details = unit.studyIds
      .map((studyId) => detailByStudyId.get(studyId))
      .filter((detail): detail is StudyDetailView => Boolean(detail));

    // Head-to-head qualification is independent of the overview's population and
    // metric gates: a direct comparison is internally controlled, so a diabetic or
    // maintenance population does not invalidate it.
    for (const detail of details) {
      headToHead.push(...findHeadToHeadPairs(detail));
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

    const display =
      unit.unitKind === "asset"
        ? getAssetDisplay(unit.companyId, unit.assetId!)
        : getRegimenDisplay(unit.regimenId!);
    const href =
      unit.unitKind === "asset" ? `/assets/${unit.companyId}/${unit.assetId}` : null;

    const resolution =
      unit.unitKind === "asset"
        ? resolveAssetMechanismFamily(unit.companyId, unit.assetId!)
        : resolveRegimenMechanismFamily(unit.regimenId!);

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
      const screening = screenStudy(detail, index);
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

    const row: EfficacyComparisonRow = {
      unitKey,
      unitKind: unit.unitKind,
      name: display.name,
      companyName: display.companyName,
      companyId: unit.companyId,
      mechanism: display.mechanism,
      href,
      evidence: selectRepresentative(candidates, detailByStudyId),
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
