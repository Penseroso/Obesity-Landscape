"use client";

import { useId, useState } from "react";

type CollapsibleSectionProps = {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

/**
 * Accordion-style card section: the heading wraps a disclosure button so the
 * whole header row toggles the body, mirroring the ▾/▸ convention
 * EndpointsSection already uses for its per-endpoint accordions. Open by
 * default so a first visit still shows every group's data — collapsing is a
 * scan-reduction aid, never how content becomes reachable.
 */
export function CollapsibleSection({
  id,
  title,
  subtitle,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-md border border-border bg-card shadow-soft"
    >
      <h2 className={`m-0 ${open ? "border-b border-border" : ""}`}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex w-full items-start gap-2 rounded-t-md px-5 py-4 text-left transition hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span aria-hidden="true" className="mt-1 shrink-0 text-xs text-muted-foreground">
            {open ? "▾" : "▸"}
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-card-foreground">
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
