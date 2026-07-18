"use client";

import type { ProgramFilterOptions, ProgramFilters } from "@/domains/company-pipeline/lib/types";

type FilterBarProps = {
  filters: ProgramFilters;
  options: ProgramFilterOptions;
  onChange: (filters: ProgramFilters) => void;
};

const selectClassName =
  "h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

function SelectFilter({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName}
      >
        <option value="All">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({ filters, options, onChange }: FilterBarProps) {
  const update = (partial: Partial<ProgramFilters>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-soft">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground xl:col-span-2">
          Keyword
          <input
            value={filters.keyword}
            onChange={(event) => update({ keyword: event.target.value })}
            placeholder="Search company, asset, mechanism, indication"
            className="h-9 rounded-md border border-border bg-card px-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </label>
        <SelectFilter
          label="Company"
          allLabel="All companies"
          value={filters.company}
          options={options.companies}
          onChange={(company) => update({ company })}
        />
        <SelectFilter
          label="Indication"
          allLabel="All indications"
          value={filters.indication}
          options={options.indications}
          onChange={(indication) => update({ indication })}
        />
        <SelectFilter
          label="Route"
          allLabel="All routes"
          value={filters.route}
          options={options.routes}
          onChange={(route) => update({ route })}
        />
        <SelectFilter
          label="Stage"
          allLabel="All stages"
          value={filters.stage}
          options={options.stages}
          onChange={(stage) => update({ stage: stage as ProgramFilters["stage"] })}
        />
        <SelectFilter
          label="Status"
          allLabel="All statuses"
          value={filters.status}
          options={options.statuses}
          onChange={(status) =>
            update({ status: status as ProgramFilters["status"] })
          }
        />
      </div>
    </section>
  );
}
