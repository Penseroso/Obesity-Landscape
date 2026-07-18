import { formatNullableValue } from "@/domains/app/lib/format";
import type { PipelineProgram } from "@/domains/company-pipeline/lib/types";

type MostAdvancedProgramsTableProps = {
  programs: PipelineProgram[];
};

function getAssetLabel(program: PipelineProgram) {
  return program.codeName
    ? `${program.assetName} (${program.codeName})`
    : program.assetName;
}

export function MostAdvancedProgramsTable({
  programs,
}: MostAdvancedProgramsTableProps) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded-md border border-border bg-card shadow-soft">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-card-foreground">
          Most Advanced Programs
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Top programs by development-stage order.
        </p>
      </div>
      <div className="flex-1 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">Company</th>
              <th className="px-4 py-2 font-semibold">Asset</th>
              <th className="px-4 py-2 font-semibold">Stage</th>
              <th className="px-4 py-2 font-semibold">Route</th>
              <th className="px-4 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {programs.map((program) => (
              <tr key={program.id}>
                <td
                  className="max-w-[150px] truncate px-4 py-2 text-muted-foreground"
                  title={program.company?.name ?? undefined}
                >
                  {formatNullableValue(program.company?.name)}
                </td>
                <td
                  className="max-w-[220px] truncate px-4 py-2 text-foreground"
                  title={getAssetLabel(program)}
                >
                  {getAssetLabel(program)}
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  <span className="inline-flex items-center rounded-sm border border-border bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                    {program.development.stage}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                  {formatNullableValue(program.administration.route)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                  {program.development.status}
                </td>
              </tr>
            ))}
            {programs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No programs to display.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
