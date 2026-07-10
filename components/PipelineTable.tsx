"use client";

import { useMemo, useState } from "react";
import {
  getProgramTableColumnLabel,
  type ProgramTableColumnId,
} from "@/config/program-table";
import {
  emptyProgramFilters,
  filterPrograms,
} from "@/lib/programs/filters";
import {
  getProgramFilterOptions,
  sortProgramsForRegister,
} from "@/lib/programs/selectors";
import type { PipelineProgram, ProgramFilters } from "@/lib/programs/types";
import { formatInlineValues, formatNullableValue } from "@/lib/format";
import { ColumnSettings } from "./ColumnSettings";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { ProgramDetailDrawer } from "./ProgramDetailDrawer";
import { StageBadge } from "./StageBadge";
import { useProgramTableColumns } from "./useProgramTableColumns";

type PipelineTableProps = {
  programs: PipelineProgram[];
};

function getAssetLabel(program: PipelineProgram) {
  const codeName = program.codeName?.trim();
  const assetName = program.assetName.trim();

  if (!codeName || codeName.toLowerCase() === assetName.toLowerCase()) {
    return program.assetName;
  }

  return `${program.assetName} (${program.codeName})`;
}

const truncatedCellClassName: Partial<Record<ProgramTableColumnId, string>> = {
  company: "max-w-[140px] truncate",
  asset: "max-w-[200px] truncate",
  mechanism: "max-w-[200px] truncate",
  dosageForm: "max-w-[120px] truncate",
  dosingInterval: "max-w-[150px] truncate",
  indications: "max-w-[200px] truncate",
  platform: "max-w-[160px] truncate",
};

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

export function PipelineTable({ programs }: PipelineTableProps) {
  const [filters, setFilters] = useState<ProgramFilters>(emptyProgramFilters);
  const [selectedProgram, setSelectedProgram] = useState<PipelineProgram | null>(
    null,
  );

  const options = useMemo(() => getProgramFilterOptions(programs), [programs]);
  const orderedPrograms = useMemo(
    () => sortProgramsForRegister(programs),
    [programs],
  );
  const filteredPrograms = useMemo(
    () => filterPrograms(orderedPrograms, filters),
    [orderedPrograms, filters],
  );
  const columnControls = useProgramTableColumns();
  const visibleColumns = columnControls.visibleColumns;
  const resetFilters = () => setFilters(emptyProgramFilters);

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} options={options} onChange={setFilters} />
      <section className="overflow-hidden rounded-md border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">
              Program Register
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredPrograms.length} of {programs.length} programs shown
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
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
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column.id} className="px-4 py-2.5 font-semibold">
                    {getProgramTableColumnLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPrograms.map((program) => (
                <tr
                  key={program.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedProgram(program)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedProgram(program);
                    }
                  }}
                  className="cursor-pointer bg-card transition hover:bg-accent/45 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  {visibleColumns.map((column) => {
                    const value = getProgramCellValue(program, column.id);
                    const truncateClassName = truncatedCellClassName[column.id];

                    return (
                      <td
                        key={column.id}
                        className="px-4 py-2.5 text-muted-foreground"
                      >
                        {column.id === "development" ? (
                          <StageBadge stage={value} />
                        ) : truncateClassName ? (
                          <div
                            className={`truncate ${truncateClassName}`}
                            title={value}
                          >
                            {value}
                          </div>
                        ) : (
                          <span className="whitespace-nowrap">{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredPrograms.length === 0 ? (
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
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <ProgramDetailDrawer
        program={selectedProgram}
        onClose={() => setSelectedProgram(null)}
      />
    </div>
  );
}
