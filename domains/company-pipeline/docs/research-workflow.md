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
candidate must finish this run in exactly one disposition:

- **STORED** — in current scope, sufficiently supported by official evidence,
  representable under the current contract, and reflected in operating data:
  either **entered** as a new or updated record or **merged** into an
  identified existing record.
- **EXCLUDED** — confirmed **not a subject of this run**. Use it only when one
  of these holds:
  - confirmed outside current scope;
  - not an official development program;
  - the company under research is not the principal development entity;
  - a generic or biosimilar copy;
  - official evidence places it outside this company's operating data;
  - speculative or unidentifiable, so it does not stand as a confirmed
    candidate.

  Do **not** use "insufficiently evidenced" as a catch-all EXCLUDED reason.
- **DEFERRED** — an **unresolved case that can re-enter** a later run. Use it
  when one of these holds:
  - the Scope authority explicitly leaves this candidate class to a future
    decision;
  - plausibly in scope, but a required field is not officially disclosed;
  - identity, route, dosage form, relationship, or development configuration is
    unresolved;
  - not representable under the current schema or registries;
  - it must be re-evaluated on a future Scope or Contract change.

**Disposition precedence.** When the Scope authority explicitly designates a
candidate class as `Defer`, classify candidates of that class **DEFERRED**, not
EXCLUDED — see [Data Protocol §Dataset scope](./README.md#dataset-scope). This
still applies to the classes Scope 2.0 leaves conditional (for example a
non-incretin anti-obesity class without yet-confirmed official obesity/
weight-management development intent for that specific candidate) and to
candidates unrepresentable under the current contract (for example device,
procedural, or bariatric-surgical candidates — see
[Edge Cases](./edge-cases.md)). Scope 2.0's R1 obesity-purpose path (ADR-0052)
removed the prior Scope v1.1 rule that automatically DEFERRED every
lean-mass/body-composition or non-incretin candidate regardless of evidence: a
candidate with confirmed official obesity-treatment or obesity-adjunct intent
now reaches STORED like any other qualifying candidate, through the normal
`scopeClass` classification in section 5.

Nothing surfaced may be silently dropped, and no in-scope candidate may leave
this run without one of these three dispositions. One DEFERRED candidate does
not block other valid updates. DEFERRED and EXCLUDED are provisional until the
independent coverage pass in section 5 has run: a candidate is not DEFERRED or
EXCLUDED merely because the first pass did not surface its evidence.

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

## 5. Research-completion gate

Before generation and reporting, this run may report completion (**GO**) only
once every item below holds; while any remain open, the run is **NO-GO**.

1. Reconcile the sponsor's current pipeline page, current investor materials,
   approved/filed obesity products, sponsor and asset registry searches, and
   licensed, acquired, partnered, renamed, and historical assets. Review the
   sponsor's full official pipeline for this purpose, but this reconciliation
   is the authoritative official-pipeline inventory for this run only within
   Scope 2.0: every asset, formulation, route, and indication it names that
   falls within Scope 2.0 (R1 ∨ R2), or may plausibly qualify under it, is an
   in-scope candidate that must reach a disposition under section 2, whether
   or not it was already known before this run started — see
   [Dataset scope](./README.md#dataset-scope). Once an asset qualifies, keep
   investigating every current official program for that asset per the Data
   Protocol, not only its obesity-purpose rows.
2. For every `Filed` or `Approved` program, reconcile disclosed jurisdiction,
   authority, and official date in `regulatoryStates`.
3. Classify every newly surfaced candidate.
4. Repeat company-centred discovery independently, without using the first
   pass's source list or inventory as the starting point.
5. The independent pass covers previously DEFERRED and unresolved candidates
   and claims as well as new ones. Re-search each of them and record which
   applies: new evidence now resolves it, the same blocker still stands, or its
   disposition has changed. A prior deferral is not carried forward untested.
6. If the independent pass finds an unclassified candidate, research and
   classify it, then repeat the independent pass. A final pass finds no
   unclassified candidate and no unre-searched prior deferral.
7. **Zero undispositioned candidates.** Count every candidate surfaced across
   both passes that does not carry a final STORED, EXCLUDED, or DEFERRED
   disposition (section 2). This count must be exactly zero before the run
   may report GO — a nonzero count is NO-GO regardless of how much other work
   has completed.
8. Every touched program row's `development.stage`, `development.status`, and
   `stageOperationalState` are confirmed by evidence naming that row's own
   program scope (asset, route, dosage form, and indication scope). Do not
   carry a sibling row's stage or status, the asset's aggregate pipeline
   position, or a planned/announced future stage into this row without
   row-specific evidence — see the row-scoped evidence rule in
   `entities-and-rows.md` and the stage evidence rules in
   `source-and-entry-policy.md`. When a row's `development.status` is set to
   `Discontinued`, confirm at least one cited source directly and explicitly
   states discontinuation for that row's own scope — source count alone does
   not satisfy this; see the discontinuation evidence rule in
   `source-and-entry-policy.md`.
9. Every stored indication on every touched row passes indication-attribution
   review:
   - the indication states that program's own official treatment or development
     objective;
   - no comorbidity, enrolled population, eligibility criterion, or subgroup has
     been carried into `indications` as an indication;
   - where population-specific studies were kept as separate rows, a difference
     in sponsor-defined program identity, indication objective, or development
     state is directly confirmed by evidence.

   The authority is
   [Population and comorbidity versus indication](./source-and-entry-policy.md#population-and-comorbidity-versus-indication)
   and the row rule in [`entities-and-rows.md`](./entities-and-rows.md#row-splitting).
   `npm run data:probe:indication-scope` reports review candidates for this
   check; it does not decide them, so each candidate touching this run's rows
   must be resolved against evidence. While any of these checks is unresolved,
   do not report GO.
10. When this run's branch is stacked on Company/Pipeline changes from a prior
    research step not yet merged to the default branch, re-run the full
    validation suite (section 6) against the cumulative working tree — not
    only the files this run touched — and confirm every value corrected by an
    earlier step in the stack is still present. A rebase, merge, or
    regeneration is never assumed to have preserved a prior correction; verify
    it directly. This run's own independently sourced, stronger evidence may
    intentionally supersede an earlier correction; when that happens, report
    the change and the superseding evidence explicitly. An earlier
    correction's disappearance without such a reported basis is a
    stacked-branch regression, not a valid update.
11. Every Program and Regimen this run creates or touches carries a
    `scopeClass` supported by that row's own official development objective
    and required development context — never carried forward from a sibling
    row, never derived from `indications` text — see
    [Entities and Rows §Scope class](./entities-and-rows.md#scope-class).
    `npm run data:probe:scope-class` reports candidates for review; it does
    not decide them, so each candidate touching this run's rows must be
    resolved against evidence. While any of these checks is unresolved, do
    not report GO.
12. If this run stores or updates a qualifying Regimen (`obesity-treatment` or
    `obesity-adjunct`), confirm that qualification was **not** propagated to
    its component assets: no component asset's other official Programs were
    entered, and no new Program row was created for a component, on the
    strength of the Regimen's own qualification alone — see
    [Data Protocol §Dataset scope, R1](./README.md#dataset-scope). A component
    asset entering scope this run needs its own qualifying Program or the
    core-mechanism path (R2).

This audit is in-session only. Do not create a per-run ledger or report file.

## 6. Generate and validate

After valid source changes:

```text
npm run data:generate
npm run data:validate:registries
npm run data:validate:companies
npm run data:validate:generated
npm run data:validate:synthetic
npm run data:probe:indication-scope
npm run data:probe:scope-class
npm run lint
npm run build
git diff --check
```

Generated files are outputs and must never be hand-edited.
`data:probe:indication-scope` is a semantic audit: it verifies its own detection
rules against fixtures and then **reports** indication-scope review candidates in
company data. It does not fail a run by itself, and it never merges or edits a
row — resolving a reported candidate is the gate responsibility in section 5
item 9.

`data:probe:scope-class` is likewise advisory: it self-checks its own detection
rules, then reports rows whose stored `scopeClass` disagrees with an exact-match
indication heuristic, or whose sibling rows share indications but disagree on
`scopeClass` — see
[Entities and Rows §Scope class](./entities-and-rows.md#scope-class). It never
fails a row, decides an authored `scopeClass` value, or edits data; resolving a
reported candidate against the row's own `metadata.sources` is the gate
responsibility in section 5 item 11.

## 7. Report

Report, without a rigid template:

- initial investigation or refresh;
- assets traversed and records created, changed, or reverified;
- every candidate's disposition — STORED (entered or merged), EXCLUDED, or
  DEFERRED — with reasons, and the count of undispositioned candidates
  remaining (must be zero to report GO);
- registry additions;
- indication-scope review candidates reported for this run's rows, and how each
  was resolved;
- the `scopeClass` assigned to every row this run created or touched, grouped
  by class, and any `data:probe:scope-class` candidates reported for this
  run's rows with how each was resolved;
- for each touched row's `scopeClass`, whether it was authored from the
  record's already-stored `metadata.sources` (no `lastVerifiedAt`/`checkedAt`
  change) or from a source reopened this run (`lastVerifiedAt` and that
  source's `checkedAt` updated) — see
  [Source and Entry Policy §Metadata effects of an authored-field backfill](./source-and-entry-policy.md#metadata-effects-of-an-authored-field-backfill);
- final independent coverage-pass result;
- principal sources;
- generation and validation results;
- blockers or source-access failures;
- run-level completion status — **GO** or **NO-GO** — per the gate in
  section 5, including confirmation that section 5 item 10 (stacked-branch
  re-validation) was applied when this run's branch is stacked on unmerged
  prior changes, and any prior correction found intentionally superseded,
  with its superseding evidence.

Do not claim completion (GO) unless the coverage gate and required validation
have completed.
