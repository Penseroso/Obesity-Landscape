---
role: clinical-evidence-migration-entrypoint
status: active
authority: non-authoritative
update-boundary: Update only when Clinical Evidence migration ownership or status changes.
---

# Clinical Evidence Domain

This README is a **non-authoritative migration entrypoint**. Current authority
remains at the canonical repository paths linked below; temporary compatibility
entrypoints remain at the legacy paths until a later migration module removes
them.

## Current ownership

- Clinical Evidence semantics and file rules are canonical in the
  [Clinical Evidence Data Contract](./docs/README.md).
- Research execution is canonical in the
  [Clinical Evidence Workflow](./docs/workflow.md).
- Types and loading are canonical under `domains/clinical-evidence/lib/`.
  Their legacy `lib/clinical-evidence/` paths are temporary compatibility
  shims; selectors remain there pending D5.
- Clinical Evidence imports shared `RecordMetadata` from
  `domains/shared/lib/record-metadata.ts` and Company/Pipeline-owned
  `ComponentReference` from `domains/company-pipeline/lib/types.ts`.
- Editable evidence, fixtures, the generated aggregate, and the derived
  projection remain under their existing `data/` paths.
- Clinical routes and components remain owned by Application/UI.

## Intended future ownership

Later migration modules may place settled Clinical Evidence documentation,
domain library code, editable evidence, fixtures, and domain-owned generated
artifacts under this root. UI presentation and interaction are not part of this
domain.

## Migration status

Module 1 created this entrypoint. Module 2 resolved D2 while preserving the
one-way Clinical Evidence to Company/Pipeline identity dependency. Module 4
moved the settled authoritative documentation, types, and loader while
preserving legacy documentation and import entrypoints. No validator,
generator, selector, data path, fixture, or generated output changed. Data
relocation (D4) and selector/read-model ownership (D5) remain unresolved.

## Authority boundaries

This README does not define or change Clinical Evidence semantics, schema, or
projection versions. It does not supersede the Clinical Evidence contract, its
workflow, `AGENTS.md`, or any authority linked from them, and it does not
authorize a later move.
