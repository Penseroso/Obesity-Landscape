# GLP-1 Pipeline Board

Frontend and data-model skeleton for tracking companies and development
programs related to GLP-1 receptor agonists and adjacent incretin therapies.

The project uses a minimal TPP-oriented dataset covering mechanism, platform,
indication, route, dosage form, dosing interval, development stage, and
development status. It is designed as a frontend foundation for future
source-based research and periodic updates.

The current dataset is empty:

- `data/companies.json` contains `[]`
- `data/pipeline-programs.json` contains `[]`

## Program Row Rule

- Stable program identity is company, asset, route, and dosage form (plus indication scope when needed to distinguish concurrent programs).
- Development stage and development status are mutable state, not identity: when they change, the existing record is updated in place.
- Records for the same asset share the same `assetId` and use different program `id` values.
- Multiple indications may share one record only when company, asset, route, dosage form, stage, and status are all the same.

See [`docs/data-protocol/`](docs/data-protocol/) for the full research and data-entry protocol, including entity/row rules, field-specific source policy, edge cases, and decisions.

For company research and automatic record updates, see the [`docs/research-workflow.md`](docs/research-workflow.md) workflow and the reusable [`prompts/research-company.md`](prompts/research-company.md) prompt.

## Architecture

- `data/companies.json` and `data/pipeline-programs.json` are the source data files.
- `lib/programs/types.ts` defines the program data contract.
- `lib/programs/data.ts` loads JSON data and resolves program `companyId` values to companies.
- `lib/programs/selectors.ts` owns derived-data calculations.
- `lib/programs/filters.ts` owns program filtering.
- `lib/format.ts` owns shared display formatting.
- `config/program-table.ts` owns table display configuration.
- Components form the presentation layer.

```text
companies.json + pipeline-programs.json
-> data.ts
-> selectors / filters
-> components
```

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Empty local JSON datasets

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Scope

- Overview dashboard
- Searchable and filterable pipeline program register
- Program detail drawer
- Empty company and program JSON files ready for future source-based records

No scraping, authentication, backend, real database, alerts, or automation are
implemented in this skeleton.
