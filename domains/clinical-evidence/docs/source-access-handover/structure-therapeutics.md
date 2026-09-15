---
companyId: structure-therapeutics
status: active
lastCheckedAt: 2026-09-15
---

# Structure Therapeutics Clinical Evidence source-access handover

## Phase 1 "SWITCH" study - registry identity not located

- Company / asset: Structure Therapeutics / aleniglipron (GSBR-1290)
- Access status: `SOURCE_NOT_LOCATED` (for ClinicalTrials.gov registry identifier)
- Trial confirmation: Re-verified via Structure Therapeutics primary SEC filings and investor presentations as a distinct Phase 1 clinical trial evaluating the transition of patients from an approved injectable GLP-1 receptor agonist to once-daily oral aleniglipron.
- Confirmed scope:
  - Transition from injectable GLP-1RA to oral aleniglipron
  - Evaluation of multiple starting doses
  - 12-week weight-maintenance assessment
  - Topline results anticipated in Q4 2026
- Blocker / Missing scope: No ClinicalTrials.gov identifier (or other primary registry record) has been publicly identified after searching ClinicalTrials.gov terms, sponsor filings, and public pipeline listings. Per the Evidence Scope contract, a canonical Study record requires a verifiable registry identity; therefore, no canonical Study is created.
- Re-entry condition: Locate a ClinicalTrials.gov NCT identifier or primary registry record for the SWITCH trial when posted or cited in corporate updates (e.g., Q4 2026 topline release).
- Re-verified 2026-09-15: re-checked the 2026-08-06 Q2 2026 earnings release (Exhibit 99.1) - SWITCH trial description is unchanged and consistent with the confirmed scope above; still no registry identifier. A deterministic registry-discovery preflight (ClinicalTrials.gov term/sponsor/intervention search) also surfaced no new GSBR-1290-sponsored trial matching this design (it flagged only NCT05893043, an unrelated, already-excluded healthy-volunteer PK study - see Evidence Scope exclusions).
- Last checked: 2026-09-15.

## ACCESS (NCT06693843) Week 72 Open-Label Extension responder rates - deferred cohorts

- Company / asset: Structure Therapeutics / aleniglipron (GSBR-1290)
- Study: ACCESS (NCT06693843)
- Highest-priority known source: Exhibit 99.2 investor presentation, SEC accession 0001104659-26-105688, filed 2026-09-08 - https://www.sec.gov/Archives/edgar/data/1888886/000110465926105688/tm2624945d1_ex99-2.htm (Slide 22, "Aleniglipron Achieved Significant Responder Rates at Week 72 in ACCESS OLE"). The companion Exhibit 99.1 press release (same accession, tm2624945d1_ex99-1.htm) is Study-level/narrative support only - it contains one pooled, qualitative sentence ("more than one-third of participants in the 90 mg and 120 mg cohorts... exceeded 20% body weight reduction") and does not itself directly support any single-cohort responder percentage.
- Access status: `PARTIAL_SOURCE_REVIEWED` - Slide 22's text block was read directly; the slide's accompanying bar chart (image `ex99-2img022.jpg`, covering the other three cohorts) could not be opened (SEC EDGAR bot-block on direct image fetch) and, per the contract, a chart/bar-height reading would not be usable evidence even if opened.
- Disclosed and canonicalized: the 120 mg-origin cohort transitioning to 180 mg (`s3-120mg-ole`) has a directly quoted text statement on Slide 22, giving whole-number responder rates at Week 72:
  - >=10% weight loss: 77% (`o-s3-responder10-ole-wk72-120mg`)
  - >=15% weight loss: 60% (`o-s3-responder15-ole-wk72-120mg`)
  - >=20% weight loss: 36% (`o-s3-responder20-ole-wk72-120mg`)
  (An earlier pass had stored decimal-precision values - 76.7%/59.6%/36.3% - sourced to Exhibit 99.1; those were not text/table-supported by either exhibit and have been corrected to the whole-number values Slide 22 actually states, re-sourced to Exhibit 99.2.)
- Deferred scope:
  - 90 mg-origin, 45 mg-origin, and placebo-rollover cohorts: Slide 22's chart displays series for all three, but no accompanying text block gives their numeric values - only the 120 mg-origin series has a parallel text statement. Per the contract, values shown only in a chart/graph are not entered (no visual transcription, no bar-height reading, no denominator or ratio back-calculation).
- Re-entry condition: a future disclosure that states the 90 mg-origin, 45 mg-origin, or placebo-rollover Week-72 responder rates in readable text or table form (a detailed data appendix, a subsequent presentation with per-cohort text, or a peer-reviewed manuscript).
- Last checked: 2026-09-15.
