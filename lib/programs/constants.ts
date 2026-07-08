import developmentStageRegistry from "@/data/registries/development-stages.json";

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

export const developmentStageRank = Object.fromEntries(
  stageRegistry.map((stage) => [stage.label, stage.sortRank]),
) as Record<string, number>;

export const clinicalDevelopmentStages = developmentStages.filter((stage) => {
  const rank = developmentStageRank[stage] ?? 0;
  return rank >= 40;
});

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
