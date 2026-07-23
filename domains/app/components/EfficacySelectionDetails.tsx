"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { FocusEvent } from "react";

type EfficacySelectionDetailsProps = {
  facts: { label: string; value: string; href?: string }[];
};

/**
 * Auxiliary **disclosure** for one comparison row — a button that toggles a panel of
 * supplementary detail, not a modal dialog. It carries `aria-expanded`/`aria-controls`
 * and no dialog role or focus trap, because it neither demands a response nor removes
 * the rest of the page from interaction.
 *
 * Deliberately **not** the only path to anything it shows: the row already renders
 * every fact needed to read its numbers. This adds the Study link and repeats the
 * analysis detail in one place. If it fails to open — no JavaScript, an unsupported
 * browser — the page stays fully usable.
 *
 * Selection rationale (why this study ranked ahead of other candidates) is
 * deliberately not surfaced here: a sweep reader scans bold values, not prose, so a
 * text explanation reaches no one who wouldn't already trust the row. It stays
 * computed on `RepresentativeEvidence.selectionRationale` as an internal audit
 * trail, just not rendered.
 *
 * **The button click is the single toggle authority.** Click, tap, Enter, and Space
 * all resolve through the one `onClick` path, so no gesture opens and closes in the
 * same interaction. There is deliberately no open-on-focus and no open-on-hover: a
 * touch tap fires focus *and* click together, and a mouse click is preceded by a
 * pointer-enter, so letting either also open would race the toggle and flicker the
 * panel shut. The panel closes when focus leaves the component, on Escape (returning
 * focus to the trigger), and on a pointer-down outside it.
 */
export function EfficacySelectionDetails({
  facts,
}: EfficacySelectionDetailsProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  // Set fresh on every pointerdown while open (see effect below) — recorded so the
  // blur handler can tell an internal click, which moves focus off the trigger with
  // no in-panel element to catch it, from a real outside interaction.
  const pointerDownInsideRef = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const isInside = Boolean(
        containerRef.current && containerRef.current.contains(event.target as Node),
      );
      pointerDownInsideRef.current = isInside;
      if (!isInside) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Close once focus lands outside the component entirely — tabbing past the trigger,
  // not moving between the trigger and its own panel. A click on non-focusable panel
  // content (plain text, not a link) still blurs the trigger with `relatedTarget`
  // null, which would otherwise read as "focus left the component" and close the
  // panel out from under the click. The pointerdown flag distinguishes that case.
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (pointerDownInsideRef.current) {
      pointerDownInsideRef.current = false;
      return;
    }
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Study details"
        title="Study details"
        className="inline-flex items-center justify-center rounded-md border border-border px-1.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span aria-hidden="true">ⓘ</span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute right-0 z-20 mt-2 w-[min(26rem,calc(100vw-2.5rem))] rounded-md border border-border bg-card p-3 text-left shadow-soft"
        >
          <dl className="space-y-1 text-xs">
            {facts.map((fact) => (
              <div key={fact.label} className="flex gap-2">
                <dt className="shrink-0 font-medium text-foreground">
                  {fact.label}
                </dt>
                <dd className="text-muted-foreground">
                  {fact.href ? (
                    <Link
                      href={fact.href}
                      className="rounded-sm font-medium text-primary hover:underline"
                    >
                      {fact.value}
                    </Link>
                  ) : (
                    fact.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
