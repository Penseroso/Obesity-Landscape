import Link from "next/link";
import { EmptyState } from "@/domains/app/components/EmptyState";
import { StudyTable } from "@/domains/app/components/clinical/StudyTable";
import { buttonVariants } from "@/domains/app/components/ui/Button";
import { PageHeading } from "@/domains/app/components/ui/PageHeading";
import type {
  AssetStudiesView,
  StudyFamilyGroupView,
} from "@/domains/app/lib/clinical-evidence/selectors";

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
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {count}
        </span>
      </h2>
      {children}
    </section>
  );
}

/**
 * One table per study family. The family name lives in the group header only — it is
 * never repeated on the rows beneath it. An unfamilied Study is unclassified, not
 * unknown, so its group is labelled plainly and sorts last.
 */
function FamilyGroups({ groups }: { groups: StudyFamilyGroupView[] }) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section
          key={group.family ?? "__unclassified"}
          className="overflow-hidden rounded-md border border-border bg-card shadow-soft"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/20 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              {group.family ?? "Other studies"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {group.studies.length}{" "}
              {group.studies.length === 1 ? "study" : "studies"}
            </span>
          </div>
          <StudyTable studies={group.studies} embedded />
        </section>
      ))}
    </div>
  );
}

export function AssetStudies({
  view,
  compareUnitKey,
}: {
  view: AssetStudiesView;
  /** Efficacy Comparison unitKey, set only when this asset already has an eligible row. */
  compareUnitKey?: string;
}) {
  const totalStudies = view.focalStudies.length + view.linkedStudies.length;
  const hasStudies = totalStudies > 0;

  return (
    <div className="space-y-6 pb-10">
      <PageHeading
        title={view.assetName}
        meta={
          <>
            <Link
              href={`/companies/${view.companyId}`}
              className="rounded-sm hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {view.companyName ?? view.companyId}
            </Link>
            {hasStudies ? (
              <>
                {" · "}
                {totalStudies} {totalStudies === 1 ? "study" : "studies"}
              </>
            ) : null}
          </>
        }
        actions={compareUnitKey ? (
          <Link
            href={`/efficacy-comparison?unit=${encodeURIComponent(compareUnitKey)}&open=1`}
            className={buttonVariants({ variant: "outline" })}
          >
            Compare efficacy
          </Link>
        ) : null}
      />

      {hasStudies ? (
        <>
          <StudySection title="Focal studies" count={view.focalStudies.length}>
            {view.focalStudies.length > 0 ? (
              <FamilyGroups groups={view.focalFamilyGroups} />
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
              <FamilyGroups groups={view.linkedFamilyGroups} />
            </StudySection>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No clinical studies recorded for this asset yet."
          description="Studies will appear here once clinical-evidence source records are added for this asset."
        />
      )}
    </div>
  );
}
