import Link from "next/link";
import type { LatestNewsView } from "@/domains/app/lib/news/read-model";

function pageHref(page: number) {
  return page === 1 ? "/news" : `/news?page=${page}`;
}

type LatestNewsFeedProps = {
  view: LatestNewsView;
  currentPage: number;
  pageCount: number;
};

export function LatestNewsFeed({
  view,
  currentPage,
  pageCount,
}: LatestNewsFeedProps) {
  if (view.stories.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card px-5 py-12 text-center shadow-soft">
        <p className="text-sm text-muted-foreground">
          No recent news is available.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="divide-y divide-border rounded-lg border border-border bg-card shadow-soft">
        {view.stories.map((story) => (
          <article key={story.id} className="p-5 sm:p-6">
            <time
              dateTime={story.publishedAt}
              className="text-xs font-medium text-muted-foreground"
            >
              {story.publishedAt}
            </time>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              {story.headline}
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">
              {story.summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {story.sources.map((source) => (
                <a
                  key={`${source.sourceId}:${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {source.sourceName}: {source.title}
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>

      {pageCount > 1 ? (
        <nav
          aria-label="News pagination"
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {currentPage > 1 ? (
            <Link
              href={pageHref(currentPage - 1)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary"
            >
              Previous
            </Link>
          ) : null}

          {Array.from({ length: pageCount }, (_, index) => index + 1).map(
            (page) => (
              <Link
                key={page}
                href={pageHref(page)}
                aria-current={page === currentPage ? "page" : undefined}
                className={`min-w-10 rounded-md border px-3 py-2 text-center text-sm font-medium ${
                  page === currentPage
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                {page}
              </Link>
            ),
          )}

          {currentPage < pageCount ? (
            <Link
              href={pageHref(currentPage + 1)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
