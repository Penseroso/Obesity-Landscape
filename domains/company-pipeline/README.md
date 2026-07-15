---
role: company-pipeline-migration-entrypoint
status: active
authority: non-authoritative
update-boundary: Update only when Company/Pipeline migration ownership or status changes.
---

# Company/Pipeline Domain

This README is a **non-authoritative migration entrypoint**. Current authority
remains at the canonical repository paths linked below; temporary compatibility
entrypoints remain at the legacy paths until a later migration module removes
them.

## Current ownership

- Company/Pipeline scope and contract ownership are canonical in the
  [Data Protocol](./docs/README.md).
- Research execution is canonical in the
  [Company/Pipeline Research Workflow](./docs/research-workflow.md).
- Company/Pipeline types, loaders, filters, portfolio logic, and constants are
  canonical under `domains/company-pipeline/lib/`. Their legacy
  `lib/programs/` paths are temporary compatibility shims.
- Selectors and `asset-alias-types.json` remain in `lib/programs/` pending the
  separate D5 and D3 boundaries.
- Editable Company/Pipeline data remains in `data/companies/` and
  `data/registries/`; fixtures and generated artifacts remain under their
  existing `data/` paths.

## Intended future ownership

Later migration modules may place remaining settled Company/Pipeline code,
editable data, fixtures, and domain-owned generated artifacts under this root.
Each relocation requires its own approved module and validation boundary.

## Migration status

Module 1 created this entrypoint. Module 2 resolved D2: `ComponentReference`
remains Company/Pipeline-owned, while `RecordMetadata` and `SourceReference`
are shared provenance types. Module 3 moved the settled authoritative
documentation and the types, loaders, filters, portfolio logic, and constants
while preserving legacy import and documentation entrypoints. No validator,
generator, selector, data path, fixture, or generated output changed. D3-D6
remain unresolved.

## Authority boundaries

This README does not define or change Company/Pipeline Contract, Scope, schema,
or projection versions. It does not supersede the Data Protocol, the research
workflow, `AGENTS.md`, or any authority linked from them, and it does not
authorize a later move.
