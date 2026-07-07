# Company Research & Update Workflow

One workflow for a research agent (Codex, Claude Code, or similar) to research a
company and update its records in a **single execution**. The normal input is a
company name; the agent decides everything else automatically.

This workflow is subordinate to [`docs/data-protocol/`](./data-protocol/), which
is the authoritative research and entry policy. Where this document is silent,
the data protocol governs; where the data protocol defines scope, evidence,
identity, row, or entry rules, they apply here unchanged.

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
-> single asset, combination product, regimen, and background therapy split
-> registry, partner, rights, and official-source verification
-> comparison with existing records
-> confirmed record creation or update
-> registry promotion when needed and justified
-> aggregate regeneration and validation
-> unresolved items deferred and reported
```

### Initial investigation

- Inspect the company's **current pipeline broadly**.
- Identify **all** candidates relevant to the Module 5 scope (see the data
  protocol's dataset scope).
- Distinguish **included**, **excluded**, and **unresolved** candidates.
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

## 4. Existing-record protection

- **Reuse** stable company, asset, and program IDs.
- Do **not** regenerate IDs because names, stage, or status changed.
- **Update** stage/status in the existing record (they are mutable state).
- Do **not** delete old values solely because current sources omit them.
- Do **not** replace strong existing evidence with weaker secondary reporting.
- **Preserve** useful historical sources for identity, licensing, or
  prior-state support.
- **Avoid duplicate** source entries.

## 5. Deterministic ID rules (provisional)

These are **provisional operating rules**, subject to review after the first
pilot.

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

## 6. Company creation rule

The current `Company` contract requires:

- canonical company name
- `headquartersCountry`

**Create a new Company record only when both are confirmed** from reliable
current sources.

If headquarters country is **unresolved**:

- do **not** guess.
- do **not** create a partial Company record.
- **defer** and report the company/program finding instead.

## 7. Metadata updates

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

## 8. Registry updates

Development-stage, regulatory-state, and company-relationship-role values are
registry-backed. During a company research execution, promote a new registry
value in the same commit as the program/regimen data only when the data
protocol's registry promotion criteria are met. Use an existing canonical label
when a source phrase is only an alias, stylistic variant, case variant, or Roman
numeral spelling of an existing concept. If officiality or semantic distinctness
is unclear, defer the finding instead of approximating it.

## 9. Combination, regimen, and relationship handling

For each candidate, distinguish:

- single asset program.
- fixed-dose combination or co-formulation program.
- regimen of independently administered products.
- external background therapy.
- program/regimen-level co-development, licensing, regional rights, trial
  sponsor, commercialization, manufacturing, or other confirmed company
  relationship.

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

When two regimens share the same principal company, component set, and
indication scope, create separate records only if an official stable
configuration discriminator is confirmed. Store that discriminator in
`configurationKey` and use it as the basis for any stable regimen ID suffix.
Do not use display name, stage/status, results, dates, or arbitrary numbering.
If only one of the related records has `configurationKey`, or the discriminator
is not official, defer the ambiguous record.

## 10. Result reporting

There is **no rigid report schema**, no fixed table set, and no mandatory
section order. Choose a form appropriate to the company's complexity — tables,
asset-by-asset sections, or concise lists are all acceptable.

Whatever the form, the final response must communicate:

- whether the run was treated as an **initial investigation or a refresh**.
- the **relevant assets** found.
- records **created or changed**.
- important records **reverified without change**.
- findings **deferred or excluded**, and why.
- the **main supporting sources**.
- registry additions, if any.
- **validation results**.

## 11. Failure handling

Before modifying any data, verify that **current external sources can actually
be accessed**.

If current-source research is unavailable:

- do **not** claim that research was completed.
- do **not** modify company or program records.
- **report the access limitation clearly**.

A record must never be created or updated from memory or assumption when live
sources could not be reached.

## 12. Non-goals

This workflow does **not** introduce:

- user-selected research modes.
- a human approval workflow.
- a separate result-application command.
- scraping infrastructure.
- scheduled automation.
- a database.
- an input UI.
- stored per-run research reports.
