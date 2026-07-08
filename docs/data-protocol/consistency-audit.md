# Registry / Type / Validator Consistency Audit

Point-in-time verification that the frozen v1 contract surfaces agree with each
other. This is a **verification record**, not a contract change and not an ADR.
The governing decisions remain ADR-0025 (v1 freeze) and ADR-0024 (stage
semantics), unchanged.

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
- The frozen v1 stage axis is complete: `Unknown`, `Discovery`, `Preclinical`,
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
