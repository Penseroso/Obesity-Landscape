import type { ReactNode } from "react";

type PageHeadingProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * Shared top-level page hierarchy. Route-specific context may vary, but every
 * product page keeps the same title scale, copy rhythm, and responsive action
 * alignment through this single surface.
 */
export function PageHeading({
  title,
  description,
  meta,
  actions,
  children,
  className = "",
}: PageHeadingProps) {
  return (
    <header
      className={`pt-2 ${
        actions
          ? "flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"
          : ""
      } ${className}`}
    >
      <div className="min-w-0">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="mt-3 text-sm leading-6 text-muted-foreground">
            {meta}
          </div>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
