# Edge Cases

Real situations the frozen Contract 1.0 (ADR-0025) cannot yet cleanly
represent. Each is logged for later contract review as v2 backlog. **No final
schema solution is invented here.**

**Decision status** is one of:

- **provisionally usable** — can be entered today with the noted treatment.
- **open until pilot** — treatment stays undecided until real pilot data exists.
- **assumption at risk** — a current schema assumption likely to fail; expect a
  contract change.

| Case | Current treatment | Model limitation | Decision status | Contract review needed |
| --- | --- | --- | --- | --- |
| Joint development | Keep principal `companyId`; store confirmed role details in program/regimen `relationships`. | Relationship UI is not implemented. | provisionally usable | Yes |
| Regional rights | Store confirmed territories and rights in program/regimen `relationships`. | Relationship UI is not implemented. | provisionally usable | Yes |
| Licensing transfer | Update principal `companyId` when it changes; store current confirmed program/regimen relationships. | No relationship history in a current-state snapshot. | provisionally usable | Yes |
| Company acquisition | Point records to the surviving/controlling entity; keep asset/program IDs stable. | No parent/successor modeling. | provisionally usable | Yes |
| Company or asset rename | Update display name; keep the stable ID unchanged. | No former-name field for search/traceability. | provisionally usable | No |
| Salts | Treat as the same asset identity unless clearly a distinct program; document. | No salt distinction in `assetId`. | open until pilot | Yes |
| Prodrugs | Provisionally distinct asset when developed as a distinct molecule; document. | Prodrug/parent relationship unmodeled. | open until pilot | Yes |
| Conjugates | Provisionally distinct asset; document conjugate identity. | Conjugate identity rules undefined. | open until pilot | Yes |
| Fixed-dose combinations | Model as one combination asset/program with component references. | Component relationship UI is not implemented. | provisionally usable | Yes |
| Indication-specific stages | Split into separate rows per differing stage/status. | One stage/status per row; may multiply rows. | assumption at risk | Yes |
| Combined Phase 1/2 trials | Use the registry-backed `Phase 1/2` development stage directly; do not collapse into Phase 1 or Phase 2. | None; `Phase 1/2` is a distinct registry stage (ADR-0013). | provisionally usable | No |
| Silent pipeline removal | Do not infer discontinuation from disappearance; keep prior status until evidenced. | Snapshot cannot represent "quietly dropped". | provisionally usable | No |
| Completed trial with unclear program continuation | Keep program status as-is; a completed trial is not discontinuation. | No trial-vs-program distinction in status. | provisionally usable | No |
| Country-specific approvals | Record `Approved` when approved by a tracked regulator; note jurisdiction in sources. | No per-jurisdiction approval fields. | assumption at risk | Yes |
| Device or injector differences | Provisionally same program unless it is a distinct configuration; document. | No device granularity. | open until pilot | Yes |
| Field-level provenance | Use record-level `metadata.sources` collectively covering key claims. | Sources attach to the record, not to fields. | assumption at risk | Yes |
| Unclear primary development company | Choose a defensible principal entity; log the ambiguity. | Single `companyId` forces a choice. | open until pilot | Yes |
| Same asset with overlapping indication scopes | Split rows by distinct concurrent programs; avoid duplicate configurations. | Overlap can create ambiguous duplicate rows. | open until pilot | Yes |
| Regulatory state display | Store registry-backed regulatory states separately from development stage. | Current UI does not display regulatory state. | provisionally usable | Yes |
| Diagnostic stress-test archives | Keep diagnostic references outside production aggregate generation. | Archives are not golden expected output. | provisionally usable | No |
| Regimen display | Store regimens separately from pipeline programs. | Current UI does not display regimens. | provisionally usable | Yes |
| Cross-company entity resolution | Use external names for other companies and their assets. | No global company/asset graph, alias registry, or automatic linking. | open until needed | Yes |
| Dose-level regimen arms | Use `configurationKey` only for sponsor-defined regimen configurations. | No dose-level clinical arm model. | open until needed | Yes |

## Module B: v1 Contract Freeze Classification

These classifications use the first two operating companies, Ascletis Pharma
and Zealand Pharma, as readiness evidence only. They do not change company data
or the current protocol.

| Issue | Classification | Example | Current handling | V1 decision | Reason |
| --- | --- | --- | --- | --- | --- |
| Over-entered indication from a planned later-stage marker | data correction already resolved | Zealand petrelintide originally included `Chronic weight management` while the active Phase 2 evidence supports obesity/overweight and the broader weight-management wording belongs to planned Phase 3 work. | PR #11 removed the over-broad indication and regenerated aggregates. | keep as-is | This was a data-entry error, not a contract gap. |
| Official pipeline stage marker versus trial-initiated stage/status | current contract supports this after Module C annotation | Zealand petrelintide has a sponsor-declared Phase 3 chronic weight-management program with planned operational state; petrelintide / CT-388 has a Phase 2 registry entry that is not yet recruiting; Ascletis ASC35 has IND clearance but no started Phase 1 trial. | Store the most advanced official current `development.stage` and preserve evidence basis or operational state separately with `development.stageBasis` and `development.stageOperationalState`; keep regulatory details in `regulatoryStates`. | keep as-is for v1 | Module C added the smallest v1 annotation needed to avoid conflating sponsor-declared stage, regulatory-development milestone, clinical phase, and operational state. |
| Adjacent non-GLP-1 inclusion rationale | v2 schema/backlog candidate | Zealand petrelintide is an amylin analog tracked as a direct obesity competitor; Ascletis amylin assets appear as GLP-1-based fixed-dose combinations or regimens. | Include adjacent assets only when intentionally tracked; rationale is reported outside JSON because no field exists. | defer to v2 | V1 can operate with report-level rationale, but a durable rationale field would improve auditability. |
| Excluded or deferred candidate tracking | v2 schema/backlog candidate | Zealand survodutide, ZP6590, glepaglutide, and dasiglucagon were reviewed and excluded; unresolved candidates are currently reported in the research output only. | Do not store excluded candidates in operating data; classify them in the run report. | defer to v2 | The operating snapshot should stay clean for v1, but future refreshes would benefit from a lightweight exclusion/defer ledger. |
| Principal developer versus originator/licensor/partner company | current contract supports this | Zealand petrelintide and petrelintide / CT-388 keep Zealand as principal with Roche in `relationships`; survodutide is excluded from Zealand operating data because Boehringer Ingelheim is solely responsible for global development and commercialization. | Use singular `companyId`; store supported partner roles in `relationships`; external companies stay external names. | keep as-is | ADR-0018, ADR-0019, and ADR-0022 cover the observed cases without requiring schema changes for v1. |
| Fixed-dose combination versus regimen handling | current contract supports this | Ascletis ASC30_39 FDC and ASC36_35 FDC are combination product records; Ascletis ASC37 plus ASC36 is a regimen; Zealand petrelintide / CT-388 is represented as a fixed-dose combination. | FDC/co-formulation products are pipeline programs with components; independently administered products are regimen records. | keep as-is | ADR-0016 and ADR-0017 handled both companies' examples. |
| Source-level versus field-level provenance | v2 schema/backlog candidate | Zealand and Ascletis records often use one source for pipeline status and another for route, phase, or regulatory state. | Store record-level `metadata.sources` collectively covering key claims. | defer to v2 | The current contract is sufficient for v1 validation, but field-level attribution would reduce ambiguity during future audits. |
