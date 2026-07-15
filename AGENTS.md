---
role: agent-entrypoint
status: active
authority: authoritative
update-boundary: Update only when task routing, mandatory reading paths, or cross-document update boundaries change.
---

# Agent Entry Point

This is the only general documentation entry point for agents. Start here, then
read only the path for the task. Do not read the full documentation tree.

## Task routing and minimum reading paths

| Task | Required reading | Read only when needed |
| --- | --- | --- |
| Company/Pipeline research | [`research-workflow.md`](domains/company-pipeline/docs/research-workflow.md), [`Data Protocol`](domains/company-pipeline/docs/README.md), [`entities-and-rows.md`](domains/company-pipeline/docs/entities-and-rows.md), [`source-and-entry-policy.md`](domains/company-pipeline/docs/source-and-entry-policy.md) | Generated-output changes: [`generated-output-contract.md`](domains/company-pipeline/docs/generated-output-contract.md). Unrepresentable case: [`edge-cases.md`](domains/company-pipeline/docs/edge-cases.md). |
| Clinical Evidence research | Run the Company/Pipeline path first, then read [`docs/clinical-evidence-workflow.md`](docs/clinical-evidence-workflow.md) and [`docs/clinical-evidence/README.md`](docs/clinical-evidence/README.md) | Unrepresentable case: [`edge-cases.md`](domains/company-pipeline/docs/edge-cases.md). |
| Schema or validator | Relevant type file, relevant contract, and the relevant section of `scripts/data-registry.mjs` | Aggregate/projection change: generated-output contract. Workflow only if operator behavior changes. |
| UI | [`docs/ui/README.md`](docs/ui/README.md), then only the relevant route, component, selector, and read-model files | Data contract only when the UI consumes or changes that contract's meaning. |
| Historical decision review | [`decision-log.md`](domains/company-pipeline/docs/decision-log.md), then the linked current authority | Use [`docs/history/README.md`](docs/history/README.md) only when the compact index is insufficient. |

The files under `docs/history/` are historical, non-authoritative, and frozen.
They are never part of an ordinary implementation, research, validation, or
review reading path.

## Research routing

A named-company request to research, investigate, review, refresh, or update
routes to **Company/Pipeline Research** unless it has explicit Clinical
Evidence intent. The company name is the only required input. The workflow
decides initial investigation versus refresh from existing data.

Explicit Clinical Evidence intent uses this two-tier rule:

- Strong triggers: `임상`, `임상시험`, `clinical`, `clinical trial`, `trial`,
  `endpoint`, or `NCT`.
- Contextual triggers: `시험`, `results`, or `결과` only when the same request
  also contains a strong trigger or `study`, `efficacy`, or `safety`.

Broad terms without clinical context, such as earnings results or a
manufacturing test, remain Company/Pipeline requests. Mentioning an asset does
not replace the required company name.

For a Clinical Evidence request, Company/Pipeline Research runs first in the
same execution. If that first step cannot access required sources, stop before
all operating-data changes. If it completes but Clinical Evidence source access
later fails, retain the completed Company/Pipeline changes, make no Clinical
Evidence changes, and report partial completion.

## Update boundaries

| Change | Update | Do not update by default |
| --- | --- | --- |
| Company or Clinical data refresh | Editable source JSON and generated JSON | Documentation, decision index, history |
| Routing or entry condition | This file | Contracts and history |
| Research procedure | The relevant workflow | Semantic contracts |
| Schema or semantic contract | Types, validator, fixtures, relevant contract, compact decision entry | Workflow and UI unless behavior changes |
| Aggregate or projection | Generator, types, existing generated-output contract, consumers | Research workflows |
| UI route, read model, or user-facing semantics | UI code and UI reference | Historical UI audit |
| New durable decision | Current authority plus one compact decision entry | Historical decision log |

Current rules belong in contracts and references, not in the Decision Log.
Completed audits, migrations, and module reports are archived once and are not
maintained as living documents.
