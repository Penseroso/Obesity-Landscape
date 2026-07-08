import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Obesity Landscape",
  description: "Frontend skeleton for obesity/incretin competitive programs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-4 sm:px-8">
          <header className="mb-6 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                OL
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-wide text-foreground">
                  Obesity Landscape
                </span>
                <span className="block text-xs text-muted-foreground">
                  Biopharma pipeline intelligence
                </span>
              </span>
            </Link>
            <nav className="flex gap-2 text-sm font-medium text-muted-foreground">
              <Link
                href="/"
                className="rounded-md px-3 py-2 transition hover:bg-muted hover:text-foreground"
              >
                Overview
              </Link>
              <Link
                href="/assets"
                className="rounded-md px-3 py-2 transition hover:bg-muted hover:text-foreground"
              >
                Programs
              </Link>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
