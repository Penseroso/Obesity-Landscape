type OverviewMetadataStripProps = {
  companyCount: number;
  programCount: number;
  clinicalPhaseCount: number;
  lastUpdated?: string;
};

function MetadataItem({ children }: { children: React.ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>;
}

export function OverviewMetadataStrip({
  companyCount,
  programCount,
  clinicalPhaseCount,
  lastUpdated,
}: OverviewMetadataStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
      <MetadataItem>
        <span className="font-semibold text-foreground">{companyCount}</span>{" "}
        {companyCount === 1 ? "company" : "companies"}
      </MetadataItem>
      <span aria-hidden="true">&middot;</span>
      <MetadataItem>
        <span className="font-semibold text-foreground">{programCount}</span>{" "}
        {programCount === 1 ? "program" : "programs"}
      </MetadataItem>
      <span aria-hidden="true">&middot;</span>
      <MetadataItem>
        <span className="font-semibold text-foreground">
          {clinicalPhaseCount}
        </span>{" "}
        clinical-phase
      </MetadataItem>
      {lastUpdated ? (
        <>
          <span aria-hidden="true">&middot;</span>
          <MetadataItem>latest verified {lastUpdated}</MetadataItem>
        </>
      ) : null}
    </div>
  );
}
