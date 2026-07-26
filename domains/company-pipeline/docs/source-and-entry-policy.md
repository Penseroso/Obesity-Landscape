---
role: company-pipeline-entry-contract
status: active
authority: authoritative
update-boundary: Update when source authority, field-entry, status, date, metadata, or registry-promotion semantics change.
---

# Source and Entry Policy

There is **no single global source hierarchy**. Source authority is evaluated
**per field**, because the best evidence for a trial phase differs from the best
evidence for a mechanism or a licensing change.

## Field-specific source policy

Preferred source classes by claim type.

### Current pipeline intent and program status

Prefer:

- current company pipeline page
- investor presentation
- annual or quarterly filing
- earnings materials or earnings call
- official company release

### Discovery, Preclinical, and IND-enabling stage

Accept **direct evidence** from:

- company pipeline
- company R&D presentation
- investor materials
- official company scientific presentation
- company-authored conference disclosure

Do **not** require a trial registry or regulator source for these stages.

### Phase 1–3 stage and trial status

Prefer:

- ClinicalTrials.gov or an applicable registry
- first-patient-dosed or trial-initiation company announcement
- company pipeline or clinical development presentation

Use registry evidence where available, but **allow direct official company
evidence** when registration is delayed or unavailable. Program state (phase and
trial status) is best evidenced by the applicable **trial registry**; basic
company research **may cite NCT registry records** to verify that a program
exists and its current phase/status. Detailed trial design, arm, endpoint, and
result modeling is **owned by the separate Clinical Evidence domain** (see
[`domains/clinical-evidence/docs/README.md`](../../clinical-evidence/docs/README.md)) and is not
entered into `PipelineProgramRecord`.

A registry record citable this way evidences a program row's **stage and
status**; it does not by itself establish that the candidate is its own
**Program**. A registry record may support a distinct Program when it directly
establishes a distinct official development objective. A registry record does
not establish a new Program merely because the Study it evidences differs in
enrolled population, trial design, dose scheme, comparator, or treatment
context — that disposition is decided under
[Research Workflow §2](./research-workflow.md#2-discover-and-classify), not by
the citation count or the presence of a registry record alone.

Phase sub-stages and combined stages must preserve their official semantic
precision. For example, `Phase 1b`, `Phase 2a`, and `Phase 1/2` are not reduced
to broader labels solely to fit existing vocabulary; if they satisfy the
registry promotion rules, add the canonical value to the registry and use it.

### Regulatory state details

Regulatory-development milestones can be `development.stage` values when they
are the most advanced official current stage. Preserve jurisdiction, authority,
and date as regulatory-state details when available. Examples include:

- `IND submitted`
- `IND cleared`
- `CTA submitted`
- `CTA approved`

Do not enter `IND submitted` as `IND-enabling`, and do not enter `IND cleared`
as `Phase 1` unless there is separate evidence that a Phase 1 trial has begun
or is otherwise stage-confirmed under the stage evidence rules.

Each regulatory-state entry should preserve the official state, jurisdiction,
authority, and official date when disclosed. A program may have multiple
regulatory-state entries.

### Filed and Approved

Prefer:

- regulator documents
- filing acceptance or action announcements
- product label
- official company announcement **supported by** regulator evidence

Approval evidence is **route-specific**: an `Approved` stage requires regulator
evidence for the **specific route and formulation** of that program row; approval
of one route or product does not approve another. Preserve the filed and approved
regulatory details — state, jurisdiction, authority, and date — in
`regulatoryStates`, separate from `development.stage`. For example Novo Nordisk's
CagriSema `Filed` row keeps its `NDA submitted` United States / FDA entry with
date in `regulatoryStates`.

Coverage is complete only when every program whose `development.stage` is
`Filed` or `Approved` reconciles every officially disclosed filing or approval
jurisdiction, authority, and official date into `regulatoryStates`. An aggregate
`Filed` or `Approved` `development.stage` alone is incomplete whenever
jurisdiction-level official evidence is available. Keep `development.stage` as
the aggregate most-advanced stage; do not collapse jurisdiction details into it.

### Mechanism, formulation, and platform

Prefer:

- company scientific materials
- company asset or platform page
- conference presentation
- peer-reviewed publication
- patent **as supporting evidence only**

A patent does **not** prove active development.

### Licensing, acquisition, and rights changes

Company relationships (licensing, acquisition, rights, territory, role) require
**transaction sources** that directly identify the relationship. Prefer
**primary official sources** and allow secondary coverage only as a fallback:

- regulatory filings
- official announcements from the involved companies
- annual reports
- dated transaction disclosures

Use secondary/press coverage of a deal **only when** a primary official
disclosure is unavailable, and do not let secondary coverage override a primary
source. Record the confirmed role, rights, territory, and effective date in
`relationships`.

`effectiveDate` must come from a source that states the transaction's
effective, execution, or closing date specifically — not merely the date the
deal was publicly announced. An announcement date and an effective date are
not interchangeable: when the only available source states an announcement
date without confirming it as the effective date, do not store it as
`effectiveDate`. When a later source (a closing statement, regulatory filing,
or annual report) discloses the actual effective date, replace an
announcement-derived value with it and add the confirming source.

### Combination, regimen, and company relationships

Prefer official company materials, trial registry records, regulatory filings,
or transaction disclosures that directly identify the component products,
relationship role, territory, rights, and responsible company. Do not infer
component identity, a fixed-dose/co-formulation relationship, a regimen
relationship, territory, rights, or an external asset developer from context
alone.

Classifying a study as a confirmed **regimen** component (rather than an
unconfirmed add-on/background-therapy program) requires the source to name the
**specific** background or concomitant product **and** show the sponsor treats
the co-administration as a distinct development configuration or
investigational combination strategy (for example, an "alone or in
combination" trial design). An unspecified therapy class (for example "a
weekly incretin") does not confirm a regimen component, and neither does a
named product studied only as protocol-required standard-of-care background
therapy (for example background basal insulin or metformin) — that remains
background therapy regardless of naming. Attributing an indication from a
**platform or master protocol** requires the source to explicitly nest that
indication — a named sub-population, sub-study, or dedicated outcome measure —
not only the trial's general population.

### Clinical results

Clinical Evidence, not Company/Pipeline, owns result values and result source
priority (see the [Clinical Evidence workflow](../../clinical-evidence/docs/workflow.md#3-sources-and-updates)
for the ranked source classes and fallback rules). Company/Pipeline research
may cite clinical sources only to confirm that a program exists, its phase,
its status, and sponsor intent. Do not enter a clinical result value, or a
clinical result source ranking, in `PipelineProgramRecord`.

## Stage evidence rules

For v1, `development.stage` is the most advanced official current development
stage for the specific program scope. It includes Discovery, Preclinical,
IND-enabling, regulatory-development milestones such as `IND submitted`,
`IND cleared`, `CTA submitted`, and `CTA approved`, clinical phases, Filed, and
Approved. Clinical phase is one category within `development.stage`, not a
separate concept. When official sources differ, store the most advanced official
current stage and use optional `development.stageBasis` and
`development.stageOperationalState` to preserve the evidence basis and
operational state.

Evidence must name the specific program row's own scope — asset, route,
dosage form, and indication scope — not a sibling row for the same asset or
the asset's aggregate pipeline position. When a company develops the same
asset across multiple indications, routes, or configurations at different
stages, confirm each row's `development.stage` from a source that speaks to
that row's own scope; do not carry a more or less advanced stage confirmed for
a different row of the same asset into this row. A source that presents only
a future, planned, or next-phase intention for the row does not advance its
current stage, even when a different row for the same asset has already
reached that phase.

Explicit evidence required to assign each enumerated stage:

Accepted evidence includes explicit current sponsor pipeline markers, official
investor presentations, filings, current pipeline tables, applicable trial
registry phases, and official announcements of regulatory milestones, trial
initiation, first-patient-dosed, filing, or approval. Do not promote stage from
vague future plans or secondary news alone.

- **Discovery** — evidence of an exploratory program or candidate-identification
  stage; no named clinical candidate yet.
- **Preclinical** — a named candidate undergoing nonclinical development.
- **IND-enabling** — formal IND/CTA-enabling work explicitly underway.
- **Phase 1–3** — supported by actual trial initiation, an active or registered
  trial entry, an explicit current sponsor pipeline marker, or equivalent direct
  official evidence. Planned initiation language alone does not advance the
  stage unless an official current source presents that phase as the current
  development stage; record the operational state separately.
- **Filed** — the filing has been formally submitted or accepted.
- **Approved** — regulator approval is confirmed.
- **Unknown** — a confirmed program whose stage is unresolved.

Optional stage annotations:

- **`stageBasis`** records why the stored stage is valid:
  `Sponsor-declared current pipeline stage`, `Operational evidence`, or
  `Official regulatory-development milestone`.
- **`stageOperationalState`** records the operational state relevant to the
  stored stage: `Initiated or active`, `Active not recruiting`,
  `Not yet recruiting`, `Planned, not yet initiated`,
  `Submitted, pending clearance`, `Cleared, not yet initiated`, `Paused`,
  `Completed`, or `Not separately confirmed`.

Regulatory-development milestones are valid `development.stage` values when
they are the most advanced official current development stage. Preserve
jurisdiction, authority, and date details in `regulatoryStates` when available.
Do not approximate these milestones as clinical phases: `IND submitted`,
`IND cleared`, or `CTA approved` is not `Phase 1` unless separate official
clinical-stage evidence supports Phase 1.

## Discovery versus confirmation

- Industry news, databases, articles, and search results **may be used to
  discover** a candidate.
- Core facts should be **confirmed** using a source appropriate to the claim.
- A secondary source alone should **not override** a primary source.
- Do **not** reject useful official company evidence merely because no
  publication exists.
- A search that returned nothing and a source that could not be reached are
  **not evidence of non-disclosure**. Whether a claim counts as checked is
  decided by the field-specific source classes above: a claim is unconfirmed only
  after the source classes appropriate to it have actually been consulted. The
  procedure for exhausting discovery belongs to the
  [Research Workflow](./research-workflow.md).

## Conflict handling

- Evaluate authority **by field**, not by one global ranking.
- Prefer the source that most **directly supports** the specific claim.
- Consider **recency only after** relevance and authority.
- **Retain** relevant conflicting sources.
- Do **not** invent a resolution.
- Use `null` or `Unknown` where the current contract permits.
- Record unresolved **structural** cases in `edge-cases.md`.

## Company record creation

- Create a new Company record **only when both** the canonical official company
  name **and** `headquartersCountry` are confirmed from reliable current sources.
- Do **not** guess or create a partial Company record when the headquarters
  country is unresolved. **Defer** and report the finding instead.

## Field-entry rules

Rules by field.

- **Canonical company name** — preserve official spelling; use one canonical
  form so it resolves against `companies.json`.
- **Asset name** — store the asset's **current official canonical name** with the
  sponsor's official spelling. `assetId` is immutable, so a rename updates
  `assetName` only. Record the prior name as a `former-name` alias.
- **Aliases** — optional typed alternate labels for the asset:
  `former-name` (a superseded official name), `development-code` (a confirmed
  internal code beyond the one in `codeName`), `brand-name` (a marketed trade
  name), or `alternative-spelling`. Each alias has a `type` and a `value`; a
  value must not repeat the canonical `assetName`, and the **same value must not
  repeat across alias types** (each alias value is unique within the asset).
  Enter only labels supported by official or authoritative evidence. Aliases are
  asset-level and must be identical on every program row that shares the same
  `assetId`.
- **Code name** — store a single **confirmed internal development code**; `null`
  if none is confirmed. Do not place brand names, former names, or unconfirmed
  codes here — use `aliases`. `codeName` must **not equal** the canonical
  `assetName`; when the development code is itself the canonical name, leave
  `codeName` `null`. A code transcribed from a single secondary or paraphrased
  reference is prone to transcription error (for example a digit swapped in a
  development code); before storing it as `codeName`, or using it as the basis
  for `assetId`, cross-check its exact spelling against a second available
  source — preferably a trial registry entry, regulatory filing, or the
  sponsor's own material — and prefer the sponsor's or registry's spelling over
  a secondary reference when they differ.
- **Mechanism** — only as published; `null` if not disclosed. The published
  wording is stored verbatim and is never rewritten to a canonical form. Every
  non-null value must additionally appear, character for character, in exactly
  one `mechanisms` list in
  [`mechanism-families.json`](../data/registries/mechanism-families.json); the
  validator rejects an unmapped mechanism. Adding a new asset whose published
  wording is new therefore means adding that wording to the family it belongs
  to, or adding a family — never editing the asset's wording to fit.
- **Mechanism family** — never authored on a program row. It is resolved from
  the stored mechanism through the registry, so the family is a property of the
  vocabulary, not of the row. A **regimen** is the one exception: it has no
  `technical` block, so it carries an authored `mechanismFamilyId`, which must
  name a `multi-component` family.
- **Scope class** (Contract 1.2, ADR-0053) — a required, registry-backed
  `scopeClass` naming the row's own position in the obesity landscape (`obesity-treatment`, `obesity-adjunct`,
  `obesity-comorbidity`, `metabolic-adjacent`, or `non-metabolic`; see
  [Entities and Rows §Scope class](./entities-and-rows.md#scope-class)).
  Authored from the row's own official development objective and required
  development context, never derived from `indications` text — `indications`
  is unnormalized free text (for example `Type 2 diabetes` and `Type 2
  diabetes mellitus` both occur, and `Elevated liver fat with obesity or
  overweight` contains "obesity" but is not an obesity-treatment row), and
  substring or exact-match parsing of it would misclassify rows the same way
  parsing `technical.mechanism` is prohibited for mechanism families. Every
  Program and every Regimen requires a value; storing one requires the same
  source-supported confirmation as any other required field — do not carry
  forward an unverified default or copy a sibling row's value without
  row-specific evidence.
- **Platform** — only as published; `null` if not disclosed. Platform and
  modality (peptide, non-peptide, small molecule, antibody conjugate) are
  auxiliary metadata and are **not** mechanism-family boundaries.
- **Route** — only as published; do not infer.
- **Dosage form** — only as published; do not infer.
- **Dosing interval** — only as published; `null` if not disclosed.
- **Indications** — a **disease or clinically defined treatment indication**
  only, as published; may hold multiple values under the row rules in
  `entities-and-rows.md`. Do **not** store background or concomitant therapy,
  prior-treatment or inadequate-control conditions, age-cohort descriptors,
  trial objectives, outcome/endpoint labels, or other population descriptors as
  an indication value. For example, a required background incretin is not an
  indication, and a trial-objective phrase such as "morbidity and mortality in
  obesity" is not a disease indication — capture that framing in research
  reporting or the separate Clinical Evidence domain, not in `indications`.
  Which diseases a source may promote into `indications` at all is governed by
  [Population and comorbidity versus indication](#population-and-comorbidity-versus-indication).
- **Development stage** — one of the enumerated stages; see status/stage rules.
- **Development status** — one of the enumerated statuses; see status rules.
- **Regulatory state** — one or more registry-backed regulatory milestones,
  separate from development stage.
  For v1, this means detailed regulatory-state data supplements the unified
  `development.stage`; it does not exclude regulatory-development milestones
  from being stage values.
- **Asset type** — `single-asset`, `fixed-dose-combination`, or
  `co-formulation`; omit for ordinary single-asset programs.
- **Components** — only when official evidence confirms a combination asset or
  regimen component. Use internal `assetId` references when available; otherwise
  store official component code/name and company information when confirmed.
- **Company relationships** — program/regimen-level company roles, territories,
  rights, and dates only as published.
- **Regimen configuration key** — optional stable discriminator for officially
  distinct regimens sharing the same principal company, component set, and
  indication scope. Use official regimen codes, sponsor-defined configuration
  labels, protocol/program identifiers, or stable simultaneous/sequential style
  labels when directly supported. Do not use display names, stage/status, dates,
  results, or arbitrary numbering.

Company source folders are independent validation units. Use component
`assetId`, component `companyId`, and relationship `companyId` only for entities
inside the current company folder. For another company's asset, use `assetName`
or `codeName` plus `externalCompanyName`. For another company relationship, use
`externalCompanyName`. Do not look up or guess another company folder's IDs.

General requirements:

- **Preserve official spelling.**
- Do **not** infer unpublished mechanism, platform, route, dosage form, or
  dosing interval.
- Do **not** store empty strings.
- Do **not** store `"N/A"` in JSON. `"N/A"` is a **UI-only** rendering of an
  absent value produced by `domains/app/lib/format.ts`.
- Use `null` **only** for nullable fields when information is unavailable or not
  applicable.
- Use `Unknown` **only** for the unresolved stage or status of a **confirmed**
  program.
- Use consistent normalized expressions where practical.
- Use registry canonical labels for development stage and regulatory state.
  If the source uses an alias with the same meaning, store the canonical label.
- **Required non-null fields** — if route, dosage form, indication, asset
  identity, or responsible company **cannot be confirmed**, do **not** infer a
  value and do **not** enter the record. Defer it as an unresolved pilot case
  rather than entering a partial or guessed record.

`null` and `Unknown` are **not interchangeable**: `null` marks an absent
nullable field value; `Unknown` is an enumerated stage/status for a confirmed
program whose current state cannot be resolved.

## Population and comorbidity versus indication

`indications` records what a program is **being developed to treat or manage**,
not who was enrolled to study it. A disease can appear in a source for either
reason, and the two must not be conflated.

- Do **not** store a disease in `PipelineProgram.indications` merely because it
  appears in a trial title, a registry condition field, an eligibility
  criterion, or a population description.
- Distinguish a **comorbidity**, an **enrolled subpopulation**, and a
  **stratification factor** from the program's own therapeutic and development
  objective.
- Storing a disease as an indication requires official evidence that
  **directly supports treatment or management of that disease as that
  program's own development objective**.
- In a chronic weight-management trial conducted in people with obesity or
  overweight, a comorbidity used as an enrollment condition or a population
  characteristic — for example type 2 diabetes, obstructive sleep apnea,
  cardiovascular disease, or MASH — leaves the program an obesity/overweight
  program. Treat it as a separate treatment objective only when the sponsor is
  confirmed to develop that comorbidity itself as a distinct objective.

Whether population-specific studies of one asset become separate program rows
is a row-splitting question owned by
[`entities-and-rows.md`](./entities-and-rows.md#row-splitting).
`npm run data:probe:indication-scope` reports rows whose shape suggests a
population or comorbidity was promoted to an indication; it raises review
candidates and never decides them.

## Status rules

Enumerated statuses:

- **Planned** — development intended but not yet started, per evidence.
- **Active** — currently in development, per evidence.
- **On hold** — paused, with **explicit** supporting evidence.
- **Discontinued** — stopped, with **explicit** supporting evidence.
- **Unknown** — confirmed program whose current status cannot be resolved.

Additional rules:

- A **completed trial** does **not** mean the overall program is discontinued.
- **Pipeline disappearance alone** does **not** prove discontinuation.
- **Retain** an evidenced `Discontinued` program in the dataset: discontinuation
  updates its status and **never deletes** the record (ADR-0008).
- `Approved` programs likewise remain in the dataset.
- **Delay alone** does **not** prove `On hold`.
- **Explicit evidence** should support `On hold` and `Discontinued`.
- One authoritative source is sufficient for `Discontinued` when it directly
  and explicitly states that row's own discontinuation. The number of cited
  sources does not establish this by itself — a single primary statement
  outweighs several secondary sources that merely infer a wind-down, and two
  sources that do not themselves state discontinuation do not satisfy this
  rule. Because directness of support cannot be judged mechanically from
  record-level source count, confirming it is a research-completion gate
  responsibility (`research-workflow.md`), not a validator rule.
- A confirmed program with unresolved current status may use `Unknown`.
- Evidence for a row's `development.status` and `stageOperationalState` must
  name that row's own program scope. A specific trial's operational state
  (for example, that one particular registered study has completed) confirms
  only that trial, and must not be applied to a different program row — a
  different indication, route, or configuration of the same asset — without
  evidence that trial supports that row's scope.
- When official evidence confirms **future regimen development intent** but
  regimen-specific development has not started or its stage is not disclosed, use
  `status: "Planned"` with `stage: "Unknown"` where appropriate. Do **not**
  inherit stage, status, or administration details from the component programs.

### Status and operational-state combinations

`development.status` and `development.stageOperationalState` describe different
axes and are combined, not conflated: status is the program's overall lifecycle
state; `stageOperationalState` annotates the operational state of the stored
stage. When `stageOperationalState` is present, the validator enforces the
following allowed combinations per Contract 1.2 (`Not separately confirmed` is
the neutral value permitted with any status):

| `status` | Allowed `stageOperationalState` |
| --- | --- |
| `Planned` | `Planned, not yet initiated`, `Not yet recruiting`, `Submitted, pending clearance`, `Cleared, not yet initiated`, `Not separately confirmed` |
| `Active` | `Initiated or active`, `Active not recruiting`, `Not yet recruiting`, `Submitted, pending clearance`, `Cleared, not yet initiated`, `Completed`, `Not separately confirmed` |
| `On hold` | `Paused`, `Not separately confirmed` |
| `Discontinued` | `Paused`, `Completed`, `Not separately confirmed` |
| `Unknown` | `Not separately confirmed` |

Notably, **`Active` + `Completed`** is valid: a program stays active even though
the trial supporting the stored stage has completed — a completed trial is not
program discontinuation (for example Novo Nordisk's IcoSema and the Zenagamtide
type-2-diabetes row). Conversely, do not use
`stageOperationalState: "Completed"` to force `status: "Discontinued"`;
discontinuation requires explicit evidence.

## Date semantics

- **`checkedAt`** — date the source was accessed.
- **`publishedAt`** — official publication date when known.
- **Regulatory-state date** — official regulatory milestone date when known.
- **`lastVerifiedAt`** — date the whole record was rechecked.
- **`updatedAt`** — date stored record values were changed.

Use **`YYYY-MM-DD`** for `checkedAt`, `lastVerifiedAt`, and `updatedAt`.

Use ISO 8601 partial dates for evidence dates when the source only supports
partial precision:

- `YYYY`
- `YYYY-MM`
- `YYYY-MM-DD`

This applies to `publishedAt`, regulatory-state dates, and other evidence dates
that may be introduced under the current contract. Do **not** estimate unknown
months or days, and do **not** fill unknown values with `01`.

### Metadata effects of an authored-field backfill

Adding a value for a new required field (for example, backfilling `scopeClass`
onto an existing record) is a metadata-affecting change only to the extent the
record was actually re-examined:

- Reading only the record's **already-stored** `metadata.sources` to confirm
  and author the new value updates `updatedAt` (a stored value changed), but
  **does not** update `lastVerifiedAt` or any source's `checkedAt` — the
  record's prior verification is unaffected, and no source was reopened.
- Opening an **external source again** — to re-confirm current state or to
  supply evidence the stored sources do not cover — updates `updatedAt`,
  updates `lastVerifiedAt`, and updates `checkedAt` only on the sources
  actually reopened. Do not update `checkedAt` on a source that was not
  reopened.

A run performing a bulk backfill must report which records fall into each
case, so a reader can distinguish "reclassified from existing evidence" from
"reverified against current sources."

## Source metadata

The current contract supports **record-level provenance only**
(`metadata.sources` on the program record). There is no field-level source
attribution.

Each stored source must use the **most precise verified publication date**
available (`YYYY-MM-DD` when the exact date is known; a partial `YYYY-MM` or
`YYYY` only when finer precision is not verifiable), and its `sourceType` must
**describe the artifact actually at the stored URL** (for example, `press
release`, `trial registry`, `scientific presentation`), not the fact it happens
to support.

Agents should store the most authoritative minimum sufficient set of sources.
A single authoritative source may be enough when it confirms all core fields.
Use multiple sources when stage, formulation, platform, regulatory state, or
other core facts require different evidence. Do not add redundant sources that
only repeat the same fact.

Minimum source coverage should **collectively** support:

- asset identity
- responsible company
- route and dosage form
- indication
- stage and status

When authoritative sources conflict, preserve the relevant conflicting sources
and do not invent a resolution.

Do **not** redesign the schema for field-level provenance in Module 5;
field-level provenance is logged as an edge case.

## Registry promotion

During research, add a new development-stage, regulatory-state, or company
relationship-role registry entry only when all of the following are true:

- the value is confirmed by a regulator, trial registry, official company
  announcement, or official scientific material.
- the meaning is distinct from all existing registry labels and aliases.
- the difference is not only style, case, punctuation, or Roman numeral wording.
- the value is needed to represent actual pipeline state.
- the expression is not abnormal, one-off, or purely promotional language.

If an official value has the same meaning as an existing registry entry, add it
as an alias if useful. Do not create a duplicate canonical entry. If officiality
or meaning is insufficiently supported, do not promote it; report it as a
deferred finding.

Research order, coverage checks, validation, and reporting belong to the
[Company/Pipeline Research Workflow](./research-workflow.md). This document
defines entry semantics only.
