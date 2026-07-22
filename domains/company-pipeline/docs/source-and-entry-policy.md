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

Prefer:

- conference presentation or poster
- peer-reviewed publication
- registry results
- official company topline release

An official topline release confirms **what the company announced**, but must
**not** be treated as independent validation.

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
  `codeName` `null`.
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
- A confirmed program with unresolved current status may use `Unknown`.
- When official evidence confirms **future regimen development intent** but
  regimen-specific development has not started or its stage is not disclosed, use
  `status: "Planned"` with `stage: "Unknown"` where appropriate. Do **not**
  inherit stage, status, or administration details from the component programs.

### Status and operational-state combinations

`development.status` and `development.stageOperationalState` describe different
axes and are combined, not conflated: status is the program's overall lifecycle
state; `stageOperationalState` annotates the operational state of the stored
stage. When `stageOperationalState` is present, the validator enforces the
following allowed combinations per Contract 1.1 (`Not separately confirmed` is
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
