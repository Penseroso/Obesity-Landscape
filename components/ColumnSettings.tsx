"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  getProgramTableColumnLabel,
  type ProgramTableColumnId,
} from "@/config/program-table";
import type { ProgramColumnControls } from "./useProgramTableColumns";

type ColumnSettingsProps = {
  controls: ProgramColumnControls;
};

const iconButtonClassName =
  "flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground";

export function ColumnSettings({ controls }: ColumnSettingsProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Close on outside click and on Escape; return focus to the trigger on Escape.
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

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) {
      const firstControl = panelRef.current?.querySelector<HTMLElement>(
        "input, button",
      );
      firstControl?.focus();
    }
  }, [open]);

  const { orderedColumns } = controls;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span aria-hidden="true">▤</span>
        Columns
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Column settings"
          className="absolute left-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-border bg-card p-3 shadow-soft sm:left-auto sm:right-0"
        >
          <div className="flex items-center justify-between gap-3 pb-2">
            <p className="text-sm font-semibold text-card-foreground">
              Columns
            </p>
            <button
              type="button"
              onClick={controls.resetColumns}
              disabled={controls.isDefault}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            >
              Reset to default
            </button>
          </div>
          <p className="pb-2 text-xs text-muted-foreground">
            Company and Asset are always shown first.
          </p>
          <ul className="max-h-[min(24rem,60vh)] space-y-1 overflow-y-auto">
            {orderedColumns.map((column) => {
              const id = column.id as ProgramTableColumnId;
              const label = getProgramTableColumnLabel(column);
              const locked = controls.isLocked(id);
              const checkboxId = `${panelId}-${id}`;

              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-muted/60"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={controls.isVisible(id)}
                      disabled={locked || !controls.canToggle(id)}
                      onChange={() => controls.toggleColumn(id)}
                      className="h-4 w-4 shrink-0 accent-primary disabled:opacity-60"
                    />
                    <label
                      htmlFor={checkboxId}
                      className="truncate text-sm text-foreground"
                    >
                      {label}
                      {locked ? (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          (fixed)
                        </span>
                      ) : null}
                    </label>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => controls.moveColumnUp(id)}
                      disabled={!controls.canMoveUp(id)}
                      aria-label={`Move ${label} up`}
                      className={iconButtonClassName}
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => controls.moveColumnDown(id)}
                      disabled={!controls.canMoveDown(id)}
                      aria-label={`Move ${label} down`}
                      className={iconButtonClassName}
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
