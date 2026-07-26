---
role: company-pipeline-contract-index
status: active
authority: authoritative
update-boundary: Update for Company/Pipeline scope, contract version, canonical document ownership, or dataset-layout changes.
---

# Data Protocol

Canonical entry point for Company/Pipeline scope and contract ownership. It
defines what belongs in the dataset and routes each semantic topic to one
authority. It does not repeat the research procedure.

## Versioning

Two independent versions apply:

- **Company/Pipeline Contract 1.2**: types, registries, validators, identity,
  entry semantics, and generated-output behavior. Supersedes Contract 1.1
  (ADR-0053) by adding the required, registry-backed `scopeClass` field to
  `PipelineProgramRecord` and `RegimenRecord`; no other Contract 1.1 shape
  changed.
- **Scope 2.0**: inclusion boundary for the obesity landscape. Supersedes
  Scope v1.1 (ADR-0052) as an **additive** expansion: Scope v1.1's
  qualification/include semantics are preserved unmodified as the R2 path
  below, and a second, mechanism-independent R1 path is added alongside it.
  No asset or row that qualified under Scope v1.1's include list lost its
  scope basis. This is narrower than "every Scope v1.1 rule is unchanged": R1
  changed the disposition of candidate classes Scope v1.1 automatically
  deferred — see [Defer](#defer) below and
  [R1](#r1--obesity-purpose-path-mechanism-independent).

A scope change does not imply a schema change. Clinical Evidence uses its own
independently versioned [contract](../../clinical-evidence/docs/README.md).

Contract 1.2 and Scope 2.0 became the active version in the commit where every
existing Program and Regimen was backfilled with a source-supported, authored
`scopeClass` and the validator began requiring it on every Program and Regimen
(the required-field migration gate; see the
[Research Workflow](./research-workflow.md#5-research-completion-gate)).

ADR-0055 added a Program/Study/Regimen/add-on disposition order, scoped
registry-citation evidence, an advisory anchor-mismatch probe signal, and a
documented `technical` field-authorship level. This clarifies Contract 1.2
entry semantics — consistent with ADR-0050 and ADR-0051, comparable or larger
entry-semantics changes that did not change the active version — and is not a
new Contract version: no type, registry, validator, or generated-output shape
changed, and no previously valid row became invalid.

## Canonical ownership

| Topic | Authority |
| --- | --- |
| Dataset scope, versions, layout | This file |
| Identity, mutable state, stable IDs, row splitting, combinations, regimens, references | [Entities and Rows](./entities-and-rows.md) |
| Evidence, source authority, entry, dates, statuses, registry promotion | [Source and Entry Policy](./source-and-entry-policy.md) |
| Generated artifacts and consumer guarantees | [Generated Output Contract](./generated-output-contract.md) |
| Current structural limitations and re-entry triggers | [Edge Cases](./edge-cases.md) |
| Decision background and current-authority pointers | [Compact Decision Index](./decision-log.md) |
| Company research execution | [Company/Pipeline Research Workflow](./research-workflow.md) |

If two active documents appear to define the same rule, keep the rule in the
authority named above and reduce the other location to a link.

## Dataset scope

Scope 2.0 (ADR-0052) is a competitive **obesity landscape**, no longer defined
solely by mechanism. Inclusion does not mean an asset is a GLP-1 receptor
agonist, contains GLP-1 biology, or otherwise shares any particular mechanism.
An asset qualifies when **R1 ∨ R2** holds; once qualified, the current
asset-scoped closure rule applies: investigate every current official Program
that Contract 1.2 can represent for that asset, not only its obesity-purpose
rows. Each stored Program and Regimen row then carries its own `scopeClass`
(see [Entities and Rows §Scope class](./entities-and-rows.md#scope-class)),
independent of whether that row itself qualified the asset.

### R1 — obesity-purpose path (mechanism-independent)

An asset qualifies when at least one of its official **Programs** is
classified `obesity-treatment` or `obesity-adjunct`.

Qualification through R1 belongs to a qualifying **Program**, which triggers
asset-scoped closure for its focal asset. A qualifying **Regimen** qualifies
only itself: it does not qualify its component assets, and it does not
trigger asset-scoped closure for them. A component asset must independently
satisfy R1 through its own qualifying Program, or R2 below. (For example, a
Regimen classified `obesity-adjunct` does not by itself bring its component
asset's other official Programs into scope, and does not by itself create a
new Program row for that component.)

### R2 — core-mechanism path (Scope v1.1 include list, unchanged, permanent)

The former Scope v1.1 include list is preserved **exactly as defined** — same
classes, same unconditional/conditional split — as a second, permanent
qualification path:

- GLP-1 receptor agonists and GLP-1-containing dual or triple agonists —
  unconditional;
- GLP-1-based combination products and regimens — unconditional;
- amylin-only and amylin-containing obesity programs — unconditional;
- GIP-only, glucagon-only, and other incretin/amylin/glucagon-axis programs —
  **conditional**: only when official evidence confirms obesity or
  weight-management intent.

R2 is **not** "any incretin/amylin/glucagon-axis asset qualifies." The
conditional classes remain conditional; Scope 2.0 did not relax them. R2 is a
permanent path, not a legacy exception scheduled for removal: it protects
assets already held in scope by core mechanism alone with no obesity-indication
row of their own (for example Roche's CT-868, QL Biopharm's ZT003, Novo
Nordisk's IcoSema, and Gan & Lee's GZR102 — see
[Entities and Rows](./entities-and-rows.md)). Only the unconditional
classes above (GLP-1 receptor agonists and GLP-1-containing dual/triple
agonists; GLP-1-based combination products and regimens; amylin-only and
amylin-containing obesity programs) qualify the moment mechanism is confirmed,
without waiting for an obesity-indication row to be disclosed first. A newly
disclosed GIP-only, glucagon-only, or other conditional incretin/amylin/
glucagon-axis asset still needs official evidence of obesity or
weight-management intent before it qualifies under R2.

### Defer

Unless already qualifying under R1 or R2:

- lean-mass, muscle-gain, or body-composition programs not combined with an
  anti-obesity therapy (see `obesity-adjunct` in
  [Entities and Rows §Scope class](./entities-and-rows.md#scope-class));
- non-incretin anti-obesity classes such as MC4R, CB1, CNS-appetite, lipase
  inhibitors, and unrelated small-molecule weight-loss programs, until an
  official obesity/weight-management development program is confirmed for
  that specific candidate;
- device, procedural, endoscopic, or bariatric-surgical candidates — these
  remain **unrepresentable** under the current `administration` contract
  (drug route/dosage-form only); a future administration-contract expansion
  is the re-entry trigger — see [Edge Cases](./edge-cases.md);
- other candidates requiring a future full-obesity-pharmacotherapy boundary.

### Exclude by default

- MASH-only, T2D-only, or comorbidity-only programs without qualifying R1 or
  R2 evidence;
- preclinical/non-human material that does not establish a tracked program;
- pure generic or biosimilar copies;
- unsupported, speculative, or unidentifiable candidates.

Detailed Clinical Evidence eligibility is governed by the separate Clinical
Evidence contract and must not be inferred from Company/Pipeline inclusion or
from `scopeClass` — see
[Clinical Evidence workflow §Scope](../../clinical-evidence/docs/workflow.md).

## Data layout and authority

```text
domains/company-pipeline/data/companies/<company-id>/
  company.json
  pipeline-programs.json
  regimens.json

domains/company-pipeline/data/registries/
  development-stages.json
  regulatory-states.json
  company-relationship-roles.json
  mechanism-families.json
  scope-classes.json

data/generated/
  companies.json
  pipeline-programs.json
  regimens.json
  clinical-evidence.json
  clinical-evidence-asset-studies.json
```

`domains/company-pipeline/data/companies/` and `domains/clinical-evidence/data/clinical-evidence/` are editable operating sources.
`data/generated/` is deterministic output and is never hand-edited. Historical
diagnostic material under `docs/history/` is not operating data, a fixture, or
a validation input.

## Operating terms

- **Asset**: stable company-local development identity.
- **Program**: an asset in a route, dosage form, and supported program scope.
- **Regimen**: independently administered products developed as a distinct
  configuration.
- **Combination asset**: fixed-dose combination or co-formulation represented
  as one asset.
- **Current state**: mutable values update existing records; the dataset is not
  an event log.
- **Operating source**: human-edited canonical JSON.
- **Generated aggregate**: deterministic consumer output with no independent
  canonical fact.

For execution steps, validation, and reporting, use the research workflow
rather than expanding this contract index.
