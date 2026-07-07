# Edge Cases

Real situations the current **provisional** contract cannot yet cleanly
represent. Each is logged for later contract review. **No final schema solution
is invented here.**

**Decision status** is one of:

- **provisionally usable** — can be entered today with the noted treatment.
- **open until pilot** — treatment stays undecided until real pilot data exists.
- **assumption at risk** — a current schema assumption likely to fail; expect a
  contract change.

| Case | Current provisional treatment | Model limitation | Decision status | Contract review needed |
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
| Combined Phase 1/2 trials | Do not map subjectively to Phase 1 or Phase 2; keep as an edge case until a pilot-based mapping rule is approved. | Single enumerated stage cannot express Phase 1/2. | open until pilot | Yes |
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
