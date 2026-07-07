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
- **Renaming** an asset does **not** create a new `assetId`.
- Fixed-dose combinations and co-formulations keep one stable combination
  `assetId` and may store component references. Component order does not affect
  identity.
- Component `assetId` references are local to the current company source folder.
  Use `assetName` or `codeName` with `externalCompanyName` for another company's
  asset, even when that company or asset exists elsewhere in the tracker.
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
- regulatory state

- When a program progresses from **Phase 1 to Phase 2**, update the existing
  record rather than creating a new record solely because the stage changed.
- When a program changes from **Active to Discontinued**, update the existing
  record rather than creating a new record solely because the status changed.
- When a program receives **IND submitted** or **IND cleared** evidence, update
  regulatory-state data without promoting or approximating the development
  stage unless actual development-stage evidence also changed.

## Row splitting

Create **separate program rows** when concurrently active records differ by:

- responsible company
- route
- dosage form
- indication scope **with a different stage or status**
- another development configuration that cannot be represented in one row

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
