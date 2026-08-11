import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const newsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(newsDir, "..", "..");

const expectedSourceIds = [
  "dailypharm",
  "medipana",
  "hitnews",
  "biospectator",
  "yakup",
  "bosa",
  "endpoints",
  "stat",
  "fierce-biotech",
  "biopharma-dive",
  "reuters-healthcare-pharmaceuticals",
];

const categories = new Set([
  "new-candidate",
  "program-status",
  "clinical-study",
  "clinical-results",
  "regulatory",
  "transaction",
]);
const coverageStatuses = new Set(["reviewed", "partially-accessible", "blocked"]);
const reviewStatuses = new Set(["no-change", "review-required", "canonical-updated"]);
const reviewRoutes = new Set(["company-pipeline", "clinical-evidence"]);
const trackingParameters = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNonEmptyString(value, context) {
  assert(typeof value === "string" && value.trim() === value && value.length > 0, `${context} must be a non-empty trimmed string`);
}

function parseDate(value, context) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(value), `${context} must use YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00.000Z`);
  assert(!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value, `${context} must be a real calendar date`);
  return date;
}

function normalizeUrl(value, context) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${context} must be an absolute URL`);
  }
  assert(parsed.protocol === "https:", `${context} must use https`);
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || trackingParameters.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
  parsed.searchParams.sort();
  return parsed.toString();
}

function hostAllowed(hostname, allowedHosts) {
  const normalized = hostname.toLowerCase();
  return allowedHosts.some((allowedHost) =>
    normalized === allowedHost || normalized.endsWith(`.${allowedHost}`),
  );
}

function entityKey(entity) {
  switch (entity.entityType) {
    case "company": return `company:${entity.companyId}`;
    case "asset": return `asset:${entity.companyId}:${entity.assetId}`;
    case "program": return `program:${entity.programId}`;
    case "regimen": return `regimen:${entity.regimenId}`;
    case "study": return `study:${entity.studyId}`;
    default: return `unknown:${JSON.stringify(entity)}`;
  }
}

function validateRegistry() {
  const sources = readJson(path.join(newsDir, "data", "sources.json"));
  assert(Array.isArray(sources), "news source registry must be an array");
  assert(sources.length === expectedSourceIds.length, `news source registry must contain exactly ${expectedSourceIds.length} Core sources`);

  const ids = sources.map((source) => source.id);
  assert(new Set(ids).size === ids.length, "news source registry ids must be unique");
  assert(JSON.stringify([...ids].sort()) === JSON.stringify([...expectedSourceIds].sort()), "news source registry must contain the exact Core 11 source ids");

  const baseUrls = new Set();
  for (const source of sources) {
    const context = `news source ${source.id}`;
    assertNonEmptyString(source.name, `${context}.name`);
    assert(["domestic", "international"].includes(source.region), `${context}.region is invalid`);
    const normalizedBaseUrl = normalizeUrl(source.baseUrl, `${context}.baseUrl`);
    assert(!baseUrls.has(normalizedBaseUrl), `${context}.baseUrl duplicates another source`);
    baseUrls.add(normalizedBaseUrl);
    assert(Array.isArray(source.allowedHosts) && source.allowedHosts.length > 0, `${context}.allowedHosts must be non-empty`);
    assert(new Set(source.allowedHosts).size === source.allowedHosts.length, `${context}.allowedHosts contains duplicates`);
    for (const host of source.allowedHosts) {
      assertNonEmptyString(host, `${context}.allowedHosts[]`);
      assert(host === host.toLowerCase(), `${context}.allowedHosts must be lowercase`);
    }
    assert(hostAllowed(new URL(source.baseUrl).hostname, source.allowedHosts), `${context}.baseUrl host is not allowed`);
  }

  return { sources, sourceById: new Map(sources.map((source) => [source.id, source])) };
}

function loadCanonicalReferences() {
  const generatedDir = path.join(rootDir, "data", "generated");
  const companies = readJson(path.join(generatedDir, "companies.json"));
  const programs = readJson(path.join(generatedDir, "pipeline-programs.json"));
  const regimens = readJson(path.join(generatedDir, "regimens.json"));
  const clinical = readJson(path.join(generatedDir, "clinical-evidence.json"));
  return {
    companyById: new Map(companies.map((record) => [record.id, record])),
    programById: new Map(programs.map((record) => [record.id, record])),
    regimenById: new Map(regimens.map((record) => [record.id, record])),
    studyById: new Map(clinical.studies.map((record) => [record.id, record])),
    assetKeys: new Set(programs.map((record) => `${record.companyId}|${record.assetId}`)),
  };
}

function validateRelatedEntity(entity, context, refs) {
  assert(entity && typeof entity === "object" && !Array.isArray(entity), `${context} must be an object`);
  assertNonEmptyString(entity.companyId, `${context}.companyId`);
  assert(refs.companyById.has(entity.companyId), `${context} references unknown company ${entity.companyId}`);

  if (entity.entityType === "company") return;
  if (entity.entityType === "asset") {
    assertNonEmptyString(entity.assetId, `${context}.assetId`);
    assert(refs.assetKeys.has(`${entity.companyId}|${entity.assetId}`), `${context} references unknown company-local asset`);
    return;
  }
  if (entity.entityType === "program") {
    assertNonEmptyString(entity.assetId, `${context}.assetId`);
    assertNonEmptyString(entity.programId, `${context}.programId`);
    const program = refs.programById.get(entity.programId);
    assert(program, `${context} references unknown Program ${entity.programId}`);
    assert(program.companyId === entity.companyId && program.assetId === entity.assetId, `${context} Program does not match companyId/assetId`);
    return;
  }
  if (entity.entityType === "regimen") {
    assertNonEmptyString(entity.regimenId, `${context}.regimenId`);
    const regimen = refs.regimenById.get(entity.regimenId);
    assert(regimen, `${context} references unknown Regimen ${entity.regimenId}`);
    assert(regimen.companyId === entity.companyId, `${context} Regimen does not match companyId`);
    return;
  }
  if (entity.entityType === "study") {
    assertNonEmptyString(entity.assetId, `${context}.assetId`);
    assertNonEmptyString(entity.studyId, `${context}.studyId`);
    assert(Boolean(entity.programId) !== Boolean(entity.regimenId), `${context} must carry programId xor regimenId`);
    const study = refs.studyById.get(entity.studyId);
    assert(study, `${context} references unknown Study ${entity.studyId}`);
    assert(study.companyId === entity.companyId && study.assetId === entity.assetId, `${context} Study does not match companyId/assetId`);
    assert(study.programId === entity.programId && study.regimenId === entity.regimenId, `${context} Study focal mapping does not match canonical data`);
    return;
  }
  throw new Error(`${context}.entityType is invalid`);
}

function validateSnapshotData(snapshot, registry, refs) {
  assert(snapshot.schemaVersion === "1.0", "news.schemaVersion must be 1.0");
  assert(snapshot.windowDays === 30, "news.windowDays must be 30");
  const asOf = parseDate(snapshot.asOf, "news.asOf");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  assert(asOf <= today, "news.asOf cannot be in the future");
  const windowStart = new Date(asOf);
  windowStart.setUTCDate(windowStart.getUTCDate() - 29);

  assert(Array.isArray(snapshot.coverage), "news.coverage must be an array");
  assert(snapshot.coverage.length === expectedSourceIds.length, `news.coverage must contain exactly ${expectedSourceIds.length} entries`);
  const coverageIds = snapshot.coverage.map((entry) => entry.sourceId);
  assert(new Set(coverageIds).size === coverageIds.length, "news.coverage source ids must be unique");
  assert(JSON.stringify([...coverageIds].sort()) === JSON.stringify([...expectedSourceIds].sort()), "news.coverage must cover the exact Core 11 registry");
  for (const entry of snapshot.coverage) {
    assert(registry.sourceById.has(entry.sourceId), `news.coverage references unknown source ${entry.sourceId}`);
    assert(entry.checkedAt === snapshot.asOf, `news.coverage ${entry.sourceId}.checkedAt must equal news.asOf`);
    assert(coverageStatuses.has(entry.status), `news.coverage ${entry.sourceId}.status is invalid`);
    if (entry.status === "reviewed") {
      assert(entry.note === undefined, `news.coverage ${entry.sourceId}.note is forbidden when reviewed`);
    } else {
      assertNonEmptyString(entry.note, `news.coverage ${entry.sourceId}.note`);
    }
  }

  assert(Array.isArray(snapshot.stories), "news.stories must be an array");
  const storyIds = new Set();
  const normalizedUrlStories = new Map();
  for (const [storyIndex, story] of snapshot.stories.entries()) {
    const context = `news.stories[${storyIndex}]`;
    assertNonEmptyString(story.id, `${context}.id`);
    assert(/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story.id), `${context}.id has invalid format`);
    assert(!storyIds.has(story.id), `${context}.id duplicates ${story.id}`);
    storyIds.add(story.id);
    assertNonEmptyString(story.headline, `${context}.headline`);
    assertNonEmptyString(story.summary, `${context}.summary`);
    assert(story.summary.length <= 500, `${context}.summary exceeds 500 characters`);
    assert(!/<[^>]+>/.test(story.summary), `${context}.summary must be plain text`);
    assert(/[가-힣]/.test(story.summary), `${context}.summary must be authored in Korean`);
    assert(categories.has(story.category), `${context}.category is invalid`);
    const publishedAt = parseDate(story.publishedAt, `${context}.publishedAt`);
    assert(story.id.startsWith(`${story.publishedAt}-`), `${context}.id must start with publishedAt`);
    assert(publishedAt >= windowStart && publishedAt <= asOf, `${context}.publishedAt falls outside the 30-day snapshot window`);

    assert(Array.isArray(story.sources) && story.sources.length > 0, `${context}.sources must be non-empty`);
    const storyUrls = new Set();
    for (const [sourceIndex, source] of story.sources.entries()) {
      const sourceContext = `${context}.sources[${sourceIndex}]`;
      const registrySource = registry.sourceById.get(source.sourceId);
      assert(registrySource, `${sourceContext}.sourceId is not in the Core 11 registry`);
      assertNonEmptyString(source.title, `${sourceContext}.title`);
      const sourcePublishedAt = parseDate(source.publishedAt, `${sourceContext}.publishedAt`);
      assert(sourcePublishedAt >= windowStart && sourcePublishedAt <= asOf, `${sourceContext}.publishedAt falls outside the snapshot window`);
      assert(source.checkedAt === snapshot.asOf, `${sourceContext}.checkedAt must equal news.asOf`);
      assert(["full", "partial"].includes(source.contentAccess), `${sourceContext}.contentAccess is invalid`);
      const normalizedUrl = normalizeUrl(source.url, `${sourceContext}.url`);
      assert(hostAllowed(new URL(source.url).hostname, registrySource.allowedHosts), `${sourceContext}.url host is not allowed for ${source.sourceId}`);
      assert(!storyUrls.has(normalizedUrl), `${sourceContext}.url duplicates another source in the same Story`);
      storyUrls.add(normalizedUrl);
      const owners = normalizedUrlStories.get(normalizedUrl) ?? [];
      owners.push(story.id);
      normalizedUrlStories.set(normalizedUrl, owners);
    }

    assert(Array.isArray(story.relatedEntities), `${context}.relatedEntities must be an array`);
    const entityKeys = new Set();
    for (const [entityIndex, entity] of story.relatedEntities.entries()) {
      validateRelatedEntity(entity, `${context}.relatedEntities[${entityIndex}]`, refs);
      const key = entityKey(entity);
      assert(!entityKeys.has(key), `${context}.relatedEntities contains duplicate ${key}`);
      entityKeys.add(key);
    }

    const review = story.canonicalReview;
    assert(review && typeof review === "object", `${context}.canonicalReview is required`);
    assert(reviewStatuses.has(review.status), `${context}.canonicalReview.status is invalid`);
    const reviewedAt = parseDate(review.reviewedAt, `${context}.canonicalReview.reviewedAt`);
    assert(reviewedAt >= publishedAt, `${context}.canonicalReview.reviewedAt cannot precede the Story`);
    assert(reviewedAt <= asOf, `${context}.canonicalReview.reviewedAt cannot be after news.asOf`);
    if (review.status === "no-change") {
      assert(review.route === undefined, `${context}.canonicalReview.route is forbidden for no-change`);
    } else {
      assert(reviewRoutes.has(review.route), `${context}.canonicalReview.route is required for ${review.status}`);
    }
    if (review.status === "canonical-updated") {
      assert(story.relatedEntities.length > 0, `${context}.canonical-updated requires relatedEntities`);
    }
  }

  const expectedOrder = [...snapshot.stories].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id),
  );
  assert(snapshot.stories.every((story, index) => story.id === expectedOrder[index].id), "news.stories must be sorted by publishedAt descending, then id ascending");

  return { snapshot, normalizedUrlStories };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectFailure(name, snapshot, registry, refs, expectedMessage) {
  try {
    validateSnapshotData(snapshot, registry, refs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(expectedMessage), `${name} failed for the wrong reason: ${message}`);
    return;
  }
  throw new Error(`${name} unexpectedly passed validation`);
}

function makeSyntheticSnapshot(registry) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    schemaVersion: "1.0",
    asOf: today,
    windowDays: 30,
    coverage: registry.sources.map((source) => ({
      sourceId: source.id,
      checkedAt: today,
      status: "reviewed",
    })),
    stories: [
      {
        id: `${today}-synthetic-story`,
        headline: "Synthetic News validation Story",
        summary: "News 계약을 검증하기 위한 합성 테스트 요약이다.",
        category: "program-status",
        publishedAt: today,
        sources: [
          {
            sourceId: "dailypharm",
            url: "https://www.dailypharm.com/synthetic-news-validation",
            title: "Synthetic source article",
            publishedAt: today,
            checkedAt: today,
            contentAccess: "full",
          },
        ],
        relatedEntities: [{ entityType: "company", companyId: "amgen" }],
        canonicalReview: { status: "no-change", reviewedAt: today },
      },
    ],
  };
}

function runSelfTests(registry, refs) {
  const baseline = makeSyntheticSnapshot(registry);
  const future = clone(baseline);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  future.asOf = tomorrow.toISOString().slice(0, 10);
  expectFailure("future asOf fixture", future, registry, refs, "cannot be in the future");

  const outsideWindow = clone(baseline);
  outsideWindow.stories[0].id = "2000-01-01-outside-window";
  outsideWindow.stories[0].publishedAt = "2000-01-01";
  expectFailure("outside-window fixture", outsideWindow, registry, refs, "falls outside the 30-day snapshot window");

  const duplicateWithinStory = clone(baseline);
  duplicateWithinStory.stories[0].sources.push(clone(duplicateWithinStory.stories[0].sources[0]));
  expectFailure("same-Story duplicate URL fixture", duplicateWithinStory, registry, refs, "duplicates another source in the same Story");

  const nonKoreanSummary = clone(baseline);
  nonKoreanSummary.stories[0].summary = "English-only synthetic summary.";
  expectFailure("non-Korean summary fixture", nonKoreanSummary, registry, refs, "must be authored in Korean");

  const unknownEntity = clone(baseline);
  unknownEntity.stories[0].relatedEntities[0].companyId = "unknown-company";
  expectFailure("unknown related entity fixture", unknownEntity, registry, refs, "references unknown company");

  const updatedWithoutEntity = clone(baseline);
  updatedWithoutEntity.stories[0].canonicalReview.status = "canonical-updated";
  updatedWithoutEntity.stories[0].canonicalReview.route = "company-pipeline";
  updatedWithoutEntity.stories[0].relatedEntities = [];
  expectFailure("canonical-updated fixture", updatedWithoutEntity, registry, refs, "canonical-updated requires relatedEntities");

  const crossStoryOverlap = clone(baseline);
  const secondStory = clone(crossStoryOverlap.stories[0]);
  secondStory.id = `${secondStory.publishedAt}-separate-material-development`;
  secondStory.headline = "Separate material development using the same article";
  crossStoryOverlap.stories.push(secondStory);
  crossStoryOverlap.stories.sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id),
  );
  const result = validateSnapshotData(crossStoryOverlap, registry, refs);
  const overlaps = [...result.normalizedUrlStories.values()].filter(
    (stories) => new Set(stories).size > 1,
  );
  assert(overlaps.length === 1, "cross-Story duplicate URL fixture must remain a non-failing overlap candidate");

  console.log("Validated 7 synthetic News contract scenarios.");
}

function run() {
  const command = process.argv[2] ?? "validate";
  const registry = validateRegistry();
  const refs = loadCanonicalReferences();
  const snapshotData = readJson(path.join(newsDir, "data", "news.json"));
  const { snapshot, normalizedUrlStories } = validateSnapshotData(snapshotData, registry, refs);

  if (command === "validate") {
    const blocked = snapshot.coverage.filter((entry) => entry.status !== "reviewed").length;
    console.log(`Validated News snapshot with ${registry.sources.length} Core sources, ${snapshot.stories.length} Stories, and ${blocked === 0 ? "FULL" : "PARTIAL"} coverage (${blocked} source access issue(s)).`);
    return;
  }
  if (command === "probe-overlap") {
    const overlaps = [...normalizedUrlStories.entries()].filter(([, stories]) => new Set(stories).size > 1);
    if (overlaps.length === 0) {
      console.log("News source-overlap probe: no cross-Story URL overlap candidates.");
      return;
    }
    console.log(`News source-overlap probe: ${overlaps.length} review candidate(s).`);
    for (const [url, stories] of overlaps) console.log(`- ${url}: ${[...new Set(stories)].join(", ")}`);
    return;
  }
  if (command === "self-test") {
    runSelfTests(registry, refs);
    return;
  }
  throw new Error(`Unknown News data command: ${command}`);
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
