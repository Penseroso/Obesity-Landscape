"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CollapsibleSection } from "./CollapsibleSection";
import type { MechanismMixEntry } from "@/domains/company-pipeline/lib/selectors";
import { donutWedgePath, layoutDonutSlices } from "@/domains/app/lib/donut-geometry";

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

const SIZE = 176;
const CENTER = SIZE / 2;
const OUTER_R = 80;
const INNER_R = 50;
const GAP_DEG = 2.5;

export function MechanismMixPanel({ entries }: MechanismMixPanelProps) {
  const router = useRouter();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const slices = layoutDonutSlices(entries);
  const segments = entries.map((entry, index) => ({
    entry,
    color: colorForEntry(entry, index),
    slice: slices[index],
    href: hrefForEntry(entry),
  }));
  const activeEntry = entries.find((entry) => entry.key === activeKey) ?? null;
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);

  const clear = () => setActiveKey(null);

  return (
    <CollapsibleSection
      id="mechanism-mix"
      title="Mechanism Mix"
      subtitle="Programs by mechanism family."
      defaultOpen={false}
    >
      {segments.length > 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-4">
          <div className="relative">
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              role="img"
              aria-label="Programs by mechanism family"
            >
              {segments.map(({ entry, color, slice, href }) => (
                <path
                  key={entry.key}
                  d={donutWedgePath(
                    CENTER,
                    CENTER,
                    INNER_R,
                    OUTER_R,
                    slice.startAngle,
                    slice.endAngle,
                    GAP_DEG,
                  )}
                  fill={color}
                  stroke={activeKey === entry.key ? "hsl(var(--card))" : "none"}
                  strokeWidth={activeKey === entry.key ? 3 : 0}
                  opacity={activeKey === null || activeKey === entry.key ? 1 : 0.4}
                  tabIndex={0}
                  role={href ? "link" : undefined}
                  aria-label={
                    href
                      ? `${entry.label}: ${entry.count} programs (${Math.round(entry.share * 100)}%) — open in Program Register`
                      : undefined
                  }
                  className={`outline-none transition-opacity ${href ? "cursor-pointer" : ""}`}
                  onMouseEnter={() => setActiveKey(entry.key)}
                  onMouseLeave={clear}
                  onFocus={() => setActiveKey(entry.key)}
                  onBlur={clear}
                  onClick={href ? () => router.push(href) : undefined}
                  onKeyDown={
                    href
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(href);
                          }
                        }
                      : undefined
                  }
                >
                  <title>{`${entry.label}: ${entry.count} programs (${Math.round(entry.share * 100)}%)`}</title>
                </path>
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-semibold tabular-nums text-foreground">
                {activeEntry ? activeEntry.count : total}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {activeEntry ? `${Math.round(activeEntry.share * 100)}%` : "programs"}
              </span>
            </div>
          </div>
          <p className="min-h-[1.25rem] text-center text-sm font-medium text-foreground">
            {activeEntry ? activeEntry.label : " "}
          </p>
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
            {segments.map(({ entry, color, href }) => {
              const itemClassName = `flex items-center gap-1.5 rounded-sm px-1 text-sm outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                activeKey === entry.key ? "text-foreground" : "text-muted-foreground"
              } ${href ? "hover:text-foreground" : ""}`;
              const content = (
                <>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  {entry.label}
                  <span className="font-semibold tabular-nums text-primary">
                    {entry.count}
                  </span>
                </>
              );
              return (
                <li key={entry.key}>
                  {href ? (
                    <Link
                      href={href}
                      className={itemClassName}
                      onMouseEnter={() => setActiveKey(entry.key)}
                      onMouseLeave={clear}
                      onFocus={() => setActiveKey(entry.key)}
                      onBlur={clear}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={itemClassName}
                      onMouseEnter={() => setActiveKey(entry.key)}
                      onMouseLeave={clear}
                      onFocus={() => setActiveKey(entry.key)}
                      onBlur={clear}
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          No programs to display.
        </p>
      )}
    </CollapsibleSection>
  );
}
