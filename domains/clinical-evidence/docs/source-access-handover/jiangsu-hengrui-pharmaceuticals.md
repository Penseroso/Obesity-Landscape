---
companyId: jiangsu-hengrui-pharmaceuticals
status: active
lastCheckedAt: 2026-09-16
---

# Jiangsu Hengrui Pharmaceuticals Clinical Evidence source-access handover

## Phase 2 PMOS study (NCT06595797 / HRS9531-207) — deferred weight loss and responder outcomes

- Company / asset / Study: Jiangsu Hengrui Pharmaceuticals / ribupatide / NCT06595797 (HRS9531-207)
- Highest-priority known sources:
  - Jiangsu Hengrui Pharmaceuticals press release (2026-07-08): https://www.hengrui.com/en/media/detail-991.html ("Positive Topline Data from Phase 2 Trial (HRS9531-207) of Ribupatide Injection in Obesity With Polyendocrine-metabolic Ovarian Syndrome (PMOS)")
  - Kailera Therapeutics Q2 2026 financial results & corporate update (2026-08-12): https://investors.kailera.com/
- Access status: `PARTIAL_SOURCE_REVIEWED`
- Blocker: `ARM_MAPPING_UNRESOLVED`
  - Hengrui's July 8, 2026 press release reports headline efficacy statements: a "mean weight loss of up to 20.2%" (treatment-policy estimand) and "97.5% of participants achieved >= 5% weight loss from baseline" at Week 32 across the trial.
  - Kailera's August 12, 2026 corporate update additionally cites an efficacy estimand mean weight loss of "up to 21.2%" at Week 32.
  - Neither release provides an arm-by-arm breakdown of weight reduction across the three active dose cohorts (1 mg, 2 mg, 4 mg) and placebo. Only the exploratory/secondary menstrual frequency endpoint is explicitly attributed to a specific arm (+0.9 cycles in the 4 mg cohort).
  - Attribution of the "up to 20.2%" or "up to 21.2%" figure to the 4 mg arm is an unverified assumption (over-attribution).
  - Modeling the result as a `pooled` AnalysisGroup across 1 mg, 2 mg, and 4 mg is also an unverified semantic inference: "up to X%" represents a cohort upper bound (peak dose cohort), not a combined pooled mean across all participants.
- Confirmed scope:
  - Trial design: Phase 2, multicenter, randomized, double-blind, placebo-controlled trial evaluating once-weekly subcutaneous ribupatide (1 mg, 2 mg, 4 mg) vs placebo for 32 weeks in Chinese women with obesity and polyendocrine-metabolic ovarian syndrome (PMOS/PCOS).
  - Inventory and protocol-defined arms (1 mg, 2 mg, 4 mg, placebo) are canonicalized under `Study` and `Arm`.
  - Safety profile: Ribupatide was well-tolerated with predominantly mild gastrointestinal adverse events.
- Deferred scope:
  - Week 32 percentage body weight reduction (treatment-policy estimand "up to 20.2%", efficacy estimand "up to 21.2%").
  - Week 32 responder proportion (>= 5% weight loss: "97.5%").
- Re-entry condition:
  - Obtain full conference presentation (e.g. ADA/EASD/ENDO poster or slide presentation), peer-reviewed journal publication, or registry results posting on ClinicalTrials.gov that provides numerical arm-level values or an explicitly reported pooled analysis set for each dose cohort.
  - Once arm membership or pooled analysis definitions are verified, author canonical `Outcome` records anchored to the verified arm(s) or analysis group.
- Last checked: 2026-09-16.
