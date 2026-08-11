import newsData from "@/domains/news/data/news.json";
import newsSourceData from "@/domains/news/data/sources.json";
import type {
  NewsSnapshot,
  NewsSourceId,
  NewsSourceRegistryEntry,
} from "./types";

/** Sole typed access point for the validated News snapshot and Core 11 registry. */
export const newsSnapshot = newsData as NewsSnapshot;
export const newsSources = newsSourceData as NewsSourceRegistryEntry[];
export const newsSourceById = new Map<NewsSourceId, NewsSourceRegistryEntry>(
  newsSources.map((source) => [source.id, source]),
);
