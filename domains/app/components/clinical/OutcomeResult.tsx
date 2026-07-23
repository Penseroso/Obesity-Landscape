import type { OutcomeView } from "@/domains/app/lib/clinical-evidence/selectors";

/**
 * True when the unit is already expressed in the source-reported value, so we
 * must not append it again (e.g. value "45%" + unit "percent"). Values in the
 * current data carry no unit text, so this is a safety net against duplication,
 * never a transform of the value itself.
 */
function unitAlreadyInValue(value: string, unit: string): boolean {
  const normalizedValue = value.toLowerCase();
  const normalizedUnit = unit.trim().toLowerCase();
  if (!normalizedUnit) {
    return true;
  }
  if (normalizedValue.includes(normalizedUnit)) {
    return true;
  }
  return normalizedUnit === "percent" && normalizedValue.includes("%");
}

/** Render the source value verbatim, appending the unit only when not already present. */
function displayValue(value: string, unit: string): string {
  return unitAlreadyInValue(value, unit) ? value : `${value} ${unit}`;
}

/** Human-readable label for a source-reported analysis-group construction. */
const groupKindLabel: Record<string, string> = {
  pooled: "Pooled",
  derived: "Derived",
  "starting-dose-subgroup": "Starting-dose subgroup",
  other: "Analysis group",
};

export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "primary";
}) {
  return (
    <span
      className={
        tone === "accent"
          ? "whitespace-nowrap rounded-sm border border-border bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground"
          : tone === "primary"
            ? "whitespace-nowrap rounded-sm border border-primary/30 bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"
            : "whitespace-nowrap rounded-sm border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
      }
    >
      {children}
    </span>
  );
}

function MetricChip({ label, value }: { label?: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
      {label ? (
        <span className="font-semibold text-foreground">{label}</span>
      ) : null}
      <span>{value}</span>
    </span>
  );
}

type OutcomeResultProps = {
  outcome: OutcomeView;
  /** Suppress the per-row maturity badge when the endpoint header already states it. */
  hideMaturity?: boolean;
  /** Suppress the per-row Population/Estimand block when a cluster header above already states it. */
  hidePopulationEstimand?: boolean;
  /**
   * Reads as nested under a cluster header rather than a top-level entry. Carries a
   * left border rail matching the cluster header's, unbroken from the header through
   * every member row, so the grouping stays visible without relying on indentation
   * alone (indentation-only read as an unexplained layout quirk, not a group).
   */
  clustered?: boolean;
};

export function OutcomeResult({
  outcome,
  hideMaturity = false,
  hidePopulationEstimand = false,
  clustered = false,
}: OutcomeResultProps) {
  const { result, analysisPopulation, estimand, maturity } = outcome.outcome;
  const isBetweenArm = result.resultType === "between-arm";

  // Subject line: analysis-group anchored > between-arm comparison > arm-level.
  // For arm-level, join multiple arm labels neutrally — never "vs", which would
  // imply a comparison the outcome does not make. For between-arm, the arm
  // labels are the dose identity and always lead the subject when available;
  // comparisonType (falling back to effectMeasure) is the comparison's own
  // methodology text, not a dose identifier — it renders as a secondary line so
  // that rows sharing identical wording (e.g. every dose vs placebo reported as
  // "Least-squares mean difference, retatrutide minus placebo") stay
  // distinguishable by dose at a glance.
  let subject: string;
  let subjectDetail: string | undefined;
  if (outcome.groupLabel) {
    subject = outcome.groupLabel;
  } else if (isBetweenArm) {
    const armSubject = outcome.armLabels.join(" vs ");
    const methodology = result.comparisonType ?? result.effectMeasure;
    subject = armSubject || methodology || "Between-arm result";
    subjectDetail = armSubject ? methodology : undefined;
  } else {
    subject =
      outcome.armLabels.length > 0
        ? outcome.armLabels.join(" + ")
        : "Arm-level result";
  }

  return (
    <li
      className={`grid grid-cols-1 gap-x-5 gap-y-2 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center ${
        clustered ? "border-l-2 border-primary/50 pl-3 sm:pl-4" : ""
      }`}
    >
      {/* Column 1: treatment-regimen subject (arm/dose or analysis-group). */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            tone={
              isBetweenArm ? "accent" : outcome.groupKind ? "primary" : "muted"
            }
          >
            {isBetweenArm
              ? "Between-arm"
              : outcome.groupKind
                ? (groupKindLabel[outcome.groupKind] ?? "Analysis group")
                : "Arm-level"}
          </Badge>
          {!hideMaturity ? <Badge>{maturity}</Badge> : null}
        </div>
        <p className="mt-1.5 text-sm font-medium text-foreground">{subject}</p>
        {subjectDetail ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subjectDetail}
          </p>
        ) : null}
      </div>

      {/* Column 2: efficacy estimand, kept visually distinct from the regimen subject. */}
      <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
        {!hidePopulationEstimand ? (
          <>
            <p>
              <span className="font-semibold text-foreground">Population</span>{" "}
              {analysisPopulation}
            </p>
            {estimand ? (
              <p>
                <span className="font-semibold text-foreground">Estimand</span>{" "}
                {estimand}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Column 3: result value, emphasized above supporting statistical detail. */}
      <div className="min-w-0">
        <p className="text-base font-semibold text-foreground">
          {displayValue(result.value, result.unit)}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {result.confidenceInterval ? (
            <MetricChip value={result.confidenceInterval} />
          ) : null}
          {result.pValue ? (
            <MetricChip label="p-value" value={result.pValue} />
          ) : null}
          {result.responderThreshold ? (
            <MetricChip label="Responder" value={result.responderThreshold} />
          ) : null}
        </div>
      </div>
    </li>
  );
}
