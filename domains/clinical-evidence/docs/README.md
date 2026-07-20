---
role: clinical-evidence-semantic-contract
status: active
authority: authoritative
update-boundary: Update when Clinical Evidence entities, field semantics, identity, or source-result boundaries change.
---

# Clinical Evidence Data Contract

**Schema version: 3.0** (ADR-0039; builds on ADR-0037 and ADR-0038). v3.0 is a
distinct version: every source file declares
`"clinicalEvidenceSchemaVersion": "3.0"` and an earlier file is rejected. The field is
namespaced to this domain — not a bare `schemaVersion` — because Company/Pipeline
data is separately versioned as "Contract 1.1" (ADR-0030); a generic name here could
be misread as versioning that whole registry contract instead of just Clinical
Evidence.

Authoritative semantic and file contract for the Clinical Evidence data layer.
This module defines source files, TypeScript shapes, validation semantics, and
entity behavior. It does not define research execution, routing, UI, ranking,
or comparison logic. Use the
[Clinical Evidence workflow](./workflow.md) for execution
and [`AGENTS.md`](../../../AGENTS.md) for routing.

## Evidence Scope

Clinical Evidence v3 stores **in-scope human interventional Studies regardless
of whether an Outcome has been recorded yet**.

Include a Study when both are true:

- the enrolled population or explicit development objective includes obesity,
  overweight, chronic weight management, or weight reduction.
- the Study has one explicit focal Company/Pipeline mapping (`programId` xor
  `regimenId`) and a registry identity that can be verified.

An inventory Study starts with Study + one or more protocol Arms. When results
become available, enrich the same stable Study and Arm IDs with Endpoint and
Outcome records; do not create a migration entity or duplicate Study.

Do not include non-human or observational studies; healthy-volunteer PK studies
without an explicit obesity or weight-management objective; MASH-only,
T2D-only, CKD/CV/lipid/comorbidity-only studies; studies where body weight is
incidental; or preclinical/non-human studies.

A study enrolling participants with obesity or overweight plus T2D remains
eligible when weight management is an explicit objective. MASH and other
indication expansion remain outside the initial Clinical Evidence scope until a
later scope decision.

## File Layout

Editable source data is company/asset scoped:

```text
domains/clinical-evidence/data/clinical-evidence/
└─ <company-id>/
   └─ <asset-id>/
      └─ clinical-evidence.json
```

Each asset file declares its schema version and contains five parallel arrays:

```json
{
  "clinicalEvidenceSchemaVersion": "3.0",
  "companyId": "<company-id>",
  "assetId": "<asset-id>",
  "studies": [],
  "arms": [],
  "analysisGroups": [],
  "endpoints": [],
  "outcomes": []
}
```

Generated output is a deterministic read-only aggregate, plus one derived
projection:

```text
data/generated/clinical-evidence.json               canonical aggregate
data/generated/clinical-evidence-asset-studies.json derived projection (not canonical)
```

The aggregate has the same top-level array names and the same
`clinicalEvidenceSchemaVersion`. The derived projection carries its own, separately
numbered `projectionSchemaVersion` instead — it is not part of the canonical contract
and may change shape independently (see Derived Projection below). Source files are
authoritative; generated output must not be edited by hand.

## Entity And Field Rules

**Study** is one identifiable clinical protocol or registry study. It requires a
stable study ID, `companyId`, `assetId`, exactly one of `programId` or `regimenId`,
official title, registry identifier, phase, `registryStatus`, study design, population,
optional duration/follow-up/safety summary, and verification metadata. NCT IDs
must match `NCT########`.

`registryStatus` identifies the **single reference registry** used for tracking
and UI. Its `registry` + `registryId` must match one `registryIdentifiers` entry.
`overallStatus` uses: `not-yet-recruiting`, `recruiting`,
`enrolling-by-invitation`, `active-not-recruiting`, `suspended`, `terminated`,
`withdrawn`, `completed`, or `unknown`; `sourceStatus` preserves registry text.
`statusUpdatedAt` is the registry-published record/status update date. Research
verification time remains `metadata.sources[].checkedAt`; the two dates are not
interchangeable.

Study grouping is not modeled. Extensions, rollovers, and platform/master-protocol
groupings are stored as **separate Study records with no stored parent/child
linkage** — an accepted current limitation — **provided each sub-study carries its
own distinct registry identity**, since a normalized `registry|id` must be globally
unique across studies. A master protocol that assigns **one registry identifier to
multiple sub-studies**, or that covers **multiple focal assets under one
identifier**, is **not representable** here: `assetId` is singular and the shared
identity would collide. That case is a deferred schema limitation (see
[Edge Cases](../../company-pipeline/docs/edge-cases.md) and ADR-0034); do not force it into the current
model by inventing surrogate registry ids.

**Arm / intervention** is one treatment or comparator configuration **within a
single study**. It always requires an arm ID, `studyId`, role (`experimental`,
`placebo`, `active comparator`, or `other`), label, and intervention. For an
inventory Study, dose, route, dosing frequency, and treatment duration are
optional. Once any Outcome is recorded for the Study, those four fields are
required on every Arm, preserving the v2 result-bearing strictness. Planned and
analyzed N remain optional when disclosed.

An Arm is a treatment configuration inside one study — it is **not** a cohort, a
sub-study, or a pooled/derived analysis group. There is no Cohort entity: when a
platform trial's "cohort" is effectively a distinct sub-study (its own population,
endpoints, or focal asset), model it as its **own Study**, not as an Arm. A pooled
or derived analysis unit is an **AnalysisGroup** (below), never an Arm. Reserve
Arms for the protocol-defined treatment and comparator groups compared within one
study.

`linkedAsset` must be an **internal reference** — `companyId` + `assetId`, including
**across companies** — whenever the comparator or component resolves to an asset in
the Company/Pipeline registry. Free text (`assetName` / `codeName` with
`externalCompanyName`) is reserved for genuinely external or unresolved assets. The
validator rejects a free-text `linkedAsset` whose name matches a registry asset's
canonical name, development code, or alias, and rejects an `assetId` without its
owning `companyId`. Internal linkage is what makes reciprocal asset → studies
discovery possible: SURMOUNT-5's semaglutide comparator arm links to Novo's
`novo-nordisk/semaglutide`, so the head-to-head is discoverable from the Novo side.

**AnalysisGroup** is a **study-scoped** analysis unit that is not a protocol Arm: a
source-reported pooled group, starting-dose subgroup, or other derived group. It
requires an analysis-group ID, `studyId`, `kind` (`pooled`, `derived`,
`starting-dose-subgroup`, or `other`), a label, and a non-empty `memberArmIds` set.

- membership is a set of protocol **Arms of the same study**; no duplicates, and
  groups are **flat — they never nest**.
- `kind` is source-reported and **never inferred**.
- an AnalysisGroup id must not collide with an Arm id.
- a group is not stored speculatively: **every AnalysisGroup must be referenced by at
  least one Outcome**.

An AnalysisGroup exists to preserve group membership that an Arm cannot express. It
does **not** license redistributing a pooled value across its member Arms, and it is
**study-scoped**: a pooled unit spanning multiple Studies remains unrepresentable
(see Deferred limitations).

Required background or concomitant therapy is **not a structured field**. Capture
it in free text on `arm.intervention` / `arm.label` and on `study.population`
(e.g. "…added to background metformin"). Consistent with ADR-0033, a named
protocol-required standard-of-care background therapy remains background therapy
and is not promoted to a regimen or a separate asset.

**Endpoint** is one prespecified outcome definition at one assessment timepoint. It
requires an endpoint ID, `studyId`, name, structured `role`, and assessment
timepoint. Only endpoints with at least one actual disclosed Outcome may be
stored. Therefore a Study with zero Outcomes must also have zero Endpoints and
zero AnalysisGroups.

`role` is a required enum: `primary`, `co-primary`, `key-secondary`, `secondary`,
`exploratory`, `safety`, `other`. It must be **confirmed from the study's cited
sources** (registry outcome designation, protocol, or publication) — it is **not**
derived from a free-text label. Where two or more primary outcome measures are
prespecified, each is `co-primary`. Where no cited source confirms a role, use
`other` rather than guessing.

`domain` is an optional enum (`body weight`, `body composition`, `glycemic`,
`cardiovascular`, `renal`, `hepatic`, `respiratory`, `musculoskeletal`,
`patient-reported`, `safety`, `other`) that distinguishes a weight endpoint from a
comorbidity endpoint — SUMMIT's heart-failure event endpoint is `cardiovascular`,
TRIUMPH-4's WOMAC pain endpoint is `musculoskeletal`, and both studies' weight
endpoints are `body weight`. Omit `domain` rather than guess it.

`classification` is a **legacy optional free-text descriptor**. It is superseded by
`role` + `domain`, carries no authority, and must never be used to infer a role.

The same measure reported at **different timepoints** requires **distinct Endpoint
records** — one per timepoint, each with its own `assessmentTimepoint`. Do not
model two timepoints as one Endpoint with two Outcomes: `assessmentTimepoint` is
excluded from the outcome semantic key (see the Latest-Result Rule), so the second
Outcome would be rejected as a duplicate semantic outcome.

**Outcome** is one reported result for a specific endpoint (which already carries
the timepoint), analysis unit, analysis population, estimand, result type, and
comparison type. It requires an outcome ID, `studyId`, `endpointId`, exactly one
**anchor** (below), analysis population, a structured result, maturity, and
verification metadata. `estimand` and `comparisonType` are optional fields but
participate in the semantic key; the timepoint is **not** carried on the Outcome — it
lives on the referenced Endpoint.

**Outcome anchoring is exclusive.** An Outcome anchors **either** to protocol Arms
via `armIds` (`arm-level` = exactly one arm, `between-arm` = two or more) **xor** to
one AnalysisGroup via `analysisGroupId` — never both, and never neither. An
analysis-group Outcome does not also enumerate `armIds`; it carries a single-unit
result (`resultType: arm-level`), because a comparison *between* analysis groups is
not representable by the current contract (see Deferred limitations).

The **result** separates four distinct semantics that v1 collapsed into two free
strings:

- `value` — the source-reported **display text**, preserved verbatim.
- `numericValue` — **required**: the machine-readable number, or explicit `null`
  when the source value is narrative (never omitted). Never a re-derived or
  recalculated figure.
- `unit` — the **actual unit of measurement** (`percent`, `percentage points`, `kg`,
  `points`, `ratio`, …). It is **never an effect measure**: the validator rejects
  `"hazard ratio"`, `"odds ratio"`, `"mean difference"` and similar in this field.
- `effectMeasure` — what a between-arm number *measures* (`"Hazard ratio"`,
  `"Estimated treatment difference"`). Required on a `between-arm` Outcome, forbidden
  elsewhere. Direction stays in `comparisonType`.

`maturity` is a required enum with exactly these values: `interim`, `topline`,
`final`, `registry result`, `conference result`, `peer-reviewed publication`. It
must reflect the strongest source that directly supports the **exact recorded
result**, not the strongest source available for the Study generally. Company-only
results remain `topline`. A study-level peer-reviewed publication upgrades an
Outcome to `peer-reviewed publication` only when that publication directly supports
the recorded value; it does not upgrade other Outcomes by association. Changing
maturity never authorizes filling unpublished confidence intervals, p-values, or
other statistical details.

This one field conflates an evidence-finality axis
(`interim`/`topline`/`final`) with a source-venue axis (`registry
result`/`conference result`/`peer-reviewed publication`) and has **no regulatory
value**. When finality and venue diverge, choose the value that carries the most
decision-relevant fact for the reader and record the other in `metadata.sources` /
`sourceType`; a result available only from a regulatory document (label/approval)
maps to the closest venue value with the source recorded in metadata. Splitting
this enum into finality × venue and adding a regulatory value is deferred (see
edge-cases and ADR-0034).

`analysisPopulation` describes the **actual analysis set used for that result**.
Examples include ITT, modified ITT, FAS, EAS, per-protocol, and safety populations,
but these are not a closed vocabulary: preserve another source-reported analysis-set
term when directly supported. The field may also carry a population subgroup;
author it in a consistent order — analysis set first, then subgroup in parentheses,
e.g. `"Modified intention-to-treat (overall)"`, `"Per-protocol (overall)"`,
`"Modified intention-to-treat (baseline type 2 diabetes subgroup)"`. Estimand
labels are not analysis sets. Values such as `"Treatment-regimen estimand
population"` and `"Efficacy estimand population"` must not be used as
`analysisPopulation`.

`estimand` separately preserves the source-reported estimand or intercurrent-event
strategy, including treatment-policy, treatment-regimen, modified
treatment-regimen, efficacy, hypothetical, or other directly reported terminology.
These examples are not a closed vocabulary. Do not infer an estimand that the
source does not identify.

**Canonicalization (semantic key only).** `estimand` and `analysisPopulation` are
canonicalized when the semantic key and grouping are computed — casing, hyphens and
other punctuation are folded, a trailing `estimand` / `estimand population` suffix is
dropped, and standard analysis-set abbreviations (`mITT`, `FAS`, `EAS`, `ITT`, `PP`)
resolve to their expanded form. So `"Treatment-policy estimand"`, `"Treatment policy
estimand"` and `"Treatment policy"` are **one** estimand, and `"FAS (overall)"` and
`"Full analysis set (overall)"` are **one** population — while `"Full analysis set
(Part B)"` stays distinct, because the parenthetical subgroup is canonicalized
separately. The **stored text is never rewritten**: source-reported wording is
preserved verbatim on the record, and the vocabulary stays open — an unknown
source term is canonicalized structurally and remains valid. When multiple estimands are directly reported for the
same Study, Endpoint, protocol-defined Arm set, and assessment timepoint, store each
as a separate Outcome. Outcomes separated by a source-supported `estimand` or
`analysisPopulation` are semantically distinct, not duplicates.

For a `between-arm` Outcome:

- `armIds` must reference every protocol-defined Arm in the reported comparison.
- `result.resultType` must be `between-arm`.
- `comparisonType` must state the effect measure and reference direction, e.g.
  `"Least-squares mean difference, treatment minus placebo"` rather than a bare
  `"difference"`.
- the result sign must agree with that stated direction.
- confidence intervals and p-values are included only when directly reported for
  that exact comparison.

For duplicate detection, `armIds` is a set: array order does not distinguish two
Outcomes. Comparison direction is preserved by `comparisonType` and must never be
inferred from Arm ordering alone. The validator enforces Arm cardinality,
non-repetition, non-empty `comparisonType`, and order-insensitive semantic identity;
directional wording and sign consistency remain source-backed authoring obligations
because they cannot be checked conservatively from free text.

### Source-reported result boundary

Capture only values directly reported by a source at the arm level or between arms.
Study provenance and result provenance are separate: citing a result-bearing
publication, presentation, registry record, or sponsor release in
`Study.metadata.sources` may support Study-level facts, but it neither records
the disclosed results nor proves that they were reviewed. Every stored Outcome
must cite in `Outcome.metadata.sources` a source that directly supports that
exact value and analysis context.

For every confirmed result-bearing source reviewed during research, each
distinct directly disclosed result must either be represented when the current
contract can do so faithfully or receive an explicit excluded, deferred, or
schema-boundary disposition in the final research report. These dispositions
are execution/reporting state, not canonical fields: result availability is not
persisted, and validator success cannot establish that an external source was
fully reviewed. See the workflow's result-review completion gate.

Do not:

- calculate a treatment difference from arm-level values.
- infer an unpublished confidence interval or p-value.
- transcribe a value visually from a chart.
- distribute a pooled result across individual Arms.
- map a subgroup result to broader Arms that do not faithfully represent that
  subgroup.

Adjusted effects are allowed only when the source directly reports them. A
source-reported **pooled or derived analysis group** is now representable: model it
as an AnalysisGroup over its member Arms and anchor the Outcome to that group. What
remains forbidden is unchanged — do not create artificial Arms, do not calculate or
redistribute a pooled value across its members, and do not force a misleading anchor.

When a result still cannot be represented faithfully (a structure listed under
Deferred limitations), **omit that result and report it** under the
[case-scoped fallback](./workflow.md#5-case-scoped-schema-fallback).
The omission is a deferred schema case, not an operating-data defect.

### Normative Lilly examples

- SURMOUNT-1 through SURMOUNT-4 use actual modified-ITT analysis populations and
  separate treatment-regimen and efficacy Outcomes.
- SURMOUNT-5 separates FAS from EAS, separates the estimands, stores two directional
  between-arm estimates, and links its semaglutide comparator arm to the internal
  Novo asset.
- TRIUMPH-4 stores only directly reported topline estimands, without inferred
  confidence intervals or p-values, and carries two `co-primary` endpoints in
  different domains (`body weight`, `musculoskeletal`).
- the retatrutide Phase 2 study is the worked example of the pooled-group model: its
  four protocol starting-dose Arms (4 mg from a 2 mg or 4 mg start; 8 mg from a 2 mg
  or 4 mg start) carry the arm identity, while the publication's **combined 4-mg and
  combined 8-mg groups** are `pooled` AnalysisGroups that anchor the reported combined
  results. Under v1 this result was omitted because the starting-dose groups could not
  map to pooled "Arms"; the current contract represents it without distortion.

Safety stays separate from efficacy outcomes. Store only a concise study-level
safety summary; do not attempt exhaustive adverse-event capture in this module.

## Reference Rules

Clinical Evidence reuses existing identity anchors where applicable:

- `companyId`
- `assetId`
- `programId`
- `regimenId`

The company and asset referenced by a source file must exist in the existing
Company/Pipeline source data. Exactly one focal mapping is required. A
`programId` must belong to the same company and asset; a `regimenId` must belong
to the same company. Program-specific selectors use only explicit `programId`;
they never infer a connection from asset, indication, acronym/title, comparator
links, or source URLs.

Arms, analysis groups and endpoints must belong to their referenced study. An
analysis group's member arms must belong to that same study. Outcomes must reference
a study, an endpoint from that same study, and either one or more arms **or** one
analysis group from that same study.

A `linkedAsset` is the one reference that may cross companies: an internally
resolvable comparator carries the other company's `companyId` + `assetId`. This is a
reference only — it never moves storage ownership, which stays with the single
`companyId`/`assetId` anchor of the Study and its source file.

Existing company-local identity rules remain in force. This module does not
require cross-company entity resolution and does not redefine company, asset,
program, regimen, stage, or status semantics. Study designs and outcomes must
not be stored inside `PipelineProgramRecord`.

## Latest-Result Rule

Operating data must contain only the latest authoritative result for the same
semantic outcome. A semantic outcome is the combination of `studyId`,
`endpointId`, the protocol-defined Arm set, the **analysis group**,
`analysisPopulation`, `estimand`, `resultType`, and comparison direction when
applicable (carried by `comparisonType`). The Arm set is order-insensitive;
`analysisPopulation` and `estimand` enter the key canonicalized (above).

The rule applies **only within one identical semantic result**. A source-supported
difference in **analysis group**, analysis population, or estimand makes an Outcome
semantically **distinct** — it is never collapsed or superseded by this rule.

Earlier source references may remain in metadata for traceability, but
superseded values must not remain as parallel outcomes. Derived values are not
stored in this module; adjusted effects are allowed only when directly
source-reported.

`assessmentTimepoint` and `maturity` are **deliberately excluded** from the semantic
outcome key. Two results that differ only by timepoint are therefore modeled as two
Endpoint records (see above), and an interim result is superseded in place by the
mature result under the same key rather than co-stored.

The semantic key treats `armIds`, `analysisGroupId` and `endpointId` as **already-unique** surrogates,
so duplicate prevention depends on **not authoring semantically duplicate Arm or
Endpoint records**. Before creating an Arm or Endpoint, **reuse the existing record's
id** if one already describes the same real-world configuration or measure — do not
mint a second surrogate id for it. Two Arm records (or two Endpoint records) that
are semantically identical but carry different ids would produce different outcome
semantic keys for what is really one clinical fact, silently defeating outcome
duplicate detection. The validator adds a **minimal defensive check** that rejects an
obvious semantic-duplicate Arm (same study, role, label, intervention, dose,
titration, route, dosing frequency, treatment duration, and linked asset),
AnalysisGroup (same study, kind, member-arm set, label) or Endpoint (same study,
name, role, domain, timepoint); this blocks the obvious case but is **not** a
complete guarantee — non-identical paraphrases still slip through, so the reuse rule
above remains the primary control.

## Generated outputs

Generation, ordering, the canonical aggregate, and the independently versioned
reciprocal asset-study projection are governed by the
[Generated Output Contract](../../company-pipeline/docs/generated-output-contract.md).
Neither generated file is an editable source of record.

## Deferred limitations

v3.0 is explicit about what it still cannot represent. Each is logged in
[Edge Cases](../../company-pipeline/docs/edge-cases.md), and a research run that meets one
**omits and reports** it under the workflow's case-scoped fallback rather than
distorting the data:

- **Study grouping / parent-child** — extensions, rollovers, core+OLE have no stored
  linkage.
- **Shared registry identity across master-protocol sub-studies**, or multiple focal
  assets under one registry identifier.
- **Endpoint testing order / multiplicity / gatekeeping** — `role` states the role,
  not the prespecified testing sequence.
- **`maturity` conflates finality with source venue** and has no regulatory value; the
  enum is kept as-is and this limitation is documented, not fixed.
- **Cross-study pooled analyses** — AnalysisGroup is study-scoped; there is no
  evidentiary unit above one Study.
- **Comparisons between analysis groups** (group vs group, or group vs arm) — an
  analysis-group Outcome carries a single-unit result only.
- **Structured superseded-value history** and **field-level provenance**.

## Non-Goals

This data layer does not introduce rankings, cross-company comparisons, new
clinical calculations, news, timelines, or complex charts. Result availability
is not a stored field: `hasReportedOutcomes` is derived solely from Outcome
existence, and UI copy says “No recorded outcomes” rather than claiming that no
result has been publicly disclosed. Company/Pipeline Contract 1.1 remains a
separate authority.
