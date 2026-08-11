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

## 2. Review Core 9

Attempt every registered source over the discovery interval established above.
Search its accessible publication surface for obesity, weight management,
GLP-1, incretin, amylin, relevant clinical, regulatory, and transaction
developments. Reverse-search surfaced companies, assets, development codes,
and aliases. A named-company request narrows the Story output but does not
permit an unreported Core-source coverage result.

Review the Core sources sequentially in source-registry order. Complete one
source before beginning editorial review of the next; do not interleave
candidate assessment across publications. A source is complete only after the
run has recorded, in the in-session working manifest:

- the official listings and relevant sections checked;
- the first and last publication dates reached for the discovery interval;
- each surfaced candidate and its provisional scope or access disposition;
- whether sufficient official article content was opened; and
- the source-level `reviewed`, `partially-accessible`, or `blocked` result.

Within the active source, listing pages may be fetched with conservative,
bounded concurrency. This is a collection optimization and does not change the
source-by-source editorial completion boundary. Perform cross-source Story
grouping and duplicate resolution only after every Core source has reached a
recorded completion result.

Treat general search engines as candidate-discovery aids, not as proof that a
source was fully reviewed. For each Core source, first traverse its official
latest or all-articles listing and every relevant section through the discovery
interval boundary, then use external discovery to find possible gaps and
reverse-search aliases. For Yakup this includes at least the
pharmaceutical/biotech and global sections. Re-check each source-native latest
listing at the end of a same-day run to catch articles not yet indexed
externally.

Record each source exactly once as `reviewed`, `partially-accessible`, or
`blocked`. Do not report a blocked source as having no relevant coverage. A
Story requires accessible article content that directly supports its headline
and summary; a paywall headline or search snippet alone is insufficient.
Record `reviewed` only after the required source-native listings and sections
were checked through the interval; an unchecked relevant section requires
`partially-accessible` even when other pages were reachable.

### Access verification and permitted fallbacks

Do not classify a source from one connector, parser, or HTTP failure. Before
recording an access issue, distinguish the publication's response from a local
tool failure and try at least two permitted routes when they exist:

1. retry the official article or publication index with the installed Chrome
   engine, with JavaScript, cookies, redirects, and normal page rendering
   enabled;
2. inspect the publication's official RSS feed, news sitemap, or sitemap for
   candidate discovery; and
3. use a legitimate free account or documented public API only within its
   published access limits.

TLS trust-store errors, connector `Internal Error` responses, parsing failures,
and a response that changes only with the connector's user agent are tool or
route failures, not proof that the publication is unavailable. Record
`blocked` only when neither the official publication surface nor a permitted
fallback yields usable discovery or article content. Record
`partially-accessible` when candidates can be discovered but supporting article
content cannot be reviewed consistently. Record `reviewed` when the applicable
interval was fully checked through permitted official routes, even if the
primary connector failed.

RSS and sitemap metadata may discover candidates, but a title, date, URL, or
short feed excerpt does not by itself support a Story. Open sufficient official
article content before entry. Never evade a paywall, CAPTCHA, robots policy, or
publisher access control; do not rotate or impersonate user agents, disable TLS
verification, or store a syndicated copy as though it were the registered Core
publication.

Known official fallback routes are:

| Source | Free permitted route | Boundary |
| --- | --- | --- |
| HitNews | official sitemap and normal browser article pages | no public article API is verified |
| Bosa | official sitemap and normal browser article pages | no public article API is verified |
| Yakup | retry the direct official article page | a connector error alone is not an access restriction |

Re-check these routes when their behavior changes; they are operational
fallbacks, not guarantees of future access.

Endpoints News RSS/news-sitemap metadata and the Reuters news sitemap may be
checked opportunistically as non-Core discovery leads. Do not create coverage
entries or store their URLs as Story sources. A surfaced development enters the
snapshot only when an accessible registered Core article independently supports
it; otherwise omit it for insufficient supporting access.

#### Browser-assisted review

After a connector failure, an actual Chrome-rendered review is the preferred
second route. A browser-assisted crawler may traverse official listing, search,
RSS, or sitemap candidate URLs within the run's discovery interval and extract
only the title, publication date, URL, and article text needed for editorial
review. Keep concurrency and request frequency conservative, remain on the
registered Core host, and do not persist profiles, cookies, screenshots, or
article bodies in the repository.

An HTTP request carrying a browser-like user agent is not a browser check.
Likewise, a successful homepage render does not prove that the source interval
was reviewed: open the relevant listing and candidate article bodies before
recording `reviewed`. Apply these outcomes:

- Chrome renders the applicable pages and the interval is checked: record
  `reviewed`; the connector failure was a false positive.
- Headless Chrome is rejected but ordinary interactive Chrome works: complete
  the review interactively or record `partially-accessible` if the interval
  remains incomplete.
- Chrome reaches a CAPTCHA, device-verification page, paywall, or publisher
  denial: do not automate around it. Use permitted RSS or sitemap metadata for
  discovery and record `partially-accessible` when article bodies remain
  unavailable, or `blocked` when even candidate discovery is unavailable.

Use a fresh temporary browser profile for an automated run. Do not reuse a
person's signed-in profile or credentials unless that account-based review was
explicitly authorized, and never treat access granted to one profile as a
public API guarantee.

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
