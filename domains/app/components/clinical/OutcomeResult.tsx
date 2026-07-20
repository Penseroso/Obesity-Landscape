import { SourceList } from "@/domains/app/components/SourceList";
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

export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent";
}) {
  return (
    <span
      className={
        tone === "accent"
          ? "whitespace-nowrap rounded-sm border border-border bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground"
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
  /** Suppress the per-row source line when the endpoint header already states it. */
  hideSource?: boolean;
};

export function OutcomeResult({
  outcome,
  hideMaturity = false,
  hideSource = false,
}: OutcomeResultProps) {
  const { result, analysisPopulation, estimand, maturity, metadata } =
    outcome.outcome;
  const isBetweenArm = result.resultType === "between-arm";

  // Subject line: analysis-group anchored > between-arm comparison > arm-level.
  // For arm-level, join multiple arm labels neutrally — never "vs", which would
  // imply a comparison the outcome does not make. For between-arm, prefer the
  // fully-directional comparisonType and fall back to effectMeasure (+ the arms
  // being compared); never show comparisonType and effectMeasure together.
  let subject: string;
  if (outcome.groupLabel) {
    subject = outcome.groupLabel;
  } else if (isBetweenArm) {
    const fallback =
      [result.effectMeasure, outcome.armLabels.join(" vs ") || undefined]
        .filter(Boolean)
        .join(" · ") || "Between-arm result";
    subject = result.comparisonType ?? fallback;
  } else {
    subject =
      outcome.armLabels.length > 0
        ? outcome.armLabels.join(" + ")
        : "Arm-level result";
  }

  return (
    <li className="grid grid-cols-1 gap-x-5 gap-y-2 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
      {/* Column 1: treatment-regimen subject (arm/dose or analysis-group). */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={isBetweenArm ? "accent" : "muted"}>
            {isBetweenArm ? "Between-arm" : "Arm-level"}
          </Badge>
          {!hideMaturity ? <Badge>{maturity}</Badge> : null}
        </div>
        <p className="mt-1.5 text-sm font-medium text-foreground">{subject}</p>
      </div>

      {/* Column 2: efficacy estimand, kept visually distinct from the regimen subject. */}
      <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
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

      {!hideSource && metadata.sources.length > 0 ? (
        <p className="col-span-full flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Source</span>
          <SourceList sources={metadata.sources} variant="inline" />
        </p>
      ) : null}
    </li>
  );
}
