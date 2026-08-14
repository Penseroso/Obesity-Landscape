"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight } from "lucide-react";
import { Modal } from "@/domains/app/components/Modal";
import type { ChartSourceRole } from "@/domains/app/lib/efficacy-comparison/chart-evidence";
import type { EfficacyComparisonRow } from "@/domains/app/lib/efficacy-comparison/read-model";

type EfficacyCompareChartProps = {
  rows: EfficacyComparisonRow[];
  onEdit: () => void;
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
const DOSE_LABEL_HEIGHT = 30;
// Bar-local Study/timepoint provenance, two short lines per bar (not per
// group): once a program's bars can come from more than one Study — the
// chart-only dose series in `chart-evidence.ts` deliberately widens beyond
// the Overview table's single representative Study — a shared per-group
// caption would misstate the bars it doesn't belong to, and cross-trial
// aggregation must be legible without hovering. The existing tooltip already
// carries full per-bar provenance; this is the permanent (non-hover) half of
// it: the Study's short acronym (when one is authored and short enough to
// fit; a long official title stays tooltip-only, same threshold as
// `shortStudyTitle` already uses elsewhere) above its timepoint, since a
// duration/timepoint difference must never be tooltip-only (see the page's
// own disclosure rule: two bars of equal height from trials of different
// length must never read as equivalent).
const BAR_PROVENANCE_HEIGHT = 28;
/** Per-group program-name label only now — timepoint moved to per-bar above. */
const GROUP_LABEL_HEIGHT = 24;
const Y_AXIS_WIDTH = 40;
// The first visible bar always starts this far from the Y axis. Without an
// explicit gutter, programs with a wide multi-dose cluster began at x=0 while
// one- or two-dose programs inherited incidental centering space from
// MIN_GROUP_WIDTH, making the axis spacing vary by selected asset.
const FIRST_BAR_GUTTER = 32;
// Floor for a program's horizontal slot so its group-header label (program
// name + timepoint) always has room, even when that program has only one or
// two doses — otherwise a narrow bar cluster forces the name to truncate.
const MIN_GROUP_WIDTH = 104;

// Five hues, each visually distinct from the others and from the phase-tier
// badge colors used elsewhere on this page — enough separation for up to
// EFFICACY_COMPARE_MAX_SELECTION programs at once.
const PROGRAM_HUES = [
  { h: 202, s: 55, base: 34 },
  { h: 22, s: 68, base: 42 },
  { h: 164, s: 48, base: 32 },
  { h: 282, s: 38, base: 42 },
  { h: 82, s: 38, base: 34 },
];
const DOSE_LIGHTNESS_SPREAD = 20;

function programColor(programIndex: number): string {
  const hue = PROGRAM_HUES[programIndex % PROGRAM_HUES.length];
  return `hsl(${hue.h}, ${hue.s}%, ${hue.base + 6}%)`;
}

function doseLightness(programIndex: number, doseIndex: number, doseCount: number) {
  const hue = PROGRAM_HUES[programIndex % PROGRAM_HUES.length];
  const step = doseCount > 1 ? DOSE_LIGHTNESS_SPREAD / (doseCount - 1) : 0;
  return hue.base + (doseCount - 1 - doseIndex) * step;
}

/** Lighter shade for a lower dose, darker for a higher one, same hue per program. */
function doseColor(programIndex: number, doseIndex: number, doseCount: number): string {
  const hue = PROGRAM_HUES[programIndex % PROGRAM_HUES.length];
  const lightness = doseLightness(programIndex, doseIndex, doseCount);
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

// Some sources report a precision figure (standard error) inline with no
// dedicated field for it, e.g. "-9.1 (SE 0.8)" — appending "%" naively would
// land it after the parenthetical ("-9.1 (SE 0.8)%"). Splitting it off first
// keeps the glyph on the number itself; the stored string is never rewritten,
// only reassembled in the same two pieces.
function formatPercent(raw: string): string {
  const match = raw.match(/^(.*?)\s*(\([^()]*\))\s*$/);
  const [main, annotation] = match ? [match[1], match[2]] : [raw, null];
  const withGlyph = main.includes("%") ? main : `${main}%`;
  return annotation ? `${withGlyph} ${annotation}` : withGlyph;
}

/** Compact permanent bar label; a source-reported parenthetical precision
 * qualifier remains available in the bar's full tooltip. */
function compactPercent(raw: string): string {
  const match = raw.match(/^(.*?)\s*(\([^()]*\))\s*$/);
  const main = match ? match[1] : raw;
  return main.includes("%") ? main : `${main}%`;
}

// `studyTitle` is the Study's short acronym when one is authored ("STEP 1",
// "SURMOUNT-1"), falling back to the full official title when it isn't —
// common for an early-phase Study with no public trial name yet. A length
// threshold, not a phase check: acronym-less Studies aren't only Phase 1/2,
// and an authored acronym is reliably short regardless of phase.
const STUDY_TITLE_SHORT_MAX = 24;

function shortStudyTitle(studyTitle: string): string | null {
  return studyTitle.length <= STUDY_TITLE_SHORT_MAX ? studyTitle : null;
}

// Matches a leading numeric dose expression with its unit, e.g. "5 mg",
// "2/5/10/20 mg" (ASC30's slash-separated cohort). Deliberately narrow: it
// extracts, it never rewrites or infers a value.
const DOSE_PATTERN = /\d[\d.\/]*\s*(?:mg|mcg|µg|g|mL|IU|units?)\b/i;

/**
 * Axis-only extraction of the numeric dose + unit from stored arm text
 * ("Elecoglipron 75 mg, weekly escalation" → "75 mg"). The caller passes the
 * arm's `dose` field first when the read model resolved one (see
 * `EfficacyValue.dose`) and only falls back to `label` when it didn't — a
 * titration arm is often labelled with no number at all ("Semaglutide maximum
 * tolerated dose"), while the numeric range lives in `dose` ("1.7 mg or 2.4 mg
 * maximum tolerated dose"); this reads the first number in that range rather
 * than showing nothing. Returns null when neither carries any such pattern,
 * and the caller falls back to an ordinal "Dose N" in that case. The full
 * label is untouched everywhere else (tooltip, screen-reader list).
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
  /** Bar-local, never shared across a program's other bars — see
   * `BAR_PROVENANCE_HEIGHT`'s comment. */
  phase: string;
  studyTitle: string;
  timepoint: string;
  sourceRole: ChartSourceRole;
  doseLabel: string;
  /** The arm's stored `dose` text, when the read model resolved one and it
   * says more than `doseLabel` already does — shown in the tooltip only. */
  doseDetail: string | null;
  /** Full authored titration, shown in the tooltip. */
  titration: string | null;
  doseAxisLabel: string;
  doseRaw: string;
  doseNumeric: number;
  programIndex: number;
  doseIndex: number;
  doseCount: number;
};

/**
 * A compact, presentation-only qualifier for bars whose resolved nominal dose
 * collides with another arm in the same program. Full authored text remains in
 * the tooltip; this extracts only enough to keep the permanent bar labels
 * distinct ("4 mg · start 2 mg" versus "4 mg · start 4 mg").
 */
function escalationAxisLabel(point: {
  label: string;
  dose?: string;
  doseSchedule?: string;
  titration?: string;
}): string | null {
  for (const text of [point.titration, point.doseSchedule, point.label]) {
    if (!text) continue;
    const startingDose = text.match(
      /(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|mL|IU|units?)\s+starting dose/i,
    );
    if (startingDose && point.dose) {
      const finalDose = point.dose.match(
        /^(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|mL|IU|units?)$/i,
      );
      if (finalDose) {
        if (
          startingDose[1] === finalDose[1] &&
          startingDose[2].toLowerCase() === finalDose[2].toLowerCase()
        ) {
          return point.dose;
        }
        return startingDose[2].toLowerCase() === finalDose[2].toLowerCase()
          ? `${startingDose[1]}→${point.dose}`
          : `${startingDose[1]} ${startingDose[2]}→${point.dose}`;
      }
    }

    const escalationStart = text.match(
      /^(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|mL|IU|units?)\s+(?:escalat(?:ing|ed)|to)\b/i,
    );
    if (escalationStart && point.dose) {
      const finalDose = point.dose.match(
        /^(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|mL|IU|units?)$/i,
      );
      if (finalDose) {
        return escalationStart[2].toLowerCase() === finalDose[2].toLowerCase()
          ? `${escalationStart[1]}→${point.dose}`
          : `${escalationStart[1]} ${escalationStart[2]}→${point.dose}`;
      }
    }
  }
  return null;
}

/** One bar per dose, in the page's own dose-ascending order — no clustering by
 * program in the data itself; grouping is a presentation cue (color, fixed
 * gap, group-header label) layered on a flat, one-bar-per-slot array.
 *
 * Sourced from `row.chartDoseSeries`, not `row.evidence.treatmentValues`: the
 * Overview table's single representative Study is unaffected by this feature,
 * but the chart draws on every eligible Study's dose evidence for the unit
 * (`chart-evidence.ts`), so a program's bars here may span more than one
 * Study — hence each slot below carries its own Study/phase/timepoint rather
 * than one shared per program. */
function buildChartSlots(rows: EfficacyComparisonRow[]): ChartSlot[] {
  const slots: ChartSlot[] = [];
  rows.forEach((row, programIndex) => {
    const doses = row.chartDoseSeries
      .map((point) => ({
        outcomeId: point.outcomeId,
        label: point.label,
        dose: point.dose as string | undefined,
        doseSchedule: point.doseSchedule,
        titration: point.titration,
        raw: point.value,
        numeric: parsePercent(point.value),
        studyTitle: point.studyTitle,
        phase: point.phase,
        timepoint: point.assessmentTimepoint,
        sourceRole: point.sourceRole,
      }))
      .filter(
        (dose): dose is typeof dose & { numeric: number } => dose.numeric !== null,
      );

    const doseCounts = new Map<string, number>();
    const escalationLabels = new Map<string, string | null>();
    for (const dose of doses) {
      if (!dose.dose) continue;
      doseCounts.set(dose.dose, (doseCounts.get(dose.dose) ?? 0) + 1);
      escalationLabels.set(dose.outcomeId, escalationAxisLabel(dose));
    }

    doses.forEach((dose, doseIndex) => {
      slots.push({
        key: dose.outcomeId,
        program: row.name,
        companyName: row.companyName,
        phase: dose.phase,
        studyTitle: dose.studyTitle,
        timepoint: dose.timepoint,
        sourceRole: dose.sourceRole,
        doseLabel: dose.label,
        doseDetail:
          dose.doseSchedule ??
          (dose.dose && !dose.label.toLowerCase().includes(dose.dose.toLowerCase())
            ? dose.dose
            : null),
        titration:
          dose.titration ??
          (escalationLabels.get(dose.outcomeId) ? dose.doseSchedule ?? null : null),
        doseAxisLabel:
          dose.dose && (doseCounts.get(dose.dose) ?? 0) > 1
            ? escalationLabels.get(dose.outcomeId) ?? dose.dose
            : extractDoseAxisLabel(dose.dose ?? dose.label) ?? `Dose ${doseIndex + 1}`,
        doseRaw: dose.raw,
        doseNumeric: dose.numeric,
        programIndex,
        doseIndex,
        doseCount: doses.length,
      });
    });
  });
  return slots;
}

type PositionedSlot = ChartSlot & { x: number; groupX: number; groupWidth: number };

type ChartTooltipState = {
  slot: PositionedSlot;
  anchor: { left: number; right: number; top: number; bottom: number };
};

type ChartTooltipPosition = {
  left: number;
  top: number;
  width: number;
  arrowLeft: number;
  placement: "above" | "below";
};

/**
 * One program's horizontal slot, whether or not it produced any bars. No
 * selected program currently has zero chart-eligible doses — `resolveNominalDose`
 * (`chart-evidence.ts`) resolves a deterministic escalation schedule to its
 * final step rather than rejecting it, which is what previously left ASC30's
 * only Overview evidence ("2 mg, 5 mg, 10 mg, and 20 mg") with none. A row
 * can still legitimately end up with zero points in the future — e.g. every
 * one of its arms reporting a genuinely individualized/uncertain alternative
 * ("X mg or Y mg maximum tolerated dose") rather than a fixed schedule — and
 * that case must render as a disclosed, explicit empty state in its own
 * reserved slot, never as a silently missing group the reader could mistake
 * for a rendering bug. `probe-efficacy-comparison.mts` fails loud if any
 * currently-selected row unexpectedly becomes zero-bar and is not on its
 * reviewed allowlist.
 */
type PositionedGroup = {
  programIndex: number;
  program: string;
  groupX: number;
  groupWidth: number;
  isEmpty: boolean;
};

/**
 * Assigns each bar a fixed pixel x — tight within a program, wider between
 * programs — instead of an even band scale. A program's bars are centered
 * within its own slot, which is at least `MIN_GROUP_WIDTH` wide even if its
 * bar cluster is narrower (or empty), so the group-header label below never
 * truncates. Iterates every selected row by index — not just the program
 * indices present in `slots` — so a zero-dose program still gets a
 * positioned, empty group rather than disappearing from the layout.
 */
function layoutSlots(
  slots: ChartSlot[],
  rows: EfficacyComparisonRow[],
): { positioned: PositionedSlot[]; groups: PositionedGroup[]; totalWidth: number } {
  let x = 0;
  const positioned: PositionedSlot[] = [];
  const groups: PositionedGroup[] = [];
  rows.forEach((row, programIndex) => {
    const groupSlots = slots.filter((slot) => slot.programIndex === programIndex);
    const doseCount = groupSlots.length;
    const naturalWidth =
      doseCount > 0 ? doseCount * BAR_WIDTH + (doseCount - 1) * WITHIN_GROUP_GAP : 0;
    const groupWidth = Math.max(naturalWidth, MIN_GROUP_WIDTH);
    const barOffset = (groupWidth - naturalWidth) / 2;

    if (programIndex === 0 && doseCount > 0) {
      x = Math.max(0, FIRST_BAR_GUTTER - barOffset);
    } else if (programIndex > 0) {
      x += BETWEEN_GROUP_GAP;
    }
    const groupX = x;
    groupSlots.forEach((slot, withinIndex) => {
      const barX = groupX + barOffset + withinIndex * (BAR_WIDTH + WITHIN_GROUP_GAP);
      positioned.push({ ...slot, x: barX, groupX, groupWidth });
    });
    groups.push({
      programIndex,
      program: row.name,
      groupX,
      groupWidth,
      isEmpty: doseCount === 0,
    });
    x = groupX + groupWidth;
  });
  return { positioned, groups, totalWidth: x };
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

export function EfficacyCompareChart({
  rows,
  onEdit,
  onClose,
}: EfficacyCompareChartProps) {
  const slots = useMemo(() => buildChartSlots(rows), [rows]);
  const { positioned, groups, totalWidth } = useMemo(
    () => layoutSlots(slots, rows),
    [slots, rows],
  );

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
  const chartScrollerRef = useRef<HTMLDivElement>(null);
  const chartContentRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [plotHeight, setPlotHeight] = useState(MIN_PLOT_HEIGHT);
  const [chartAreaWidth, setChartAreaWidth] = useState(0);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const [tooltip, setTooltip] = useState<ChartTooltipState | null>(null);
  const [tooltipPosition, setTooltipPosition] =
    useState<ChartTooltipPosition | null>(null);

  useEffect(() => {
    const element = chartAreaRef.current;
    if (!element) {
      return;
    }
    const updateHeight = () => {
      const available =
        element.clientHeight -
        DOSE_LABEL_HEIGHT -
        BAR_PROVENANCE_HEIGHT -
        GROUP_LABEL_HEIGHT;
      setPlotHeight(Math.max(available, MIN_PLOT_HEIGHT));
      const scrollerWidth = chartScrollerRef.current?.clientWidth ?? 0;
      const contentWidth = chartContentRef.current?.offsetWidth ?? 0;
      setChartAreaWidth(element.clientWidth);
      setHasHorizontalOverflow(contentWidth > scrollerWidth);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    if (chartContentRef.current) observer.observe(chartContentRef.current);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const panel = tooltipRef.current;
    if (!tooltip || !panel) return;

    const gutter = 16;
    const gap = 12;
    const width = Math.min(340, window.innerWidth - gutter * 2);
    const panelHeight = panel.getBoundingClientRect().height;
    const anchorCenter = (tooltip.anchor.left + tooltip.anchor.right) / 2;
    const left = Math.min(
      Math.max(anchorCenter - width / 2, gutter),
      window.innerWidth - width - gutter,
    );
    const roomAbove = tooltip.anchor.top - gutter - gap;
    const roomBelow = window.innerHeight - tooltip.anchor.bottom - gutter - gap;
    const placement =
      roomAbove >= panelHeight || roomAbove >= roomBelow ? "above" : "below";
    const top =
      placement === "above"
        ? Math.max(gutter, tooltip.anchor.top - gap - panelHeight)
        : Math.min(
            window.innerHeight - gutter - panelHeight,
            tooltip.anchor.bottom + gap,
          );

    setTooltipPosition({
      left,
      top,
      width,
      arrowLeft: Math.min(Math.max(anchorCenter - left, 18), width - 18),
      placement,
    });
  }, [tooltip]);

  useEffect(() => {
    if (!tooltip) return;
    const dismiss = () => setTooltip(null);
    window.addEventListener("resize", dismiss);
    return () => window.removeEventListener("resize", dismiss);
  }, [tooltip]);

  const showTooltip = (slot: PositionedSlot, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTooltip({
      slot,
      anchor: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      },
    });
  };

  const showPointerTooltip = (slot: PositionedSlot, clientX: number, clientY: number) => {
    setTooltip({
      slot,
      anchor: {
        left: clientX,
        right: clientX,
        top: clientY,
        bottom: clientY,
      },
    });
  };

  const dismissTooltip = (slotKey: string) => {
    setTooltip((current) => (current?.slot.key === slotKey ? null : current));
  };

  const desiredPanelWidth = Math.min(
    1200,
    Math.max(720, Y_AXIS_WIDTH + totalWidth + 112),
  );
  const availablePlotWidth = Math.max(chartAreaWidth - Y_AXIS_WIDTH - 8, 0);
  const horizontalScale =
    totalWidth > 0 && totalWidth < availablePlotWidth
      ? Math.min(1.5, availablePlotWidth / totalWidth)
      : 1;
  const renderedTotalWidth = totalWidth * horizontalScale;
  const renderedCanvasWidth = Math.max(
    renderedTotalWidth + 8,
    availablePlotWidth,
  );

  return (
    <Modal
      title="Efficacy comparison"
      onClose={onClose}
      sizeClassName="h-[86dvh] w-[calc(100vw-2rem)] sm:h-[72vh] sm:max-h-[48rem]"
      panelStyle={{ maxWidth: desiredPanelWidth }}
      headerActions={
        <button
          type="button"
          onClick={onEdit}
          className="ml-1 shrink-0 border-l border-border pl-3 text-xs font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="sm:hidden">Edit</span>
          <span className="hidden sm:inline">Edit selection</span>
        </button>
      }
    >
      <div className="flex h-full flex-col">
        <div className="mb-3 min-w-0 shrink-0 overflow-x-auto pb-1 sm:mb-4 sm:overflow-visible sm:pb-0">
          <div className="flex min-w-max items-center gap-4 sm:min-w-0 sm:flex-wrap">
            {rows.map((row, index) => (
              <div key={row.unitKey} className="flex shrink-0 items-center gap-2 text-xs">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: programColor(index) }}
                />
                <span className="font-medium text-card-foreground">{row.name}</span>
                <span className="text-muted-foreground">{row.companyName}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-2 flex shrink-0 items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span>Body-weight change from baseline (%)</span>
          {hasHorizontalOverflow ? (
            <span className="inline-flex items-center gap-1 text-right">
              <ArrowLeftRight aria-hidden="true" className="h-3.5 w-3.5" />
              Scroll to view all programs
            </span>
          ) : null}
        </div>

        <div
          ref={chartAreaRef}
          className="relative flex min-h-0 flex-1 overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none relative z-20 w-10 shrink-0 bg-card"
          >
            {ticks.map((tick) => {
              const top = DOSE_LABEL_HEIGHT + (tick / domainMin) * plotHeight;
              return (
                <div key={tick} className="absolute inset-x-0" style={{ top }}>
                  <span className="absolute right-1 -translate-y-1/2 text-right text-[10px] leading-none text-muted-foreground">
                    {Math.round(tick)}%
                  </span>
                  <span className="absolute right-0 w-1 border-t border-border" />
                </div>
              );
            })}
            <div
              className="absolute right-0 border-l border-border"
              style={{ top: DOSE_LABEL_HEIGHT, height: plotHeight }}
            />
          </div>
          <div
            ref={chartScrollerRef}
            onScroll={() => setTooltip(null)}
            className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
          >
            <div
              ref={chartContentRef}
              className="relative shrink-0"
              style={{
                width: renderedCanvasWidth,
                height:
                  DOSE_LABEL_HEIGHT + plotHeight + BAR_PROVENANCE_HEIGHT + GROUP_LABEL_HEIGHT,
              }}
            >
            {ticks.map((tick) => {
              const top = DOSE_LABEL_HEIGHT + (tick / domainMin) * plotHeight;
              return (
                <div key={tick} className="absolute left-0 right-0" style={{ top }}>
                  {tick !== 0 ? (
                    <div
                      className="absolute border-t border-dashed border-border"
                      style={{ left: 0, right: 0 }}
                    />
                  ) : null}
                </div>
              );
            })}

            {positioned.map((slot) => {
              const barHeight = Math.max((slot.doseNumeric / domainMin) * plotHeight, 1);
              return (
                <div key={slot.key}>
                  <div
                    className="absolute flex items-end justify-center text-center text-[10px] font-medium leading-tight text-card-foreground"
                    style={{
                      left: slot.x * horizontalScale - 4,
                      width: BAR_WIDTH * horizontalScale + 8,
                      top: 0,
                      height: DOSE_LABEL_HEIGHT - 3,
                    }}
                  >
                    {slot.doseAxisLabel}
                  </div>
                  <div
                    role="img"
                    tabIndex={0}
                    aria-label={`${slot.program}, ${slot.doseLabel}, result ${formatPercent(slot.doseRaw)}, ${slot.studyTitle}, ${slot.phase}, ${slot.timepoint}`}
                    aria-describedby={tooltip?.slot.key === slot.key ? tooltipId : undefined}
                    onMouseEnter={(event) =>
                      showPointerTooltip(slot, event.clientX, event.clientY)
                    }
                    onMouseMove={(event) =>
                      showPointerTooltip(slot, event.clientX, event.clientY)
                    }
                    onMouseLeave={() => dismissTooltip(slot.key)}
                    onFocus={(event) => showTooltip(slot, event.currentTarget)}
                    onBlur={() => dismissTooltip(slot.key)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") dismissTooltip(slot.key);
                    }}
                    className={`absolute rounded-b-sm outline-none transition-[filter,box-shadow] hover:brightness-[1.04] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                      tooltip?.slot.key === slot.key
                        ? "z-10 brightness-[1.04] ring-1 ring-foreground/20"
                        : ""
                    }`}
                    style={{
                      left: slot.x * horizontalScale,
                      width: BAR_WIDTH * horizontalScale,
                      top: DOSE_LABEL_HEIGHT,
                      height: barHeight,
                      backgroundColor: doseColor(slot.programIndex, slot.doseIndex, slot.doseCount),
                    }}
                  >
                    <span
                      className="absolute inset-x-0 truncate px-0.5 text-center text-[9px] font-semibold leading-none"
                      style={{
                        bottom: barHeight >= 18 ? 4 : -12,
                        color:
                          barHeight < 18 ||
                          doseLightness(
                            slot.programIndex,
                            slot.doseIndex,
                            slot.doseCount,
                          ) >= 52
                            ? "hsl(20, 16%, 14%)"
                            : "white",
                      }}
                    >
                      {compactPercent(slot.doseRaw)}
                    </span>
                  </div>
                  {/* Bar-local, every bar — not just the group start — since a
                      program's bars may now come from different Studies with
                      different timepoints. Permanent, not tooltip-only: see
                      BAR_PROVENANCE_HEIGHT's comment. */}
                  <div
                    className="absolute text-center"
                    style={{
                      left: slot.x * horizontalScale,
                      width: BAR_WIDTH * horizontalScale,
                      top: DOSE_LABEL_HEIGHT + plotHeight + 3,
                    }}
                  >
                    {shortStudyTitle(slot.studyTitle) ? (
                      <p className="truncate text-[9px] font-medium leading-tight text-card-foreground">
                        {shortStudyTitle(slot.studyTitle)}
                      </p>
                    ) : null}
                    <p className="truncate text-[9px] leading-tight text-muted-foreground">
                      {slot.timepoint}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Program-name label and, for a program with no chart-eligible
                dose, an explicit empty-state notice — both keyed off `groups`
                rather than `positioned` so a zero-dose program still gets its
                reserved slot and a disclosed reason, never a silent gap a
                reader could mistake for a rendering bug. */}
            {groups.map((group) => (
              <div key={group.programIndex}>
                <div
                  className="absolute text-center"
                  style={{
                    left: group.groupX * horizontalScale,
                    width: group.groupWidth * horizontalScale,
                    top: DOSE_LABEL_HEIGHT + plotHeight + BAR_PROVENANCE_HEIGHT + 3,
                  }}
                >
                  <p className="truncate text-[11px] font-semibold text-card-foreground">
                    {group.program}
                  </p>
                </div>
                {group.isEmpty ? (
                  <div
                    className="absolute text-center"
                    style={{
                      left: group.groupX * horizontalScale,
                      width: group.groupWidth * horizontalScale,
                      top: DOSE_LABEL_HEIGHT,
                    }}
                  >
                    <p
                      className="px-1 text-[9px] italic leading-tight text-muted-foreground"
                      title="Every dose this program reports is a range, escalation schedule, or pooled group rather than one explicit nominal dose, so none can be safely charted. See the Study for its full results."
                    >
                      No single-dose result to chart — see Study
                    </p>
                  </div>
                ) : null}
              </div>
            ))}

            <div
              className="absolute border-t border-border"
              style={{ left: 0, right: 0, top: DOSE_LABEL_HEIGHT }}
            />
            </div>
          </div>
        </div>
      </div>

      {tooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-[80] rounded-md border border-border bg-card text-card-foreground shadow-soft"
              style={
                tooltipPosition
                  ? {
                      left: tooltipPosition.left,
                      top: tooltipPosition.top,
                      width: tooltipPosition.width,
                    }
                  : {
                      left: 0,
                      top: 0,
                      width: "min(340px, calc(100vw - 32px))",
                      visibility: "hidden",
                    }
              }
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5 rounded-t-md"
                style={{ backgroundColor: programColor(tooltip.slot.programIndex) }}
              />
              <div className="flex items-start justify-between gap-4 border-b border-border/80 bg-muted/25 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{tooltip.slot.program}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {tooltip.slot.companyName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Reported result
                  </p>
                  <p className="mt-0.5 text-lg font-semibold leading-none">
                    {formatPercent(tooltip.slot.doseRaw)}
                  </p>
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium leading-5">{tooltip.slot.doseLabel}</p>
                  {tooltip.slot.sourceRole === "active-comparator" ? (
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Active comparator
                    </span>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-border/70 pt-3 text-[11px] leading-4">
                  <dt className="text-muted-foreground">Study</dt>
                  <dd className="font-medium">{tooltip.slot.studyTitle}</dd>
                  <dt className="text-muted-foreground">Evidence</dt>
                  <dd>{tooltip.slot.phase} · {tooltip.slot.timepoint}</dd>
                  {tooltip.slot.doseDetail ? (
                    <>
                      <dt className="text-muted-foreground">Dose</dt>
                      <dd>{tooltip.slot.doseDetail}</dd>
                    </>
                  ) : null}
                  {tooltip.slot.titration ? (
                    <>
                      <dt className="text-muted-foreground">Titration</dt>
                      <dd>{tooltip.slot.titration}</dd>
                    </>
                  ) : null}
                </dl>
              </div>
              {tooltipPosition ? (
                <span
                  aria-hidden="true"
                  className={`absolute h-2.5 w-2.5 rotate-45 bg-card ${
                    tooltipPosition.placement === "above"
                      ? "-bottom-[5px] border-b border-r border-border"
                      : "-top-[5px] border-l border-t border-border"
                  }`}
                  style={{ left: tooltipPosition.arrowLeft - 5 }}
                />
              ) : null}
            </div>,
            document.body,
          )
        : null}

      <ul className="sr-only">
        {rows.map((row) => (
          <li key={row.unitKey}>
            {row.name} ({row.companyName}):{" "}
            {row.chartDoseSeries.length === 0
              ? "No single-dose result to chart — every reported dose is a range, escalation schedule, or pooled group; see the Study for its full results."
              : row.chartDoseSeries
                  .map(
                    (point) =>
                      `${point.label}${point.dose ? ` (${point.dose})` : ""} ${formatPercent(point.value)} — ` +
                      `${point.studyTitle}, ${point.phase}, ${point.assessmentTimepoint}` +
                      (point.sourceRole === "active-comparator" ? " (active comparator)" : ""),
                  )
                  .join("; ")}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
