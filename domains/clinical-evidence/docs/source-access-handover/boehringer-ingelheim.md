---
companyId: boehringer-ingelheim
status: active
lastCheckedAt: 2026-08-11
---

# Boehringer Ingelheim Clinical Evidence source-access handover

## Survodutide Phase 1 dose-schedule result mapping

- Company / asset / Study: Boehringer Ingelheim / survodutide / NCT03591718
- Highest-priority known source: https://doi.org/10.1111/dom.14948
- Access status: `PARTIAL_SOURCE_REVIEWED`
- Blocker: `SUPPLEMENT_UNAVAILABLE`; the accessible publication text reports headline placebo-corrected body-weight changes, but the detailed dose-escalation schedule table needed to map each value to a canonical protocol Arm was not available.
- Confirmed scope: the registry Study and its seven active dose-schedule Arms plus placebo are stored. The publication supports a maximum placebo-corrected mean body-weight change of -5.79% at Week 6 in Part A and -13.8% at Week 16 for dose schedule 7 in Part B, along with concise safety context.
- Missing scope: exact dose-schedule definitions and the complete arm-level analysis context needed to store those efficacy values without guessing.
- Fallback attempted: the ClinicalTrials.gov record was reviewed, but it has no posted structured results that resolve the missing arm mapping.
- Currently affected scope: quantitative body-weight Outcomes for NCT03591718 only.
- Re-entry condition: obtain the publication's detailed schedule table or supporting information, then enter only Outcomes whose protocol Arm, timepoint, population, and estimand map unambiguously.

## Shared BI 1820237 combination studies

- Company / Studies: Boehringer Ingelheim / NCT05751226, NCT06352424
- Access status: `DEFERRED_SCHEMA_CASE`
- Blocker: the checked-out Company/Pipeline manifest has no BI 1820237 asset/Program anchor. NCT06352424 also contains survodutide monotherapy, BI 1820237 monotherapy, and combination cohorts under one registry identity, which cannot be assigned canonically to a single focal asset without losing or misattributing study scope.
- Confirmed scope: both registry records were reviewed during broad obesity and weight-management traversal; neither was silently treated as a survodutide-only Study.
- Currently affected scope: canonical Study ownership and Arm representation for the two combination registries.
- Re-entry condition: represent these Studies only after a valid BI 1820237 Company/Pipeline anchor exists and the Clinical Evidence contract or an authoritative row rule resolves ownership of shared multi-asset registries.
