# Decision Log

ADR-lite, **append-only** record of protocol decisions. Add new entries at the
bottom; do not rewrite history. Each entry: decision ID, date, status,
decision, rationale, consequences.

---

## ADR-0001 — Current-state snapshot

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** The dataset is a current-state snapshot, not an event history.
- **Rationale:** The application tracks the present competitive landscape;
  historical event tracking is out of scope for Module 5.
- **Consequences:** Records are updated in place; there is no per-change audit
  trail beyond `updatedAt` / `lastVerifiedAt`.

## ADR-0002 — Stable IDs

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Company, asset, and program IDs are stable and reused.
- **Rationale:** Stability enables deduplication, updates, and cross-record
  references.
- **Consequences:** Renames change display values only; IDs never change. The
  exact program-ID suffix scheme is deferred (see ADR-0011 group).

## ADR-0003 — Stage/status excluded from program identity

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Development stage and status are not part of program identity or
  stable IDs.
- **Rationale:** They are mutable; embedding them would fragment identity as
  programs progress.
- **Consequences:** Program identity is defined by company, asset, route,
  dosage form, and indication scope when needed.

## ADR-0004 — Mutable stage/status update the existing record

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Stage and status changes update the existing record.
- **Rationale:** Consistent with the current-state snapshot and stable identity.
- **Consequences:** Phase 1→Phase 2 and Active→Discontinued edit the record;
  they do not create new rows.

## ADR-0005 — Field-specific source policy

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** No single global source hierarchy; source authority is judged
  per field/claim type.
- **Rationale:** The best evidence differs by claim (registry for trial phase,
  company materials for platform, regulator for approval).
- **Consequences:** Entry and conflict handling reference the per-field policy
  in `source-and-entry-policy.md`.

## ADR-0006 — `N/A` is UI-only

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** `"N/A"` is never stored in JSON; it is rendered by the UI only.
- **Rationale:** `lib/format.ts` derives `"N/A"` from absent values.
- **Consequences:** Absent values are stored as `null` (nullable fields) and
  displayed as `"N/A"`.

## ADR-0007 — `null` and `Unknown` have different meanings

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** `null` marks an absent nullable field value; `Unknown` is an
  enumerated stage/status for a confirmed program whose state is unresolved.
- **Rationale:** They express different facts and must not be conflated.
- **Consequences:** `Unknown` is never used to mean "field empty"; unconfirmed
  programs are excluded, not marked `Unknown`.

## ADR-0008 — Discontinued records are retained

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Discontinued programs remain in the dataset when discontinuation
  is evidenced.
- **Rationale:** Competitive landscape includes stopped programs.
- **Consequences:** Discontinuation requires explicit evidence; disappearance
  alone is insufficient.

## ADR-0009 — Current schema remains provisional

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** The TypeScript data contract is treated as provisional.
- **Rationale:** Structural gaps exist (ownership, provenance, combinations).
- **Consequences:** Gaps are logged in `edge-cases.md`; the schema is not
  redesigned in Module 5.

## ADR-0010 — Contract changes deferred until pilot evidence

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** No contract changes until real pilot data justifies them.
- **Rationale:** Avoid speculative schema design before evidence exists.
- **Consequences:** Deferred decisions (below) stay open until pilot.

---

## Deferred decisions (open until pilot)

Listed, **not resolved**. Each will be revisited with real pilot evidence and,
when decided, recorded as a new appended ADR.

- **Indication-level row granularity** — how far to split rows by indication.
- **Primary company for co-development** — how to choose/represent the principal
  entity when development is shared.
- **Rights and regional ownership model** — whether to model licensor/licensee
  and territories.
- **Device granularity** — whether device/injector differences split programs.
- **Controlled vocabulary for mechanism and platform** — free-text vs. enum.
- **Combination asset identity** — how fixed-dose combinations relate to
  components.
- **Field-level provenance** — whether sources should attach per field.
- **Exact adjacent-program inclusion boundary** — precise criteria for tracking
  non-GLP-1 strategic competitors.
