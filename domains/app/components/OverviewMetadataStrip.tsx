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
          ? "flex-1 min-w-[130px] px-5 py-4 first:pl-0"
          : "flex-1 min-w-[130px] border-l border-border px-5 py-4"
      }
    >
      <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-[28px] font-bold leading-none tracking-tight text-foreground">
        {value}
      </div>
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
    <div className="flex flex-wrap items-stretch rounded-md border border-border bg-card px-4 shadow-soft">
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
