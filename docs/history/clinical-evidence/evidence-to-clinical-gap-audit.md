---
role: historical-audit
status: historical
authority: non-authoritative
update-boundary: Frozen point-in-time audit; do not update for current implementation changes.
---

# Clinical Evidence — Evidence-to-Clinical Gap Audit

Date: 2026-07-14. Schema: Clinical Evidence v3.0 (ADR-0039). Contract: Company/Pipeline 1.1
(ADR-0030). Scope: v1.1 obesity/incretin landscape (ADR-0026).

This is a **verification-and-entry record**, not a contract change and not an ADR. It resolves
the candidate set left open by
[`clinical-evidence-v3-migration-audit.md`](./v3-migration-audit.md).

## Boundary

An **evidence-led local audit**, not a Clinical Evidence research run and not an external
discovery pass:

- **In scope:** clinical trials already indicated by the repository's own Pipeline evidence —
  the NCT identifiers cited in `data/companies/**` `metadata.sources[].url`. That citation is
  the only slot a trial identifier can occupy in the Company/Pipeline contract; there is no
  `notes`, `trials`, or `nctIds` field in the Program or Regimen schema.
- **Out of scope:** searching for trials *not* already cited by Pipeline evidence. No
  unrestricted per-asset trial search was performed.
- **Company/Pipeline data was not modified.** Discrepancies are reported below for a future
  Company/Pipeline refresh, never written (workflow §9).
- Company/Pipeline Research was **not** re-run first. This follows the ADR-0039 migration
  pattern ("audit local Pipeline registry IDs and explicit mappings first, verify only
  high-confidence or stale/ambiguous candidates, add only high-confidence inventory records"),
  not the combined Clinical Evidence research route.

## Method

1. **Extract.** Every NCT identifier cited by a Program or Regimen `metadata.sources[]` entry.
   **74 unique identifiers**, matching the count recorded in the v3 migration audit.
2. **Compare.** Against `registryIdentifiers` on existing Studies. 3 were already represented
   (ATTAIN-PAD, TRIUMPH-4, ZUPREME); **71 were not**.
3. **Verify.** Each of the 71 was fetched from the ClinicalTrials.gov API v2
   (`/api/v2/studies/<NCT>`) on 2026-07-14. All 71 resolved; no source-access failures. Official
   title, acronym, sponsor protocol identifiers, `overallStatus`, last-update-posted date, phase,
   design, arm groups and enrolled conditions were taken from that record. **No candidate was
   mapped from asset name, indication, acronym/title, comparator relationship, or source URL
   alone.**
4. **Classify.** Every candidate ends as entered, excluded, or deferred. Nothing was silently
   dropped.

### Scope gate

The Evidence-scope test in [`clinical-evidence/README.md`](../../clinical-evidence/README.md) was
applied **per study, against the registry record** — not against the anchoring Program's
`indications`. A Study is entered only where its own enrolled population or explicit objective
includes obesity, overweight, or weight management. Comorbidity-only, T2D-only, MASH-only and
healthy-volunteer-PK trials are excluded even when the asset itself is an in-scope obesity asset.

The gate discriminates on real differences, not labels. Two structurally similar cardiovascular
outcome trials of in-scope obesity assets fall on opposite sides:

- **TRIUMPH-Outcomes** (`NCT06383390`) enrols "Participants With Body Mass Index ≥27 kg/m2 and
  Atherosclerotic Cardiovascular Disease and/or Chronic Kidney Disease" → **entered**.
- **ATTAIN-Outcomes** (`NCT07241390`) enrols on ASCVD/CKD with **no** obesity, overweight or BMI
  criterion → **excluded**.

## Disposition

| Bucket | Count |
|---|---|
| Already represented before this audit | 3 |
| **Entered** — inventory Study (Study + Arms, no Outcome) | **42** |
| **Excluded** — outside Scope v1.1 | **27** |
| **Deferred** — no valid anchor | **2** |
| **Total cited identifiers reconciled** | **74** |

Resulting inventory: **77 Studies** — 33 result-bearing, 44 inventory-only.

## Anchoring decisions

- **Explicit mapping only.** Every entered Study carries exactly one `programId` **xor**
  `regimenId`, taken from the Pipeline record that cited the trial.
- **Regimen-anchored Studies (9).** Combination trials anchor to their Regimen and are stored in
  the file of the regimen's in-house component asset (e.g. TOGETHER-PsO → `regimenId`
  `…-ixekizumab-tirzepatide-plaque-psoriasis-obesity`, stored under `ly3298176`). Partner
  components that do not resolve to a registry asset carry no `linkedAsset`.
- **`NCT07215559` / `NCT07589608` (macupatide + eloralintide).** `NCT07215559` is cited by *both*
  the macupatide Program and the macupatide–eloralintide Regimen, but the schema permits exactly
  one anchor. Both are anchored to the **Regimen** — the "alone or in combination" design is
  precisely ADR-0033's regimen test. Both assets are preserved through arm-level `linkedAsset`
  rather than by duplicating the Study anchor.
- **`NCT07165028` (SYNERGY-Outcomes).** Not entered. Classified **primarily as an Evidence Scope
  exclusion** (MASLD-only population). Separately, and independently of scope, its single
  master-protocol registry identity is shared across two focal assets (tirzepatide and
  retatrutide), which is **not representable** under the single-anchor storage model (ADR-0034,
  `edge-cases.md`). No surrogate registry identifier was invented and the schema was not changed.

## Schema boundary report

| Status | Count | Cases |
|---|---|---|
| `DEFERRED_SCHEMA_CASE` | 1 | `NCT07165028` — shared master-protocol registry identity across two focal assets. Not representable; also excluded on scope. Re-entry trigger: a schema extension supporting master-protocol sub-study identity or multi-focal anchoring. |
| `REVIEW_REQUIRED` | 1 | `NCT06345066` — a tirzepatide + eloralintide combination study cited by Pipeline on the **eloralintide monotherapy** Program row. Entered under that explicit mapping (no mapping was inferred), but under ADR-0032 rule 2 / ADR-0033 it is combination evidence and the mapping is a candidate for re-classification to the eloralintide–tirzepatide Regimen. |
| `RESEARCH_BLOCKED` | 0 | — |

## Pipeline discrepancies to report

Reported, **not** corrected — Clinical Evidence never edits Company/Pipeline data. Each warrants
review in a future Company/Pipeline refresh:

1. **Programs whose only cited trial is out of Scope v1.1.** The ATTAIN-Outcomes Program
   (`…-ly3502970-oral-tablets-attain-outcomes`, indications *Cardiovascular disease; Chronic
   kidney disease*) cites only `NCT07241390`, which has no obesity/overweight enrolment
   criterion. ADR-0026 lists CV/CKD-comorbidity-only programs as **v2-deferred**. The same
   applies to the IcoSema, pediatric-diabetes, CagriSema-T2D, amycretin-T2D and Triple-T2D
   Programs (all T2D-only), and to the ten brenipatide Programs in psychiatric, GI and
   respiratory indications.
2. **Duplicate trial citation across mapping kinds.** `NCT07215559` is cited by both a Program
   and a Regimen. Resolved here to the Regimen; the duplicate Program citation remains in
   Pipeline data.
3. **One master protocol cited by two Programs.** `NCT07165028` is cited by both the tirzepatide
   and retatrutide MASLD Programs.
4. **Combination trial on a monotherapy Program row.** `NCT06345066` — see `REVIEW_REQUIRED`
   above.

## Deferred — no valid anchor

Both are **in scope on population** but have no valid host: the asset-scoped file layout requires
a `companyId`/`assetId` that resolves to a Pipeline Program, and neither regimen has an in-house
component carrying one. No asset was assigned by guess.

| Registry ID | Regimen | Reason |
|---|---|---|
| `NCT05616013` | `eli-lilly-and-company-bimagrumab-semaglutide-obesity` | Both components (bimagrumab, semaglutide) are modelled as external; no in-house component has a Program. |
| `NCT06972992` | `ascletis-pharma-asc47-semaglutide-combination` | No internal component `assetId` to anchor the asset-scoped file. Unchanged from the v3 migration audit. |

## Additions

All 42 were verified directly against ClinicalTrials.gov on 2026-07-14 and entered as **Study +
protocol Arms only**. Registry outcome definitions were **not** stored as Endpoints, because no
Outcome is recorded: an inventory Study has empty `analysisGroups`, `endpoints` and `outcomes`
(ADR-0039). Arm `dose` and `treatmentDuration` are omitted throughout, as permitted for inventory
Studies; `route` and `dosingFrequency` are recorded only for single-asset studies, from the
anchoring Program's verified administration.

| Study | Registry ID | Explicit mapping | Registry status (registry update date) |
|---|---|---|---|
| SURMOUNT-MMO | `NCT05556512` | `programId` `…-ly3298176-subcutaneous-injection-surmount-mmo` | Active, not recruiting (2026-01-12) |
| TREASURE-CKD | `NCT05536804` | `programId` `…-ly3298176-subcutaneous-injection-higher-dose-ckd` | Active, not recruiting (2026-05-08) |
| (none) | `NCT06037252` | `programId` `…-ly3298176-subcutaneous-injection-higher-dose-t2d` | Active, not recruiting (2026-03-23) |
| SURMOUNT-ADOLESCENTS-2 | `NCT06439277` | `programId` `…-ly3298176-subcutaneous-injection-adolescent-obesity` | Recruiting (2026-07-07) |
| SURPASS-T1D-1 | `NCT06914895` | `programId` `…-ly3298176-subcutaneous-injection-type-1-diabetes` | Active, not recruiting (2026-05-12) |
| (none) | `NCT06643728` | `regimenId` `…-bimagrumab-tirzepatide-obesity` | Active, not recruiting (2026-05-26) |
| (none) | `NCT06373146` | `regimenId` `…-mibavademab-tirzepatide-obesity` | Completed (2026-05-06) |
| TOGETHER-PsO | `NCT06588283` | `regimenId` `…-ixekizumab-tirzepatide-plaque-psoriasis-obesity` | Completed (2026-06-17) |
| TOGETHER-PsA | `NCT06588296` | `regimenId` `…-ixekizumab-tirzepatide-psoriatic-arthritis-obesity` | Completed (2026-05-13) |
| COMMIT-UC | `NCT06937086` | `regimenId` `…-mirikizumab-tirzepatide-ulcerative-colitis-obesity` | Recruiting (2026-07-07) |
| COMMIT-CD | `NCT06937099` | `regimenId` `…-mirikizumab-tirzepatide-crohns-disease-obesity` | Recruiting (2026-07-07) |
| ATTAIN-Hypertension | `NCT06948435` | `programId` `…-ly3502970-oral-tablets-attain-hypertension` | Active, not recruiting (2026-05-29) |
| ATTAIN-OSA | `NCT06649045` | `programId` `…-ly3502970-oral-tablets-attain-osa` | Active, not recruiting (2025-09-29) |
| ATTAIN-OA PAIN | `NCT07153471` | `programId` `…-ly3502970-oral-tablets-attain-oa` | Recruiting (2026-07-07) |
| RESTRAIN-SUI | `NCT07202884` | `programId` `…-ly3502970-oral-tablets-restrain-sui` | Recruiting (2026-06-23) |
| (none) | `NCT06972472` | `programId` `…-ly3502970-oral-tablets-obesity-t2d` | Active, not recruiting (2026-04-20) |
| TRIUMPH-1 | `NCT05929066` | `programId` `…-ly3437943-subcutaneous-injection-triumph-1-basket` | Completed (2026-06-03) |
| TRIUMPH-7 | `NCT07035093` | `programId` `…-ly3437943-subcutaneous-injection-low-back-pain` | Recruiting (2026-05-20) |
| TRIUMPH-8 | `NCT07232719` | `programId` `…-ly3437943-subcutaneous-injection` | Active, not recruiting (2026-04-17) |
| TRIUMPH-Outcomes | `NCT06383390` | `programId` `…-ly3437943-subcutaneous-injection-triumph-outcomes` | Active, not recruiting (2026-06-17) |
| ENLIGHTEN-1 | `NCT07321886` | `programId` `…-ly3841136-subcutaneous-injection` | Recruiting (2026-07-07) |
| ENLIGHTEN-2 | `NCT07282600` | `programId` `…-ly3841136-subcutaneous-injection` | Recruiting (2026-07-07) |
| ENLIGHTEN-3 | `NCT07369011` | `programId` `…-ly3841136-subcutaneous-injection-obstructive-sleep-apnea` | Recruiting (2026-07-07) |
| ENLIGHTEN-4 | `NCT07353931` | `programId` `…-ly3841136-subcutaneous-injection-osteoarthritis` | Recruiting (2026-07-07) |
| (none) | `NCT06345066` | `programId` `…-ly3841136-subcutaneous-injection` | Completed (2025-10-15) |
| (none) | `NCT06603571` | `regimenId` `…-eloralintide-tirzepatide-obesity` | Active, not recruiting (2025-09-26) |
| (none) | `NCT07215559` | `regimenId` `…-macupatide-eloralintide-obesity` | Recruiting (2026-07-07) |
| (none) | `NCT07589608` | `regimenId` `…-macupatide-eloralintide-obesity` | Recruiting (2026-06-24) |
| (none) | `NCT06683508` | `programId` `…-ly3549492-oral-solution` | Completed (2026-05-13) |
| (none) | `NCT07476118` | `programId` `…-ly3537031-subcutaneous-injection` | Recruiting (2026-04-20) |
| (none) | `NCT06124807` | `programId` `…-ly3305677-subcutaneous-injection` | Completed (2026-04-21) |
| (none) | `NCT05380323` | `programId` `…-ly3541105-subcutaneous-injection` | Completed (2025-06-27) |
| RENEW 1 | `NCT07220642` | `programId` `novo-nordisk-cagrilintide-subcutaneous-injection` | Active, not recruiting (2026-06-30) |
| AMAZE 12 | `NCT07503210` | `programId` `novo-nordisk-amycretin-subcutaneous-injection` | Recruiting (2026-07-09) |
| (none) | `NCT07395687` | `programId` `novo-nordisk-ubt251-subcutaneous-injection` | Recruiting (2026-04-21) |
| (none) | `NCT06577766` | `programId` `novo-nordisk-amylin-355-subcutaneous-injection` | Active, not recruiting (2026-03-17) |
| (none) | `NCT06719011` | `programId` `novo-nordisk-amylin-1213-subcutaneous-injection` | Recruiting (2025-05-25) |
| (none) | `NCT07184632` | `programId` `novo-nordisk-triple-subcutaneous-injection` | Active, not recruiting (2026-05-07) |
| (none) | `NCT07566390` | `programId` `novo-nordisk-glp-1-analogue-subcutaneous-injection` | Recruiting (2026-06-04) |
| ZUPREME 2 | `NCT06926842` | `programId` `zealand-pharma-petrelintide-subcutaneous-injection` | Active, not recruiting (2026-01-15) |
| ZYNERGY | `NCT07589686` | `programId` `zealand-pharma-petrelintide-ct-388-fdc-subcutaneous-injection` | Not yet recruiting (2026-07-07) |
| (none) | `NCT06000891` | `programId` `zealand-pharma-dapiglutide-subcutaneous-injection` | Terminated (2025-04-25) |

Ten assets received their first Clinical Evidence file: `ly3532226`, `ly3537031`, `ly3541105`,
`ly3549492`, `nn9638`, `nn9662`, `nn9695`, `nn9839`, `dapiglutide`, `petrelintide-ct-388-fdc`.

## Exclusions — outside Scope v1.1

Twenty-seven trials were cited by Pipeline evidence but do not clear the Evidence-scope test.
None was entered; none was silently dropped.

| Registry ID | Trial | Reason |
|---|---|---|
| `NCT07241390` | ATTAIN-Outcomes | ASCVD/CKD-only; no obesity, overweight or BMI enrolment criterion |
| `NCT04255433` | SURPASS-CVOT | T2D-only cardiovascular outcome trial |
| `NCT07165028` | SYNERGY-Outcomes | MASLD-only (also a schema boundary case — see above) |
| `NCT06260722` | TRANSCEND-T2D-2 | T2D-only |
| `NCT06297603` | TRANSCEND-T2D-3 | T2D-only with renal impairment |
| `NCT07668336` | ACHIEVE-PEDS | T2D-only (pediatric) |
| `NCT07613307` | ACHIEVE-RAM | T2D-only (Ramadan fasting) |
| `NCT06542874` | (none) | T2D-only (amycretin) |
| `NCT07415954` | (none) | T2D-only (NNC0662-0419) |
| `NCT06323174` | REIMAGINE 1 | T2D-only |
| `NCT06323161` | REIMAGINE 3 | T2D-only |
| `NCT06534411` | REIMAGINE 5 | T2D-only |
| `NCT05352815` | COMBINE 1 | T2D-only |
| `NCT05259033` | COMBINE 2 | T2D-only |
| `NCT05013229` | COMBINE 3 | T2D-only |
| `NCT06269107` | COMBINE 4 | T2D-only |
| `NCT06194500` | (none) | Healthy-volunteer radiolabelled mass-balance/bioavailability study |
| `NCT07286175` | RENEW-Bipolar-1 | Bipolar disorder; incidental body weight only |
| `NCT07410507` | RENEW-Scz-1 | Schizophrenia; incidental body weight only |
| `NCT07420283` | RENEW-Op-1 | Opioid use disorder; incidental body weight only |
| `NCT07223840` | RENEW-Smk-1 | Tobacco use disorder; incidental body weight only |
| `NCT07219953` | RENEW-ALC-2 | Alcohol use disorder; incidental body weight only |
| `NCT07219966` | RENEW-ALC-1 | Alcohol use disorder; incidental body weight only |
| `NCT07412756` | RENEW-MDD-1 | Major depressive disorder; incidental body weight only |
| `NCT07545759` | RENEW-IBS-D | Irritable bowel syndrome with diarrhea; incidental body weight only |
| `NCT07545772` | RENEW-IBS-C | Irritable bowel syndrome with constipation; incidental body weight only |
| `NCT07219173` | (none) | Asthma; incidental body weight only |

The ten brenipatide (LY3537031) exclusions leave one entered brenipatide Study, `NCT07476118`,
in participants with overweight or obesity.

## Validation

`npm run data:generate`; `data:validate:clinical-evidence`,
`data:validate:clinical-evidence:generated`, `data:validate:clinical-evidence:synthetic`,
`data:validate:generated`, `data:validate:companies`, `data:validate:registries`,
`data:validate:synthetic`, `data:validate:stress`; `npm run lint`; `npx tsc --noEmit`;
`npm run build`; `git diff --check` — all pass. Generation was re-run and confirmed byte-identical
(no staleness drift). `data/companies/**` is unchanged.
