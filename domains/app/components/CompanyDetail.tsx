import Link from "next/link";
import { EmptyState } from "@/domains/app/components/EmptyState";
import { StageBadge } from "@/domains/app/components/StageBadge";
import type { CompanyDetailView } from "@/domains/app/lib/company-detail/read-model";
import {
  getStageBucketId,
  stageBuckets,
} from "@/domains/company-pipeline/lib/constants";

function stageChipClassName(count: number) {
  const base =
    "inline-flex h-[26px] min-w-[34px] items-center justify-center rounded-sm border text-sm font-semibold tabular-nums";

  if (count <= 0) {
    return `${base} border-border bg-transparent text-border`;
  }
  if (count === 1) {
    return `${base} border-border bg-[hsl(var(--primary)/0.14)] text-foreground`;
  }
  if (count === 2) {
    return `${base} border-border bg-[hsl(var(--primary)/0.28)] text-foreground`;
  }
  if (count <= 4) {
    return `${base} border-primary/60 bg-[hsl(var(--primary)/0.6)] text-primary-foreground`;
  }
  return `${base} border-primary bg-primary text-primary-foreground`;
}

function clinicalDotClassName(hasClinicalEvidence: boolean, hasStudies: boolean) {
  if (hasClinicalEvidence) return "border-primary bg-primary";
  if (hasStudies) return "border-primary/40 bg-primary/40";
  return "border-border bg-transparent";
}

function clinicalDotLabel(hasClinicalEvidence: boolean, hasStudies: boolean) {
  if (hasClinicalEvidence) return "Clinical evidence available";
  if (hasStudies) return "Studies recorded; no reported outcomes yet";
  return "No clinical studies recorded";
}

export function CompanyDetail({ view }: { view: CompanyDetailView }) {
  const stageCounts = new Map<string, number>(
    stageBuckets.map((bucket) => [bucket.id, 0]),
  );
  for (const asset of view.assets) {
    for (const variant of asset.programVariants) {
      const bucketId = getStageBucketId(variant.development.stage);
      stageCounts.set(bucketId, (stageCounts.get(bucketId) ?? 0) + 1);
    }
  }

  const registerHref = `/assets?company=${encodeURIComponent(view.company.id)}`;

  return (
    <div className="space-y-6 pb-10">
      <Link
        href="/assets"
        className="inline-flex rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Back to Program Register
      </Link>

      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Company portfolio
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {view.company.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Headquarters: {view.company.headquartersCountry}
        </p>
      </section>

      <section className="rounded-md border border-border bg-card shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-card-foreground">
            Development stage distribution
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
          {stageBuckets.map((bucket) => {
            const count = stageCounts.get(bucket.id) ?? 0;
            const chip = (
              <span className={stageChipClassName(count)}>
                {count > 0 ? count : <>&ndash;</>}
              </span>
            );
            return (
              <div key={bucket.id} className="flex items-center gap-2">
                {count > 0 ? (
                  <Link
                    href={`${registerHref}&stageBucket=${bucket.id}`}
                    aria-label={`${bucket.label}, ${count} program${
                      count === 1 ? "" : "s"
                    } — open in Program Register`}
                    className="inline-flex rounded-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {chip}
                  </Link>
                ) : (
                  chip
                )}
                <span className="text-xs text-muted-foreground">
                  {bucket.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-border px-5 py-3 text-sm text-muted-foreground">
          <span>
            {view.summary.assetCount}{" "}
            {view.summary.assetCount === 1 ? "asset" : "assets"}
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>{view.summary.programRowCount} program rows</span>
          <Link
            href={registerHref}
            className="ml-auto rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            View all in Program Register &rarr;
          </Link>
        </div>
      </section>

      {view.assets.length === 0 ? (
        <EmptyState
          title="No programs are registered for this company yet."
          description="Assets will appear here once company program records are added."
        />
      ) : (
        <section aria-labelledby="company-assets-heading" className="space-y-3">
          <h2
            id="company-assets-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            In-scope assets ({view.assets.length})
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card shadow-soft">
            {view.assets.map((asset) => {
              const mostAdvancedStage = asset.programVariants[0]?.development.stage;
              const variantCount = asset.programVariants.length;
              // Route into the Program Register pre-filtered to this asset
              // (company + a keyword seed matching the asset name) rather than
              // straight to the Asset Clinical Detail page: the register's row
              // drawer already surfaces the same clinical-context link, plus
              // the mechanism/route/indication facts this list no longer
              // duplicates inline.
              const assetHref = `${registerHref}&keyword=${encodeURIComponent(
                asset.assetName,
              )}`;
              return (
                <li key={`${asset.companyId}|${asset.assetId}`}>
                  <Link
                    href={assetHref}
                    className="flex flex-col gap-3 p-5 transition hover:bg-accent/35 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full border ${clinicalDotClassName(
                          asset.clinical.hasClinicalEvidence,
                          asset.clinical.hasStudies,
                        )}`}
                      >
                        <span className="sr-only">
                          {clinicalDotLabel(
                            asset.clinical.hasClinicalEvidence,
                            asset.clinical.hasStudies,
                          )}
                        </span>
                      </span>
                      <span className="flex flex-col">
                        <span className="text-base font-semibold text-card-foreground">
                          {asset.assetName}
                        </span>
                        {asset.codeName ? (
                          <span className="text-xs text-muted-foreground">
                            Code {asset.codeName}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      {mostAdvancedStage ? (
                        <StageBadge stage={mostAdvancedStage} />
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {variantCount} {variantCount === 1 ? "variant" : "variants"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
