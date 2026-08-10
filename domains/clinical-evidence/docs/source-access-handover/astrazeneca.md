---
companyId: astrazeneca
status: active
lastCheckedAt: 2026-08-10
---

# AstraZeneca Clinical Evidence source-access handover

## Cotadutide result publications

- Company / asset / Studies: AstraZeneca / cotadutide / NCT02548585, NCT03235050, NCT03596177
- Highest-priority known sources:
  - NCT02548585: https://pubmed.ncbi.nlm.nih.gov/29945727/
  - NCT03235050: https://pubmed.ncbi.nlm.nih.gov/34016612/
  - NCT03596177: https://pubmed.ncbi.nlm.nih.gov/38562018/
- Access status: `PARTIAL_SOURCE_REVIEWED`
- Blocker: the user supplied the complete article PDFs for NCT02548585 and NCT03596177. Supporting appendices were not supplied; NCT03596177 Supporting Information Table S7 is still required for exact per-arm nausea, vomiting, and serious-adverse-event mapping. The independently accessible NCT03235050 full article was reviewed through PMC8247525, but its supporting tables were not available with that article.
- Confirmed scope: the NCT02548585 publication directly supports the stored Phase 2a primary body-weight arm results, active-arm at-least-5% responder result, and per-arm serious adverse event, nausea, and vomiting results. The NCT03235050 publication directly supports the stored Week 14 co-primary body-weight arm results, Week 54 at-least-5% responder results, and concise safety context. The NCT03596177 publication directly supports the stored primary body-weight arm results and contrast, the central Day 32 and Day 59 energy-intake results, and concise safety context. Registry-supported cotadutide body-weight outcomes remain entered for NCT03244800, NCT03645421, and NCT03745937.
- Missing scope: NCT02548585 appendix-only MAD cohort results and a reliable signed direct estimate for the Phase 2a body-weight contrast; NCT03235050 supporting-table per-arm named safety results and chart-only Week 54 efficacy values; NCT03596177 Supporting Information Table S7 per-arm named safety results.
- Fallback attempted: ClinicalTrials.gov study records and posted results remain direct provenance for registry-specific results. They were not treated as proof of publication-only analysis context.
- Currently affected scope: appendix-only NCT02548585 results and supporting-table-only named safety or chart-only efficacy results for NCT03235050 and NCT03596177.
- Re-entry condition: obtain the NCT02548585 appendix and the NCT03235050 and NCT03596177 Supporting Information. Store only results whose arms, populations, timepoints, and estimands map unambiguously.

## Multi-asset and master-protocol schema cases

- Company / Studies: AstraZeneca / NCT06151964, NCT07017179, NCT07667803
- Access status: `DEFERRED_SCHEMA_CASE`
- Blocker: the current Clinical Evidence contract requires one focal asset/Program or Regimen anchor per Study, but these registries contain shared multi-asset or nested master-protocol scopes that cannot be assigned canonically without duplicating or misattributing the Study.
- Confirmed scope:
  - CONTEMPO (NCT06151964) evaluates AZD9550 monotherapy and AZD9550 plus AZD6234 within one obesity/weight-management registry. AstraZeneca's stored Company/Pipeline manifest has no standalone AZD9550 Program that can own the monotherapy scope.
  - NCT07017179 evaluates AZD6234 monotherapy, AZD9550 monotherapy, and their combination within one Phase 2 multi-drug platform registry.
  - EMBOLD (NCT07667803) is a Phase 3 elecoglipron master protocol with multiple nested scopes. The separately registered VISTA study remains canonically stored; EMBOLD itself is not flattened into that Study.
- Currently affected scope: canonical Study ownership and nested-scope representation for all three registries. No partial Study rows were stored for these schema cases.
- Re-entry condition: represent each Study only after the Clinical Evidence contract supports a shared multi-asset or master-protocol anchor, or another authoritative row rule resolves one canonical owner without losing the registry's other focal configurations.
