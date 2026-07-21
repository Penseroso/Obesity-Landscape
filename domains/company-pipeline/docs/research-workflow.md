---
role: research-workflow
status: active
authority: authoritative
update-boundary: Update only when the Company/Pipeline research execution procedure, completion gate, validation, or reporting requirements change.
---

# Company/Pipeline Research Workflow

Executable workflow for researching one named company and updating its records
in the same execution. The company name is the only input. Scope and data-entry
semantics remain authoritative in the [Data Protocol](./README.md).

## 1. Establish the run

1. Inspect `domains/company-pipeline/data/companies/`, the relevant generated aggregates, registries,
   and current Company/Pipeline types.
2. If the company is absent, perform an initial company-wide investigation. If
   it exists, refresh every current record. Request wording never selects a
   mode.
3. Before editing, confirm that current external sources are reachable. If
   required sources cannot be accessed, make no operating-data change and
   report the failure as a source-access blocker. Do not reclassify a candidate
   as insufficiently evidenced, or report a claim as undisclosed, because a
   source was unreachable.

## 2. Discover and classify

Perform company-centred discovery, build the in-scope asset inventory, and run
asset-name and code-name reverse searches. Verify candidates against official
company materials, trial registries, regulators, partners, and transaction
sources as appropriate under the source policy.

Review each opened official source for every distinct asset, formulation,
route, combination, regimen, and relationship it discloses. Every surfaced
candidate must finish in exactly one state:

- **entered**: confirmed, in scope, representable, and created or updated;
- **merged**: confirmed and consolidated into an identified existing record;
- **deferred**: unresolved identity, evidence, vocabulary, or structure, with a
  reason;
- **excluded**: outside scope or insufficiently evidenced, with a reason.

Nothing surfaced may be silently dropped. One deferred candidate does not
block other valid updates. `deferred` and `excluded` are provisional until the
independent coverage pass in section 5 has run: a candidate is not insufficiently
evidenced merely because the first pass did not surface its evidence.

## 3. Apply the contracts

Use these authorities rather than duplicating their rules here:

- scope and versions: [`README.md`](./README.md);
- identity, row splitting, stable IDs, assets, combinations, regimens, and
  references: [`entities-and-rows.md`](./entities-and-rows.md);
- evidence thresholds, field entry, dates, sources, statuses, and registry
  promotion: [`source-and-entry-policy.md`](./source-and-entry-policy.md);
- generated artifacts: [`generated-output-contract.md`](./generated-output-contract.md);
- unrepresentable structures: [`edge-cases.md`](./edge-cases.md).

Create or update only records that are in scope, sufficiently sourced,
representable, internally consistent, and non-duplicative. Reuse stable IDs and
update mutable state in place. Promote a registry value only when the source
policy's criteria are satisfied; otherwise defer it.

## 4. Protect existing records

- Do not delete a confirmed value merely because a newer source omits it.
- Do not replace stronger evidence with weaker reporting.
- Preserve useful identity, licensing, and prior-state sources without adding
  duplicates.
- Update `updatedAt` only when a stored value changes. Update
  `lastVerifiedAt` and source `checkedAt` only for records actually checked.
- Do not guess a missing required value or invent an ID to resolve a collision.

## 5. Mandatory coverage gate

Before generation and reporting:

1. Reconcile the sponsor's current pipeline page, current investor materials,
   approved/filed obesity products, sponsor and asset registry searches, and
   licensed, acquired, partnered, renamed, and historical assets.
2. For every `Filed` or `Approved` program, reconcile disclosed jurisdiction,
   authority, and official date in `regulatoryStates`.
3. Classify every newly surfaced candidate.
4. Repeat company-centred discovery independently, without using the first
   pass's source list or inventory as the starting point.
5. The independent pass covers previously `deferred` and unresolved candidates
   and claims as well as new ones. Re-search each of them and record which
   applies: new evidence now resolves it, the same blocker still stands, or its
   disposition has changed. A prior deferral is not carried forward untested.
6. If the independent pass finds an unclassified candidate, research and
   classify it, then repeat the independent pass. Completion requires a final
   pass with no unclassified candidate and no unre-searched prior deferral.

This audit is in-session only. Do not create a per-run ledger or report file.

## 6. Generate and validate

After valid source changes:

```text
npm run data:generate
npm run data:validate:registries
npm run data:validate:companies
npm run data:validate:generated
npm run data:validate:synthetic
npm run lint
npm run build
git diff --check
```

Generated files are outputs and must never be hand-edited.

## 7. Report

Report, without a rigid template:

- initial investigation or refresh;
- assets traversed and records created, changed, or reverified;
- entered, merged, deferred, and excluded candidates with reasons;
- registry additions;
- final independent coverage-pass result;
- principal sources;
- generation and validation results;
- blockers or source-access failures.

Do not claim completion unless the coverage gate and required validation have
completed.
