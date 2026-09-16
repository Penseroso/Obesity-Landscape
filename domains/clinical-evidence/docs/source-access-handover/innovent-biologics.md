---
companyId: innovent-biologics
status: active
lastCheckedAt: 2026-09-07
---

# Innovent Biologics Clinical Evidence source-access handover

## GLORY-1 / GLORY-2 (NCT05607680, NCT06164873) and US Phase 2 (NCT06124807) — RESOLVED 2026-09-16

- Company / asset / Studies: Innovent Biologics / mazdutide — NCT05607680 (GLORY-1), NCT06164873 (GLORY-2), NCT06124807 (US Phase 2, 3-6/10/16 mg)
- Resolution: Under ADR-0071 sponsor-resolution cascade, GLORY-1 (NCT05607680) and GLORY-2 (NCT06164873) have Innovent Biologics as registry lead sponsor and match Innovent's `mazdutide` asset anchor. Both trials and their complete arm, endpoint, and outcome hierarchies were migrated to `innovent-biologics/mazdutide` (`innovent-biologics-mazdutide-glory-1-nct05607680` and `innovent-biologics-mazdutide-glory-2-nct06164873`). Reciprocally under ADR-0074, Eli Lilly's `ly3305677` records `foreignStudyDispositions` for NCT05607680/NCT06164873, and Innovent's `mazdutide` records `foreignStudyDispositions` for Lilly-owned NCT06124807. NCT06124807 has Eli Lilly as lead sponsor and legitimately remains anchored under `eli-lilly-and-company/ly3305677`.
- Last checked: 2026-09-16

## DREAMS-2 (NCT05606913) conflicting body-weight and HbA1c figures across secondary sources — RESOLVED 2026-09-07

- Company / asset / Study: Innovent Biologics / mazdutide / NCT05606913 (DREAMS-2, mazdutide vs dulaglutide in T2D)
- Highest-priority known source: https://www.nature.com/articles/s41586-025-10031-z (peer-reviewed publication)
- Original blocker: three independently retrieved secondary sources reported mutually inconsistent per-arm Week 28 body-weight percent-change figures for the 4 mg and 6 mg arms, with the 4 mg/6 mg rank order swapped in one of them. None of these was opened and read directly at the primary-publication level, so no value could be entered without guessing between conflicting figures.
- Resolution: the user supplied the complete Nature article PDF directly. `FULL_SOURCE_REVIEWED`. All three secondary-source figures were superseded — the peer-reviewed treatment-policy-estimand values are 4 mg mazdutide −6.55%, 6 mg mazdutide −8.53%, dulaglutide −2.77% (Table 2), matching the figure the search-engine summary had attributed to this publication; the other two secondary figures were inaccurate. Full arm-level HbA1c, body-weight (percent and kg), composite (HbA1c<7.0% + ≥5% weight loss), responder (≥5%, ≥10% weight loss), and safety (serious adverse events, nausea, vomiting, anti-drug antibodies) Outcomes, plus between-arm least-squares mean differences vs dulaglutide, are now entered from Tables 1-3 and Extended Data Table 3.
- Last checked: 2026-09-07

Note: a user-supplied PDF titled "MEDI0382, phase 1" (Ambery et al., Br J Clin Pharmacol 2018, NCT02394314) is unrelated to mazdutide — MEDI0382 is AstraZeneca's cotadutide, a different molecule from a different company. See the exclusion recorded under `astrazeneca.md` instead; no mazdutide record was affected by this file.

## NCT04904913 Stage 2 (9 mg, BMI≥30 subgroup) — RESOLVED 2026-09-07

- Company / asset / Study: Innovent Biologics / mazdutide / NCT04904913 (China Phase 2, same registry identity as the already-stored Stage 1 dose-ranging cohort)
- Highest-priority known source: https://doi.org/10.1016/j.medj.2026.101063 (Ji et al., Med 2026)
- Resolution: the user supplied the complete Med (Cell Press) PDF directly. `FULL_SOURCE_REVIEWED`. Confirms this is Stage 2 of NCT04904913 ("the second part of a multi-centre, randomized, double-blind, placebo-controlled phase 2 study (NCT04904913)... The enrollment, operation, and data analysis of these two parts were independent"), matching the earlier identity inference (enrollment gap and eligibility text) exactly. Full Stage 2 data now entered: primary endpoint (percentage body-weight change, ANCOVA+LOCF, Week 24: mazdutide 9 mg −12.78% vs placebo +1.80%, ETD −14.58% [95% CI −18.00, −11.16], p<0.0001), absolute weight change (kg), responder rates at the ≥5/10/15/20% thresholds, and safety (serious adverse events, nausea, vomiting, anti-drug antibodies) from the paper's Tables 2 and 4.
- Not entered: the voluntary, non-randomized 24-week extension data (Week 48/60), since the paper's own Limitations section flags a real bias risk from non-random continuation, and it is exploratory rather than confirmatory; could be added in a future run if needed.
- Last checked: 2026-09-07

## Other untraversed candidate trials — identity or scope unconfirmed this run

- **Mazdutide (IBI362) Phase 1b in Chinese patients with type 2 diabetes** (NCT04466904; PMC9232612) — located by search but not fetched this run; in-scope status (whether body weight is a registered, non-incidental objective) not yet confirmed.
- **Mazdutide Phase 1b in Chinese adolescents with obesity** — a 2025 sponsor press release reports positive weight-loss results, but its registry identifier was not located this run.
- Re-entry condition for both: locate/confirm a verifiable registry identity and directly review a primary or company source before disposition.

## DREAMS-3 (NCT06184568) mazdutide dose correction (2026-09-07)

Not a deferred item — a data correction. The registry's own intervention-description text for the mazdutide arm is truncated at the source ("...continue to increase to IBI362.") and never states the target dose reached during the 32-week active-controlled period. Two independent secondary sources (a search-engine synthesis and the Purdue CDEK trial-database record's "study overview") both name 6 mg specifically; no source found contradicts this. The Arm's `dose`/`intervention`/`titration` fields were corrected from a vague "titrated to target dose" to "6 mg target dose" accordingly. This is below `FULL_SOURCE_REVIEWED` rigor (neither corroborating source is the trial's own design/rationale paper, which returned HTTP 403 each attempt), so treat with moderate rather than full confidence; the entered efficacy Outcomes (composite/weight/HbA1c topline percentages) are unaffected, since those came directly from the sponsor's own topline press release.

## Excluded — type 2 diabetes trials with no registered weight objective

Not a handover item (disposition is final, not deferred), recorded here for traceability: **DREAMS-1** (NCT05628311) and the earlier Phase 2 T2D trial published in *Diabetes Care* (NCT04965506) were excluded from Clinical Evidence. Both registries' own secondary-outcome lists contain no body-weight measure at all — only HbA1c, safety, and PK/PD — so body weight in either trial's sponsor-reported topline is not a prespecified Study objective under this workflow's Evidence Scope (README.md "T2D-only ... studies" / "body weight is incidental").
