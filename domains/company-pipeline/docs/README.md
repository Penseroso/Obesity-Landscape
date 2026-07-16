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

- **Company/Pipeline Contract 1.1**: types, registries, validators, identity,
  entry semantics, and generated-output behavior.
- **Scope v1.1**: inclusion boundary for the obesity/incretin competitive
  landscape.

A scope change does not imply a schema change. Clinical Evidence uses its own
independently versioned [contract](../../clinical-evidence/docs/README.md).

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

Scope v1.1 is a competitive **obesity/incretin** landscape. Inclusion does not
mean an asset is a GLP-1 receptor agonist or contains GLP-1 biology.

### Include

- GLP-1 receptor agonists and GLP-1-containing dual or triple agonists;
- GLP-1-based combination products and regimens;
- amylin-only and amylin-containing obesity programs;
- GIP-only, glucagon-only, and other incretin/amylin/glucagon-axis programs
  when official evidence confirms obesity or weight-management intent.

Once an asset qualifies through core mechanism or confirmed obesity/weight-
management intent, investigate every current official program for that asset
that Contract 1.1 can represent. Scope is not limited to obesity-indication
rows for an already-qualified asset.

### Defer from Scope v1.1

Unless already GLP-1-based:

- muscle-preserving or body-composition adjuncts;
- non-incretin anti-obesity classes such as MC4R, CB1, CNS-appetite, lipase
  inhibitors, and unrelated small-molecule weight-loss programs;
- other candidates requiring a future full-obesity-pharmacotherapy boundary.

### Exclude by default

- MASH-only, T2D-only, or comorbidity-only programs without qualifying core
  mechanism or confirmed obesity/weight-management intent;
- preclinical/non-human material that does not establish a tracked program;
- pure generic or biosimilar copies;
- unsupported, speculative, or unidentifiable candidates.

Detailed Clinical Evidence eligibility is governed by the separate Clinical
Evidence contract and must not be inferred from Company/Pipeline inclusion.

## Data layout and authority

```text
data/companies/<company-id>/
  company.json
  pipeline-programs.json
  regimens.json

data/registries/
  development-stages.json
  regulatory-states.json
  company-relationship-roles.json

data/generated/
  companies.json
  pipeline-programs.json
  regimens.json
  clinical-evidence.json
  clinical-evidence-asset-studies.json
```

`data/companies/` and `data/clinical-evidence/` are editable operating sources.
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
