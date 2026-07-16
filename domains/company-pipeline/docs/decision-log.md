# Decision Index

Compact index of durable decisions. This file is **not** the authority for
current rules: follow the linked contract or reference. The frozen expanded log
through ADR-0039 is available only through the
[historical catalog](../../../docs/history/README.md).

| ID | Decision | Reason | Status | Current authority |
| --- | --- | --- | --- | --- |
| ADR-0001 | Store a current-state snapshot, not event history. | The product tracks the present landscape. | Active | [Data Protocol](./README.md) |
| ADR-0002 | Reuse stable company, asset, and program IDs. | Stable identity enables updates and references. | Active | [Entities and Rows](./entities-and-rows.md) |
| ADR-0003 | Exclude stage and status from program identity. | They are mutable state. | Active | [Entities and Rows](./entities-and-rows.md) |
| ADR-0004 | Update mutable stage/status in place. | Progression must not fragment identity. | Active | [Entities and Rows](./entities-and-rows.md) |
| ADR-0005 | Judge source authority by field or claim type. | Different claims have different best sources. | Active | [Source and Entry Policy](./source-and-entry-policy.md) |
| ADR-0006 | Treat `N/A` as UI output only. | Missing data and display fallback are separate. | Active | [UI reference](../../../docs/ui/README.md) |
| ADR-0007 | Keep `null` distinct from `Unknown`. | They express absence versus confirmed unresolved state. | Active | [Source and Entry Policy](./source-and-entry-policy.md) |
| ADR-0008 | Retain evidenced discontinued programs. | Competitive history remains relevant to the current landscape. | Active | [Source and Entry Policy](./source-and-entry-policy.md) |
| ADR-0009 | Treat the original schema as provisional. | Early structural gaps required pilot evidence. | Superseded by ADR-0030 | [Data Protocol versioning](./README.md#versioning) |
| ADR-0010 | Defer speculative contract changes until pilot evidence. | Avoid designing unused schema. | Active principle | [Edge Cases](./edge-cases.md) |
| ADR-0011 | Generate deterministic operating aggregates. | Editable sources and consumer outputs need a clear boundary. | Active | [Generated Output Contract](./generated-output-contract.md) |
| ADR-0012 | Isolate the Ascletis stress-test fixture. | Diagnostic evidence must not enter production aggregates. | Superseded by ADR-0021 | [Historical catalog](../../../docs/history/README.md) |
| ADR-0013 | Back development stages with a registry. | Controlled values require consistent validation and ordering. | Active | [Source and Entry Policy](./source-and-entry-policy.md) |
| ADR-0014 | Separate regulatory state from development stage. | Jurisdictional milestones are not clinical phases. | Active | [Source and Entry Policy](./source-and-entry-policy.md) |
| ADR-0015 | Allow ISO 8601 partial evidence dates. | Sources often disclose only year or month precision. | Active | [Source and Entry Policy](./source-and-entry-policy.md) |
| ADR-0016 | Model an FDC/co-formulation as one combination asset. | A product configuration is distinct from co-administration. | Active | [Entities and Rows](./entities-and-rows.md) |
| ADR-0017 | Model independently administered products as a regimen. | A regimen is not a pipeline-program asset identity. | Active | [Entities and Rows](./entities-and-rows.md) |
| ADR-0018 | Store program/regimen company relationships and rights. | Licensing and co-development affect responsibility. | Active | [Entities and Rows](./entities-and-rows.md) |
| ADR-0019 | Keep one principal `companyId`. | The company-local model avoids an unresolved global graph. | Active | [Entities and Rows](./entities-and-rows.md) |
| ADR-0020 | Back relationship roles with a registry. | Role vocabulary needs consistent validation. | Active | [Source and Entry Policy](./source-and-entry-policy.md) |
| ADR-0021 | Preserve Ascletis only as historical diagnostic evidence. | The initial pilot is neither canonical nor golden validation data. | Active | [Historical catalog](../../../docs/history/README.md) |
| ADR-0022 | Keep Company/Pipeline internal references company-local. | Cross-company resolution is outside Contract 1.1. | Active | [Entities and Rows](./entities-and-rows.md) |
| ADR-0023 | Use `configurationKey` only for stable official regimen distinctions. | Trial-arm dosing must not create regimen identity. | Active | [Entities and Rows](./entities-and-rows.md) |
| ADR-0024 | Store the most advanced official stage and annotate its basis/state. | Regulatory milestones must not be approximated as phases. | Active | [Source and Entry Policy](./source-and-entry-policy.md) |
| ADR-0025 | Freeze the original v1 baseline. | Initial pilots supported the then-current model. | Superseded by ADR-0030 | [Historical catalog](../../../docs/history/README.md) |
| ADR-0026 | Define Scope v1.1 as the obesity/incretin landscape. | The product is broader than GLP-1 RA but not all obesity pharmacotherapy. | Active | [Data Protocol scope](./README.md#dataset-scope) |
| ADR-0027 | Separate generic company routing from explicit clinical intent. | Clinical extraction needs a distinct workflow. | Refined by ADR-0035 | [Agent entry point](../../../AGENTS.md#research-routing) |
| ADR-0028 | Establish Clinical Evidence as a separate domain. | Study/result semantics differ from pipeline tracking. | Refined and partially superseded | [Clinical Evidence contract](../../clinical-evidence/docs/README.md) |
| ADR-0029 | Define the initial obesity-result semantic contract. | Clinical results require explicit Study/Arm/Endpoint/Outcome boundaries. | Superseded in shape by ADR-0037/0039 | [Clinical Evidence contract](../../clinical-evidence/docs/README.md) |
| ADR-0030 | Adopt Company/Pipeline Contract 1.1. | Pilot evidence justified sharper identity, aliases, rows, and source rules. | Active | [Data Protocol](./README.md) |
| ADR-0031 | Harden aliases and status/operational-state validation. | Single sourcing and defensive checks prevent drift. | Active | [Entities and Rows](./entities-and-rows.md), [Source Policy](./source-and-entry-policy.md) |
| ADR-0032 | Require explicit study classification and sufficient row-merge evidence. | Equal mutable state alone does not prove one program. | Corrected by ADR-0033 | [Entities and Rows](./entities-and-rows.md) |
| ADR-0033 | Separate intervention model from protocol structure and tighten regimen tests. | Platform structure and background therapy were being conflated. | Active | [Entities and Rows](./entities-and-rows.md) |
| ADR-0034 | Close Clinical preflight documentation and validator gaps. | Readiness required minimal semantic-duplicate and comparison safeguards. | Active implementation background | [Clinical Evidence contract](../../clinical-evidence/docs/README.md) |
| ADR-0035 | Activate Clinical Evidence routing with Company/Pipeline first. | Clinical research depends on a current authoritative asset list. | Active | [Agent entry point](../../../AGENTS.md#research-routing) |
| ADR-0036 | Formalize estimand, population, and source-reported-result handling. | Pilot data exposed semantic-key and inference risks. | Active | [Clinical Evidence contract](../../clinical-evidence/docs/README.md) |
| ADR-0037 | Migrate Clinical Evidence to v2 with analysis groups and structured results. | Demonstrated pilot gaps required an atomic schema migration. | Superseded in version by ADR-0039; semantics retained | [Clinical Evidence contract](../../clinical-evidence/docs/README.md) |
| ADR-0038 | Harden Clinical v2 version fields and numeric results. | Canonical and projection versions needed explicit separation. | Refined by ADR-0039 | [Clinical Evidence contract](../../clinical-evidence/docs/README.md), [Generated Output Contract](./generated-output-contract.md) |
| ADR-0039 | Adopt Clinical Evidence v3 Study inventory. | Verified studies must be representable before outcomes exist. | Active | [Clinical Evidence contract](../../clinical-evidence/docs/README.md) |

New entries stay one row. Put the enforceable rule in its current authority and
use this index only to preserve the decision, short reason, status, and pointer.
