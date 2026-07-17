# Obesity Landscape

Next.js application and source-based dataset for the competitive
obesity/incretin development landscape. The repository tracks Company/Pipeline
records and a separate Clinical Evidence v3 domain.

Agents start at [`AGENTS.md`](AGENTS.md). Current rules live in the
[Data Protocol](domains/company-pipeline/docs/README.md), the
[Clinical Evidence contract](domains/clinical-evidence/docs/README.md), and the
[UI reference](domains/app/docs/README.md). Historical reports are not
implementation instructions.

## Data flow

```text
Company/Pipeline source
domains/company-pipeline/data/companies/<company-id>/*
  -> npm run data:generate
  -> data/generated/{companies,pipeline-programs,regimens}.json
  -> domains/company-pipeline/lib (types, loaders, selectors)
     + domains/app/lib/company-detail (Application read model)
  -> pages and components

Clinical Evidence source
domains/clinical-evidence/data/clinical-evidence/<company-id>/<asset-id>/clinical-evidence.json
  -> npm run data:generate
  -> data/generated/clinical-evidence.json
     + clinical-evidence-asset-studies.json
  -> domains/clinical-evidence/lib
     + domains/app/lib/clinical-evidence/selectors
  -> company, asset, program, and study UI
```

Editable source data is authoritative. Files under `data/generated/` are
deterministic outputs and must not be edited by hand. The full consumer
boundary is defined in the
[Generated Output Contract](domains/company-pipeline/docs/generated-output-contract.md).

## Current UI

- portfolio overview;
- searchable and filterable program register;
- program detail drawer with clinical context;
- company detail and clinical inventory;
- asset-level focal and linked study views;
- Study detail with Arms, AnalysisGroups, Endpoints, Outcomes, and sources.

## Repository structure

- `app/`: routes and page composition (root-pinned; see the
  [UI reference](domains/app/docs/README.md) for the D6 resolution);
- `components/`, `config/`, `lib/format.ts`: compatibility shims for the
  canonical Application/UI code under `domains/app/`;
- `domains/app/`: authoritative Application/UI presentation and interaction
  (`components/`), configuration (`config/`), display formatting
  (`lib/format.ts`), and the cross-domain read-model tier
  (`lib/company-detail/`, `lib/clinical-evidence/selectors.ts`);
- `domains/company-pipeline/`: authoritative Company/Pipeline documentation and
  settled types, loaders, filters, constants, portfolio logic, the selector
  read model, the `asset-alias-types.json` contract vocabulary (moved here in
  Module 8, D3), and Company/Pipeline-owned editable data under
  `domains/company-pipeline/data/` (source records, registries, and synthetic
  fixtures, relocated in the post-Module-8 D4 execution module);
- `lib/programs/`: compatibility shims only (pending Module 9);
- `domains/clinical-evidence/`: authoritative Clinical Evidence documentation,
  types, loading, and Clinical Evidence-owned editable data under
  `domains/clinical-evidence/data/` (source records and fixtures, relocated in
  the post-Module-8 D4 execution module);
- `lib/clinical-evidence/`: compatibility shims only (`selectors.ts` moved to
  `domains/app/lib/clinical-evidence/` in Module 6);
- `lib/company-detail/`: compatibility shim only (read model moved to
  `domains/app/lib/company-detail/` in Module 6);
- domain-owned editable data, relocated in the post-Module-8 D4 execution
  module (semantic ownership was decided in Module 7, D4; D3 was resolved by
  retention in Module 8, which removed the earlier relocation precondition):
  - `domains/company-pipeline/data/companies/`: editable Company/Pipeline source records;
  - `domains/clinical-evidence/data/clinical-evidence/`: editable Clinical Evidence source records;
  - `domains/company-pipeline/data/registries/`: controlled Company/Pipeline vocabularies;
  - `domains/company-pipeline/data/validation-fixtures/synthetic/` and
    `domains/clinical-evidence/data/validation-fixtures/clinical-evidence/`: active validation fixtures;
- `data/generated/`: generated consumer artifacts, **retained** at the root as a
  shared multi-domain sink (the D4 execution kept this sink in place, mirroring
  the Module 8 retention of `scripts/data-registry.mjs`; splitting it was not
  part of D4);
- `docs/history/`: frozen non-authoritative audits, migrations, and diagnostic
  evidence.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run data:validate:registries
npm run data:validate:companies
npm run data:generate
npm run data:validate:generated
npm run data:validate:clinical-evidence
npm run data:validate:clinical-evidence:generated
npm run data:validate:clinical-evidence:synthetic
npm run data:validate:synthetic
```

The repository has no GitHub Actions CI; workflows report local validation
results.

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Generated local JSON datasets
