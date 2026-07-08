# Data Protocol

Operating rules for competitor pipeline research and pilot data entry.

This protocol (Module 5) defines **how data is researched and entered**. The v1
data contract — the TypeScript types in `lib/programs/types.ts`, the
`data/registries/` vocabularies, the `scripts/data-registry.mjs` validators, and
these protocol documents — is **frozen** by ADR-0025. The schema is not
redesigned in v1; remaining structural gaps are logged as edge cases and
deferred to the [v2 backlog](#v2-backlog) rather than resolved by schema changes
now. Individual fields still noted as "provisional" or "open until pilot" mark
where a future v2 change is expected; they do not reopen the frozen v1 contract.

## Start here

Read this file first, then follow the authoritative document for the topic at
hand. Each rule has **one** authoritative home; other documents cross-reference
it instead of restating it at length.

| Topic | Authoritative source |
| --- | --- |
| Fixed decisions, ADR history, current-decision index | [`decision-log.md`](./decision-log.md) |
| Identity, mutable state, row splitting, stable IDs, combinations, regimens | [`entities-and-rows.md`](./entities-and-rows.md) |
| Evidence hierarchy, stage semantics, source rules, field entry, dates, registry promotion | [`source-and-entry-policy.md`](./source-and-entry-policy.md) |
| Structural cases the v1 contract cannot yet represent (v2 backlog) | [`edge-cases.md`](./edge-cases.md) |
| What `data/generated/` guarantees to downstream consumers | [`generated-output-contract.md`](./generated-output-contract.md) |
| Dataset scope, data layout, operating model, glossary | [`README.md`](./README.md) (this file) |

The company-research workflow
([`docs/research-workflow.md`](../research-workflow.md)) and the reusable prompt
([`prompts/research-company.md`](../../prompts/research-company.md)) apply this
protocol and point here for scope, evidence, identity, row, and entry rules
rather than restating them.

A point-in-time check that the registries, TypeScript types, validators,
operating data, and generated outputs agree is recorded in
[`consistency-audit.md`](./consistency-audit.md).

## Frozen v1 contract at a glance

A compact map of the frozen v1 contract. Each line links to its authoritative
rule; the governing ADRs are noted in parentheses.

- **Identity is stable and company-local.** Company, asset, and program IDs are
  stable and reused; other companies and their assets are represented by name
  with `externalCompanyName`, with no global entity graph. See
  [`entities-and-rows.md`](./entities-and-rows.md) (ADR-0002, ADR-0022).
- **Stage and status are mutable, never identity.** They update the existing
  record and never appear in stable IDs. See
  [`entities-and-rows.md`](./entities-and-rows.md) (ADR-0003, ADR-0004).
- **`development.stage` is the most advanced official current development
  stage** for the specific program scope. Clinical phase is one category within
  it; regulatory-development milestones such as `IND submitted` and
  `IND cleared` are valid stages when they are the most advanced official
  current stage, and are never approximated as clinical phases. `stageBasis` and
  `stageOperationalState` annotate the evidence basis and operational state, and
  `regulatoryStates` preserves jurisdiction, authority, and date. See
  [`source-and-entry-policy.md`](./source-and-entry-policy.md) (ADR-0024).
- **Combinations versus regimens.** Fixed-dose combinations and co-formulations
  are one combination asset/program with component references; independently
  administered products are regimens. See
  [`entities-and-rows.md`](./entities-and-rows.md) (ADR-0016, ADR-0017).
- **Provenance is record-level.** `metadata.sources` collectively cover the key
  claims; field-level provenance is deferred. See
  [`source-and-entry-policy.md`](./source-and-entry-policy.md).
- **Operating data versus generated aggregates.** `data/companies/` folders are
  the human-edited operating source of truth; `data/generated/*.json` are
  deterministic aggregates produced by `data:generate` and must not be edited
  directly (ADR-0011).

## v2 backlog

Deferred to v2; none is implemented in v1. Treatment and status live in
[`edge-cases.md`](./edge-cases.md) and the deferred-decisions list in
[`decision-log.md`](./decision-log.md):

- field-level provenance
- durable adjacent-inclusion rationale field
- excluded/deferred candidate ledger
- program-ID suffix scheme
- salts, prodrugs, conjugates, and other open-until-pilot identity cases
- per-jurisdiction approval modeling
- cross-company entity resolution
- relationship / regimen UI

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
