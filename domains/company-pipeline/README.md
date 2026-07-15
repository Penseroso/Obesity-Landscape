---
role: company-pipeline-migration-entrypoint
status: active
authority: non-authoritative
update-boundary: Update only when Company/Pipeline migration ownership or status changes.
---

# Company/Pipeline Domain

This README is a **non-authoritative migration entrypoint**. Current authority
remains at the existing repository paths linked below until a later migration
module completes.

## Current ownership

- Company/Pipeline scope and contract ownership remain in the
  [Data Protocol](../../docs/data-protocol/README.md).
- Research execution remains in the
  [Company/Pipeline Research Workflow](../../docs/research-workflow.md).
- Types, loaders, filters, portfolio logic, constants, and selectors remain in
  `lib/programs/`.
- Editable Company/Pipeline data remains in `data/companies/` and
  `data/registries/`; fixtures and generated artifacts remain under their
  existing `data/` paths.

## Intended future ownership

Later migration modules may place settled Company/Pipeline documentation,
domain library code, editable data, fixtures, and domain-owned generated
artifacts under this root. Each relocation requires its own approved module and
validation boundary.

## Migration status

Module 1 creates this entrypoint only. No existing file has moved, and no
import, loader, validator, generator, selector, data path, fixture, or generated
output has changed. Shared-type placement (D2), data relocation (D4), and
selector/read-model ownership (D5) remain unresolved.

## Authority boundaries

This README does not define or change Company/Pipeline Contract, Scope, schema,
or projection versions. It does not supersede the Data Protocol, the research
workflow, `AGENTS.md`, or any authority linked from them, and it does not
authorize a later move.
