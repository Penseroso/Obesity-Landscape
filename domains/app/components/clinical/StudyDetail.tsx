import Link from "next/link";
import { SourceList } from "@/domains/app/components/SourceList";
import { EndpointsSection } from "@/domains/app/components/clinical/EndpointsSection";
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
    <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{formatNullableValue(value)}</dd>
    </div>
  );
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

/**
 * Sticky-left cell shared by the Arm and Intervention columns, which stay
 * visible while the rest of the Arms table scrolls horizontally. Background
 * must be fully opaque (not the header's translucent `bg-muted/70`) so
 * content scrolling underneath the pinned columns cannot bleed through.
 */
const stickyArmCellPosition =
  "sticky left-0 z-10 w-48 min-w-[12rem] max-w-[12rem] px-3 py-2.5 align-middle";
const stickyInterventionCellPosition =
  "sticky left-48 z-10 min-w-[9rem] border-r border-border px-3 py-2.5 align-middle";

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
      <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
        <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className={`${stickyArmCellPosition} bg-muted font-semibold`}>
              Arm
            </th>
            <th
              className={`${stickyInterventionCellPosition} bg-muted font-semibold`}
            >
              Intervention
            </th>
            <th className="px-3 py-2.5 font-semibold">Role</th>
            <th className="px-3 py-2.5 font-semibold">Dose</th>
            {showTitration ? (
              <th className="px-3 py-2.5 font-semibold">Titration</th>
            ) : null}
            <th className="px-3 py-2.5 font-semibold">Route</th>
            <th className="px-3 py-2.5 font-semibold">Frequency</th>
            <th className="px-3 py-2.5 font-semibold">Duration</th>
            {showPlannedN ? (
              <th className="px-3 py-2.5 font-semibold">Planned N</th>
            ) : null}
            {showAnalyzedN ? (
              <th className="px-3 py-2.5 font-semibold">Analyzed N</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {arms.map((arm) => (
            <tr key={arm.id} className="bg-card text-muted-foreground">
              <td
                className={`${stickyArmCellPosition} bg-card font-medium text-foreground`}
              >
                {arm.label}
              </td>
              <td className={`${stickyInterventionCellPosition} bg-card`}>
                <ArmInterventionCell arm={arm} />
              </td>
              <td className="px-3 py-2.5">{arm.role}</td>
              <td className="px-3 py-2.5">{formatNullableValue(arm.dose)}</td>
              {showTitration ? (
                <td className="px-3 py-2.5">
                  {formatNullableValue(arm.titration)}
                </td>
              ) : null}
              <td className="px-3 py-2.5">{formatNullableValue(arm.route)}</td>
              <td className="px-3 py-2.5">
                {formatNullableValue(arm.dosingFrequency)}
              </td>
              <td className="px-3 py-2.5">
                {formatNullableValue(arm.treatmentDuration)}
              </td>
              {showPlannedN ? (
                <td className="px-3 py-2.5 tabular-nums">
                  {formatCount(arm.plannedN)}
                </td>
              ) : null}
              {showAnalyzedN ? (
                <td className="px-3 py-2.5 tabular-nums">
                  {formatCount(arm.analyzedN)}
                </td>
              ) : null}
            </tr>
          ))}
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
        <span className="whitespace-nowrap rounded-sm border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
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
        <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>
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
      <section>
        <Link
          href={`/assets/${asset.companyId}/${asset.assetId}`}
          className="text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ← {asset.assetName}
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {study.acronym?.trim() || study.officialTitle}
        </h1>
        {study.acronym ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {study.officialTitle}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-sm border border-border bg-accent px-2.5 py-1 font-semibold text-accent-foreground">
            {study.phase}
          </span>
          <span className="rounded-sm border border-border bg-muted px-2.5 py-1 font-semibold text-muted-foreground">
            {study.registryStatus.sourceStatus}
          </span>
        </div>
      </section>

      <StudySectionNav hasAnalysisGroups={analysisGroups.length > 0} />

      <section id="overview" className="scroll-mt-20">
        <dl>
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
          <MetaRow label="Randomization" value={study.design.randomization} />
          <MetaRow label="Masking" value={study.design.masking} />
          <MetaRow label="Comparator" value={study.design.comparator} />
          <MetaRow label="Design" value={study.design.description} />
          <MetaRow label="Overall duration" value={study.overallDuration} />
          <MetaRow label="Follow-up" value={study.followUpDuration} />
          <MetaRow label="Safety summary" value={study.safetySummary} />
        </dl>
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
            This study is also surfaced as a comparator / head-to-head study for:
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
