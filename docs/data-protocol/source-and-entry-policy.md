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

### Clinical results

Prefer:

- conference presentation or poster
- peer-reviewed publication
- registry results
- official company topline release

An official topline release confirms **what the company announced**, but must
**not** be treated as independent validation.

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
- **`lastVerifiedAt`** — date the whole record was rechecked.
- **`updatedAt`** — date stored record values were changed.

Use **`YYYY-MM-DD`**. Do **not** estimate unknown dates.

## Source metadata

The current contract supports **record-level provenance only**
(`metadata.sources` on the program record). There is no field-level source
attribution.

Minimum source coverage should **collectively** support:

- asset identity
- responsible company
- route and dosage form
- indication
- stage and status

Do **not** redesign the schema for field-level provenance in Module 5;
field-level provenance is logged as an edge case.

## Research checklist

Before entering or updating a record:

- [ ] Search for an existing **company** (reuse it if found).
- [ ] Search for an existing **asset** (reuse it if found).
- [ ] **Reuse stable IDs**; do not renumber.
- [ ] Confirm **development intent**.
- [ ] Confirm **route** and **dosage form**.
- [ ] Confirm **indication**.
- [ ] Confirm **stage** and **status**.
- [ ] Retrieve appropriate **primary or direct official sources** for each claim.
- [ ] Record **publication and access dates**.
- [ ] Check for **unsupported inference**.
- [ ] Check for a **duplicate program configuration**.
- [ ] Log any **structural ambiguity** as an edge case.
