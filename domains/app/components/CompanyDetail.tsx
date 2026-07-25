import Link from "next/link";
import { EmptyState } from "@/domains/app/components/EmptyState";
import { StageBadge } from "@/domains/app/components/StageBadge";
import type { CompanyDetailView } from "@/domains/app/lib/company-detail/read-model";
import { formatInlineValues, formatNullableValue } from "@/domains/app/lib/format";
import { getScopeClassEntry } from "@/domains/company-pipeline/lib/constants";

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-soft">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-semibold text-card-foreground">
        {value}
      </dd>
    </div>
  );
}

function VariantField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function CompanyDetail({ view }: { view: CompanyDetailView }) {
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

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Assets" value={view.summary.assetCount} />
        <Metric label="Program rows" value={view.summary.programRowCount} />
        <Metric
          label="Assets with clinical evidence"
          value={view.summary.clinicalEvidenceAssetCount}
        />
        <Metric
          label="Associated clinical studies"
          value={view.summary.associatedClinicalStudyCount}
        />
      </dl>

      {view.assets.length === 0 ? (
        <EmptyState
          title="No programs are registered for this company yet."
          description="Assets will appear here once company program records are added."
        />
      ) : (
        <section aria-labelledby="company-assets-heading" className="space-y-4">
          <h2
            id="company-assets-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            In-scope assets
          </h2>
          <ul className="space-y-4">
            {view.assets.map((asset) => (
              <li key={`${asset.companyId}|${asset.assetId}`}>
                <details className="group overflow-hidden rounded-md border border-border bg-card shadow-soft">
                  <summary className="flex cursor-pointer list-none flex-col gap-4 p-5 transition hover:bg-accent/35 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:flex-row sm:items-start sm:justify-between [&::-webkit-details-marker]:hidden">
                    <div>
                      <span className="text-lg font-semibold text-card-foreground">
                        {asset.assetName}
                      </span>
                      {asset.codeName ? (
                        <span className="mt-1 block text-sm text-muted-foreground">
                          Code {asset.codeName}
                        </span>
                      ) : null}
                      {asset.aliases?.length ? (
                        <span className="mt-2 block text-xs text-muted-foreground">
                          Aliases: {asset.aliases.map((alias) => alias.value).join(", ")}
                        </span>
                      ) : null}
                    </div>
                    <span className="flex items-start gap-3 sm:items-center">
                      <span className="flex flex-col sm:items-end">
                        <span className="text-sm font-medium text-foreground">
                          {asset.clinical.hasClinicalEvidence
                            ? "Clinical evidence available"
                            : asset.clinical.hasStudies
                              ? "Studies recorded; no recorded outcomes"
                              : "No clinical studies"}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          {asset.clinical.focalStudyCount} focal /{" "}
                          {asset.clinical.linkedStudyCount} linked
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="mt-0.5 text-muted-foreground transition-transform group-open:rotate-180 sm:mt-0"
                      >
                        &#9662;
                      </span>
                    </span>
                  </summary>

                  <div className="border-t border-border p-5">
                    <Link
                      href={asset.clinical.href}
                      className="inline-flex rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      View Asset Clinical Detail
                    </Link>
                    <h3 className="mt-5 text-sm font-semibold text-card-foreground">
                      Program variants ({asset.programVariants.length})
                    </h3>
                    <ul className="mt-3 space-y-3">
                      {asset.programVariants.map((variant) => (
                        <li
                          key={variant.id}
                          className="rounded-md border border-border bg-background/50 p-4"
                        >
                          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <VariantField label="Indication">
                              {formatInlineValues(variant.indications)}
                            </VariantField>
                            <VariantField label="Scope class">
                              {getScopeClassEntry(variant.scopeClass).label}
                            </VariantField>
                            <VariantField label="Development stage">
                              <StageBadge stage={variant.development.stage} />
                            </VariantField>
                            <VariantField label="Status">
                              {variant.development.status}
                            </VariantField>
                            <VariantField label="Operational state">
                              {formatNullableValue(
                                variant.development.stageOperationalState,
                              )}
                            </VariantField>
                            <VariantField label="Route">
                              {variant.administration.route}
                            </VariantField>
                            <VariantField label="Dosage form">
                              {variant.administration.dosageForm}
                            </VariantField>
                            <VariantField label="Dosing interval">
                              {formatNullableValue(
                                variant.administration.dosingInterval,
                              )}
                            </VariantField>
                            <VariantField label="Mechanism">
                              {formatNullableValue(variant.technical.mechanism)}
                            </VariantField>
                            <VariantField label="Platform">
                              {formatNullableValue(variant.technical.platform)}
                            </VariantField>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
