---
role: historical-migration-report
status: historical
authority: non-authoritative
update-boundary: Frozen migration record; current schema rules belong in the Clinical Evidence contract.
---

# Clinical Evidence v3 migration audit

Date: 2026-07-14

## Boundary

This was a schema migration and local-source audit, not a full external Clinical
Evidence re-research. Existing Company/Pipeline source records were compared
with Clinical Evidence by registry ID, explicit program/regimen mapping,
title/acronym, and indication. External access was limited to candidates chosen
for targeted verification.

## Existing Study migration

- Migrated 33 existing result-bearing Studies to
  `clinicalEvidenceSchemaVersion: "3.0"` without changing Study IDs, registry
  IDs, Arms, Endpoints, Outcomes, or their meanings.
- Replaced legacy `status` with one reference `registryStatus`. Existing source
  `checkedAt` values were retained. `statusUpdatedAt` was not invented for
  records whose registry history was not rechecked.
- Added the explicit broad tirzepatide program mapping to SUMMIT. The local
  Company/Pipeline source identifies the same asset and the existing Clinical
  set consistently maps the other SURMOUNT Studies to that program; no
  title/indication inference is used by runtime selectors.
- Migrated the valid fixture minimally to v3 while retaining its Study and
  registry identities. Added synthetic-only program- and regimen-linked
  inventory probes and XOR/status invalid probes.

## Pipeline-to-Clinical audit

The local audit found 74 unique NCT identifiers cited by Pipeline/Regimen source
records. After this migration, 71 of those identifiers are not represented in
Clinical Evidence (73 explicit source-record mappings: 62 program and 11
regimen; two NCTs occur on more than one mapping). This is a candidate set, not
an automatic import set:

- many records are indication expansions whose Clinical scope needs a deliberate
  review;
- a registry URL on Pipeline data does not supply complete Study/Arm facts;
- a regimen source may not have an internal focal `assetId` compatible with the
  current asset-scoped source layout;
- ambiguous or stale fields require targeted registry verification.

No candidate was mapped from asset name, indication, acronym/title, comparator
relationship, or source URL alone.

## High-confidence additions

| Study | Explicit mapping | Registry status | Outcome state |
| --- | --- | --- | --- |
| ATTAIN-PAD (`NCT07223593`) | `programId: eli-lilly-and-company-ly3502970-oral-tablets-attain-pad` | Recruiting; official update 2026-07-07 | No recorded Outcome |
| ZUPREME (`NCT06662539`) | `programId: zealand-pharma-petrelintide-subcutaneous-injection` | Completed; official update 2026-03-23 | No recorded Outcome |

Both were verified directly against ClinicalTrials.gov on 2026-07-14 and added
as Study + protocol Arm inventory only. Registry outcome definitions were not
stored as Endpoints because no Outcome is recorded.

## Unresolved candidates

- ASC47 + semaglutide (`NCT06972992`) has an explicit regimen mapping and was
  targeted-verified (Completed; official update 2025-12-18), but the regimen has
  no internal component `assetId` to anchor the required asset-scoped Clinical
  source file. It remains unresolved rather than assigning an asset by guess.
- The remaining locally cited candidate registry IDs were not externally
  re-researched in this migration. They require case-by-case scope, explicit
  mapping, registry status, and Arm verification before entry.

## Resulting inventory

The canonical aggregate contains 35 Studies: 33 result-bearing Studies and two
inventory-only Studies. Outcome existence alone determines
`hasReportedOutcomes`; there is no canonical result-availability field.
