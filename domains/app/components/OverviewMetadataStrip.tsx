type OverviewMetadataStripProps = {
  companyCount: number;
  programCount: number;
  /**
   * Rows whose scopeClass expresses an obesity-purpose development objective
   * (`obesity-treatment` or `obesity-adjunct`, Contract 1.2 ADR-0053). Shown
   * alongside `programCount`, never in its place: the total also includes
   * `obesity-comorbidity`, `metabolic-adjacent`, and `non-metabolic` rows on
   * already-qualified assets - see
   * `generated-output-contract.md#5-consumer-contract`.
   */
  obesityPurposeProgramCount: number;
  lastUpdated?: string;
};

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <>
      <span className="font-semibold tabular-nums text-primary">{value}</span>{" "}
      {label}
    </>
  );
}

export function OverviewMetadataStrip({
  companyCount,
  programCount,
  obesityPurposeProgramCount,
  lastUpdated,
}: OverviewMetadataStripProps) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-muted-foreground">
      <Stat
        value={companyCount}
        label={companyCount === 1 ? "company" : "companies"}
      />
      <span aria-hidden="true">&middot;</span>
      <Stat
        value={programCount}
        label={programCount === 1 ? "program" : "programs"}
      />
      <span aria-hidden="true">&middot;</span>
      <Stat
        value={`${obesityPurposeProgramCount} of ${programCount}`}
        label="obesity-purpose"
      />
      {lastUpdated ? (
        // Provenance metadata, not a KPI - kept as a trailing clause rather
        // than sharing tile chrome with the counts above.
        <span className="ml-auto text-xs text-muted-foreground">
          Updated {lastUpdated}
        </span>
      ) : null}
    </p>
  );
}
