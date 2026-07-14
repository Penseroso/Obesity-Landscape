# Prompt: Research and update Clinical Evidence records for a company

Reusable agent prompt. Replace `<COMPANY_NAME>` with the target company. The
conceptual command is:

> Research and update Clinical Evidence records for `<COMPANY_NAME>`.

No structured inputs are required or accepted. Do **not** expect or ask for
`mode`, `assetIds`, `writeData`, `asOfDate`, `lastVerifiedAt`, approval status,
or any other parameter. The company name is the only input.

---

You are researching **`<COMPANY_NAME>`** for the separate Clinical Evidence
domain and updating Clinical Evidence source records in the same execution.
Follow these steps:

1. **Read the policy.** Start with
   [`docs/research-routing.md`](../docs/research-routing.md), then read
   [`docs/clinical-evidence/README.md`](../docs/clinical-evidence/README.md),
   [`docs/clinical-evidence-workflow.md`](../docs/clinical-evidence-workflow.md),
   and [`docs/data-protocol/README.md`](../docs/data-protocol/README.md).

2. **Confirm route status.** This route is active, triggered only by explicit
   clinical-evidence intent per `docs/research-routing.md` (ADR-0027,
   ADR-0035). Do not modify `AGENTS.md` as part of an ordinary execution of this
   prompt, and do not treat generic company research with no explicit clinical
   intent as a Clinical Evidence request.

3. **Inspect current data.** Read `data/companies/` source folders,
   `data/clinical-evidence/` source folders, `data/generated/clinical-evidence.json`,
   and the existing Company/Pipeline generated aggregates. Locate the company by
   existing Company/Pipeline source data.

4. **Run Company/Pipeline Research first, in the same execution.** Execute
   [`prompts/research-company.md`](./research-company.md) to completion for
   `<COMPANY_NAME>` before any Clinical Evidence discovery: an initial
   investigation if the company is absent from `data/companies/`, or a refresh
   if present. This protocol has no separate staleness flag — Company/Pipeline
   Research performs a full discovery-and-verify pass on every invocation, so
   running it first covers both the absent case and any staleness in existing
   data. Clinical Evidence Research may use only the resulting Company/Pipeline
   source data as the authoritative list of current Scope v1.1 assets. If
   Company/Pipeline Research cannot complete (for example, a source-access
   failure), stop before any Clinical Evidence source-data changes and report
   the blocker; do not create Clinical Evidence records for an absent or
   unverified company.

   Immediately after Company/Pipeline Research completes, build a concise
   in-session handoff manifest from the updated operating records. Each entry
   contains only: `assetId`; `programId`; canonical asset name (`assetName`);
   route (`route`); indication scope (`indications`); development stage
   (`development.stage`), status (`development.status`), and operational state
   (`development.stageOperationalState`); and unresolved conflicts
   (`unresolvedConflicts`) surfaced by the Company/Pipeline run. Keep the
   manifest in memory for this execution only. Do not persist a file, ledger,
   cache, schema, or generated artifact.

5. **Choose the approach automatically.** If the company has no Clinical
   Evidence source records, treat this as an initial Clinical Evidence
   investigation. If Clinical Evidence records already exist for the company,
   treat this as an update. Do not expose this as a user-facing mode.

6. **Traverse all in-scope assets.** Use the updated Company/Pipeline operating
   records as the authoritative source and the in-session handoff manifest as
   the traversal index for the company's current Scope v1.1 assets. Do not
   repeatedly reload or restate the full Company/Pipeline source corpus; inspect
   it more deeply only when a clinical conflict requires it. For every in-scope
   asset, discover relevant human interventional studies broadly. Do not stop
   after one asset or one latest trial.

7. **Build the major evidence set.** Include distinct result-bearing pivotal or
   confirmatory studies; when no later-stage result exists, include the latest
   result-bearing study; and retain an earlier study when it uniquely represents
   a route, formulation, regimen, dose strategy, or population. Exclude
   duplicate publications, routine subanalyses, and extensions unless they add a
   distinct core endpoint, population, or treatment configuration.

8. **Classify every discovered study.** Each discovered study must end as:
   entered; not entered because it is result-bearing but not selected for the
   major evidence set; excluded because no study-specific result exists;
   excluded as outside Scope v1.1; or deferred because identity, result, source,
   or conflict remains unresolved. Nothing discovered may be silently dropped.
   Only entered studies are stored in operating data.

9. **Apply source priority.** Use this default result-source priority:
   peer-reviewed publication; registry-posted results including ClinicalTrials.gov;
   conference presentation, poster, or abstract; official company topline
   release. Apply authority and recency together. A company topline release
   records what the sponsor reported and is not independent validation. Assign
   Outcome maturity from the strongest source that directly supports that exact
   value: company-only results remain `topline`, and a peer-reviewed Study
   publication does not upgrade unsupported Outcomes or authorize filling
   unpublished statistical details.

10. **Extract source-reported evidence only.** Populate Study, Arm, Endpoint,
    and Outcome records. Store experimental, placebo, and active-comparator
    groups as parallel Arms. Store only endpoints with disclosed results. Keep
    efficacy outcomes source-reported. Capture only directly reported arm-level or
    between-arm values. Do not calculate treatment differences from arm-level
    values, infer unpublished confidence intervals or p-values, transcribe chart
    values visually, distribute pooled results across individual Arms, or map a
    subgroup result to broader Arms that do not faithfully represent it. Store
    adjusted or comparative values only when directly reported.

11. **Author entities per the contract conventions (schema v2.0).** Every source file
    declares `"schemaVersion": "2.0"`. An Arm is a protocol-defined treatment
    configuration within one study — not a cohort, sub-study, or pooled group. Model a
    distinct sub-study/cohort as its own Study **when it has its own distinct registry
    identity**; a master protocol sharing one registry identifier across sub-studies
    or focal assets is not representable and is deferred (do not invent surrogate
    registry ids). Capture required background or concomitant
    therapy in free text on `arm.intervention`/`arm.label` and `study.population`,
    not as a structured field (ADR-0033). Model the same measure at different
    timepoints as **distinct Endpoint records**, one per timepoint. Set
    `analysisPopulation` to the actual source-reported analysis set, with analysis
    set first and any subgroup second in parentheses. ITT, modified ITT, FAS, EAS,
    per-protocol, and safety populations are examples, not a whitelist. Never use
    an estimand label as `analysisPopulation`. Store the separately source-reported
    estimand or intercurrent-event strategy in `estimand`; do not infer one. When
    multiple estimands are directly reported for the same Study, Endpoint,
    protocol-defined Arm set, and timepoint, capture each as a separate Outcome.
    For a `between-arm` Outcome, reference every compared protocol-defined Arm, use
    `resultType: between-arm`, and populate `comparisonType` with the effect measure
    and reference direction (e.g. "Least-squares mean difference, treatment minus
    placebo"). Keep the result sign consistent with that direction and include
    confidence intervals or p-values only when directly reported. Arm array order
    does not encode direction or create a distinct semantic Outcome.

    Also required by v2.0:

    - **Internal linked assets.** When an Arm's comparator or component resolves to a
      registry asset — **including another company's asset** — link it with `companyId`
      + `assetId`. Free-text `assetName` / `externalCompanyName` is only for genuinely
      external or unresolved assets.
    - **Analysis groups.** A source-reported pooled, derived, or starting-dose group is
      an `AnalysisGroup` over its member protocol Arms, with the Outcome anchored via
      `analysisGroupId` (never both `armIds` and `analysisGroupId`). Do not invent Arms
      for it, do not nest groups, and do not redistribute a pooled value across members.
    - **Endpoint role and domain.** Confirm `role` from the study's cited sources — the
      registry outcome designation, protocol, or publication — and **never** from a
      free-text label. Two or more prespecified primary outcome measures make each
      `co-primary`. Use `other` when no source confirms it. Add `domain` to separate a
      weight endpoint from a comorbidity endpoint, or omit it rather than guess.
    - **Structured results.** Keep the source display text in `value`, the machine-readable
      number in `numericValue` (`null` when narrative), the actual unit in `unit`, and —
      only for a between-arm estimate — the `effectMeasure`. A hazard ratio or treatment
      difference is an effect measure, not a unit.

    When a result still cannot be represented faithfully, apply the **case-scoped
    deferred-schema fallback** in `docs/clinical-evidence-workflow.md` §5.1: isolate the
    smallest failing unit, never distort it, keep researching everything else, and record
    it in the Schema boundary report with its re-entry trigger. Never terminate the whole
    company/asset run over one unrepresentable result (ADR-0037).

12. **Reuse Arm, AnalysisGroup and Endpoint ids; do not duplicate them.** Before
    creating one, reuse the id of an existing record that already describes the same
    real-world configuration, member set, or measure. Semantically duplicate records
    under different ids silently defeat outcome duplicate detection.

13. **Handle safety concisely.** Store only a concise study-level safety summary
    covering major adverse-event patterns, serious adverse events,
    discontinuation, or notable safety signals when reported. Do not reproduce
    exhaustive adverse-event tables.

14. **Replace semantic outcomes in place.** For the same semantic outcome, keep
    only the latest authoritative value in operating data. Update existing
    Study, Endpoint, and Outcome records rather than creating duplicate
    versions. Semantic identity includes Study, Endpoint, the order-insensitive
    protocol-defined Arm set, analysis population, estimand, result type, and
    comparison direction through `comparisonType`. Outcomes that differ by a
    source-supported analysis population or estimand are not duplicates. Preserve
    useful historical source references for traceability.

15. **Defer unresolved conflicts.** When sources conflict and priority plus
    recency do not resolve the discrepancy, defer the affected Outcome and
    report the conflict.

16. **Protect Company/Pipeline data.** If clinical research reveals a material
    conflict with an existing asset, program, regimen, stage, or status, do not
    edit Company/Pipeline source data. Record the discrepancy in the final
    report and recommend a separate Company/Pipeline refresh.

17. **Regenerate and validate.** After Clinical Evidence source edits, run:
    `npm run data:generate`,
    `npm run data:validate:clinical-evidence`,
    `npm run data:validate:clinical-evidence:generated`,
    `npm run data:validate:clinical-evidence:synthetic`, and
    `npm run data:validate:generated`. Also run `npm run lint`,
    `npm run build`, and `git diff --check` before final reporting.

18. **Report completely.** Communicate whether this was an initial Clinical
    Evidence investigation or update; the assets traversed; studies entered or
    updated; result-bearing studies not entered because they were not selected
    for the major evidence set; studies excluded for no result; studies excluded
    as outside Scope v1.1; deferred studies with reasons; pipeline
    discrepancies; source-access failures; generated aggregate status;
    the **Schema boundary report** (workflow §5.1) with every deferred schema case and
    the counts of entered / `DEFERRED_SCHEMA_CASE` / `REVIEW_REQUIRED` /
    `RESEARCH_BLOCKED`; validation results; whether
    the run is fully completed or partially
    completed (Company/Pipeline portion done, Clinical Evidence portion
    blocked); and the commit SHA when a commit is created.

**Failure handling:** Before modifying any Clinical Evidence source data,
confirm current external sources can actually be accessed. If not, do not claim
Clinical Evidence Research was completed and do not modify Clinical Evidence
source data. This is sequential, not a single all-or-nothing gate: if
Company/Pipeline Research (step 4) already completed with valid changes
earlier in this execution, retain those changes — a Clinical Evidence
source-access failure never rolls back completed Company/Pipeline changes —
and report the run as partially completed.
