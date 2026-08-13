"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/domains/app/components/Modal";
import type { EfficacyComparisonRow } from "@/domains/app/lib/efficacy-comparison/read-model";

type EfficacyCompareChartProps = {
  rows: EfficacyComparisonRow[];
  onClose: () => void;
};

// Fixed pixel layout — chosen once, hardcoded, instead of a proportional band
// scale: it's what lets "same asset" and "different asset" get two distinct,
// designed gaps rather than one uniform spacing. Bar width and gaps stay
// fixed regardless of panel size; only plot height (see MIN_PLOT_HEIGHT and
// the ResizeObserver in the component below) adapts, so the chart always
// fills the panel without needing an internal scroll to reach the bottom
// labels.
const BAR_WIDTH = 40;
const WITHIN_GROUP_GAP = 8;
const BETWEEN_GROUP_GAP = 40;
const MIN_PLOT_HEIGHT = 160;
const DOSE_LABEL_HEIGHT = 20;
const GROUP_LABEL_HEIGHT = 40;
const Y_AXIS_WIDTH = 40;
// Floor for a program's horizontal slot so its group-header label (program
// name + timepoint) always has room, even when that program has only one or
// two doses — otherwise a narrow bar cluster forces the name to truncate.
const MIN_GROUP_WIDTH = 104;

// Five hues, each visually distinct from the others and from the phase-tier
// badge colors used elsewhere on this page — enough separation for up to
// EFFICACY_COMPARE_MAX_SELECTION programs at once.
const PROGRAM_HUES = [
  { h: 201, s: 100, base: 30 },
  { h: 27, s: 100, base: 38 },
  { h: 164, s: 100, base: 26 },
  { h: 280, s: 70, base: 42 },
  { h: 100, s: 55, base: 32 },
];
const DOSE_LIGHTNESS_SPREAD = 30;

function programColor(programIndex: number): string {
  const hue = PROGRAM_HUES[programIndex % PROGRAM_HUES.length];
  return `hsl(${hue.h}, ${hue.s}%, ${hue.base}%)`;
}

/** Lighter shade for a lower dose, darker for a higher one, same hue per program. */
function doseColor(programIndex: number, doseIndex: number, doseCount: number): string {
  const hue = PROGRAM_HUES[programIndex % PROGRAM_HUES.length];
  const step = doseCount > 1 ? DOSE_LIGHTNESS_SPREAD / (doseCount - 1) : 0;
  const lightness = hue.base + (doseCount - 1 - doseIndex) * step;
  return `hsl(${hue.h}, ${hue.s}%, ${lightness}%)`;
}

/**
 * Parses a stored percent-change string ("-15.0%", "−15.0") into a plotting
 * number. Only the bar height is derived from this — every rendered figure
 * (legend, axis, tooltip, screen-reader fallback) shows the stored string
 * verbatim. A dose whose value fails to parse is dropped from the chart
 * entirely (never plotted as a wrong or zero magnitude).
 */
function parsePercent(raw: string): number | null {
  const cleaned = raw.replace(/[−–]/g, "-").replace("%", "").trim();
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function formatPercent(raw: string): string {
  return raw.includes("%") ? raw : `${raw}%`;
}

// Matches a leading numeric dose expression with its unit, e.g. "5 mg",
// "2/5/10/20 mg" (ASC30's slash-separated cohort). Deliberately narrow: it
// extracts, it never rewrites or infers a value.
const DOSE_PATTERN = /\d[\d.\/]*\s*(?:mg|mcg|µg|g|mL|IU|units?)\b/i;

/**
 * Axis-only extraction of the numeric dose + unit from a stored arm label
 * ("Elecoglipron 75 mg, weekly escalation" → "75 mg"). Returns null when the
 * label carries no such pattern at all (e.g. "Tirzepatide maximum tolerated
 * dose") rather than showing descriptive text the axis has no room for; the
 * caller falls back to an ordinal "Dose N" in that case. The full label is
 * untouched everywhere else (tooltip, screen-reader list).
 *
 * A slash-separated match ("2/5/10/20 mg", ASC30's MAD cohort) is a
 * titration schedule, not one dose — the axis shows only the final,
 * highest-administered step ("20 mg"), since that's the dose the cohort
 * actually reached.
 */
function extractDoseAxisLabel(label: string): string | null {
  const match = label.match(DOSE_PATTERN);
  if (!match) {
    return null;
  }
  const full = match[0].trim();
  const unitMatch = full.match(/[a-zA-Zµ]+$/);
  const unit = unitMatch ? unitMatch[0] : "";
  const numericPart = full.slice(0, full.length - unit.length).trim();
  if (!numericPart.includes("/")) {
    return full;
  }
  const steps = numericPart.split("/");
  const finalDose = steps[steps.length - 1].trim();
  return unit ? `${finalDose} ${unit}` : finalDose;
}

type ChartSlot = {
  key: string;
  program: string;
  companyName: string;
  phase: string;
  timepoint: string;
  doseLabel: string;
  doseAxisLabel: string;
  doseRaw: string;
  doseNumeric: number;
  programIndex: number;
  doseIndex: number;
  doseCount: number;
  isGroupStart: boolean;
};

/** One bar per dose, in the page's own dose-ascending order — no clustering by
 * program in the data itself; grouping is a presentation cue (color, fixed
 * gap, group-header label) layered on a flat, one-bar-per-slot array. */
function buildChartSlots(rows: EfficacyComparisonRow[]): ChartSlot[] {
  const slots: ChartSlot[] = [];
  rows.forEach((row, programIndex) => {
    const doses = row.evidence.treatmentValues
      .map((value) => ({
        outcomeId: value.outcomeId,
        label: value.label,
        raw: value.value,
        numeric: parsePercent(value.value),
      }))
      .filter(
        (dose): dose is { outcomeId: string; label: string; raw: string; numeric: number } =>
          dose.numeric !== null,
      );

    doses.forEach((dose, doseIndex) => {
      slots.push({
        key: dose.outcomeId,
        program: row.name,
        companyName: row.companyName,
        phase: row.evidence.phase,
        timepoint: row.evidence.assessmentTimepoint,
        doseLabel: dose.label,
        doseAxisLabel: extractDoseAxisLabel(dose.label) ?? `Dose ${doseIndex + 1}`,
        doseRaw: dose.raw,
        doseNumeric: dose.numeric,
        programIndex,
        doseIndex,
        doseCount: doses.length,
        isGroupStart: doseIndex === 0,
      });
    });
  });
  return slots;
}

type PositionedSlot = ChartSlot & { x: number; groupX: number; groupWidth: number };

/**
 * Assigns each bar a fixed pixel x — tight within a program, wider between
 * programs — instead of an even band scale. A program's bars are centered
 * within its own slot, which is at least `MIN_GROUP_WIDTH` wide even if its
 * bar cluster is narrower, so the group-header label below never truncates.
 */
function layoutSlots(slots: ChartSlot[]): { positioned: PositionedSlot[]; totalWidth: number } {
  let x = 0;
  const positioned: PositionedSlot[] = [];
  let i = 0;
  while (i < slots.length) {
    const { programIndex } = slots[i];
    let j = i;
    while (j < slots.length && slots[j].programIndex === programIndex) {
      j += 1;
    }
    const doseCount = j - i;
    const naturalWidth = doseCount * BAR_WIDTH + (doseCount - 1) * WITHIN_GROUP_GAP;
    const groupWidth = Math.max(naturalWidth, MIN_GROUP_WIDTH);
    const barOffset = (groupWidth - naturalWidth) / 2;

    if (i > 0) {
      x += BETWEEN_GROUP_GAP;
    }
    const groupX = x;
    for (let k = i; k < j; k += 1) {
      const withinIndex = k - i;
      const barX = groupX + barOffset + withinIndex * (BAR_WIDTH + WITHIN_GROUP_GAP);
      positioned.push({ ...slots[k], x: barX, groupX, groupWidth });
    }
    x = groupX + groupWidth;
    i = j;
  }
  return { positioned, totalWidth: x };
}

/** A "nice" round step (1/2/5 × a power of ten) for ~4 y-axis gridlines. */
function niceStep(maxAbs: number, targetTicks = 4): number {
  if (!Number.isFinite(maxAbs) || maxAbs <= 0) {
    return 1;
  }
  const roughStep = maxAbs / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const residual = roughStep / magnitude;
  const niceResidual = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  return niceResidual * magnitude;
}

export function EfficacyCompareChart({ rows, onClose }: EfficacyCompareChartProps) {
  const slots = useMemo(() => buildChartSlots(rows), [rows]);
  const { positioned, totalWidth } = useMemo(() => layoutSlots(slots), [slots]);

  const { domainMin, ticks } = useMemo(() => {
    const magnitudes = slots.map((slot) => Math.abs(slot.doseNumeric));
    const maxAbs = magnitudes.length > 0 ? Math.max(...magnitudes) : 0;
    const step = niceStep(maxAbs);
    const tickCount = Math.max(1, Math.ceil(maxAbs / step));
    const tickValues = Array.from({ length: tickCount + 1 }, (_, i) => -(i * step));
    return { domainMin: tickValues[tickValues.length - 1] || -1, ticks: tickValues };
  }, [slots]);

  // Plot height tracks the panel's actual available space (measured via
  // ResizeObserver on the flex-1 chart area below the legend) rather than a
  // fixed constant, so the chart always fills the panel with no internal
  // scroll needed to reach the bottom group labels.
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [plotHeight, setPlotHeight] = useState(MIN_PLOT_HEIGHT);

  useEffect(() => {
    const element = chartAreaRef.current;
    if (!element) {
      return;
    }
    const updateHeight = () => {
      const available = element.clientHeight - DOSE_LABEL_HEIGHT - GROUP_LABEL_HEIGHT;
      setPlotHeight(Math.max(available, MIN_PLOT_HEIGHT));
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Modal title="Efficacy comparison" onClose={onClose} sizeClassName="w-[50vw] h-[75vh] max-w-[50vw]">
      <div className="flex h-full flex-col">
        <div className="mb-4 flex shrink-0 flex-wrap items-center gap-4">
          {rows.map((row, index) => (
            <div key={row.unitKey} className="flex items-center gap-2 text-xs">
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: programColor(index) }}
              />
              <span className="font-medium text-card-foreground">{row.name}</span>
              <span className="text-muted-foreground">{row.companyName}</span>
            </div>
          ))}
        </div>

        <div ref={chartAreaRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div
            className="relative"
            style={{
              width: Y_AXIS_WIDTH + totalWidth + 8,
              height: DOSE_LABEL_HEIGHT + plotHeight + GROUP_LABEL_HEIGHT,
            }}
          >
            {ticks.map((tick) => {
              const top = DOSE_LABEL_HEIGHT + (tick / domainMin) * plotHeight;
              return (
                <div key={tick} className="absolute left-0 right-0" style={{ top }}>
                  <span className="absolute left-0 -translate-y-1/2 text-[9px] text-muted-foreground">
                    {Math.round(tick)}%
                  </span>
                  <div
                    className="absolute border-t border-dashed border-border"
                    style={{ left: Y_AXIS_WIDTH, right: 0 }}
                  />
                </div>
              );
            })}

            {positioned.map((slot) => {
              const barHeight = Math.max((slot.doseNumeric / domainMin) * plotHeight, 1);
              return (
                <div key={slot.key}>
                  <div
                    className="absolute text-center text-[9px] font-medium text-card-foreground"
                    style={{ left: Y_AXIS_WIDTH + slot.x, width: BAR_WIDTH, top: DOSE_LABEL_HEIGHT - 14 }}
                  >
                    {slot.doseAxisLabel}
                  </div>
                  <div
                    title={`${slot.program} (${slot.companyName})\n${slot.phase} · ${slot.timepoint}\n${slot.doseLabel}: ${formatPercent(slot.doseRaw)}`}
                    className="absolute rounded-t-sm"
                    style={{
                      left: Y_AXIS_WIDTH + slot.x,
                      width: BAR_WIDTH,
                      top: DOSE_LABEL_HEIGHT,
                      height: barHeight,
                      backgroundColor: doseColor(slot.programIndex, slot.doseIndex, slot.doseCount),
                    }}
                  />
                  {slot.isGroupStart ? (
                    <div
                      className="absolute text-center"
                      style={{
                        left: Y_AXIS_WIDTH + slot.groupX,
                        width: slot.groupWidth,
                        top: DOSE_LABEL_HEIGHT + plotHeight + 6,
                      }}
                    >
                      <p className="truncate text-[10px] font-semibold text-card-foreground">
                        {slot.program}
                      </p>
                      <p className="truncate text-[9px] text-muted-foreground">{slot.timepoint}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div
              className="absolute border-t border-border"
              style={{ left: Y_AXIS_WIDTH, right: 0, top: DOSE_LABEL_HEIGHT }}
            />
          </div>
        </div>
      </div>

      <ul className="sr-only">
        {rows.map((row) => (
          <li key={row.unitKey}>
            {row.name} ({row.companyName}), {row.evidence.phase}, {row.evidence.assessmentTimepoint}:{" "}
            {row.evidence.treatmentValues
              .map((value) => `${value.label} ${formatPercent(value.value)}`)
              .join(", ")}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
