import type { StageBucketId } from "@/domains/company-pipeline/lib/constants";
import type { CompanyStageMatrix as CompanyStageMatrixData } from "@/domains/company-pipeline/lib/selectors";

type CompanyStageMatrixProps = {
  matrix: CompanyStageMatrixData;
};

const legend: { label: string; bucketIds: StageBucketId[]; swatchClass: string }[] = [
  { label: "Early", bucketIds: ["preclinical"], swatchClass: "bg-[hsl(var(--primary)/0.18)]" },
  {
    label: "Regulatory milestone",
    bucketIds: ["regulatory-milestone"],
    swatchClass: "bg-[hsl(var(--primary)/0.35)]",
  },
  {
    label: "Clinical",
    bucketIds: ["phase-1", "phase-2", "phase-3"],
    swatchClass: "bg-[hsl(var(--primary)/0.55)]",
  },
  {
    label: "Late-stage",
    bucketIds: ["filed-approved"],
    swatchClass: "bg-[hsl(var(--primary)/0.85)]",
  },
];

function heatChipClassName(count: number) {
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
    return `${base} border-primary/60 bg-[hsl(var(--primary)/0.7)] text-primary-foreground`;
  }
  return `${base} border-primary bg-primary text-primary-foreground`;
}

export function CompanyStageMatrix({ matrix }: CompanyStageMatrixProps) {
  const { columns, rows } = matrix;

  return (
    <section className="rounded-md border border-border bg-card shadow-soft">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-card-foreground">
            Company &times; Development Stage Matrix
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ordered stage distribution by company. Regulatory milestones are
            shown separately from clinical phases.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {legend.map((entry) => (
            <li key={entry.label} className="inline-flex items-center gap-1.5">
              <span
                className={`h-2.5 w-4 rounded-sm border border-border ${entry.swatchClass}`}
                aria-hidden="true"
              />
              {entry.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Company</th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="px-3 py-2.5 text-center font-semibold"
                >
                  {column.label}
                </th>
              ))}
              <th className="px-4 py-2.5 text-center font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.companyId}>
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground">
                  {row.companyName}
                </td>
                {columns.map((column) => {
                  const count = row.counts[column.id];
                  return (
                    <td key={column.id} className="px-3 py-2.5 text-center">
                      <span className={heatChipClassName(count)}>
                        {count > 0 ? count : <>&ndash;</>}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-primary">
                  {row.total}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No companies to display.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
