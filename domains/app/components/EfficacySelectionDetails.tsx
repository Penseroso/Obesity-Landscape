"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FocusEvent } from "react";

type EfficacySelectionDetailsProps = {
  rationale: string[];
  facts: { label: string; value: string }[];
};

/**
 * Auxiliary **disclosure** for one comparison row — a button that toggles a panel of
 * supplementary detail, not a modal dialog. It carries `aria-expanded`/`aria-controls`
 * and no dialog role or focus trap, because it neither demands a response nor removes
 * the rest of the page from interaction.
 *
 * Deliberately **not** the only path to anything it shows: the row already renders
 * every fact needed to read its numbers, and links to the Study. This adds the
 * selection rationale and repeats the analysis detail in one place. If it fails to
 * open — no JavaScript, an unsupported browser — the page stays fully usable.
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
  rationale,
  facts,
}: EfficacySelectionDetailsProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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
  // not moving between the trigger and its own panel.
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
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
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span aria-hidden="true">ⓘ</span>
        Why this study
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute right-0 z-20 mt-2 w-[min(26rem,calc(100vw-2.5rem))] rounded-md border border-border bg-card p-3 text-left shadow-soft"
        >
          <p className="text-sm font-semibold text-card-foreground">
            Selection rationale
          </p>
          <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
            {rationale.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden="true" className="text-border">
                  •
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <dl className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
            {facts.map((fact) => (
              <div key={fact.label} className="flex gap-2">
                <dt className="shrink-0 font-medium text-foreground">
                  {fact.label}
                </dt>
                <dd className="text-muted-foreground">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
