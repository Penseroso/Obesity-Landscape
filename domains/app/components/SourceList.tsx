import type { SourceReference } from "@/domains/company-pipeline/lib/types";

type SourceListProps = {
  sources: SourceReference[];
  /**
   * `block` (default): one stacked link per source — used for program/study
   * source lists. `inline`: compact links for per-outcome provenance, meant to
   * sit inside a `flex-wrap` row provided by the caller.
   */
  variant?: "block" | "inline";
  /** Text shown when there are no sources. Omit to render nothing when empty. */
  emptyLabel?: string;
};

/**
 * Renders external source links. Emits a fragment (no wrapping container) so the
 * caller controls layout — program sources keep their existing `<dd>` wrapper,
 * study sources use a block container, and outcome provenance flows inline.
 */
export function SourceList({
  sources,
  variant = "block",
  emptyLabel,
}: SourceListProps) {
  if (sources.length === 0) {
    return emptyLabel ? (
      <span className="text-foreground">{emptyLabel}</span>
    ) : null;
  }

  const linkClassName =
    variant === "inline"
      ? "text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      : "block font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <>
      {sources.map((source) => (
        <a
          key={`${source.url}-${source.checkedAt}`}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className={linkClassName}
        >
          {variant === "inline"
            ? source.title ?? source.sourceType ?? "Source"
            : source.title ?? source.url}
        </a>
      ))}
    </>
  );
}
