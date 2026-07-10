# Generated Output Contract

Defines the contract for derived files under `data/generated/`: what they are,
how they are produced, what they guarantee to downstream consumers (UI, reports,
future tools), and what they do not. The Company/Pipeline aggregates describe
current Contract 1.1 behavior (ADR-0030) and preserve the stage semantics
(ADR-0024); generation is a verbatim passthrough and adds no new fields.
`clinical-evidence.json` belongs to the separate Clinical Evidence data layer.

## 1. Source-of-truth boundary

- `data/companies/<company-id>/{company,pipeline-programs,regimens}.json` are the
  human-edited Company/Pipeline operating source of truth.
- `data/clinical-evidence/<company-id>/<asset-id>/clinical-evidence.json` files
  are the human-edited Clinical Evidence source of truth.
- `data/generated/*.json` files are **generated artifacts**. Do not edit them by
  hand.
- They are produced only by `npm run data:generate`
  (`scripts/data-registry.mjs`) from operating data plus the
  repository-controlled registries under `data/registries/`.
- Generation creates **no new semantic facts**: every generated record is a
  verbatim copy of an operating record (see §4). It aggregates and orders; it
  does not transform, enrich, infer, or join.

## 2. Determinism and ordering

`npm run data:generate` is deterministic: the same operating data and registries
always produce byte-identical output. Ordering is guaranteed by code in
`scripts/data-registry.mjs`, not merely observed:

- **File set:** exactly four files — `companies.json`,
  `pipeline-programs.json`, `regimens.json`, and
  `clinical-evidence.json`.
- **Company order:** by `id` ascending (`localeCompare`).
- **Program order:** by `companyId`, then program `id` (`localeCompare`).
- **Regimen order:** by `companyId`, then regimen `id` (`localeCompare`).
- **Clinical Evidence order:** studies by `companyId`, `assetId`, then `id`;
  arms and endpoints by `studyId`, then `id`; outcomes by `studyId`,
  `endpointId`, then `id` (`localeCompare`).
- Sort keys (`id`, `companyId`) are unique within the dataset, so ordering is
  total and independent of sort stability.
- Records are serialized with two-space indentation and a trailing newline;
  object key order within each record is the key order of the source record.

Generation validates each company folder and the combined aggregate before
writing, so invalid operating data fails generation rather than producing
output.

## 3. Generated file inventory

| File | Source operating files | Shape | Kind | Primary consumers | Stable v1 output |
| --- | --- | --- | --- | --- | --- |
| `companies.json` | every `data/companies/*/company.json` | JSON array of `Company` | flat aggregate | UI company lists, report grouping, loader | yes |
| `pipeline-programs.json` | every `data/companies/*/pipeline-programs.json` | JSON array of `PipelineProgramRecord` | flat aggregate | UI program board/detail, filtering, reports | yes |
| `regimens.json` | every `data/companies/*/regimens.json` | JSON array of `RegimenRecord` | flat aggregate | future regimen views/tooling (no current UI) | yes |
| `clinical-evidence.json` | every `data/clinical-evidence/*/*/clinical-evidence.json` | object with `studies`, `arms`, `endpoints`, and `outcomes` arrays | flat aggregate | future Clinical Evidence tooling (no current UI) | no; separate v2 Clinical Evidence output |

Each file is a flat concatenation of the corresponding operating records across
all source folders, then sorted per §2. None is a joined view, index, or
summary. `regimens.json` is type-safe and generated even though the current UI
does not display regimens (ADR-0017). `clinical-evidence.json` is generated for
the separate Clinical Evidence domain and is not displayed by the current UI.

## 4. Field-level guarantees

Generated program and regimen records are **byte-identical** to their operating
source records — every field is passed through verbatim, none added or stripped.
For pipeline programs the generated output preserves, when present in the source:

- `id`, `assetId`, `companyId`
- `assetType`, `assetName`, `codeName`, `aliases`, `components`
- `technical` (`mechanism`, `platform`)
- `administration` (`route`, `dosageForm`, `dosingInterval`)
- `indications`
- `development.stage`, `development.status`, `development.stageBasis`,
  `development.stageOperationalState`
- `regulatoryStates`
- `relationships`
- `metadata` (including `sources`)

`companies.json` preserves `id`, `name`, and `headquartersCountry` verbatim.
Regimen records preserve their full operating shape (`id`, `companyId`, `name`,
`configurationKey`, `components`, `indications`, `development`,
`regulatoryStates`, `administration`, `relationships`, `metadata`).
Clinical Evidence records preserve Study, Arm, Endpoint, and Outcome source
records verbatim in separate arrays.

The generator does **not** join the resolving `Company` object into program or
regimen records. `PipelineProgram.company` / `Regimen.company` are populated at
**load time** by `lib/programs/data.ts`, not stored in the generated files. This
is current v1 behavior; consumers that need the company object resolve it through
the loader, not from the generated file.

Optional fields absent from a source record are simply absent from the generated
record; their absence carries no meaning (see §5).

## 5. Consumer contract

Downstream UI, report, and tool consumers:

- **May** read generated files for display, filtering, sorting, and
  board/report views.
- **Must not** treat generated files as an editable source of truth.
- **Must** make Company/Pipeline edits in `data/companies/`.
- **Must** make Clinical Evidence edits in `data/clinical-evidence/`.
- **Must not** infer an absent source fact from a generated-field omission — an
  omitted optional field means "not recorded", not a semantic negative.
- **Must** trace semantic questions (why a stage, what evidence) back to the
  operating record and its `metadata.sources`.
- **Should** treat generated files that are stale relative to operating data as a
  build/validation failure to be fixed by regeneration, never as a competing
  source of truth.
- **Must** describe counts derived from these files as **tracked
  obesity/incretin competitive program** counts (the v1.1 scope, ADR-0026), not
  GLP-1 receptor agonist-only counts; presence of a record does not imply the
  program is a GLP-1 RA or GLP-1-containing.

## 6. Validation contract

- `npm run data:validate:generated` re-reads `data/generated/*.json` and runs the
  full dataset validation (identity uniqueness, row/combination/regimen identity,
  registry-backed stage/regulatory-state/relationship values, component and
  reference rules, metadata and date rules). It guarantees the generated
  aggregate is **structurally valid and internally consistent** under
  Contract 1.1.
- It does **not** by itself prove the generated files are **up-to-date** with
  operating data. Staleness is detected by running `npm run data:generate` and
  confirming `git diff` shows no change under `data/generated/`.
- Generated validation does **not** replace the other validators:
  `data:validate:companies` (operating source), `data:validate:registries`
  (vocabularies), `data:validate:stress` (diagnostic archives), and
  `data:validate:synthetic` (fixtures) each cover a different surface.
- Clinical Evidence has additional validators:
  `data:validate:clinical-evidence`,
  `data:validate:clinical-evidence:generated`, and
  `data:validate:clinical-evidence:synthetic`.
- After any operating-data change, the workflow requires running
  `npm run data:generate` and then the validators before reporting (see
  [`../research-workflow.md`](../research-workflow.md) and
  [`../../prompts/research-company.md`](../../prompts/research-company.md)).

## 7. Relationship with Contract 1.1 semantics

Because generation is a verbatim passthrough, generated outputs preserve the
ADR-0024 / ADR-0030 stage and identity semantics exactly:

- `development.stage` remains the most advanced official current development
  stage for the program scope.
- Regulatory-development milestones such as `IND submitted` and `IND cleared` are
  carried through unchanged; they are never downgraded or approximated as
  clinical phases in generated output.
- `development.stageBasis`, `development.stageOperationalState`, and
  `regulatoryStates` are emitted whenever the source records them, so consumers
  can display them.
- There is **no** separate generated-only interpretation of stage or status; the
  generated value is the operating value.
- `assetId` is immutable, `assetName` is the canonical name, and typed `aliases`
  are passed through verbatim; generation does not rename, merge, or resolve
  aliases across companies.

## 8. V2 boundary

The following remain v2 backlog and are **not** part of the v1 generated-output
contract; a downstream need for one of them is recorded as backlog, not
implemented here:

- field-level provenance
- durable adjacent-inclusion rationale field
- excluded/deferred candidate ledger
- program-ID suffix scheme
- per-jurisdiction approval modeling
- cross-company entity resolution
- relationship / regimen UI-specific output layers (for example joined or
  denormalized views)
