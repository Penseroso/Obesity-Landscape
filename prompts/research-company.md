# Prompt: Research and update records for a company

Reusable agent prompt. Replace `<COMPANY_NAME>` with the target company. The
conceptual command is simply:

> Research and update records for `<COMPANY_NAME>`.

No structured inputs are required or accepted — do **not** expect or ask for
`mode`, `writeData`, `asOfDate`, `lastVerifiedAt`, an approval status, or any
other parameter. The company name is the only input.

---

You are researching **`<COMPANY_NAME>`** for the GLP-1 Pipeline Board and
updating its records in the same execution. Follow these steps:

1. **Read the policy.** Read [`docs/data-protocol/`](../docs/data-protocol/) and
   [`docs/research-workflow.md`](../docs/research-workflow.md). They are
   authoritative for scope, evidence, identity, row, and entry rules.

2. **Inspect current data.** Read `data/companies.json` and
   `data/pipeline-programs.json`, plus `lib/programs/types.ts` for the current
   contract. Find any existing records for `<COMPANY_NAME>` and its programs.

3. **Choose the approach automatically.** If the company is absent, perform an
   **initial company-wide investigation**; if the company or related records are
   present, perform a **refresh**. The request wording never overrides the data.
   Do not expose this as a user-facing mode.

4. **Discover, then verify.** Perform company-centred discovery of the current
   pipeline, build an in-scope asset inventory, run asset/code-name reverse
   searches, and verify each included asset independently against registry,
   partner, rights, and official sources. Do not stop at the first obvious
   asset.

5. **Apply the Module 5 rules.** Enforce the dataset scope, stage evidence
   thresholds, entity/asset/program identity, row-splitting rules, and
   field-entry rules from the data protocol.

6. **Update records in the same execution.** Automatically create or update a
   company/program record only when it is in scope, identity and required
   non-null fields are confirmed, sources satisfy the field-specific source
   policy, it is representable by the current contract, and it is not a duplicate
   configuration.

7. **Defer, do not block.** Report unsupported or structurally unresolved
   findings (ambiguous ownership, unrepresentable configurations, unconfirmed
   identity) without blocking the company's other valid updates.

8. **Protect existing data.** Reuse stable company, asset, and program IDs;
   never regenerate them because a name, stage, or status changed. Update
   mutable stage/status in place. Do not delete confirmed values merely because
   current sources omit them, and do not overwrite strong evidence with weaker
   secondary reporting. Preserve useful historical sources; avoid duplicates.

9. **Apply the provisional deterministic ID rules when creating new records.**
   Search existing identities first and reuse IDs whenever applicable. For new
   IDs: `companyId` is a lowercase kebab-case slug of the canonical official
   company name; `assetId` is a lowercase kebab-case slug of the official
   development code when available, otherwise the canonical asset name;
   `programId` stably combines `companyId`, `assetId`, route, and dosage form,
   with an indication-scope suffix only when required to distinguish
   concurrent programs. Never include stage or status in an ID. Check for
   collisions before creation; if a collision cannot be resolved from verified
   identity information, defer the record rather than inventing an arbitrary
   ID. These rules are provisional pending the first pilot.

10. **Apply the Company creation rule.** Create a new `Company` record only
    when both the canonical company name and `headquartersCountry` are
    confirmed from reliable current sources. If `headquartersCountry` is
    unresolved, do not guess and do not create a partial Company record —
    defer and report the finding instead.

11. **Use current dates for verification metadata.** On a value change, update
   `updatedAt` and `lastVerifiedAt` and add/update sources with `checkedAt`. On
   reverification without change, keep `updatedAt`, update `lastVerifiedAt`, and
   refresh source verification metadata. Use `YYYY-MM-DD`. Do not estimate
   unknown dates. Do not mark unchecked programs as reverified.

12. **Validate.** Run `npm run lint`, `npm run build`, and `git diff --check`.
    Confirm any data edits keep the JSON valid.

13. **Report flexibly but completely.** In whatever form suits the company's
    complexity (tables, asset-by-asset sections, or concise lists — no fixed
    template), communicate: whether this was an initial investigation or a
    refresh; the relevant assets found; records created or changed; important
    records reverified without change; findings deferred or excluded and why;
    the main supporting sources; and the validation results.

**Failure handling:** Before modifying any data, confirm current external
sources are actually reachable. If they are not, do not claim research was
completed, do not modify any record, and report the access limitation clearly.
