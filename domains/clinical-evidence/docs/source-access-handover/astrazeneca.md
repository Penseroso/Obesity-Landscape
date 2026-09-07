---
companyId: astrazeneca
status: active
lastCheckedAt: 2026-09-07
---

# AstraZeneca Clinical Evidence source-access handover

## Cotadutide NAFLD/NASH (PROXYMO, NCT04019561) and diabetic kidney disease (NCT04515849) body-weight outcomes

- Company / asset / Studies: AstraZeneca / cotadutide / NCT04019561 (PROXYMO), NCT04515849
- Highest-priority known sources:
  - NCT04019561: https://www.cghjournal.org/article/S1542-3565(24)00424-5/fulltext (peer-reviewed publication); https://s3.amazonaws.com/ctr-med-7111/D5671C00002/a7e025dc-807a-4619-91f1-e5cdf18d7fb1/d6bab666-5827-4a9b-8ac9-d80c66895271/d5671c00002-CSR-synopsis_-_Redacted_-_31Mar2022-v1.pdf (regulatory filing)
  - NCT04515849: https://www.kidney-international.org/article/S0085-2538(24)00629-X/fulltext (peer-reviewed publication)
- Access status: `SOURCE_IDENTIFIED_NOT_ACCESSED` (NCT04019561, blocker `PAYWALL`); `PARTIAL_SOURCE_REVIEWED` (NCT04515849)
- Blocker: for NCT04019561, the AstraZeneca CSR synopsis was directly opened and read (`FULL_SOURCE_REVIEWED` for that document specifically), but its body-weight and BMI result values are redacted as confidential commercial information ("CCI") — it confirms only that a nominal LS-mean reduction was seen for both dose arms versus placebo, with no numeric value; the Clinical Gastroenterology and Hepatology peer-reviewed publication that would carry the number returned HTTP 403. For NCT04515849, the Kidney International peer-reviewed publication also returned HTTP 403; the only located body-weight figure is a PK/PD-model-predicted value (−5.3% at 600 mcg vs placebo, Week 26) from a secondary modeling paper, which is a derived/recalculated figure the contract does not permit entering as a direct result.
- Confirmed scope: both Studies, their registry design, population, and randomized N (NCT04019561: n=25/25/24 for 300 mcg/600 mcg/placebo) are stored. NCT04019561's hepatic-fat-fraction, ALT, and AST key secondary results and its qualitative safety summary are confirmed from the CSR synopsis. NCT04515849's UACR renal-outcome topline (statistically significant at 300 mcg and 600 mcg vs placebo by Week 14) is known but not yet entered pending a directly reviewed primary source, since it is outside this handover's immediate body-weight focus.
- Missing scope: NCT04019561 and NCT04515849 arm-level, directly reported (not model-predicted) body-weight Endpoint/Outcome values.
- Fallback attempted: none accepted — the CSR synopsis redaction and the PK/PD-model figure were each evaluated and rejected as insufficient per-result evidence rather than substituted.
- Currently affected scope: the body-weight Outcome for both Studies only (and, for NCT04515849, the UACR renal Outcome, not yet attempted).
- Re-entry condition: obtain direct access to the Clinical Gastroenterology and Hepatology article (NCT04019561) or the Kidney International article (NCT04515849) and enter the source-reported, non-modeled arm-level values.
- Last checked: 2026-09-07

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
