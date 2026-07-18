"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getProgramTableColumnLabel,
  type ProgramTableColumn,
  type ProgramTableColumnId,
} from "@/domains/app/config/program-table";
import {
  stageBuckets,
  type StageBucketId,
} from "@/domains/company-pipeline/lib/constants";
import {
  emptyProgramFilters,
  filterPrograms,
} from "@/domains/company-pipeline/lib/filters";
import {
  getProgramFilterOptions,
  sortProgramsForRegister,
} from "@/domains/company-pipeline/lib/selectors";
import type {
  AssetClinicalRollup,
  ProgramStudyPreview,
} from "@/domains/app/lib/clinical-evidence/selectors";
import type { PipelineProgram, ProgramFilters } from "@/domains/company-pipeline/lib/types";
import { formatInlineValues, formatNullableValue } from "@/domains/app/lib/format";
import { ColumnSettings } from "./ColumnSettings";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { ProgramDetailDrawer } from "./ProgramDetailDrawer";
import { StageBadge } from "./StageBadge";
import {
  useProgramTableColumns,
  type ProgramColumnControls,
} from "./useProgramTableColumns";

type PipelineTableProps = {
  programs: PipelineProgram[];
  /** Explicit programId-scoped Clinical previews, prepared server-side. */
  clinicalPreviewByProgramId?: Record<string, ProgramStudyPreview>;
  /** Focal/linked asset context, prepared separately from program matches. */
  clinicalContextByProgramId?: Record<string, AssetClinicalRollup>;
};

type SortDirection = "ascending" | "descending";

type ProgramSort = {
  columnId: ProgramTableColumnId;
  direction: SortDirection;
};

type ProgramAssetGroup = {
  key: string;
  programs: PipelineProgram[];
};

const alphabeticalCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

function getAssetLabel(program: PipelineProgram) {
  const codeName = program.codeName?.trim();
  const assetName = program.assetName.trim();

  if (!codeName || codeName.toLowerCase() === assetName.toLowerCase()) {
    return program.assetName;
  }

  return `${program.assetName} (${program.codeName})`;
}

function getProgramCellValue(
  program: PipelineProgram,
  columnId: ProgramTableColumnId,
) {
  switch (columnId) {
    case "company":
      return formatNullableValue(program.company?.name);
    case "asset":
      return getAssetLabel(program);
    case "route":
      return formatNullableValue(program.administration.route);
    case "dosageForm":
      return formatNullableValue(program.administration.dosageForm);
    case "dosingInterval":
      return formatNullableValue(program.administration.dosingInterval);
    case "indications":
      return formatInlineValues(program.indications);
    case "development":
      return program.development.stage;
    case "status":
      return program.development.status;
    case "mechanism":
      return formatNullableValue(program.technical.mechanism);
    case "platform":
      return formatNullableValue(program.technical.platform);
    case "companyCountry":
      return formatNullableValue(program.company?.headquartersCountry);
  }
}

/** Preserve first-seen order; the input already carries default priority order. */
function groupProgramsByAsset(programs: PipelineProgram[]): ProgramAssetGroup[] {
  const groups = new Map<string, ProgramAssetGroup>();

  for (const program of programs) {
    const key = `${program.companyId}|${program.assetId}`;
    const group = groups.get(key);
    if (group) {
      group.programs.push(program);
    } else {
      groups.set(key, {
        key,
        programs: [program],
      });
    }
  }

  return Array.from(groups.values());
}

function getGroupSortValue(
  group: ProgramAssetGroup,
  columnId: ProgramTableColumnId,
) {
  return Array.from(
    new Set(group.programs.map((program) => getProgramCellValue(program, columnId))),
  )
    .sort(alphabeticalCollator.compare)
    .join(" | ");
}

function ColumnResizeHandle({
  column,
  controls,
}: {
  column: ProgramTableColumn;
  controls: ProgramColumnControls;
}) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const label = getProgramTableColumnLabel(column);
  const width = controls.getColumnWidth(column.id);

  return (
    <span
      role="separator"
      aria-label={`Resize ${label} column`}
      aria-orientation="vertical"
      aria-valuemin={column.minWidth}
      aria-valuemax={column.maxWidth}
      aria-valuenow={width}
      tabIndex={0}
      title={`Drag to resize ${label}; double-click to reset`}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        controls.resetColumnWidth(column.id);
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: width,
        };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        controls.setColumnWidth(
          column.id,
          drag.startWidth + event.clientX - drag.startX,
        );
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          controls.setColumnWidth(column.id, width - 12);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          controls.setColumnWidth(column.id, width + 12);
        } else if (event.key === "Home") {
          event.preventDefault();
          controls.resetColumnWidth(column.id);
        }
      }}
      className="group/resize absolute -right-1.5 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
    >
      <span className="h-5 w-px bg-border transition group-hover/resize:h-7 group-hover/resize:bg-primary group-focus-visible/resize:h-7 group-focus-visible/resize:bg-primary" />
    </span>
  );
}

export function PipelineTable({
  programs,
  clinicalPreviewByProgramId,
  clinicalContextByProgramId,
}: PipelineTableProps) {
  const searchParams = useSearchParams();

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const program of programs) {
      if (program.company?.name) {
        map.set(program.companyId, program.company.name);
      }
    }
    return map;
  }, [programs]);

  // URL-driven filters for the Company × Development Stage Matrix drill-down.
  // Only `company` (by companyId) and `stage` (a bucket id) are read; unknown or
  // invalid values fall back to "All". Every other filter stays at its default,
  // so a plain /assets visit is unchanged.
  const seededCompany = useMemo(() => {
    const companyId = searchParams.get("company");
    return (companyId ? companyNameById.get(companyId) : undefined) ?? "All";
  }, [searchParams, companyNameById]);
  const seededStageBucket = useMemo<ProgramFilters["stageBucket"]>(() => {
    const stageParam = searchParams.get("stage");
    return stageBuckets.some((bucket) => bucket.id === stageParam)
      ? (stageParam as StageBucketId)
      : "All";
  }, [searchParams]);

  const [filters, setFilters] = useState<ProgramFilters>(() => ({
    ...emptyProgramFilters,
    company: seededCompany,
    stageBucket: seededStageBucket,
  }));

  // Re-apply the seed when the URL's seed actually changes (deep link,
  // browser back/forward, chip removal, reset). This overrides ONLY the two
  // URL-driven dimensions and merges into the current filters, so manual
  // FilterBar edits (indication/route/exact stage/status/keyword) are never
  // reset. The ref guard skips the no-op case where the seed is unchanged.
  const seedKey = `${seededCompany}|${seededStageBucket}`;
  const lastSeedKeyRef = useRef(seedKey);
  useEffect(() => {
    if (lastSeedKeyRef.current === seedKey) return;
    lastSeedKeyRef.current = seedKey;
    setFilters((prev) => ({
      ...prev,
      company: seededCompany,
      stageBucket: seededStageBucket,
    }));
  }, [seedKey, seededCompany, seededStageBucket]);

  const [sort, setSort] = useState<ProgramSort | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<PipelineProgram | null>(
    null,
  );
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);

  const clinicalPreview =
    selectedProgram && clinicalPreviewByProgramId
      ? clinicalPreviewByProgramId[selectedProgram.id] ?? null
      : null;
  const clinicalContext =
    selectedProgram && clinicalContextByProgramId
      ? clinicalContextByProgramId[selectedProgram.id] ?? null
      : null;

  const openProgram = (
    program: PipelineProgram,
    trigger: HTMLButtonElement,
  ) => {
    triggerButtonRef.current = trigger;
    setSelectedProgram(program);
  };

  const closeDrawer = () => {
    setSelectedProgram(null);
    triggerButtonRef.current?.focus();
  };

  const options = useMemo(() => getProgramFilterOptions(programs), [programs]);
  const priorityOrderedPrograms = useMemo(
    () => sortProgramsForRegister(programs),
    [programs],
  );
  const filteredPrograms = useMemo(
    () => filterPrograms(priorityOrderedPrograms, filters),
    [priorityOrderedPrograms, filters],
  );
  const displayedGroups = useMemo(() => {
    const groups = groupProgramsByAsset(filteredPrograms);
    if (!sort) return groups;

    const direction = sort.direction === "ascending" ? 1 : -1;
    const defaultIndex = new Map(
      filteredPrograms.map((program, index) => [program.id, index]),
    );

    for (const group of groups) {
      group.programs.sort((a, b) => {
        const valueDiff = alphabeticalCollator.compare(
          getProgramCellValue(a, sort.columnId),
          getProgramCellValue(b, sort.columnId),
        );
        if (valueDiff !== 0) return valueDiff * direction;
        return (defaultIndex.get(a.id) ?? 0) - (defaultIndex.get(b.id) ?? 0);
      });
    }

    return groups.sort((a, b) => {
      const valueDiff = alphabeticalCollator.compare(
        getGroupSortValue(a, sort.columnId),
        getGroupSortValue(b, sort.columnId),
      );
      return valueDiff * direction || a.key.localeCompare(b.key);
    });
  }, [filteredPrograms, sort]);

  const columnControls = useProgramTableColumns();
  const visibleColumns = columnControls.visibleColumns;
  const tableWidth = visibleColumns.reduce(
    (sum, column) => sum + columnControls.getColumnWidth(column.id),
    0,
  );
  const resetFilters = () => {
    setFilters(emptyProgramFilters);
    // Clear any drill-down query so a later remount does not re-seed the
    // filters. history.replaceState updates the URL without a route navigation
    // (which Next dedupes here, since the page reads no server-side params);
    // the App Router keeps useSearchParams in sync with it.
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  const activeStageBucketLabel =
    filters.stageBucket !== "All"
      ? stageBuckets.find((bucket) => bucket.id === filters.stageBucket)?.label
      : undefined;
  const clearStageBucket = () => {
    setFilters((prev) => ({ ...prev, stageBucket: "All" }));
    // Drop the stage query but keep company (and any other param) so the URL
    // matches the screen and a refresh does not re-apply the bucket. The
    // re-seed effect then merges stageBucket:"All" without touching manual
    // filters.
    if (typeof window === "undefined" || !window.location.search) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("stage")) return;
    params.delete("stage");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  };

  const toggleSort = (columnId: ProgramTableColumnId) => {
    setSort((current) => ({
      columnId,
      direction:
        current?.columnId === columnId && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  };

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} options={options} onChange={setFilters} />
      {activeStageBucketLabel ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Stage bucket:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
            {activeStageBucketLabel}
            <button
              type="button"
              onClick={clearStageBucket}
              aria-label={`Clear ${activeStageBucketLabel} stage bucket filter`}
              className="rounded-full text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </span>
        </div>
      ) : null}
      <section className="overflow-hidden rounded-md border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">
              Program Register
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {displayedGroups.length} assets · {filteredPrograms.length} of{" "}
              {programs.length} programs shown
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {sort
                ? `Sorted by ${getProgramTableColumnLabel(
                    visibleColumns.find((column) => column.id === sort.columnId) ??
                      // A sorted column may be hidden from Column Settings later.
                      columnControls.orderedColumns.find(
                        (column) => column.id === sort.columnId,
                      )!,
                  )} (${sort.direction})`
                : "Default order: highest development priority first"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click a header to sort alphabetically · drag its right divider to
              resize
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {sort ? (
              <button
                type="button"
                onClick={() => setSort(null)}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Default priority
              </button>
            ) : null}
            <ColumnSettings controls={columnControls} />
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Reset filters
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table
            className="border-collapse text-left text-sm"
            style={{
              tableLayout: "fixed",
              width: `${tableWidth}px`,
              minWidth: "100%",
            }}
          >
            <colgroup>
              {visibleColumns.map((column) => (
                <col
                  key={column.id}
                  style={{ width: columnControls.getColumnWidth(column.id) }}
                />
              ))}
            </colgroup>
            <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                {visibleColumns.map((column) => {
                  const label = getProgramTableColumnLabel(column);
                  const activeSort = sort?.columnId === column.id ? sort : null;
                  return (
                    <th
                      key={column.id}
                      aria-sort={
                        activeSort?.direction ??
                        (!sort && column.id === "development"
                          ? "other"
                          : undefined)
                      }
                      className="relative p-0 font-semibold"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        aria-label={`Sort by ${label} ${
                          activeSort?.direction === "ascending"
                            ? "descending"
                            : "ascending"
                        }`}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 pr-4 text-left transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                      >
                        <span className="truncate">{label}</span>
                        <span aria-hidden="true" className="shrink-0 text-[0.7rem]">
                          {activeSort
                            ? activeSort.direction === "ascending"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      </button>
                      <ColumnResizeHandle
                        column={column}
                        controls={columnControls}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            {displayedGroups.map((group, groupIndex) => (
              <tbody
                key={group.key}
                aria-label={`${group.programs[0].assetName} program variants`}
                className="border-t-2 border-border first:border-t-0"
              >
                {group.programs.map((program, programIndex) => (
                  <tr
                    key={program.id}
                    onClick={(event) => {
                      const target = event.target;
                      if (
                        target instanceof Element &&
                        target.closest(
                          "a, button, input, select, textarea, [role='button']",
                        )
                      ) {
                        return;
                      }
                      const trigger =
                        event.currentTarget.querySelector<HTMLButtonElement>(
                          "button[data-program-details]",
                        );
                      if (trigger) openProgram(program, trigger);
                    }}
                    className={`cursor-pointer border-t border-border/70 transition first:border-t-0 hover:bg-accent/45 ${
                      groupIndex % 2 === 0 ? "bg-card" : "bg-muted/20"
                    }`}
                  >
                    {visibleColumns.map((column) => {
                      const value = getProgramCellValue(program, column.id);

                      return (
                        <td
                          key={column.id}
                          className="overflow-hidden px-3 py-2.5 text-muted-foreground"
                        >
                          {column.id === "company" ? (
                            <Link
                              href={`/companies/${program.companyId}`}
                              className="block truncate rounded-sm font-medium text-foreground hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              title={value}
                            >
                              {value}
                            </Link>
                          ) : column.id === "asset" ? (
                            <button
                              type="button"
                              data-program-details
                              aria-label={`Open program details for ${program.assetName}, ${formatInlineValues(program.indications)}`}
                              title={value}
                              onClick={(event) => {
                                event.stopPropagation();
                                openProgram(program, event.currentTarget);
                              }}
                              className="flex w-full min-w-0 items-center gap-2 rounded-sm text-left text-muted-foreground hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <span className="min-w-0 truncate">{value}</span>
                              {programIndex === 0 && group.programs.length > 1 ? (
                                <span className="shrink-0 rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
                                  {group.programs.length} variants
                                </span>
                              ) : null}
                            </button>
                          ) : column.id === "development" ? (
                            <StageBadge stage={value} />
                          ) : (
                            <div className="truncate" title={value}>
                              {value}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
            {filteredPrograms.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={visibleColumns.length} className="p-0">
                    {programs.length === 0 ? (
                      <EmptyState
                        title="No programs in the register yet."
                        description="Programs will appear here once company source records are added."
                      />
                    ) : (
                      <EmptyState
                        title="No programs match the current filters."
                        description="Try adjusting or resetting the filters to see more programs."
                        action={{ label: "Reset filters", onClick: resetFilters }}
                      />
                    )}
                  </td>
                </tr>
              </tbody>
            ) : null}
          </table>
        </div>
      </section>
      <ProgramDetailDrawer
        program={selectedProgram}
        clinicalPreview={clinicalPreview}
        clinicalContext={clinicalContext}
        onClose={closeDrawer}
      />
    </div>
  );
}
