import { isRegulatoryMilestoneStage } from "@/domains/company-pipeline/lib/constants";

type StageBadgeProps = {
  stage: string;
};

const clinicalClassName =
  "inline-flex items-center whitespace-nowrap rounded-sm border border-border bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground";

// Regulatory-development milestones (IND submitted, IND cleared, CTA
// submitted, CTA approved) get a visually distinct, quieter, dashed-border
// treatment so they read as a different kind of stage from a clinical phase
// at a glance, not just by label text.
const milestoneClassName =
  "inline-flex items-center whitespace-nowrap rounded-sm border border-dashed border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground";

export function StageBadge({ stage }: StageBadgeProps) {
  const className = isRegulatoryMilestoneStage(stage)
    ? milestoneClassName
    : clinicalClassName;

  return <span className={className}>{stage}</span>;
}
