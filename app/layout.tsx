import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Noto_Sans_KR } from "next/font/google";
import { PrimaryNav } from "@/domains/app/components/PrimaryNav";
import "./globals.css";

// Self-hosted via next/font (built at build time, no runtime CDN request).
// Inter covers Latin glyphs/numerals; Noto Sans KR is the fallback for Korean
// labels (program-table.ts already carries unused `ko` labels). Tailwind's
// `fontFamily.sans` in tailwind.config.ts consumes these CSS variables.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Obesity Landscape",
    template: "%s — Obesity Landscape",
  },
  description:
    "A searchable register of obesity landscape development programs and competitive landscape data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansKr.variable}`}>
      <body className="min-h-screen antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-5 py-4 sm:px-8">
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
                  Obesity landscape pipeline intelligence
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
