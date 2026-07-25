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
  clinicalPhaseCount: number;
  lastUpdated?: string;
};

function MetadataItem({
  value,
  label,
  first,
}: {
  value: string | number;
  label: string;
  first?: boolean;
}) {
  return (
    <div
      className={
        first
          ? "flex items-baseline gap-1.5 px-4 py-2 first:pl-0"
          : "flex items-baseline gap-1.5 border-l border-border px-4 py-2"
      }
    >
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function OverviewMetadataStrip({
  companyCount,
  programCount,
  obesityPurposeProgramCount,
  clinicalPhaseCount,
  lastUpdated,
}: OverviewMetadataStripProps) {
  return (
    <div className="flex flex-wrap items-stretch rounded-md border border-border bg-card px-4">
      <MetadataItem
        first
        value={companyCount}
        label={companyCount === 1 ? "Company" : "Companies"}
      />
      <MetadataItem
        value={programCount}
        label={programCount === 1 ? "Program" : "Programs"}
      />
      <MetadataItem
        value={`${obesityPurposeProgramCount} of ${programCount}`}
        label="Obesity-purpose"
      />
      <MetadataItem value={clinicalPhaseCount} label="Clinical-phase" />
      {lastUpdated ? (
        <MetadataItem value={lastUpdated} label="Latest updated" />
      ) : null}
    </div>
  );
}
