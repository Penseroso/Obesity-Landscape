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

## DREAMS-2 (NCT05606913) conflicting body-weight and HbA1c figures across secondary sources

- Company / asset / Study: Innovent Biologics / mazdutide / NCT05606913 (DREAMS-2, mazdutide vs dulaglutide in T2D)
- Highest-priority known source: https://www.nature.com/articles/s41586-025-10031-z (peer-reviewed publication)
- Access status: `SOURCE_IDENTIFIED_NOT_ACCESSED` (paywalled; blocker `PAYWALL`)
- Blocker: three independently retrieved secondary sources reported mutually inconsistent per-arm Week 28 body-weight percent-change figures for the 4 mg and 6 mg arms, with the 4 mg/6 mg rank order swapped in one of them (a directly fetched EASD 2024 topline release gave 4 mg −9.24%/6 mg −7.13%; an earlier search summary gave 4 mg −7.31%/6 mg −9.24%; a search-engine summary attributed to the Nature publication's adjusted LS-mean, treatment-policy estimand gave 4 mg −6.55%/6 mg −8.53%). None of these was opened and read directly at the primary-publication level — a search-result snippet is never `Reviewed` under this workflow's definition — so no value could be entered without guessing between conflicting figures.
- Confirmed scope: the Study itself, its registry design (4 mg / 6 mg mazdutide vs dulaglutide 1.5 mg, 28 weeks, N=731), and its in-scope status (body weight is a registered secondary outcome, not incidental) are stored. HbA1c primary-endpoint figures are similarly unresolved for the same reason.
- Missing scope: arm-level body-weight and HbA1c Outcomes.
- Fallback attempted: the EASD 2024 sponsor press release (https://www.prnewswire.com/apac/news-releases/head-to-head-superiority-over-dulaglutide-innovents-phase-3-clinical-trial-dreams-2-of-mazdutide-in-chinese-patients-with-type-2-diabetes-were-orally-presented-at-easd-2024-302244860.html) was directly fetched but its dose-arm attribution could not be reconciled with the other two sources; not used as fallback given the risk of misattributing a value to the wrong dose.
- Currently affected scope: DREAMS-2 body-weight and HbA1c Outcomes only. The Study inventory record itself is stored and complete.
- Re-entry condition: obtain and directly read the Nature publication (or another primary source) to confirm which arm-level figures are correct, then enter the reconciled values.
- Last checked: 2026-09-07

## Untraversed candidate trials — identity or scope unconfirmed this run

- **Mazdutide 9 mg in Chinese adults with BMI ≥30 kg/m² without diabetes** (Med, 2026; PubMed 41875890) — a company topline/registry search located this trial but its registry identifier could not be confirmed (PubMed and ScienceDirect/Cell abstract pages returned only cookie-consent/403 responses this run); it may be the same registry record as NCT04904913's unreviewed Stage 2 cohort or a separate trial. Not stored without a verified registry identity. Access status: `SOURCE_IDENTIFIED_NOT_ACCESSED` (blocker `BOT_BLOCK`).
- **Mazdutide (IBI362) Phase 1b in Chinese patients with type 2 diabetes** (NCT04466904; PMC9232612) — located by search but not fetched this run; in-scope status (whether body weight is a registered, non-incidental objective) not yet confirmed.
- **Mazdutide Phase 1b in Chinese adolescents with obesity** — a 2025 sponsor press release reports positive weight-loss results, but its registry identifier was not located this run.
- Re-entry condition for all three: locate/confirm a verifiable registry identity and directly review a primary or company source before disposition.

## Excluded — type 2 diabetes trials with no registered weight objective

Not a handover item (disposition is final, not deferred), recorded here for traceability: **DREAMS-1** (NCT05628311) and the earlier Phase 2 T2D trial published in *Diabetes Care* (NCT04965506) were excluded from Clinical Evidence. Both registries' own secondary-outcome lists contain no body-weight measure at all — only HbA1c, safety, and PK/PD — so body weight in either trial's sponsor-reported topline is not a prespecified Study objective under this workflow's Evidence Scope (README.md "T2D-only ... studies" / "body weight is incidental").
