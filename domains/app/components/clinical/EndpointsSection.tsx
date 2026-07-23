"use client";

import { Fragment, useMemo, useState } from "react";
import { Badge, OutcomeResult } from "@/domains/app/components/clinical/OutcomeResult";
import type { EndpointGroupView } from "@/domains/app/lib/clinical-evidence/selectors";
import type { ClinicalEndpointRole } from "@/domains/clinical-evidence/lib/types";

type RoleFilter = "All" | "Primary" | "Secondary" | "Safety";

const ROLE_FILTERS: RoleFilter[] = ["All", "Primary", "Secondary", "Safety"];

/**
 * Display filter over an endpoint's own recorded role — membership only, never
 * a regrouping of endpoints or outcomes. Roles outside these buckets
 * (`exploratory`, `other`) surface only under "All"; nothing is reordered.
 */
const roleFilterMembership: Record<
  Exclude<RoleFilter, "All">,
  ReadonlySet<ClinicalEndpointRole>
> = {
  Primary: new Set<ClinicalEndpointRole>(["primary", "co-primary"]),
  Secondary: new Set<ClinicalEndpointRole>(["key-secondary", "secondary"]),
  Safety: new Set<ClinicalEndpointRole>(["safety"]),
};

function matchesRoleFilter(role: ClinicalEndpointRole, filter: RoleFilter) {
  return filter === "All" || roleFilterMembership[filter].has(role);
}

/** Endpoints expanded on first render: primary and co-primary only. */
function isDefaultExpanded(role: ClinicalEndpointRole) {
  return role === "primary" || role === "co-primary";
}

/** The single value shared by every outcome, or undefined when any differ. */
function commonValue<T>(
  outcomes: EndpointGroupView["outcomes"],
  select: (outcome: EndpointGroupView["outcomes"][number]) => T,
): T | undefined {
  if (outcomes.length === 0) return undefined;
  const first = select(outcomes[0]);
  return outcomes.every((outcome) => select(outcome) === first)
    ? first
    : undefined;
}

type OutcomeRow =
  | { kind: "outcome"; outcome: EndpointGroupView["outcomes"][number] }
  | {
      kind: "cluster";
      analysisPopulation: string;
      estimand: string;
      outcomes: EndpointGroupView["outcomes"];
    };

/**
 * Eligible to join a Population/Estimand cluster: a non-empty population and
 * estimand. Whether an outcome is arm-anchored or AnalysisGroup-anchored
 * (`groupLabel`) is a subject-identity question, answered per-row by
 * `OutcomeResult`'s subject line — it is orthogonal to the population/estimand
 * axis this cluster groups on, so AnalysisGroup outcomes cluster alongside
 * arm-level ones whenever they share that axis.
 */
function isClusterEligible(outcome: EndpointGroupView["outcomes"][number]) {
  const { analysisPopulation, estimand } = outcome.outcome;
  if (!analysisPopulation || analysisPopulation.trim().length === 0)
    return false;
  if (!estimand || estimand.trim().length === 0) return false;
  return true;
}

/** Exact-match cluster identity: population + estimand + result shape. */
function clusterKey(outcome: EndpointGroupView["outcomes"][number]): string {
  const { analysisPopulation, estimand, result } = outcome.outcome;
  return [analysisPopulation.trim(), estimand!.trim(), result.resultType].join(
    " ",
  );
}

/**
 * Groups outcomes sharing an exact Population/Estimand/result-shape key,
 * wherever they fall in the endpoint's outcome list — the generated outcome
 * order is curated source order grouped by study only, never by estimand, so
 * matching outcomes are not guaranteed to be adjacent and requiring adjacency
 * would leave endpoints under-grouped.
 *
 * This is a stable group-by, not a re-sort: it keys only on the two fields
 * the grouping is defined by (population, estimand), never on id, arm label,
 * dose, result value, or role. Members keep their original relative order
 * inside the cluster; a cluster surfaces at the position of its first
 * matching member; every other outcome keeps its original relative position.
 * A key matched by only one outcome renders as a plain row, not a cluster.
 */
function clusterOutcomes(
  outcomes: EndpointGroupView["outcomes"],
): OutcomeRow[] {
  const membersByKey = new Map<string, EndpointGroupView["outcomes"]>();
  for (const outcome of outcomes) {
    if (!isClusterEligible(outcome)) continue;
    const key = clusterKey(outcome);
    const members = membersByKey.get(key);
    if (members) {
      members.push(outcome);
    } else {
      membersByKey.set(key, [outcome]);
    }
  }

  const emittedKeys = new Set<string>();
  const rows: OutcomeRow[] = [];
  for (const outcome of outcomes) {
    if (!isClusterEligible(outcome)) {
      rows.push({ kind: "outcome", outcome });
      continue;
    }
    const key = clusterKey(outcome);
    const members = membersByKey.get(key)!;
    if (members.length < 2) {
      rows.push({ kind: "outcome", outcome });
      continue;
    }
    if (emittedKeys.has(key)) continue;
    emittedKeys.add(key);
    rows.push({
      kind: "cluster",
      analysisPopulation: outcome.outcome.analysisPopulation.trim(),
      estimand: outcome.outcome.estimand!.trim(),
      outcomes: members,
    });
  }
  return rows;
}

/** Shared outcome-row list: the Population/Estimand clustering, rendered for one endpoint's outcomes. */
function OutcomeRowsList({
  outcomes,
  hideMaturity,
}: {
  outcomes: EndpointGroupView["outcomes"];
  hideMaturity: boolean;
}) {
  if (outcomes.length === 0) {
    return (
      <p className="py-3 text-sm text-muted-foreground">
        No recorded outcomes.
      </p>
    );
  }

  const rows = clusterOutcomes(outcomes);

  return (
    <ul className="divide-y divide-border">
      {rows.map((row) =>
        row.kind === "outcome" ? (
          <OutcomeResult
            key={row.outcome.outcome.id}
            outcome={row.outcome}
            hideMaturity={hideMaturity}
          />
        ) : (
          <Fragment key={`cluster-${row.outcomes[0].outcome.id}`}>
            <li className="flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-primary/50 bg-muted/30 py-2 pl-3 pr-1 text-xs text-muted-foreground sm:pl-4">
              <Badge>{row.outcomes.length} grouped results</Badge>
              <span>
                <span className="font-semibold text-foreground">
                  Population
                </span>{" "}
                {row.analysisPopulation}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <span className="font-semibold text-foreground">
                  Estimand
                </span>{" "}
                {row.estimand}
              </span>
            </li>
            {row.outcomes.map((outcome) => (
              <OutcomeResult
                key={outcome.outcome.id}
                outcome={outcome}
                hideMaturity={hideMaturity}
                hidePopulationEstimand
                clustered
              />
            ))}
          </Fragment>
        ),
      )}
    </ul>
  );
}

function EndpointCard({
  group,
  expanded,
  onToggle,
}: {
  group: EndpointGroupView;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { endpoint, outcomes } = group;

  // Hoist maturity to the endpoint header only when every outcome in this
  // endpoint shares the exact same value — genuine differences between
  // outcomes must stay visible on their own row, never be hidden. Per-outcome
  // source is not shown here at all: the Study-level Sources section already
  // lists every source cited anywhere in the study, so repeating it per
  // endpoint or per row would only echo that list.
  const commonMaturity = commonValue(outcomes, (o) => o.outcome.maturity);

  const bodyId = `endpoint-body-${endpoint.id}`;

  return (
    <div className="rounded-md border border-border bg-card shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border/70 bg-muted/30 px-4 py-3.5">
        {/* Accordion pattern: heading wraps the disclosure button. */}
        <h3 className="m-0 min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={bodyId}
            className="flex w-full items-start gap-2 rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span
              aria-hidden="true"
              className="mt-1 shrink-0 text-xs text-muted-foreground"
            >
              {expanded ? "▾" : "▸"}
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-card-foreground">
                  {endpoint.name}
                </span>
                <Badge tone="accent">{endpoint.role}</Badge>
                {commonMaturity ? <Badge>{commonMaturity}</Badge> : null}
              </span>
              <span className="mt-1 block text-sm font-medium text-muted-foreground">
                {[endpoint.domain, endpoint.assessmentTimepoint]
                  .filter(Boolean)
                  .join(" · ") || "N/A"}
              </span>
            </span>
          </button>
        </h3>
      </div>
      {expanded ? (
        <div id={bodyId} className="px-4 py-1">
          <OutcomeRowsList
            outcomes={outcomes}
            hideMaturity={Boolean(commonMaturity)}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Eligible to join a responder-threshold family: role, domain, and
 * assessment timepoint all present, and every one of the endpoint's own
 * outcomes reports a `result.responderThreshold` — the source-reported marker
 * that this endpoint measures a percentage-reduction threshold rather than a
 * continuous change. Domain/timepoint alone would risk folding in an
 * unrelated endpoint that merely happens to share both.
 */
function isResponderFamilyEligible(group: EndpointGroupView): boolean {
  const { domain, assessmentTimepoint } = group.endpoint;
  if (!domain || domain.trim().length === 0) return false;
  if (!assessmentTimepoint || assessmentTimepoint.trim().length === 0)
    return false;
  if (group.outcomes.length === 0) return false;
  return group.outcomes.every((outcome) =>
    Boolean(outcome.outcome.result.responderThreshold?.trim()),
  );
}

/** Exact-match family identity: role + domain + timepoint. */
function responderFamilyKey(group: EndpointGroupView): string {
  const { role, domain, assessmentTimepoint } = group.endpoint;
  return [role, domain!.trim(), assessmentTimepoint!.trim()].join(" ");
}

type CardRow =
  | { kind: "single"; group: EndpointGroupView }
  | {
      kind: "family";
      role: ClinicalEndpointRole;
      domain?: string;
      assessmentTimepoint?: string;
      groups: EndpointGroupView[];
    };

/**
 * Groups sibling endpoints that report different responder thresholds (e.g.
 * 5%, 10%, 15% body-weight reduction) at the same role, domain, and timepoint
 * into one card, so a reader compares thresholds without paging through
 * near-identical accordions that differ only by threshold. Stable group-by,
 * not a re-sort — same discipline as clusterOutcomes: keys only on role,
 * domain, and timepoint, keeps each endpoint's relative order, surfaces the
 * family at the position of its first member, and a key matched by only one
 * endpoint stays a plain card.
 */
function groupResponderFamilies(groups: EndpointGroupView[]): CardRow[] {
  const membersByKey = new Map<string, EndpointGroupView[]>();
  for (const group of groups) {
    if (!isResponderFamilyEligible(group)) continue;
    const key = responderFamilyKey(group);
    const members = membersByKey.get(key);
    if (members) {
      members.push(group);
    } else {
      membersByKey.set(key, [group]);
    }
  }

  const emittedKeys = new Set<string>();
  const rows: CardRow[] = [];
  for (const group of groups) {
    if (!isResponderFamilyEligible(group)) {
      rows.push({ kind: "single", group });
      continue;
    }
    const key = responderFamilyKey(group);
    const members = membersByKey.get(key)!;
    if (members.length < 2) {
      rows.push({ kind: "single", group });
      continue;
    }
    if (emittedKeys.has(key)) continue;
    emittedKeys.add(key);
    rows.push({
      kind: "family",
      role: group.endpoint.role,
      domain: group.endpoint.domain,
      assessmentTimepoint: group.endpoint.assessmentTimepoint,
      groups: members,
    });
  }
  return rows;
}

/** Stable identity for a card row, used for expand/collapse state and React keys. */
function cardRowKey(row: CardRow): string {
  return row.kind === "single"
    ? row.group.endpoint.id
    : `family:${row.groups.map((group) => group.endpoint.id).join(",")}`;
}

function EndpointFamilyCard({
  row,
  expanded,
  onToggle,
}: {
  row: Extract<CardRow, { kind: "family" }>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { groups, role, domain, assessmentTimepoint } = row;
  const allOutcomes = useMemo(
    () => groups.flatMap((group) => group.outcomes),
    [groups],
  );
  const commonMaturity = commonValue(allOutcomes, (o) => o.outcome.maturity);
  const bodyId = `endpoint-family-body-${cardRowKey(row)}`;

  return (
    <div className="rounded-md border border-border bg-card shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border/70 bg-muted/30 px-4 py-3.5">
        <h3 className="m-0 min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={bodyId}
            className="flex w-full items-start gap-2 rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span
              aria-hidden="true"
              className="mt-1 shrink-0 text-xs text-muted-foreground"
            >
              {expanded ? "▾" : "▸"}
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-card-foreground">
                  Responder thresholds
                </span>
                <Badge tone="accent">{role}</Badge>
                <Badge>{groups.length} endpoints</Badge>
                {commonMaturity ? <Badge>{commonMaturity}</Badge> : null}
              </span>
              <span className="mt-1 block text-sm font-medium text-muted-foreground">
                {[domain, assessmentTimepoint].filter(Boolean).join(" · ") ||
                  "N/A"}
              </span>
            </span>
          </button>
        </h3>
      </div>
      {expanded ? (
        <div id={bodyId} className="divide-y divide-border/70">
          {groups.map((group) => (
            <div key={group.endpoint.id} className="px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {group.endpoint.name}
              </p>
              <OutcomeRowsList
                outcomes={group.outcomes}
                hideMaturity={Boolean(commonMaturity)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Interactive Endpoints & outcomes section: role filter (All / Primary /
 * Secondary / Safety) plus per-endpoint disclosure. This is the only client
 * boundary on the study page; the surrounding StudyDetail stays a server
 * component. Filtering hides non-matching endpoints and never reorders them —
 * the read-model order of `endpointGroups` and of each card's outcomes is
 * preserved exactly, and responder-threshold families are grouped only for
 * presentation (see `groupResponderFamilies`), never merged in the read model.
 */
export function EndpointsSection({
  endpointGroups,
}: {
  endpointGroups: EndpointGroupView[];
}) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () =>
      new Set(
        groupResponderFamilies(endpointGroups)
          .filter((row) =>
            isDefaultExpanded(
              row.kind === "single" ? row.group.endpoint.role : row.role,
            ),
          )
          .map(cardRowKey),
      ),
  );

  const visibleGroups = useMemo(
    () =>
      endpointGroups.filter((group) =>
        matchesRoleFilter(group.endpoint.role, roleFilter),
      ),
    [endpointGroups, roleFilter],
  );

  const visibleRows = useMemo(
    () => groupResponderFamilies(visibleGroups),
    [visibleGroups],
  );

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const allVisibleExpanded =
    visibleRows.length > 0 &&
    visibleRows.every((row) => expandedIds.has(cardRowKey(row)));

  const toggleAllVisible = () =>
    setExpandedIds((prev) => {
      if (allVisibleExpanded) {
        const next = new Set(prev);
        for (const row of visibleRows) {
          next.delete(cardRowKey(row));
        }
        return next;
      }
      return new Set([...prev, ...visibleRows.map(cardRowKey)]);
    });

  if (endpointGroups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No recorded outcomes.</p>
    );
  }

  const filterButtonClass = (active: boolean) =>
    `rounded-sm px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  const bulkButtonClass =
    "rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter endpoints by role"
          className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1"
        >
          {ROLE_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={roleFilter === filter}
              onClick={() => setRoleFilter(filter)}
              className={filterButtonClass(roleFilter === filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleAllVisible}
          className={bulkButtonClass}
        >
          {allVisibleExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {visibleRows.length > 0 ? (
        <div className="space-y-4">
          {visibleRows.map((row) => {
            const key = cardRowKey(row);
            return row.kind === "single" ? (
              <EndpointCard
                key={key}
                group={row.group}
                expanded={expandedIds.has(key)}
                onToggle={() => toggle(key)}
              />
            ) : (
              <EndpointFamilyCard
                key={key}
                row={row}
                expanded={expandedIds.has(key)}
                onToggle={() => toggle(key)}
              />
            );
          })}
        </div>
      ) : roleFilter === "Safety" ? (
        <p className="text-sm text-muted-foreground">
          Safety is recorded as concise study-level fields, not as individual
          endpoints — see the Safety summary, Serious adverse events,
          Nausea/vomiting, and Anti-drug antibodies rows in Overview above.
          This tab stays empty unless a cited source explicitly designates its
          own safety endpoint.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          No {roleFilter.toLowerCase()} endpoints recorded.
        </p>
      )}
    </div>
  );
}
