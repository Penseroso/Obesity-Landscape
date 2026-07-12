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
- **Company/Pipeline data contract version:** ADR-0030 (Contract 1.1; supersedes
  the ADR-0025 baseline).
- **Asset aliases, immutable `assetId`, canonical `assetName`, rename identity:**
  ADR-0030, hardened by ADR-0031 (alias-type single source, `codeName` ≠
  `assetName`, unique alias values, enforced status × operational-state matrix).
- **Product scope (v1.1 obesity/incretin landscape):** ADR-0026.
- **Research routing boundary:** ADR-0027.
- **Clinical Evidence semantic contract:** ADR-0029 (refines ADR-0028).
- **Study classification, indication scope, and row-merge sufficiency:**
  ADR-0032 (refines ADR-0030's row-splitting rule), corrected by ADR-0033
  (independent classification axes, tightened regimen test).

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

- ~~**Indication-level row granularity** — how far to split rows by
  indication.~~ Resolved for the merge/split sufficiency test by ADR-0032
  (same sponsor-defined program/trial family and directly-evidenced merged
  scope required, in addition to identical stage/status/operational state).
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

## ADR-0025 — v1 data contract baseline (superseded)

- **Date:** 2026-07-08
- **Status:** Superseded by ADR-0030 (Contract 1.1)
- **Superseded by:** ADR-0030. This entry is retained as history. Its readiness
  findings (company-local identity, mutable stage/status, stage semantics,
  combination/regimen handling, record-level provenance) carry forward into
  Contract 1.1; the "no further structural change" clause no longer holds —
  Contract 1.1 adds typed asset `aliases` and sharpened identity, row-splitting,
  source, and status rules.
- **Decision (historical):** The v1 data contract baseline was fixed. After
  Ascletis Pharma and
  Zealand Pharma stress testing, the current contract — `lib/programs/types.ts`,
  the `data/registries/` vocabularies, the `scripts/data-registry.mjs`
  validators, and the `docs/data-protocol/` rules — satisfied the v1 baseline
  criteria at the time. No blocker was
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
  introduced under this baseline. The v2 backlog is unchanged and remains
  deferred: field-level provenance, a durable adjacent-inclusion rationale
  field, an excluded/deferred candidate ledger, the program-ID suffix scheme,
  and the other open-until-pilot and edge-case items. Contract Consolidation
  (Module 2) may begin on this v1 baseline.

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
  scope amendment**, not a contract-shape change, so the ADR-0025 v1 baseline and
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

## ADR-0027 - Research routing boundary and reserved clinical intent

- **Date:** 2026-07-10
- **Status:** Accepted
- **Decision:** Company/Pipeline Research remains the only currently executable
  research workflow. Generic company research, investigation, review, refresh,
  or update requests continue to route to
  [`prompts/research-company.md`](../../prompts/research-company.md). Requests
  with explicit clinical-evidence intent are reserved for a future Clinical
  Evidence Research workflow and must not be routed to Company/Pipeline
  Research as a substitute.
- **Rationale:** The v2 Clinical Evidence domain needs its own workflow and
  contract boundary. Generic company research should remain stable and should
  not silently expand into detailed clinical-trial design, endpoint, result,
  efficacy, or safety extraction. Conversely, explicit clinical-evidence
  requests should not receive an incomplete substitute workflow that could imply
  clinical research was completed.
- **Routing rules:** Explicit clinical-evidence intent includes terms such as
  `임상`, `clinical`, `trial`, `시험`, `endpoint`, `results`, and `결과`.
  Ambiguous requests default to Company/Pipeline Research unless clinical intent
  is explicit. If a request contains both company and clinical-evidence intent,
  the Company/Pipeline Research portion may run first, but the clinical-evidence
  portion must be reported as pending implementation.
- **Consequences:** This is documentation and routing policy only. It does not
  create a Clinical Evidence prompt or workflow; does not create study, arm,
  endpoint, outcome, efficacy, or safety schemas; and does not change types,
  validators, registries, operating data, generated outputs, UI, or existing
  Company/Pipeline Research behavior. The intended future combined order is
  Company/Pipeline Research first and Clinical Evidence Research second, but that
  order is not implemented by this ADR.

## ADR-0028 - Clinical Evidence semantic contract

- **Date:** 2026-07-10
- **Status:** Accepted
- **Decision:** Clinical Evidence is a separate future domain from the
  Company/Pipeline Contract (Contract 1.1). Its minimum semantic contract is documented in
  [`docs/clinical-evidence/README.md`](../clinical-evidence/README.md). The
  domain follows Scope v1.1 by reference and stores only human interventional
  clinical studies with publicly disclosed study-specific results.
- **Rationale:** Clinical result interpretation requires entity boundaries and
  comparison safeguards that are different from pipeline-stage tracking.
  Keeping the domain separate preserves Company/Pipeline Contract semantics while allowing a
  later implementation to link evidence to existing company, asset, program, or
  regimen identities.
- **Entity boundaries:** A Study is one identifiable clinical protocol; an Arm
  is one treatment or comparator configuration; an Endpoint is one defined
  outcome and assessment timepoint; and an Outcome is one reported result tied
  to an endpoint, arm or comparison, and analysis population.
- **Eligibility and safeguards:** Planned, recruiting, completed-without-results,
  protocol-only, preclinical, non-human, observational, or out-of-scope studies
  are excluded. When disclosed, dose, treatment duration, comparator, timepoint,
  analysis population, estimand, result basis, and source-reported versus
  derived values must be preserved. Ranking and UI comparison logic are not
  defined by this ADR.
- **Consequences:** This ADR adds documentation and contract decisions only. It
  does not create Clinical Evidence types, schemas, validators, data files,
  prompts, workflows, generated outputs, or UI; does not collect actual clinical
  data; and does not alter `PipelineProgramRecord`, Contract 1.1, or Scope v1.1.

## ADR-0029 - Clinical Evidence obesity-result contract

- **Date:** 2026-07-10
- **Status:** Accepted
- **Decision:** ADR-0028 is refined by the fuller Clinical Evidence contract in
  [`docs/clinical-evidence/README.md`](../clinical-evidence/README.md).
  Clinical Evidence remains a separate future domain from the
  Company/Pipeline Contract (Contract 1.1) and initially covers only human interventional
  clinical studies relevant to obesity or weight management that have publicly
  available study-specific results.
- **Result-bearing-study requirement:** A study is eligible only when the
  enrolled population or explicit development objective includes obesity,
  overweight, chronic weight management, or weight reduction, and at least one
  study-specific result is publicly available from an acceptable source. The
  result may be final, interim, topline, conference-presented, registry-posted,
  or peer-reviewed, but result maturity must remain distinguishable.
- **Initial indication boundary:** MASH-only, T2D-only,
  CKD/CV/lipid/comorbidity-only, protocol-only, design-only, no-results,
  healthy-volunteer PK without explicit obesity or weight-management objective,
  incidental body-weight, preclinical, animal, and other non-human studies are
  excluded. A study enrolling participants with obesity or overweight plus T2D
  remains eligible when weight management is an explicit objective.
- **Entity boundaries and linkage:** A Study is one identifiable clinical
  protocol or registry study; an Arm / intervention is the administered
  treatment configuration, comparator, dose, route, and schedule; an Endpoint is
  the prespecified outcome definition and assessment timepoint; an Outcome is a
  reported result for a specific endpoint, arm or comparison, analysis
  population, and timepoint; and a Source is the artifact supporting study
  design or reported outcome. Clinical Evidence may link to existing
  `companyId`, `assetId`, `programId`, and regimen identity where applicable,
  but must not duplicate or redefine company, asset, program, regimen, stage, or
  status semantics.
- **Consequences:** This ADR adds documentation and contract decisions only. It
  does not create TypeScript types, JSON schemas, validators, registries,
  generated files, research prompts, workflows, data, or UI; does not modify
  Company/Pipeline Contract semantics; does not broaden Scope v1.1 beyond obesity and
  weight management; and does not collect or invent clinical data.

## ADR-0030 — Company/Pipeline Contract 1.1

- **Date:** 2026-07-10
- **Status:** Accepted (current)
- **Supersedes:** ADR-0025. Refines ADR-0002, ADR-0003, ADR-0004, ADR-0005,
  ADR-0016, ADR-0017, ADR-0018, ADR-0024; does not change Scope v1.1 (ADR-0026)
  or the routing/Clinical Evidence boundary (ADR-0027, ADR-0028, ADR-0029).
- **Decision:** The Company/Pipeline data contract advances from the earlier v1
  baseline to **Contract 1.1**. The contract is no longer described as "frozen";
  it is a versioned contract that is updated in place. Contract 1.1 keeps the
  stable, company-local identity model and adds the following rules across the
  authoritative documents, TypeScript types (`lib/programs/types.ts`), validators
  and generator (`scripts/data-registry.mjs`), and existing records:
  1. **`assetId` is immutable; `assetName` is the current official canonical
     name.** A rename updates `assetName` only.
  2. **Typed `aliases`** — an optional `aliases` array on
     `PipelineProgramRecord`, each entry `{ type, value }` with `type` in
     `former-name`, `development-code`, `brand-name`, `alternative-spelling`.
     Aliases carry former names, confirmed development codes, brand names, and
     alternative spellings for search and traceability, never redefining
     identity. An alias `value` may not repeat the canonical `assetName`, and the
     alias set must be identical across every program row that shares an
     `assetId` (enforced by the asset-identity consistency check).
  3. **`codeName` accepts only a single confirmed internal development code**
     (or `null`); brand/former names belong in `aliases`.
  4. **A rename does not create a new asset or program** — same `assetId` and
     program `id`; add a `former-name` alias.
  5. **Row splitting** — split program rows when an indication-specific
     `development.stage`, `development.status`, or `stageOperationalState`
     differs for the same asset, route, and dosage form.
  6. **Combination and regimen boundaries** — fixed-dose combinations and
     co-formulations are one combination asset/program with component references;
     independently administered products are regimens; neither is inferred from
     context.
  7. **External component references** are allowed whenever no internal asset
     record exists for a component.
  8. **Licensed assets** may hold a company-local program row, with company role,
     rights, territory, and effective date recorded in `relationships`.
  9. **Source-specific evidence** — trial-registry evidence for program state,
     transaction sources for relationships, and route-specific regulator evidence
     for approvals.
  10. **Primary official sources are preferred for relationships**; secondary
      coverage is a fallback only and does not override a primary source.
  11. **Valid `development.status` × `stageOperationalState` combinations** are
      defined, including `Active` with a `Completed` supporting trial (a
      completed trial is not program discontinuation).
  12. **Filed regulatory details are preserved in `regulatoryStates`** (state,
      jurisdiction, authority, date), separate from `development.stage`.
  13. **Basic company research may use NCT records** to verify a program's
      existence and stage/status; detailed trial design, arm, endpoint, and
      result modeling is owned by the separate Clinical Evidence domain.
  14. **Deferred and excluded candidates remain execution-report output only**,
      never operating/app data.
- **Rationale:** The two operating companies plus Novo Nordisk exercised real
  cases the earlier baseline could only note as gaps — most notably the
  Amycretin→Zenagamtide rename and multi-brand assets (semaglutide is marketed as
  Wegovy, Ozempic, and Rybelsus). A typed alias field resolves the former-name
  search/traceability edge case (see `edge-cases.md`) without a global entity
  graph, while the remaining rules make already-practiced conventions explicit
  and enforceable. None of this changes the current-state-snapshot model,
  company-local reference scope, or Scope v1.1.
- **Backward compatibility:** All existing records remain valid; `aliases` is
  optional. Records with real, evidence-supported aliases were migrated in place
  (Novo Nordisk semaglutide brand names, `amycretin` former name "Amycretin" on
  the canonical `assetName` "Zenagamtide", liraglutide brand name "Saxenda").
  All company, asset, and program IDs are preserved. Generation is a verbatim
  passthrough, so `aliases` flows into `data/generated/pipeline-programs.json`
  unchanged. No parallel Contract 1.1 document set was created; the existing
  documents were updated in place.
- **Consequences:** The "frozen" framing is retired across the authoritative
  documents. Contract 1.1 is now the versioned baseline that future contract
  changes advance from. The v2 backlog is unchanged: field-level provenance, a
  durable adjacent-inclusion rationale field, an excluded/deferred candidate
  ledger, the program-ID suffix scheme, cross-company entity resolution (including
  a cross-company alias registry and company former-name aliases), per-jurisdiction
  approval modeling, and the other open-until-pilot and edge-case items remain
  deferred.

## ADR-0031 — Contract 1.1 hardening

- **Date:** 2026-07-10
- **Status:** Accepted (current)
- **Refines:** ADR-0030. Does not change the Contract 1.1 shape or add fields.
- **Decision:** Harden the Contract 1.1 identity and status rules and remove a
  duplicated definition, without redesigning the contract:
  1. **Single source of truth for alias types.** The `former-name`,
     `development-code`, `brand-name`, `alternative-spelling` list lives once in
     `lib/programs/asset-alias-types.json`. `lib/programs/constants.ts` and the
     `scripts/data-registry.mjs` validator both consume it; `types.ts` declares
     the matching `AssetAliasType` union. The validator no longer hard-codes a
     second copy.
  2. **`codeName` may not equal `assetName`.** When the development code is
     itself the canonical name, `codeName` is `null`. This removes redundant
     duplication of the name.
  3. **Alias values are unique within an asset.** The same normalized value must
     not repeat across alias types.
  4. **Enforced `development.status` × `stageOperationalState` matrix.** When
     `stageOperationalState` is present it must be valid for the row's `status`
     (see `source-and-entry-policy.md`); `Not separately confirmed` is allowed
     with any status, and `Active` + `Completed` remains valid.
- **Rationale:** These are the redundancy and consistency gaps left implicit by
  ADR-0030. Enforcing them in the validator (with synthetic invalid fixtures)
  prevents drift and makes the documented rules executable, while the shared
  JSON removes the only remaining duplicated alias-type definition.
- **Backward compatibility:** All existing records remain valid after a
  no-information-loss migration: 15 rows whose `codeName` repeated `assetName`
  (Ascletis `ASC*`, Zealand `ZP6590`, Novo Nordisk `CagriSema`/`IcoSema`/
  `UBT251`) now use `codeName: null`; the code is still carried by the canonical
  `assetName`. No `assetId` or `programId` changed. Every in-use
  `status`×`stageOperationalState` pair already satisfies the enforced matrix,
  so no status data changed.
- **Consequences:** No new fields, registries, UI, or workflow changes. The v2
  backlog is unchanged.

## ADR-0032 — Study classification, indication scope, and merge sufficiency

- **Date:** 2026-07-12
- **Status:** Accepted (current)
- **Refines:** ADR-0030 (Contract 1.1) and the row-splitting rule in
  `entities-and-rows.md`. Does not change the Contract 1.1 shape, add fields,
  or change validators.
- **Decision:** Clarify Module 5 research and entry practice, without
  redesigning the contract:
  1. Classify each surfaced study before row creation as monotherapy,
     combination product, regimen, add-on/background-therapy program, or
     platform/master protocol.
  2. A study requiring concomitant or background therapy is not monotherapy
     evidence for the focal asset, whether or not the background component is
     a confirmed regimen component.
  3. `indications` holds disease or clinically defined treatment indications
     only — not background therapy, prior-treatment conditions, age cohorts,
     trial objectives, outcome/endpoint labels, or other population
     descriptors.
  4. Identical stage, status, and operational state are **necessary but not
     sufficient** to merge indications into one row.
  5. Merging additionally requires the records to belong to the same
     sponsor-defined development program or trial family, and the source
     bundle to directly support the full merged scope.
  6. Defer a program rather than force a row or merge that would lose the
     sponsor's actual scope or trial structure under the current schema.
- **Rationale:** Real research runs folded a required-background-therapy trial
  (an unspecified weekly-incretin add-on study) into a monotherapy program row,
  and merged evidence from unrelated trial families into one row on the
  strength of matching stage/status/operational state alone. Both are
  representable today without a schema change; they were process gaps in how
  Module 5 classified studies and tested merge sufficiency, not contract gaps.
- **Consequences:** No new fields, registries, validators, or `assetType`
  values. Resolves the **Indication-level row granularity** deferred decision
  above for the merge/split test (further indication-granularity questions
  remain open only where they are not covered by rules 1–6). Existing operating
  data is not retroactively modified by this ADR; any row that no longer
  satisfies rules 4–5 is a data-correction follow-up, not a contract change.

## ADR-0033 — Correct ADR-0032: independent classification axes, tightened regimen test

- **Date:** 2026-07-12
- **Status:** Accepted (current)
- **Refines:** ADR-0032. Does not rewrite it (see the append-only rule at the
  top of this log); this entry corrects a modeling regression found while
  applying ADR-0032 to real data. Does not change the Contract 1.1 shape, add
  fields, or change validators.
- **Decision:**
  1. Study classification (ADR-0032 rule 1) is **two independent axes**, not
     one flat enum: **intervention model** (monotherapy, combination product,
     regimen, or add-on/background-therapy program) and **protocol structure**
     (standalone or platform/master protocol). A platform/master protocol may
     test any intervention model in any of its nested sub-studies; classify
     each nested sub-study's intervention model on its own.
  2. **A named background product is not automatically a regimen.** Regimen
     classification requires official evidence the sponsor treats the
     co-administration as a distinct development configuration or
     investigational combination strategy (for example, an "alone or in
     combination" trial design) — not merely that the protocol names a
     specific background product. Protocol-required standard-of-care
     background therapy (for example background basal insulin or metformin)
     remains background therapy even when named.
- **Rationale:** ADR-0032's flat 5-way enum could not express that a platform
  or master protocol (a protocol-structure property) commonly tests a
  monotherapy or a regimen (an intervention-model property) within its nested
  sub-studies — conflating the two axes into one enum was itself a modeling
  error, not merely an omission. Separately, ADR-0032's regimen sentence ("if
  the background component is officially confirmed and stable, model it under
  the regimen rules") read as though naming a background product were
  sufficient to make it a regimen, which would misclassify the many trials
  where a focal asset is studied on protocol-required standard-of-care
  background therapy (for example background basal insulin/metformin in a
  diabetes trial) as a regimen rather than background therapy.
- **Consequences:** No new fields, registries, validators, or `assetType`
  values. Existing operating data is not retroactively modified by this ADR;
  applying the corrected rules to the Eli Lilly dataset is a data-correction
  follow-up, tracked separately.
