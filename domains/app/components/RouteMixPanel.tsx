import { CollapsibleSection } from "./CollapsibleSection";
import { MixStack } from "./MixStack";
import type { RouteDistributionEntry } from "@/domains/company-pipeline/lib/selectors";

type RouteMixPanelProps = {
  entries: RouteDistributionEntry[];
};

export function RouteMixPanel({ entries }: RouteMixPanelProps) {
  const colors = [
    "#2a78d6",
    "#eb6834",
    "#1baf7a",
    "#eda100",
    "#e87ba4",
    "#008300",
  ];

  return (
    <CollapsibleSection
      id="route-mix"
      title="Route Mix"
      subtitle="Programs by administration route."
      defaultOpen={false}
    >
      {entries.length > 0 ? (
        <MixStack
          ariaLabel="Programs by administration route"
          entries={entries.map((entry, index) => ({
            key: entry.route,
            label: entry.route,
            count: entry.count,
            share: entry.share,
            color: colors[index % colors.length],
            href: `/assets?route=${encodeURIComponent(entry.route)}`,
          }))}
        />
      ) : (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          No programs to display.
        </p>
      )}
    </CollapsibleSection>
  );
}
