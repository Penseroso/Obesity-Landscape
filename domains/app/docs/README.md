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

`app/` owns routing and page composition; it is root-pinned for the current
Next.js architecture and this migration program (Module 6 resolved D6 — the
App Router only resolves `app/` at the repository root or under `src/`, and
no config repoints it under a domain root; a future framework-level
restructure could revisit this, but no later move-only module may relocate
`app/`). `domains/app/components/` owns presentation and interaction.
`domains/company-pipeline/lib/` owns the Company/Pipeline read model;
`domains/clinical-evidence/lib/` owns Clinical Evidence types and loading. The
Application read-model tier — `domains/app/lib/company-detail/read-model.ts`
(cross-domain company composition) and
`domains/app/lib/clinical-evidence/selectors.ts` (Clinical Evidence read
model) — moved here in Module 6. `domains/app/config/program-table.ts` and
`domains/app/lib/format.ts` are likewise canonical. Module 9 removed the legacy
`components/`, `config/`, `lib/format.ts`, and read-model compatibility shims;
consumers import the canonical paths directly. Components must not read editable
source JSON directly.

Within `domains/app/`, files import each other and the read-model tier
through canonical `@/domains/app/...` paths. Imports into Company/Pipeline-owned
code resolve through the canonical `@/domains/company-pipeline/lib/*` paths
(Module 9 removed the former `@/lib/programs/*` shims).
`domains/app/lib/clinical-evidence/selectors.ts` reads Clinical Evidence data
through the canonical `@/domains/clinical-evidence/lib/data` loader; Module 9
repointed this dependency off the former `@/lib/clinical-evidence/data` shim and
rewrote the `eslint.config.mjs` boundary against canonical paths, preserving the
ADR semantics: only the canonical loader imports the generated Clinical Evidence
JSON, and only these canonical selectors import that loader.

## Data boundaries

- UI reads generated artifacts through typed loaders and selectors.
- Program-specific clinical retrieval uses explicit `Study.programId`; it does
  not infer a relationship from asset, indication, title, or source URL.
- Asset views may use the generated focal/linked asset-study projection. Focal
  versus linked is the top-level split. **Inside** each relation, Studies group by
  the authored `studyFamily` only; a Study without one is unclassified and renders
  in a trailing "Other studies" group. Family is never inferred from an acronym or
  title, and the family name appears in the group header only.
- The Program (or regimen) mapping stays explicit and is displayed as per-row
  metadata — route, dosage form, dosing interval, or the regimen name — rather than
  as the grouping boundary. It is still never inferred from asset, indication,
  title, comparator links, or source URLs.
- The Asset Studies list is a comparison table: Study, Phase, Population, Treatment,
  Duration, Primary finding. Registry status is not shown there. Primary finding is
  **deterministic selection, never calculation**: the highest-ranked endpoint role
  that carries a recorded Outcome, then one comparison group and family within it,
  rendered as stored `result.value` text for stored anchors. A Study with no recorded
  Outcome renders an italic "Not reported".
- The read model returns **every comparison group** of the selected endpoint, in curated
  source order, never merging groups that differ by analysis population, estimand, or
  cohort, and never dropping one for being one too many to show. Comparison-group
  boundaries come from the canonicalization shared with the validator
  (`domains/clinical-evidence/lib/clinical-term-canonicalization.mjs`), so both sides
  draw the same boundary.
- **Showing at most three groups per row is a presentation policy of the Asset Clinical
  Detail list alone**, not a data rule: the list renders the first three and reports the
  remainder as `+N groups`. The Clinical Evidence contract and the validator do not know
  this number, and another screen may show a different count. Each shown group names its
  estimand and analysis population, so a reader can tell the analyses apart.
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
