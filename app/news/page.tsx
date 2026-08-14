import type { Metadata } from "next";
import { LatestNewsFeed } from "@/domains/app/components/news/LatestNewsFeed";
import { PageHeading } from "@/domains/app/components/ui/PageHeading";
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
      <PageHeading
        title="Latest News"
        description="Recent developments in obesity treatments, clinical studies, and the companies behind them."
      />
      <LatestNewsFeed
        view={pagedView}
        currentPage={currentPage}
        pageCount={pageCount}
      />
    </div>
  );
}
