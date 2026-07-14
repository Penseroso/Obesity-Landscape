---
role: historical-audit
status: historical
authority: non-authoritative
update-boundary: Frozen point-in-time audit; do not update for current implementation changes.
---

# Registry / Type / Validator Consistency Audit

Point-in-time verification that the Contract 1.1 surfaces agree with each other.
This is a **verification record**, not a contract change and not an ADR. The
governing decisions are ADR-0030 (Contract 1.1) and ADR-0024 (stage semantics).
The Module 3 section below was recorded for the earlier baseline and remains a
valid historical readback.

## Module 3 — 2026-07-08

Audited surfaces: `data/registries/`, `lib/programs/types.ts`,
`lib/programs/constants.ts`, `scripts/data-registry.mjs`,
`data/companies/ascletis-pharma/`, `data/companies/zealand-pharma/`, and
`data/generated/`.

**Result: consistent. No mismatch, no blocker, and no registry, type, validator,
documentation, operating-data, or generated-output change was required.**

### Development-stage registry

- Every `development.stage` used in operating data (`Preclinical`,
  `IND submitted`, `IND cleared`, `Phase 1b`, `Phase 2`, `Phase 3`, `Unknown`)
  is present in `data/registries/development-stages.json`.
- The Contract 1.1 stage axis is complete: `Unknown`, `Discovery`, `Preclinical`,
  `IND-enabling`, `IND submitted`, `IND cleared`, `CTA submitted`,
  `CTA approved`, clinical phases and substages (`Phase 1`/`1a`/`1b`/`1/2`,
  `Phase 2`/`2a`/`2b`, `Phase 3`), `Filed`, and `Approved`.
- Regulatory-development milestones (`sortRank` 31–34) are ordered before
  clinical `Phase 1` (`sortRank` 40) and carry the family
  `Regulatory-development milestone`, so they are never approximated as clinical
  phases. `lib/programs/constants.ts` `clinicalDevelopmentStages` (rank ≥ 40)
  correctly excludes them, and `getMostAdvancedDevelopmentStage` ranks them
  below Phase 1.
- Labels, IDs, aliases, families, and `sortRank` values are internally
  consistent: all IDs unique, all `sortRank` values unique, no duplicate or
  ambiguous label/alias text. The `validate:registries` uniqueness and
  sort-rank checks pass.

### Annotation controlled values

- `development.stageBasis` matches across `lib/programs/types.ts`, the
  `scripts/data-registry.mjs` allowed set, `source-and-entry-policy.md`, and
  operating data: `Sponsor-declared current pipeline stage`,
  `Operational evidence`, `Official regulatory-development milestone`.
- `development.stageOperationalState` matches across the same four surfaces:
  `Initiated or active`, `Active not recruiting`, `Not yet recruiting`,
  `Planned, not yet initiated`, `Submitted, pending clearance`,
  `Cleared, not yet initiated`, `Paused`, `Completed`,
  `Not separately confirmed`.

### Development status

- `development.status` matches across `lib/programs/constants.ts`, the validator,
  and `source-and-entry-policy.md`: `Planned`, `Active`, `On hold`,
  `Discontinued`, `Unknown`. Operating data uses `Planned`, `Active`, `On hold`.
- Status is not used to encode a clinical phase, registry phase, or regulatory
  milestone; those live in `development.stage` and `regulatoryStates`.

### Regulatory state

- `regulatoryStates.state` values in use (`IND submitted`, `IND cleared`) are
  registry-backed and coherent with the stage rules; each entry preserves
  `jurisdiction`, `authority`, and `date` (Ascletis ASC35 and ASC36_35 FDC).
- `IND submitted` / `IND cleared` are intentionally defined in both
  `development-stages.json` and `regulatory-states.json`, so a milestone can be
  both the most advanced official current `development.stage` and a detailed
  `regulatoryStates.state`. `regulatoryStates` is not collapsed into
  `development.stage`, and milestones are not approximated as `Phase 1`.

### Source metadata

- Validator-required source fields (`url`, `checkedAt`) align with
  `SourceReference` in `lib/programs/types.ts`; optional fields (`title`,
  `sourceType`, `publishedAt`) align. Date validation matches the documented
  full-date and ISO 8601 partial-date rules.
- `sourceType` is intentionally free-text (not registry-controlled). Values in
  current data (`company pipeline page`, `company press release`,
  `trial registry`) are internally consistent and consistent with the
  documented examples; no controlled-value drift applies.

### Asset / combination / regimen

- `assetType` values (`fixed-dose-combination`, `co-formulation`) match the
  `AssetType` type and the validator set; component references, external company
  references, and regimen structure remain type/validator consistent.
- The reference examples pass company and generated validation without change:
  Ascletis `ASC30_39 FDC`, Ascletis `ASC36_35 FDC`, the Ascletis
  `ASC37 + ASC36` regimen, and Zealand `petrelintide / CT-388` FDC.

### Generated output

- `npm run data:generate` reproduces `data/generated/*` with no diff, confirming
  the generated files remain a deterministic aggregate of operating data. No
  generated file was edited manually.

### Validation

`data:generate`, `data:validate:companies`, `data:validate:generated`,
`data:validate:registries`, `data:validate:stress`, `data:validate:synthetic`,
`lint`, and `build` all pass; `git diff --check` is clean.

## Module — Contract 1.1 — 2026-07-10

Audited the Contract 1.1 change (ADR-0030): the `aliases` surface across
`lib/programs/types.ts`, `lib/programs/constants.ts`,
`scripts/data-registry.mjs`, migrated operating data, and generated output.

**Result: consistent.**

- **Alias types agree** across the four surfaces: `former-name`,
  `development-code`, `brand-name`, `alternative-spelling`. The list is
  single-sourced in `lib/programs/asset-alias-types.json`, consumed by
  `constants.ts` (`assetAliasTypes`) and by the validator (see the hardening
  module below); `types.ts` declares the matching `AssetAliasType` union.
- **Validator coverage:** `aliases` is validated for array shape, allowed
  `type`, non-empty `value`, no value equal to the canonical `assetName`, and
  no duplicate `type`+`value`. The alias set is folded into the asset-identity
  consistency check, so every program row sharing an `assetId` must carry the
  same aliases. A synthetic invalid fixture (`invalid-alias-type`) exercises the
  rejection path; the valid fixture exercises all four alias types.
- **Migration:** Novo Nordisk semaglutide (brand names Wegovy/Ozempic/Rybelsus),
  `amycretin` (former-name "Amycretin" on canonical `assetName` "Zenagamtide"),
  and liraglutide (brand name "Saxenda") carry evidence-based aliases; all
  `assetId`/`programId` values are unchanged.
- **Generated output:** `npm run data:generate` passes aliases through verbatim
  into `data/generated/pipeline-programs.json` (6 alias-bearing rows) with no
  further diff on re-run; validators, `lint`, and `build` all pass.

## Module — Contract 1.1 hardening — 2026-07-10

Audited the Contract 1.1 hardening patch (ADR-0031).

**Result: consistent.**

- **Single source of truth:** the alias-type list now lives only in
  `lib/programs/asset-alias-types.json`. `lib/programs/constants.ts` imports it
  (typed as `readonly AssetAliasType[]`), `lib/programs/types.ts` declares the
  matching union, and `scripts/data-registry.mjs` reads the same JSON — the
  validator no longer hard-codes a duplicate list.
- **New validator rules:** `codeName` may not equal `assetName`; alias values
  are unique within an asset (no repeat across alias types after normalization);
  and `development.stageOperationalState`, when present, must be in the allowed
  set for the row's `development.status`. All three have synthetic invalid
  fixtures (`codename-equals-assetname`, `duplicate-alias-value`,
  `invalid-status-operational-state`).
- **Backward-compatible migration:** 15 operating rows whose `codeName` merely
  repeated `assetName` (Ascletis `ASC*`, Zealand `ZP6590`, Novo Nordisk
  `CagriSema`/`IcoSema`/`UBT251`) now store `codeName: null`; no `assetId`,
  `programId`, or other value changed, and no information is lost because the
  code remains the canonical `assetName`. Every in-use
  `status`×`stageOperationalState` pair already satisfies the enforced matrix.
- **Checks:** all data validators, `data:generate` (no re-run diff), `lint`, and
  `build` pass.
