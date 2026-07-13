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

Study grouping is not modeled. Extensions, rollovers, and platform/master-protocol
groupings are stored as **separate Study records with no stored parent/child
linkage** — an accepted current limitation — **provided each sub-study carries its
own distinct registry identity**, since a normalized `registry|id` must be globally
unique across studies. A master protocol that assigns **one registry identifier to
multiple sub-studies**, or that covers **multiple focal assets under one
identifier**, is **not representable** here: `assetId` is singular and the shared
identity would collide. That case is a deferred schema limitation (see
`docs/data-protocol/edge-cases.md` and ADR-0034); do not force it into the current
model by inventing surrogate registry ids.

**Arm / intervention** is one treatment or comparator configuration **within a
single study**. It requires an arm ID, `studyId`, role (`experimental`, `placebo`,
`active comparator`, or `other`), label, intervention, dose, route, dosing
frequency, and treatment duration. Planned and analyzed N are optional when
disclosed. Treatment and comparator arms use the same structure.

An Arm is a treatment configuration inside one study — it is **not** a cohort or a
sub-study. There is no Cohort entity: when a platform trial's "cohort" is
effectively a distinct sub-study (its own population, endpoints, or focal asset),
model it as its **own Study**, not as an Arm. Reserve Arms for the treatment and
comparator groups compared within one study.

Required background or concomitant therapy is **not a structured field**. Capture
it in free text on `arm.intervention` / `arm.label` and on `study.population`
(e.g. "…added to background metformin"). Consistent with ADR-0033, a named
protocol-required standard-of-care background therapy remains background therapy
and is not promoted to a regimen or a separate asset.

**Endpoint** is one prespecified outcome definition at one assessment timepoint. It
requires an endpoint ID, `studyId`, name, classification, and assessment
timepoint. Only endpoints with at least one actual disclosed result may be
stored.

The same measure reported at **different timepoints** requires **distinct Endpoint
records** — one per timepoint, each with its own `assessmentTimepoint`. Do not
model two timepoints as one Endpoint with two Outcomes: `assessmentTimepoint` is
excluded from the outcome semantic key (see the Latest-Result Rule), so the second
Outcome would be rejected as a duplicate semantic outcome.

**Outcome** is one reported result for a specific endpoint (which already carries
the timepoint), arm set, analysis population, estimand, result type, and comparison
type. It requires an outcome ID, `studyId`, `endpointId`, one or more `armIds`,
analysis population, source-reported result value and unit, result type
(`arm-level` or `between-arm`), maturity, and verification metadata. `estimand` and
`comparisonType` are optional fields but participate in the semantic key; the
timepoint is **not** carried on the Outcome — it lives on the referenced Endpoint.

`maturity` is a required enum with exactly these values: `interim`, `topline`,
`final`, `registry result`, `conference result`, `peer-reviewed publication`. This
one field conflates an evidence-finality axis (`interim`/`topline`/`final`) with a
source-venue axis (`registry result`/`conference result`/`peer-reviewed
publication`) and has **no regulatory value**. When finality and venue diverge,
choose the value that carries the most decision-relevant fact for the reader and
record the other in `metadata.sources` / `sourceType`; a result available only from
a regulatory document (label/approval) maps to the closest venue value with the
source recorded in metadata. Splitting this enum into finality × venue and adding a
regulatory value is deferred (see edge-cases and ADR-0034).

`analysisPopulation` is a single free-text field that encodes **both** the analysis
set (ITT / mITT / PP) **and** the population subgroup (overall vs, e.g., a
baseline-T2D subgroup). Author it in a consistent order — analysis set first, then
subgroup in parentheses, e.g. `"Modified intention-to-treat (overall)"`,
`"Per-protocol (overall)"`, `"Modified intention-to-treat (baseline type 2 diabetes
subgroup)"`. Consistent phrasing keeps genuinely distinct outcomes distinct in the
semantic key and prevents both spurious splits and accidental collisions.

For a `between-arm` outcome, `comparisonType` **must** be populated and should state
**both the effect measure and the reference direction**, e.g. `"Least-squares mean
difference, treatment minus placebo"` rather than a bare `"difference"`. The
validator enforces that a `between-arm` outcome has a non-empty `comparisonType` and
that arm-count cardinality holds (`arm-level` = one arm, `between-arm` ≥ two); it
cannot judge the direction wording, so authoring it correctly is a required
convention.

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

`assessmentTimepoint` and `maturity` are **deliberately excluded** from the semantic
outcome key. Two results that differ only by timepoint are therefore modeled as two
Endpoint records (see above), and an interim result is superseded in place by the
mature result under the same key rather than co-stored.

The semantic key treats `armIds` and `endpointId` as **already-unique** surrogates,
so duplicate prevention depends on **not authoring semantically duplicate Arm or
Endpoint records**. Before creating an Arm or Endpoint, **reuse the existing record's
id** if one already describes the same real-world configuration or measure — do not
mint a second surrogate id for it. Two Arm records (or two Endpoint records) that
are semantically identical but carry different ids would produce different outcome
semantic keys for what is really one clinical fact, silently defeating outcome
duplicate detection. The validator adds a **minimal defensive check** that rejects an
obvious semantic-duplicate Arm (same study, role, label, intervention, dose,
titration, route, dosing frequency, treatment duration, and linked asset) or
Endpoint (same study, name, classification, timepoint); this blocks the obvious case
but is **not** a complete guarantee — non-identical paraphrases still slip through,
so the reuse rule above remains the primary control.

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
- changes to Contract 1.1 or Scope v1.1.
