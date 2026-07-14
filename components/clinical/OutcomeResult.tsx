import { SourceList } from "@/components/SourceList";
import type { OutcomeView } from "@/lib/clinical-evidence/selectors";

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

function Badge({
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

export function OutcomeResult({ outcome }: { outcome: OutcomeView }) {
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
    <li className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={isBetweenArm ? "accent" : "muted"}>
          {isBetweenArm ? "Between-arm" : "Arm-level"}
        </Badge>
        <Badge>{maturity}</Badge>
      </div>
      <p className="mt-2 text-sm font-medium text-muted-foreground">{subject}</p>
      <p className="mt-0.5 text-base font-semibold text-foreground">
        {displayValue(result.value, result.unit)}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {result.confidenceInterval ? (
          <MetricChip value={result.confidenceInterval} />
        ) : null}
        {result.pValue ? (
          <MetricChip label="p-value" value={result.pValue} />
        ) : null}
        {result.responderThreshold ? (
          <MetricChip label="Responder" value={result.responderThreshold} />
        ) : null}
        <MetricChip label="Population" value={analysisPopulation} />
        {estimand ? <MetricChip label="Estimand" value={estimand} /> : null}
      </div>
      {metadata.sources.length > 0 ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Source</span>
          <SourceList sources={metadata.sources} variant="inline" />
        </p>
      ) : null}
    </li>
  );
}
