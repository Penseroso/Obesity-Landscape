"use client";

import { useMemo, useState } from "react";
import { EfficacyCompareChart } from "@/domains/app/components/EfficacyCompareChart";
import { EfficacyProgramPicker } from "@/domains/app/components/EfficacyProgramPicker";
import { Button } from "@/domains/app/components/ui/Button";
import type {
  EfficacyComparisonRow,
  EfficacyFamilyGroup,
} from "@/domains/app/lib/efficacy-comparison/read-model";

type EfficacyCompareLauncherProps = {
  families: EfficacyFamilyGroup[];
  /**
   * Optional deep-link seed (e.g. from `?unit=` on `/efficacy-comparison`).
   * Used only to initialize state on mount - the caller is responsible for
   * validating these against `families` before passing them in. Plain usage
   * with no deep link (e.g. the Overview launcher) omits this entirely and
   * behaves exactly as before.
   */
  initialSelectedUnitKeys?: string[];
  /** Opens the picker immediately on mount instead of requiring a click. */
  initialOpen?: boolean;
};

type Mode = "closed" | "picker" | "chart";

/**
 * Entry point for the cross-family compare feature: a button that opens the
 * program picker, whose own Compare action swaps to the chart modal. Selection
 * state lives here so it survives switching between the two modals.
 */
export function EfficacyCompareLauncher({
  families,
  initialSelectedUnitKeys,
  initialOpen,
}: EfficacyCompareLauncherProps) {
  const [mode, setMode] = useState<Mode>(initialOpen ? "picker" : "closed");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedUnitKeys ?? []),
  );

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
      <Button
        variant="primary"
        size="md"
        onClick={() => setMode("picker")}
        className="shrink-0"
      >
        Compare programs
        {selected.size > 0 ? (
          <span className="rounded-full bg-primary px-1.5 py-px text-xs font-semibold text-primary-foreground">
            {selected.size}
          </span>
        ) : null}
      </Button>

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
        <EfficacyCompareChart
          rows={selectedRows}
          onEdit={() => setMode("picker")}
          onClose={() => setMode("closed")}
        />
      ) : null}
    </>
  );
}
