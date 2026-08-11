import {
  newsSnapshot,
  newsSourceById,
} from "@/domains/news/lib/data";
import type {
  NewsArticleReference,
} from "@/domains/news/lib/types";

export type NewsArticleView = NewsArticleReference & {
  sourceName: string;
};

export type NewsStoryView = {
  id: string;
  headline: string;
  summary: string;
  publishedAt: string;
  sources: NewsArticleView[];
};

export type LatestNewsView = {
  stories: NewsStoryView[];
};

export function getLatestNewsView(): LatestNewsView {
  const stories = newsSnapshot.stories.map<NewsStoryView>((story) => ({
    id: story.id,
    headline: story.headline,
    summary: story.summary,
    publishedAt: story.publishedAt,
    sources: story.sources.map((source) => {
      const registrySource = newsSourceById.get(source.sourceId);
      if (!registrySource) {
        throw new Error(`News Story ${story.id} references unknown source ${source.sourceId}`);
      }
      return { ...source, sourceName: registrySource.name };
    }),
  }));

  return { stories };
}
