import Link from "next/link";
import { SourceList } from "@/domains/app/components/SourceList";
import { EndpointsSection } from "@/domains/app/components/clinical/EndpointsSection";
import { PageHeading } from "@/domains/app/components/ui/PageHeading";
import { formatNullableValue } from "@/domains/app/lib/format";
import type {
  AnalysisGroupView,
  ArmView,
  StudyDetailView,
} from "@/domains/app/lib/clinical-evidence/selectors";

function formatCount(count?: number): string {
  return typeof count === "number" ? count.toLocaleString() : "N/A";
}

function MetaRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{formatNullableValue(value)}</dd>
    </div>
  );
}

function MetaGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <h3 className="border-b border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-foreground">
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  );
}

/**
 * Splits a trailing "(...)" off an Arm label so the Arm column can wrap it to
 * its own line instead of forcing the column wider. Only a parenthetical at
 * the very end qualifies — text is never rearranged or reworded, just given a
 * line break at a boundary the label already marks with punctuation.
 */
function splitTrailingParenthetical(label: string): {
  main: string;
  detail?: string;
} {
  const match = label.match(/^(.*?)\s*(\([^()]*\))$/);
  return match ? { main: match[1], detail: match[2] } : { main: label };
}

/**
 * Presentation-only: when the Titration column already states the starting
 * dose and escalation schedule, the Dose column's own "target dose" suffix
 * repeats that context redundantly. Trimmed here for display only — the
 * stored value is untouched and every other consumer of `arm.dose` still
 * renders the source text verbatim.
 */
function doseCellValue(arm: ArmView): string | undefined {
  if (!arm.dose || !arm.titration) return arm.dose;
  return arm.dose.replace(/\s*target dose\s*$/i, "");
}

function ArmInterventionCell({ arm }: { arm: ArmView }) {
  if (arm.linkedAssetRef) {
    return (
      <Link
        href={`/assets/${arm.linkedAssetRef.companyId}/${arm.linkedAssetRef.assetId}`}
        className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {arm.linkedAssetName ?? arm.intervention}
      </Link>
    );
  }
  return <span>{formatNullableValue(arm.intervention)}</span>;
}

function ArmsTable({ arms }: { arms: ArmView[] }) {
  if (arms.length === 0) {
    return <p className="text-sm text-muted-foreground">No arms recorded.</p>;
  }

  // Inventory Studies may omit dosing details until registry/source reporting
  // supports them; keep stable columns and render missing values as N/A.
  const showTitration = arms.some((arm) => Boolean(arm.titration));
  const showPlannedN = arms.some((arm) => typeof arm.plannedN === "number");
  const showAnalyzedN = arms.some((arm) => typeof arm.analyzedN === "number");

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card shadow-soft">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Arm</th>
            <th className="px-3 py-2.5 font-semibold">Intervention</th>
            <th className="w-px whitespace-nowrap px-3 py-2.5 font-semibold">
              Role
            </th>
            <th className="w-px whitespace-nowrap px-3 py-2.5 font-semibold">
              Dose
            </th>
            {showTitration ? (
              <th className="px-3 py-2.5 font-semibold">Titration</th>
            ) : null}
            <th className="w-px whitespace-nowrap px-3 py-2.5 font-semibold">
              Route
            </th>
            <th className="w-px whitespace-nowrap px-3 py-2.5 font-semibold">
              Frequency
            </th>
            <th className="w-px whitespace-nowrap px-3 py-2.5 font-semibold">
              Duration
            </th>
            {showPlannedN ? (
              <th className="w-px whitespace-nowrap px-3 py-2.5 font-semibold">
                Planned N
              </th>
            ) : null}
            {showAnalyzedN ? (
              <th className="w-px whitespace-nowrap px-3 py-2.5 font-semibold">
                Analyzed N
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {arms.map((arm) => {
            const { main: armLabelMain, detail: armLabelDetail } =
              splitTrailingParenthetical(arm.label);
            return (
              <tr key={arm.id} className="bg-card text-muted-foreground">
                <td className="px-3 py-2.5 align-middle font-medium text-foreground">
                  <span className="block">{armLabelMain}</span>
                  {armLabelDetail ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {armLabelDetail}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <ArmInterventionCell arm={arm} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">{arm.role}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {formatNullableValue(doseCellValue(arm))}
                </td>
                {showTitration ? (
                  <td className="px-3 py-2.5">
                    {formatNullableValue(arm.titration)}
                  </td>
                ) : null}
                <td className="whitespace-nowrap px-3 py-2.5">
                  {formatNullableValue(arm.route)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {formatNullableValue(arm.dosingFrequency)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {formatNullableValue(arm.treatmentDuration)}
                </td>
                {showPlannedN ? (
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {formatCount(arm.plannedN)}
                  </td>
                ) : null}
                {showAnalyzedN ? (
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {formatCount(arm.analyzedN)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AnalysisGroupCard({ group }: { group: AnalysisGroupView }) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-card-foreground">
          {group.label}
        </h3>
        <span className="whitespace-nowrap rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
          {group.kind}
        </span>
      </div>
      {group.memberArmLabels.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Member arms:</span>{" "}
          {group.memberArmLabels.join(", ")}
        </p>
      ) : null}
      {group.description ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {group.description}
        </p>
      ) : null}
      {typeof group.analyzedN === "number" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Analyzed N:</span>{" "}
          <span className="tabular-nums">{formatCount(group.analyzedN)}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Sticky in-page section nav. Server-only (plain anchor links): no scroll-spy,
 * so it needs no client boundary and stays fully keyboard/no-JS accessible.
 * Only sections actually present are listed — Analysis groups is omitted when
 * the study has none. `scroll-mt-*` on each target offsets the sticky bar.
 */
function StudySectionNav({
  hasAnalysisGroups,
}: {
  hasAnalysisGroups: boolean;
}) {
  const sections = [
    { id: "overview", label: "Overview" },
    { id: "arms", label: "Arms" },
    ...(hasAnalysisGroups
      ? [{ id: "analysis-groups", label: "Analysis groups" }]
      : []),
    { id: "endpoints", label: "Endpoints" },
    { id: "sources", label: "Sources" },
  ];

  return (
    <nav
      aria-label="Study sections"
      className="sticky top-0 z-20 -mx-5 overflow-x-auto border-b border-border bg-background px-5 py-2 sm:-mx-8 sm:px-8"
    >
      <ul className="flex gap-1 text-sm">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="inline-flex whitespace-nowrap rounded-md px-3 py-1.5 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function StudyDetail({ detail }: { detail: StudyDetailView }) {
  const {
    study,
    asset,
    arms,
    analysisGroups,
    endpointGroups,
    linkedFromAssets,
  } = detail;

  return (
    <div className="space-y-6 pb-10">
      <section className="pt-2">
        <Link
          href={`/assets/${asset.companyId}/${asset.assetId}`}
          className="text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ← {asset.assetName}
        </Link>
        <PageHeading
          className="pt-3"
          title={study.acronym?.trim() || study.officialTitle}
          description={study.acronym ? study.officialTitle : undefined}
        >
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-border bg-accent px-2.5 py-1 font-semibold text-accent-foreground">
              {study.phase}
            </span>
            <span className="rounded-full border border-border bg-muted px-2.5 py-1 font-semibold text-muted-foreground">
              {study.registryStatus.sourceStatus}
            </span>
          </div>
        </PageHeading>
      </section>

      <StudySectionNav hasAnalysisGroups={analysisGroups.length > 0} />

      <section id="overview" className="space-y-3 scroll-mt-20">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Overview
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <MetaGroup title="Registry & population">
          <MetaRow
            label="Registry ID"
            value={study.registryIdentifiers
              .map((registry) => registry.id)
              .join(" / ")}
          />
          <MetaRow
            label="Registry status updated"
            value={study.registryStatus.statusUpdatedAt}
          />
          <MetaRow label="Population" value={study.population} />
          </MetaGroup>
          <MetaGroup title="Design">
          <MetaRow label="Randomization" value={study.design.randomization} />
          <MetaRow label="Masking" value={study.design.masking} />
          <MetaRow label="Comparator" value={study.design.comparator} />
          <MetaRow label="Design" value={study.design.description} />
          </MetaGroup>
          <MetaGroup title="Duration & safety">
          <MetaRow label="Overall duration" value={study.overallDuration} />
          <MetaRow label="Follow-up" value={study.followUpDuration} />
          <MetaRow label="Safety summary" value={study.safetySummary} />
          </MetaGroup>
        </div>
      </section>

      <section id="arms" className="space-y-3 scroll-mt-20">
        <h2 className="text-base font-semibold text-foreground">Arms</h2>
        <ArmsTable arms={arms} />
      </section>

      {analysisGroups.length > 0 ? (
        <section id="analysis-groups" className="space-y-3 scroll-mt-20">
          <h2 className="text-base font-semibold text-foreground">
            Analysis groups
          </h2>
          <p className="text-sm text-muted-foreground">
            Source-reported analysis units that are not protocol-defined arms.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {analysisGroups.map((group) => (
              <AnalysisGroupCard key={group.id} group={group} />
            ))}
          </div>
        </section>
      ) : null}

      <section id="endpoints" className="space-y-3 scroll-mt-20">
        <h2 className="text-base font-semibold text-foreground">
          Endpoints &amp; outcomes
        </h2>
        <EndpointsSection endpointGroups={endpointGroups} />
      </section>

      <section id="sources" className="space-y-3 scroll-mt-20">
        <h2 className="text-base font-semibold text-foreground">Sources</h2>
        <div className="space-y-2 text-sm">
          <SourceList sources={study.metadata.sources} emptyLabel="N/A" />
        </div>
      </section>

      {linkedFromAssets.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Linked from assets
          </h2>
          <p className="text-sm text-muted-foreground">
            This study is also surfaced as a comparator / head-to-head study
            for:
          </p>
          <ul className="flex flex-wrap gap-2">
            {linkedFromAssets.map((linkedAsset) => (
              <li key={`${linkedAsset.companyId}/${linkedAsset.assetId}`}>
                <Link
                  href={`/assets/${linkedAsset.companyId}/${linkedAsset.assetId}`}
                  className="inline-flex rounded-sm border border-border bg-card px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-accent/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {linkedAsset.assetName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
