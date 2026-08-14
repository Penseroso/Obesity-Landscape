"use client";

import { CollapsibleSection } from "./CollapsibleSection";
import { MixStack } from "./MixStack";
import type { MechanismMixEntry } from "@/domains/company-pipeline/lib/selectors";

type MechanismMixPanelProps = {
  entries: MechanismMixEntry[];
};

/**
 * Fixed six-hue categorical order: the documented default palette from the
 * dataviz skill (`references/palette.md`), validated CVD-safe and re-checked
 * against this app's `--card` surface (#fcfaf8). Only six slots are ever
 * used because `getMechanismMix` caps the mix to six families; "Other
 * mechanisms" and "Mechanism undisclosed" are residual, non-identity
 * buckets and take neutral grays instead of an eighth categorical hue.
 *
 * Relies on `getMechanismMix`'s documented ordering (families first, in
 * order, then "Other mechanisms", then "Mechanism undisclosed") to assign
 * palette slots by array index without re-deriving family rank here.
 */
const FAMILY_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
];
const OTHER_COLOR = "hsl(var(--muted-foreground))";
const UNDISCLOSED_COLOR = "hsl(var(--border))";

function colorForEntry(entry: MechanismMixEntry, index: number): string {
  if (entry.kind === "family") return FAMILY_COLORS[index % FAMILY_COLORS.length];
  if (entry.kind === "other") return OTHER_COLOR;
  return UNDISCLOSED_COLOR;
}

/**
 * Program Register drill-down, mirroring the Company × Development Stage
 * Matrix's `stageBucket` link (`CompanyStageMatrix.tsx`). Resolves by
 * registry family id, matching `filterPrograms`'s `matchesMechanismFamily`
 * exactly - so the linked register shows precisely this slice's programs.
 *
 * "Other mechanisms" has no such id: it is this panel's own top-N residual
 * aggregate, not a stable, filterable identity, so it never links out.
 */
function hrefForEntry(entry: MechanismMixEntry): string | null {
  if (entry.kind === "family") {
    return `/assets?mechanismFamily=${encodeURIComponent(entry.familyId!)}`;
  }
  if (entry.kind === "undisclosed") {
    return "/assets?mechanismFamily=undisclosed";
  }
  return null;
}

export function MechanismMixPanel({ entries }: MechanismMixPanelProps) {
  return (
    <CollapsibleSection
      id="mechanism-mix"
      title="Mechanism Mix"
      subtitle="Programs by mechanism family."
      defaultOpen={false}
    >
      {entries.length > 0 ? (
        <MixStack
          ariaLabel="Programs by mechanism family"
          activeStrokeColor="hsl(var(--card))"
          entries={entries.map((entry, index) => ({
            key: entry.key,
            label: entry.label,
            count: entry.count,
            share: entry.share,
            color: colorForEntry(entry, index),
            href: hrefForEntry(entry) ?? undefined,
          }))}
        />
      ) : (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          No programs to display.
        </p>
      )}
    </CollapsibleSection>
  );
}
