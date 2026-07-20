---
role: research-workflow
status: active
authority: authoritative
update-boundary: Update only when the Clinical Evidence research execution procedure, fallback behavior, validation, or reporting requirements change.
---

# Clinical Evidence Research Workflow

Executable workflow for a named company with explicit Clinical Evidence
intent. The company name is the only input. Routing is authoritative in
[`AGENTS.md`](../../../AGENTS.md); entity and result semantics are authoritative in
the [Clinical Evidence contract](./README.md).

## 1. Run Company/Pipeline Research first

Execute the complete [Company/Pipeline workflow](../../company-pipeline/docs/research-workflow.md) in the
same run. Clinical Evidence may use only the resulting Company/Pipeline source
data as its current Scope v1.1 asset list.

After that step, keep an in-session traversal manifest containing `assetId`,
`programId`, canonical asset name, route, indication scope, development state,
and unresolved conflicts. Do not persist this manifest.

If Company/Pipeline Research cannot complete, stop before Clinical Evidence
changes. Clinical Evidence research never silently edits Company/Pipeline
records; report any conflict discovered later.

## 2. Establish and traverse the evidence set

Inspect existing Clinical Evidence source files and decide initial
investigation versus update from their presence. For every current in-scope
asset:

1. Read its existing source record, if present.
2. Discover relevant human interventional studies broadly.
3. Store every verified in-scope Study, including planned, recruiting, active,
   completed, terminated, suspended, or withdrawn Studies without an Outcome.
4. For every Study in the run, record one in-session result-availability state:
   `RESULT_SOURCE_FOUND`, `NO_PUBLIC_RESULTS`, or
   `RESULT_AVAILABILITY_UNRESOLVED`, with the sources and check date. For
   `RESULT_SOURCE_FOUND`, review every confirmed result-bearing source that is
   discovered or cited in Study metadata. Record an in-session disposition for
   each distinct directly disclosed result, identified at least by source,
   endpoint/measure, timepoint, analysis unit or comparison, and the reported
   analysis population, subgroup, and estimand. Record "not reported" rather
   than inferring a missing analysis detail.
5. Give each disclosed result exactly one disposition:
   - **entered**: represented by an Endpoint and Outcome whose metadata cites
     the source that directly supports the stored value;
   - **excluded**: outside the Clinical Evidence scope or an explicit contract
     non-goal, with the result and reason reported;
   - **deferred**: direct disclosure exists but evidence, identity, or reliable
     Arm/AnalysisGroup/Endpoint mapping is insufficient, with the missing
     evidence and re-entry condition reported;
   - **schema boundary**: the source-supported result cannot be represented by
     the current contract and is handled under the case-scoped fallback.
6. Classify every discovered study as inventory entered, result-bearing
   entered, excluded outside scope, or deferred with a reason.

Do not stop at one asset or the chronologically latest trial. Deduplicate
publications to stable registry/Study identity. The result-review manifest is
in-session only and is not operating data. A result-bearing source cited only
in Study metadata has not satisfied result review or result disposition.

## 3. Sources and updates

Default result-source priority is:

1. peer-reviewed publication;
2. registry-posted result;
3. conference presentation, poster, or abstract;
4. official company topline release.

Apply authority and recency together. Outcome maturity comes from the strongest
source that directly supports that exact value. Preserve only directly
reported results; do not calculate, infer, visually transcribe, redistribute,
or broaden a result beyond its supported analysis unit.

A result-bearing source may disclose several distinct results. Review each one
rather than assigning one disposition to the source as a whole. If the source
publishes only an adjusted or between-unit effect, enter only that directly
reported effect when its anchors are reliable; do not reconstruct undisclosed
arm-level values. Study-level citation and Outcome-level result provenance are
separate obligations under the contract.

For an unchanged semantic outcome, replace a superseded value in place and
preserve useful prior source references. If authority and recency cannot
resolve a conflict, defer the affected result.

## 4. Author under the v3 contract

Create source files only at:

```text
domains/clinical-evidence/data/clinical-evidence/<company-id>/<asset-id>/clinical-evidence.json
```

Apply the [Clinical Evidence contract](./README.md) for Study,
Arm, AnalysisGroup, Endpoint, Outcome, focal mapping, linked assets, semantic
identity, source-reported results, latest-result replacement, inventory-only
Studies, and generated projections. Reuse existing stable entity IDs and never
mint a second ID for the same real-world Arm, AnalysisGroup, or Endpoint.

Store concise study-level safety summaries only; do not reproduce exhaustive
adverse-event tables.

## 5. Case-scoped schema fallback

An unrepresentable result never terminates the company or asset run:

1. Isolate the smallest affected Study, Endpoint, Outcome, or result.
2. Do not approximate, redistribute, force an anchor, or invent an ID.
3. Continue all other representable research and entry.
4. Include the case in the final Schema boundary report.

Use these statuses:

- `DEFERRED_SCHEMA_CASE`: omit only the unsupported case;
- `REVIEW_REQUIRED`: enter the representable record but report the documented
  semantic limitation;
- `RESEARCH_BLOCKED`: block only the affected Study when its structure prevents
  reliable classification of dependent records.

Each entry records the affected company/asset/Study/result, source evidence,
unsupported structure, information that would be lost, any partial canonical
record, relevant edge case, and the schema re-entry trigger. A later extension
replays only cases it actually unblocks.

When the current schema could represent the result but the available source
does not support a reliable Arm, AnalysisGroup, Endpoint, population, estimand,
or timepoint mapping, use the ordinary **deferred** result disposition instead
of forcing an entry or misclassifying an evidence gap as a schema limitation.

## 6. Generate and validate

After valid Clinical Evidence changes:

```text
npm run data:generate
npm run data:validate:clinical-evidence
npm run data:validate:clinical-evidence:generated
npm run data:validate:clinical-evidence:synthetic
npm run data:validate:generated
npm run lint
npm run build
git diff --check
```

Before claiming completion, reconcile the in-session result-review manifest:

1. every Study has a recorded result-availability check;
2. every confirmed result-bearing source has been reviewed;
3. every directly disclosed result is entered, excluded, deferred, or recorded
   in the Schema boundary report;
4. every entered result has direct supporting source metadata on its Outcome;
5. every omitted public result appears individually in the final report with
   its source, disposition, reason, and re-entry condition where applicable;
6. the count of undispositioned disclosed results is zero.

The JSON validators enforce only facts represented in canonical data. They
cannot inspect external source contents or infer that a Study-level citation is
result-bearing, so validator success does not replace this reconciliation gate.

If Clinical Evidence sources become inaccessible after Company/Pipeline
Research completed, retain those Company/Pipeline changes, make no Clinical
Evidence change, and report partial completion.

## 7. Report

Report:

- initial Clinical Evidence investigation or update;
- assets traversed;
- Studies entered or updated, including inventory-only Studies;
- result-availability state, checked sources, and check date for every Study,
  plus the result-bearing sources reviewed;
- entered results and every omitted public result, each with its source,
  disposition, reason, and re-entry condition where applicable;
- result-disposition counts, including an explicit zero count for
  undispositioned disclosed results;
- exclusions, deferrals, conflicts, and pipeline discrepancies;
- Schema boundary report and status counts;
- generated output and validation results;
- source-access blockers;
- full or partial completion.

Do not claim Clinical Evidence completion unless traversal, result-source
review and disposition reconciliation, valid updates, generation, validation,
and reporting all completed.
