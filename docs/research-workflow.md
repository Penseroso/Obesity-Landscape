# Company Research & Update Workflow

One workflow for a research agent (Codex, Claude Code, or similar) to research a
company and update its records in a **single execution**. The normal input is a
company name; the agent decides everything else automatically.

This workflow is subordinate to the data protocol, whose entry point is
[`docs/data-protocol/README.md`](./data-protocol/README.md). The data protocol
is the authoritative research and entry policy and reflects Contract 1.1
(ADR-0030). Where this document is silent, the data protocol governs; where the
data protocol defines scope, evidence, identity, row, or entry rules, they apply
here unchanged.

## 1. Single company-research entry point

A **company name is the normal input**. Commands such as `Research Company A` or
`Update Company A` are equivalent triggers, not distinct modes.

Before any research, the agent **inspects the current source datasets**
(`data/companies/<company-id>/company.json`,
`data/companies/<company-id>/pipeline-programs.json`,
`data/companies/<company-id>/regimens.json`, and generated aggregate files as a
readback check) and decides internally:

- **company absent** → perform an **initial company-wide investigation**.
- **company or related records present** → perform a **refresh** against the
  existing records.

The wording of the request never overrides the data:

- a request worded as **"update"** for an **unregistered** company still becomes
  an **initial investigation**.
- a request worded as **"research"** for an **existing** company still becomes a
  **refresh**.

These are **internal decisions**. Do not expose them as user-facing modes, do
not require the user to select one, and do not require any mode parameter.

## 2. Research flow

The overall path is the same regardless of the internal decision:

```text
company-centred discovery
-> in-scope asset inventory
-> asset / code-name reverse search
-> intervention-model (single asset, combination product, regimen, or
add-on/background-therapy) and protocol-structure (standalone or
platform/master-protocol) classification
-> registry, partner, rights, and official-source verification
-> comparison with existing records
-> confirmed record creation or update
-> registry promotion when needed and justified
-> mandatory coverage audit with an independent second discovery pass
-> aggregate regeneration and validation
-> unresolved items deferred and reported
```

**Review each official source completely.** When a source is opened for one
record, extract every distinct development entity and configuration it discloses
(other assets, additional routes or formulations, combination products,
regimens, and company relationships), not only the record that led you to it. A
single release often announces multiple programs.

Apply scope at the **asset level**. Once an asset qualifies for the core
landscape by mechanism or confirmed obesity/weight-management program intent,
investigate all of its current official programs that Contract 1.1 can
represent; do not limit discovery to obesity-indication rows. Continue to
exclude unrelated non-core assets and programs under the existing scope rules.
Split program rows when stage, development status, or operational state
differs. That equality is necessary but not sufficient to merge: merge
indications only when company, asset, route, dosage form, stage, status, and
operational state are identical, the records belong to the same
sponsor-defined development program or trial family, and the source bundle
directly supports the full merged scope — otherwise defer (see the data
protocol's row-splitting rule). A study requiring background or concomitant
therapy is not monotherapy evidence for the focal asset; classify it per the
data protocol before recording indications.

### Initial investigation

- Inspect the company's **current pipeline broadly**.
- Identify **all** candidates relevant to the Module 5 scope (see the data
  protocol's dataset scope).
- Classify candidates as **entered**, **merged**, **deferred**, or **excluded**.
- Verify **each included asset independently**.
- Do **not** research only the first obvious asset.

### Refresh

- **Read all existing records** for the company first.
- **Recheck each existing program.**
- Search for **newly disclosed** assets and configurations.
- **Compare** current evidence with stored values.
- **Preserve** confirmed existing values when newer evidence is absent.
- Do **not** infer discontinuation from pipeline disappearance.
- Do **not** infer program discontinuation from a completed trial.

## 3. Automatic record update

Research and record update occur in the **same execution**. There is no separate
"apply results" step and no human approval gate.

**Automatically create or update** a record only when **all** hold:

- the program is within the **Module 5 scope**.
- **company and asset identity** are sufficiently confirmed.
- **required non-null fields** are confirmed (route, dosage form, indication,
  asset identity, responsible company).
- sources satisfy the **field-specific source policy**.
- any new development-stage, regulatory-state, or company-relationship-role
  vocabulary has been promoted to the relevant registry under the registry
  promotion rules.
- the record **can be represented** by the current contract.
- the record is **not a duplicate configuration**.

**Do not enter:**

- guessed values.
- incomplete records missing required fields.
- unresolved asset identity.
- unsupported primary-company assignments.
- facts that cannot be represented by the current enums or contract.
- stage or regulatory-state approximations that lose official semantic
  precision.
- unconfirmed component identity, regimen identity, company role, rights, or
  territory.
- another company's asset or company represented as an internal `assetId` or
  `companyId`.

Unresolved findings must be **reported but must not block** valid records from
the same company. One unresolvable asset does not prevent entering the
company's other, fully confirmed assets.

**Classify every surfaced entity.** Each named program, formulation, combination
product, regimen, or relationship surfaced during research must end the run in
exactly one of four states:

- **entered** — confirmed and representable, so a record was created or updated.
- **merged** — confirmed but consolidated into an existing record under the row
  or regimen-granularity rules, with the destination record identified.
- **deferred** — with a specific reason (for example, unconfirmed route,
  unconfirmed configuration discriminator, or ambiguous identity).
- **excluded** — with a scope or evidence reason (for example, out of dataset
  scope, or existence unconfirmed).

Nothing surfaced may be silently dropped.

## 4. Mandatory coverage audit

After confirmed records have been created or updated — and before aggregate
regeneration, validation, and reporting — run a **coverage audit**. Its purpose
is recall: catching in-scope candidates the primary research pass missed. It is
mandatory in every run, initial investigation and refresh alike.

**Audit checks.** Reconcile every relevant entry in the sponsor's current
official pipeline and trial sources against operating data, then recheck each of
the following against the run's classified candidates:

- the company's **official pipeline page and current investor materials**
  (pipeline slides, annual and quarterly reports, R&D-day presentations).
- **approved and regulatory-filed obesity products**, not only
  development-stage pipeline entries.
- **sponsor-based, asset-name, and code-name registry searches** (for example,
  trial registries queried by sponsor and by each known asset name or
  development code).
- **licensed, acquired, partnered, renamed, and historical assets** — assets
  obtained or divested through licensing or acquisition, assets held with
  partners, assets known under earlier names or codes, and legacy programs that
  no longer appear in the current pipeline presentation.

Every candidate the audit surfaces must be classified under the rules above:
**entered**, **merged**, **deferred**, or **excluded**, with a reason. Nothing
found in the sponsor's current official pipeline or trial sources may be
silently omitted.

**Independent second discovery pass.** After the audit checks, repeat discovery
**once, independently**: re-run company-centred discovery from scratch, without
starting from the first pass's source list or asset inventory.

**Completion gate.** If the second pass surfaces any candidate not already
classified in this run, the run is **not complete**: research and classify the
new candidate under the full workflow rules, then repeat the independent
discovery pass. Do not report completion while the latest pass still surfaces a
new candidate.

The audit is in-run only. Report its outcome in the final response (see result
reporting); do not persist a research ledger or per-run report file (see
non-goals).

## 5. Existing-record protection

- **Reuse** stable company, asset, and program IDs.
- Do **not** regenerate IDs because names, stage, or status changed.
- On a **rename**, update `assetName` to the current canonical name and record
  the former name as a `former-name` alias; keep the same `assetId` and program
  `id`. A rename never creates a new asset or program.
- Capture confirmed former names, development codes, brand names, and
  alternative spellings as typed `aliases`, identical across all rows sharing an
  `assetId`.
- **Update** stage/status in the existing record (they are mutable state).
- Do **not** delete old values solely because current sources omit them.
- Do **not** replace strong existing evidence with weaker secondary reporting.
- **Preserve** useful historical sources for identity, licensing, or
  prior-state support.
- **Avoid duplicate** source entries.

## 6. Deterministic ID rules

These ID rules operate under Contract 1.1 (ADR-0030). Only the exact program-ID
suffix scheme remains a v2 backlog item (see the data protocol's deferred
decisions); keep suffixes stable and minimal until it is decided.

Before creating any record, **search existing company, asset, and program
identities and reuse existing IDs whenever applicable.**

For new records:

- **`companyId`** — lowercase kebab-case slug of the canonical official
  company name.
- **`assetId`** — lowercase kebab-case slug of the official development code
  when available; otherwise the canonical asset name.
- **`programId`** — a stable combination of `companyId`, `assetId`, route, and
  dosage form.
- Add an **indication-scope suffix only when required** to distinguish
  concurrently active programs (see the row-splitting rules in the data
  protocol).
- **Never include stage or status in an ID.**
- **Normalize whitespace and punctuation consistently** when slugging.
- **Do not change IDs** after renaming, licensing, stage progression, or
  status change — IDs are stable; the data protocol's mutable-state rules
  still apply to the record's content.
- **Check for collisions** before creation.
- When a deterministic collision **cannot be resolved from verified identity
  information**, **defer the record** instead of inventing an arbitrary ID.

## 7. Company creation rule

The current `Company` contract requires:

- canonical company name
- `headquartersCountry`

**Create a new Company record only when both are confirmed** from reliable
current sources.

If headquarters country is **unresolved**:

- do **not** guess.
- do **not** create a partial Company record.
- **defer** and report the company/program finding instead.

## 8. Metadata updates

When **stored values change**:

- update `updatedAt`.
- update `lastVerifiedAt`.
- add or update relevant source references and their `checkedAt`.

When a record is **reverified without a value change**:

- **keep** `updatedAt` (unchanged).
- update `lastVerifiedAt`.
- update source verification metadata where appropriate.

Do **not** mark unrelated programs as reverified when they were not actually
checked in this run.

## 9. Registry updates

Development-stage, regulatory-state, and company-relationship-role values are
registry-backed. During a company research execution, promote a new registry
value in the same commit as the program/regimen data only when the data
protocol's registry promotion criteria are met. Use an existing canonical label
when a source phrase is only an alias, stylistic variant, case variant, or Roman
numeral spelling of an existing concept. If officiality or semantic distinctness
is unclear, defer the finding instead of approximating it.

## 10. Combination, regimen, and relationship handling

For each candidate, distinguish on two independent axes.

Intervention model:

- single asset (monotherapy) program.
- fixed-dose combination or co-formulation program.
- regimen of independently administered products — only when the sponsor
  treats the co-administration as a distinct development configuration (for
  example an "alone or in combination" trial design); a named background
  product studied only as protocol-required standard-of-care is not a
  regimen.
- add-on/background-therapy program — a concomitant or background therapy
  required by the protocol that is not a confirmed regimen component; not
  monotherapy evidence for the focal asset.

Protocol structure:

- standalone trial.
- platform or master protocol — may test any intervention model above in its
  nested sub-studies; evidences only its explicitly nested indications, not
  the general population by inference.

Also distinguish program/regimen-level co-development, licensing, regional
rights, trial sponsor, commercialization, manufacturing, or other confirmed
company relationship.

Do not infer component identity, FDC versus regimen status, principal-company
adjacent roles, rights, territory, or external asset developer. Store confirmed
company relationships at the program or regimen level while preserving the
principal `companyId`.

Internal component `assetId` and internal relationship/component `companyId`
references are local to the company source folder being edited. Use
`externalCompanyName` with `assetName` or `codeName` for another company's
asset. Use `externalCompanyName` for another company relationship. Do not link
to another company folder or convert external names into internal IDs during
research or generation.

This trade-off keeps company research independent, allows external assets
outside tracker scope, and keeps validation/generation simple. The limitation is
that the same external asset may appear by name in multiple company records, and
aliases or renames are not unified until a future cross-company entity
resolution module exists.

When official evidence confirms **future regimen development intent** but
regimen-specific development has not started or its stage is not disclosed, use
`status: "Planned"` and `stage: "Unknown"` where appropriate. Do **not** inherit
stage, status, or administration details from the component programs — a regimen
is a distinct entity, not the sum of its components.

When two regimens share the same principal company, component set, and
indication scope, create separate records only if an official stable
product or regimen configuration is confirmed and remains meaningfully distinct
independently of trial-arm dosing. Store that discriminator in
`configurationKey` and use it as the basis for any stable regimen ID suffix.
Dose, dose ratio, titration schedule, cohort, and clinical trial arm differences
do not create regimen identities; they belong to the future Clinical Evidence
Arm layer. Do not use display name, stage/status, results, dates, dosing, or
arbitrary numbering.
If only one of the related records has `configurationKey`, or the discriminator
is not official, defer the ambiguous record.

## 11. Result reporting

There is **no rigid report schema**, no fixed table set, and no mandatory
section order. Choose a form appropriate to the company's complexity — tables,
asset-by-asset sections, or concise lists are all acceptable.

Whatever the form, the final response must communicate:

- whether the run was treated as an **initial investigation or a refresh**.
- the **relevant assets** found.
- records **created or changed**.
- important records **reverified without change**.
- findings **merged, deferred, or excluded**, and why.
- the **coverage-audit outcome** — either that the final independent discovery
  pass surfaced no unclassified candidate, or which new candidates the audit
  surfaced and how each was classified.
- the **main supporting sources**.
- registry additions, if any.
- **generated aggregates regenerated** with `npm run data:generate` when
  operating data changed; generated files are outputs, never hand-edited.
- **validation results** — these are local checks; this repository has no
  GitHub Actions CI.
- any **blockers or evidence-access failures**.

## 12. Failure handling

Before modifying any data, verify that **current external sources can actually
be accessed**.

If current-source research is unavailable:

- do **not** claim that research was completed.
- do **not** modify company or program records.
- **report the access limitation clearly**.

A record must never be created or updated from memory or assumption when live
sources could not be reached.

## 13. Non-goals

This workflow does **not** introduce:

- user-selected research modes.
- a human approval workflow.
- a separate result-application command.
- scraping infrastructure.
- scheduled automation.
- a database.
- an input UI.
- stored per-run research reports.
