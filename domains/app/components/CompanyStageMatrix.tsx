import Link from "next/link";
import { stageCountChipClassName } from "@/domains/app/components/StageCountChip";
import type { CompanyStageMatrix as CompanyStageMatrixData } from "@/domains/company-pipeline/lib/selectors";

type CompanyStageMatrixProps = {
  matrix: CompanyStageMatrixData;
};

export function CompanyStageMatrix({ matrix }: CompanyStageMatrixProps) {
  const { columns, rows } = matrix;

  return (
    <section>
      <div className="mb-4 max-w-3xl">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Company &times; Development Stage Matrix
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Ordered stage distribution by company. Regulatory milestones are
          shown separately from clinical phases.
        </p>
      </div>
      <div className="max-h-[70vh] overflow-auto border-y border-border bg-card">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="sticky left-0 top-0 z-30 w-52 max-w-52 border-r border-border bg-muted px-4 py-3 font-semibold sm:w-64 sm:max-w-64">
                Company
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="sticky top-0 z-20 bg-muted px-3 py-3 text-center font-semibold"
                >
                  {column.label}
                </th>
              ))}
              <th className="sticky top-0 z-20 bg-muted px-4 py-3 text-center font-semibold">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.companyId} className="group hover:bg-muted/25">
                <td className="sticky left-0 z-10 w-52 max-w-52 border-r border-border bg-card px-4 py-3 font-medium text-foreground group-hover:bg-muted sm:w-64 sm:max-w-64">
                  <Link
                    href={`/companies/${row.companyId}`}
                    title={row.companyName}
                    className="block truncate rounded-sm hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {row.companyName}
                  </Link>
                </td>
                {columns.map((column) => {
                  const count = row.counts[column.id];
                  const chip = (
                    <span className={stageCountChipClassName(count)}>
                      {count > 0 ? count : <>&ndash;</>}
                    </span>
                  );
                  return (
                    <td key={column.id} className="px-3 py-3 text-center">
                      {count > 0 ? (
                        // Drill-down: reproduce this exact cell in the Program
                        // Register via company + stage-bucket URL filters. Zero
                        // cells stay non-interactive.
                        <Link
                          href={`/assets?company=${encodeURIComponent(
                            row.companyId,
                          )}&stageBucket=${column.id}`}
                          aria-label={`${row.companyName} ${column.label}, ${count} program${
                            count === 1 ? "" : "s"
                          } — open in Program Register`}
                          className="inline-flex rounded-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {chip}
                        </Link>
                      ) : (
                        chip
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center font-semibold tabular-nums text-primary">
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
