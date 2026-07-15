---
role: application-ui-migration-entrypoint
status: active
authority: non-authoritative
update-boundary: Update only when Application/UI migration ownership or status changes.
---

# Application/UI Domain

This README is a **non-authoritative migration entrypoint**. Current authority
remains at the existing repository paths linked below until a later migration
module completes.

## Current ownership

- Routes, read-model boundaries, and user-visible data semantics remain in the
  [UI Reference](../../docs/ui/README.md).
- Routing and page composition remain in `app/`.
- Presentation and interaction, including clinical UI, remain in `components/`.
- Application configuration remains in `config/`.
- Current read models and selectors remain at their existing `lib/` paths.

## Intended future ownership

Later migration modules may place settled presentation, interaction, and
application configuration under this root. Clinical UI belongs to this domain,
not to Clinical Evidence.

## Migration status

Module 1 creates this entrypoint only. No existing file has moved, and no route,
import, selector, read model, loader, data consumer, or configuration has
changed. Read-model ownership (D5) and the framework-pinned `app/` destination
(D6) remain unresolved.

## Authority boundaries

This README does not define routes, read-model semantics, UI behavior, or data
contracts. It does not supersede the UI Reference, `AGENTS.md`, or the
Company/Pipeline and Clinical Evidence authorities, and it does not authorize a
later move.
