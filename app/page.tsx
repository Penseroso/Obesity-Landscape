import type { Metadata } from "next";
import { CompanyStageMatrix } from "@/domains/app/components/CompanyStageMatrix";
import { EfficacyCompareLauncher } from "@/domains/app/components/EfficacyCompareLauncher";
import { MechanismMixPanel } from "@/domains/app/components/MechanismMixPanel";
import { OverviewMetadataStrip } from "@/domains/app/components/OverviewMetadataStrip";
import { RouteMixPanel } from "@/domains/app/components/RouteMixPanel";
import { getEfficacyComparison } from "@/domains/app/lib/efficacy-comparison/read-model";
import { companies, pipelinePrograms } from "@/domains/company-pipeline/lib/data";
import {
  getCompanyStageMatrix,
  getLatestUpdateDate,
  getMechanismMix,
  getObesityPurposeProgramCount,
  getRouteDistribution,
} from "@/domains/company-pipeline/lib/selectors";

export const metadata: Metadata = {
  // The root page.tsx shares its route segment with the root layout.tsx, so
  // the layout's title.template (which applies across parent -> child
  // segment boundaries, e.g. to /assets) does not apply here - set the full
  // title directly so Overview still gets a distinct, product-named title.
  title: "Overview — Obesity Landscape",
};

export default function OverviewPage() {
  const obesityPurposePrograms = getObesityPurposeProgramCount(pipelinePrograms);
  const lastUpdated = getLatestUpdateDate(pipelinePrograms);
  const stageMatrix = getCompanyStageMatrix(companies, pipelinePrograms);
  const routeDistribution = getRouteDistribution(pipelinePrograms);
  const mechanismMix = getMechanismMix(pipelinePrograms);
  const efficacyComparison = getEfficacyComparison();

  return (
    <div className="space-y-6 pb-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Pipeline intelligence
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Obesity Landscape
        </h1>
        <p className="mt-4 max-w-none text-base leading-7 text-muted-foreground">
          Tracks companies and development programs across the competitive obesity landscape as company source records are added.
        </p>
      </section>

      <OverviewMetadataStrip
        companyCount={companies.length}
        programCount={pipelinePrograms.length}
        obesityPurposeProgramCount={obesityPurposePrograms}
        lastUpdated={lastUpdated}
      />

      {efficacyComparison.totalUnits > 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-5 py-4 shadow-soft">
          <p className="text-sm text-card-foreground">
            Compare reported body-weight reduction across{" "}
            <span className="font-semibold tabular-nums text-primary">
              {efficacyComparison.totalUnits}
            </span>{" "}
            eligible programs.
          </p>
          <EfficacyCompareLauncher families={efficacyComparison.families} />
        </section>
      ) : null}

      <CompanyStageMatrix matrix={stageMatrix} />

      <section className="grid items-stretch gap-6 md:grid-cols-2">
        <RouteMixPanel entries={routeDistribution} />
        <MechanismMixPanel entries={mechanismMix} />
      </section>
    </div>
  );
}
