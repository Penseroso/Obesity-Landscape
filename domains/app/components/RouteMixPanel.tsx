import Link from "next/link";
import { DistributionBar } from "./DistributionBar";
import type { RouteDistributionEntry } from "@/domains/company-pipeline/lib/selectors";

type RouteMixPanelProps = {
  entries: RouteDistributionEntry[];
};

export function RouteMixPanel({ entries }: RouteMixPanelProps) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded-md border border-border bg-card shadow-soft">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-card-foreground">
          Route Mix
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Programs by administration route.
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-center space-y-1.5 px-5 py-4">
        {entries.length > 0 ? (
          entries.map((entry) => (
            // Drill-down: Program Register filtered to this exact route
            // string, mirroring the Mechanism Mix donut's link-out - so a
            // reader curious what "Subcutaneous and oral" means can follow
            // it to the sourced row instead of the summary label guessing
            // at trial-design intent it was never given (source-and-entry-
            // policy.md's "only as published" bars inventing that wording
            // here).
            <Link
              key={entry.route}
              href={`/assets?route=${encodeURIComponent(entry.route)}`}
              aria-label={`${entry.route}: ${entry.count} programs (${Math.round(
                entry.share * 100,
              )}%) — open in Program Register`}
              className="-mx-2 block rounded-sm px-2 py-1 transition hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <DistributionBar
                label={entry.route}
                count={entry.count}
                share={entry.share}
              />
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No programs to display.</p>
        )}
      </div>
    </section>
  );
}
