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

Before any research, the agent **inspects the current datasets**
(`data/companies.json`, `data/pipeline-programs.json`) and decides internally:

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
-> registry, partner, rights, and official-source verification
-> comparison with existing records
-> confirmed record creation or update
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
- the record **can be represented** by the current contract.
- the record is **not a duplicate configuration**.

**Do not enter:**

- guessed values.
- incomplete records missing required fields.
- unresolved asset identity.
- unsupported primary-company assignments.
- facts that cannot be represented by the current enums or contract.

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

## 5. Metadata updates

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

## 6. Result reporting

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
- **validation results**.

## 7. Failure handling

Before modifying any data, verify that **current external sources can actually
be accessed**.

If current-source research is unavailable:

- do **not** claim that research was completed.
- do **not** modify company or program records.
- **report the access limitation clearly**.

A record must never be created or updated from memory or assumption when live
sources could not be reached.

## 8. Non-goals

This workflow does **not** introduce:

- user-selected research modes.
- a human approval workflow.
- a separate result-application command.
- scraping infrastructure.
- scheduled automation.
- a database.
- an input UI.
- a new schema.
- a validator.
- stored per-run research reports.
