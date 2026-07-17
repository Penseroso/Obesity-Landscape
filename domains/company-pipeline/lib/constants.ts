import developmentStageRegistry from "@/data/registries/development-stages.json";
import assetAliasTypeSource from "./asset-alias-types.json";
import type { AssetAliasType } from "./types";

export type DevelopmentStageRegistryEntry = {
  id: string;
  label: string;
  family: string;
  aliases: string[];
  sortRank: number;
};

const stageRegistry = developmentStageRegistry as DevelopmentStageRegistryEntry[];

export const developmentStages = stageRegistry
  .slice()
  .sort((a, b) => a.sortRank - b.sortRank || a.label.localeCompare(b.label))
  .map((stage) => stage.label);

export const developmentStatuses = [
  "Planned",
  "Active",
  "On hold",
  "Discontinued",
  "Unknown",
] as const;

/**
 * Contract 1.1 asset alias types. An alias records an asset's former names,
 * confirmed development codes, brand names, or alternative spellings for
 * search and traceability. `assetId` is immutable and `assetName` is the
 * current official canonical name; aliases never redefine identity.
 *
 * The canonical list lives in `asset-alias-types.json` so the TypeScript app
 * and the `scripts/data-registry.mjs` validator share one source of truth.
 */
export const assetAliasTypes = assetAliasTypeSource as readonly AssetAliasType[];

export const developmentStageRank = Object.fromEntries(
  stageRegistry.map((stage) => [stage.label, stage.sortRank]),
) as Record<string, number>;

export const developmentStageFamily = Object.fromEntries(
  stageRegistry.map((stage) => [stage.label, stage.family]),
) as Record<string, string>;

/**
 * Overview stage buckets, derived from the development-stage registry
 * `family` field. Regulatory-development milestones (IND submitted, IND
 * cleared, CTA submitted, CTA approved) stay in their own bucket and are
 * never grouped with a clinical phase. "Phase 1/2" is bucketed with
 * Phase 1 (its registry sortRank, 45, sits closer to the Phase 1 cluster
 * than the Phase 2 cluster).
 */
export type StageBucketId =
  | "preclinical"
  | "regulatory-milestone"
  | "phase-1"
  | "phase-2"
  | "phase-3"
  | "filed-approved";

const stageBucketByFamily: Record<string, StageBucketId> = {
  Unknown: "preclinical",
  Discovery: "preclinical",
  Preclinical: "preclinical",
  "Regulatory-development milestone": "regulatory-milestone",
  "Phase 1": "phase-1",
  "Phase 1/2": "phase-1",
  "Phase 2": "phase-2",
  "Phase 3": "phase-3",
  "Regulatory review": "filed-approved",
  Approved: "filed-approved",
};

export const stageBuckets: { id: StageBucketId; label: string }[] = [
  { id: "preclinical", label: "Preclinical" },
  { id: "regulatory-milestone", label: "Regulatory milestone" },
  { id: "phase-1", label: "Phase 1" },
  { id: "phase-2", label: "Phase 2" },
  { id: "phase-3", label: "Phase 3" },
  { id: "filed-approved", label: "Filed / Approved" },
];

export function getStageBucketId(stage: string): StageBucketId {
  const family = developmentStageFamily[stage];
  return (family && stageBucketByFamily[family]) || "preclinical";
}

/**
 * A regulatory-development milestone stage (IND submitted, IND cleared, CTA
 * submitted, CTA approved) - always distinct from a clinical phase, never
 * approximated as one.
 */
export function isRegulatoryMilestoneStage(stage: string): boolean {
  return getStageBucketId(stage) === "regulatory-milestone";
}

const CLINICAL_PHASE_BUCKET_IDS: readonly StageBucketId[] = [
  "phase-1",
  "phase-2",
  "phase-3",
];

/**
 * Clinical-phase stages: Phase 1-3 only (including sub-phases such as
 * "Phase 1b" and the combined "Phase 1/2" stage), matching the same
 * phase-1/phase-2/phase-3 buckets used by the Company x Development Stage
 * Matrix. Regulatory-development milestones and Filed/Approved are always
 * excluded, so "clinical-phase" has one shared definition across the
 * Overview instead of a separate rank threshold that could drift from the
 * matrix's bucketing.
 */
export const clinicalDevelopmentStages = developmentStages.filter((stage) =>
  CLINICAL_PHASE_BUCKET_IDS.includes(getStageBucketId(stage)),
);
