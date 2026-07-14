---
role: historical-audit
status: historical
authority: non-authoritative
update-boundary: Frozen point-in-time preflight; do not update for current implementation changes.
---

# Clinical Architecture Preflight A

Audit-only readiness review of the Clinical Evidence v2 data model, performed before
the Module 5 real pilot populates it. This report evaluates whether the current
Study / Arm / Endpoint / Outcome / Source model can represent and **distinguish** the
clinically material cases it will meet, without silently losing meaning.

- **Scope of this module:** analysis and one report. No production contract, type,
  validator, generator, fixture, prompt, or data was changed. No Semaglutide or
  Tirzepatide research was performed; no operating clinical data was added.
- **Change bar applied:** a schema change is recommended only where the current model
  cannot preserve materially distinct clinical meaning without information loss. A field
  is not proposed merely because it could be useful.
- **State at audit time:** the layer is implemented but the research route is reserved
  and inactive. `data/generated/clinical-evidence.json` is empty; the only concrete
  record instance is the synthetic validation fixture.

Authoritative inputs: `docs/clinical-evidence/README.md`;
`docs/data-protocol/decision-log.md` (ADR-0027/0028/0029 for the Clinical Evidence chain,
ADR-0032/0033 for study-classification axes); `lib/clinical-evidence/types.ts`;
`scripts/data-registry.mjs` (validators + generator); the synthetic fixture under
`data/validation-fixtures/clinical-evidence/`; `docs/clinical-evidence-workflow.md`;
`prompts/research-clinical-evidence.md`; and the boundary/vocabulary docs under
`docs/data-protocol/` (`edge-cases.md`, `source-and-entry-policy.md`,
`entities-and-rows.md`, `generated-output-contract.md`).

---

## 1. Current entity responsibility map

The layer is four parallel arrays (`studies`, `arms`, `endpoints`, `outcomes`), authored
per company/asset at
`data/clinical-evidence/<company-id>/<asset-id>/clinical-evidence.json` and concatenated
into a read-only aggregate at `data/generated/clinical-evidence.json`.

| Entity | Owns (responsibility) | Identity | Source attribution | Key fields |
| --- | --- | --- | --- | --- |
| **Study** (`ClinicalStudyRecord`) | One identifiable clinical protocol / registry study, its design, population, phase/status, durations, and a concise study-level safety summary. | Surrogate `id` (globally unique) **plus** each `registryIdentifiers[].{registry,id}` unique across all studies. | Record-level `metadata.sources` (≥1 required). | `companyId`, `assetId`, `programId?`, `regimenId?`, `officialTitle`, `registryIdentifiers[]`, `protocolIdentifiers?`, `phase`, `status`, `design{randomization,masking,comparator,description?}`, `population`, durations, `safetySummary?`. |
| **Arm** (`ClinicalArmRecord`) | One treatment or comparator configuration within a study. | Surrogate `id` (globally unique); belongs to exactly one `studyId`. | **None** — arms carry no `metadata`/sources. | `role∈{experimental,placebo,active comparator,other}`, `label`, `intervention`, `linkedAsset?`, `dose`, `titration?`, `route`, `dosingFrequency`, `treatmentDuration`, `plannedN?`, `analyzedN?`. |
| **Endpoint** (`ClinicalEndpointRecord`) | One prespecified outcome definition at one assessment timepoint. | Surrogate `id` (globally unique); belongs to one `studyId`. | **None** — endpoints carry no `metadata`/sources. | `name`, `classification` (free string), `assessmentTimepoint`. |
| **Outcome** (`ClinicalOutcomeRecord`) | One reported result for a specific endpoint, arm-set, analysis population, estimand, result type, and comparison type. | Surrogate `id` (globally unique) **plus** a semantic key (see §2). | Record-level `metadata.sources` (≥1 required). | `endpointId`, `armIds[]`, `analysisPopulation`, `estimand?`, `result{value,unit,resultType,comparisonType?,confidenceInterval?,pValue?,responderThreshold?}`, `maturity`. |

**"Source" is a concept, not an entity.** ADR-0029 names a Source as "the artifact
supporting study design or reported outcome," but it is implemented only as record-level
`RecordMetadata.sources` (`{url,title?,sourceType?,publishedAt?,checkedAt}`) on **Study**
and **Outcome**. `sourceType` is an optional free string; there is no `Source` array in
the aggregate and no field-level provenance.

**Intentionally not modeled as entities or fields:** Cohort, PooledAnalysis, Comparator
(a comparator is the `active comparator`/`placebo` arm role plus `design.comparator`
free text), BackgroundTherapy, AnalysisSet (folded into `analysisPopulation`), a
standalone Timepoint (carried on the Endpoint), a structured endpoint hierarchy
(`classification` is a free string), and any extension / substudy / rollover /
master-protocol linkage. Per ADR-0033 and `edge-cases.md` rows 39–40, protocol structure
(standalone vs platform/master) and intervention model (monotherapy / combination /
regimen / add-on-background) are **research-time classification judgments applied before
row creation, not stored fields**.

---

## 2. Derived invariants

These are the rules the code actually enforces (`scripts/data-registry.mjs`), restated as
testable invariants — not merely the prose contract.

1. **Study identity is dual.** A study is unique by surrogate `id`, and additionally no
   two studies may share a normalized `registry|id` registry identity. At least one
   registry identifier is required; NCT ids must match `NCT########`.
   (`validateClinicalEvidenceAggregate` ~L1126, L1129–1137; `validateRegistryIdentifier`
   ~L949–957.)
2. **Result-bearing completeness.** Every study must have ≥1 arm, ≥1 endpoint, and ≥1
   outcome; every endpoint must have ≥1 outcome (~L1193–1201). `result.value` and
   `result.unit` are required non-empty strings (~L1073–1074). Therefore
   **absence-of-result is modeled by omission of the record**, never by a status value.
3. **Same-study containment.** Arms and endpoints reference exactly one study; an outcome
   references a study, an endpoint of that same study, and one or more arms of that same
   study (~L1143, L1153, L1166–1177).
4. **Outcome semantic identity** = `studyId | endpointId | sorted(normalized armIds) |
   normalize(analysisPopulation) | normalize(estimand) | resultType |
   normalize(comparisonType)` (`getClinicalOutcomeSemanticKey` ~L1094–1104). **Timepoint
   and maturity are deliberately excluded** from this key.
5. **Latest-Result Rule.** Operating data may hold only one outcome per semantic key
   (~L1180–1182). Superseded values live only in `metadata`; there is no structured
   `supersedes` field. Derived values are not stored; adjusted/comparative values only
   when directly source-reported. **This protection is partial, not complete:** the
   semantic key (invariant 4) is built from `armIds`/`endpointId` as opaque surrogate
   identifiers. Nothing validates that those identifiers are themselves semantically
   unique — two Arm records (or two Endpoint records) with identical real-world meaning
   but different surrogate ids produce two different semantic keys for what should be one
   outcome, and both pass validation as "distinct" (see FM-10).
6. **Result-type cardinality.** `arm-level` requires exactly one `armId`; `between-arm`
   requires ≥2 (~L1079–1084). **The validator enforces only this arm-count cardinality —
   it does not check comparison direction.** A `between-arm` outcome's optional
   `comparisonType` may be absent or silent about which arm is the reference; nothing in
   the schema or validator requires it to state the effect measure and the reference
   direction (e.g., "least-squares mean difference, treatment minus placebo").
7. **Source attribution is record-level only.** Sources attach to Study and Outcome
   records; Arm and Endpoint carry none; no field-level provenance exists
   (`edge-cases.md` rows 31/57 log this as "assumption at risk / defer to v2").
8. **Result maturity must be distinguishable** and is a required enum on every outcome:
   `interim | topline | final | registry result | conference result | peer-reviewed
   publication` (`types.ts:72–78`; enforced ~L1089).
9. **Cross-domain boundary.** The referenced company/asset must already exist in
   Company/Pipeline source data; `programId`/`regimenId` must resolve to the same
   company (and asset, for program). The clinical layer never writes Company/Pipeline
   records; study designs and outcomes must not live in `PipelineProgramRecord`.
10. **Deterministic output.** Generation validates, concatenates, and sorts by fixed keys;
    `data:validate:clinical-evidence:generated` rejects any aggregate that differs from
    deterministic regeneration.

---

## 3. Failure modes and concrete synthetic counterexamples

Each counterexample is a small, obesity-plausible case (synthetic — not researched data)
used to probe whether distinct clinical meaning survives.

**FM-1 — Same endpoint definition, multiple timepoints (subtle, real).**
An asset reports "% change in body weight" at Week 24 and Week 72. A researcher who
creates **one** endpoint and two outcomes hits invariant 4/5: both outcomes share
`studyId|endpointId|arms|population|estimand|resultType|comparisonType`, so the validator
rejects the second as `duplicate semantic outcome` — even though the timepoints differ.
The intended modeling is **two Endpoint records** (each with its own `assessmentTimepoint`).
The design is sound; the trap is that the contract never states this explicitly and the
validator error does not hint at it.

**FM-2 — Cross-study pooled analysis (genuine loss).**
A sponsor reports a prespecified pooled efficacy result across several trials. `Outcome`
has a single required `studyId`, and outcome→endpoint/arm are same-study checked
(invariant 3). There is no construct for a result whose evidentiary unit spans studies.
Within-study pooling of arms is supported (`between-arm`, ≥2 `armIds`); cross-study
pooling is not.

**FM-3 — Extension / rollover / substudy / master-protocol linkage (genuine loss; partly a
schema limitation, not only a linkage gap).**
A core trial plus its open-label extension, or a platform/master protocol with nested
cohorts, become **separate Study records with no parent linkage**. `registryIdentifiers`
is an array (multiple registries on one study) but expresses no parent/child structure.
The grouping relationship is unrepresentable. Mitigated in practice by workflow selection
rules that exclude most extensions unless they add a distinct endpoint/population/config,
and by treating platform structure as a research-time classification (ADR-0033).

That "separate Study records" mitigation depends on an unstated precondition: it only
works when each substudy has its **own distinct registry identity**. Invariant 1 requires
a normalized `registry|id` to be globally unique across all studies. When a sponsor's
master protocol assigns **one NCT to multiple sponsor-defined substudies**, or one NCT
covers **multiple focal assets** tested under the same master protocol, no
one-substudy-per-Study-record scheme is available: giving each substudy its own Study row
under the shared NCT collides on invariant 1, and folding them into a single Study row
cannot hold more than one `assetId` (the field is singular) or distinguish the
substudy-specific design/population/arms. Unlike the general FM-3 linkage-loss case (where
distinct-NCT substudies are representable as separate, merely unlinked, rows), this
shared-NCT case cannot be represented **at all** under the current model — it is a **schema
limitation**, not a documentation or linkage gap, and is deferred to Preflight B or the
pilot rather than fixed by convention.

**FM-4 — Arm vs cohort boundary (ambiguity).**
A platform trial whose "cohorts" are effectively distinct sub-studies testing different
assets vs a conventional trial with treatment arms. With no Cohort entity, both collapse
onto `Arm`. Nothing in the contract states when a subgroup is an arm (a treatment
configuration within one study) versus its own Study.

**FM-5 — Maturity conflates finality and venue; lacks "regulatory" (ambiguity → limitation).**
The `maturity` enum mixes an evidence-finality axis (`interim`/`topline`/`final`) with a
source-venue axis (`registry result`/`conference result`/`peer-reviewed publication`), and
has no value for a regulatory-document source (FDA/EMA review or label). A **final** result
first disclosed at a **conference**, or a result available only from an approved **label**,
forces one value to stand for two independent facts. `SourceReference.sourceType` (free
text) partially overlaps venue but is unenumerated and not machine-checked.

**FM-6 — `analysisPopulation` overload (ambiguity).**
This one free string encodes both the **analysis set** (ITT / mITT / PP) and the
**population subgroup** (overall vs, e.g., baseline-T2D). Three legitimate outcomes —
"mITT overall", "PP overall", "mITT T2D subgroup" — are distinguishable only if authored
as distinct strings. Inconsistent phrasing between researchers risks either a spurious
extra outcome or an accidental semantic-key collision that the validator will report as a
duplicate.

**FM-7 — Background therapy (ambiguity).**
An add-on study of the focal asset on protocol-required standard-of-care background
(e.g., background basal insulin/metformin) has no structured background field. It is
capturable only in free text (`arm.intervention` / `arm.label` / `study.population`),
consistent with ADR-0033 (a named background is not automatically a regimen) and
`edge-cases.md` row 39.

**FM-8 — Unmet / unreported prespecified endpoint (scope exclusion).**
A trial that missed its primary and discloses only a secondary: the unreported primary is
invisible, because only endpoints with a disclosed result may be stored (invariant 2).
Competitively this can matter, but it is an intentional scope decision, not a defect.

**FM-9 — Zero vs null (minor).**
A zero/near-null effect is storable as a string `value` ("0.0", "not significant"). "Not
reported" is excluded by scope. Because `value` is a free string, numeric zero and
narrative text are not type-distinguished and effect sizes are not machine-comparable.

**FM-10 — Duplicate Arm/Endpoint semantics defeat outcome duplicate detection (validator
gap; documentation ambiguity).**
The outcome semantic key (invariant 4) trusts `armIds`/`endpointId` as already-unique. If a
researcher creates a second Arm record that duplicates an existing arm's real-world meaning
(same role/label/intervention/dose/route/frequency) under a new surrogate `id` — or
similarly a second, semantically identical Endpoint record — an outcome built against the
new arm/endpoint id will not collide with the existing outcome's semantic key, even though
both describe the same clinical fact. The Latest-Result Rule (invariant 5) and the
"duplicate semantic outcome" validator error never fire in this case, because uniqueness is
checked only at the outcome layer, not the Arm/Endpoint layer. There is no contract
language telling a researcher to reuse an existing Arm/Endpoint id rather than authoring a
new one, and no validator checks Arm-content or Endpoint-content uniqueness. This is
**partial protection**, combining a documentation ambiguity (no stated dedupe-before-create
rule) and a validator gap (no semantic-duplicate check on Arm/Endpoint) — not the complete
duplicate prevention that describing invariant 4/5 as "outcome identity & duplicate
prevention" implies.

---

## 4. Current representability assessment

Mapped against the six representability dimensions and eight invariant topics in the
request. Classification buckets: **RA** representable as-is · **DA** documentation
ambiguity · **WF** workflow gap · **VG** validator gap · **SL** schema limitation ·
**DEF** deferred until pilot.

| # | Case (dimension) | Can the model keep it distinct? | Class |
| --- | --- | --- | --- |
| Study — core / standalone | Core study, registry ids, design, population | Yes | RA |
| Study — extension / rollover | Stored as separate studies; **linkage lost** (FM-3) | Partial | SL → DEF |
| Study — substudy / master protocol | Separate studies **only when each substudy has a distinct registry identity**; platform grouping itself is research-time only (FM-3) | Partial | DA + DEF |
| Study — sponsor substudies / multiple focal assets sharing one NCT | Singular `assetId` + globally-unique registry identity cannot represent them as separate Study records (FM-3) | No | SL → DEF |
| Study — split/merge & identity | Dual identity (id + registry) prevents duplicate studies; NCT enforced | Yes | RA |
| Arm — intervention / dose arms | `dose`/`titration`/`route`/`frequency` distinguish dose arms | Yes | RA |
| Arm — comparators / background | Comparator via role + `design.comparator`; background free-text only (FM-7) | Yes (convention) | RA + DA |
| Arm vs cohort boundary | No Cohort entity; boundary undocumented (FM-4) | Convention | DA |
| Pooled analyses | Within-study yes (`between-arm`); **cross-study no** (FM-2) | Partial | SL → DEF |
| Endpoint — definition / timepoint | `name` + `assessmentTimepoint`; distinct timepoints = distinct endpoints (FM-1) | Yes | RA + DA |
| Endpoint — measurement method | Foldable into `name` + `result.responderThreshold` | Yes (convention) | RA |
| Endpoint — hierarchy | Free-string `classification` only; no structured rank/multiplicity group | Convention | DA + DEF |
| Endpoint identity | Surrogate id + required disclosed result | Yes | RA |
| Outcome — by arm / estimand / analysis set / comparison | In the semantic key | Yes | RA |
| Outcome — by population vs analysis set | Both in one `analysisPopulation` string (FM-6) | Yes (convention) | DA |
| Outcome — by timepoint | Via distinct endpoints; excluded from outcome key (FM-1) | Yes | DA |
| Outcome — by analysis context (sensitivity/interim) | Sensitivity foldable into estimand/population; interim vs final via maturity (kept-latest) | Yes (convention) | RA + DA |
| Outcome identity & duplicate prevention | Semantic-key uniqueness (Latest-Result Rule) prevents duplicates **only when the Arm/Endpoint ids feeding the key are themselves unique**; semantically duplicate Arm/Endpoint records under different ids bypass it (FM-10) | Partial | DA + VG |
| Source-to-claim attribution | Record-level on Study + Outcome; none on Arm/Endpoint; no field-level | Partial | SL (already logged) → DEF |
| Sources: registry/topline/conference/publication/regulatory | Priority is workflow prose; `sourceType` free text; no "regulatory" maturity (FM-5) | Partial | DA (+ SL candidate) |
| Source update & conflict handling | Latest supersedes; unresolved conflict → **defer + report**, not co-stored | Yes (by design) | RA |
| Result maturity — planned/unavailable/not-reported | Excluded by scope; modeled by omission (FM-8) | By design | DEF |
| Result maturity — null / zero | Zero via string; null excluded; not numeric-typed (FM-9) | Yes (lossy) | RA + DEF |
| Result maturity — mature reported | `final` / `peer-reviewed publication` | Yes | RA |

**Reading:** the majority of clinically material cases are **representable as-is or with a
stated convention**. The residue splits into cheap **documentation ambiguities** and a
small set of genuine **schema limitations** that lose meaning but are low-frequency,
out-of-scope, or already logged.

---

## 5. Minimal changes recommended before Module 5

All recommendations are **documentation-only**. No schema or validator change is required
to *begin* the pilot. These are self-contained recommendations in this report; registering
them into `docs/data-protocol/edge-cases.md` is a suggested follow-up, not done here.

1. **Timepoint rule (addresses FM-1).** In `docs/clinical-evidence/README.md`, state
   explicitly that two results for the same endpoint definition at different timepoints
   require **distinct Endpoint records**, and that `assessmentTimepoint` and `maturity` are
   intentionally excluded from the outcome semantic key. This prevents a legitimate
   two-timepoint case from being mis-modeled into a `duplicate semantic outcome` rejection.
2. **Arm-vs-cohort and study-grouping note (addresses FM-3, FM-4).** Document that an Arm
   is a treatment configuration *within one study*; that a distinct sub-study/cohort should
   be its own Study; and that extensions, rollovers, and platform/master-protocol
   groupings are represented as separate Study records with **no stored linkage** (an
   accepted current limitation) — **provided each substudy has its own distinct registry
   identity**. Also document that sponsor substudies or multiple focal assets sharing one
   registry identifier are *not* representable this way at all; that case is a schema
   limitation deferred to Preflight B or the pilot (see §6), not something a researcher can
   work around by convention.
3. **`maturity` convention (addresses FM-5).** Document how to choose a single `maturity`
   value when finality and source-venue diverge, and how a regulatory-sourced result maps
   (the enum has no "regulatory" value). Flag the finality-vs-venue conflation as a
   schema-review candidate for Preflight B (see §6), but do not change the enum now.
4. **`analysisPopulation` convention (addresses FM-6).** Document that this field encodes
   both analysis set and population subgroup, and prescribe a consistent phrasing order so
   the semantic key neither collides nor spuriously splits.
5. **Background-therapy convention (addresses FM-7).** Document that required background /
   concomitant therapy is captured in `arm.intervention`/`arm.label` and `study.population`
   free text, consistent with ADR-0033, and is not a structured field.
6. **Optional low-severity validator wording (VG).** Consider making the "duplicate
   semantic outcome" error hint that the intended fix may be to split the endpoint by
   timepoint. Cosmetic; not blocking.
7. **Between-arm comparison-direction convention (addresses the comparison-direction gap
   in invariant 6).** Document that every `between-arm` outcome should populate
   `comparisonType` with both the effect measure and the reference direction (e.g.,
   "least-squares mean difference, treatment minus placebo" rather than just
   "difference"), since the validator enforces only arm-count cardinality for `between-arm`
   results, not which arm is the comparator/reference. Documentation-only; no schema or
   validator change is proposed here.

---

## 6. Deferred to Preflight B or the real pilot

Recorded here as backlog; none blocks Module 5.

- **Cross-study pooled analyses (FM-2, SL).** Whether the obesity major-evidence-set needs
  sponsor-reported pooled results across trials. Revisit at pilot; if needed, this requires
  a real contract change (an evidentiary unit above a single study).
- **Extension / rollover / substudy / master-protocol linkage (FM-3, SL).** Whether a
  parent/child study linkage field is warranted once real platform trials are entered.
- **Sponsor substudies / multiple focal assets sharing one registry identifier (FM-3, SL).**
  When a master protocol's substudies, or multiple focal assets under it, do not each carry
  a distinct NCT (or other registry id), the current singular `assetId` plus
  globally-unique registry-identity invariant cannot represent them as separate Study
  records without a registry-identity collision. This is a schema limitation, not a
  documentation fix; revisit at Preflight B or the pilot once a real shared-NCT case is
  encountered.
- **Field-level source provenance (invariant 7, SL).** Already logged in `edge-cases.md`
  rows 31/57 as "assumption at risk / defer to v2"; carry forward.
- **Structured endpoint hierarchy / measurement-method field (DA→DEF).** Whether free-string
  `classification` needs an enumerated vocabulary or a key-secondary/multiplicity concept.
- **Splitting `maturity` into finality × venue, and a regulatory value (FM-5, SL candidate).**
  Evaluate at Preflight B against real disclosure patterns.
- **Unmet / unreported prespecified-endpoint visibility (FM-8).** A scope decision (the
  module currently stores only disclosed results).
- **Numeric typing of result values (FM-9).** Free-string `value` blocks machine comparison
  of effect sizes; revisit if the pilot needs computed comparisons.
- **Duplicate Arm/Endpoint semantic validation (FM-10, DA + VG).** No validator checks that
  two Arm records, or two Endpoint records, are not semantic duplicates under different
  surrogate ids; such duplicates silently bypass outcome duplicate detection. Recommend a
  Preflight B synthetic fixture that authors two semantically identical Arms (or Endpoints)
  with different ids feeding separate outcomes, to confirm this blind spot concretely and
  evaluate whether a semantic-dedupe check on Arm/Endpoint is warranted before the pilot.

---

## 7. Final readiness decision

**Ready with documented limitations.**

The current Study / Arm / Endpoint / Outcome model, with its dual study identity,
same-study containment, semantic-outcome key, and Latest-Result Rule, can represent and
distinguish the core obesity major-evidence-set — distinct trials, treatment/dose arms and
comparators, endpoints by definition and timepoint, and outcomes by arm-set, population,
estimand, result type, and comparison — **without material information loss**, once the
documentation clarifications in §5 are made. Those clarifications are cheap and remove the
one real trap (the timepoint/semantic-key interaction in FM-1) plus several
phrasing-convention risks.

The genuinely unrepresentable cases (cross-study pooled analyses; extension/platform/
substudy linkage — including sponsor substudies or multiple focal assets sharing one
registry identifier; field-level provenance; splitting the maturity axis) lose meaning only
in low-frequency, out-of-scope, or already-logged situations, and are deferred to
Preflight B or the real pilot in line with the project's established `edge-cases.md`
discipline. Separately, outcome duplicate detection is a partial protection rather than a
completed guarantee (FM-10): it does not validate that the Arm/Endpoint ids underlying the
semantic key are themselves free of semantic duplicates — a gap recommended for a
Preflight B synthetic fixture rather than a Module 5 blocker. **No schema, validator, or
contract change is required to begin Module 5.**
