import { formatNullableValue } from "@/lib/format";
import type { PipelineProgram } from "@/lib/programs/types";

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
    <section className="rounded-md border border-border bg-card shadow-soft">
      <div className="px-5 py-4">
        <h2 className="text-base font-semibold text-card-foreground">
          Most Advanced Programs
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Top programs by development-stage order.
        </p>
      </div>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Company</th>
              <th className="px-4 py-2.5 font-semibold">Asset / Code</th>
              <th className="px-4 py-2.5 font-semibold">Stage</th>
              <th className="px-4 py-2.5 font-semibold">Route</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {programs.map((program) => (
              <tr key={program.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  {formatNullableValue(program.company?.name)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-foreground">
                  {getAssetLabel(program)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                    {program.development.stage}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  {formatNullableValue(program.administration.route)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
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
