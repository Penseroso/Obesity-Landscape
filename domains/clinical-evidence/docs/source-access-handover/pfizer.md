---
companyId: pfizer
status: active
lastCheckedAt: 2026-08-10
---

# Pfizer Clinical Evidence source-access handover

## Danuglipron peer-reviewed result completion and lotiglipron fallback

- Company / assets / Studies: Pfizer / PF-06882961 / NCT04617275, NCT04707313; Pfizer / PF-07081532 / NCT05579977
- Highest-priority known sources:
  - https://pubmed.ncbi.nlm.nih.gov/40539310/
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC11618248/
  - https://cdn.pfizer.com/pfizercom/clinical%20trials/csr%20synopsis/C3991004%20Public%20Disclosure%20Synopsis%20.pdf?VersionId=UKdMmTHVMeU6we4KcUiTx_zo3oT3a3A_
  - https://www.pfizer.com/news/press-release/press-release-detail/pfizer-announces-topline-phase-2b-results-oral-glp-1r
- Access status: `PARTIAL_SOURCE_REVIEWED`
- Blocker: `BOT_BLOCK` affected the full peer-reviewed articles on 2026-08-10. Pfizer's final C3991004 CSR and result summary were fully accessible as fallback sources for NCT05579977.
- Confirmed scope: registry identities, designs, protocol arms, and result availability were reviewed. ClinicalTrials.gov directly supports the stored NCT04617275 Week 12 body-weight results and the stored NCT04707313 Week 26/32 primary body-weight results, at-least-5% responder counts, serious adverse events, nausea, and vomiting with explicit registry-arm, timepoint, analysis-population, and estimand mapping. For NCT05579977, the Week 32 primary result was not estimable after early termination; the directly reported Week 20 obesity arm values and contrasts, serious adverse events, nausea, vomiting, and concise safety context were stored from ClinicalTrials.gov and Pfizer's final materials.
- Missing scope: publication-level completion for danuglipron analyses that are not independently reconstructable from the registry result tables. Pfizer's topline NCT04707313 release was reviewed as fallback, but its dose ranges were not used to overwrite or supplement individual-arm registry results. No lotiglipron result remains blocked where the final Pfizer CSR/result summary or registry supplied equivalent endpoint, timepoint, analysis-unit, population, and estimand support.
- Re-entry condition: review the complete danuglipron articles and supplements, reconcile their publication-specific populations and analyses to the stored registry arms, and enter only the remaining results whose focal arm and estimand can be mapped unambiguously.

## Berobenatide and MET-233i result mapping

- Company / assets / Studies: Pfizer / PF-08653944 / NCT06857617, NCT06712836, NCT06897202; Pfizer / PF-08653945 / NCT07022977
- Highest-priority known sources:
  - https://investors.metsera.com/news-releases/news-release-details/metsera-reports-highly-competitive-results-ongoing-trial-novel
  - https://investors.metsera.com/node/7046/pdf
  - https://www.pfizer.com/news/press-release/press-release-detail/robust-phase-2b-efficacy-and-favorable-tolerability-support
  - https://investors.metsera.com/node/6911/pdf
- Access status: `PARTIALLY_ACCESSED`
- Blocker: `ARM_MAPPING_UNRESOLVED`; the MET-233i investor PDF also returned an access denial.
- Confirmed scope: the trial inventories and registry-defined arms were stored. Exact Arm 1 and Arm 3 Week 28 VESPER-3 placebo-adjusted results were independently mappable and stored from Pfizer's official announcement.
- Missing scope: dose-specific results for the other listed studies cannot yet be attached faithfully because the current registry arms aggregate multiple doses or the accessible announcement does not expose the complete analysis table.
- Re-entry condition: obtain the complete official presentations or registry-posted results, confirm dose-level arm membership and analysis populations, then store only outcomes whose arm anchors are unambiguous.

## Shared multi-asset umbrella registries

- Company / Studies: Pfizer / NCT06924320, NCT07575932
- Access status: `DEFERRED_SCHEMA_CASE`
- Blocker: each registry contains multiple focal Pfizer assets and combination cohorts under one study identity; duplicating the Study beneath either asset would violate the canonical single-study storage rule.
- Confirmed scope: NCT06924320 includes MET233, MET097, and combination cohorts; NCT07575932 includes PF-08653945, PF-08653944, and combination cohorts.
- Re-entry condition: represent the studies only after the Clinical Evidence contract supports a shared multi-asset study anchor or another authoritative row rule resolves the canonical storage owner.
