---
role: ui-reference
status: active
authority: authoritative
update-boundary: Update when routes, read-model boundaries, user-visible data semantics, or standing UI validation requirements change; not for routine styling edits.
---

# UI Reference

Canonical reference for the current UI surface and its data-consumption
boundaries. Historical UI audits are not part of the implementation path.

## Routes and ownership

| Route | Primary responsibility |
| --- | --- |
| `/` | Portfolio overview and summary views |
| `/assets` | Searchable/filterable program register |
| `/efficacy-comparison` | Reported body-weight reduction by mechanism family |
| `/news` | Rolling reviewed media discovery from the News Core 11 |
| `/companies/[companyId]` | Company detail and associated clinical inventory |
| `/assets/[companyId]/[assetId]` | Focal and linked studies for an asset |
| `/studies/[studyId]` | Study, arms, endpoints, outcomes, and source detail |

The global shell uses a text-only `Obesity Landscape` wordmark and a static,
underline-style primary navigation. On mobile the navigation remains one row
inside its own horizontal scroll container. `/assets`, `/companies/*`, and
`/studies/*` share the Program Register active state; the other primary routes
activate only their own entry.

`app/` owns routing and page composition; it is root-pinned for the current
Next.js architecture and this migration program (Module 6 resolved D6 — the
App Router only resolves `app/` at the repository root or under `src/`, and
no config repoints it under a domain root; a future framework-level
restructure could revisit this, but no later move-only module may relocate
`app/`). `domains/app/components/` owns presentation and interaction.
`domains/company-pipeline/lib/` owns the Company/Pipeline read model;
`domains/clinical-evidence/lib/` owns Clinical Evidence types and loading. The
Application read-model tier — `domains/app/lib/company-detail/read-model.ts`
(cross-domain company composition) and
`domains/app/lib/clinical-evidence/selectors.ts` (Clinical Evidence read
model) — moved here in Module 6. `domains/app/config/program-table.ts` and
`domains/app/lib/format.ts` are likewise canonical. Module 9 removed the legacy
`components/`, `config/`, `lib/format.ts`, and read-model compatibility shims;
consumers import the canonical paths directly. Components must not read editable
source JSON directly.

Within `domains/app/`, files import each other and the read-model tier
through canonical `@/domains/app/...` paths. Imports into Company/Pipeline-owned
code resolve through the canonical `@/domains/company-pipeline/lib/*` paths
(Module 9 removed the former `@/lib/programs/*` shims).
`domains/app/lib/clinical-evidence/selectors.ts` reads Clinical Evidence data
through the canonical `@/domains/clinical-evidence/lib/data` loader; Module 9
repointed this dependency off the former `@/lib/clinical-evidence/data` shim and
rewrote the `eslint.config.mjs` boundary against canonical paths, preserving the
ADR semantics: only the canonical loader imports the generated Clinical Evidence
JSON, and only these canonical selectors import that loader.

## Data boundaries

- UI reads generated artifacts through typed loaders and selectors.
- News is the deliberate exception to the generated-artifact rule: `/news`
  reads the validated `domains/news/data/news.json` snapshot through its sole
  typed loader. The consumer surface shows only Story date, headline, summary,
  and source links; operational review and coverage metadata stays internal.
- `/news` presents Stories in stored newest-first order, at most 10 per page.
  Additional pages use shareable `?page=N` URLs and ordinary numbered,
  previous, and next navigation; pagination is hidden when there are 10 or
  fewer Stories. Invalid or out-of-range page values resolve to page 1. This is
  a UI policy and does not change News retention or source data.
- Program-specific clinical retrieval uses explicit `Study.programId`; it does
  not infer a relationship from asset, indication, title, or source URL.
- Asset views may use the generated focal/linked asset-study projection. Focal
  versus linked is the top-level split. **Inside** each relation, Studies group by
  the authored `studyFamily` only; a Study without one is unclassified and renders
  in a trailing "Other studies" group. Family is never inferred from an acronym or
  title, and the family name appears in the group header only.
- Asset Studies exposes that projection through URL-synchronised presentation
  controls: `scope=linked` selects linked evidence (focal is the default and is
  omitted), while `family=<authored family>` selects one family within the active
  scope. `family=__unclassified` addresses the "Other studies" group. Invalid or
  unavailable values fall back to focal/all families; these controls filter only
  the already-returned projection and never change its membership or ordering.
- The Program (or regimen) mapping stays explicit and is displayed as per-row
  metadata — route, dosage form, dosing interval, or the regimen name — rather than
  as the grouping boundary. It is still never inferred from asset, indication,
  title, comparator links, or source URLs.
- The Asset Studies list is a comparison table: Study, Phase, Population, Treatment,
  Duration, Primary finding. Registry status is not shown there. Primary finding is
  **deterministic selection, never calculation**: the highest-ranked endpoint role
  that carries a recorded Outcome, then one comparison group and family within it,
  rendered as stored `result.value` text for stored anchors. A Study with no recorded
  Outcome renders an italic "Not reported".
- The read model returns **every comparison group** of the selected endpoint, in curated
  source order, never merging groups that differ by analysis population, estimand, or
  cohort, and never dropping one for being one too many to show. Comparison-group
  boundaries come from the canonicalization shared with the validator
  (`domains/clinical-evidence/lib/clinical-term-canonicalization.mjs`), so both sides
  draw the same boundary.
- **Showing at most three groups per row is a presentation policy of the Asset Clinical
  Detail list alone**, not a data rule: the list renders the first three and reports the
  remainder as `+N groups`. The Clinical Evidence contract and the validator do not know
  this number, and another screen may show a different count. Each shown group names its
  estimand and analysis population, so a reader can tell the analyses apart.
- Missing optional values render through shared formatting; `N/A` is never
  stored in source data.
- Outcome existence alone determines whether a Study has recorded results.
  User-facing empty copy is **“No recorded outcomes.”** It does not claim that
  no public result exists.
- Clinical stage and regulatory milestone presentation must preserve the
  distinctions supplied by the Company/Pipeline contract.
- **Company Detail cross-lists partnered assets.** `getPartneredAssets`
  (`domains/company-pipeline/lib/portfolio.ts`) surfaces, on a company's own
  page, assets **another** company principally develops (`companyId`) whose
  row `relationships` names this company (for example Roche on Zealand
  Pharma's petrelintide, or Zealand Pharma on Boehringer Ingelheim's
  survodutide). This is a read-only display join over the existing
  `relationships` field — it does not change `companyId`, Program identity,
  or the ADR-0018/0019 single-principal-company rule. Matching normalizes
  `externalCompanyName` against `Company.name` (case, punctuation, common
  legal-entity suffixes) rather than requiring an exact string; a
  relationship naming a company this dataset has no record for surfaces
  nowhere and is not an error. A relationship whose `role` describes the
  row's own company (a self-declared role such as a licensee recording
  itself) is excluded from the partnering company's own list. Each
  partnered-asset row shows the actual stored `relationship.role` text and its
  associated `territories` (never a generic "co-developed" label) so a
  licensee/licensor pairing and its regional rights are not visually conflated
  with genuine co-development. A missing territory is disclosed as not
  specified rather than inferred.
- **Company Detail presents both owned and partnered assets as editorial
  registers, not independent cards.** Hairline row boundaries provide the
  scan path, while stage, variant count, evidence actions, and relationship
  facts form a content-sized metadata line beneath each asset identity rather
  than reserving sparse fixed columns. The line wraps in source order on narrow
  screens. The development summary is a lightweight stage-count strip. These
  are presentation rules only: asset ownership, relationship wording,
  territory, stage, evidence links, and comparison eligibility continue to
  come from the existing read model without aggregation or inference.
- **`scopeClass`** (Contract 1.2, ADR-0053) is a filter dimension, a Program
  Register column (configurable, hidden by default), and a Program Detail /
  company-page field. It is never a badge or color-coded status pill — it
  renders as plain text via its registry `label`, the same treatment as
  indications. The default filter is
  **All**: hiding non-qualifying classes (`obesity-comorbidity`,
  `metabolic-adjacent`, `non-metabolic`) by default would silently drop 43 of
  121 current program rows. The Overview metadata strip discloses an
  obesity-purpose count (`obesity-treatment` + `obesity-adjunct`) **alongside**
  the total program count, never in its place — see
  `generated-output-contract.md#5-consumer-contract`.

## Study Detail (`/studies/[studyId]`)

- The sticky Study section navigation is a URL-synchronised scroll spy. Its
  existing section IDs (`overview`, `arms`, optional `analysis-groups`,
  `endpoints`, `sources`) are the hash contract; clicking adds a history entry,
  manual scrolling replaces the current hash, and an invalid hash resolves to
  `overview`. The active link uses `aria-current="location"`, and the underlying
  anchors remain usable before hydration.

- The Endpoints & outcomes list clusters outcomes under one Population/Estimand
  header whenever two or more outcomes on the same endpoint share population,
  estimand, and result shape — **regardless of whether they are arm-anchored or
  AnalysisGroup-anchored**. Subject identity (which arm, or which pooled/derived
  group) is a separate concern rendered per-row; it never blocks a shared
  population/estimand from clustering together.
- Endpoints sharing role, domain, and assessment timepoint, where every one of
  an endpoint's own outcomes carries `result.responderThreshold`, are grouped
  into one card as a presentation-only "responder thresholds" family (e.g. 5%,
  10%, 15% body-weight reduction at the same timepoint). This never merges the
  underlying Endpoint or Outcome records; it is `EndpointsSection`'s own
  read-model-preserving grouping.
- Endpoints & outcomes shows no per-outcome or per-endpoint Source line. Only
  the Study-level Sources section (bottom of the page) renders citations, since
  it already lists every source cited anywhere in the Study.
- The free-text `safetySummary` narrative stays an Overview row. The
  Endpoints & outcomes "Safety" role filter renders ordinary Endpoint cards
  like any other role — ones named exactly "Serious adverse events",
  "Nausea", "Vomiting", or "Anti-drug antibodies" (the closed four-fact set
  the Clinical Evidence contract permits as safety Endpoints) — through the
  same clustering, badge, and family-grouping behavior described above. Most
  Studies have none entered yet, so the tab still shows the generic "No
  safety endpoints recorded." for them.
- A between-arm outcome's subject line always leads with the compared arms'
  dose identity (e.g. "Retatrutide 4 mg vs Placebo") when arm labels are
  available; `comparisonType`/`effectMeasure` renders as secondary text below
  it, never as the sole subject — source-reported comparison wording is often
  identical across doses and must not stand in for dose identity.
- Expand all / Collapse all is a single toggle whose label reflects whether
  every currently visible card is expanded, not two independent buttons.

## Efficacy Comparison

`/efficacy-comparison` compares reported body-weight reduction across mechanism
families. Its read model is `domains/app/lib/efficacy-comparison/read-model.ts`,
composing the mechanism family (Company/Pipeline) with representative clinical
evidence; selection policy lives in that directory's sibling modules, not in the
Clinical Evidence selectors, which contribute only record-level joins and the
shared `comparisonGroupKeyOf` primitive.

- The comparison unit is an **explicit global asset group xor company-local asset
  xor regimen**. Most assets remain company-local. A reviewed global-asset registry
  groups only confirmed cross-company identities such as Hansoh/Regeneron
  olatorepatide; it does not infer identity from a shared name or `assetId`.
  Mechanism family comes from the authored registry (ADR-0043); every member of a
  global group must resolve to one family, and a regimen carries an authored
  `mechanismFamilyId`.
- **A company-local asset further splits by `study.programId`.** Entities and Rows
  defines `programId` as company + asset + route + dosage form, so two Studies under
  the same molecule but different Programs — Novo Nordisk's subcutaneous-injection
  and oral-tablet semaglutide, each with its own dose range and its own trial family
  — are pharmacologically distinct products; merging them would let the page's
  single-winner selection silently drop an entire route's evidence. The split row's
  name carries the disambiguating `(route · dosage form)` suffix only when the asset
  genuinely has more than one variant (`getAssetDisplay` in `mechanism-family.ts`) —
  an ordinary single-route asset's display is unchanged. Global-asset-group and
  regimen units are unaffected; they already carry their own explicit identity.
- Selection operates on **evidence candidates** — one (Study, Endpoint, comparison
  group) triple. Within a global asset group, an authored development-scope priority
  is applied first (global olatorepatide evidence before Hansoh's regional evidence),
  with ordinary ranking as fallback when the preferred scope has no eligible result.
  The remaining keys are trial phase tier, endpoint role, estimand, analysis
  population, source completeness, evidence maturity, then curated source order.
  It is **selection, never calculation**: every rendered figure is a stored
  `result.value` for a stored anchor.
- **Trial phase tier is feature-local**, not a Clinical Evidence authority.
  `study.phase` stays open free text; an unrecognised phase dispositions one
  candidate rather than failing data validation.
- **Maturity ranks venue-first and only as a late tie-breaker**, because the
  Clinical Evidence contract documents that it conflates finality with venue. The
  row discloses the group's *best* maturity — the same figure the ranking used —
  alongside every maturity in the group.
- Eligibility is a **hard gate, never a down-rank**: adult, `without-type-2-diabetes`
  exactly, no additional required condition, initial treatment, randomised and
  controlled, and percent change from baseline in body weight. `mixed` and
  `not-specified` are never read as non-diabetic. `regionRestriction` is display
  only. Coverage is frozen at 17 of 30 units by ADR-0065 and two probes.
- **One arm-level metric.** `kg` and `percentage points` never appear as an overview
  arm-level value, and units are never converted. A stored `between-arm` estimate is
  shown separately, under a **comparator-neutral heading** ("Between-arm estimate, as
  reported") and in the source's own effect measure and unit; it is never derived from
  the arm-level values beside it, and it is never labelled placebo-adjusted, because a
  between-arm estimate may be against an active comparator (STEP 8's is vs. liraglutide,
  SURMOUNT-5's vs. semaglutide).
- **An active-comparator study can be a representative row.** Using an active comparator
  does not disqualify a study — its experimental arm still supplies the arm-level metric
  (STEP 8, SURMOUNT-5, REDEFINE 4). The comparator arm's own arm-level value is surfaced
  as a **same-group reference**, held distinct from a placebo reference, never merged
  into it, and never borrowed from another study or comparison group.
- **Direct head-to-head evidence is a separate section**, not a cross-trial row, and a
  row's presence never implies a comparison with any other row. Where one trial reported
  a direct comparison between two or more products — a stored between-arm estimate, or
  arm-level results reported together — it appears in the Head-to-head section, which is
  exempt from the population and single-metric gates because the comparison is internal
  to one study. Each study is **one card** listing every entity it compared (a 3-arm
  study is not split into pair cards), read from a single best-ranked (population,
  estimand) axis so two analysis sets are never pooled; any stored between-arm estimate
  is shown alongside, attributed to the exact pair it compares.
- Every unit with recorded body-weight evidence appears either as a row or in
  **Coverage gaps** with its single reason, and the read model asserts that
  partition. Gap copy must state what the data does not claim — an absent
  percent-change result is not evidence of no effect.
- Rows are ordered by registry `sortRank` and curated order, **never by magnitude**;
  the page states that its rows are separate trials and not a ranking.
- **Disclosure**: every fact needed to read a row renders inline, and every row
  links to its Study, its company, and — in the head-to-head list — each
  registry-resolved entity (an unresolved external comparator is flagged, not linked).
  A global-asset row additionally identifies the selected evidence company, authored
  sponsor label, Study population region, and development-rights scope; its asset and
  company links follow the selected evidence rather than a permanently preferred
  company.
  The selection-rationale disclosure is auxiliary: a button toggled by click, tap,
  Enter, or Space (never hover or focus alone), with disclosure semantics rather than a
  dialog. It adds the rationale only, and the page stays fully usable without it. The
  disclosure panel is portalled to the viewport and flips above its trigger when needed,
  so the comparison table's horizontal scroller never clips the panel or its links.
- **Compare programs** (`EfficacyCompareLauncher`) is a presentation-only overlay on
  top of the same `view.families` rows — it adds no read-model logic and never
  reorders, filters, or recalculates a row. A picker dialog (`EfficacyProgramPicker`)
  lists every row in the page's own family/curated order, capped at
  `EFFICACY_COMPARE_MAX_SELECTION` (currently five) selections; its own Compare
  action swaps to a chart dialog
  (`EfficacyCompareChart`) with a grouped vertical bar per selected unit's doses.
  Bar height is the only derived number in the feature — parsed from the stored
  percent-change string solely to size the bar — and every other rendered value
  (legend, axis caption, tooltip, screen-reader fallback list) shows that string
  verbatim. Each program's timepoint/duration renders as a permanent x-axis
  caption, not tooltip-only text, so two bars of equal height from trials of
  different length are never allowed to read as equivalent. Color encodes
  program identity (hue) and dose (lightness, lighter for a lower dose); the
  resolved nominal dose is only a positioning key, so distinct source-authored
  Arms that reach the same final dose remain separate bars and their permanent
  labels express an escalation configuration with an arrow (for example
  `9 mg`, `6→9 mg`, `3→9 mg`; never a rewritten `start X mg` label). The
  custom evidence tooltip preserves the full authored dose and escalation regimen
  text, pairs them with Study/phase/timepoint provenance, and opens from either
  pointer hover or keyboard focus; chart bars never fall back to a browser-native
  `title` tooltip. The
  chart dialog derives its desktop width from the selected groups while retaining
  viewport gutters, and keeps a left-aligned plot rather than centering a small
  selection in an oversized canvas. Its Y axis is a fixed, independent column:
  the zero baseline, negative tick grid, and labels share one scale, while only
  the program plot scrolls horizontally on narrow viewports. The dialog exposes
  Edit selection beside its title and returns to the same picker state. The chart
  carries no separate "not a ranking" caption because the duration/hue
  encoding already keeps each bar tied to its own trial. Both dialogs share the
  hand-rolled `Modal` primitive (portal, focus trap, Escape, scroll lock) rather
  than `ProgramDetailDrawer`'s side-drawer variant, since neither needs a slide
  transition.

## Change boundary

Update this reference for a new/removed route, a changed read-model owner, a
new inference rule, or changed user-visible meaning. Do not update it for local
spacing, color, or component refactors that preserve those boundaries.

Validate UI changes with `npm run lint`, `npm run build`, and relevant data
validators when data consumption changes — for `/efficacy-comparison` this
includes `npm run data:probe:efficacy-comparison` (see Probe runtime below)
and, when a touched asset's Efficacy Comparison population coverage could be
affected, `npm run data:probe:efficacy-population-coverage`.

## Probe runtime

`npm run data:probe:efficacy-comparison` executes the shipped TypeScript read model
directly, so it needs **Node >= 22.18** (declared in `package.json` `engines`) for
`--experimental-strip-types`. `scripts/ts-alias-hooks.mjs` supplies the two things
bare Node lacks and the Next.js toolchain otherwise provides: the `@/…` path alias
and extensionless module resolution, plus the `type: "json"` import attribute.

The hook exists so the probe runs the **real** read model. Reimplementing the
selection rules in JavaScript for probing would let the probe and the shipped code
drift, which is precisely the failure the probe is meant to catch. The other probes
and every validator are plain `.mjs` and need no hook.
