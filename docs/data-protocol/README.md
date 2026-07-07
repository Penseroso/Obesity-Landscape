# Data Protocol

Operating rules for competitor pipeline research and pilot data entry.

This protocol (Module 5) defines **how future data is researched and entered**.
It treats the current TypeScript data contract in `lib/programs/types.ts` as
**provisional**: rules here describe intended practice, and structural gaps are
logged as edge cases rather than resolved by schema changes.

## Contents

- [`README.md`](./README.md) — purpose, dataset scope, operating model, glossary (this file).
- [`entities-and-rows.md`](./entities-and-rows.md) — Company, Asset, Program identity, mutable state, row splitting, stable IDs.
- [`source-and-entry-policy.md`](./source-and-entry-policy.md) — field-specific source policy, field-entry rules, status/date semantics, research checklist.
- [`edge-cases.md`](./edge-cases.md) — structural cases the current contract cannot yet represent.
- [`decision-log.md`](./decision-log.md) — ADR-lite record of fixed decisions and decisions deferred to pilot.

## Purpose

- The application tracks the **current competitive development landscape** for
  GLP-1-related programs.
- The dataset is a **current-state snapshot**, not an event history.
- Module 5 defines **research and entry rules only**.
- Historical event tracking, validation, automation, and real data entry are
  **outside** this module.

## Dataset scope

### Core inclusion

- GLP-1 receptor agonists.
- GLP-1-containing dual or triple agonists.
- GLP-1-based combination products and GLP-1-based regimens.
- Any route or formulation of the above with a **named developer** and
  **confirmed development intent**.

### Adjacent inclusion

- Non-GLP-1 programs, such as amylin programs, **only** when intentionally
  tracked as direct strategic competitors.
- Adjacent inclusion **requires an explicit reason**. The current JSON schema
  has **no field** for an inclusion rationale — record the reason in research
  output or decision documentation (for example `decision-log.md`) until the
  contract provides a proper field.

### Default exclusion

- GLP-1-unrelated GIP-only or glucagon-only programs.
- Broad metabolic programs without direct relevance.
- Academic-only assets.
- Patent-only assets.
- Rumored or unconfirmed programs.
- Pure generic or biosimilar copies.

A program must have **confirmed development intent**. If program existence
itself is unconfirmed, **exclude it** rather than assigning `Unknown`.
`Unknown` describes an unresolved property of a confirmed program — never an
unconfirmed program.

## Data layout

- `data/companies/<company-id>/company.json`,
  `data/companies/<company-id>/pipeline-programs.json`, and
  `data/companies/<company-id>/regimens.json` are the human-edited operating
  source of truth.
- `data/generated/companies.json` and
  `data/generated/pipeline-programs.json` and `data/generated/regimens.json`
  are deterministic aggregate outputs consumed by loaders. Do not edit
  generated files directly.
- `data/stress-tests/<case-id>/` contains isolated diagnostic references from
  stress-test pilots. Diagnostic archives are excluded from production
  aggregate generation and are not golden expected output.
  `data:validate:stress` checks archive presence, JSON shape, minimum references,
  and diagnostic preservation; it does not certify semantic completeness.
- `data/registries/development-stages.json` and
  `data/registries/regulatory-states.json` and
  `data/registries/company-relationship-roles.json` define the accepted
  controlled vocabulary for stage, regulatory-state, and relationship-role
  entry.

## Operating model

- Existing records are **updated** when mutable facts change.
- Discontinued programs are **retained** when discontinuation is evidenced.
- Approved programs **remain** in the dataset.
- `Unknown` is used **only** when a confirmed program exists but its current
  stage or status cannot be resolved.

## Glossary

- **Company** — the current principal development entity tracked by a record
  (see `entities-and-rows.md`). Not necessarily the originator, licensor,
  licensee, regional rights holder, or every co-development partner.
- **Asset** — one molecular/biologic identity or official combination product
  identity, carrying one stable `assetId` across routes, formulations,
  indications, and development-state changes.
- **Combination asset** — a fixed-dose combination or co-formulation developed
  as one product, represented as one pipeline asset/program with component
  references.
- **Program** — one development configuration of an asset by a company (company
  + asset + route + dosage form, and indication scope where needed to
  distinguish concurrent programs).
- **Regimen** — a development strategy in which multiple independent products
  are administered together; distinct from a pipeline program and combination
  asset.
- **Company relationship** — a program/regimen-level role, rights, or territory
  relationship for an internal or external company.
- **Program identity** — the stable set of properties that defines a program
  and its stable ID. Excludes mutable development stage and status.
- **Mutable development state** — the properties that change over a program's
  life: development stage and development status.
- **Discovery source** — a source used to *find* a candidate (industry news,
  databases, articles, search results). Sufficient to surface, not to confirm.
- **Confirmation source** — a source appropriate to the specific claim being
  entered (see the field-specific source policy). Required before a fact is
  stored.
- **Edge case** — a real situation the current provisional contract cannot
  cleanly represent, logged in `edge-cases.md` for later contract review.
