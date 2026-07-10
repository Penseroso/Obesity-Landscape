import type { Metadata } from "next";
import Link from "next/link";
import { PrimaryNav } from "@/components/PrimaryNav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Obesity Landscape",
    template: "%s — Obesity Landscape",
  },
  description:
    "A searchable register of obesity/incretin development programs and competitive landscape data.",
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
            <Link
              href="/"
              className="flex items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-primary text-sm font-semibold text-primary-foreground">
                OL
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-wide text-foreground">
                  Obesity Landscape
                </span>
                <span className="block text-xs text-muted-foreground">
                  Obesity/incretin pipeline intelligence
                </span>
              </span>
            </Link>
            <PrimaryNav />
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
