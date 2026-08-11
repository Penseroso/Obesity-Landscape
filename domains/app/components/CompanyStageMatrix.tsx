import Link from "next/link";
import { stageCountChipClassName } from "@/domains/app/components/StageCountChip";
import type { CompanyStageMatrix as CompanyStageMatrixData } from "@/domains/company-pipeline/lib/selectors";

type CompanyStageMatrixProps = {
  matrix: CompanyStageMatrixData;
};

export function CompanyStageMatrix({ matrix }: CompanyStageMatrixProps) {
  const { columns, rows } = matrix;

  return (
    <section className="rounded-md border border-border bg-card shadow-soft">
      <div className="border-b border-border px-5 py-5">
        <h2 className="text-lg font-semibold tracking-tight text-card-foreground">
          Company &times; Development Stage Matrix
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ordered stage distribution by company. Regulatory milestones are
          shown separately from clinical phases.
        </p>
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
                  <Link
                    href={`/companies/${row.companyId}`}
                    className="rounded-sm hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                    <td key={column.id} className="px-3 py-2.5 text-center">
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
