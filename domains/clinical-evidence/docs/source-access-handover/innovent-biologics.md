---
companyId: innovent-biologics
status: active
lastCheckedAt: 2026-09-07
---

# Innovent Biologics Clinical Evidence source-access handover

## GLORY-1 / GLORY-2 / US Phase 2 (NCT06124807) shared registry identity with eli-lilly-and-company/ly3305677

- Company / asset / Studies: Innovent Biologics / mazdutide — NCT05607680 (GLORY-1), NCT06164873 (GLORY-2), NCT06124807 (US Phase 2, 3-6/10/16 mg)
- Highest-priority known source: https://clinicaltrials.gov/study/NCT05607680, https://clinicaltrials.gov/study/NCT06164873, https://clinicaltrials.gov/study/NCT06124807
- Access status: `DEFERRED_SCHEMA_CASE`
- Blocker: all three registry identities are already anchored to `eli-lilly-and-company/ly3305677` (Study ids `eli-lilly-and-company-mazdutide-glory-1-nct05607680`, `eli-lilly-and-company-mazdutide-glory-2-nct06164873`, `eli-lilly-and-company-mazdutide-nct06124807`), the licensor/originator's own development code for the same molecule. A `registry|id` must be globally unique across Studies (Entities and Rows; edge-cases.md "Clinical Evidence: multi-focal or external-asset study anchoring"), and storage ownership stays with the existing anchor by design, not scientific primacy.
- Confirmed scope: all three are genuine, in-scope obesity Studies with disclosed results (GLORY-1 body-weight results published in NEJM; GLORY-2 and the US Phase 2 have company topline/peer-reviewed data). Result availability is not in doubt.
- Currently affected scope: the entire canonical Study, its protocol Arms, Endpoints, and Outcomes for all three trials, from the `innovent-biologics/mazdutide` side specifically. The Eli Lilly-side records already carry this evidence.
- Re-entry condition: represent these three trials under `innovent-biologics/mazdutide` only if the contract adds a shared/multi-focal Study anchor, or another authoritative mapping rule reassigns single ownership (for example, splitting by sponsor-of-record rather than first-claimed identity) without losing the Eli Lilly-side coverage.
- Last checked: 2026-09-07

## DREAMS-2 (NCT05606913) conflicting body-weight and HbA1c figures across secondary sources — RESOLVED 2026-09-07

- Company / asset / Study: Innovent Biologics / mazdutide / NCT05606913 (DREAMS-2, mazdutide vs dulaglutide in T2D)
- Highest-priority known source: https://www.nature.com/articles/s41586-025-10031-z (peer-reviewed publication)
- Original blocker: three independently retrieved secondary sources reported mutually inconsistent per-arm Week 28 body-weight percent-change figures for the 4 mg and 6 mg arms, with the 4 mg/6 mg rank order swapped in one of them. None of these was opened and read directly at the primary-publication level, so no value could be entered without guessing between conflicting figures.
- Resolution: the user supplied the complete Nature article PDF directly. `FULL_SOURCE_REVIEWED`. All three secondary-source figures were superseded — the peer-reviewed treatment-policy-estimand values are 4 mg mazdutide −6.55%, 6 mg mazdutide −8.53%, dulaglutide −2.77% (Table 2), matching the figure the search-engine summary had attributed to this publication; the other two secondary figures were inaccurate. Full arm-level HbA1c, body-weight (percent and kg), composite (HbA1c<7.0% + ≥5% weight loss), responder (≥5%, ≥10% weight loss), and safety (serious adverse events, nausea, vomiting, anti-drug antibodies) Outcomes, plus between-arm least-squares mean differences vs dulaglutide, are now entered from Tables 1-3 and Extended Data Table 3.
- Last checked: 2026-09-07

Note: a user-supplied PDF titled "MEDI0382, phase 1" (Ambery et al., Br J Clin Pharmacol 2018, NCT02394314) is unrelated to mazdutide — MEDI0382 is AstraZeneca's cotadutide, a different molecule from a different company. See the exclusion recorded under `astrazeneca.md` instead; no mazdutide record was affected by this file.

## NCT04904913 Stage 2 (9 mg, BMI≥30 subgroup) — identity confirmed, outcomes still deferred (updated 2026-09-07)

- Company / asset / Study: Innovent Biologics / mazdutide / NCT04904913 (China Phase 2, same registry identity as the already-stored Stage 1 dose-ranging cohort)
- Confirmed: the "Mazdutide 9 mg in Chinese adults with BMI ≥30 kg/m² but without diabetes" publication (Med, 2026; PMID 41875890) reports a Stage 2 cohort (9 mg n=60, placebo n=20 by 3:1 randomization) of this same registry Study — the 80-participant gap between the registry's total enrollment (328) and Stage 1's own enrollment (248, already stored) matches this Stage 2 N exactly, and the registry's own eligibility text names a "second stage: BMI≥30 kg/m2" subgroup consistent with this publication's population. Stage 2 Arms (design only: dose, randomization ratio, N, duration) are now stored on the existing Study record.
- Still deferred: Stage 2's efficacy Outcomes (week 24 body-weight −12.78% vs placebo +1.80%, treatment difference −14.58% [95% CI −18.00, −11.16], responder rate 81.7%) are known only from search-engine-summarized figures, never opened and read directly at the Med/Cell Press page (HTTP 403 each attempt this run) — a search-result snippet is never `Reviewed` under this workflow's definition, so no value was entered.
- Access status: `SOURCE_IDENTIFIED_NOT_ACCESSED` (blocker `BOT_BLOCK`), source: https://www.cell.com/med/abstract/S2666-6340(26)00066-8 (also https://pubmed.ncbi.nlm.nih.gov/41875890/)
- Re-entry condition: obtain direct access to the Med article (PDF or a non-blocked mirror) and enter the source-reported arm-level values.

## Other untraversed candidate trials — identity or scope unconfirmed this run

- **Mazdutide (IBI362) Phase 1b in Chinese patients with type 2 diabetes** (NCT04466904; PMC9232612) — located by search but not fetched this run; in-scope status (whether body weight is a registered, non-incidental objective) not yet confirmed.
- **Mazdutide Phase 1b in Chinese adolescents with obesity** — a 2025 sponsor press release reports positive weight-loss results, but its registry identifier was not located this run.
- Re-entry condition for both: locate/confirm a verifiable registry identity and directly review a primary or company source before disposition.

## DREAMS-3 (NCT06184568) mazdutide dose correction (2026-09-07)

Not a deferred item — a data correction. The registry's own intervention-description text for the mazdutide arm is truncated at the source ("...continue to increase to IBI362.") and never states the target dose reached during the 32-week active-controlled period. Two independent secondary sources (a search-engine synthesis and the Purdue CDEK trial-database record's "study overview") both name 6 mg specifically; no source found contradicts this. The Arm's `dose`/`intervention`/`titration` fields were corrected from a vague "titrated to target dose" to "6 mg target dose" accordingly. This is below `FULL_SOURCE_REVIEWED` rigor (neither corroborating source is the trial's own design/rationale paper, which returned HTTP 403 each attempt), so treat with moderate rather than full confidence; the entered efficacy Outcomes (composite/weight/HbA1c topline percentages) are unaffected, since those came directly from the sponsor's own topline press release.

## Excluded — type 2 diabetes trials with no registered weight objective

Not a handover item (disposition is final, not deferred), recorded here for traceability: **DREAMS-1** (NCT05628311) and the earlier Phase 2 T2D trial published in *Diabetes Care* (NCT04965506) were excluded from Clinical Evidence. Both registries' own secondary-outcome lists contain no body-weight measure at all — only HbA1c, safety, and PK/PD — so body weight in either trial's sponsor-reported topline is not a prespecified Study objective under this workflow's Evidence Scope (README.md "T2D-only ... studies" / "body weight is incidental").
