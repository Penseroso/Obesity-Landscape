---
companyId: astrazeneca
status: active
lastCheckedAt: 2026-08-10
---

# AstraZeneca Clinical Evidence source-access handover

## Cotadutide result publications

- Company / asset / Studies: AstraZeneca / cotadutide / NCT02548585, NCT03235050, NCT03596177
- Highest-priority known sources:
  - NCT02548585: https://pubmed.ncbi.nlm.nih.gov/29856343/
  - NCT03235050: https://pubmed.ncbi.nlm.nih.gov/34016612/
  - NCT03596177: https://pubmed.ncbi.nlm.nih.gov/31665464/
- Access status: `SOURCE_IDENTIFIED_NOT_ACCESSED`
- Blocker: `BOT_BLOCK` (PubMed returned a reCAPTCHA page on 2026-08-10)
- Confirmed scope: registry identity, design, arms, and registry-posted results were reviewed. The registry directly supported and was used for the stored NCT03596177 body-weight outcome. Other registry-supported cotadutide body-weight outcomes were entered for NCT03244800, NCT03645421, and NCT03745937.
- Missing scope: publication-level completion check for primary/co-primary and central/key-secondary results, headline responder results, and concise safety reporting; reliable arm/outcome mapping for the unentered core results of NCT02548585 and NCT03235050.
- Fallback attempted: ClinicalTrials.gov study records and posted results. These support the stored registry outcomes but were not treated as proof of every publication result or publication-defined analysis context.
- Currently affected scope: result completeness for NCT02548585, NCT03235050, and publication-level safety completion for NCT03596177.
- Re-entry condition: open and review the complete peer-reviewed articles (and supplements where required), reconcile their analysis populations and arms to the registry records, then enter or explicitly disposition the four core result categories required by the Clinical Evidence workflow.

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
