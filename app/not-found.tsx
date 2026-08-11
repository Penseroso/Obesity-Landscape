import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        This page could not be found.
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The company, asset, or study you&rsquo;re looking for doesn&rsquo;t
        exist or may have moved.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/"
          className="rounded-md border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Go to Overview
        </Link>
        <Link
          href="/assets"
          className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Go to Program Register
        </Link>
      </div>
    </div>
  );
}
