---
role: news-data-contract
status: active
authority: authoritative
update-boundary: Update when News scope, source registry, snapshot fields, retention, references, or source semantics change.
---

# News Data Contract

News is a non-canonical media discovery surface for recent developments in the
obesity landscape. It does not own Company, Asset, Program, Regimen, Study, or
Event state and is not an evidence source for either canonical data domain.

## Scope and sources

News v1 reviews exactly the Core 11 publications registered in
`domains/news/data/sources.json`: six domestic and five international media
outlets. A stored article must use a registry `sourceId` and an article URL on
that source's allowed host. Search results and non-Core publications may help
locate a Core article but are not stored as News sources.

Include a material development concerning an obesity-landscape candidate:
new-candidate disclosure, program status, clinical study or results,
regulatory action, or transaction. Exclude general health policy, pricing,
prescription-market, sales, stock-price, executive-personnel, and commentary
items that do not change one of those development subjects.

Paywall metadata, a headline, or a search snippet alone cannot support a Story.
At least one stored source must expose enough article content to support the
Story headline and editor-authored summary. Store no article body or copied
snippet.

## Snapshot and retention

`domains/news/data/news.json` is the single validated current snapshot and the
authoritative News input. It is read through `domains/news/lib/data.ts`; UI
code never imports it directly. There is no generated copy because v1 has no
multi-file aggregation or projection.

The snapshot declares `schemaVersion: "1.0"`, an `asOf` date, fixed
`windowDays: 30`, one coverage result for each Core source, and Stories sorted
by publication date descending then id ascending. The active window contains
the 30 calendar dates from `asOf - 29 days` through `asOf`, inclusive. Expired
Stories are deleted, not moved to an archive or deferred ledger. Git history
is incidental and is not a supported News archive.

The 30-day retention window is not the ordinary discovery interval. Routine
refreshes search incrementally from two calendar days before the prior stored
`asOf` through the new `asOf`, then merge with retained Stories. Initial runs,
gaps of 30 days or more, material discovery-method changes, and sources
recovering from access issues require the broader searches defined by the
research workflow.

Coverage is `FULL` only when all Core sources are `reviewed`. A
`partially-accessible` or `blocked` source makes it `PARTIAL`; failure to reach
a source is never evidence that it published no relevant article. Every access
issue carries a short `note`; a fully reviewed source does not.

## Story and source semantics

A Story is a transient editorial grouping of one material development, never a
canonical Event. Its `summary` is plain editor-authored text of at most 500
characters. Every summary is authored in Korean regardless of the source
language. Proper nouns, development codes, trial names, figures, and units
retain their source meaning; the summary adds no interpretation or judgment
that the source does not support. Article `title` values remain in their
original language. Categories are closed to `new-candidate`, `program-status`,
`clinical-study`, `clinical-results`, `regulatory`, and `transaction`.

Within a Story, normalized source URLs must be unique. The same URL may appear
in different Stories when one article directly covers separate material
developments. The advisory overlap probe reports that case for human review:
merge the Stories when they describe the same development, or retain them when
the developments are genuinely distinct.

`relatedEntities` is a discriminated reference union for Company, Asset,
Program, Regimen, and Study. Every supplied id and composite mapping must match
the checked-out generated canonical manifests. A genuinely new candidate may
have no related entity yet.

`canonicalReview.status` is `no-change`, `review-required`, or
`canonical-updated`. A review-required or updated Story identifies the target
route (`company-pipeline` or `clinical-evidence`); an updated Story also names
at least one related entity. These values are handoff and display metadata.
Canonical research must reopen and evaluate the underlying evidence under its
own contract and never treat News co-location, summary, or media URL as claim
provenance.

## Consumer boundary

The `/news` UI is intentionally lightweight. It displays only each Story's
publication date, headline, short summary, and source links. Category,
coverage-completeness, access issues, canonical review state, and related entity
references remain operator metadata and are not consumer-facing. The UI must
not infer missing canonical facts or mutate canonical records.
