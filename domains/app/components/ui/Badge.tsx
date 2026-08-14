export type BadgeTone =
  | "muted"
  | "accent"
  | "primary"
  | "stage-clinical"
  | "stage-milestone"
  | "phase-1"
  | "phase-2"
  | "phase-3"
  | "phase-4";

const toneClassName: Record<BadgeTone, string> = {
  muted:
    "whitespace-nowrap rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground",
  accent:
    "whitespace-nowrap rounded-full border border-border bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground",
  primary:
    "whitespace-nowrap rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary",
  // Matches StageBadge.tsx's clinicalClassName/milestoneClassName exactly
  // (py-1, not py-0.5, plus an explicit "inline-flex items-center"). That
  // component keeps its own call sites for now; this tone exists so new
  // call sites can adopt the shared primitive instead of re-hand-rolling it.
  "stage-clinical":
    "inline-flex items-center whitespace-nowrap rounded-full border border-border bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground",
  "stage-milestone":
    "inline-flex items-center whitespace-nowrap rounded-full border border-dashed border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground",
  // Matches EfficacyComparison.tsx's phaseTierBadgeClass exactly -
  // documented WCAG-checked hex values, never alter these.
  "phase-1":
    "rounded-full border px-1.5 py-px text-[10px] font-medium leading-none border-[#B45309]/40 bg-[#B45309]/10 text-[#92400E]",
  "phase-2":
    "rounded-full border px-1.5 py-px text-[10px] font-medium leading-none border-[#0369A1]/40 bg-[#0369A1]/10 text-[#0369A1]",
  "phase-3":
    "rounded-full border px-1.5 py-px text-[10px] font-medium leading-none border-[#6D28D9]/40 bg-[#6D28D9]/10 text-[#6D28D9]",
  "phase-4":
    "rounded-full border px-1.5 py-px text-[10px] font-medium leading-none border-[#047857]/40 bg-[#047857]/10 text-[#047857]",
};

export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return <span className={toneClassName[tone]}>{children}</span>;
}
