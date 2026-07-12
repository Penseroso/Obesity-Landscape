# Prompt: Research and update records for a company

Reusable agent prompt. Replace `<COMPANY_NAME>` with the target company. The
conceptual command is simply:

> Research and update records for `<COMPANY_NAME>`.

No structured inputs are required or accepted — do **not** expect or ask for
`mode`, `writeData`, `asOfDate`, `lastVerifiedAt`, an approval status, or any
other parameter. The company name is the only input.

---

You are researching **`<COMPANY_NAME>`** for the Obesity Landscape and
updating its records in the same execution. Follow these steps:

1. **Read the policy.** Start from the protocol entry point
   [`docs/data-protocol/README.md`](../docs/data-protocol/README.md), then read
   [`docs/research-workflow.md`](../docs/research-workflow.md). They are
   authoritative for scope, evidence, identity, row, and entry rules, and
   reflect Contract 1.1 (ADR-0030).

2. **Inspect current data.** Read company source folders under
   `data/companies/`, generated aggregate files under `data/generated/`,
   registries under `data/registries/`, and `lib/programs/types.ts` for the
   current contract. Find any existing program and regimen records for
   `<COMPANY_NAME>`.

3. **Choose the approach automatically.** If the company is absent, perform an
   **initial company-wide investigation**; if the company or related records are
   present, perform a **refresh**. The request wording never overrides the data.
   Do not expose this as a user-facing mode.

4. **Discover, then verify.** Perform company-centred discovery of the current
   pipeline, build an in-scope asset inventory, run asset/code-name reverse
   searches, and verify each included asset independently against registry,
   partner, rights, and official sources. Do not stop at the first obvious
   asset. Review each official source completely for every distinct development
   entity and configuration it discloses — other assets, additional routes or
   formulations, combination products, regimens, and relationships — not only
   the record that led you to the source. Every named program, formulation,
   combination product, regimen, or relationship you surface must finish the run
   classified as entered, merged, deferred, or excluded, with a reason; nothing
   surfaced is silently dropped.

5. **Apply the Module 5 rules.** Enforce the dataset scope, stage evidence
   thresholds, entity/asset/program identity, row-splitting rules, and
   field-entry rules from the data protocol. The v1.1 scope (ADR-0026) is the
   competitive **obesity/incretin** landscape: include GLP-1 receptor agonists,
   GLP-1-containing dual/triple agonists, GLP-1-based combinations and regimens,
   amylin-only and amylin-containing obesity programs, and GIP-only,
   glucagon-only, or other incretin/amylin/glucagon-axis obesity programs when
   official evidence confirms obesity or weight-management development intent.
   Defer to v2 (unless already GLP-1-based) muscle-preserving/body-composition
   adjuncts, non-incretin anti-obesity classes (MC4R, CB1, CNS-appetite, lipase
   inhibitor, unrelated small-molecule weight-loss), and MASH-only, T2D-only, or
   comorbidity-only programs. Do not exclude a program merely for lack of GLP-1
   biology when it otherwise satisfies v1.1 scope; also do not include standalone
   v2-deferred programs merely because they may later become obesity-relevant.
   Inclusion does not imply GLP-1 RA or GLP-1-containing status. "Obesity
   landscape" does not mean "obesity-indication rows only": once an asset
   qualifies by core mechanism or confirmed obesity/weight-management intent,
   investigate all current official programs for that asset that Contract 1.1
   can represent, while retaining the exclusions for unrelated non-core assets
   and programs. Split program rows when stage, status, or operational state
   differs; that equality is necessary but not sufficient to merge — merge
   indications only when company, asset, route, dosage form, stage, status,
   and operational state are identical, the records share the same
   sponsor-defined development program or trial family, and the source bundle
   directly supports the full merged scope, otherwise defer. Set `development.stage`
   to the most advanced official current development stage for the program scope;
   regulatory-development milestones such as `IND submitted` and `IND cleared`
   are valid stages when they are the most advanced official current stage and
   are never approximated as clinical phases (ADR-0024). Keep the detailed
   `regulatoryStates` entries (jurisdiction, authority, date) as a field
   separate from `development.stage`, and use `stageBasis` and
   `stageOperationalState` to annotate evidence basis and operational state.
   Classify each candidate on two independent axes before modeling it:
   intervention model (monotherapy program, combination product, regimen, or
   add-on/background-therapy program) and protocol structure (standalone or
   platform/master protocol — a platform/master protocol may test any
   intervention model in its nested sub-studies). Distinguish company
   relationships separately. A study requiring background or concomitant
   therapy is not monotherapy evidence for the focal asset. A named
   background product is not automatically a regimen: regimen classification
   requires official evidence the sponsor treats the co-administration as a
   distinct development configuration, not merely protocol-required
   standard-of-care background therapy. `indications` holds disease/treatment
   indications only, never background therapy, prior-treatment conditions, age
   cohorts, trial objectives, outcome labels, or population descriptors.

6. **Promote registry values when justified.** If official evidence requires a
   development-stage, regulatory-state, or company-relationship-role value that
   is semantically distinct from existing registry labels and aliases, add it to
   the relevant registry in the same execution and commit. Do not approximate a
   precise official value to an existing broader value. If officiality or
   meaning is unclear, defer it.

7. **Update records in the same execution.** Automatically create or update a
   company/program record only when it is in scope, identity and required
   non-null fields are confirmed, sources satisfy the field-specific source
   policy, it is representable by the current contract, and it is not a duplicate
   configuration.

   Enter regimen records only when official regimen development intent,
   component identity, and indication are sufficiently confirmed. Enter company
   relationships only when role, company identity, and any stored rights or
   territory are directly supported.

   Treat internal references as company-source-local: use component `assetId`
   only for assets in the current company folder, and use component or
   relationship `companyId` only for the current folder's company. For another
   company's asset, store `assetName` or `codeName` with `externalCompanyName`.
   For another company relationship, store `externalCompanyName`. Do not search
   another company folder for IDs, and do not promote external references to
   internal references.

   When official evidence confirms future regimen development intent but
   regimen-specific development has not started or its stage is not disclosed,
   use `status: "Planned"` and `stage: "Unknown"` where appropriate, and do not
   inherit stage, status, or administration details from the component programs.

   For regimens, the base identity is principal company, component set, and
   indication scope. If multiple official configurations share that base
   identity, store a stable `configurationKey` only for an officially defined
   product or regimen configuration that remains meaningfully distinct
   independently of trial-arm dosing, and base any regimen ID suffix on it.
   Dose, dose ratio, titration schedule, cohort, and clinical trial arm
   differences do not create regimen identities; for example, dose arms of
   `bimagrumab + semaglutide` are one component-level regimen. Dose-level arms
   belong to the future Clinical Evidence Arm layer. Do not use display name,
   stage/status, dates, results, dosing, or arbitrary numbering. If the
   configuration discriminator is needed but unconfirmed, defer the additional
   regimen.

8. **Run the mandatory coverage audit.** After record updates — and before
   regeneration, validation, and reporting — audit coverage for recall. Recheck
   the company's official pipeline page and current investor materials
   (pipeline slides, annual and quarterly reports, R&D-day presentations);
   check approved and regulatory-filed obesity products, not only
   development-stage pipeline entries; run sponsor-based, asset-name, and
   code-name registry searches; and check licensed, acquired, partnered,
   renamed, and historical assets that may not appear in the current pipeline
   presentation. Reconcile every relevant entry in the sponsor's current
   official pipeline and trial sources against operating data. Classify every
   candidate as entered, merged, deferred, or excluded, with a reason; nothing
   discovered may be silently omitted. Then repeat discovery once, independently — re-run
   company-centred discovery from scratch without starting from the first
   pass's source list or asset inventory. If the second pass surfaces any
   candidate not already classified in this run, the run is not complete:
   research and classify it under the full rules, then repeat the independent
   pass. Do not report completion while the latest pass still surfaces a new
   candidate. The audit is in-run only — report its outcome in the final
   response; do not persist a research ledger or per-run report file.

9. **Defer, do not block.** Report unsupported or structurally unresolved
   findings (ambiguous ownership, unrepresentable configurations, unconfirmed
   identity) without blocking the company's other valid updates.

10. **Protect existing data.** Reuse stable company, asset, and program IDs;
   never regenerate them because a name, stage, or status changed. `assetId` is
   immutable: on a rename, update `assetName` to the current canonical name and
   record the former name as a `former-name` alias — do not create a new asset
   or program. Capture confirmed former names, development codes, brand names,
   and alternative spellings as typed `aliases` (identical across every row that
   shares an `assetId`); keep `codeName` limited to a confirmed internal
   development code. Update mutable stage/status in place. Do not delete
   confirmed values merely because current sources omit them, and do not
   overwrite strong evidence with weaker secondary reporting. Preserve useful
   historical sources; avoid duplicates.

11. **Apply the deterministic ID rules when creating new records.** These rules
   operate under Contract 1.1 (ADR-0030); only the exact
   program-ID suffix scheme remains v2 backlog. Search existing identities
   first and reuse IDs whenever applicable. For new IDs: `companyId` is a
   lowercase kebab-case slug of the canonical official company name;
   `assetId` is a lowercase kebab-case slug of the official development code
   when available, otherwise the canonical asset name; `programId` stably
   combines `companyId`, `assetId`, route, and dosage form, with an
   indication-scope suffix only when required to distinguish concurrent
   programs. Never include stage or status in an ID. Check for collisions
   before creation; if a collision cannot be resolved from verified identity
   information, defer the record rather than inventing an arbitrary ID.

12. **Apply the Company creation rule.** Create a new `Company` record only
    when both the canonical company name and `headquartersCountry` are
    confirmed from reliable current sources. If `headquartersCountry` is
    unresolved, do not guess and do not create a partial Company record —
    defer and report the finding instead.

13. **Use current dates for verification metadata.** On a value change, update
   `updatedAt` and `lastVerifiedAt` and add/update sources with `checkedAt`. On
   reverification without change, keep `updatedAt`, update `lastVerifiedAt`, and
   refresh source verification metadata. Use `YYYY-MM-DD`. Do not estimate
   unknown dates. Do not mark unchecked programs as reverified. Give each source
   the most precise verified `publishedAt` available, and set `sourceType` to
   describe the artifact actually at the stored URL, not the claim it supports.

14. **Regenerate and validate.** Run aggregate generation and validation
    commands, then run `npm run lint`, `npm run build`, and `git diff --check`.
    Confirm any data edits keep the JSON valid and generated aggregate files are
    deterministic.

15. **Report flexibly but completely.** In whatever form suits the company's
    complexity (tables, asset-by-asset sections, or concise lists — no fixed
    template), communicate: whether this was an initial investigation or a
    refresh; the relevant assets found; records created or changed; important
    records reverified without change; findings merged, deferred, or excluded
    and why;
    the coverage-audit outcome (either that the final independent discovery
    pass surfaced no unclassified candidate, or which new candidates it
    surfaced and how each was classified);
    the main supporting sources; whether generated aggregates were regenerated
    with `npm run data:generate` when operating data changed; the validation
    results (local checks — this repository has no GitHub Actions CI); and any
    blockers or evidence-access failures.

**Failure handling:** Before modifying any data, confirm current external
sources are actually reachable. If they are not, do not claim research was
completed, do not modify any record, and report the access limitation clearly.
