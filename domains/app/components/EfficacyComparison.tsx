import Link from "next/link";
import { CollapsibleSection } from "@/domains/app/components/CollapsibleSection";
import { EfficacyCompareLauncher } from "@/domains/app/components/EfficacyCompareLauncher";
import { PageHeading } from "@/domains/app/components/ui/PageHeading";
import { EmptyState } from "@/domains/app/components/EmptyState";
import { EfficacySelectionDetails } from "@/domains/app/components/EfficacySelectionDetails";
import { formatNullableValue } from "@/domains/app/lib/format";
import type {
  EfficacyComparisonRow,
  EfficacyComparisonView,
} from "@/domains/app/lib/efficacy-comparison/read-model";
import type {
  ComparisonEntity,
  HeadToHeadGroup,
} from "@/domains/app/lib/efficacy-comparison/head-to-head";
import { getEfficacyPhaseTier } from "@/domains/app/lib/efficacy-comparison/policy";

type EfficacyComparisonProps = {
  view: EfficacyComparisonView;
  /**
   * Deep-link seed from `?unit=`, already validated by the page against
   * `view.families[].rows` (never `view.gaps`) - see
   * `app/efficacy-comparison/page.tsx`. Threaded straight through to the
   * launcher; this component adds no selection logic of its own.
   */
  initialSelectedUnitKey?: string;
  /** Deep-link seed from `?open=1` - opens the picker with that unit pre-checked. */
  initialOpen?: boolean;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Phase-tier badge color, keyed on the same tier `selectRepresentative` ranks
 * candidates by (`policy.ts`) — not on the raw phase text, so "Phase 3" and
 * "Phase 3b" read as the same color. Fixed hue per tier, never cycled; validated
 * for CVD separation against the card surface (`dataviz` skill, light mode).
 * An unrecognised phase (no tier) falls back to the neutral border/text used
 * elsewhere on the page rather than guessing a color.
 *
 * Tier 1's text color is amber-800 (`#92400E`), not the lighter amber-700
 * (`#B45309`) still used for its border/fill: measured against the badge's
 * own composited background, amber-700 text scored 4.22:1 (fails WCAG AA's
 * 4.5:1 for this 10px text); amber-800 scores 5.95:1.
 */
const phaseTierBadgeClass: Record<number, string> = {
  1: "border-[#B45309]/40 bg-[#B45309]/10 text-[#92400E]",
  2: "border-[#0369A1]/40 bg-[#0369A1]/10 text-[#0369A1]",
  3: "border-[#6D28D9]/40 bg-[#6D28D9]/10 text-[#6D28D9]",
  4: "border-[#047857]/40 bg-[#047857]/10 text-[#047857]",
};
const neutralPhaseBadgeClass = "border-border text-muted-foreground";

function phaseTierColorClass(phase: string): string {
  const tier = getEfficacyPhaseTier(phase);
  return tier ? phaseTierBadgeClass[tier] : neutralPhaseBadgeClass;
}

/** Full class list for a phase badge — kept in one place so both card kinds match. */
function phaseBadgeClass(phase: string): string {
  return `rounded-full border px-1.5 py-px text-[10px] font-medium leading-none ${phaseTierColorClass(phase)}`;
}

/**
 * Compact form of a mechanism-family label for the jump-nav chips, where the full
 * pharmacology name ("GLP-1 / GIP receptor agonist") is too long. Deterministic
 * string compression, not a second authored label; the full label still heads each
 * section and rides on the chip's `title`.
 *
 * Two passes. First, spelled-out receptor names collapse to their conventional
 * short codes — the way GLP-1 and GIP already read in the source label, so glucagon
 * and amylin match (GCG, AMY, CT), and multi-word receptors get their standard code
 * (activin type II → ActRII). Then the action suffix compresses: "receptor agonist"
 * → "RA" (giving GCGRA, AMYRA in parallel with GLP-1RA), antagonist/blockade and
 * "plus" likewise. Antagonist stays spelled so it never collapses into an agonist
 * chip (GLP-1 agonist / GIP antagonist must not read as a GLP-1/GIP dual agonist).
 */
function shortFamilyLabel(label: string): string {
  return label
    .replace(/activin type II receptor/gi, "ActRII")
    .replace(/glucagon/gi, "GCG")
    .replace(/amylin/gi, "AMY")
    .replace(/calcitonin/gi, "CT")
    .replace(/ receptor agonist/g, "RA")
    .replace(/ receptor antagonist/g, "R antag")
    .replace(/ receptor blockade/g, "R block")
    .replace(/ receptor/g, "R")
    .replace(/ plus /g, " + ");
}

/**
 * Splits a trailing parenthetical off a stored value string ("-9.1 (SE 0.8)" →
 * main "-9.1", annotation "(SE 0.8)"). Display-only: the stored string is never
 * rewritten, this only decides which part renders as the bold headline figure
 * and which renders as a smaller, muted qualifier alongside it. Some sources
 * report a precision figure (standard error) inline with no dedicated field
 * for it in the Clinical Evidence contract, so it rides in `value` itself —
 * without this split, rows with and without a source-reported qualifier read
 * at inconsistent visual weight for no clinical reason.
 */
function splitTrailingAnnotation(value: string): { main: string; annotation: string | null } {
  const match = value.match(/^(.*?)\s*(\([^()]*\))\s*$/);
  if (!match) {
    return { main: value, annotation: null };
  }
  return { main: match[1], annotation: match[2] };
}

/**
 * A stored figure with its unit. The page's shared metric is percent change from
 * baseline, so its unit reads as a "%" glyph fused to the number ("−15.0%") rather
 * than the spelled word repeated down a dose list. Any other unit — a between-arm
 * effect measure in percentage points, kg, etc. — stays spelled out and muted, so a
 * different measure never hides behind the same glyph.
 *
 * The glyph is appended only when the stored value does not already carry one: the
 * dataset records some percent values verbatim with a trailing "%" and others as a
 * bare number, and doubling it up would print "−2.5%%". The value itself is never
 * rewritten — a "%" already in the source is left exactly as stored.
 */
function ValueNumber({ value, unit }: { value: string; unit: string }) {
  const { main, annotation } = splitTrailingAnnotation(value);
  if (unit === "percent") {
    return (
      <>
        <span className="font-semibold tabular-nums text-foreground">
          {main.includes("%") ? main : `${main}%`}
        </span>
        {annotation ? (
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
            {annotation}
          </span>
        ) : null}
      </>
    );
  }
  return (
    <>
      <span className="font-semibold tabular-nums text-foreground">{main}</span>{" "}
      <span className="text-muted-foreground">{unit}</span>
      {annotation ? (
        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
          {annotation}
        </span>
      ) : null}
    </>
  );
}

/**
 * A stored arm's `dose`, shown only when it adds information `label` doesn't
 * already carry — a titration arm may be labelled "Semaglutide maximum
 * tolerated dose" with the actual range only in `dose`, while an ordinary
 * dose-named arm ("Elecoglipron 5 mg") already contains it. A plain substring
 * check, not a data judgment: it never hides a dose that isn't textually
 * present in the label already shown beside it.
 */
function DoseCaption({ label, dose }: { label: string; dose?: string }) {
  if (!dose || label.toLowerCase().includes(dose.toLowerCase())) {
    return null;
  }
  return <span className="block text-[11px] text-muted-foreground">{dose}</span>;
}

function ValueList({
  values,
}: {
  values: { value: string; unit: string; label: string; dose?: string; outcomeId: string }[];
}) {
  return (
    <ul className="space-y-1.5 text-sm">
      {values.map((value) => (
        <li key={value.outcomeId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <span className="text-xs leading-5 text-muted-foreground">
              {value.label}
              <DoseCaption label={value.label} dose={value.dose} />
          </span>
          <span className="text-right leading-5">
            <ValueNumber value={value.value} unit={value.unit} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A single head-to-head entity. A registry-resolved entity links to its Asset Detail
 * route; an unresolved external comparator is deliberately not a link — there is no
 * page to point it at — and is flagged so its status is not mistaken for a missing
 * link. A resolved regimen has no detail route today and renders as plain text.
 */
function HeadToHeadEntity({ entity }: { entity: ComparisonEntity }) {
  if (entity.companyId && entity.assetId) {
    return (
      <Link
        href={`/assets/${entity.companyId}/${entity.assetId}`}
        className={`rounded-sm hover:text-primary hover:underline ${focusRing}`}
      >
        {entity.label}
      </Link>
    );
  }
  if (entity.unresolved) {
    return (
      <span>
        {entity.label}
        <span className="ml-1 rounded-full border border-border bg-muted px-1.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
          external
        </span>
      </span>
    );
  }
  return <span>{entity.label}</span>;
}

/**
 * One study's direct comparison, as a single card. Kept structurally separate from a
 * cross-trial row: this is a within-trial comparison the source actually reported,
 * not rows placed side by side. Every entity the study compared is listed together —
 * a 3-arm study is one card, not three — and any stored between-arm estimate rides
 * alongside, attributed to the exact pair it compares. Study identity, like the
 * cross-trial rows, lives on the phase badge and the ⓘ disclosure, not a text footer.
 */
function HeadToHeadEntry({ group }: { group: HeadToHeadGroup }) {
  return (
    <tr className="border-t border-border/80 align-top first:border-t-0">
      <th scope="row" className="w-[24%] px-4 py-4 text-left font-normal">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-card-foreground">
            {group.entities.map((item, index) => (
              <span key={item.entity.key} className="inline-flex items-center gap-2">
                {index > 0 ? (
                  <span className="text-muted-foreground">/</span>
                ) : null}
                <HeadToHeadEntity entity={item.entity} />
              </span>
            ))}
            <span className={phaseBadgeClass(group.phase)}>{group.phase}</span>
          </span>
        <span className="mt-2 block text-xs font-normal leading-5 text-muted-foreground">
          {group.endpointName} &middot; {group.assessmentTimepoint}
        </span>
      </th>
      <td className="w-[18%] px-4 py-4 text-xs leading-5 text-muted-foreground">
        <span className="block text-foreground">{group.population}</span>
        <span className="block">{formatNullableValue(group.duration)}</span>
      </td>
      <td className="w-[28%] px-4 py-4">
      <ul className="space-y-1.5">
        {group.entities.map((item) => (
          <li
            key={item.entity.key}
            className="flex flex-wrap items-baseline gap-x-3 text-sm"
          >
            <span className="font-medium text-card-foreground">
              <HeadToHeadEntity entity={item.entity} />
            </span>
            {item.values.length > 0 ? (
              item.values.map((value) => (
                <span key={value.outcomeId}>
                  <ValueNumber value={value.value} unit={value.unit} />
                </span>
              ))
            ) : (
              <span className="italic text-muted-foreground">
                no arm-level value on this axis
              </span>
            )}
          </li>
        ))}
      </ul>
      </td>
      <td className="w-[24%] px-4 py-4">
      {group.betweenArm.length > 0 ? (
          <ul className="space-y-1.5">
            {group.betweenArm.flatMap((pair) =>
              pair.values.map((value) => (
                <li key={value.outcomeId} className="text-sm">
                  <span className="text-xs text-muted-foreground">
                    {pair.left.label} &minus; {pair.right.label}:
                  </span>{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {value.value}
                  </span>{" "}
                  <span className="text-muted-foreground">{value.unit}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatNullableValue(value.comparisonType ?? value.effectMeasure)}
                    {value.confidenceInterval ? (
                      <> &middot; {value.confidenceInterval}</>
                    ) : null}
                  </span>
                </li>
              )),
            )}
          </ul>
      ) : (
        <span className="text-sm italic text-muted-foreground">Not reported</span>
      )}
      </td>
      <td className="w-14 px-3 py-4 text-right">
        <EfficacySelectionDetails
          facts={[
            { label: "Study", value: group.studyTitle, href: group.href },
            { label: "Endpoint", value: group.endpointName },
            { label: "Timepoint", value: group.assessmentTimepoint },
            { label: "Duration", value: formatNullableValue(group.duration) },
            { label: "Population", value: group.population },
          ]}
        />
      </td>
    </tr>
  );
}

function ComparisonRow({ row }: { row: EfficacyComparisonRow }) {
  const { evidence } = row;

  return (
    <tr className="border-t border-border/80 align-top first:border-t-0 hover:bg-muted/20">
      <th scope="row" className="w-[20%] px-4 py-4 text-left font-normal">
          <span className="block text-sm font-semibold leading-5 text-card-foreground">
            {row.href ? (
              <Link href={row.href} className={`rounded-sm hover:text-primary hover:underline ${focusRing}`}>
                {row.name}
              </Link>
            ) : (
              row.name
            )}
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {row.unitKind === "global-asset" ? "Selected evidence: " : null}
            <Link
              href={`/companies/${row.companyId}`}
              className={`rounded-sm hover:text-primary hover:underline ${focusRing}`}
            >
              {row.companyName}
            </Link>
            {row.mechanism ? <> &middot; {row.mechanism}</> : null}
          </span>
      </th>
      <td className="w-[16%] px-4 py-4">
        <span className={phaseBadgeClass(evidence.phase)}>{evidence.phase}</span>
        <span className="mt-2 block text-xs leading-5 text-foreground">
          {evidence.population}
        </span>
        <span className="block text-xs leading-5 text-muted-foreground">
          {evidence.assessmentTimepoint}
          {evidence.duration ? <> &middot; {evidence.duration}</> : null}
        </span>
      </td>
      <td className="w-[24%] px-4 py-4">
        <ValueList values={evidence.treatmentValues} />
      </td>
      <td className="w-[20%] px-4 py-4">
        {evidence.placeboValues.length > 0 ||
        evidence.activeComparatorValues.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                  {evidence.placeboValues.map((value) => (
                    <li key={value.outcomeId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                      <span>
                        <span className="font-medium text-card-foreground">Placebo</span>
                        <span className="block text-xs text-muted-foreground">
                          Placebo reference
                        </span>
                      </span>
                      <span className="text-right">
                        <ValueNumber value={value.value} unit={value.unit} />
                      </span>
                    </li>
                  ))}
                  {evidence.activeComparatorValues.map((value) => (
                    <li key={value.outcomeId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                      <span>
                        <span className="font-medium text-card-foreground">{value.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          Active comparator
                        </span>
                        <DoseCaption label={value.label} dose={value.dose} />
                      </span>
                      <span className="text-right">
                        <ValueNumber value={value.value} unit={value.unit} />
                      </span>
                    </li>
                  ))}
              </ul>
        ) : (
          <span className="text-sm italic text-muted-foreground">Not reported</span>
        )}
      </td>
      <td className="w-[15%] px-4 py-4">
        {evidence.storedBetweenArmValues.length > 0 ? (
              <ul className="space-y-1">
                {evidence.storedBetweenArmValues.map((value) => (
                  <li key={value.outcomeId} className="text-sm">
                    <ValueNumber value={value.value} unit={value.unit} />
                    <span className="block text-xs text-muted-foreground">
                      {formatNullableValue(value.comparisonType ?? value.effectMeasure)}
                      {value.confidenceInterval ? <> &middot; {value.confidenceInterval}</> : null}
                    </span>
                  </li>
                ))}
              </ul>
        ) : (
          <span className="text-sm italic text-muted-foreground">Not reported</span>
        )}
      </td>
      <td className="w-14 px-3 py-4 text-right">
        <EfficacySelectionDetails
          facts={[
            {
              label: "Study",
              value: evidence.studyTitle,
              href: `/studies/${evidence.studyId}`,
            },
            {
              label: "Evidence company",
              value: row.companyName,
              href: `/companies/${row.companyId}`,
            },
            ...(evidence.sponsorName
              ? [{ label: "Sponsor", value: evidence.sponsorName }]
              : []),
            { label: "Study region", value: evidence.studyRegion },
            ...(evidence.developmentScope
              ? [{ label: "Development scope", value: evidence.developmentScope }]
              : []),
            { label: "Endpoint", value: evidence.endpointName },
            { label: "Endpoint role", value: evidence.endpointRole },
            { label: "Timepoint", value: evidence.assessmentTimepoint },
            { label: "Duration", value: formatNullableValue(evidence.duration) },
            { label: "Population", value: evidence.population },
            { label: "Estimand", value: formatNullableValue(evidence.estimand) },
            { label: "Analysis population", value: evidence.analysisPopulation },
            { label: "Result type", value: "Arm-level, as reported" },
            { label: "Evidence maturity", value: evidence.groupMaturities.join(", ") },
          ]}
        />
      </td>
    </tr>
  );
}

/**
 * How this page selects its numbers (kept here, off the rendered surface, as the
 * standing rationale for the row/rationale logic below — not shown to users):
 *
 * - The application does not calculate, average, adjust, or convert any figure.
 *   Every number is a value a source reported, including any between-arm estimate,
 *   which is shown separately, in the source's own effect measure and unit, and
 *   only where the source published it.
 * - One study is selected per comparison unit by a fixed rule — trial phase,
 *   endpoint role, estimand, analysis population, source completeness, then
 *   evidence maturity — never by which result is largest.
 * - Rows share one arm-level metric: percent change from baseline in body weight,
 *   in adults enrolled without type 2 diabetes and starting treatment. A
 *   between-arm estimate appears under its own label, in the source's effect
 *   measure and unit — it is not this shared metric.
 * - These rows come from separate trials and are not a ranking. Populations,
 *   durations, and analyses differ, and no comparison between two rows is
 *   implied, including where a representative study used an active comparator.
 *   A trial that compared two products directly is reported in the Head-to-head
 *   section, not as a cross-trial row.
 */
export function EfficacyComparison({
  view,
  initialSelectedUnitKey,
  initialOpen,
}: EfficacyComparisonProps) {
  const rowCount = view.families.reduce(
    (total, group) => total + group.rows.length,
    0,
  );

  return (
    <div className="space-y-10 pb-12">
      <section className="pt-2">
        <PageHeading
          className="pt-0"
          title="Efficacy Comparison"
          description="Reported body-weight reduction by mechanism family, for assets and registered combination products with a recorded percent-change result."
        />
        {rowCount > 0 ? (
          <div className="mt-8 grid gap-5 rounded-md bg-accent px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-accent-foreground">
                Build a cross-program chart
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Select up to five programs. Dose and duration stay attached to every source-reported value.
              </p>
            </div>
            <div>
              <EfficacyCompareLauncher
                families={view.families}
                initialSelectedUnitKeys={
                  initialSelectedUnitKey ? [initialSelectedUnitKey] : undefined
                }
                initialOpen={initialOpen}
              />
            </div>
          </div>
        ) : null}
      </section>

      {rowCount > 0 ? (
        <nav
          aria-label="Jump to a mechanism family"
          className="flex gap-6 overflow-x-auto border-b border-border pb-0"
        >
          {view.families.map((group) => (
            <a
              key={group.family.id}
              href={`#family-${group.family.id}`}
              title={group.family.label}
              className={`shrink-0 border-b-2 border-transparent px-0 py-2.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-foreground ${focusRing}`}
            >
              {shortFamilyLabel(group.family.label)}
            </a>
          ))}
          <a
            href="#head-to-head"
            className={`shrink-0 border-b-2 border-transparent px-0 py-2.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-foreground ${focusRing}`}
          >
            Head-to-head
          </a>
        </nav>
      ) : null}

      {rowCount === 0 ? (
        <section className="rounded-md border border-border bg-card shadow-soft">
          <EmptyState
            title="No comparable results"
            description="No comparison unit currently has a recorded percent-change body-weight result in an eligible population."
          />
        </section>
      ) : (
        view.families.map((group) => (
          <CollapsibleSection
            key={group.family.id}
            id={`family-${group.family.id}`}
            title={group.family.label}
            subtitle={
              group.family.composition === "multi-component"
                ? "Multi-component product"
                : "Single molecule"
            }
            appearance="plain"
          >
            <div className="overflow-x-auto border-y border-border bg-card">
              <table className="w-full min-w-[1120px] border-collapse text-left">
                <thead className="bg-muted/70 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Program</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Evidence</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Reported dose values</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Same-group reference</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Between-arm</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <ComparisonRow key={row.unitKey} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        ))
      )}

      <section
        id="head-to-head"
        className="scroll-mt-20 rounded-md bg-accent px-5 py-6 sm:px-6"
      >
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold tracking-tight text-accent-foreground">
            Head-to-head
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Direct comparisons a single trial reported between two products. These are
            separate from the cross-trial rows above &mdash; the comparison is internal
            to one study, so a diabetic or maintenance population does not disqualify
            it.
          </p>
        </div>
        {view.headToHead.length === 0 ? (
          <EmptyState
            title="No direct comparisons"
            description="No trial with recorded body-weight evidence reported a direct comparison between two products."
          />
        ) : (
          <div className="mt-5 overflow-x-auto border-y border-border bg-card/80">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="bg-muted/70 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Direct comparison</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Evidence axis</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Arm-level values</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Between-arm</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {view.headToHead.map((group) => (
                  <HeadToHeadEntry
                    key={`${group.studyId}:${group.endpointName}`}
                    group={group}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
