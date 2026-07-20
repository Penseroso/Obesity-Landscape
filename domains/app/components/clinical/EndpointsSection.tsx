"use client";

import { Fragment, useMemo, useState } from "react";
import { SourceList } from "@/domains/app/components/SourceList";
import { Badge, OutcomeResult } from "@/domains/app/components/clinical/OutcomeResult";
import type { EndpointGroupView } from "@/domains/app/lib/clinical-evidence/selectors";
import type { ClinicalEndpointRole } from "@/domains/clinical-evidence/lib/types";
import type { SourceReference } from "@/domains/company-pipeline/lib/types";

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

/** Order-independent identity of a source set, used only to detect duplication. */
function sourceSetKey(sources: SourceReference[]): string {
  return sources
    .map((source) => source.url)
    .slice()
    .sort()
    .join("|");
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
 * Eligible to join a Population/Estimand cluster: arm-anchored (not an
 * AnalysisGroup, whose own label already carries the context a cluster
 * header would otherwise state) with a non-empty population and estimand.
 */
function isClusterEligible(outcome: EndpointGroupView["outcomes"][number]) {
  const { analysisPopulation, estimand } = outcome.outcome;
  if (outcome.groupLabel) return false;
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

  // Hoist maturity/source to the endpoint header only when every outcome in
  // this endpoint shares the exact same value — genuine differences between
  // outcomes must stay visible on their own row, never be hidden.
  const commonMaturity = commonValue(outcomes, (o) => o.outcome.maturity);
  const commonSourceKey = commonValue(outcomes, (o) =>
    sourceSetKey(o.outcome.metadata.sources),
  );
  const commonSources =
    commonSourceKey && commonSourceKey.length > 0
      ? outcomes[0].outcome.metadata.sources
      : undefined;

  const rows = clusterOutcomes(outcomes);

  const bodyId = `endpoint-body-${endpoint.id}`;

  return (
    <div className="rounded-md border border-border bg-card shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border/70 bg-muted/30 px-4 py-3.5">
        {/* Accordion pattern: heading wraps the disclosure button. Source links
            stay outside the button so interactive content is never nested. */}
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
        {commonSources && commonSources.length > 0 ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Source</span>
            <SourceList sources={commonSources} variant="inline" />
          </p>
        ) : null}
      </div>
      {expanded ? (
        <div id={bodyId} className="px-4 py-1">
          {outcomes.length > 0 ? (
            <ul className="divide-y divide-border">
              {rows.map((row) =>
                row.kind === "outcome" ? (
                  <OutcomeResult
                    key={row.outcome.outcome.id}
                    outcome={row.outcome}
                    hideMaturity={Boolean(commonMaturity)}
                    hideSource={Boolean(commonSources)}
                  />
                ) : (
                  <Fragment key={`cluster-${row.outcomes[0].outcome.id}`}>
                    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-muted/30 px-1 py-2 text-xs text-muted-foreground">
                      <Badge>{row.outcomes.length} results</Badge>
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
                        hideMaturity={Boolean(commonMaturity)}
                        hideSource={Boolean(commonSources)}
                        hidePopulationEstimand
                        clustered
                      />
                    ))}
                  </Fragment>
                ),
              )}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">
              No recorded outcomes.
            </p>
          )}
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
 * preserved exactly.
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
        endpointGroups
          .filter((group) => isDefaultExpanded(group.endpoint.role))
          .map((group) => group.endpoint.id),
      ),
  );

  const visibleGroups = useMemo(
    () =>
      endpointGroups.filter((group) =>
        matchesRoleFilter(group.endpoint.role, roleFilter),
      ),
    [endpointGroups, roleFilter],
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

  const expandAllVisible = () =>
    setExpandedIds(
      (prev) =>
        new Set([...prev, ...visibleGroups.map((group) => group.endpoint.id)]),
    );

  const collapseAllVisible = () =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const group of visibleGroups) {
        next.delete(group.endpoint.id);
      }
      return next;
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={expandAllVisible}
            className={bulkButtonClass}
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAllVisible}
            className={bulkButtonClass}
          >
            Collapse all
          </button>
        </div>
      </div>

      {visibleGroups.length > 0 ? (
        <div className="space-y-4">
          {visibleGroups.map((group) => (
            <EndpointCard
              key={group.endpoint.id}
              group={group}
              expanded={expandedIds.has(group.endpoint.id)}
              onToggle={() => toggle(group.endpoint.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No {roleFilter.toLowerCase()} endpoints recorded.
        </p>
      )}
    </div>
  );
}
