import { CompanyStageMatrix } from "@/components/CompanyStageMatrix";
import { MostAdvancedProgramsTable } from "@/components/MostAdvancedProgramsTable";
import { OverviewMetadataStrip } from "@/components/OverviewMetadataStrip";
import { RouteMixPanel } from "@/components/RouteMixPanel";
import { companies, pipelinePrograms } from "@/lib/programs/data";
import {
  getClinicalStageProgramCount,
  getCompanyStageMatrix,
  getLatestUpdateDate,
  getMostAdvancedPrograms,
  getRouteDistribution,
} from "@/lib/programs/selectors";

export default function OverviewPage() {
  const clinicalStagePrograms = getClinicalStageProgramCount(pipelinePrograms);
  const lastUpdated = getLatestUpdateDate(pipelinePrograms);
  const stageMatrix = getCompanyStageMatrix(companies, pipelinePrograms);
  const routeDistribution = getRouteDistribution(pipelinePrograms);
  const mostAdvancedPrograms = getMostAdvancedPrograms(pipelinePrograms, 5);

  return (
    <div className="space-y-6 pb-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Pipeline intelligence
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Obesity Landscape
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Tracks companies and development programs across the
          obesity/incretin competitive landscape as company source records
          are added.
        </p>
      </section>

      <OverviewMetadataStrip
        companyCount={companies.length}
        programCount={pipelinePrograms.length}
        clinicalPhaseCount={clinicalStagePrograms}
        lastUpdated={lastUpdated}
      />

      <CompanyStageMatrix matrix={stageMatrix} />

      <section className="grid items-stretch gap-6 md:grid-cols-2">
        <RouteMixPanel entries={routeDistribution} />
        <MostAdvancedProgramsTable programs={mostAdvancedPrograms} />
      </section>
    </div>
  );
}
