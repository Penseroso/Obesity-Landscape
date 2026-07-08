import Link from "next/link";
import { CompanyCard } from "@/components/CompanyCard";
import { StatCard } from "@/components/StatCard";
import { companies, pipelinePrograms } from "@/lib/programs/data";
import {
  getClinicalStageProgramCount,
  getCompanySummaries,
  getLatestUpdateDate,
} from "@/lib/programs/selectors";

export default function OverviewPage() {
  const companySummaries = getCompanySummaries(companies, pipelinePrograms);
  const clinicalStagePrograms = getClinicalStageProgramCount(pipelinePrograms);
  const lastUpdated = getLatestUpdateDate(pipelinePrograms);

  return (
    <div className="space-y-8 pb-10">
      <section className="grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-end">
        <div>
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
        </div>
        <Link
          href="/assets"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Browse programs
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Dataset Companies"
          value={companySummaries.length}
          helper="Configured company records"
        />
        <StatCard
          label="Dataset Programs"
          value={pipelinePrograms.length}
          helper="Local pipeline program records"
        />
        <StatCard
          label="Clinical-phase Programs"
          value={clinicalStagePrograms}
          helper="Phase 1 or later; excludes regulatory milestones"
        />
        <StatCard
          label="Last Updated"
          value={lastUpdated ?? "N/A"}
          helper="Latest local record update"
        />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Company Overview
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Company summaries are generated from company records and resolved
              pipeline programs.
            </p>
          </div>
        </div>
        {companySummaries.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {companySummaries.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground shadow-soft">
            No companies to display yet.
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-card-foreground">
              Recent Updates
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update dates appear here when local pipeline program records
              include them.
            </p>
          </div>
          {companySummaries.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[30rem]">
              {companySummaries.map((company) => (
                <div
                  key={company.id}
                  className="rounded-md border border-border bg-background px-3 py-2"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {company.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {company.lastUpdated ?? "N/A"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              No updates yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
