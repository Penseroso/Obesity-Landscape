import type { Metadata } from "next";
import { EfficacyComparison } from "@/domains/app/components/EfficacyComparison";
import { getEfficacyComparison } from "@/domains/app/lib/efficacy-comparison/read-model";

export const metadata: Metadata = {
  title: "Efficacy Comparison",
  description:
    "Reported body-weight reduction by mechanism family, drawn from stored clinical results.",
};

type EfficacyComparisonPageProps = {
  searchParams: Promise<{ unit?: string | string[]; open?: string | string[] }>;
};

export default async function EfficacyComparisonPage({
  searchParams,
}: EfficacyComparisonPageProps) {
  const view = getEfficacyComparison();
  const params = await searchParams;
  const requestedUnit = Array.isArray(params.unit) ? params.unit[0] : params.unit;

  // A deep-linked `unit` only seeds the launcher's initial selection when it
  // matches a row the read model actually returned - never `view.gaps` - so
  // this stays a presentation-only reuse of already-computed eligibility,
  // same as a manual checkbox pick (see docs/README.md "Compare programs").
  const initialSelectedUnitKey = requestedUnit
    ? view.families
        .flatMap((group) => group.rows)
        .find((row) => row.unitKey === requestedUnit)?.unitKey
    : undefined;
  const initialOpen = Boolean(initialSelectedUnitKey) && Boolean(params.open);

  return (
    <EfficacyComparison
      view={view}
      initialSelectedUnitKey={initialSelectedUnitKey}
      initialOpen={initialOpen}
    />
  );
}
