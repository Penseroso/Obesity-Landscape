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
    <div className="space-y-10 pb-12">
      <section className="pt-2">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Obesity Landscape
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
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
        <section className="grid gap-5 rounded-md bg-accent px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-accent-foreground">
              Compare reported efficacy
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Build a cross-family chart from {efficacyComparison.totalUnits} eligible
              programs while keeping each source-reported dose and duration visible.
            </p>
          </div>
          <EfficacyCompareLauncher families={efficacyComparison.families} />
        </section>
      ) : null}

      <CompanyStageMatrix matrix={stageMatrix} />

      <section className="grid items-start gap-6 lg:grid-cols-2">
        <RouteMixPanel entries={routeDistribution} />
        <MechanismMixPanel entries={mechanismMix} />
      </section>
    </div>
  );
}
