import type { Metadata } from "next";
import { LatestNewsFeed } from "@/domains/app/components/news/LatestNewsFeed";
import { getLatestNewsView } from "@/domains/app/lib/news/read-model";

export const metadata: Metadata = {
  title: "Latest News",
  description: "Recent developments in the obesity treatment landscape.",
};

const NEWS_PER_PAGE = 10;

type NewsPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

function parsePage(value: string | string[] | undefined, pageCount: number) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^\d+$/.test(candidate)) return 1;
  const page = Number(candidate);
  return page >= 1 && page <= pageCount ? page : 1;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const view = getLatestNewsView();
  const pageCount = Math.max(1, Math.ceil(view.stories.length / NEWS_PER_PAGE));
  const params = await searchParams;
  const currentPage = parsePage(params.page, pageCount);
  const start = (currentPage - 1) * NEWS_PER_PAGE;
  const pagedView = {
    stories: view.stories.slice(start, start + NEWS_PER_PAGE),
  };

  return (
    <div className="max-w-7xl space-y-6 pb-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Media discovery
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Latest News
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Recent developments in obesity treatments, clinical studies, and the companies behind them.
        </p>
      </section>
      <LatestNewsFeed
        view={pagedView}
        currentPage={currentPage}
        pageCount={pageCount}
      />
    </div>
  );
}
