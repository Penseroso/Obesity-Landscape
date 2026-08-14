import Link from "next/link";
import { buttonVariants } from "@/domains/app/components/ui/Button";
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
      <section className="border-y border-border py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No recent news is available.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="divide-y divide-border border-y border-border">
        {view.stories.map((story) => (
          <article
            key={story.id}
            className="grid gap-2 py-5 md:grid-cols-[7rem_minmax(0,1fr)] md:gap-6 md:py-6"
          >
            <time
              dateTime={story.publishedAt}
              className="pt-0.5 text-xs font-medium tabular-nums text-muted-foreground"
            >
              {story.publishedAt}
            </time>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-7 tracking-tight text-foreground">
                {story.headline}
              </h2>
              <p className="mt-2 max-w-5xl text-sm leading-6 text-muted-foreground">
                {story.summary}
              </p>
              <div className="mt-3 flex flex-col items-start gap-1.5">
                {story.sources.map((source) => (
                  <a
                    key={`${source.sourceId}:${source.url}`}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs leading-5 text-muted-foreground underline-offset-2 hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="font-semibold text-foreground">
                      {source.sourceName}
                    </span>
                    {`: ${source.title} `}
                    <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
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
              className={buttonVariants({ variant: "ghost", size: "sm" })}
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
                className={buttonVariants({
                  variant: page === currentPage ? "primary" : "ghost",
                  size: "sm",
                  className: "min-w-9 px-2",
                })}
              >
                {page}
              </Link>
            ),
          )}

          {currentPage < pageCount ? (
            <Link
              href={pageHref(currentPage + 1)}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
