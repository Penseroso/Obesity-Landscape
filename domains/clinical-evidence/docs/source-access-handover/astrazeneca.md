---
companyId: astrazeneca
status: active
lastCheckedAt: 2026-09-07
---

# AstraZeneca Clinical Evidence source-access handover

## Cotadutide NAFLD/NASH (PROXYMO, NCT04019561) and diabetic kidney disease (NCT04515849) body-weight outcomes — RESOLVED 2026-09-07

- Company / asset / Studies: AstraZeneca / cotadutide / NCT04019561 (PROXYMO), NCT04515849
- Highest-priority known sources: https://doi.org/10.1016/j.cgh.2024.04.017 (NCT04019561, peer-reviewed); https://doi.org/10.1016/j.kint.2024.08.023 (NCT04515849, peer-reviewed)
- Resolution: the user supplied both complete peer-reviewed PDFs directly. `FULL_SOURCE_REVIEWED` for both.
  - NCT04019561: absolute body-weight change (kg, between-arm vs placebo, Week 19, ITT, from Supplementary Table 5) now entered — 300 mcg −0.44 kg (95% CI −2.78 to 1.90), 600 mcg −2.36 kg (95% CI −4.71 to −0.002, P=.05). The peer-reviewed paper does not report percent body-weight change; the previously entered ClinicalTrials.gov registry-posted percent figures (arm-level and between-arm) remain stored as the best available source for that specific metric. Safety (SAE, nausea, vomiting) entered per-arm from Table 2, using the as-treated population sizes stated in the paper's own text and disposition figure (300 mcg n=26, 600 mcg n=24, placebo n=24) rather than Table 2's own column header, which states "n=25" for 600 mcg — an internal inconsistency in the source itself, noted in the Study's `safetySummary` rather than silently reconciled.
  - NCT04515849: percent body-weight change at Week 26 (LS mean vs baseline) entered for placebo (−2.1%), 300 mcg (−6.0%), 600 mcg (−6.5%), and semaglutide (−7.0%) from the peer-reviewed publication text/Figure 3, superseding the earlier registry-posted figures for these four arms (final published analysis over initially posted topline, both from ITT, per this workflow's authority + recency guidance). The paper does not give a 100 mcg number in text, so the registry-posted figure (−2.60%) remains that arm's best available source. Between-arm significance is stated by the paper (P<0.001 for both 300 mcg and 600 mcg vs placebo) without a directly reported effect-size/CI for the comparison itself, so no between-arm Outcome was created for it — entering only a p-value with no accompanying estimate was judged not to be a faithful result record. Safety (SAE, nausea, vomiting) entered per-arm from Table 3; that table's own printed n for the 100 mcg arm (55) exceeds the paper's own randomized n (52) stated elsewhere — again an internal inconsistency, entered as printed and flagged in `safetySummary` rather than reconciled.
- Not entered: NCT04515849's UACR renal primary/co-primary endpoint (outside this dataset's body-weight-defined scope; a renal-domain Endpoint could be added in a future run if desired, but is not required by the completion check for this asset's inclusion basis).
- Last checked: 2026-09-07

## Excluded — MEDI0382 first-in-human Phase 1 (NCT02394314), healthy volunteers

Not a handover item (disposition is final, not deferred), recorded here for traceability: this single-ascending-dose Phase 1 study (Ambery et al., Br J Clin Pharmacol 2018) enrolled healthy volunteers (BMI 22-30 kg/m2, not an obesity/overweight-qualifying criterion) with a safety/tolerability primary objective and PK/immunogenicity secondary objectives; body weight was not measured as an efficacy endpoint (only exploratory food-intake and glucose measures were reported). Excluded under this workflow's Evidence Scope ("healthy-volunteer PK studies without an explicit obesity or weight-management objective").

## Excluded — PROXYMO-ADV (NCT05364931), no registered weight objective

Not a handover item (disposition is final, not deferred), recorded here for traceability: this later, larger cotadutide MASH proof-of-concept trial (54 participants, same 300/600 mcg dosing) registers only safety, vital-signs, laboratory, ECG, and immunogenicity outcomes — no body-weight or BMI measure appears among its primary or secondary outcomes. Excluded under this workflow's Evidence Scope (MASH-only, weight not a registered Study objective), consistent with the same reasoning already applied to DREAMS-1 and NCT04965506 for Innovent's mazdutide.

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
