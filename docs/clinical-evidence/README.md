# Clinical Evidence Contract

Authoritative semantic contract for the future Clinical Evidence domain. This
document defines what may be represented when that domain is later implemented.
It does not create a workflow, data files, schemas, validators, generated
outputs, UI, or a research prompt.

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

Do not include:

- registered, planned, recruiting, or completed studies with no disclosed
  results.
- protocol-only or design-only disclosures.
- healthy-volunteer PK studies without an explicit obesity or weight-management
  objective.
- MASH-only, T2D-only, CKD/CV/lipid/comorbidity-only studies.
- studies where body weight is incidental and obesity or weight management is
  not an explicit study population or objective.
- preclinical, animal, in vitro, or other non-human studies.

A study enrolling participants with obesity or overweight plus T2D remains
eligible when weight management is an explicit objective. It is not treated as
T2D-only in that case.

MASH and other indication expansion remain outside the initial Clinical Evidence
scope until a later scope decision.

## Entity Boundaries

These are semantic boundaries only; they are not TypeScript types or JSON
schemas.

- **Study** - one identifiable clinical protocol or registry study.
- **Arm / intervention** - the administered treatment configuration,
  comparator, dose, route, and schedule.
- **Endpoint** - the prespecified outcome definition and assessment timepoint.
- **Outcome** - a reported result for a specific endpoint, arm or comparison,
  analysis population, and timepoint.
- **Source** - the artifact supporting the study design or reported outcome.

An Outcome requires a disclosed result. A protocol-defined endpoint without a
reported value is not enough to create Clinical Evidence.

A Source may support study design, study status, endpoint definition, arm
configuration, outcome value, result maturity, or correction/update history.
The future implementation may attach more than one source to the same study or
outcome because design and result facts often come from different artifacts.

## Linkage To Contract 1.0

Clinical Evidence is separate from `PipelineProgramRecord` and must not alter
the frozen Contract 1.0 semantics.

Where applicable, Clinical Evidence should reuse existing identity anchors from
the Company/Pipeline domain:

- `companyId`
- `assetId`
- `programId`
- regimen identity

Clinical Evidence must not duplicate or redefine company, asset, program,
regimen, stage, or status semantics. Study designs and outcomes must not be
stored inside existing pipeline records.

Link studies as follows:

- link to an **asset** when the study tests one tracked asset but the exact
  program configuration is not represented or cannot be resolved.
- link to a **program** when the study aligns with a specific existing
  `programId`.
- link to a **regimen** when independently administered products are studied
  together as a regimen.
- link to **multiple interventions** when the study includes tracked
  combinations, active comparators, background therapy, or arms sponsored by
  different companies.

Existing company-local identity rules remain in force. This module does not
require cross-company entity resolution; external companies and assets may need
name-based references in a future implementation contract.

## Minimum Information Contract

A future Clinical Evidence record must preserve the minimum information needed
to interpret a result without inventing missing facts:

- study identity and registry or protocol identifiers.
- phase and study status.
- population and key eligibility context.
- randomization, masking, comparator, and study design.
- treatment arms, dose, route, frequency, and duration.
- primary and key secondary endpoints.
- analysis population and estimand when disclosed.
- endpoint timepoint and unit.
- arm-level and comparator results.
- placebo-adjusted or active-comparator effect when directly reported or
  deterministically derivable.
- confidence interval, p-value, and responder threshold when reported.
- result maturity: interim, topline, final, registry result, conference result,
  or peer-reviewed publication.
- essential safety findings without attempting exhaustive adverse-event capture.
- source and verification metadata.

Preserve reported values as source facts. Any derived value must be explicitly
distinguishable from a reported value and must not overwrite it. A future
implementation must state how derived values are calculated and attributed
before storing them.

## Comparison Safeguards

Cross-study comparison must retain or expose:

- treatment duration.
- dose and titration.
- comparator.
- analysis population.
- estimand.
- missing-data handling when disclosed.
- baseline population context.
- whether the value is absolute, relative, placebo-adjusted, active-comparator
  adjusted, or responder-based.

Do not define a ranking algorithm, cross-trial score, or UI comparison metric in
this module.

## Source And Update Policy

Reuse the existing field-specific source policy in
[`../data-protocol/source-and-entry-policy.md`](../data-protocol/source-and-entry-policy.md)
where applicable, including the Clinical results source class.

Acceptable result sources include:

- peer-reviewed publications.
- conference presentations, abstracts, or posters.
- registry-posted results.
- official company topline releases.

Company topline results record what the sponsor reported and are not independent
validation.

Later authoritative results may supplement or supersede earlier result maturity
without erasing useful historical sources. Corrected or updated results must
remain traceable. Study existence without publicly disclosed study-specific
results is insufficient for entry into Clinical Evidence operating data.

## Non-Goals

This contract does not introduce:

- a Clinical Evidence Research workflow.
- a reusable research prompt.
- TypeScript types or JSON schemas.
- validators, registries, generated outputs, or data files.
- ranking or UI comparison behavior.
- actual clinical evidence collection.
