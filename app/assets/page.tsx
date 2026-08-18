import { Suspense } from "react";
import type { Metadata } from "next";
import { PipelineTable } from "@/domains/app/components/PipelineTable";
import { PageHeading } from "@/domains/app/components/ui/PageHeading";
import { pipelinePrograms } from "@/domains/company-pipeline/lib/data";

export const metadata: Metadata = {
  title: "Program Register",
};

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
        <PipelineTable programs={pipelinePrograms} />
      </Suspense>
    </div>
  );
}
