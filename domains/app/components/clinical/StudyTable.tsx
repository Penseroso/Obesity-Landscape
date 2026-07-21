import Link from "next/link";
import { formatNullableValue } from "@/domains/app/lib/format";
import type {
  PrimaryFindingGroupView,
  PrimaryFindingView,
  StudySummaryView,
  StudyTreatmentView,
} from "@/domains/app/lib/clinical-evidence/selectors";

/** Roles that need no annotation: the value already is the study's primary result. */
const implicitPrimaryRoles = new Set(["primary", "co-primary"]);

/**
 * Comparison groups shown per row before the cell collapses the remainder. This is a
 * presentation policy of this list screen alone — the read model returns every group,
 * and neither the Clinical Evidence contract nor the validator knows this number.
 */
const PRIMARY_FINDING_GROUP_DISPLAY_LIMIT = 3;

function StudyMapping({ study }: { study: StudySummaryView }) {
  if (study.programContext) {
    const { route, dosageForm, dosingInterval } = study.programContext;
    return (
      <span className="mt-1 block text-xs text-muted-foreground">
        {route} · {dosageForm}
        {dosingInterval ? ` · ${dosingInterval}` : ""}
      </span>
    );
  }
  if (study.regimenContext) {
    return (
      <span className="mt-1 block text-xs text-muted-foreground">
        Regimen: {study.regimenContext.name}
      </span>
    );
  }
  return null;
}

function Treatment({ treatment }: { treatment: StudyTreatmentView }) {
  return (
    <>
      <span className="block text-foreground">
        {treatment.experimentalArms.join(" / ")}
        {treatment.hiddenArmCount > 0 ? (
          <span className="text-muted-foreground">
            {" "}
            +{treatment.hiddenArmCount} more
          </span>
        ) : null}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">
        vs {treatment.comparator}
      </span>
    </>
  );
}

function FindingGroup({ group }: { group: PrimaryFindingGroupView }) {
  return (
    <div className="mt-2 first:mt-1">
      {group.values.map((value, index) => (
        <span
          key={`${value.label}-${value.value}-${index}`}
          className="block text-foreground"
        >
          <span className="font-semibold tabular-nums">
            {value.value} {value.unit}
          </span>
          {value.label ? (
            <span className="text-muted-foreground"> · {value.label}</span>
          ) : null}
        </span>
      ))}
      {group.comparatorLabel ? (
        <span className="block text-xs text-muted-foreground">
          vs {group.comparatorLabel}
          {group.effectMeasure ? ` · ${group.effectMeasure}` : ""}
        </span>
      ) : null}
      {/* Which analysis these values come from: a Study may report the same endpoint
          under several estimands, populations, or cohorts, and none is stored as the
          primary one. */}
      <span className="block text-xs text-muted-foreground">
        {group.estimand
          ? `${group.estimand} · ${group.analysisPopulation}`
          : group.analysisPopulation}
      </span>
    </div>
  );
}

function PrimaryFinding({ finding }: { finding: PrimaryFindingView | null }) {
  if (!finding) {
    // Outcome existence is the only authority here: this says nothing about whether
    // a result has been publicly disclosed.
    return <em className="italic text-muted-foreground">Not reported</em>;
  }

  const shown = finding.groups.slice(0, PRIMARY_FINDING_GROUP_DISPLAY_LIMIT);
  const hiddenGroupCount = finding.groups.length - shown.length;

  return (
    <>
      <span className="block text-xs text-muted-foreground">
        {finding.endpointName} · {finding.assessmentTimepoint}
        {implicitPrimaryRoles.has(finding.endpointRole)
          ? ""
          : ` (${finding.endpointRole})`}
      </span>
      {shown.map((group, index) => (
        <FindingGroup
          key={`${group.estimand ?? ""}-${group.analysisPopulation}-${index}`}
          group={group}
        />
      ))}
      {hiddenGroupCount > 0 ? (
        <span className="mt-1 block text-xs text-muted-foreground">
          +{hiddenGroupCount} {hiddenGroupCount === 1 ? "group" : "groups"}
        </span>
      ) : null}
    </>
  );
}

export function StudyTable({ studies }: { studies: StudySummaryView[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card shadow-soft">
      {/*
        Fixed layout, not auto: a Study with no acronym falls back to its full official
        title, and under auto layout that one cell would take the width from every other
        column — ASC30's Phase 1 title is ~200 characters. Fixed widths let long text
        wrap inside its own cell instead, and give Primary finding, the column the reader
        is actually here for, the largest share.
      */}
      <table className="w-full min-w-[1024px] table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[19%]" />
          <col className="w-[7%]" />
          <col className="w-[17%]" />
          <col className="w-[14%]" />
          <col className="w-[9%]" />
          <col className="w-[34%]" />
        </colgroup>
        <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-semibold">Study</th>
            <th className="px-4 py-2 font-semibold">Phase</th>
            <th className="px-4 py-2 font-semibold">Population</th>
            <th className="px-4 py-2 font-semibold">Treatment</th>
            <th className="px-4 py-2 font-semibold">Duration</th>
            <th className="px-4 py-2 font-semibold">Primary finding</th>
          </tr>
        </thead>
        {/* Fixed widths mean a long unbroken token (a slash-joined titration schedule,
            say) would otherwise overflow its column rather than wrap. */}
        <tbody className="divide-y divide-border align-top [&_td]:break-words">
          {studies.map((study) => (
            <tr key={study.id}>
              <td className="px-4 py-3">
                <Link
                  href={`/studies/${study.id}`}
                  className="font-semibold text-card-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  title={study.officialTitle}
                >
                  {/* An unacronymed study shows its official title here, so clamp it:
                      the full text stays available through the title attribute. */}
                  <span className="line-clamp-3">{study.title}</span>
                </Link>
                <StudyMapping study={study} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">{study.phase}</td>
              <td className="px-4 py-3 text-muted-foreground" title={study.population}>
                <span className="line-clamp-3">{study.population}</span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <Treatment treatment={study.treatment} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatNullableValue(study.duration)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <PrimaryFinding finding={study.primaryFinding} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
