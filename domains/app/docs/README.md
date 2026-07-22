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
| `/companies/[companyId]` | Company detail and associated clinical inventory |
| `/assets/[companyId]/[assetId]` | Focal and linked studies for an asset |
| `/studies/[studyId]` | Study, arms, endpoints, outcomes, and source detail |

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
- Program-specific clinical retrieval uses explicit `Study.programId`; it does
  not infer a relationship from asset, indication, title, or source URL.
- Asset views may use the generated focal/linked asset-study projection. Focal
  versus linked is the top-level split. **Inside** each relation, Studies group by
  the authored `studyFamily` only; a Study without one is unclassified and renders
  in a trailing "Other studies" group. Family is never inferred from an acronym or
  title, and the family name appears in the group header only.
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

## Efficacy Comparison

`/efficacy-comparison` compares reported body-weight reduction across mechanism
families. Its read model is `domains/app/lib/efficacy-comparison/read-model.ts`,
composing the mechanism family (Company/Pipeline) with representative clinical
evidence; selection policy lives in that directory's sibling modules, not in the
Clinical Evidence selectors, which contribute only record-level joins and the
shared `comparisonGroupKeyOf` primitive.

- The comparison unit is an **asset xor regimen**. Mechanism family comes from the
  authored registry (ADR-0043); a regimen carries an authored `mechanismFamilyId`.
- Selection operates on **evidence candidates** — one (Study, Endpoint, comparison
  group) triple — ranked by trial phase tier, endpoint role, estimand, analysis
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
  only. Coverage is frozen at 10 of 15 units by ADR-0045 and two probes.
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
  a direct comparison between two products — a stored between-arm estimate, or arm-level
  results reported together — it appears in the Head-to-head section, which is exempt
  from the population and single-metric gates because the comparison is internal to one
  study.
- Every unit with recorded body-weight evidence appears either as a row or in
  **Coverage gaps** with its single reason, and the read model asserts that
  partition. Gap copy must state what the data does not claim — an absent
  percent-change result is not evidence of no effect.
- Rows are ordered by registry `sortRank` and curated order, **never by magnitude**;
  the page states that its rows are separate trials and not a ranking.
- **Disclosure**: every fact needed to read a row renders inline, and every row
  links to its Study, its company, and — in the head-to-head list — each
  registry-resolved entity (an unresolved external comparator is flagged, not linked).
  The selection-rationale disclosure is auxiliary: a button toggled by click, tap,
  Enter, or Space (never hover or focus alone), with disclosure semantics rather than a
  dialog. It adds the rationale only, and the page stays fully usable without it.

## Change boundary

Update this reference for a new/removed route, a changed read-model owner, a
new inference rule, or changed user-visible meaning. Do not update it for local
spacing, color, or component refactors that preserve those boundaries.

Validate UI changes with `npm run lint`, `npm run build`, and relevant data
validators when data consumption changes.

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
