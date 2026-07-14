import Link from "next/link";
import type {
  AssetStudyPreview,
  PreviewStudy,
} from "@/lib/clinical-evidence/selectors";

function RelationBadge({ relation }: { relation: PreviewStudy["relation"] }) {
  const isFocal = relation === "focal";
  return (
    <span
      className={
        isFocal
          ? "whitespace-nowrap rounded-sm border border-border bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground"
          : "whitespace-nowrap rounded-sm border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
      }
    >
      {isFocal ? "Focal" : "Comparator"}
    </span>
  );
}

function PreviewRow({ study }: { study: PreviewStudy }) {
  return (
    <Link
      href={`/studies/${study.id}`}
      className="flex flex-col gap-1 rounded-md border border-border bg-card p-3 transition hover:bg-accent/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex flex-wrap items-center gap-2">
        <RelationBadge relation={study.relation} />
        {study.primaryRegistryId ? (
          <span className="text-xs font-medium text-muted-foreground">
            {study.primaryRegistryId}
          </span>
        ) : null}
      </span>
      <span className="text-sm font-semibold text-card-foreground">
        {study.title}
      </span>
      <span className="text-xs text-muted-foreground">
        {study.phase} · {study.status}
      </span>
    </Link>
  );
}

/**
 * Asset-scoped clinical trial preview for the Program Drawer. Purely
 * presentational — the merge/cap policy lives in `getAssetStudyPreview`.
 */
export function StudyPreviewList({ preview }: { preview: AssetStudyPreview }) {
  return (
    <section aria-label="Clinical evidence for this asset" className="mb-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Clinical evidence for this asset
        </h3>
        <span className="text-xs text-muted-foreground">
          {preview.totalCount}{" "}
          {preview.totalCount === 1 ? "study" : "studies"}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {preview.studies.map((study) => (
          <PreviewRow key={study.id} study={study} />
        ))}
      </div>
      <Link
        href={preview.href}
        className="mt-3 inline-flex items-center gap-1 rounded-md border border-border bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        View all clinical evidence ({preview.totalCount}) →
      </Link>
    </section>
  );
}
