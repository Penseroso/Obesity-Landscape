import type { CompanyStageMatrix as CompanyStageMatrixData } from "@/lib/programs/selectors";

type CompanyStageMatrixProps = {
  matrix: CompanyStageMatrixData;
};

function cellStyle(count: number, maxCellCount: number) {
  if (count === 0 || maxCellCount === 0) {
    return undefined;
  }

  const intensity = 0.12 + 0.5 * (count / maxCellCount);
  return { backgroundColor: `hsl(var(--primary) / ${intensity})` };
}

export function CompanyStageMatrix({ matrix }: CompanyStageMatrixProps) {
  const { columns, rows, maxCellCount } = matrix;

  return (
    <section className="rounded-md border border-border bg-card shadow-soft">
      <div className="border-b border-border px-5 py-5">
        <h2 className="text-lg font-semibold tracking-tight text-card-foreground">
          Company &times; Development Stage Matrix
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Program counts per company across registry-backed stage buckets.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
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
                    <td
                      key={column.id}
                      className="px-3 py-2.5 text-center text-muted-foreground"
                      style={cellStyle(count, maxCellCount)}
                    >
                      {count > 0 ? (
                        <span className="font-medium">{count}</span>
                      ) : (
                        <span className="text-border">&ndash;</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-center font-semibold text-foreground">
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
