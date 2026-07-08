# GLP-1 Pipeline Board

Frontend and data-model skeleton for tracking the competitive **obesity/incretin
development landscape** — initially centered on GLP-1, incretin, amylin, and
glucagon-axis obesity pharmacotherapy (v1.1 scope, see ADR-0026). It is not a
GLP-1 receptor agonist-only tracker; inclusion of a program does not imply it is
a GLP-1 receptor agonist or GLP-1-containing, and tracked counts are
obesity/incretin competitive programs, not GLP-1 RA-only counts. See
[`docs/data-protocol/README.md`](docs/data-protocol/README.md) for the full
dataset scope.

The project uses a minimal TPP-oriented dataset covering mechanism, platform,
indication, route, dosage form, dosing interval, development stage, and
development status. It is designed as a frontend foundation for future
source-based research and periodic updates.

The operating dataset is generated from `data/companies/` source folders:

- `data/generated/companies.json` aggregates company records.
- `data/generated/pipeline-programs.json` aggregates pipeline program records.
- `data/generated/regimens.json` aggregates regimen records.

## Program Row Rule

- Stable program identity is company, asset, route, and dosage form (plus indication scope when needed to distinguish concurrent programs).
- Development stage and development status are mutable state, not identity: when they change, the existing record is updated in place.
- Records for the same asset share the same `assetId` and use different program `id` values.
- Multiple indications may share one record only when company, asset, route, dosage form, stage, and status are all the same.

See [`docs/data-protocol/`](docs/data-protocol/) for the full research and data-entry protocol, including entity/row rules, field-specific source policy, edge cases, and decisions.

For company research and automatic record updates, see the [`docs/research-workflow.md`](docs/research-workflow.md) workflow and the reusable [`prompts/research-company.md`](prompts/research-company.md) prompt.

## Architecture

- `data/companies/<company-id>/company.json` and
  `data/companies/<company-id>/pipeline-programs.json` are the human-edited
  operating source-of-truth files. New company folders also include
  `regimens.json`, using `[]` when no regimens are tracked.
- `data/generated/companies.json` and
  `data/generated/pipeline-programs.json` are generated aggregate files read by
  the UI and data loader. `data/generated/regimens.json` is generated and
  type-safe for future use but is not displayed by the current UI. Do not edit
  generated files directly.
- `data/stress-tests/<case-id>/` contains isolated diagnostic references from
  stress-test pilots. These archives are excluded from production aggregate
  generation and are not golden expected output.
- `data/registries/development-stages.json` and
  `data/registries/regulatory-states.json` define accepted development-stage
  and regulatory-state vocabulary. `data/registries/company-relationship-roles.json`
  defines program/regimen relationship roles.
- Internal component and relationship references are company-folder-local.
  Assets or companies owned by another company are stored with names and
  `externalCompanyName`; generated aggregates do not perform cross-company
  reference resolution.
- Regimens with the same principal company, component set, and indication scope
  may use `configurationKey` only when official evidence confirms a distinct
  stable configuration.
- `lib/programs/types.ts` defines the program data contract.
- `lib/programs/data.ts` loads generated JSON data and resolves program
  `companyId` values to companies.
- `lib/programs/selectors.ts` owns derived-data calculations.
- `lib/programs/filters.ts` owns program filtering.
- `lib/format.ts` owns shared display formatting.
- `config/program-table.ts` owns table display configuration.
- Components form the presentation layer.

```text
data/companies/<company-id>/*
-> data:generate
-> data/generated/*.json
-> data.ts
-> selectors / filters
-> components
```

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Generated local JSON datasets

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
npm run data:validate:registries
npm run data:validate:companies
npm run data:generate
npm run data:validate:generated
npm run data:validate:stress
npm run data:validate:synthetic
```

## Scope

- Overview dashboard
- Searchable and filterable pipeline program register
- Program detail drawer
- Company and program JSON files driven by source-based records

No scraping, authentication, backend, real database, alerts, or automation are
implemented in this skeleton.
