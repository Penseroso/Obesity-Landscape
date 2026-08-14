import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { EmptyState } from "@/domains/app/components/EmptyState";
import { StageBadge } from "@/domains/app/components/StageBadge";
import { buttonVariants } from "@/domains/app/components/ui/Button";
import { PageHeading } from "@/domains/app/components/ui/PageHeading";
import type { CompanyDetailView } from "@/domains/app/lib/company-detail/read-model";
import {
  getStageBucketId,
  stageBuckets,
} from "@/domains/company-pipeline/lib/constants";

function clinicalPillLabel(hasClinicalEvidence: boolean) {
  return hasClinicalEvidence ? "Clinical evidence" : "Studies recorded";
}

function capitalize(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}

function formatOwnRelationshipLabel(role: string, counterpartyName: string): string {
  switch (role) {
    case "licensor":
      return `Licensed from ${counterpartyName}`;
    case "licensee":
      return `Licensed to ${counterpartyName}`;
    case "co-developer":
      return `Co-developed with ${counterpartyName}`;
    case "originator":
      return `Originated by ${counterpartyName}`;
    default:
      return `${capitalize(role)}: ${counterpartyName}`;
  }
}

export function CompanyDetail({
  view,
  compareUnitKeyByAsset,
}: {
  view: CompanyDetailView;
  /** Asset `companyId|assetId` -> Efficacy Comparison `unitKey`, eligible rows only. */
  compareUnitKeyByAsset: Map<string, string>;
}) {
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

      <PageHeading
        title={view.company.name}
        meta={<>Headquarters: {view.company.headquartersCountry}</>}
        actions={
          view.company.officialWebsite || view.company.officialPipeline ? (
            <>
            {view.company.officialWebsite ? (
              <a
                href={view.company.officialWebsite.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Checked ${view.company.officialWebsite.checkedAt}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Official website
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
            ) : null}
            {view.company.officialPipeline ? (
              <a
                href={view.company.officialPipeline.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Checked ${view.company.officialPipeline.checkedAt}`}
                className={buttonVariants({ variant: "primary" })}
              >
                Official pipeline
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
            ) : null}
            </>
          ) : null
        }
      />

      <section
        id="stage-distribution"
        aria-labelledby="stage-distribution-heading"
        className="border-y border-border"
      >
        <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="stage-distribution-heading"
              className="text-base font-semibold text-foreground"
            >
              Development portfolio
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {view.summary.assetCount}{" "}
              {view.summary.assetCount === 1 ? "asset" : "assets"} across{" "}
              {view.summary.programRowCount} program rows
            </p>
          </div>
          <Link
            href={registerHref}
            className="inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            View in Program Register
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-6">
          {stageBuckets.map((bucket) => {
            const count = stageCounts.get(bucket.id) ?? 0;
            const chip = (
              <span
                className={`text-lg font-semibold tabular-nums ${
                  count > 0 ? "text-primary" : "font-normal text-muted-foreground"
                }`}
              >
                {count > 0 ? count : <>&ndash;</>}
              </span>
            );
            return (
              <div
                key={bucket.id}
                className="flex flex-col-reverse gap-1 border-b border-border py-3 pr-4 [&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-last-child(-n+3)]:border-b-0 lg:border-b-0"
              >
                {count > 0 ? (
                  <Link
                    href={`${registerHref}&stageBucket=${bucket.id}`}
                    aria-label={`${bucket.label}, ${count} program${
                      count === 1 ? "" : "s"
                    } — open in Program Register`}
                    className="inline-flex w-fit rounded-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
          <ul className="max-w-6xl border-t border-border">
            {view.assets.map((asset) => {
              const leadVariant = asset.programVariants[0];
              const mostAdvancedStage = leadVariant?.development.stage;
              const variantCount = asset.programVariants.length;
              // The lead (most-advanced) variant's mechanism, shown as identity
              // context only - not re-deriving or hardcoding a label. Mechanism
              // is consistent across a given asset's variants in every case but
              // one (a wording-only split, not a real second mechanism), so the
              // lead variant's value is representative.
              const mechanism = leadVariant?.technical.mechanism ?? null;
              // Route into the Program Register pre-filtered to this asset
              // (company + a keyword seed matching the asset name) rather than
              // straight to the Asset Clinical Detail page: the register's row
              // drawer already surfaces the same clinical-context link, plus
              // the route/indication facts this list still doesn't duplicate
              // inline.
              const assetHref = `${registerHref}&keyword=${encodeURIComponent(
                asset.assetName,
              )}`;
              const compareUnitKey = compareUnitKeyByAsset.get(
                `${asset.companyId}|${asset.assetId}`,
              );
              const relationshipBadges = Array.from(
                new Map(
                  asset.programVariants
                    .flatMap((variant) => variant.relationshipBadges)
                    .map((detail) => [
                      `${detail.role}|${detail.counterpartyName}|${detail.territories.join("|")}`,
                      detail,
                    ]),
                ).values(),
              );
              return (
                <li
                  key={`${asset.companyId}|${asset.assetId}`}
                  className="border-b border-border py-5 transition hover:bg-accent/15"
                >
                  <div className="min-w-0">
                    <Link
                      href={assetHref}
                      className="rounded-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className="text-base font-semibold text-primary">
                        {asset.assetName}
                      </span>
                      {asset.codeName || mechanism ? (
                        <span className="block text-xs text-muted-foreground">
                          {[
                            asset.codeName ? `Code ${asset.codeName}` : null,
                            mechanism,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </Link>
                    {relationshipBadges.map((detail) => (
                      <span
                        key={`${detail.role}|${detail.counterpartyName}|${detail.territories.join("|")}`}
                        className="block text-xs text-muted-foreground"
                      >
                        {detail.counterpartyCompanyId ? (
                          <Link
                            href={`/companies/${encodeURIComponent(detail.counterpartyCompanyId)}`}
                            className="rounded-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            {formatOwnRelationshipLabel(detail.role, detail.counterpartyName)}
                          </Link>
                        ) : (
                          formatOwnRelationshipLabel(detail.role, detail.counterpartyName)
                        )}
                        {detail.territories.length > 0
                          ? ` · ${detail.territories.join(", ")}`
                          : ""}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {mostAdvancedStage ? (
                      <StageBadge stage={mostAdvancedStage} />
                    ) : null}
                    <span className="flex-none text-xs text-muted-foreground">
                      {variantCount} {variantCount === 1 ? "variant" : "variants"}
                    </span>
                    {asset.clinical.hasStudies ? (
                      <Link
                        href={asset.clinical.href}
                        className="inline-flex flex-none items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {clinicalPillLabel(asset.clinical.hasClinicalEvidence)}
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                    {compareUnitKey ? (
                      <Link
                        href={`/efficacy-comparison?unit=${encodeURIComponent(compareUnitKey)}&open=1`}
                        className="inline-flex flex-none items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Compare efficacy
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {view.partneredAssets.length > 0 ? (
        <section
          aria-labelledby="company-partnered-assets-heading"
          className="space-y-3"
        >
          <h2
            id="company-partnered-assets-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Partnered assets ({view.partneredAssets.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Programs principally developed by another company, with the exact
            role and licensed or partnered territory recorded for {" "}
            {view.company.name}.
          </p>
          <ul className="max-w-6xl border-t border-border">
            {view.partneredAssets.map((asset) => {
              const leadVariant = asset.programVariants[0];
              const mostAdvancedStage = leadVariant?.development.stage;
              const relationshipDetails = Array.from(
                new Map(
                  asset.programVariants
                    .flatMap((variant) => variant.relationshipDetails)
                    .map((detail) => [
                      `${detail.role}|${detail.territories.join("|")}`,
                      detail,
                    ]),
                ).values(),
              );
              const ownerHref = `/companies/${encodeURIComponent(
                asset.ownerCompanyId,
              )}`;
              return (
                <li
                  key={`${asset.ownerCompanyId}|${asset.assetId}`}
                  className="border-b border-border py-5"
                >
                  <div className="min-w-0">
                    <span className="text-base font-semibold text-foreground">
                      {asset.assetName}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Developed by{" "}
                      <Link
                        href={ownerHref}
                        className="rounded-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {asset.ownerCompanyName}
                      </Link>
                      {asset.codeName ? ` · Code ${asset.codeName}` : null}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="contents">
                    {mostAdvancedStage ? (
                      <StageBadge stage={mostAdvancedStage} />
                    ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {relationshipDetails.map((detail) => (
                      <p
                        key={`${detail.role}|${detail.territories.join("|")}`}
                        className="text-sm leading-5 text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">
                          {capitalize(detail.role)}
                        </span>
                        {" · "}
                        {detail.territories.length > 0
                          ? detail.territories.join(", ")
                          : "Territory not specified"}
                      </p>
                    ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
