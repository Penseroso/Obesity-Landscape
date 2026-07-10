# Entities and Rows

Working rules for companies, assets, program identity, mutable state, row
splitting, and stable IDs. These rules **refine and supersede** the simplified
"Program Row Rule" in the root `README.md`; where the two differ, this document
governs. The most important refinement: the root rule historically implied that
stage and status help distinguish records — under this protocol **stage and
status are mutable state and are never part of program identity or stable IDs**.

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
  `aliases`.
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
  the stable discriminator. Display name is not stable identity. Stage, status,
  dates, results, and arbitrary suffixes must not be used as `configurationKey`.
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
- indication scope **with a different stage or status**
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

If indications have **different stages or statuses**, split them into separate
rows.

## Stable IDs

- Company IDs, asset IDs, and program IDs remain **stable**.
- Renaming display values does **not** change IDs.
- Stage and status must **not** appear in stable program IDs.
- Program IDs may use a **stable configuration suffix** (for example, to
  distinguish route or dosage form).
- **Do not** prescribe a final suffix algorithm before pilot data exists; the
  exact scheme is deferred (see `decision-log.md`).

## Relationship to the root README rule

The root `README.md` keeps a concise "Program Row Rule" for orientation. This
document is the authoritative source. Specifically, it:

- **Supersedes** any implication that stage or status contributes to permanent
  program identity — here they are mutable state that updates existing records.
- **Refines** "separate records for different routes/dosage forms" by tying row
  splitting to concurrently active development configurations.
- **Adds** the indication-scope condition (same company/asset/route/dosage
  form/stage/status) for when indications may share a row.
