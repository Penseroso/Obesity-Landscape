# Clinical Evidence Data Contract

Authoritative semantic and file contract for the Clinical Evidence data layer.
This module implements source files, TypeScript types, validation, synthetic
checks, and a deterministic generated aggregate. It does not implement research
execution, routing activation, UI, ranking, or comparison logic.

For the reusable research workflow and prompt, see
[`../clinical-evidence-workflow.md`](../clinical-evidence-workflow.md) and
[`../../prompts/research-clinical-evidence.md`](../../prompts/research-clinical-evidence.md).
The workflow remains inactive until routing is explicitly activated.

## Evidence Scope

Clinical Evidence v2 initially covers only **human interventional clinical
studies relevant to obesity or weight management that have publicly available
results**.

Include a study only when both are true:

- the enrolled population or explicit development objective includes obesity,
  overweight, chronic weight management, or weight reduction.
- at least one study-specific result is publicly available from an acceptable
  source.

A result may be final, interim, topline, conference-presented, registry-posted,
or peer-reviewed, but its maturity must be distinguishable.

Do not include registered, planned, recruiting, or completed studies with no
disclosed results; protocol-only or design-only disclosures; healthy-volunteer
PK studies without an explicit obesity or weight-management objective; MASH-only,
T2D-only, CKD/CV/lipid/comorbidity-only studies; studies where body weight is
incidental; or preclinical/non-human studies.

A study enrolling participants with obesity or overweight plus T2D remains
eligible when weight management is an explicit objective. MASH and other
indication expansion remain outside the initial Clinical Evidence scope until a
later scope decision.

## File Layout

Editable source data is company/asset scoped:

```text
data/clinical-evidence/
└─ <company-id>/
   └─ <asset-id>/
      └─ clinical-evidence.json
```

Each asset file contains parallel arrays:

```json
{
  "companyId": "<company-id>",
  "assetId": "<asset-id>",
  "studies": [],
  "arms": [],
  "endpoints": [],
  "outcomes": []
}
```

Generated output is a deterministic read-only aggregate:

```text
data/generated/clinical-evidence.json
```

It has the same top-level array names. Source files are authoritative; generated
output must not be edited by hand.

## Entity And Field Rules

**Study** is one identifiable clinical protocol or registry study. It requires a
stable study ID, `companyId`, `assetId`, optional `programId` or `regimenId`,
official title, registry identifier, phase, status, study design, population,
optional duration/follow-up/safety summary, and verification metadata. NCT IDs
must match `NCT########`.

**Arm / intervention** is one treatment or comparator configuration. It
requires an arm ID, `studyId`, role (`experimental`, `placebo`,
`active comparator`, or `other`), label, intervention, dose, route, dosing
frequency, and treatment duration. Planned and analyzed N are optional when
disclosed. Treatment and comparator arms use the same structure.

**Endpoint** is one prespecified outcome definition and assessment timepoint. It
requires an endpoint ID, `studyId`, name, classification, and assessment
timepoint. Only endpoints with at least one actual disclosed result may be
stored.

**Outcome** is one reported result for a specific endpoint, arm or comparison,
analysis population, and timepoint. It requires an outcome ID, `studyId`,
`endpointId`, one or more `armIds`, analysis population, source-reported result
value and unit, result type (`arm-level` or `between-arm`), maturity, and
verification metadata.

Safety stays separate from efficacy outcomes. Store only a concise study-level
safety summary; do not attempt exhaustive adverse-event capture in this module.

## Reference Rules

Clinical Evidence reuses existing identity anchors where applicable:

- `companyId`
- `assetId`
- `programId`
- `regimenId`

The company and asset referenced by a source file must exist in the existing
Company/Pipeline source data. A `programId`, when present, must belong to the
same company and asset. A `regimenId`, when present, must belong to the same
company.

Arms and endpoints must belong to their referenced study. Outcomes must
reference a study, an endpoint from that same study, and one or more arms from
that same study.

Existing company-local identity rules remain in force. This module does not
require cross-company entity resolution and does not redefine company, asset,
program, regimen, stage, or status semantics. Study designs and outcomes must
not be stored inside `PipelineProgramRecord`.

## Latest-Result Rule

Operating data must contain only the latest authoritative result for the same
semantic outcome. A semantic outcome is the combination of study, endpoint, arm
set, analysis population, estimand, result type, and comparison type.

Earlier source references may remain in metadata for traceability, but
superseded values must not remain as parallel outcomes. Derived values are not
stored in this module; adjusted effects are allowed only when directly
source-reported.

## Source To Aggregate Flow

```text
data/clinical-evidence/<company-id>/<asset-id>/clinical-evidence.json
-> npm run data:generate
-> data/generated/clinical-evidence.json
```

Generation validates all Clinical Evidence source files, concatenates the four
entity arrays, sorts them deterministically, and writes the aggregate. Sort order
is:

- studies: `companyId`, then `assetId`, then `id`.
- arms: `studyId`, then `id`.
- endpoints: `studyId`, then `id`.
- outcomes: `studyId`, then `endpointId`, then `id`.

## Commands

```bash
npm run data:generate
npm run data:validate:clinical-evidence
npm run data:validate:clinical-evidence:generated
npm run data:validate:clinical-evidence:synthetic
```

`data:validate:clinical-evidence` validates editable source files.
`data:validate:clinical-evidence:generated` validates the generated aggregate
and rejects output that differs from deterministic regeneration.
`data:validate:clinical-evidence:synthetic` validates focused synthetic valid
and invalid checks. The synthetic fixtures are not real clinical evidence.

## Non-Goals

This data layer does not introduce:

- real clinical evidence records.
- routing activation.
- UI, ranking, scoring, or comparison behavior.
- changes to Contract 1.0 or Scope v1.1.
