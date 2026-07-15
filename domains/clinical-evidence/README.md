---
role: clinical-evidence-migration-entrypoint
status: active
authority: non-authoritative
update-boundary: Update only when Clinical Evidence migration ownership or status changes.
---

# Clinical Evidence Domain

This README is a **non-authoritative migration entrypoint**. Current authority
remains at the existing repository paths linked below until a later migration
module completes.

## Current ownership

- Clinical Evidence semantics and file rules remain in the
  [Clinical Evidence Data Contract](../../docs/clinical-evidence/README.md).
- Research execution remains in the
  [Clinical Evidence Workflow](../../docs/clinical-evidence-workflow.md).
- Types, loading, and selectors remain in `lib/clinical-evidence/`.
- Editable evidence, fixtures, the generated aggregate, and the derived
  projection remain under their existing `data/` paths.
- Clinical routes and components remain owned by Application/UI.

## Intended future ownership

Later migration modules may place settled Clinical Evidence documentation,
domain library code, editable evidence, fixtures, and domain-owned generated
artifacts under this root. UI presentation and interaction are not part of this
domain.

## Migration status

Module 1 creates this entrypoint only. No existing file has moved, and no
import, loader, validator, generator, selector, data path, fixture, or generated
output has changed. Shared dependency placement (D2), data relocation (D4), and
selector/read-model ownership (D5) remain unresolved.

## Authority boundaries

This README does not define or change Clinical Evidence semantics, schema, or
projection versions. It does not supersede the Clinical Evidence contract, its
workflow, `AGENTS.md`, or any authority linked from them, and it does not
authorize a later move.
