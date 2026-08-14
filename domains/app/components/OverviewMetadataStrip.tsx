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
    <span className="flex items-baseline gap-2 px-4 py-3 first:pl-0 last:pr-0 sm:border-l sm:border-border sm:first:border-l-0 sm:first:pl-0">
      <span className="text-lg font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

export function OverviewMetadataStrip({
  companyCount,
  programCount,
  obesityPurposeProgramCount,
  lastUpdated,
}: OverviewMetadataStripProps) {
  return (
    <div className="grid border-y border-border sm:grid-cols-[auto_auto_auto_1fr] sm:items-center sm:gap-x-4">
      <Stat
        value={companyCount}
        label={companyCount === 1 ? "company" : "companies"}
      />
      <Stat
        value={programCount}
        label={programCount === 1 ? "program" : "programs"}
      />
      <Stat
        value={`${obesityPurposeProgramCount} of ${programCount}`}
        label="obesity-purpose"
      />
      {lastUpdated ? (
        // Provenance metadata, not a KPI - kept as a trailing clause rather
        // than sharing tile chrome with the counts above.
        <span className="border-t border-border py-3 text-xs text-muted-foreground sm:ml-auto sm:border-t-0 sm:text-right">
          Updated {lastUpdated}
        </span>
      ) : null}
    </div>
  );
}
