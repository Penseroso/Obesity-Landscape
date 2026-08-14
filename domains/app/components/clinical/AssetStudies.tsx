"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/domains/app/components/EmptyState";
import { StudyTable } from "@/domains/app/components/clinical/StudyTable";
import { buttonVariants } from "@/domains/app/components/ui/Button";
import { PageHeading } from "@/domains/app/components/ui/PageHeading";
import type {
  AssetStudiesView,
  StudyFamilyGroupView,
} from "@/domains/app/lib/clinical-evidence/selectors";

type StudyScope = "focal" | "linked";

const ALL_FAMILIES = "all";
const UNCLASSIFIED_FAMILY = "__unclassified";

function familyKey(group: StudyFamilyGroupView) {
  return group.family ?? UNCLASSIFIED_FAMILY;
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
  const hasLinkedStudies = view.linkedStudies.length > 0;
  const [scope, setScope] = useState<StudyScope>("focal");
  const [selectedFamily, setSelectedFamily] = useState(ALL_FAMILIES);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const groups = scope === "focal" ? view.focalFamilyGroups : view.linkedFamilyGroups;
  const visibleGroups =
    selectedFamily === ALL_FAMILIES
      ? groups
      : groups.filter((group) => familyKey(group) === selectedFamily);

  useEffect(() => {
    const readUrlState = () => {
      const url = new URL(window.location.href);
      const requestedScope = url.searchParams.get("scope");
      const nextScope: StudyScope =
        requestedScope === "linked" && hasLinkedStudies ? "linked" : "focal";
      const nextGroups =
        nextScope === "focal" ? view.focalFamilyGroups : view.linkedFamilyGroups;
      const requestedFamily = url.searchParams.get("family") ?? ALL_FAMILIES;
      const nextFamily = nextGroups.some(
        (group) => familyKey(group) === requestedFamily,
      )
        ? requestedFamily
        : ALL_FAMILIES;

      setScope(nextScope);
      setSelectedFamily(nextFamily);

      const shouldCanonicalize =
        requestedScope === "focal" ||
        (requestedScope !== null && requestedScope !== nextScope) ||
        (url.searchParams.has("family") && nextFamily === ALL_FAMILIES);
      if (shouldCanonicalize) {
        if (nextScope === "focal") url.searchParams.delete("scope");
        else url.searchParams.set("scope", nextScope);
        if (nextFamily === ALL_FAMILIES) url.searchParams.delete("family");
        window.history.replaceState(null, "", url);
      }
    };

    readUrlState();
    window.addEventListener("popstate", readUrlState);
    return () => window.removeEventListener("popstate", readUrlState);
  }, [hasLinkedStudies, view.focalFamilyGroups, view.linkedFamilyGroups]);

  const updateUrlState = (nextScope: StudyScope, nextFamily: string) => {
    const url = new URL(window.location.href);
    if (nextScope === "focal") url.searchParams.delete("scope");
    else url.searchParams.set("scope", nextScope);
    if (nextFamily === ALL_FAMILIES) url.searchParams.delete("family");
    else url.searchParams.set("family", nextFamily);
    window.history.pushState(null, "", url);
    setScope(nextScope);
    setSelectedFamily(nextFamily);
  };

  const selectScope = (nextScope: StudyScope) => {
    if (nextScope === "linked" && !hasLinkedStudies) return;
    const nextGroups =
      nextScope === "focal" ? view.focalFamilyGroups : view.linkedFamilyGroups;
    const nextFamily = nextGroups.some(
      (group) => familyKey(group) === selectedFamily,
    )
      ? selectedFamily
      : ALL_FAMILIES;
    updateUrlState(nextScope, nextFamily);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const enabledIndexes = hasLinkedStudies ? [0, 1] : [0];
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") {
      nextIndex = enabledIndexes[(enabledIndexes.indexOf(index) + 1) % enabledIndexes.length];
    } else if (event.key === "ArrowLeft") {
      const position = enabledIndexes.indexOf(index);
      nextIndex = enabledIndexes[(position - 1 + enabledIndexes.length) % enabledIndexes.length];
    } else if (event.key === "Home") {
      nextIndex = enabledIndexes[0];
    } else if (event.key === "End") {
      nextIndex = enabledIndexes.at(-1);
    }
    if (nextIndex === undefined) return;
    event.preventDefault();
    tabRefs.current[nextIndex]?.focus();
    selectScope(nextIndex === 0 ? "focal" : "linked");
  };

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
        <section aria-label="Asset studies" className="space-y-5">
          <div className="flex flex-col gap-4 border-b border-border sm:flex-row sm:items-end sm:justify-between">
            <div role="tablist" aria-label="Study relationship" className="flex gap-6">
              {([
                ["focal", "Focal studies", view.focalStudies.length],
                ["linked", "Linked studies", view.linkedStudies.length],
              ] as const).map(([tabScope, label, count], index) => {
                const active = scope === tabScope;
                const disabled = tabScope === "linked" && !hasLinkedStudies;
                return (
                  <button
                    key={tabScope}
                    ref={(node) => { tabRefs.current[index] = node; }}
                    id={`asset-studies-tab-${tabScope}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="asset-studies-panel"
                    disabled={disabled}
                    tabIndex={active ? 0 : -1}
                    onClick={() => selectScope(tabScope)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`border-b-2 px-0 pb-3 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {label}
                    <span className="ml-2 text-sm font-normal tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-3 pb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Study family
              <select
                value={selectedFamily}
                onChange={(event) => updateUrlState(scope, event.target.value)}
                className="h-9 min-w-44 rounded-md border border-border bg-card px-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <option value={ALL_FAMILIES}>All families</option>
                {groups.map((group) => (
                  <option key={familyKey(group)} value={familyKey(group)}>
                    {group.family ?? "Other studies"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            id="asset-studies-panel"
            role="tabpanel"
            aria-labelledby={`asset-studies-tab-${scope}`}
          >
            <FamilyGroups groups={visibleGroups} />
          </div>
        </section>
      ) : (
        <EmptyState
          title="No clinical studies recorded for this asset yet."
          description="Studies will appear here once clinical-evidence source records are added for this asset."
        />
      )}
    </div>
  );
}
