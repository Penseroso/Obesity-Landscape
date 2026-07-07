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
evidence** when registration is delayed or unavailable.

Phase sub-stages and combined stages must preserve their official semantic
precision. For example, `Phase 1b`, `Phase 2a`, and `Phase 1/2` are not reduced
to broader labels solely to fit existing vocabulary; if they satisfy the
registry promotion rules, add the canonical value to the registry and use it.

### Regulatory state

Regulatory progress is separate from development stage. Examples include:

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

### Mechanism, formulation, and platform

Prefer:

- company scientific materials
- company asset or platform page
- conference presentation
- peer-reviewed publication
- patent **as supporting evidence only**

A patent does **not** prove active development.

### Licensing, acquisition, and rights changes

Prefer:

- regulatory filings
- official announcements from the involved companies
- annual reports
- dated transaction disclosures

### Combination, regimen, and company relationships

Prefer official company materials, trial registry records, regulatory filings,
or transaction disclosures that directly identify the component products,
relationship role, territory, rights, and responsible company. Do not infer
component identity, a fixed-dose/co-formulation relationship, a regimen
relationship, territory, rights, or an external asset developer from context
alone.

### Clinical results

Prefer:

- conference presentation or poster
- peer-reviewed publication
- registry results
- official company topline release

An official topline release confirms **what the company announced**, but must
**not** be treated as independent validation.

## Stage evidence rules

Explicit evidence required to assign each enumerated stage:

- **Discovery** — evidence of an exploratory program or candidate-identification
  stage; no named clinical candidate yet.
- **Preclinical** — a named candidate undergoing nonclinical development.
- **IND-enabling** — formal IND/CTA-enabling work explicitly underway.
- **Phase 1–3** — actual trial initiation, an active registry entry, or
  equivalent direct evidence. **Planned initiation alone does not advance the
  stage** to Phase 1–3.
- **Filed** — the filing has been formally submitted or accepted.
- **Approved** — regulator approval is confirmed.
- **Unknown** — a confirmed program whose stage is unresolved.

## Discovery versus confirmation

- Industry news, databases, articles, and search results **may be used to
  discover** a candidate.
- Core facts should be **confirmed** using a source appropriate to the claim.
- A secondary source alone should **not override** a primary source.
- Do **not** reject useful official company evidence merely because no
  publication exists.

## Conflict handling

- Evaluate authority **by field**, not by one global ranking.
- Prefer the source that most **directly supports** the specific claim.
- Consider **recency only after** relevance and authority.
- **Retain** relevant conflicting sources.
- Do **not** invent a resolution.
- Use `null` or `Unknown` where the current contract permits.
- Record unresolved **structural** cases in `edge-cases.md`.

## Field-entry rules

Rules by field.

- **Canonical company name** — preserve official spelling; use one canonical
  form so it resolves against `companies.json`.
- **Asset name** — preserve the sponsor's official name and spelling.
- **Code name** — store internal development codes; `null` if none.
- **Mechanism** — only as published; `null` if not disclosed.
- **Platform** — only as published; `null` if not disclosed.
- **Route** — only as published; do not infer.
- **Dosage form** — only as published; do not infer.
- **Dosing interval** — only as published; `null` if not disclosed.
- **Indications** — as published; may hold multiple values under the row rules
  in `entities-and-rows.md`.
- **Development stage** — one of the enumerated stages; see status/stage rules.
- **Development status** — one of the enumerated statuses; see status rules.
- **Regulatory state** — one or more registry-backed regulatory milestones,
  separate from development stage.
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
  absent value produced by `lib/format.ts`.
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
- **Delay alone** does **not** prove `On hold`.
- **Explicit evidence** should support `On hold` and `Discontinued`.
- A confirmed program with unresolved current status may use `Unknown`.

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

## Research checklist

Before entering or updating a record:

- [ ] Search for an existing **company** (reuse it if found).
- [ ] Search for an existing **asset** (reuse it if found).
- [ ] **Reuse stable IDs**; do not renumber.
- [ ] Confirm **development intent**.
- [ ] Confirm **route** and **dosage form**.
- [ ] Confirm **indication**.
- [ ] Confirm **stage** and **status**.
- [ ] Confirm regulatory state separately from development stage when present.
- [ ] Distinguish single asset, combination product, regimen, and external
  background therapy.
- [ ] Confirm component identities and company relationships without inference.
- [ ] Keep internal references company-folder-local and represent other
  companies/assets as external references.
- [ ] Add regimen `configurationKey` only when an official stable configuration
  discriminator is needed and confirmed.
- [ ] Check registry labels and aliases before adding new vocabulary.
- [ ] Retrieve appropriate **primary or direct official sources** for each claim.
- [ ] Record **publication and access dates**.
- [ ] Check for **unsupported inference**.
- [ ] Check for a **duplicate program configuration**.
- [ ] Log any **structural ambiguity** as an edge case.
