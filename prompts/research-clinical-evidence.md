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

2. **Confirm route status.** This prompt documents the Clinical Evidence
   workflow, but the route is not active until a later routing module enables
   it. Do not modify `AGENTS.md` and do not treat generic company research as a
   Clinical Evidence request.

3. **Inspect current data.** Read `data/companies/` source folders,
   `data/clinical-evidence/` source folders, `data/generated/clinical-evidence.json`,
   and the existing Company/Pipeline generated aggregates. Locate the company by
   existing Company/Pipeline source data.

4. **Enforce the precondition.** If `<COMPANY_NAME>` is absent from
   `data/companies/`, stop. Report that Company/Pipeline Research must run
   first. Do not create Company/Pipeline records and do not create Clinical
   Evidence records for an absent company.

5. **Choose the approach automatically.** If the company has no Clinical
   Evidence source records, treat this as an initial Clinical Evidence
   investigation. If Clinical Evidence records already exist for the company,
   treat this as an update. Do not expose this as a user-facing mode.

6. **Traverse all in-scope assets.** Use existing Company/Pipeline source data
   as the authoritative list of the company's current Scope v1.1 assets. For
   every in-scope asset, discover relevant human interventional studies
   broadly. Do not stop after one asset or one latest trial.

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
   records what the sponsor reported and is not independent validation.

10. **Extract source-reported evidence only.** Populate Study, Arm, Endpoint,
    and Outcome records. Store experimental, placebo, and active-comparator
    groups as parallel Arms. Store only endpoints with disclosed results. Keep
    efficacy outcomes source-reported. Do not calculate derived efficacy values;
    store adjusted or comparative values only when directly reported.

11. **Author entities per the contract conventions.** An Arm is a treatment
    configuration within one study, not a cohort or sub-study — model a distinct
    sub-study/cohort as its own Study **when it has its own distinct registry
    identity**; a master protocol sharing one registry identifier across sub-studies
    or focal assets is not representable and is deferred (do not invent surrogate
    registry ids). Capture required background or concomitant
    therapy in free text on `arm.intervention`/`arm.label` and `study.population`,
    not as a structured field (ADR-0033). Model the same measure at different
    timepoints as **distinct Endpoint records**, one per timepoint. Author
    `analysisPopulation` in a consistent order (analysis set first, then subgroup
    in parentheses). For a `between-arm` outcome, populate `comparisonType` with
    both the effect measure and the reference direction (e.g. "Least-squares mean
    difference, treatment minus placebo").

12. **Reuse Arm and Endpoint ids; do not duplicate them.** Before creating an Arm
    or Endpoint, reuse the id of an existing record that already describes the same
    real-world configuration or measure. Semantically duplicate Arm/Endpoint
    records under different ids silently defeat outcome duplicate detection.

13. **Handle safety concisely.** Store only a concise study-level safety summary
    covering major adverse-event patterns, serious adverse events,
    discontinuation, or notable safety signals when reported. Do not reproduce
    exhaustive adverse-event tables.

14. **Replace semantic outcomes in place.** For the same semantic outcome, keep
    only the latest authoritative value in operating data. Update existing
    Study, Endpoint, and Outcome records rather than creating duplicate
    versions. Preserve useful historical source references for traceability.

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
    validation results; and the commit SHA when a commit is created.

**Failure handling:** Before modifying any Clinical Evidence source data,
confirm current external sources can actually be accessed. If not, do not claim
Clinical Evidence Research was completed and do not modify source data.
