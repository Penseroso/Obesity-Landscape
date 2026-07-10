# Clinical Evidence Research Workflow

Reusable workflow for researching and updating the separate Clinical Evidence
data layer. This workflow is documented for future execution, but the
clinical-evidence route remains inactive until routing is explicitly activated.

The workflow is subordinate to:

- [`docs/research-routing.md`](./research-routing.md) for routing state.
- [`docs/clinical-evidence/README.md`](./clinical-evidence/README.md) for the
  Clinical Evidence data contract.
- [`docs/data-protocol/README.md`](./data-protocol/README.md) for Scope v1.1 and
  existing Company/Pipeline identity rules.

## 1. Input And Execution Boundary

The only required input is a company name, represented as `<COMPANY_NAME>`.
Examples of future explicit intent include:

- `<COMPANY_NAME> clinical evidence research`
- `<COMPANY_NAME> 임상 조사`
- `<COMPANY_NAME> 임상 업데이트`

Do not ask for or require a mode, asset list, date, write flag, or approval
parameter. The request wording does not decide whether the run is an initial
Clinical Evidence investigation or update; the existing Clinical Evidence source
data does.

Before external research, inspect:

- `data/companies/<company-id>/company.json`
- `data/companies/<company-id>/pipeline-programs.json`
- `data/companies/<company-id>/regimens.json`
- `data/clinical-evidence/<company-id>/`
- `data/generated/clinical-evidence.json`

If the company is absent from `data/companies/`, stop. Report that
Company/Pipeline Research must run first. Clinical Evidence Research may use
only existing Company/Pipeline source data as the authoritative list of current
Scope v1.1 assets.

Clinical Evidence Research must not silently modify Company/Pipeline records. If
clinical research reveals a material conflict with an existing asset, program,
regimen, stage, or status, report the discrepancy and recommend a separate
Company/Pipeline refresh.

## 2. Asset Traversal

Use existing Company/Pipeline source records to identify the company's current
Scope v1.1 assets. For every existing in-scope asset:

1. Read any existing Clinical Evidence source file for the asset.
2. Discover relevant human interventional clinical studies broadly.
3. Classify every discovered study as one of:
   - **entered** - result-bearing, in scope, and represented in source data.
   - **excluded: no result** - no publicly disclosed study-specific result.
   - **excluded: outside Scope v1.1** - not relevant to obesity or weight
     management under the Clinical Evidence contract.
   - **deferred** - identity, result, source, or conflict remains unresolved.
4. Add or update operating records only for studies with publicly disclosed
   study-specific results.

Do not treat one chronologically latest trial as sufficient. Build the asset's
major current evidence set.

## 3. Major Evidence-Set Selection

Include:

- distinct result-bearing pivotal or confirmatory studies.
- the latest result-bearing study when no later-stage result exists.
- an earlier study that uniquely represents a route, formulation, regimen, dose
  strategy, or population.

Exclude:

- duplicate publications of the same study result.
- routine subanalyses.
- extension studies unless they add a distinct core endpoint, population, or
  treatment configuration.
- registered, planned, recruiting, or completed studies without disclosed
  study-specific results.
- protocol-only or design-only disclosures.
- studies outside the Clinical Evidence obesity/weight-management scope.

## 4. Sources And Updates

Default result-source priority:

1. peer-reviewed publication.
2. registry-posted results, including ClinicalTrials.gov.
3. conference presentation, poster, or abstract.
4. official company topline release.

Apply authority and recency together. An explicit correction or updated
authoritative result supersedes the prior value.

For the same semantic outcome:

- keep only the latest authoritative value in operating data.
- update the existing Study, Endpoint, and Outcome rather than creating a
  duplicate version.
- preserve useful historical source references for traceability.
- do not calculate derived efficacy values.
- store adjusted or comparative values only when directly reported.

When sources conflict and the hierarchy does not resolve the discrepancy, defer
the affected Outcome and report the conflict.

## 5. Extraction Rules

Populate the implemented `Study`, `Arm`, `Endpoint`, and `Outcome` structures in
`data/clinical-evidence/<company-id>/<asset-id>/clinical-evidence.json`.

- Store experimental, placebo, and active-comparator groups as parallel Arms.
- Store treatment and comparator arms using the same structure.
- Store only endpoints with disclosed results.
- Keep efficacy outcomes source-reported.
- Store only a concise study-level safety summary covering major adverse-event
  patterns, serious adverse events, discontinuation, or notable safety signals
  when reported.
- Do not reproduce exhaustive adverse-event tables.
- Do not enter a Study unless it has at least one Arm, Endpoint, and Outcome.
- Do not enter an Endpoint unless at least one Outcome is available.

## 6. Record Creation And Replacement

Create asset-level source files only under:

```text
data/clinical-evidence/<company-id>/<asset-id>/clinical-evidence.json
```

Use stable IDs. Reuse existing Study, Arm, Endpoint, and Outcome IDs when
updating a previously entered study or semantic outcome. Do not create parallel
Outcome records for superseded result versions.

When a value changes:

- update the relevant record's verification metadata.
- add or update supporting source references.
- preserve useful prior source references.

When a study is rechecked without value changes:

- keep stable IDs.
- update verification metadata only where the source was actually rechecked.

## 7. Required Completion

Each execution must:

1. inspect existing company and Clinical Evidence source data.
2. research all in-scope assets.
3. update company/asset Clinical Evidence source files when valid evidence is
   found.
4. run `npm run data:generate`.
5. run:
   - `npm run data:validate:clinical-evidence`
   - `npm run data:validate:clinical-evidence:generated`
   - `npm run data:validate:clinical-evidence:synthetic`
   - `npm run data:validate:generated`
6. report entered, updated, excluded, deferred, and conflicting studies.

If current external sources cannot be accessed, do not claim Clinical Evidence
Research was completed and do not modify Clinical Evidence source data.

## 8. Final Reporting

The final response must communicate:

- whether this was treated as an initial Clinical Evidence investigation or an
  update.
- the company and assets traversed.
- studies entered or updated.
- studies excluded for no result.
- studies excluded as outside Scope v1.1.
- studies deferred, with reasons.
- pipeline discrepancies or conflicts requiring Company/Pipeline refresh.
- generated aggregate and validation results.
- blockers or evidence-access failures.

There is no rigid table format. Choose a concise form appropriate to the
company and asset complexity.

## 9. Non-Goals

This workflow does not introduce:

- route activation in `AGENTS.md`.
- Company/Pipeline record edits.
- schema, type, validator, source-layout, or aggregate-shape changes.
- UI or comparison logic.
- real clinical evidence collection by documentation alone.
