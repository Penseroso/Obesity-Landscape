import { Suspense } from "react";
import type { Metadata } from "next";
import { PipelineTable } from "@/domains/app/components/PipelineTable";
import { PageHeading } from "@/domains/app/components/ui/PageHeading";
import {
  getAssetClinicalRollup,
  getProgramStudyPreview,
  type AssetClinicalRollup,
  type ProgramStudyPreview,
} from "@/domains/app/lib/clinical-evidence/selectors";
import { pipelinePrograms } from "@/domains/company-pipeline/lib/data";

export const metadata: Metadata = {
  title: "Program Register",
};

// Precompute explicit programId matches so the client drawer never imports or
// infers relationships from the Clinical Evidence data layer.
const clinicalPreviewByProgramId: Record<string, ProgramStudyPreview> =
  Object.fromEntries(
    pipelinePrograms.flatMap((program) => {
      const preview = getProgramStudyPreview(program.id);
      return preview ? [[program.id, preview]] : [];
    }),
  );

// Asset-level context deliberately uses the existing focal/linked read model.
// It is kept separate from the exact programId preview above.
const clinicalContextByProgramId: Record<string, AssetClinicalRollup> =
  Object.fromEntries(
    pipelinePrograms.flatMap((program) => {
      const rollup = getAssetClinicalRollup(program.companyId, program.assetId);
      return rollup ? [[program.id, rollup]] : [];
    }),
  );

export default function AssetsPage() {
  return (
    <div className="space-y-6 pb-10">
      <PageHeading
        title="Program Register"
        description="A searchable register of obesity landscape development programs."
      />
      {/* PipelineTable reads drill-down filters from the URL via
          useSearchParams, which requires a Suspense boundary on this
          statically-rendered route. */}
      <Suspense
        fallback={
          <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground shadow-soft">
            Loading register…
          </div>
        }
      >
        <PipelineTable
          programs={pipelinePrograms}
          clinicalPreviewByProgramId={clinicalPreviewByProgramId}
          clinicalContextByProgramId={clinicalContextByProgramId}
        />
      </Suspense>
    </div>
  );
}
