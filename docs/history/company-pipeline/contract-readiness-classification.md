---
role: historical-audit
status: historical
authority: non-authoritative
update-boundary: Frozen point-in-time audit; do not update for current implementation changes.
---

# Contract readiness classification (formerly "Module B")

Point-in-time readiness classifications using the first two operating
companies, Ascletis Pharma and Zealand Pharma, as evidence only. They did not
change company data or the protocol at the time, and were recorded for the
earlier baseline before carrying forward unchanged into Contract 1.2
(ADR-0030, ADR-0053). Archived out of `edge-cases.md` because it is fully
resolved or fully superseded by rows in that file's live table: "Field-level
provenance" and "Investigation classification tracking" are current, generalized
entries there; the remaining four rows below are resolved or reference the
company-specific worked examples that motivated already-settled ADRs.

| Issue | Classification | Example | Current handling | V1 decision | Reason |
| --- | --- | --- | --- | --- | --- |
| Over-entered indication from a planned later-stage marker | data correction already resolved | Zealand petrelintide originally included `Chronic weight management` while the active Phase 2 evidence supports obesity/overweight and the broader weight-management wording belongs to planned Phase 3 work. | PR #11 removed the over-broad indication and regenerated aggregates. | keep as-is | This was a data-entry error, not a contract gap. |
| Official pipeline stage marker versus trial-initiated stage/status | current contract supports this after Module C annotation | Zealand petrelintide has a sponsor-declared Phase 3 chronic weight-management program with planned operational state; petrelintide / CT-388 has a Phase 2 registry entry that is not yet recruiting; Ascletis ASC35 has IND clearance but no started Phase 1 trial. | Store the most advanced official current `development.stage` and preserve evidence basis or operational state separately with `development.stageBasis` and `development.stageOperationalState`; keep regulatory details in `regulatoryStates`. | keep as-is for v1 | Module C added the smallest v1 annotation needed to avoid conflating sponsor-declared stage, regulatory-development milestone, clinical phase, and operational state. |
| Adjacent non-GLP-1 inclusion rationale | Resolved by Contract 1.2 `scopeClass` (ADR-0053) | Zealand petrelintide is an amylin analog tracked as a direct obesity competitor; Ascletis amylin assets appear as GLP-1-based fixed-dose combinations or regimens. | The required, durable `scopeClass` field replaces report-level rationale for why a non-GLP-1 row is tracked. | resolved | See [Data Protocol §Dataset scope](../../../domains/company-pipeline/docs/README.md#dataset-scope); no further schema change needed. |
| Investigation classification tracking | v2 schema/backlog candidate | Zealand survodutide, ZP6590, glepaglutide, and dasiglucagon were reviewed and excluded; classifications are currently reported in the research output only. | Do not store investigation classifications in operating data; report each surfaced entity as entered, merged, deferred, or excluded, with a reason. | defer to v2 | The operating snapshot should stay clean for v1, but future refreshes would benefit from a lightweight classification ledger. **Superseded**: this concern is now a live, generalized row in `edge-cases.md` ("Investigation classification tracking"), without the company-specific examples. |
| Principal developer versus originator/licensor/partner company | current contract supports this | Zealand petrelintide and petrelintide / CT-388 keep Zealand as principal with Roche in `relationships`; survodutide is excluded from Zealand operating data because Boehringer Ingelheim is solely responsible for global development and commercialization. | Use singular `companyId`; store supported partner roles in `relationships`; external companies stay external names. | keep as-is | ADR-0018, ADR-0019, and ADR-0022 cover the observed cases without requiring schema changes for v1. |
| Fixed-dose combination versus regimen handling | current contract supports this | Ascletis ASC30_39 FDC and ASC36_35 FDC are combination product records; Ascletis ASC37 plus ASC36 is a regimen; Zealand petrelintide / CT-388 is represented as a fixed-dose combination. | FDC/co-formulation products are pipeline programs with components; independently administered products are regimen records. | keep as-is | ADR-0016 and ADR-0017 handled both companies' examples. |
| Source-level versus field-level provenance | v2 schema/backlog candidate | Zealand and Ascletis records often use one source for pipeline status and another for route, phase, or regulatory state. | Store record-level `metadata.sources` collectively covering key claims. | defer to v2 | The current contract is sufficient for v1 validation, but field-level attribution would reduce ambiguity during future audits. **Superseded**: this concern is now the live "Field-level provenance" row in `edge-cases.md`. |
