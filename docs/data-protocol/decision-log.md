# Decision Log

ADR-lite, **append-only** record of protocol decisions. Add new entries at the
bottom; do not rewrite history. Each entry: decision ID, date, status,
decision, rationale, consequences.

## Current-decision index

Quick pointer to the currently governing ADR per topic. Superseded ADRs are
kept below for history; consult the index instead of the oldest matching
entry.

- **Stress-test / Ascletis archive semantics:** ADR-0021 (supersedes
  ADR-0012).
- **Combination asset identity:** ADR-0016.
- **Rights and regional ownership model:** ADR-0018 / ADR-0019.
- **Regimen vs. pipeline program:** ADR-0017.
- **Regimen configuration identity:** ADR-0023.
- **Stage semantics and operational-state annotation:** ADR-0024.
- **Company relationship roles:** ADR-0020.
- **Internal reference scope:** ADR-0022.
- **v1 data contract freeze:** ADR-0025.
- **Product scope (v1.1 obesity/incretin landscape):** ADR-0026.

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
  exact program-ID suffix scheme is deferred (see
  [Deferred decisions](#deferred-decisions-open-until-pilot) below).

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
- ~~**Rights and regional ownership model** — whether to model licensor/licensee
  and territories.~~ Resolved by ADR-0018/ADR-0019.
- **Device granularity** — whether device/injector differences split programs.
- **Controlled vocabulary for mechanism and platform** — free-text vs. enum.
- ~~**Combination asset identity** — how fixed-dose combinations relate to
  components.~~ Resolved by ADR-0016.
- **Field-level provenance** — whether sources should attach per field.
- **Exact adjacent-program inclusion boundary** — precise criteria for tracking
  non-GLP-1 strategic competitors. Clarified for v1.1 by ADR-0026 for the
  obesity/incretin axis; the full obesity-pharmacotherapy boundary stays v2.
- **Program-ID suffix scheme** — the exact algorithm for the stable
  configuration suffix referenced in ADR-0002.

---

## ADR-0011 — Generated operating aggregates

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Company folders under `data/companies/` are the human-edited
  operating source of truth. `data/generated/*.json` files are deterministic
  generated aggregates consumed by the UI and loader.
- **Rationale:** Company-scoped source files reduce merge conflicts and make
  ownership of data updates clearer while preserving the existing UI contract.
- **Consequences:** Generated files must not be edited directly. Aggregate
  generation excludes `data/stress-tests/`.

## ADR-0012 — Stress-test fixture isolation

- **Date:** 2026-07-07
- **Status:** Superseded by ADR-0021
- **Decision:** Ascletis pilot data is retained under
  `data/stress-tests/ascletis-pharma/` as a fixture rather than operating data.
- **Rationale:** The pilot is contract evidence, not production coverage.
- **Consequences:** Fixture data uses the same validator but is excluded from
  generated operating aggregates.

## ADR-0013 — Registry-backed development stages

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Development-stage vocabulary is stored in
  `data/registries/development-stages.json` with canonical labels, aliases,
  family, and sort rank.
- **Rationale:** Official stage precision such as `Phase 1b` or `Phase 1/2`
  must not be collapsed into broader labels.
- **Consequences:** Validators reject stages absent from the registry. New
  official values can be promoted during the same research execution and commit.

## ADR-0014 — Regulatory state separated from development stage

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Regulatory state is stored separately from development stage as
  registry-backed program data with jurisdiction, authority, and optional date.
- **Rationale:** Regulatory milestones such as `IND submitted` and `IND cleared`
  are not clinical development stages.
- **Consequences:** Validators reject regulatory states absent from
  `data/registries/regulatory-states.json`.

## ADR-0015 — ISO 8601 partial evidence dates

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Evidence dates such as `publishedAt` and regulatory-state date
  may use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. Verification metadata remains
  full-date only.
- **Rationale:** Sources often disclose only month or year precision.
- **Consequences:** Unknown months or days must not be filled with artificial
  `01` values.

## ADR-0016 — Combination assets keep one program identity

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Fixed-dose combinations and co-formulations are represented as
  one pipeline asset/program with one stable `assetId`, plus component
  references.
- **Rationale:** A combination product is developed as a single product
  configuration even when components can be named independently.
- **Consequences:** Component order does not affect identity. Validators reject
  duplicate component sets and require at least two components for combination
  asset types.

## ADR-0017 — Regimen is separate from pipeline program

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Multi-product co-administration strategies are modeled as
  regimen records, not pipeline program rows.
- **Rationale:** Regimens do not create one product/formulation asset and must
  not be confused with fixed-dose combinations or co-formulations.
- **Consequences:** `data/generated/regimens.json` is generated separately.
  The current UI does not display regimens.

## ADR-0018 — Program and regimen company relationships

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Co-development, licensing, territory, rights, sponsor,
  commercialization, and manufacturing relationships are stored on the relevant
  program or regimen record.
- **Rationale:** Company roles vary by asset, program, regimen, jurisdiction,
  and rights category; they are not company-global facts.
- **Consequences:** Relationship data is optional and must be directly
  supported. Validators reject duplicate relationships.

## ADR-0019 — Principal companyId remains singular

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Existing `companyId` remains the principal development company
  used for grouping and record ownership.
- **Rationale:** Preserving the single principal company keeps the current UI and
  generated aggregate behavior stable.
- **Consequences:** Additional companies are represented through
  program/regimen-level `relationships`, not by replacing `companyId` with a
  company array.

## ADR-0020 — Company relationship role registry

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Company relationship roles are controlled by
  `data/registries/company-relationship-roles.json`.
- **Rationale:** Relationship role vocabulary is likely to expand during
  research and needs alias handling and promotion rules.
- **Consequences:** Validators reject relationship roles absent from the
  registry. New official role concepts can be promoted during the same research
  execution and commit.

## ADR-0021 — Ascletis archive is diagnostic reference only

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** `data/stress-tests/ascletis-pharma/` is preserved as diagnostic
  stress-test evidence and pilot output, not production data and not golden
  expected output.
- **Rationale:** The archive was created under earlier provisional contracts and
  should not be treated as semantic truth for the current model.
- **Consequences:** Stress validation checks archive integrity and production
  exclusion, not semantic completeness. A future fresh Ascletis investigation
  and explicit review is required before any golden fixture promotion.

## ADR-0022 — Internal references are company-source-local

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Component `assetId`, component `companyId`, and relationship
  `companyId` are internal references only within the current
  `data/companies/<company-id>/` source folder. Assets and companies owned by
  another company are represented with `assetName` or `codeName` plus
  `externalCompanyName`, or with relationship `externalCompanyName`.
- **Rationale:** Company folders are independent research and validation units.
  Data entry for one company should not depend on another company's folder,
  asset coverage, aliases, or load order.
- **Consequences:** The same external asset may be repeated by name in multiple
  company records. Generator and validator do not perform cross-company entity
  resolution, external-to-internal conversion, alias matching, or automatic
  deduplication. A future cross-company resolution module can revisit this.

## ADR-0023 — Regimen configuration identity

- **Date:** 2026-07-07
- **Status:** Accepted (fixed now)
- **Decision:** Regimens may use optional `configurationKey` to distinguish
  multiple officially distinct configurations with the same principal company,
  component set, and indication scope.
- **Rationale:** Component set and indication alone can collide for real
  simultaneous/sequential, route/formulation, protocol, dose-level development,
  or sponsor-defined regimen configurations. Display names are mutable and
  should not define stable identity.
- **Consequences:** Duplicate validation includes normalized
  `configurationKey`. If multiple regimens share a base identity, all related
  records must provide `configurationKey`. Stage, status, dates, results, and
  arbitrary suffixes are invalid discriminators.

## ADR-0024 — Stage semantics and operational-state annotation

- **Date:** 2026-07-08
- **Status:** Accepted (fixed now)
- **Decision:** For v1, `development.stage` is the most advanced official
  current development stage for the specific program scope. It includes
  nonclinical stages, regulatory-development milestones such as
  `IND submitted`, `IND cleared`, `CTA submitted`, and `CTA approved`, clinical
  phases, filing, and approval. Store optional `development.stageBasis` and
  `development.stageOperationalState` when evidence source and operational
  state need to be distinguished from the stored stage.
- **Rationale:** Competitive intelligence needs one comparable stage axis
  covering regulatory-development milestones and clinical phases, while audits
  still need to know whether a stage is submitted, cleared, initiated,
  recruiting, not yet recruiting, planned, paused, completed, or not separately
  confirmed.
- **Consequences:** A vague future plan or secondary news alone does not
  advance `development.stage`. `IND submitted`, `IND cleared`, and
  `CTA approved` are valid stages when they are the most advanced official
  current development stage, but they are not approximated as `Phase 1` without
  separate official clinical-stage evidence. Detailed jurisdiction, authority,
  and date remain in `regulatoryStates` when available.

## ADR-0025 — v1 data contract freeze

- **Date:** 2026-07-08
- **Status:** Accepted (fixed now)
- **Decision:** The v1 data contract is frozen. After Ascletis Pharma and
  Zealand Pharma stress testing, the current contract — `lib/programs/types.ts`,
  the `data/registries/` vocabularies, the `scripts/data-registry.mjs`
  validators, and the `docs/data-protocol/` rules — satisfies the v1 freeze
  criteria and requires no further structural change for v1. No blocker was
  found across the protocol documents, registries, validators, and current
  Ascletis / Zealand data.
- **Rationale:** The two operating companies exercised the contract's hard cases
  and each resolved without a schema change:
  - **Company-local identity** — company, asset, and program IDs are stable and
    reused; external companies and assets are represented by name with
    `externalCompanyName`, requiring no global entity graph (ADR-0022).
  - **Program row identity** — stage and status stay mutable and out of stable
    IDs (ADR-0003); rows split only when program/indication scope differs.
    Zealand petrelintide's Phase 2 obesity/overweight row and planned Phase 3
    chronic weight-management row are valid concurrent scopes.
  - **Development stage semantics** — `development.stage` is the most advanced
    official current stage for the program scope; regulatory-development
    milestones such as `IND submitted` and `IND cleared` are first-class stages
    with jurisdiction, authority, and date preserved in `regulatoryStates`, and
    are never approximated as clinical phases. `stageBasis` and
    `stageOperationalState` annotate evidence basis and operational state
    (ADR-0024).
  - **Combination and regimen handling** — fixed-dose combinations and
    co-formulations are one combination asset/program with components (ADR-0016);
    independently administered products are regimens (ADR-0017). Ascletis
    ASC30_39 FDC, ASC36_35 FDC, the ASC37 plus ASC36 regimen, and Zealand
    petrelintide / CT-388 FDC all fit.
  - **Source and provenance** — record-level `metadata.sources` are sufficient
    for v1; field-level provenance stays deferred to v2.
  - **Adjacent and excluded candidates** — adjacent non-GLP-1 inclusion
    rationale stays report-level and excluded candidates stay out of operating
    data.
  - **Generated outputs** — `data/generated/*` are deterministic aggregates of
    the operating source folders and reflect current records after
    `data:generate`.
- **Consequences:** No new companies, schema fields, UI, or workflow changes are
  introduced under this freeze. The v2 backlog is unchanged and remains
  deferred: field-level provenance, a durable adjacent-inclusion rationale
  field, an excluded/deferred candidate ledger, the program-ID suffix scheme,
  and the other open-until-pilot and edge-case items. Contract Consolidation
  (Module 2) may begin on this frozen v1 baseline.

## ADR-0026 — Product scope clarified as a v1.1 obesity/incretin landscape

- **Date:** 2026-07-08
- **Status:** Accepted (fixed now)
- **Decision:** The product is a **competitive obesity/incretin development
  landscape**, initially centered on GLP-1, incretin, amylin, and glucagon-axis
  obesity pharmacotherapy. It is **not** a GLP-1 receptor agonist-only tracker
  and **not yet** a full obesity-pharmacotherapy landscape. This clarifies —
  without changing any data shape, schema, validator, registry, or generated
  output — the earlier GLP-1-centered wording, and refines the deferred "exact
  adjacent-program inclusion boundary" decision for v1.1. It is a **semantic
  scope amendment**, not a contract-shape change, so the ADR-0025 v1 freeze and
  ADR-0024 stage semantics remain intact. The clarified scope is labeled v1.1.
- **v1.1 included classes** (named developer + confirmed official development
  intent required for each):
  - GLP-1 receptor agonists.
  - GLP-1-containing dual or triple agonists.
  - GLP-1-based combination products and GLP-1-based regimens.
  - amylin-only obesity programs.
  - amylin-containing obesity combination products or regimens.
  - GIP-only obesity programs, only when official evidence confirms obesity or
    weight-management development intent.
  - glucagon-only obesity programs, only when official evidence confirms obesity
    or weight-management development intent.
  - other incretin/amylin/glucagon-axis obesity programs when official evidence
    supports obesity or weight-management development intent.
- **v2-deferred classes** (not in v1.1 unless already GLP-1-based):
  - muscle-preserving, lean-mass preservation, or body-composition adjunct
    programs.
  - non-incretin anti-obesity classes such as MC4R, CB1, CNS appetite, lipase
    inhibitor, or unrelated small-molecule weight-loss programs.
  - MASH-only programs.
  - T2D-only programs.
  - CKD/CV/lipid/metabolic comorbidity-only programs.
  - broad metabolic platforms without official obesity or weight-management
    development intent.
- **Clarifications:**
  - A GLP-1-based regimen or combination may still be included even if one
    component is outside the core incretin/amylin/glucagon-axis classes.
  - A standalone non-incretin body-composition or lean-mass program is not
    included in v1.1 merely because it may become relevant to obesity treatment;
    that is a v2 scope expansion.
  - Inclusion in the dataset does **not** imply GLP-1 receptor agonist status or
    GLP-1-containing status.
  - Generated counts are **tracked obesity/incretin competitive program** counts,
    not GLP-1 RA-only counts.
- **Default-exclusion basis:** a program is excluded for lack of v1.1
  obesity/incretin/amylin/glucagon-axis relevance, lack of official
  obesity/weight-management development intent, or lack of confirmed development
  evidence — **not** for lack of GLP-1 biology alone.
- **Consequences:** No records are added or re-researched under this decision,
  and no GIP-only, glucagon-only, or amylin-only candidate is backfilled without
  current official-evidence review. Previously excluded candidates that are now
  potentially in v1.1 scope (for example GIP-only or glucagon-only programs with
  possible obesity intent) are **re-review candidates** for a later company
  refresh, not silent additions. Future company investigations follow the v1.1
  scope.
