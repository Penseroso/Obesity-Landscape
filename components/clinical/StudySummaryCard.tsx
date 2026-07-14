import Link from "next/link";
import type { StudySummaryView } from "@/lib/clinical-evidence/selectors";

export function StudySummaryCard({ study }: { study: StudySummaryView }) {
  return (
    <Link
      href={`/studies/${study.id}`}
      className="flex flex-col gap-1 rounded-md border border-border bg-card p-4 shadow-soft transition hover:bg-accent/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-card-foreground">
          {study.title}
        </span>
        <span className="whitespace-nowrap rounded-sm border border-border bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
          {study.phase}
        </span>
      </span>
      <span className="text-xs text-muted-foreground">{study.status}</span>
      {study.primaryRegistryId ? (
        <span className="text-xs font-medium text-muted-foreground">
          {study.primaryRegistryId}
        </span>
      ) : null}
      {study.acronym ? (
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {study.officialTitle}
        </span>
      ) : null}
    </Link>
  );
}
