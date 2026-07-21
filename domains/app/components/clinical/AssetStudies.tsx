import Link from "next/link";
import { EmptyState } from "@/domains/app/components/EmptyState";
import { StudyTable } from "@/domains/app/components/clinical/StudyTable";
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

/**
 * One table per study family. The family name lives in the group header only — it is
 * never repeated on the rows beneath it. An unfamilied Study is unclassified, not
 * unknown, so its group is labelled plainly and sorts last.
 */
function FamilyGroups({ groups }: { groups: StudyFamilyGroupView[] }) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.family ?? "__unclassified"} className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {group.family ?? "Other studies"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {group.studies.length}{" "}
              {group.studies.length === 1 ? "study" : "studies"}
            </span>
          </div>
          <StudyTable studies={group.studies} />
        </section>
      ))}
    </div>
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
        </p>
      </section>

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
