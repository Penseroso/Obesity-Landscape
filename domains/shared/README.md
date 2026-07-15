---
role: shared-migration-entrypoint
status: active
authority: non-authoritative
update-boundary: Update only when shared migration ownership or status changes.
---

# Shared Domain

This README is a **non-authoritative migration entrypoint**. Current authority
remains at the existing repository paths linked below until a later migration
module completes.

## Current ownership

- [`AGENTS.md`](../../AGENTS.md) remains the sole general documentation
  entrypoint and repository task router.
- Root configuration and tooling remain at their existing repository paths.
- Validation and generation remain in `scripts/data-registry.mjs`.
- Shared formatting remains in `lib/format.ts`.

## Intended future ownership

Later migration modules may place only approved, genuinely cross-domain library
or infrastructure code under this root. Root-pinned routing, configuration, and
tooling remain in place unless a later approved module explicitly changes them.

## Migration status

Module 1 creates this entrypoint only. No existing file has moved, and no
import, validator, generator, configuration, data path, fixture, or generated
output has changed. Shared-type placement (D2) and ownership of the dual-domain
registry script (D3) remain unresolved.

## Authority boundaries

This README creates no semantic or operational authority and defines no
compatibility layer. It does not supersede `AGENTS.md`, any domain contract or
workflow, or root configuration, and it does not authorize a later move.
