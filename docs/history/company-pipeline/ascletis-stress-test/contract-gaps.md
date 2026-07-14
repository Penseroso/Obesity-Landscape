---
role: historical-diagnostic-report
status: historical
authority: non-authoritative
update-boundary: Frozen initial diagnostic evidence; current gaps belong in active contracts or edge cases.
---

# Ascletis Contract Gaps

- Regulatory progress such as `IND submitted` and `IND cleared` must remain
  separate from development stage; the new `regulatoryStates` array captures
  this but the UI does not yet display it.
- Fixed-dose combinations and co-formulations can be represented as one
  combination asset, but component-to-combination relationships remain
  unmodeled.
- External regimen combinations such as ASC47 plus semaglutide cannot be
  represented as a stable program identity without a combination/regimen model.
- Field-level provenance remains intentionally unsupported; record-level
  sources collectively support the entered record.
