---
role: ui-reference
status: active
authority: authoritative
update-boundary: Update when routes, read-model boundaries, user-visible data semantics, or standing UI validation requirements change; not for routine styling edits.
---

# UI Reference

Canonical reference for the current UI surface and its data-consumption
boundaries. Historical UI audits are not part of the implementation path.

## Routes and ownership

| Route | Primary responsibility |
| --- | --- |
| `/` | Portfolio overview and summary views |
| `/assets` | Searchable/filterable program register |
| `/companies/[companyId]` | Company detail and associated clinical inventory |
| `/assets/[companyId]/[assetId]` | Focal and linked studies for an asset |
| `/studies/[studyId]` | Study, arms, endpoints, outcomes, and source detail |

`app/` owns routing and page composition. `components/` owns presentation and
interaction. `lib/programs/` and `lib/company-detail/` own Company/Pipeline read
models; `domains/clinical-evidence/lib/` owns Clinical Evidence types and
loading, while `lib/clinical-evidence/selectors.ts` remains the read model
pending D5.
Components must not read editable source JSON directly.

## Data boundaries

- UI reads generated artifacts through typed loaders and selectors.
- Program-specific clinical retrieval uses explicit `Study.programId`; it does
  not infer a relationship from asset, indication, title, or source URL.
- Asset views may use the generated focal/linked asset-study projection.
- Missing optional values render through shared formatting; `N/A` is never
  stored in source data.
- Outcome existence alone determines whether a Study has recorded results.
  User-facing empty copy is **“No recorded outcomes.”** It does not claim that
  no public result exists.
- Clinical stage and regulatory milestone presentation must preserve the
  distinctions supplied by the Company/Pipeline contract.

## Change boundary

Update this reference for a new/removed route, a changed read-model owner, a
new inference rule, or changed user-visible meaning. Do not update it for local
spacing, color, or component refactors that preserve those boundaries.

Validate UI changes with `npm run lint`, `npm run build`, and relevant data
validators when data consumption changes.
