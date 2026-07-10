"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/assets", label: "Program Register" },
] as const;

const baseClassName =
  "rounded-md px-3 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 text-sm font-medium text-muted-foreground">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? `${baseClassName} bg-muted font-semibold text-foreground`
                : `${baseClassName} hover:bg-muted hover:text-foreground`
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
