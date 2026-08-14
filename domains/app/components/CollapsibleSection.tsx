"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState } from "react";

type CollapsibleSectionProps = {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  defaultOpen?: boolean;
  appearance?: "card" | "plain";
  children: React.ReactNode;
};

/**
 * Accordion-style card section: the heading wraps a disclosure button so the
 * whole header row toggles the body, mirroring the ▾/▸ convention
 * EndpointsSection already uses for its per-endpoint accordions. Open by
 * default so a first visit still shows every group's data — collapsing is a
 * scan-reduction aid, never how content becomes reachable.
 *
 * This does not apply to primary navigation surfaces where every populated
 * cell/row is itself a drill-down link (e.g. `CompanyStageMatrix`) — those
 * must stay fully visible, not wrapped in this component. `defaultOpen={false}`
 * is only appropriate for genuinely secondary/summary panels (e.g.
 * `RouteMixPanel`, `MechanismMixPanel`) where the same links remain reachable
 * one click away.
 */
export function CollapsibleSection({
  id,
  title,
  subtitle,
  defaultOpen = true,
  appearance = "card",
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section
      id={id}
      className={
        appearance === "plain"
          ? "scroll-mt-20 border-t border-border"
          : "scroll-mt-20 rounded-md border border-border bg-card shadow-soft"
      }
    >
      <h2
        className={`m-0 ${
          open && appearance === "card" ? "border-b border-border" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={bodyId}
          className={`flex w-full items-start gap-2 text-left transition hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            appearance === "plain" ? "px-0 py-5" : "rounded-t-md px-5 py-4"
          }`}
        >
          <span aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground">
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
          <span className="min-w-0">
            <span
              className={`block font-semibold tracking-tight text-card-foreground ${
                appearance === "plain" ? "text-xl" : "text-base"
              }`}
            >
              {title}
            </span>
            {subtitle ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {subtitle}
              </span>
            ) : null}
          </span>
        </button>
      </h2>
      {open ? <div id={bodyId}>{children}</div> : null}
    </section>
  );
}
