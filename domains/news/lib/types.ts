export const NEWS_SCHEMA_VERSION = "1.0" as const;
export const NEWS_WINDOW_DAYS = 30 as const;

export const NEWS_SOURCE_IDS = [
  "dailypharm",
  "medipana",
  "hitnews",
  "biospectator",
  "yakup",
  "bosa",
  "stat",
  "fierce-biotech",
  "biopharma-dive",
] as const;

export type NewsSourceId = (typeof NEWS_SOURCE_IDS)[number];
export type NewsRegion = "domestic" | "international";

export type NewsSourceRegistryEntry = {
  id: NewsSourceId;
  name: string;
  region: NewsRegion;
  baseUrl: string;
  allowedHosts: string[];
};

export type NewsSourceCoverage = {
  sourceId: NewsSourceId;
  checkedAt: string;
  status: "reviewed" | "partially-accessible" | "blocked";
  note?: string;
};

export type NewsArticleReference = {
  sourceId: NewsSourceId;
  url: string;
  title: string;
  publishedAt: string;
  checkedAt: string;
  contentAccess: "full" | "partial";
};

export type NewsRelatedEntity =
  | { entityType: "company"; companyId: string }
  | { entityType: "asset"; companyId: string; assetId: string }
  | {
      entityType: "program";
      companyId: string;
      assetId: string;
      programId: string;
    }
  | { entityType: "regimen"; companyId: string; regimenId: string }
  | {
      entityType: "study";
      companyId: string;
      assetId: string;
      studyId: string;
      programId?: string;
      regimenId?: string;
    };

export type NewsStoryCategory =
  | "new-candidate"
  | "program-status"
  | "clinical-study"
  | "clinical-results"
  | "regulatory"
  | "transaction";

export type NewsCanonicalReview = {
  status: "no-change" | "review-required" | "canonical-updated";
  route?: "company-pipeline" | "clinical-evidence";
  reviewedAt: string;
};

export type NewsStory = {
  id: string;
  headline: string;
  summary: string;
  category: NewsStoryCategory;
  publishedAt: string;
  sources: NewsArticleReference[];
  relatedEntities: NewsRelatedEntity[];
  canonicalReview: NewsCanonicalReview;
};

export type NewsSnapshot = {
  schemaVersion: typeof NEWS_SCHEMA_VERSION;
  asOf: string;
  windowDays: typeof NEWS_WINDOW_DAYS;
  coverage: NewsSourceCoverage[];
  stories: NewsStory[];
};
