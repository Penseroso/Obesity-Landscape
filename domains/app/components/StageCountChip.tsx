/**
 * Shared count-chip heat scale for stage-distribution matrices (Overview's
 * Company x Development Stage Matrix and Company Detail's per-company stage
 * distribution). One scale, one contrast-checked color per step, so the same
 * count reads as the same color on both screens.
 *
 * Text stays the dark `foreground` color through every tinted step — only
 * the solid `bg-primary` top step (5+) switches to `primary-foreground` —
 * because `primary-foreground` on a partial-alpha primary tint falls below
 * WCAG AA (as low as 2.6:1 at 0.6 alpha); `foreground` clears 4.5:1 at every
 * tinted step up to and including 0.7 alpha (measured 4.82:1).
 */
export function stageCountChipClassName(count: number): string {
  const base =
    "inline-flex h-[26px] min-w-[34px] items-center justify-center rounded-sm border text-sm font-semibold tabular-nums";

  if (count <= 0) {
    return `${base} border-border bg-transparent text-border`;
  }
  if (count === 1) {
    return `${base} border-border bg-[hsl(var(--primary)/0.14)] text-foreground`;
  }
  if (count === 2) {
    return `${base} border-border bg-[hsl(var(--primary)/0.28)] text-foreground`;
  }
  if (count === 3) {
    return `${base} border-border bg-[hsl(var(--primary)/0.45)] text-foreground`;
  }
  if (count === 4) {
    return `${base} border-primary/60 bg-[hsl(var(--primary)/0.7)] text-foreground`;
  }
  return `${base} border-primary bg-primary text-primary-foreground`;
}
