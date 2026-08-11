---
role: news-research-workflow
status: active
authority: authoritative
update-boundary: Update when Core-source discovery, review, retention, validation, or reporting procedure changes.
---

# Latest News Research Workflow

Executable workflow for a repository-wide or named-company Latest News
request. News research changes only `domains/news/data/news.json`; it never
changes Company/Pipeline or Clinical Evidence operating or generated data.

## 1. Establish the run

1. Read the [News Data Contract](./README.md), source registry, current
   snapshot, and current generated canonical manifests used for optional
   `relatedEntities` resolution.
2. Set the new `asOf` to the actual review date and compute the retention
   window from `asOf - 29 days` through `asOf`, inclusive.
3. Use the stored snapshot `asOf` as the last completed refresh checkpoint,
   never a date mentioned only in conversation. For an ordinary refresh,
   search from two calendar days before that checkpoint through the new
   `asOf`, inclusive. The overlap absorbs publication-time, timezone, and
   indexing delays; already stored coverage is merged rather than duplicated.
   Do not backdate a snapshot: a requested `asOf` earlier than the checkpoint
   stops the run as invalid.
4. Search the full current 30-day retention window instead when there is no
   prior snapshot, the checkpoint is 30 or more days old, or the discovery
   method or Core registry changed materially. For a source previously marked
   `blocked` or `partially-accessible`, search that source's full remaining
   30-day window when access becomes available again.
5. Preserve the pre-run canonical diff and do not run canonical generation as
   part of News research.

## 2. Review Core 11

Attempt every registered source over the discovery interval established above.
Search its accessible publication surface for obesity, weight management,
GLP-1, incretin, amylin, relevant clinical, regulatory, and transaction
developments. Reverse-search surfaced companies, assets, development codes,
and aliases. A named-company request narrows the Story output but does not
permit an unreported Core-source coverage result.

Record each source exactly once as `reviewed`, `partially-accessible`, or
`blocked`. Do not report a blocked source as having no relevant coverage. A
Story requires accessible article content that directly supports its headline
and summary; a paywall headline or search snippet alone is insufficient.

Classify each surfaced item as entered, merged with another Story, outside
scope, or omitted for insufficient access. Keep this manifest in-session only.

## 3. Author and connect

Group coverage of the same material development into one Story with multiple
sources. When one article independently covers two material developments,
separate Stories may cite the same URL; the overlap probe will require review.

Write every Story `summary` in Korean, including Stories sourced from
international publications. Preserve the meaning of proper nouns, development
codes, trial names, figures, and units, and do not introduce interpretation or
judgment absent from the source. Keep each article `title` in its original
language.

Resolve related canonical entities only from explicit stored IDs. Do not infer
a Program or Study mapping from an article title, company name, asset name, or
URL. A new candidate remains unlinked and routes to Company/Pipeline review.

Set canonical review status as follows:

- `no-change`: no canonical follow-up is indicated;
- `review-required`: a separate canonical execution is indicated and `route`
  names it;
- `canonical-updated`: a prior separate canonical execution completed and at
  least one `relatedEntities` reference identifies its result.

News never performs the routed canonical execution and existing canonical
workflows do not read News in v1.

## 4. Retain, validate, and report

Merge retained Stories with newly discovered coverage, remove Stories outside
the new 30-day window, sort the remainder, and run:

```text
npm run data:validate:news
npm run data:validate:news:synthetic
npm run data:probe:news-source-overlap
npm run data:validate:company-pipeline:manifest
npm run data:validate:clinical-evidence:generated
npm run lint
npm run build
git diff --check
```

Report the window, Core-source access status, entered and merged Stories,
overlap candidates and decisions, expiring `review-required` Stories, canonical
routes, validation results, and confirmation that canonical data did not
change. Completion is `FULL` when every Core source was reviewed and `PARTIAL`
when at least one was partially accessible or blocked.
