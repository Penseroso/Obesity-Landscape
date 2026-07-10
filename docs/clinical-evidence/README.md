# Clinical Evidence Contract

Authoritative minimum semantic contract for the future Clinical Evidence
domain. This document defines what may be represented when that domain is later
implemented. It does not create a workflow, data files, schemas, validators,
generated outputs, UI, or a research prompt.

## Eligibility

Clinical Evidence follows the existing **Scope v1.1** inclusion boundary from
the data protocol and ADR-0026. This document does not restate, broaden, or
override that indication and product scope.

Store only **human interventional clinical studies with publicly disclosed
study-specific results**. Results may be interim, topline,
conference-presented, registry-posted, or peer-reviewed.

Do not store:

- planned studies.
- recruiting studies without public results.
- completed studies without public results.
- protocol-only studies.
- observational or non-interventional studies.
- preclinical, animal, in vitro, or other non-human studies.
- studies outside Scope v1.1.

## Entity Boundaries

These are semantic boundaries only; they are not schemas.

- **Study** - one identifiable clinical protocol.
- **Arm** - one treatment or comparator configuration within a study.
- **Endpoint** - one defined outcome and assessment timepoint.
- **Outcome** - one reported result tied to an endpoint, arm or comparison, and
  analysis population.

An Outcome requires a disclosed result. A protocol-defined endpoint without a
reported value is not enough to create Clinical Evidence.

## Linkage To Contract 1.0

Clinical Evidence is separate from `PipelineProgramRecord` and must not alter
the frozen Contract 1.0 semantics.

Where applicable, Clinical Evidence should reuse existing identity anchors from
the Company/Pipeline domain:

- `companyId`
- `assetId`
- `programId`
- regimen identity

These links identify the relevant company, asset, program, or regimen. They do
not move clinical-study details into pipeline records, change program identity,
or change development-stage and status semantics.

## Comparison Safeguards

When disclosed, preserve the facts needed to understand a reported result:

- dose.
- treatment duration.
- comparator.
- endpoint timepoint.
- analysis population.
- estimand.
- result basis, such as interim, topline, conference, registry, or
  peer-reviewed.

Distinguish source-reported values from derived values. Derived values may be
introduced only by a future implementation contract that states how they are
calculated and attributed.

Do not define ranking, cross-trial comparison, scoring, or UI comparison logic
in this contract.

## Source And Update Principles

Reuse the existing field-specific source policy in
[`../data-protocol/source-and-entry-policy.md`](../data-protocol/source-and-entry-policy.md),
including the Clinical results source class.

Preserve result maturity and source provenance. Later authoritative results may
update earlier findings, but must not silently erase historical support that
explains how the result record evolved.

An official topline release confirms what the company announced, but it is not
independent validation. Registry results, conference materials, peer-reviewed
publications, and official releases should be treated according to the claim they
support.

## Non-Goals

This contract does not introduce:

- a Clinical Evidence Research workflow.
- a reusable research prompt.
- study, arm, endpoint, or outcome schemas.
- validators, registries, generated outputs, or data files.
- ranking or UI comparison behavior.
- actual clinical evidence collection.
