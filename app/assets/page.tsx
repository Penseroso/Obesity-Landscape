import { PipelineTable } from "@/components/PipelineTable";
import { pipelinePrograms } from "@/lib/programs/data";

export default function AssetsPage() {
  return (
    <div className="space-y-6 pb-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Program intelligence
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Obesity Landscape Programs
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Search and filter local obesity/incretin competitive programs by
          company, indication, route, development stage, and development
          status.
        </p>
      </section>
      <PipelineTable programs={pipelinePrograms} />
    </div>
  );
}
