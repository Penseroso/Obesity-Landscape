"use client";

import Link from "next/link";
import { useState } from "react";

export type MixStackEntry = {
  key: string;
  label: string;
  count: number;
  share: number;
  color: string;
  href?: string;
};

type MixStackProps = {
  entries: MixStackEntry[];
  ariaLabel: string;
  activeStrokeColor?: string;
};

/**
 * Shared overview distribution language: one 100% stack and a linked legend.
 * Color identifies a category only inside the current chart; count and share
 * remain permanently visible in the legend so meaning never depends on color.
 */
export function MixStack({ entries, ariaLabel, activeStrokeColor }: MixStackProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeEntry = entries.find((entry) => entry.key === activeKey) ?? null;
  const clear = () => setActiveKey(null);

  return (
    <div className="px-5 py-5">
      <div
        className="flex h-4 w-full overflow-hidden rounded-sm bg-muted"
        role="group"
        aria-label={ariaLabel}
      >
        {entries.map((entry) => {
          const className = `block h-full min-w-[3px] transition-opacity ${
            activeKey === null || activeKey === entry.key ? "opacity-100" : "opacity-30"
          }`;
          const style = {
            width: `${entry.share * 100}%`,
            backgroundColor: entry.color,
            boxShadow:
              activeKey === entry.key && activeStrokeColor
                ? `inset 0 0 0 2px ${activeStrokeColor}`
                : undefined,
          };
          const label = `${entry.label}: ${entry.count} programs (${Math.round(
            entry.share * 100,
          )}%)`;

          return entry.href ? (
            <Link
              key={entry.key}
              href={entry.href}
              aria-label={`${label} — open in Program Register`}
              title={label}
              className={`${className} focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
              style={style}
              onMouseEnter={() => setActiveKey(entry.key)}
              onMouseLeave={clear}
              onFocus={() => setActiveKey(entry.key)}
              onBlur={clear}
            />
          ) : (
            <span
              key={entry.key}
              title={label}
              className={className}
              style={style}
              onMouseEnter={() => setActiveKey(entry.key)}
              onMouseLeave={clear}
            />
          );
        })}
      </div>

      <p className="mt-3 min-h-5 text-sm text-muted-foreground" aria-live="polite">
        {activeEntry ? (
          <>
            <span className="font-medium text-foreground">{activeEntry.label}</span>
            {" · "}
            <span className="tabular-nums">
              {activeEntry.count} programs, {Math.round(activeEntry.share * 100)}%
            </span>
          </>
        ) : (
          "Hover or focus a category to isolate it."
        )}
      </p>

      <ul className="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {entries.map((entry) => {
          const content = (
            <>
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 text-foreground">{entry.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-primary">
                {entry.count}
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">
                {Math.round(entry.share * 100)}%
              </span>
            </>
          );
          const className = `flex items-start gap-2 rounded-sm py-1 text-sm transition ${
            activeKey === null || activeKey === entry.key ? "opacity-100" : "opacity-35"
          }`;

          return (
            <li key={entry.key}>
              {entry.href ? (
                <Link
                  href={entry.href}
                  className={`${className} hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
                  onMouseEnter={() => setActiveKey(entry.key)}
                  onMouseLeave={clear}
                  onFocus={() => setActiveKey(entry.key)}
                  onBlur={clear}
                >
                  {content}
                </Link>
              ) : (
                <span
                  className={className}
                  onMouseEnter={() => setActiveKey(entry.key)}
                  onMouseLeave={clear}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
