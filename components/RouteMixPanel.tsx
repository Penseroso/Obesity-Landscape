import { DistributionBar } from "./DistributionBar";
import type { RouteDistributionEntry } from "@/lib/programs/selectors";

type RouteMixPanelProps = {
  entries: RouteDistributionEntry[];
};

export function RouteMixPanel({ entries }: RouteMixPanelProps) {
  return (
    <section className="rounded-md border border-border bg-card p-5 shadow-soft">
      <h2 className="text-base font-semibold text-card-foreground">Route Mix</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Programs by administration route.
      </p>
      <div className="mt-4 space-y-3">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <DistributionBar
              key={entry.route}
              label={entry.route}
              count={entry.count}
              share={entry.share}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No programs to display.</p>
        )}
      </div>
    </section>
  );
}
