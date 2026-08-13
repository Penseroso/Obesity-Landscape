"use client";

import { useMemo, useState } from "react";
import { EfficacyCompareChart } from "@/domains/app/components/EfficacyCompareChart";
import { EfficacyProgramPicker } from "@/domains/app/components/EfficacyProgramPicker";
import type {
  EfficacyComparisonRow,
  EfficacyFamilyGroup,
} from "@/domains/app/lib/efficacy-comparison/read-model";

type EfficacyCompareLauncherProps = {
  families: EfficacyFamilyGroup[];
};

type Mode = "closed" | "picker" | "chart";

/**
 * Entry point for the cross-family compare feature: a button that opens the
 * program picker, whose own Compare action swaps to the chart modal. Selection
 * state lives here so it survives switching between the two modals.
 */
export function EfficacyCompareLauncher({ families }: EfficacyCompareLauncherProps) {
  const [mode, setMode] = useState<Mode>("closed");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allRows = useMemo(() => families.flatMap((group) => group.rows), [families]);
  const selectedRows = useMemo<EfficacyComparisonRow[]>(
    () => allRows.filter((row) => selected.has(row.unitKey)),
    [allRows, selected],
  );

  const toggle = (unitKey: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(unitKey)) next.delete(unitKey);
      else next.add(unitKey);
      return next;
    });
  };

  if (allRows.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMode("picker")}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-sm font-semibold text-card-foreground shadow-soft transition hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Compare programs
        {selected.size > 0 ? (
          <span className="rounded-full bg-primary px-1.5 py-px text-xs font-semibold text-primary-foreground">
            {selected.size}
          </span>
        ) : null}
      </button>

      {mode === "picker" ? (
        <EfficacyProgramPicker
          families={families}
          selected={selected}
          onToggle={toggle}
          onClose={() => setMode("closed")}
          onCompare={() => setMode("chart")}
        />
      ) : null}

      {mode === "chart" ? (
        <EfficacyCompareChart rows={selectedRows} onClose={() => setMode("closed")} />
      ) : null}
    </>
  );
}
