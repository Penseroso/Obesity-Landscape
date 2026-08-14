"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview", matches: ["/"] },
  {
    href: "/assets",
    label: "Program Register",
    matches: ["/assets", "/companies", "/studies"],
  },
  {
    href: "/efficacy-comparison",
    label: "Efficacy Comparison",
    matches: ["/efficacy-comparison"],
  },
  { href: "/news", label: "Latest News", matches: ["/news"] },
] as const;

const baseClassName =
  "inline-flex shrink-0 border-b-2 px-1 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function matchesPath(pathname: string, matches: readonly string[]) {
  return matches.some((match) =>
    match === "/" ? pathname === match : pathname === match || pathname.startsWith(`${match}/`),
  );
}

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="-mx-5 mt-2 overflow-x-auto px-5 sm:mx-0 sm:mt-0 sm:px-0"
    >
      <div className="flex min-w-max items-center gap-6 font-medium text-muted-foreground">
      {NAV_ITEMS.map((item) => {
        const isActive = matchesPath(pathname, item.matches);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? `${baseClassName} border-primary font-semibold text-foreground`
                : `${baseClassName} border-transparent hover:border-border hover:text-foreground`
            }
          >
            {item.label}
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
