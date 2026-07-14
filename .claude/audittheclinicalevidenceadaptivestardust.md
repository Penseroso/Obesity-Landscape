# Clinical Evidence Schema Audit (schema-first, on `main`)

## Context

The Clinical Evidence data layer (Study / Arm / Endpoint / Outcome, four parallel
arrays per `data/clinical-evidence/<company>/<asset>/clinical-evidence.json`,
concatenated into `data/generated/clinical-evidence.json`) is now populated with a
real Novo Nordisk + Eli Lilly pilot (~19 studies, ~180 outcomes) and the research
route is live (ADR-0035). A prior **Preflight A** audit
(`docs/clinical-evidence/architecture-preflight-a.md`) declared the model "ready with
documented limitations" *before* any real data existed; **Preflight B** (ADR-0034)
then closed the cheap documentation traps and added minimal validator checks. This
audit re-evaluates the schema **itself** — completeness, semantic clarity, internal
consistency — on current `main`, now that pilot data can confirm or refute the earlier
*derived* failure modes, and decides whether the entity model is complete enough to
freeze. It deliberately does **not** optimize for the downstream Clinical Detail UI or
cross-company comparison; those are treated last and only as consequences.

**This is an analysis deliverable. No schema, validator, type, generator, doc, or data
file is to be modified.** The "plan" below is the audit and its recommended
dispositions — the decision the user approves, not code to write.

---

## What was reviewed

- Contract: `docs/clinical-evidence/README.md`
- Workflow / prompt: `docs/clinical-evidence-workflow.md`, `prompts/research-clinical-evidence.md`
- Types: `lib/clinical-evidence/types.ts` (+ reused `ComponentReference`/`RecordMetadata` from `lib/programs/types.ts`)
- Validator + generator: `scripts/data-registry.mjs` (L845–1357: read, semantic keys, `validateClinicalEvidenceAggregate`, generate)
- ADRs: 0028, 0029, 0032, 0033, 0034, 0035, 0036; edge-cases rows 38–46; Preflight A FM-1…FM-10
- Pilot data: all Novo (6 assets) + Lilly (5 assets) `clinical-evidence.json`, read in full for tirzepatide/retatrutide and field-scanned across the rest

---

# REVISION 1 — User-decided dispositions (authoritative)

This revision supersedes the freeze decision (§5), disposition rollup (§4), and
strategy recommendation (§6) below, per ten user decisions. **The evidence base and
gap inventory (§1–§3, §7) are preserved unchanged except where a classification is
explicitly restated here.** The chosen path is a **selective comprehensive** patch:
resolve the demonstrated and clearly-derived *semantic* gaps in one coordinated patch,
then freeze v2.0; defer the speculative structural backlog.

## R1. Revised freeze statement

**Freeze the Study–Arm–Endpoint–Outcome model as v2.0 only after one coordinated
"selective comprehensive" patch lands** (not the minimal-only patch of the original §5,
and not the exhaustive patch of the original Strategy 1). The patch resolves five
demonstrated/clearly-derived semantic gaps — within-study analysis-group representation
(G10), internal linked-asset resolution with derived reciprocal discovery (G5), a
structured Outcome result (display / numeric / unit / effect measure, G19), a structured
Endpoint role + domain (G14a, G17), and field-specific estimand/analysisPopulation
canonicalization (G12/G26). The single canonical storage anchor per Study is **retained
by design** (it denotes storage ownership, not scientific primacy). Study grouping,
maturity-axis split, shared-registry multi-anchor, cross-study pooling, and endpoint
testing-order remain **explicitly deferred** with documented boundaries. Freeze is
declared once this patch is migrated, regenerated, and validated.

## R2. Revised disposition table (affected gaps only)

| # | Gap (short) | Prior disp | **Revised disposition** | Class |
|---|-------------|-----------|-------------------------|-------|
| G5 | Singular Study anchoring vs internal comparator/focal linkage | DEFER→BREAK | **KEEP** singular canonical storage anchor (ownership, not primacy); **reciprocal discovery = DERIVED PROJECTION** computed from canonical internal asset links (`study.companyId/assetId` + `arm.linkedAsset.companyId/assetId`) — **not** part of the canonical v2.0 schema, not a source field (see R2b). Internal-link requirement handled in G8/decision 3. | Derived projection (outside canonical schema) |
| G8 | `linkedAsset` loose; free-text where internal id exists | VALIDATOR/CLARIFY | **VALIDATOR:** require `companyId + assetId` whenever the comparator/component resolves to an internal registry asset; free-text (`assetName`/`externalCompanyName`) allowed only for genuinely external or unresolved assets. | Part of atomic v2.0 migration (R4) |
| G10 | Pooled/derived analysis groups unrepresentable | DEFER→BREAK | **SUPPORT (v2.0):** study-scoped `AnalysisGroup` (distinct from protocol `Arm`); Outcome may anchor to an analysis group; different analysis groups/estimands stay separate Outcomes; extend the outcome semantic key + latest-result rule so distinct analysis units never collapse. Invariants in **R2a**. Re-include the previously omitted retatrutide pooled result. | Part of atomic v2.0 migration (R4) |
| G12 / G26 | Estimand/population free-text drift feeding a punctuation-sensitive key | VALIDATOR (punctuation-insensitive) | **RECLASSIFIED:** *demonstrated vocabulary drift* + *latent semantic-key / canonical-grouping risk* — **not** a current cross-study duplicate defect (the two "treatment policy" variants sit in different companies, so no collision has occurred). **Keep vocabulary open.** Add **field-specific** casing/hyphen/alias canonicalization applied to the key + grouping only; preserve source-reported text; unknown directly-reported terms still allowed. **Do not** globally strip punctuation in `normalize()`. | Non-breaking normalizer |
| G14a | Endpoint role / structure | CLARIFY+ADD/DEFER | **ADD (now):** structured endpoint `role` ∈ {primary, co-primary, key-secondary, secondary, exploratory, safety, other}; assess **`domain`** as a separate field (recommended — also addresses G17). Demote free-text `classification` to optional legacy descriptor. Separates *vocabulary drift* (fixed by `role`) from *hierarchy/testing-order* (G14b, deferred). | Part of atomic v2.0 migration (R4) |
| G14b | Endpoint testing-order / multiplicity / gatekeeping sequence | (within G14) | **DEFER:** ordered secondary-testing / gatekeeping structure is out of this patch. | Deferred |
| G17 | Weight vs comorbidity endpoint indistinguishable | CLARIFY/ADD later | **ADD (now, via G14a `domain`):** endpoint `domain` lets a weight endpoint be distinguished from comorbidity endpoints (SUMMIT HF event, TRIUMPH-4 WOMAC). | Part of atomic v2.0 migration (R4) |
| G19 | `result.value`/`unit` free strings; "hazard ratio" as a unit | ADD/DEFER | **ADD (now):** separate four semantics — source **display text**, machine-readable **numericValue** (nullable for narrative values), actual **unit**, and **effectMeasure**. `unit` no longer carries an effect measure; `comparisonType` keeps direction. Migrate existing records (notably the SUMMIT hazard-ratio record). | Part of atomic v2.0 migration (R4) |
| G2 | Study grouping / parent-child | ADD/DEFER | **DEFER** (decision 7), unchanged. | Deferred |
| G18 | Maturity conflates finality × venue, no regulatory | DEFER→BREAK | **KEEP** the current enum; **document** the limitation; **do not** split now (decision 8). | Deferred (documented) |
| G23 | Cross-study pooled evidentiary unit | DEFER→BREAK | **DEFER:** the new `AnalysisGroup` is study-scoped; a pooled unit spanning studies stays out of scope. Boundary made explicit against G10. | Deferred |

Gaps **not** restated here keep their original §4 disposition (KEEP: G7, G13, G16, G20, G22, G28, G29; CLARIFY docs: G3, G4, G6; DEFER: G1, G21, G24). Decision 10 (no speculative completeness) leaves these as-is.

## R2a. AnalysisGroup–Outcome reference & membership invariants

`AnalysisGroup` is a first-class, **study-scoped** entity, deliberately kept distinct from
protocol `Arm`. The following invariants are normative for v2.0 and validator-enforced:

- **Identity.** Surrogate `id` globally unique (same rule as Arm/Endpoint). A defensive
  content key (`studyId` + `kind` + sorted `memberArmIds` + normalized `label`) blocks
  obvious duplicate group records, mirroring the existing Arm/Endpoint dedup check.
- **Study containment.** `analysisGroup.studyId` must reference an existing Study; every
  member arm must belong to that **same** study.
- **Membership.** `memberArmIds[]` is a **non-empty set of protocol `Arm` ids** of the same
  study — no duplicates (set semantics), no self/other-group members (**flat, no nesting**),
  and each id must resolve to a real Arm. `kind` is source-reported (e.g. `pooled`,
  `derived`, `starting-dose-subgroup`, `other`) and never inferred.
- **Outcome anchoring is exclusive.** An Outcome anchors **either** via `armIds`
  (protocol-arm mode, existing cardinality: `arm-level`=1, `between-arm`≥2) **xor** via
  `analysisGroupId` (analysis-group mode). The two modes are mutually exclusive on one
  Outcome; an analysis-group Outcome does not also enumerate `armIds`.
- **Referential integrity.** An Outcome's `analysisGroupId` must reference a group of the
  **same `studyId`**; same-study containment extends to this reference.
- **No orphans.** Every `AnalysisGroup` is referenced by ≥1 Outcome (parallel to the
  endpoint-has-outcome completeness invariant); groups are not stored speculatively.
- **Semantic-key distinctness.** The outcome semantic key gains an analysis-group
  dimension. For arm-anchored outcomes it defaults empty (existing keys unchanged in
  value). Two outcomes differing only by analysis group — or by estimand/analysisPopulation
  — are **distinct** and must never be collapsed by the Latest-Result / source-maturity
  rule, which applies **only** within one identical semantic result (decision 1).

## R2b. Reciprocal discovery is a derived projection, not canonical schema

Reverse "asset → studies" discoverability (decision 2) is **explicitly separated from the
canonical v2.0 schema**:

- It is a **derived projection** computed from canonical internal links only —
  `study.{companyId,assetId}` plus each `arm.linkedAsset.{companyId,assetId}` that resolves
  internally (G8 guarantees internal comparators/components carry ids).
- It carries **no independent identity**, is **never authored or hand-edited**, and does
  **not** participate in validation identity, referential integrity, or the semantic key.
- It may be **materialized as a generated/derived artifact or computed on read**; either
  way it is a projection layer over the canonical data, regenerated deterministically, and
  is not part of what freezes as the v2.0 canonical contract.

## R3. Final selected patch boundary

**In scope (this coordinated patch, then freeze):**
1. Field-specific estimand/analysisPopulation canonicalization (G12/G26) — keep open text.
2. Internal linked-asset resolution: require `companyId+assetId` for internally-resolvable assets (G8/decision 3).
3. Structured Outcome result: display text / numericValue / unit / effectMeasure (G19).
4. Structured Endpoint: `role` enum (required) + optional `domain`; `classification` → optional (G14a, G17).
5. Study-scoped `AnalysisGroup` entity + optional Outcome anchoring + semantic-key/latest-result extension (G10).
6. Reciprocal asset→studies discovery as a **derived projection** over canonical internal links (G5, decision 2) — outside the canonical schema, no source field (R2b).

**Out of scope (deferred, see R7):** G1, G2, G14b, G18-split, G20, G21, G23, G24-completeness.

## R4. Migration classification — atomic versioned migration (not "additive")

**Do not classify the patch as "additive."** Although several individual deltas are
type-level supersets, the coordinated set — new **required** endpoint `role`, the Outcome
**result restructure**, the **semantic-key redefinition**, and the new tightening
**linked-asset constraint** — has **no backward-compatible intermediate state**: between
the schema/validator/generator change and the data migration, the repository is invalid.
The release is therefore classified as a single **atomic, versioned migration** from
schema **v1 → v2.0**:

- **Atomic** — all schema/type/validator/generator changes and all record migrations land
  as one indivisible unit, gated by a full `data:generate` + `data:validate:*` pass. There
  is no partially-migrated valid state; the migration either completes wholly or is not
  merged.
- **Versioned** — a single explicit `v1 → v2.0` schema-version bump identifies the
  migration; v2.0 is a distinct version, not a silent superset of v1.

| Change | Schema-shape delta | Requires record migration? |
|--------|-------------------|----------------------------|
| Estimand/population canonicalization (G12/G26) | Key/grouping computation only | No (source text preserved) |
| Internal linked-asset id requirement (G8) | Tightening constraint (fields already exist) | Yes — SURMOUNT-5 semaglutide arm → Novo `companyId+assetId` |
| Outcome result restructure (G19) | New `numericValue?`, `effectMeasure?`; `value` reframed as display text; `unit` semantics tightened | Yes — move effect measures out of `unit`, populate numeric |
| Endpoint `role`+`domain` (G14a/G17) | New **required** `role`; optional `domain`; `classification` → optional | Yes — source-confirmed `role`/`domain` on all endpoints (see R5) |
| `AnalysisGroup` + outcome anchoring (G10) | New study-scoped entity/array + outcome anchoring mode; semantic key gains an analysis-group dimension | Yes — author group records incl. re-included retatrutide pooled result |
| Reciprocal reverse index (G5) | **None** — outside the canonical schema (derived projection, see R2/R5) | No |

Existing arm-based outcome keys are held **value-stable** across the bump (the new
analysis-group key dimension defaults empty for arm-anchored outcomes), so v2.0 introduces
no silent key collisions — but this stability is a *property preserved by the migration*,
not evidence that the release is additive. It is one atomic v2.0 migration, then frozen.

## R5. Migration & compatibility implications

- **Records to migrate (known):** (a) SURMOUNT-5 external semaglutide arm → internal `companyId+assetId`; (b) every Outcome result → split display/numeric/unit/effectMeasure (SUMMIT `unit:"hazard ratio"` is the clearest fix; `sm5-*-between` "percentage points" is a true unit with effectMeasure = difference); (c) every Endpoint → assign `role` + optional `domain` by **source-confirmed mapping** (see below); (d) add `AnalysisGroup` records for the retatrutide pooled case and any other source-reported pooled/derived group, per R2a invariants.
- **Endpoint `role`/`domain` is source-confirmed, not string-mapped.** Do **not** mechanically derive `role` from the legacy `classification` string (e.g. blindly `"Primary efficacy"→primary`). Each endpoint's prespecified role and domain must be **confirmed against that study's already-recorded sources** (registry/protocol/publication in `metadata.sources`): e.g. TRIUMPH-4's two "Primary efficacy" endpoints become `co-primary` **only if** the source designates co-primaries; `"Key efficacy"` is confirmed as `key-secondary` (or `primary`) from the source, not assumed. The legacy string is a hint, not the mapping authority. Where a source does not confirm a role, use `other` (and omit `domain`) rather than guess. This is bounded to role/domain confirmation over sources already cited — **not** new clinical research.
- **Aggregate shape:** gains a fifth canonical array (`analysisGroups`); the reciprocal reverse index is a **separate derived projection** (R2b), not part of the canonical aggregate identity. Consumers reading the original four arrays and original result fields keep working. Determinism preserved (new arrays get fixed sort keys).
- **Semantic key:** extended with analysis-group identity + field-specific canonicalization; existing arm-based keys are unchanged in value, so the Latest-Result Rule cannot silently merge previously-distinct outcomes.
- **Validators/fixtures:** new synthetic probes for analysis-group distinctness, internal-vs-external linked-asset enforcement, endpoint role/domain, and result numeric/effect-measure separation; all pinned error-substring / fail-fast conventions retained.
- **Open vocabulary preserved:** no closed list for estimand/analysisPopulation; canonicalization is alias-table-driven and extensible, so unknown source terms still validate.

## R6. Concise implementation order

1. **Estimand/analysisPopulation canonicalization** (G12/G26) — code-only, no data change; lowest risk, unblocks reliable keys first.
2. **Internal linked-asset id requirement** (G8/decision 3) + migrate SURMOUNT-5.
3. **Outcome result restructure** (G19) — add `numericValue`/`effectMeasure`, constrain `unit`, migrate values.
4. **Endpoint `role`+`domain`** (G14a/G17) — add fields, demote `classification`, migrate endpoints.
5. **`AnalysisGroup` entity + outcome anchoring + key/latest-result extension** (G10) — re-include retatrutide pooled result.
6. **Derived reciprocal discovery** (G5/decision 2) — generation-time reverse index.
7. **Regenerate + validate**, update contract/workflow/ADRs, then **declare v2.0 freeze**.

## R7. Explicitly deferred backlog

- **G1** — shared registry id across master-protocol sub-studies / multiple focal assets under one NCT (would require multi-anchor storage, which decision 2 rejects). Deferred.
- **G2** — Study grouping / parent-child (extension, rollover, core+OLE). Deferred (decision 7).
- **G14b** — endpoint testing-order / multiplicity / gatekeeping sequence. Deferred (only `role`/`domain` now).
- **G18-split** — split `maturity` into finality × venue + a regulatory value. Deferred and documented (decision 8); enum kept.
- **G23** — cross-study pooled evidentiary unit (`AnalysisGroup` stays study-scoped). Deferred.
- **G20** — structured `supersedes` history. **G21** — field-level provenance. **G24-completeness** — paraphrase-level Arm/Endpoint dedup beyond the existing defensive check. Deferred.
- **G7** — regimen-anchored study path remains unexercised; keep, revisit at a real regimen case.

Each deferred item stays logged in `docs/data-protocol/edge-cases.md` (rows 41–46) so the
freeze is explicit about its boundaries rather than silently lossy.

## R8. Case-scoped deferred-schema fallback policy

This policy formalizes and extends the existing omit-and-report discipline
(`docs/clinical-evidence-workflow.md` §5.1) from an ad-hoc note into a **case-scoped,
status-tracked fallback** with a mandatory end-of-run report. It governs *research-run
behavior*, not the canonical schema shape, so it applies both **before** and **after** the
v2.0 migration — anything v2.0 still cannot represent (R7 backlog) falls through to it.

**Core principle.** When research meets a result or study structure the *current* schema
cannot represent faithfully, **never terminate the whole company/asset run**. Isolate the
affected unit and keep going.

**Per-case procedure:**
1. **Isolate** only the affected `Study`, `Endpoint`, `Outcome`, or source-reported
   result — the smallest failing unit, not its parent scope.
2. **Classify** it as a `deferred schema case`.
3. **Do not distort** — no approximation, redistribution across Arms, pooled-value
   splitting, forced anchoring, or surrogate ids to shoehorn it into canonical JSON.
4. **Continue** researching and entering every other representable case for that asset and
   company.
5. **Record** it in the mandatory end-of-run **Schema boundary report**.

**Each deferred-case entry must contain:**
- deferred-case **type**;
- affected **company, asset, Study, registry identifier, Endpoint, and result** where
  applicable;
- **source evidence** demonstrating the unsupported structure;
- the **exact reason** the current schema cannot represent it;
- the **information that would be lost or distorted** if forced;
- **whether any partial canonical record was entered** (and what);
- the relevant **ADR / edge-case reference** (e.g. ADR-0036; edge-cases rows 41–46);
- a **recommended schema-reentry trigger** (which R7 backlog item / extension would unblock
  it).

**Statuses:**
- **`DEFERRED_SCHEMA_CASE`** — only the affected case is omitted; the rest of the run
  proceeds. (The normal path.)
- **`REVIEW_REQUIRED`** — the case *can* be entered as a canonical record, but a documented
  semantic limitation remains (e.g. an approximation the source itself makes, or a residual
  ambiguity). The record is entered **and** flagged.
- **`RESEARCH_BLOCKED`** — reserved and **exceptional**: use only when the unsupported
  structure prevents reliable classification of the broader Study or would contaminate
  multiple dependent records. Blocks that Study's entry, not the whole company/asset run.

**End-of-run summary (mandatory in the research report):**
- number of **representable cases entered**;
- number of **deferred schema cases** (`DEFERRED_SCHEMA_CASE`);
- number of **review-required cases** (`REVIEW_REQUIRED`);
- whether any **research-blocked** condition occurred (`RESEARCH_BLOCKED`), with detail.

**Targeted replay after a schema extension.** Once a schema extension is approved and
implemented (an atomic v2.0-style migration, R4), **replay only the deferred cases the
extension actually unblocks** — matched via their `recommended schema-reentry trigger`. Do
**not** re-run full company/asset discovery unless source freshness or dependency changes
independently warrant a broader refresh.

**Deterministic re-entry requirement.** Each deferred-case entry must retain **enough
source evidence and proposed-record context** (the intended Study/Arm/Endpoint/Outcome
shape, cited sources, and extracted values) to allow **deterministic targeted re-entry**
without repeating discovery research. The Schema boundary report is the durable hand-off
that makes post-extension replay a mechanical, non-exploratory step.

**Relationship to prior sections.** `DEFERRED_SCHEMA_CASE` is the runtime counterpart of
R7's deferred backlog: R7 says *which* structures v2.0 won't represent; R8 says *what a
run does* when it hits one. The retatrutide pooled result — omitted pre-v2.0, re-included
by the G10 migration (R2a) — is the canonical worked example of the full
defer → extend → targeted-replay loop.

---

## 1. What the schema represents clearly (strengths — keep)

- **Dual Study identity** (surrogate `id` + globally-unique normalized `registry|id`), NCT format enforced, ≥1 registry required. Prevents duplicate studies. Multiple registries per study works (**demonstrated**: `ubt251` carries NCT07177469 + ChiCTR2500113817).
- **Dose/route/schedule arms** cleanly distinguished (`dose`/`titration`/`route`/`dosingFrequency`/`treatmentDuration`); SURMOUNT-1 5/10/15 mg arms are unambiguous.
- **Same-measure-at-different-timepoints → distinct Endpoint records** (FM-1) — the one real trap Preflight A found — is now correctly modeled throughout the pilot (per-timepoint endpoints).
- **Outcome multiplicity by estimand + analysis population** is the schema's best feature and is heavily exercised: SURMOUNT-1 stores 8 outcomes = 4 arms × {treatment-regimen, efficacy}; SURMOUNT-5 separates FAS/EAS and stores directional between-arm estimates. The semantic key (`studyId|endpointId|sorted(armIds)|analysisPopulation|estimand|resultType|comparisonType`) faithfully keeps these distinct without duplication.
- **Same-study containment** (arm/endpoint/outcome must belong to one study), **result-bearing completeness** (every study ≥1 arm/endpoint/outcome; every endpoint ≥1 outcome; absence modeled by omission), and **deterministic sorted aggregation** are all enforced and hold across the pilot.
- **Between-arm cardinality + non-empty directional `comparisonType`** enforced; directional wording present in pilot ("Estimated treatment difference, tirzepatide minus semaglutide"; "Hazard ratio, tirzepatide versus placebo").
- **Omit-and-report discipline** for unrepresentable results (workflow §5.1) is a genuine integrity safeguard, not a workaround — **demonstrated**: retatrutide Phase-2 hybrid-estimand pooled result is intentionally absent.

---

## 2. Gap inventory

Legend — **Ev**: `D` demonstrated by pilot · `I` derived from invariant (not yet observed).
**Sev**: Critical / High / Medium / Low. **Disp**: `KEEP` · `CLARIFY` (contract/validator wording, non-breaking) · `VALIDATOR` (non-breaking check hardening) · `ADD` (backward-compatible additive field/entity) · `BREAK` (versioned breaking revision) · `DEFER` (explicit backlog, revisit at real case).

### A. Study / registry & protocol identity / grouping

| # | Gap | Ev | Sev | Disp |
|---|-----|----|-----|------|
| G1 | **Shared registry id across master-protocol sub-studies, or multiple focal assets under one NCT, is unrepresentable.** Globally-unique `registry|id` + singular `assetId` collide; no sub-study can carry the shared identity. | I (no platform trial in pilot) | High (structural) / Low (frequency) | DEFER → BREAK |
| G2 | **No Study grouping / parent-child.** Extensions, rollovers, core+OLE, withdrawal-maintenance become standalone Studies with no linkage. Partly visible: SURMOUNT-4 / -MAINTAIN are withdrawal designs after a lead-in, stored with no link to the core trial. | D (linkage absent) / I (loss) | Medium | ADD (optional `parentStudyId`/`studyGroupId`) or DEFER |
| G3 | **`phase`/`status` are free strings**, not registry-backed enums (unlike Company/Pipeline `development.stage`). Pilot mixes "Phase 3"/"Phase 3b"; nothing constrains spelling. | D | Low | CLARIFY / VALIDATOR (optional) |
| G4 | **Arm/Endpoint ids are globally unique but authored as short, non-namespaced tokens** ("sm1-tirz5"). Cross-asset collision is a latent risk as more files are added; only Study ids are fully qualified. | I | Low | CLARIFY (id-namespacing convention) |

### B. Company / asset / program / regimen anchoring & linked assets

| # | Gap | Ev | Sev | Disp |
|---|-----|----|-----|------|
| G5 | **Singular Study `companyId`/`assetId` cannot express multi-focal / head-to-head / external-asset evidentiary identity.** Head-to-head lives only under one owner; the comparator is an Arm-level `linkedAsset` with no reciprocal identity. **Demonstrated**: SURMOUNT-5 tirzepatide-vs-semaglutide is stored only under Lilly/tirzepatide; the semaglutide arm is `{assetName:"Semaglutide", externalCompanyName:"Novo Nordisk A/S"}` — not linked to Novo's real `assetId`, and invisible from Novo's file. | D | High | DEFER → BREAK (anchoring cardinality); partial ADD (allow internal `companyId+assetId` on comparator `linkedAsset`) |
| G6 | **`programId` is indication-scoped, so studies of one asset scatter across programs, and it is often absent.** **Demonstrated**: retatrutide Phase-2 obesity → `…-subcutaneous-injection`; TRIUMPH-4 (obesity+OA) → `…-subcutaneous-injection-oa`; SUMMIT has **no** `programId`. "Program" is therefore not a stable evidence-grouping key. | D | Medium | CLARIFY (document semantics) |
| G7 | **`regimenId` anchoring path is entirely unexercised** — no regimen-anchored study in the pilot; the branch is validated only synthetically. | I | Low | KEEP / CLARIFY |
| G8 | **`linkedAsset` (reused `ComponentReference`) is structurally very loose** — every field optional; validator checks existence only when *both* `assetId` and `companyId` are present. A near-empty or free-text-only linked asset passes. | I | Low | VALIDATOR / CLARIFY |

### C. Arm vs analysis group; population & estimand semantics

| # | Gap | Ev | Sev | Disp |
|---|-----|----|-----|------|
| G9 | **No Cohort entity; Arm-vs-cohort boundary is convention only.** A platform "cohort" that is really a sub-study must become its own Study (needs distinct registry id → collides with G1). | I | Medium | CLARIFY (done) + DEFER |
| G10 | **Outcome can reference only protocol-defined Arms; pooled / starting-dose-subgroup / derived analysis groups are unrepresentable.** No way to preserve group membership or subgroup qualifier. **Demonstrated by omission**: retatrutide Phase-2 hybrid-estimand result dropped; titration/starting-dose groups collapse into target-dose arms. | D | Medium–High | DEFER → BREAK/ADD (analysis-group representation) |
| G11 | **`analysisPopulation` overloads analysis-set + subgroup in one free string.** Convention ("set (subgroup)") holds in the pilot ("Modified intention-to-treat (overall)", "Full analysis set (Part B)") but is fragile across authors. | D (convention) / I (drift) | Medium | CLARIFY (done) + DEFER (optional structured subgroup) |
| G12 | **`estimand` is free text and feeds the semantic key through a punctuation-sensitive `normalize()` (trim+lowercase+collapse-spaces; hyphens kept).** **Demonstrated drift**: both `"Treatment policy estimand"` and `"Treatment-policy estimand"` exist in the pilot (Novo vs Lilly). Same real-world estimand → two different normalized keys. Across companies this silently fragments grouping; within one study it can produce false-distinct outcomes (silent duplicate) or false collisions. | D | Medium | VALIDATOR (normalize punctuation) + CLARIFY (controlled vocab / alias) |
| G13 | **Required background / concomitant therapy has no structured field** (free text on `arm.intervention`/`arm.label`/`study.population`). By design (ADR-0033). | D | Low | KEEP |

### D. Endpoint modeling

| # | Gap | Ev | Sev | Disp |
|---|-----|----|-----|------|
| G14 | **`classification` is a free string with no hierarchy, multiplicity, or measurement-method vocabulary.** Cannot express co-primary vs key-secondary vs sequential-testing order. **Demonstrated**: TRIUMPH-4 stores TWO co-primary endpoints both labeled "Primary efficacy" (weight + WOMAC), indistinguishable from a single-primary design; pilot classification strings drift ("Key efficacy", "Pharmacodynamic efficacy", "Exploratory pharmacodynamic"). | D | Medium | CLARIFY + ADD (optional enum/vocabulary) / DEFER |
| G15 | Same-measure-different-timepoint = distinct Endpoints (FM-1). Now documented and correctly used. | D | — | KEEP (resolved) |
| G16 | **Endpoint carries no `metadata`/sources.** Definition provenance is implicit in the Study/Outcome sources. | I | Low | KEEP |
| G17 | **Schema cannot flag whether an endpoint is the obesity/weight-relevant one vs a comorbidity endpoint.** **Demonstrated**: SUMMIT (HFpEF+obesity) stores only an HF-event endpoint and no weight endpoint; TRIUMPH-4 stores a WOMAC pain endpoint. A weight-vs-weight comparison cannot be isolated from stored data alone. | D | Low–Medium | CLARIFY (scope) / ADD later |

### E. Outcome: result type, comparison, maturity, result value, provenance

| # | Gap | Ev | Sev | Disp |
|---|-----|----|-----|------|
| G18 | **`maturity` conflates an evidence-finality axis (interim/topline/final) with a source-venue axis (registry/conference/peer-reviewed) and has no regulatory value.** **Derived, NOT demonstrated**: pilot uses only `topline` and `peer-reviewed publication`; the other four values are unused and no finality/venue divergence case was entered. | I | Medium (structural) / Low (observed) | DEFER → BREAK (split axes + regulatory) |
| G19 | **`result.value` and `result.unit` are free strings — no numeric typing; effect sizes are not machine-comparable.** **Demonstrated**: units are heterogeneous free text ("percent", "percentage points", "kg", "points", "BMI standard-deviation score", **"hazard ratio"** used as a unit). Zero/near-null not type-distinguished (FM-9). | D | Medium (comparison) / Low (integrity) | ADD (optional numeric field) / DEFER |
| G20 | **No structured `supersedes` / superseded-value history.** Latest-Result Rule keeps one outcome per key; prior values live only in prose `metadata`. | I | Low | KEEP / DEFER |
| G21 | **No field-level provenance; sources are record-level on Study + Outcome only.** Arm and Endpoint carry none. Already logged (edge-cases 31/57). | D | Low–Medium | DEFER |
| G22 | **Between-arm comparison direction & sign are unenforceable authoring obligations.** Validator checks arm-count + non-empty `comparisonType`; it cannot judge direction wording or sign from free text. | D (works) | Low | KEEP |
| G23 | **No evidentiary unit above one Study → cross-study pooled analyses unrepresentable** (single required `studyId`, same-study containment). | I | Medium (out of current selection scope) | DEFER → BREAK |

### F. Semantic identity & duplicate rules

| # | Gap | Ev | Sev | Disp |
|---|-----|----|-----|------|
| G24 | **Outcome semantic key trusts `armIds`/`endpointId` as already-unique surrogates.** Semantically duplicate Arm/Endpoint records under different ids bypass outcome dedup (FM-10). Mitigated by the Preflight-B defensive exact-identity check; non-identical paraphrases still slip. | I | Medium | CLARIFY (reuse-before-create, done) + KEEP (partial validator) |
| G26 | **`normalize()` punctuation-sensitivity weakens every semantic key**, not just estimand (G12): a paraphrase differing only by a hyphen/comma yields a distinct key → a silent duplicate outcome, or a false collision reported as a duplicate. | D (via G12) | Medium | VALIDATOR (normalize punctuation) |

### G. Source-file ownership & generated aggregation

| # | Gap | Ev | Sev | Disp |
|---|-----|----|-----|------|
| G27 | **Source files are keyed by singular `companyId/assetId` directory** — a multi-focal study (G1/G5) has no single home. | I | Low (tied to G1/G5) | DEFER |
| G28 | **"Source" is a concept, not an entity** — ADR-0029 names a Source artifact, but it exists only as record-level `RecordMetadata.sources`; `sourceType` is unenumerated free text (venue overlaps `maturity` — G18). | D | Low | KEEP (documented divergence) |
| G29 | Deterministic concatenation + `validate:generated` (rejects non-regenerable output) is sound. | — | — | KEEP |

---

## 3. Demonstrated vs derived — summary

- **Demonstrated by the pilot (D):** G2 (linkage absent), G3, G4-latent, G5 (SURMOUNT-5 external comparator), G6 (scattered/absent programId), G10 (omitted pooled result), G11 (convention in use), **G12 (estimand casing drift — the one live semantic-key defect)**, G13, G14 (co-primary collision), G17 (SUMMIT/TRIUMPH-4 non-weight endpoints), G19 (heterogeneous units), G21, G22, G26, G28.
- **Derived from invariants, not yet observed (I):** G1 (no platform/master trial yet), G7 (regimen path unused), G8, G9, **G18 (maturity divergence never hit — only 2 of 6 values used)**, G20, G23, G24.

Key correction to the *pre-pilot* Preflight A framing: the two failure modes it weighted most heavily as looming risks — FM-5 (maturity conflation, G18) and FM-10 (Arm/Endpoint dedup, G24) — remain **purely derived**; the pilot never triggered them. The failure mode that actually *materialized* is the free-text **vocabulary/punctuation drift in the semantic key** (G12/G26), which Preflight A treated only as a phrasing-convention footnote.

---

## 4. Recommended disposition rollup

> **Superseded by REVISION 1 (R2/R3) for gaps G5, G8, G10, G12, G14, G17, G19, G23.** The rollup below is the original pre-decision analysis, retained as the evidence base.

- **VALIDATOR (non-breaking, do before freeze):** G12 + G26 — make `normalize()` (or a semantic-key-specific normalizer) punctuation-insensitive, and/or add a controlled-vocabulary/alias check for `estimand` and `analysisPopulation` analysis-set tokens. This is the only disposition driven by a *demonstrated live defect*.
- **CLARIFY (non-breaking docs, cheap, before freeze):** G6 (programId is indication-scoped, not an evidence bucket), G4 (id-namespacing convention), G17 (obesity-endpoint scope note), G3/G8 (optional). G9/G11/G15/G24 clarifications already landed in Preflight B.
- **KEEP as-is:** G7, G13, G16, G20, G22, G28, G29.
- **ADD (backward-compatible, only when a real case or downstream need forces it):** G2 (`parentStudyId`), G14 (endpoint-classification vocabulary), G19 (optional numeric result), partial G5 (internal comparator linkage).
- **BREAK (versioned, explicitly deferred):** G1 + G5 (multi-asset/shared-registry anchoring & study hierarchy), G10 (analysis-group entity), G18 (split maturity axes + regulatory), G23 (cross-study evidentiary unit). All already registered in `edge-cases.md` rows 41–45 and ADR-0036.
- **DEFER (explicit backlog):** G21 (field-level provenance), G27, plus the BREAK items above until a real case appears.

---

## 5. Schema-freeze decision

> **Superseded by REVISION 1 (R1).** The original recommended a minimal hardening-only pass; the user selected a broader "selective comprehensive" patch. Original text retained below as rationale.

**Freeze the Study–Arm–Endpoint–Outcome entity model as the v2.0 baseline — after a
small, non-breaking hardening pass, not before.**

The four-entity model is **structurally complete enough to freeze**: across a real
~19-study / ~180-outcome pilot spanning monotherapy, dose-ranging, active-comparator
head-to-head, withdrawal-maintenance, and comorbidity designs, it represented the
obesity major-evidence-set **without material information loss**. Every genuine
structural loss (G1/G5, G10, G18, G23) is **low-frequency, out of the current
selection scope, or derived-not-demonstrated**, and each is already protected by the
**omit-and-report** discipline that keeps the *stored* data truthful rather than
distorted. That is the project's established "no invented structural solutions before
pilot evidence" posture (ADR-0034/0036), and the pilot vindicates it.

A **broader breaking patch is not warranted before freeze.** The only finding that
*forces* action from demonstrated evidence is the semantic-key vocabulary/punctuation
drift (G12/G26), which is a **non-breaking validator hardening**, plus a handful of
cheap doc clarifications. Undertaking the breaking revisions now would bake speculative
shapes (analysis-group model, split maturity, multi-asset anchoring) around cases the
pilot has **not** produced — the exact over-engineering the contract discipline exists
to prevent.

---

## 6. Two implementation strategies

> **Superseded by REVISION 1 (R1, R3, R6).** The user chose a third, *selective comprehensive* path between these two. Original two-strategy analysis retained below.

**Strategy 1 — Comprehensive schema patch before any downstream work.**
Land, up front: analysis-group representation (G10), study hierarchy (G2), multi-asset
anchoring (G1/G5), split maturity finality×venue + regulatory (G18), numeric result
typing (G19), structured endpoint classification (G14), field-level provenance (G21),
cross-study unit (G23). *Then* freeze and build UI/comparison on the complete model.
- **Pros:** downstream built once on a maximal model; fewer later migrations; every
  known gap addressed.
- **Cons:** large and mostly **speculative** (most items are derived-not-demonstrated);
  multiple breaking changes force a data migration of the whole pilot; delays the freeze
  and downstream indefinitely; over-fits to cases (platform/master trials, cross-study
  pools, regulatory-only disclosures) the obesity landscape has not yet produced;
  directly contradicts the ADR-0034/0036 discipline; high risk of designing the wrong
  shape without a real case to test against.

**Strategy 2 — Minimal targeted patch, freeze, explicit deferral (recommended).**
1. Non-breaking **validator hardening** for G12/G26 (punctuation-insensitive semantic
   key and/or estimand & analysis-set controlled vocabulary) — closes the one live
   defect. 2. Non-breaking **doc clarifications** G6/G4/G17. 3. **Freeze** the entity
   model as v2.0. 4. Keep all breaking items (G1/G5, G10, G18, G23) and the additive
   items (G2, G14, G19) as an **explicit versioned backlog**, each already logged, to be
   revisited the first time a real case is encountered or a concrete downstream
   requirement forces it.
- **Pros:** cheap; fixes exactly what the evidence demands; preserves stored-data
  integrity; matches project discipline; unblocks downstream immediately; avoids
  speculative shapes.
- **Cons:** a later v2.1/v3 migration when a deferred case lands; downstream must treat
  the deferred items as **known, documented blind spots** rather than silent losses.

**Recommended choice: Strategy 2.** The pilot demonstrates that the entity model is
sound and that only vocabulary-drift hardening is evidence-forced. Deferral here is not
negligence — it is backed by the omit-and-report safeguard and a complete edge-case
ledger, so nothing is lost silently, and the freeze is honest about its boundaries.

---

## 7. Only-now: downstream consequences (Clinical Detail UI & cross-company comparison)

Performed **after** the schema conclusion, per the task's ordering. These do **not**
change the freeze recommendation; they rank the deferred gaps for whoever builds
downstream.

**Cross-company comparison — most affected, in order:**
- **G5** — head-to-head and shared assets are single-anchored; SURMOUNT-5's
  tirzepatide-vs-semaglutide result exists only under Lilly, and the semaglutide arm is
  not linked to Novo's `assetId`, so a Novo-side or symmetric comparison can't find it.
- **G12/G26** — estimand/population vocabulary drift ("Treatment policy" vs
  "Treatment-policy") fragments any cross-company grouping/matching key.
- **G19** — non-numeric `result.value` blocks ranking/aggregating effect sizes.
- **G18** — `maturity` not comparable across finality/venue; no regulatory tier.
- **G17 / G14** — cannot isolate the weight endpoint from comorbidity endpoints, nor
  align "primary" endpoints, across companies (SUMMIT HF event vs SURMOUNT weight loss).
- **G6** — unstable/absent program grouping.

**Clinical Detail UI — most affected, in order:**
- **G2** — no study grouping → cannot present core + extension/maintenance as one arc.
- **G10** — pooled/derived arms omitted → dose-response / starting-dose narrative
  incomplete.
- **G14** — no endpoint hierarchy/order → cannot render primary/key-secondary structure.
- **G21** — no field-level provenance → cannot cite a source per displayed value.
- **G20** — superseded values unstructured → no result-history view.

---

## 8. Verification (of the audit, not of a code change)

No files are modified. The audit's factual claims are reproducible read-only:
- Field-usage / drift scan across `data/clinical-evidence/*/*/clinical-evidence.json`
  (maturities used = {topline, peer-reviewed publication}; both "Treatment policy" and
  "Treatment-policy" estimand strings present; one external `linkedAsset`; `regimenId`
  unused; `responderThreshold` unused).
- `normalize()` at `scripts/data-registry.mjs:116` confirms hyphen-sensitivity.
- `getClinicalOutcomeSemanticKey` (~L1111) and `validateClinicalEvidenceAggregate`
  (~L1166) confirm the enforced invariants and the global arm/endpoint id uniqueness.
- Edge-cases rows 41–46 and ADR-0034/0036 confirm which gaps are already logged as
  deferred.
