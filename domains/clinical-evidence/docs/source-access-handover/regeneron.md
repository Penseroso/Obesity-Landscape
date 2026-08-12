---
companyId: regeneron
status: active
lastCheckedAt: 2026-08-12
---

# Regeneron Clinical Evidence source-access handover

## NCT03530514 Part B dose-schedule conflict

- Company / asset / Study: Regeneron / mibavademab / NCT03530514
- Highest-priority known source: https://pmc.ncbi.nlm.nih.gov/articles/PMC11003274/
- Access status: `FULL_SOURCE_REVIEWED`
- Blocker: the peer-reviewed publication is internally inconsistent. Its abstract, Figure 2, and Table 3 describe the 10 mg/kg intravenous maintenance doses as occurring at Weeks 3, 6, and 9, while the Figure 3 caption and related text describe Days 29, 50, and 71. ClinicalTrials.gov states only that Part B used repeated doses and does not resolve the exact numbered visits.
- Confirmed scope: Part B used a 15 mg/kg intravenous loading dose followed by 10 mg/kg intravenous dosing every 3 weeks. The canonical Arm retains this source-consistent cadence without selecting either conflicting set of numbered visits.
- Missing scope: the authoritative protocol-defined day or week numbers for the Part B maintenance doses.
- Fallback attempted: https://clinicaltrials.gov/study/NCT03530514; the registry does not disclose the exact schedule.
- Currently affected scope: exact numbered Part B administration visits only. The stored Week 12 efficacy Outcomes are unaffected.
- Re-entry condition: obtain the final protocol, statistical analysis plan, or another authoritative source that resolves the numbered administration visits.
- Last checked: 2026-08-12

## COURAGE shared-Regimen schema case

- Company / assets / Study: Regeneron / trevogrumab, garetosmab, and semaglutide / NCT06299098 (COURAGE)
- Highest-priority known source: https://clinicaltrials.gov/study/NCT06299098
- Access status: `DEFERRED_SCHEMA_CASE`
- Blocker: one registry Study contains trevogrumab monotherapy in Part A, trevogrumab plus semaglutide configurations, and trevogrumab plus garetosmab plus semaglutide configurations. The stored Company/Pipeline manifest represents the latter two combination scopes as separate Regimens, while the Clinical Evidence contract requires each Study to have exactly one focal `programId` xor `regimenId`.
- Confirmed scope: COURAGE is an in-scope obesity Study and Regeneron has publicly reported body-weight, fat-mass, and lean-mass results. The registry identity and result availability are not in doubt.
- Currently affected scope: the entire canonical Study, its protocol Arms, Endpoints, and Outcomes. No partial Study row is stored because assigning the shared registry to either Regimen would omit or misattribute the other focal configurations and the monotherapy Part.
- Re-entry condition: represent NCT06299098 only after the Clinical Evidence contract supports a shared multi-Regimen or multi-asset Study anchor, or another authoritative mapping rule resolves one canonical owner without losing the other focal configurations.
- Last checked: 2026-08-12
