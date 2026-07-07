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
| Joint development | Record the current principal company in `companyId`; note partners in sources. | Single `companyId` cannot express shared development. | assumption at risk | Yes |
| Regional rights | Track the principal entity; do not model territory splits. | No regional rights fields. | open until pilot | Yes |
| Licensing transfer | Update `companyId` when the principal entity changes; retain prior sources. | No licensing/rights history in a current-state snapshot. | provisionally usable | Yes |
| Company acquisition | Point records to the surviving/controlling entity; keep asset/program IDs stable. | No parent/successor modeling. | provisionally usable | Yes |
| Company or asset rename | Update display name; keep the stable ID unchanged. | No former-name field for search/traceability. | provisionally usable | No |
| Salts | Treat as the same asset identity unless clearly a distinct program; document. | No salt distinction in `assetId`. | open until pilot | Yes |
| Prodrugs | Provisionally distinct asset when developed as a distinct molecule; document. | Prodrug/parent relationship unmodeled. | open until pilot | Yes |
| Conjugates | Provisionally distinct asset; document conjugate identity. | Conjugate identity rules undefined. | open until pilot | Yes |
| Fixed-dose combinations | Provisionally one combination asset; document components. | Combination-to-component identity unmodeled. | assumption at risk | Yes |
| Indication-specific stages | Split into separate rows per differing stage/status. | One stage/status per row; may multiply rows. | assumption at risk | Yes |
| Combined Phase 1/2 trials | Record the stage that best reflects current development; note in sources. | Single enumerated stage cannot express Phase 1/2. | open until pilot | Yes |
| Silent pipeline removal | Do not infer discontinuation from disappearance; keep prior status until evidenced. | Snapshot cannot represent "quietly dropped". | provisionally usable | No |
| Completed trial with unclear program continuation | Keep program status as-is; a completed trial is not discontinuation. | No trial-vs-program distinction in status. | provisionally usable | No |
| Country-specific approvals | Record `Approved` when approved by a tracked regulator; note jurisdiction in sources. | No per-jurisdiction approval fields. | assumption at risk | Yes |
| Device or injector differences | Provisionally same program unless it is a distinct configuration; document. | No device granularity. | open until pilot | Yes |
| Field-level provenance | Use record-level `metadata.sources` collectively covering key claims. | Sources attach to the record, not to fields. | assumption at risk | Yes |
| Unclear primary development company | Choose a defensible principal entity; log the ambiguity. | Single `companyId` forces a choice. | open until pilot | Yes |
| Same asset with overlapping indication scopes | Split rows by distinct concurrent programs; avoid duplicate configurations. | Overlap can create ambiguous duplicate rows. | open until pilot | Yes |
