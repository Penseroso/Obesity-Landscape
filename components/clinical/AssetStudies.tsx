import { EmptyState } from "@/components/EmptyState";
import { StudySummaryCard } from "@/components/clinical/StudySummaryCard";
import type { AssetStudiesView } from "@/lib/clinical-evidence/selectors";

function StudySection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">
        {title}
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {count}
        </span>
      </h2>
      {children}
    </section>
  );
}

export function AssetStudies({ view }: { view: AssetStudiesView }) {
  const totalStudies = view.focalStudies.length + view.linkedStudies.length;
  const hasStudies = totalStudies > 0;

  return (
    <div className="space-y-6 pb-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Clinical evidence
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {view.assetName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {view.companyName ?? view.companyId}
          {hasStudies ? (
            <>
              {" · "}
              {totalStudies} {totalStudies === 1 ? "study" : "studies"}
            </>
          ) : null}
        </p>
      </section>

      {hasStudies ? (
        <>
          <StudySection title="Focal studies" count={view.focalStudies.length}>
            {view.focalStudies.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {view.focalStudies.map((study) => (
                  <StudySummaryCard key={study.id} study={study} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No studies are anchored to this asset.
              </p>
            )}
          </StudySection>

          {view.linkedStudies.length > 0 ? (
            <StudySection
              title="Also linked (comparator / head-to-head)"
              count={view.linkedStudies.length}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {view.linkedStudies.map((study) => (
                  <StudySummaryCard key={study.id} study={study} />
                ))}
              </div>
            </StudySection>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No clinical evidence recorded for this asset yet."
          description="Studies will appear here once clinical-evidence source records are added for this asset."
        />
      )}
    </div>
  );
}
