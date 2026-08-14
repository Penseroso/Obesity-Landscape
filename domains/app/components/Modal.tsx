"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

type ModalProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClassName?: string;
  /** Shrinks the panel to its content's natural width (capped by
   * `maxWidthClassName`, floored by a readable minimum) instead of always
   * stretching to fill that width. For content whose width varies with what's
   * selected (e.g. a bar chart), a full-width panel leaves visibly uneven
   * padding when the content is narrower than the cap. */
  fitContent?: boolean;
  /** Full override for the panel's width/height classes (e.g. "w-[50vw]
   * h-[50vh]"), taking precedence over `maxWidthClassName`/`fitContent`. For a
   * panel that should track the viewport rather than its content or a fixed
   * cap; content narrower or shorter than the panel just sits inside it. */
  sizeClassName?: string;
  /** Optional geometry derived by the caller from its rendered content. */
  panelStyle?: React.CSSProperties;
  /** Optional secondary action rendered beside the dialog title. */
  headerActions?: React.ReactNode;
};

/**
 * Centered dialog primitive shared by the Efficacy Comparison picker and chart
 * modals. Same portal/focus-trap/scroll-lock/Escape behavior ProgramDetailDrawer
 * hand-rolls for its side drawer, minus the slide-in transition neither of these
 * two centered dialogs needs.
 */
export function Modal({
  title,
  onClose,
  children,
  maxWidthClassName = "max-w-lg",
  fitContent = false,
  sizeClassName,
  panelStyle,
  headerActions,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const paddingRight = Number.parseFloat(
        window.getComputedStyle(document.body).paddingRight,
      );
      document.body.style.paddingRight = `${paddingRight + scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const activeIsInPanel = active instanceof Node && panelRef.current.contains(active);

      if (event.shiftKey) {
        if (!activeIsInPanel || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!activeIsInPanel || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-foreground/30"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        style={panelStyle}
        className={`relative flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-soft outline-none ${
          sizeClassName ??
          `max-h-[calc(100vh-2rem)] ${fitContent ? "w-auto min-w-[24rem]" : "w-full"} ${maxWidthClassName}`
        }`}
      >
        <div className="flex min-h-[4.5rem] items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <h2
              id={headingId}
              className="truncate text-xl font-semibold leading-none text-card-foreground"
            >
              {title}
            </h2>
            {headerActions}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
