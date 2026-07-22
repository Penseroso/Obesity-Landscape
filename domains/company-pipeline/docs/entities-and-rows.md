---
role: company-pipeline-semantic-contract
status: active
authority: authoritative
update-boundary: Update when identity, entity, row-splitting, combination, regimen, or reference semantics change.
---

# Entities and Rows

Canonical rules for companies, assets, program identity, mutable state, row
splitting, and stable IDs. Stage and status are mutable state and are never
part of program identity or stable IDs.

## Company

- `companyId` represents the **current principal development entity** tracked by
  that record.
- It does **not** necessarily represent the originator, licensor, licensee,
  regional rights holder, or every co-development partner.
- Additional program/regimen-level company roles, rights, and territories belong
  in `relationships`, not in a company-global record.
- Internal `companyId` references inside components or relationships are local
  to the current company source folder and should normally refer to that
  folder's principal company. Other companies are represented with
  `externalCompanyName`.

## Asset

- An asset is **one molecular or biologic identity** or an official combination
  product identity.
- The same molecule shares **one stable `assetId`** across routes,
  formulations, indications, and development-state changes.
- **`assetId` is immutable.** It never changes for renames, licensing,
  stage/status progression, or any other mutable event.
- **`assetName` is the current official canonical name.** Store the sponsor's
  current official name and spelling; update it when the canonical name changes.
- **Renaming** an asset updates `assetName` and does **not** create a new
  `assetId`, a new asset, or a new program. Record the prior name as an alias
  (below) so search and traceability survive the rename. For example Novo
  Nordisk's `amycretin` asset now uses the canonical `assetName` "Zenagamtide"
  with the former name "Amycretin" preserved as an alias, on the same
  `assetId`.
- **Typed `aliases`** carry an asset's non-canonical labels for search and
  traceability without redefining identity. Each alias has a `type` —
  `former-name`, `development-code`, `brand-name`, or `alternative-spelling` —
  and a `value`. An alias `value` must not repeat the canonical `assetName`.
  Aliases are asset-level: every program row that shares an `assetId` must carry
  the same alias set.
- **`codeName`** stores a single confirmed **internal development code** for the
  asset (for example `ZP8396`), or `null` when none is confirmed. Do not store
  unconfirmed codes, brand names, or former names in `codeName`; those belong in
  `aliases`. `codeName` must **not duplicate** the canonical `assetName`: when
  the development code is itself the canonical name (for example `ASC30` or
  `UBT251`), leave `codeName` `null` rather than repeating the name.
- Fixed-dose combinations and co-formulations keep one stable combination
  `assetId` and may store component references. Component order does not affect
  identity.
- Component `assetId` references are local to the current company source folder.
  Use `assetName` or `codeName` with `externalCompanyName` for another company's
  asset, even when that company or asset exists elsewhere in the tracker. An
  external component reference is allowed whenever no internal asset record
  exists for that component.
- Salt, prodrug, and conjugate identity rules remain **provisional** and must be
  documented as edge cases (see `edge-cases.md`).

## Regimen

- A regimen is a separate entity for multiple independent products administered
  together.
- Do not model a regimen as a pipeline program unless the products are confirmed
  to be one fixed-dose combination or co-formulation product.
- Regimen identity uses principal company, component set, indication or official
  regimen identity, and never development stage or status.
- Component order does not create a distinct regimen.
- Regimen components follow the same local/external reference rule as
  combination components.
- When the same principal company, component set, and indication scope have
  multiple officially distinct regimen configurations, use `configurationKey` as
  the stable discriminator only when those configurations remain meaningfully
  distinct independently of trial-arm dosing. Display name, stage, status,
  dates, results, dose, dose ratio, titration schedule, cohort, clinical trial
  arm, and arbitrary suffixes must not be used as `configurationKey`.
- Dose or trial-arm differences do not create regimen identities. For example,
  dose arms of `bimagrumab + semaglutide` are one component-level regimen under
  Contract 1.1; dose-level arms belong to the future Clinical Evidence Arm
  layer, not the current regimen registry.
- If a second regimen needs a `configurationKey` but the official configuration
  discriminator cannot be confirmed, defer it instead of inventing one.

## Combination and regimen boundaries

- A **fixed-dose combination** or **co-formulation** is developed and
  administered as **one product**. Model it as **one** combination asset/program
  (`assetType` `fixed-dose-combination` or `co-formulation`) with a stable
  combination `assetId` and component references — never as a regimen.
- A **regimen** is multiple **independently administered** products used
  together. Model it as a separate **regimen record**, never as a pipeline
  program row, unless the products are confirmed to be one fixed-dose
  combination or co-formulation.
- Do not infer a fixed-dose/co-formulation relationship, a regimen relationship,
  or component identity from context; each requires official evidence
  (see `source-and-entry-policy.md`).
- Combination and regimen components may use **external component references**
  (`assetName`/`codeName` plus `externalCompanyName`) whenever no internal asset
  record exists for the component.

### Mechanism family

[`mechanism-families.json`](../data/registries/mechanism-families.json) is the
sole authority for grouping assets by pharmacology. A family is defined by its
normalized **target and pharmacologic action** set — so a GIP receptor *agonist*
and a GIP receptor *antagonist* are different families even though the target is
the same, and a peptide and a non-peptide GLP-1 receptor agonist are the same
family even though the modality differs.

- Resolution is **exact-string lookup** on the stored `technical.mechanism`. The
  free text is never parsed, normalized, or substring-matched.
- A family's identity is its **semantic signature**: `composition` plus its
  normalized, sorted target/action pairs. The validator rejects two ids that
  carry the same signature, a family that repeats a target/action pair, and two
  families whose normalized labels collide — so one pharmacologic class cannot be
  split across two families by reordered, differently cased, or duplicated
  target entries. `npm run data:probe:mechanism-families` verifies each of those
  rejections against mutated copies of the live registry.
- **Modality never enters family identity.** Antibody, peptide, non-peptide, and
  small-molecule are recorded in the component `role` text and in
  `technical.platform`, never in a family `label` or in a target `action`. An
  antibody that blocks a receptor is recorded as `blockade`, not as
  `antibody blockade`.
- `composition` separates a **single molecule acting on several targets** from a
  **product built from several components**, and the two are never merged even
  when their target sets are identical. Zenagamtide (unimolecular GLP-1 plus
  amylin) and CagriSema (cagrilintide plus semaglutide) reach the same targets
  and stay in different families, because a reader comparing them is comparing
  different things.
- A **combination asset** resolves through its own `technical.mechanism` like any
  other row; its component mechanisms are never decomposed to derive a family.
- A **regimen** has no `technical` block, so it carries an authored
  `mechanismFamilyId` naming a `multi-component` family. Component `role` text is
  never parsed to infer one. Absent means unassigned — a comparison surface
  reports such a regimen as a coverage gap rather than bucketing it as "other".

### Study classification

Before creating or updating any row, classify the surfaced study or program on
**two independent axes**:

- **Intervention model** — exactly one of:
  - **monotherapy** — the focal asset alone, per protocol.
  - **combination product** — a fixed-dose combination or co-formulation (see
    above).
  - **regimen** — independently administered products used together (see
    above).
  - **add-on/background-therapy program** — the focal asset is studied on top
    of a required concomitant or background therapy that is **not** a
    confirmed regimen component.
- **Protocol structure** — exactly one of:
  - **standalone** — a single trial registration with one indication scope.
  - **platform/master protocol** — one sponsor protocol that formally nests
    multiple distinct indications or sub-studies under one trial
    registration.

These axes are **independent**: a platform/master protocol may test a
monotherapy, a combination product, a regimen, or an add-on/background-therapy
program in any of its nested sub-studies. Classify each nested sub-study's
intervention model on its own; the protocol-structure classification does not
determine it.

A study whose protocol requires a concomitant or background therapy — whether
or not that therapy is a confirmed regimen component — is **not** monotherapy
evidence for the focal asset. Do not attribute its indications to the focal
asset's monotherapy row.

**A named background product is not automatically a regimen.** Regimen
classification requires official evidence that the sponsor treats the
co-administration as a **distinct development configuration or investigational
combination strategy** — for example, an "alone or in combination" trial
design that names both products as the deliberate intervention being
evaluated — not merely that the protocol names a specific background product.
**Protocol-required standard-of-care background therapy remains background
therapy** (for example, background basal insulin or metformin in a diabetes
trial) even when the product is named, unless the sponsor separately develops
that named product as a combination strategy with the focal asset. If the
co-administration is not confirmed as a distinct development configuration,
classify the study as an add-on/background-therapy program and **defer** it
(see `edge-cases.md`) rather than folding it into an existing row or inventing
a regimen record.

A platform or master protocol evidences only the indications its source
**explicitly nests** — a named sub-population, sub-study, or dedicated outcome
measure — not every indication of its general population by inference. See
`source-and-entry-policy.md` for the evidence standard required to attribute a
nested indication.

## Licensed and in-licensed assets

- A licensed or in-licensed asset that the principal company develops is tracked
  as a **company-local program row** under that company, reusing the standard
  identity rules.
- Record the company role, rights, territory, and effective date in
  program/regimen `relationships`; keep the principal `companyId` singular
  (ADR-0018, ADR-0019). For example Novo Nordisk's `ubt251` row is company-local
  while the originator/licensor roles, territories, rights, and effective date
  are captured in `relationships`.

## Program identity

Define stable program identity using:

- company
- asset
- route
- dosage form
- indication scope **when needed** to distinguish concurrently different
  development programs

**Do not** include mutable stage or status values in program identity or in
stable IDs.

## Mutable state

Treat these as **mutable properties**, not identity:

- development stage
- development status
- regulatory state details

- When a program progresses from **Phase 1 to Phase 2**, update the existing
  record rather than creating a new record solely because the stage changed.
- When a program changes from **Active to Discontinued**, update the existing
  record rather than creating a new record solely because the status changed.
- When a program receives **IND submitted** or **IND cleared** evidence, use
  that milestone as `development.stage` when it is the most advanced official
  current stage for the program scope. Preserve jurisdiction, authority, and
  date in regulatory-state details when available, and do not approximate the
  milestone as a clinical phase.
- When an asset or program is **renamed**, update `assetName` and add the former
  name as a `former-name` alias. Do **not** create a new record, `assetId`, or
  program `id`; a rename is a display change over stable identity.

## Row splitting

Create **separate program rows** when concurrently active records differ by:

- responsible company
- route
- dosage form
- indication scope **with a different stage, status, or operational state**
- indication or program scope with a different current `development.stage`,
  status, or `stageOperationalState` for the same asset, route, and dosage form
- another development configuration that cannot be represented in one row

Do not create a new row for ordinary sequential progression of the same program
scope; update the existing row instead. For example, Zealand petrelintide may
have a Phase 2 obesity/overweight row and a planned Phase 3 chronic
weight-management row because the current program scopes differ.

Create **regimen records**, not program rows, when multiple independent products
are only being co-administered.

Multiple indications may **share one row** only when **all** of the following
are the same:

- company
- asset
- route
- dosage form
- stage
- status
- operational state (`development.stageOperationalState`)

This equality is **necessary but not sufficient**. Merging additionally
requires **both**:

- the records belong to the **same sponsor-defined development program or
  trial family** (for example, the same named platform/master protocol or
  umbrella trial program) — not merely records that happen to share a stage,
  status, and operational state; and
- the attached source bundle **directly supports the full merged scope** — an
  indication is not carried into a row on the strength of a broader pipeline
  summary or an unrelated trial in the same asset's program.

If indications have a different stage, development status, or operational
state, split them into separate rows. If they match on all of the fields above
but still fail either merge condition, do not merge them: split into a separate
row if it can be represented cleanly, or **defer** the indication (see
`edge-cases.md`) rather than merging on state equality alone or inferring
evidence. Content rules for what may populate `indications` are defined in
`source-and-entry-policy.md`, not here.

## Stable IDs

- Company IDs, asset IDs, and program IDs remain **stable**.
- Renaming display values does **not** change IDs.
- Stage and status must **not** appear in stable program IDs.
- Program IDs may use a **stable configuration suffix** (for example, to
  distinguish route or dosage form).
- **Do not** prescribe a final suffix algorithm before pilot data exists; the
  exact scheme is deferred (see `decision-log.md`).

### Deterministic IDs for new records

When a record needs an ID, follow these deterministic rules:

- Search existing identities and **reuse an existing ID first**; only mint a new
  ID when no existing identity matches.
- **`companyId`** — lowercase kebab-case slug of the canonical official company
  name.
- **`assetId`** — lowercase kebab-case slug of the official development code when
  available; otherwise of the canonical asset name.
- **`programId`** — stable combination of `companyId`, `assetId`, route, and
  dosage form. Add an indication-scope suffix **only when needed** to distinguish
  concurrent programs.
- **Never** include mutable stage or status in an ID.
- Normalize whitespace and punctuation consistently.
- IDs remain unchanged after renaming, licensing, stage progression, or status
  changes.
- Check for **collisions** before creating an ID. When a collision cannot be
  resolved from verified identity information, **defer** rather than invent an
  arbitrary ID.
