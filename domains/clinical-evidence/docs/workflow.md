---
role: research-workflow
status: active
authority: authoritative
update-boundary: Update only when the Clinical Evidence research execution procedure, fallback behavior, validation, or reporting requirements change.
---

# Clinical Evidence Research Workflow

Executable workflow for a named company with explicit Clinical Evidence
intent. The company name is the only input. Routing is authoritative in
[`AGENTS.md`](../../../AGENTS.md); entity and result semantics are authoritative in
the [Clinical Evidence contract](./README.md).

## 1. Load the stored Company/Pipeline manifest read only

Do **not** run Company/Pipeline Research in a Clinical Evidence execution.
Clinical Evidence uses the checked-out Company/Pipeline operating source as its
stored identity and traversal manifest and treats the corresponding generated
Company/Pipeline artifacts as a read-only freshness check. It never edits,
refreshes, regenerates, or repairs either surface.

Before source discovery or any Clinical Evidence edit:

1. confirm that the intended Company/Pipeline source and generated paths have no
   pre-existing uncommitted change that would make the baseline ambiguous;
2. run `npm run data:validate:company-pipeline:manifest`; and
3. run `npm run data:probe:registry-citations -- --company <companyId>`.

The manifest validator checks the complete Company, asset / Program, and Regimen
source graph and requires the three generated Company/Pipeline aggregates to be
byte-current with it. It writes nothing. A missing generated file, invalid
source graph, identity collision, or source/generated drift is a blocker. Do
not run `npm run data:generate` to clear that blocker inside Clinical Evidence;
report it for a separate Company/Pipeline execution.

Clinical Evidence may use only the stored Company/Pipeline source
data — the **complete** current tracked asset / Program / Regimen manifest,
not a subset prefiltered by `scopeClass`. Every tracked asset is a traversal
candidate under this workflow's own
[Evidence Scope](./README.md#evidence-scope), regardless of `scopeClass`.

`scopeClass` (Contract 1.2, ADR-0053) travels with the manifest as a
**reference value only**: it may inform traversal order or be cited in a
disposition, but it is **never** the authority for Study inclusion and it is
**never** used as an inclusion filter — do not narrow traversal to
`obesity-treatment` / `obesity-adjunct` rows. A Study anchored to an
`obesity-comorbidity`, `metabolic-adjacent`, or `non-metabolic` row is
in-scope exactly when it independently satisfies this workflow's own Evidence
Scope; `scopeClass` neither includes nor excludes it.

Keep an in-session traversal manifest containing `assetId`,
`programId`, canonical asset name, route, indication scope, development state,
`scopeClass`, and unresolved conflicts. Do not persist this manifest.

The stored manifest's age alone is not a blocker because the contract defines
no expiry threshold. Treat it as materially stale when current evidence shows
that a missing or contradicted Company/Pipeline identity prevents a reliable
traversal or focal mapping. A repository-wide structural or generated-drift
failure blocks the run. A target-company inventory failure blocks that
company. A localized unresolved asset / Program / Regimen anchor blocks the
affected Study or asset and makes the company result `PARTIAL`. In every case,
leave Company/Pipeline unchanged and report the exact blocker and the separate
Company/Pipeline re-entry condition.

### Registry-citation preflight (ADR-0054)

After the read-only manifest validation, run:

```text
npm run data:probe:registry-citations -- --company <companyId>
```

This reports, for the named company, which Company/Pipeline-stored registry
locators (`metadata.sources` entries recognized as a direct
ClinicalTrials.gov Study-record URL) already correspond to a Clinical Evidence
Study, which do not, and which raise an anchor ambiguity. Add the reported
locators to the in-session traversal manifest as a **reference value only** —
the same "do not persist" rule above applies to this preflight's output.

Three things this preflight does **not** change:

- **Co-location is not provenance.** That Company/Pipeline stored a source, or
  that a source sits on a particular Program/Regimen row, is not itself
  evidence for any Clinical Evidence claim or for a Study's focal anchor. A
  locator this preflight surfaces may be used as a Study, Arm, Endpoint,
  Outcome, or `registryStatus` source only after Clinical Evidence **directly
  reopens and reviews it** under the Reviewed definition and Source access
  states below — the same standard applied to any other source. Result value
  and result-source priority remain Clinical Evidence's own independent
  judgment (§3) regardless of what Company/Pipeline stored.
- **The broad independent coverage search below is not reduced.** Every
  locator this preflight surfaces still needs the discovery, disposition, and
  completion-check steps below; and step 2's broad search for studies this
  preflight did **not** surface still runs in full. A Study this preflight
  did not surface is not evidence that none exists — it only means Company/
  Pipeline's own stored sources did not happen to include a direct link to it.
- **A missing locator is not a Company/Pipeline defect.** What counts as
  sufficient Company/Pipeline sourcing for a row's own stage/status claims is
  owned by the
  [Company/Pipeline Source and Entry Policy](../../company-pipeline/docs/source-and-entry-policy.md),
  not restated here. A Study this preflight reports as having no corresponding
  Company/Pipeline locator is ordinary independent Clinical Evidence coverage,
  not a gap to report back against Company/Pipeline data.

This preflight never edits data and never decides Study inclusion, focal
anchor, Study completeness, result availability, or result provenance — those
remain this workflow's own decisions below. Live-data unmatched, ambiguity,
multi-company, or unparsed findings do not fail the preflight or the research
run; an unknown `--company`, invalid arguments, a self-check failure, a
parser-contract violation, or a source-read error fails it normally, the same
as any other probe or validator. When more than one Program or Regimen row
cited the same locator, or the same locator was cited under more than one
company, treat every listed row only as an anchor **candidate**; decide the
actual anchor under this workflow's own reference rules, never from row
co-location alone. If direct current evidence later shows that none of the
stored candidates can support a reliable focal mapping, apply the manifest
blocker rule above; do not reinterpret the advisory probe result itself as a
failure.

This is the mirror image of Company/Pipeline's own rule (ADR-0055): Company/
Pipeline decides Program/Study disposition on sponsor evidence alone and
consults a Clinical Evidence anchor only as a non-authoritative consistency
check, never as identity authority; Clinical Evidence decides its own Study
anchor under this workflow's rules alone and consults Company/Pipeline
co-location only as a candidate, never as anchor authority. Neither domain
settles the other's identity question. The probe also reports
`cited-registry-record-anchored-to-other-row` — a Company/Pipeline row citing
a locator this workflow anchors to a *different* row — which is Company/
Pipeline's own consistency signal, not an input to this workflow's anchor
decision.

### Cross-company sponsor resolution (ADR-0071)

A discovered registry record can plausibly belong to more than one company
when licensing, co-development, or a regional rights split applies to the
asset (for example an originator/licensee pair, or a global/regional
territory split). Before authoring the Study, decide its canonical anchor
with this cascade rather than defaulting to whichever company is currently
under research:

1. Read the registry's own lead sponsor (or sponsor, where the registry does
   not distinguish lead from collaborator). This is the **primary signal**,
   not an automatic answer.
2. Resolve that sponsor to a Company/Pipeline-tracked `companyId`, including
   a disclosed legal subsidiary or affiliate name that resolves to its
   tracked parent.
3. Confirm the resolved company's own Company/Pipeline manifest carries a
   matching asset/program anchor for this molecule. This step is what keeps
   an investigator- or academic-sponsored study, or a similarly named but
   unrelated company, from being mistaken for the developer of record.
4. When steps 1–3 all resolve cleanly, that `companyId` is the canonical
   anchor: author the Study there, even when it differs from the company
   currently under research.

When resolution fails or conflicts — the sponsor does not resolve to any
tracked company, the resolved company carries no matching asset anchor, or
the registry's own sponsor changed during the trial — review the official
sponsor source together with the tracked companies' Company/Pipeline
`relationships` (role, territory, `effectiveDate`) before deciding. If the
anchor is still genuinely unclear after that review, use the existing
`DEFERRED_SCHEMA_CASE` status (§5) rather than forcing an anchor or silently
omitting the evidence.

This cascade governs **evidence attribution**, not identity authority, and
does not change the mutual non-authority principle above: Company/Pipeline
still decides its own Program/Study disposition on sponsor evidence alone,
and this workflow still decides its own Study anchor independently. It does
not create multi-anchor storage: a registry identity resolved to another
company's canonical anchor is not stored a second time under the company
currently being researched.

**Recording the cascade's foreign-owner verdict is implemented (ADR-0074).**
When this cascade's four steps clearly resolve a discovered registry identity
to a *different* tracked company's canonical anchor, record that verdict in
the asset-scoped `clinical-evidence.json`'s own `researchState` — the same
ADR-0070 operational envelope `knownNCTs` already lives in, under
`discoveryCheckpoint.clinicalTrials.foreignStudyDispositions`, keyed by the
registry identity:

```json
"foreignStudyDispositions": {
  "NCT01234567": {
    "disposition": "CROSS_COMPANY_OWNED",
    "ownerCompanyId": "eli-lilly-and-company",
    "ownerAssetId": "mazdutide",
    "recordedAt": "2026-09-15",
    "recordedLeadSponsor": "Eli Lilly and Company"
  }
}
```

Write this entry the same way a Study itself is authored — by hand, in the
same file, immediately after the cascade resolves — never through a separate
CLI or interactive flag. `ownerAssetId` is required, confirming the owner
company's canonical asset anchor in its own manifest (ADR-0071 cascade step 4);
company-only suppression is strictly forbidden. `disposition` currently has
exactly one allowed value. This is purely an operational fact ("investigated,
and currently attributed elsewhere under this cascade") and carries **no other
meaning**: it does not assert the owner's evidence review is complete, that
owner's CE record is exhaustive, that any publication has been reviewed, or that
the underlying license relationship is permanent. Canonical Study/Arm/Outcome/
`RecordMetadata` data is never duplicated into it or read from it.

**Never record an entry** for: an unresolved sponsor, an investigator- or
academic-sponsored study, a historical sponsor-transfer conflict, co-lead
ambiguity between two tracked companies, or an owner asset anchor that is not
actually confirmed (only guessed). Any of these stays a plain `NEW` discovery
candidate on every run — recording nothing is always the safe default when
the cascade does not resolve cleanly; use `DEFERRED_SCHEMA_CASE` (§5) if the
identity itself needs to be tracked as unresolved, not a disposition.
`discoveryPath`/`matchedOn` (below) are diagnostic provenance only — *how* a
candidate was found is never a basis for recording, or for withholding, a
disposition; only this cascade's own verdict is.

The entry is **not permanent**. Every `registry:discovery` run re-validates
each currently-recorded disposition:
- **Local anchor & own identity check**: re-validates that the owner company is
  still tracked, the `ownerAssetId` still resolves, and that row still shares
  confirmed **own identity** (`buildRowOwnIdentityKeys`) with a Program or
  Regimen in the focal scope. Component-only overlap (focal A + composing A+B vs
  owner B) does *not* sustain ownership and invalidates the disposition with
  `identity-no-longer-sustained`. True combination rows with matching own
  identity remain sustained.
- **Network sponsor re-validation**: checks that live `leadSponsor.name` matches
  `recordedLeadSponsor`. If the sponsor has changed, the disposition invalidates
  (`lead-sponsor-changed`). If `leadSponsor` is missing or unparseable, it is
  treated as fetch/schema incompleteness (`hasIncomplete: true`), which strictly
  blocks checkpoint advance until verified.
- **Resurfaced vs NEW separation**: an invalidated disposition is reported
  exclusively under `resurfacedForeignDispositions` for human re-review, and is
  never duplicated into `newlyDiscovered` as an ordinary new candidate.
- **Drops on checkpoint save**: drops any entry that no longer holds on the next
  checkpoint save, exactly as `knownNCTs` itself is reconstructed fresh on every
  save. An unreviewed resurfaced disposition prevents a `CLEAN` verdict and
  blocks routine `--advance` without `--ack-deltas`.

A future workflow revision that changes this cascade's own rules invalidates
every existing disposition the same way any other `workflowRevision` bump
already forces a full re-baseline. The same real registry identity legitimately
recorded in more than one focal asset's own `foreignStudyDispositions`
(independent discovery provenance from two different asset-scoped runs) is not a
conflict; only a collision with that *same file's own* local canonical Study is.

**Partner-aware discovery is implemented.** Section 1's asset-scoped registry
discovery preflight (`scripts/research-preflight.mjs`,
`registry:discovery`) also queries a licensed, co-developed, or
regional-rights-split asset's **partner-side** code name when it can be
confirmed, via Company/Pipeline identity alone, to denote the same asset —
never the partner's whole pipeline, and never a fuzzy company/asset guess.
The relevant `relationships[]` entries are exactly `licensor`/`licensee`/
`co-developer` — the same reciprocal-role scope ADR-0072's reciprocity
probe checks (`RECIPROCAL_RELATIONSHIP_ROLES`,
`domains/company-pipeline/lib/relationship-identity.mjs`); `originator` and
every acquisition/historical-transfer-flavored role are one-directional by
meaning and are never treated as a partner-discovery signal. For each
in-scope entry: the named counterpart must resolve to a tracked company by
an exact `company.name` match, and that counterpart must carry its own
Program or Regimen row whose name/code identity overlaps the focal asset's
(the exact same shared identity authority ADR-0072's asset/deal-aware
matching uses — `buildRowIdentityKeys`/`identityKeysIntersect` from
`domains/company-pipeline/lib/relationship-identity.mjs`, not a separate
copy — including a combination row's `components[].assetName`/`codeName`,
which is what lets a fixed-dose-combination row's listed partner molecule
resolve to that partner's own tracked row in the first place). The focal
side reaches beyond the directly-named Program too: any same-company Regimen
or fixed-dose-combination Program row that composes the named asset with
another asset of the same company (ADR-0069's asset-scoped reach) is scanned
for `relationships[]` the same way — a relationship recorded only on a
composing Regimen, never on the plain Program, still triggers this check.

**`components[]` identity resolution and actual search terms are kept
strictly separate.** A component named inside a combination row denotes a
*different* real-world asset that the row combines with — not another name
for the row's own asset — so a matched counterpart row's own components are
never added as search terms, and a match is only ever expanded into
`query.intr` terms when the counterpart row denotes *this same asset* under
its own name/code (`buildRowOwnIdentityKeys`, components excluded, on both
the focal and counterpart side). A relationship confirmed only through a
components[] reference — the counterpart's asset is real and tracked, but is
a distinct molecule merely combined with the focal one — is reported as
`component-only-match` and never expanded: expanding it would search for
that different asset's own standalone trials directly, pulling in results
that have nothing to do with the focal asset. The combination row's *own*
name/code (for example "Petrelintide / CT-388", not "CT-388" alone) remains
an ordinary focal search term throughout, so the combination itself stays
discoverable even though its components are not searched individually. An
untracked counterpart, or a tracked counterpart with no matching row at all
(a structurally non-actionable case under ADR-0072), likewise adds no terms
and never blocks discovery. A candidate found only through a partner term is
reported with its own `partner-intervention` provenance in the preflight
diagnostics, but this decides only what discovery searches for — **which
company's Clinical Evidence folder the resulting Study belongs in is still
decided entirely by
the four-step cascade above**, independent of which query surfaced it.

## 1a. Asset-scoped execution for a named asset (ADR-0069)

When a request explicitly names one or more of the company's existing assets —
by `assetId`, canonical asset name, code name, or alias — this execution may
scope its evidence traversal (step 2 onward) to those named assets instead of
the company's complete manifest, as an **asset-scoped run**. This is an
option, not a requirement: a request that names only the company still
traverses every current asset under section 1's complete-manifest rule.

1. **Declare the scope.** State the named asset(s) — by `assetId` — this
   execution traverses, in this execution's own report (section 7) and in its
   commit message(s). An execution that does not declare a scope traverses the
   full company and is held to the unmodified sections 1–8.
2. **What loads regardless.** Section 1's read-only manifest load, its
   validation, and the registry-citation preflight always cover the
   **complete** company manifest, never a subset — identity resolution and the
   no-`scopeClass`-filter rule are unaffected by an asset-scoped run. Only the
   evidence-traversal work in step 2 onward narrows.
3. **What a scope covers.** Every named asset gets full rigor: step 2 items
   1–6, the source and update rules of step 3, and the step 6 completion check
   all apply in full to each named asset's Studies. If an already-stored
   Regimen or FDC row directly composes a named asset with another asset in
   the same company (for example `asc36-35-fdc` composing `asc36` and
   `asc35`), that row's own Studies are in scope too, even when its other
   component asset was not separately named — a combination Study cannot be
   dispositioned from evidence covering only one of its own components. Step
   2's "every current in-scope asset" resolves, for an asset-scoped run, to
   exactly the assets this item reaches — never the company's complete set. A
   scope is not required to traverse any other company asset beyond what this
   item reaches.
4. **What stays out of scope.** Every company asset not named and not reached
   by item 3 remains whatever its current Clinical Evidence state already is —
   untouched, not implicitly marked current, not implicitly marked absent. An
   asset-scoped run reports its own scope as **asset scope complete**, never
   as company-level completion; the run-level completion status defined in
   step 6 (`FULL`, `FULL_WITH_FALLBACK`, `PARTIAL`) describes only the
   declared scope's own result coverage and must not be read as satisfying
   full company coverage.
5. **No new ledger.** Coverage of which of a company's assets Clinical
   Evidence currently covers is read from the existing per-asset source-file
   layout in step 4
   (`domains/clinical-evidence/data/clinical-evidence/<company-id>/<asset-id>/`)
   — an asset's own directory presence, or its absence, is the coverage
   signal. Asset-scoped execution introduces no new tracking file.

## 1b. Deterministic network preflights & Cold-Path execution (ADR-0070)

To eliminate redundant web searches and unnecessary LLM token consumption while
maintaining 100% factual accuracy, Clinical Evidence research utilizes
zero-token Node.js network preflights strictly outside the offline CI gate.

### State lifecycle & domain-scoped execution commands
Research preflight is integrated into routine investigation and refresh workflows.
Checkpoint ownership is strictly partitioned by domain:
- **Company/Pipeline**: Owns `company.json`.
- **Clinical Evidence**: Owns `<assetId>/clinical-evidence.json` (asset-scoped) and `<companyId>/company-research-state.json` (company-wide envelope). **Under no circumstances does Clinical Evidence modify `company.json`, `pipeline-programs.json`, or `regimens.json`.**

```text
# 1. Routine Preflight Inspection (read-only inspection across all 5 probes)
# Asset-scoped Clinical Evidence run (target: <assetId>/clinical-evidence.json):
node --use-system-ca scripts/research-preflight.mjs all --company <companyId> --asset <assetId>

# Company-scoped Clinical Evidence run (target: <companyId>/company-research-state.json):
node --use-system-ca scripts/research-preflight.mjs all --company <companyId> --ce

# 2. Lifecycle Checkpoint Transitions (Clinical Evidence domain):
# --- Asset-scoped lifecycle (target: <companyId>/<assetId>/clinical-evidence.json) ---
# [LEGACY_UNBASELINED] -> Initial investigation complete; establish baseline checkpoint:
node --use-system-ca scripts/research-preflight.mjs all --company <companyId> --asset <assetId> --bootstrap
# (Note: If adverse notices or deltas are surfaced on unbaselined data, pass --bootstrap --ack-deltas after reviewing)

# [CLEAN REFRESH] -> All monitored deterministic probes report CLEAN / UNCHANGED; advance checkpoint:
node --use-system-ca scripts/research-preflight.mjs all --company <companyId> --asset <assetId> --advance

# [DELTA_DETECTED] -> Protocol amended, new trial, erratum/retraction, or new publication:
# Perform canonical updates & conclusion-blind audit, then advance checkpoint:
node --use-system-ca scripts/research-preflight.mjs all --company <companyId> --asset <assetId> --advance --ack-deltas

# --- Company-wide lifecycle (target: <companyId>/company-research-state.json) ---
# Company-wide CE initial baseline:
node --use-system-ca scripts/research-preflight.mjs all --company <companyId> --ce --bootstrap

# Company-wide CE clean refresh:
node --use-system-ca scripts/research-preflight.mjs all --company <companyId> --ce --advance

# Company-wide CE reviewed delta:
node --use-system-ca scripts/research-preflight.mjs all --company <companyId> --ce --advance --ack-deltas

# [FETCH_ERROR / NETWORK_ERROR / PARTIAL] -> Checkpoint advance is STRICTLY BLOCKED until errors/truncation are resolved.
# Note: TRUNCATED / PARTIAL is an operational safety limitation protecting network boundaries; it strictly blocks checkpoint advance without indicating a correctness failure.
```

### Two-stage delta detection & decoupled probes
- **Checkpoint compatibility & invalidation keys**: `workflowRevision` (`ADR-0070`) and `semanticFingerprintVersion` (`2`) are active compatibility keys. If either stored key differs from current code constants, preflight flags `REBASELINE_REQUIRED` and strictly blocks routine `--advance`, requiring an explicit re-baseline (`--bootstrap --ack-deltas`) after verifying current evidence.
1. **Registry Update Probe (`registry:update`) vs Registry Discovery Probe (`registry:discovery`)**:
   - Update probe checks known NCTs on ClinicalTrials.gov API v2: evaluates `lastUpdatePostDate`. If changed, computes SHA-256 over normalized scientific fields (`overallStatus`, `phases`, `designInfo`, `armGroups`, `primaryOutcomes`, `secondaryOutcomes`, `eligibility`, `enrollmentCount`) under `semanticFingerprintVersion: 2`. Benign administrative edits (e.g. contact/site changes) are classified as `ADMIN_UPDATE_BYPASS` (LLM re-read skipped). Version or workflow revision mismatches trigger `REBASELINE_REQUIRED`.
   - Discovery probe executes deterministic queries with company name and asset aliases, computing an ID set difference ($\text{Candidates} \setminus \text{Known NCTs}$) to surface brand-new trial registrations at 0 LLM tokens. For an asset-scoped run, this also queries a confirmed same-asset partner-side code name (§1's "Partner-aware discovery is implemented") - never a partner's whole pipeline - and labels any resulting candidate with which query path (focal or partner) surfaced it.
2. **Literature Health Check (`literature:health`) vs Literature Discovery Probe (`literature:discovery`)**:
   - Health check queries PubMed E-utilities (`efetch.fcgi` XML) for all cited PMIDs, parsing `<CommentsCorrections>` (`ErratumIn`, `RetractionIn`, `ExpressionOfConcernIn`) and `<PublicationType>` (`Retracted Publication`). It computes a granular `noticeFingerprint` (enforced as required by validator whenever status is `has-erratum` or `retracted`). If an adverse notice changes in either direction (e.g. erratum to retraction, secondary erratum added, or notice resolved/retracted status cleared), the bidirectional diff surfaces a delta (`RETRACTION_DETECTED`, `NEW_ERRATUM_DETECTED`, or `LITERATURE_NOTICE_CHANGED`), never silently returning `CLEAN`. Genuine non-PubMed DOIs (unindexed on PubMed) are tracked with `status: "NOT_FOUND_ON_PUBMED"` as non-monitored without blocking checkpoint advance.
   - Discovery probe queries PubMed E-utilities (`esearch.fcgi`) for asset aliases to detect newly indexed peer-reviewed journal articles that may supersede earlier interim disclosures or press releases ($\text{Discovered PMIDs} \setminus \text{Known PMIDs}$). Failure of follow-up detail fetch preserves discovered delta IDs with `hasIncomplete: true`, never collapsing into a false `CLEAN`.

### Cold-Path execution & CLEAN semantics ("Freeze the source, not the study")
Completed Studies with established Tier 1 peer-reviewed publications (e.g. STEP 1, SURMOUNT-1, SELECT) older than 12 months enter **Cold-Path Execution**:
- **Monitored surface boundary**: Preflight directly monitors **only** deterministic surfaces: ClinicalTrials.gov API v2, PubMed E-utilities (EFetch/ESearch), and SEC EDGAR.
- **CLEAN semantics**: `CLEAN` certifies zero delta on deterministic monitored surfaces only. It does **not** prove absence of new disclosures on Sponsor IR, company newsrooms, investor presentations, or medical congresses.
- **Mandatory primary discovery obligations**: Sponsor IR, newsroom, and congress discovery obligations remain mandatory during both initial research and refresh runs. Preflight does not exempt the operator or agent from checking primary disclosure channels.
- **Freeze the source text, not discovery**: Cold-Path is an operational optimization to bypass redundant re-reading and re-parsing of immutable source text (saving 30k+ tokens per study); it is **not** an exemption from primary source discovery.
- **Operational label**: `COLD_PATH_VERIFIED` is an in-session operational label indicating that a study's monitored primary sources passed preflight cleanly without deltas. It is **not** a schema state or a field written to `clinical-evidence.json`.
- **Deltas trigger targeted audit**: If an erratum, retraction, protocol amendment, or new publication is detected, immediately trigger targeted review of that specific delta payload only.

## 2. Establish and traverse the evidence set

Inspect existing Clinical Evidence source files and decide initial
investigation versus update from their presence. For every current in-scope
asset:

1. Read its existing source record, if present.
2. Discover relevant human interventional studies broadly.
3. Store every verified in-scope Study, including planned, recruiting, active,
   completed, terminated, suspended, or withdrawn Studies without an Outcome.
4. For every Study in the run, record one in-session result-availability state:
   `RESULT_SOURCE_FOUND`, `NO_PUBLIC_RESULTS`, or
   `RESULT_AVAILABILITY_UNRESOLVED`, with the sources and check date.

   `NO_PUBLIC_RESULTS` is an operational conclusion of this workflow, reached after
   the required source surfaces and every applicable identifier have been
   exhausted. It is not proof that no result exists publicly anywhere. Record it
   only after exhausting every one of these surfaces: the registry's own results
   section, the sponsor's newsroom and investor materials, the relevant congress
   abstract archives, and a literature-index lookup by each of the registry
   identifier, the asset name and development code, and the study acronym. Search
   only the identifiers that exist — an asset with no development code, or a study
   with no acronym, does not owe that lookup. If any surface, or any identifier
   that does exist, was not attempted, the state is not `NO_PUBLIC_RESULTS`.

   A blocked source is not a missing result. **Neither a search that returned
   nothing nor a failure to reach a source is by itself grounds for
   `NO_PUBLIC_RESULTS`.** When a required surface is unreachable but a reasonable
   alternative primary source supplies the same evidence, proceed on that source.
   Use `RESULT_AVAILABILITY_UNRESOLVED` only when a required surface is blocked
   **and** no alternative primary source could be obtained, and record which surface
   was blocked and which alternatives were tried.

   For `RESULT_SOURCE_FOUND`, enter the results found in the ordinary course of
   research from its cited sources, and complete the step 6 completion check
   before considering the Study done. Record "not reported" rather than
   inferring a missing analysis detail.
5. When entering, excluding, or deferring a specific result, use exactly one
   of these dispositions:
   - **entered**: represented by an Endpoint and Outcome whose metadata cites
     the source that directly supports the stored value;
   - **excluded**: outside the Clinical Evidence scope or an explicit contract
     non-goal, with the result and reason reported;
   - **deferred**: direct disclosure exists but evidence, identity, or reliable
     Arm/AnalysisGroup/Endpoint mapping is insufficient, with the missing
     evidence and re-entry condition reported. A search that found nothing and a
     source that could not be reached are **not** result dispositions: they are
     Study-level availability states under step 4, and deferring on either before
     the search is exhausted misreports an incomplete search as non-disclosure;
   - **schema boundary**: the source-supported result cannot be represented by
     the current contract and is handled under the case-scoped fallback.
6. Classify every discovered study as inventory entered, result-bearing
   entered, excluded outside scope, or deferred with a reason.

Do not stop at one asset or the chronologically latest trial. Deduplicate
publications to stable registry/Study identity. The result-review manifest is
in-session only and is not operating data. A result-bearing source cited only
in Study metadata has not satisfied the step 6 completion check.

## 3. Sources and updates

Default result-source priority is:

1. peer-reviewed publication;
2. registry-posted results;
3. official scientific presentation or poster;
4. conference abstract;
5. official company topline release.

A source that directly supports the exact recorded result overrides this
general order: rank by direct support for that value first, and use this list
only to break a tie or to choose among sources that support the value equally
well. This is the single authority for Clinical Evidence result-source
priority; Company/Pipeline research does not maintain its own.

Apply authority and recency together. Outcome maturity comes from the strongest
source that directly supports that exact value. Preserve only directly
reported results; do not calculate, infer, visually transcribe, redistribute,
or broaden a result beyond its supported analysis unit.

### Source access states

Track access to the highest-priority known result source, in-session, using
exactly one of:

- `FULL_SOURCE_REVIEWED` — every scope needed for the result was opened and
  read.
- `PARTIAL_SOURCE_REVIEWED` — some needed scope was opened and read; the rest
  was not. Record the available scope and the missing scope separately.
- `SOURCE_IDENTIFIED_NOT_ACCESSED` — the source is identified (citation or URL
  known) but could not be opened.
- `SOURCE_NOT_LOCATED` — no candidate source at that priority tier could be
  found.

When access failed, record a blocker reason where useful: `PAYWALL`,
`BOT_BLOCK`, `AUTHENTICATION_REQUIRED`, `DEAD_LINK`, `REGION_RESTRICTED`,
`SUPPLEMENT_UNAVAILABLE`, `ARCHIVE_NOT_SEARCHABLE`, `SOURCE_NOT_IDENTIFIED`, or
`OTHER`. These states and reasons are execution and reporting vocabulary only:
they are not operating-schema fields and are never written to canonical data.

### Reviewed definition

A source counts as reviewed for a result only for the part actually opened and
read in support of that result and its analysis context:

- a search-result snippet is never reviewed;
- an abstract-only view reviews only the abstract's scope;
- a body read while its supplement was blocked reviews only the results the
  body itself supports;
- a result that depends on a blocked supplement is `unresolved` for that
  result, or falls to Fallback equivalence below — never entered from the
  body alone.

### Fallback equivalence

A lower-priority source may substitute for a blocked higher-priority source
only per result, evaluated on every one of these axes:

- endpoint;
- timepoint;
- analysis unit or comparison;
- analysis population;
- estimand.

Enter a result from the fallback source only when it supports all required
axes identically to the blocked source. When it supports only some, enter
only the results it supports and leave the rest `unresolved` — merely
mentioning the same endpoint is not, by itself, equivalent evidence.

Fallback equivalence governs one specific claim: that an accessible
lower-priority source may stand in for a **specific blocked source's specific
result**. Do not treat every lower-priority source consulted after a block as
a substitute for that blocked source. When the accessible source
independently and directly reports a distinct Endpoint or Outcome, it may
support that result on its own provenance rather than as a substitute,
provided it directly supports the endpoint, timepoint, analysis unit or
comparison, analysis population, and estimand required for that result.
Fallback equivalence to the inaccessible source applies only when the entry
claims the accessible source represents the same result that source would
have disclosed.

Source selection is result-scoped: different Endpoints and Outcomes within
one Study may use different directly supporting sources and different
`maturity` values, each on its own provenance.

A result-bearing source may disclose several distinct results of differing
reliability and scope; do not assign one disposition to the source as a whole.
If the source publishes only an adjusted or between-unit effect, enter only that directly
reported effect when its anchors are reliable; do not reconstruct undisclosed
arm-level values. Study-level citation and Outcome-level result provenance are
separate obligations under the contract.

For an unchanged semantic outcome, replace a superseded value in place and
preserve useful prior source references. If authority and recency cannot
resolve a conflict, defer the affected result.

When a new source supersedes existing results, scope the update by the
**comparison family** that source covers, not by the individual Outcome you
happened to be looking at. Re-derive every Outcome in the family from the new
source; where one cannot be re-derived, report the evidence for keeping its
earlier value or defer it. Never leave part of a family on the superseded source.

## 4. Author under the Clinical Evidence Data Contract

Create source files only at:

```text
domains/clinical-evidence/data/clinical-evidence/<company-id>/<asset-id>/clinical-evidence.json
```

Apply the [Clinical Evidence contract](./README.md) for Study,
Arm, AnalysisGroup, Endpoint, Outcome, focal mapping, linked assets, semantic
identity, source-reported results, latest-result replacement, inventory-only
Studies, and generated projections. Reuse existing stable entity IDs and never
mint a second ID for the same real-world Arm, AnalysisGroup, or Endpoint.

Keep `Study.safetySummary` concise; do not reproduce exhaustive adverse-event
tables in it. When a cited source directly reports a per-arm breakdown, also
enter serious adverse events, nausea, vomiting, or anti-drug antibodies
(immunogenicity) as an ordinary Endpoint (`role`/`domain`: `"safety"`) with
arm-level Outcomes — this is a closed set of exactly four named facts, not a
general adverse-event modeling mechanism; never add an Endpoint for any other
AE term. When the cited source does not support a per-arm breakdown for one
of these four, do not enter it as an Endpoint; the `safetySummary` narrative
may still cover it in prose.

## 5. Case-scoped schema fallback

An unrepresentable result never terminates the company or asset run:

1. Isolate the smallest affected Study, Endpoint, Outcome, or result.
2. Do not approximate, redistribute, force an anchor, or invent an ID.
3. Continue all other representable research and entry.
4. Include the case in the final Schema boundary report.

Use these statuses:

- `DEFERRED_SCHEMA_CASE`: omit only the unsupported case;
- `REVIEW_REQUIRED`: enter the representable record but report the documented
  semantic limitation;
- `RESEARCH_BLOCKED`: block only the affected Study when its structure prevents
  reliable classification of dependent records.

Each entry records the affected company/asset/Study/result, source evidence,
unsupported structure, information that would be lost, any partial canonical
record, relevant edge case, and the schema re-entry trigger. A later extension
replays only cases it actually unblocks.

When the current schema could represent the result but the available source
does not support a reliable Arm, AnalysisGroup, Endpoint, population, estimand,
or timepoint mapping, use the ordinary **deferred** result disposition instead
of forcing an entry or misclassifying an evidence gap as a schema limitation.

## 6. Generate and validate

After valid Clinical Evidence changes:

```text
npm run data:validate:company-pipeline:manifest
npm run data:generate:clinical-evidence
npm run data:validate:clinical-evidence
npm run data:validate:clinical-evidence:generated
npm run data:validate:clinical-evidence:synthetic
npm run data:validate:generated
npm run data:probe:registry-citations -- --company <companyId>
npm run data:probe:dose-narrative-consistency
npm run lint
npm run build
git diff --check
```

`data:generate:clinical-evidence` writes only
`data/generated/clinical-evidence.json` and
`data/generated/clinical-evidence-asset-studies.json`. It reads the stored
Company/Pipeline manifest for identity resolution but must not write the
Company/Pipeline source or `companies.json`, `pipeline-programs.json`, or
`regimens.json`. Re-run the read-only manifest validator after generation and
confirm the Company/Pipeline paths have the same pre-run diff before claiming
completion.

`data:probe:registry-citations` is advisory only, as in the preflight above:
live-data findings never fail it and it never decides Study inclusion, focal
anchor, completeness, or provenance; only invalid arguments, a self-check
failure, a parser-contract violation, or a source-read error fail it, the same
as any other probe or validator. Re-running it here surfaces any new anchor
ambiguity or still-unmatched locator this run's changes created, for reporting
only.

`data:probe:dose-narrative-consistency` is likewise advisory only: it flags a
Study whose `design.description` states a single, unambiguous dose that
numerically disagrees with its own focal Arm's structured dose, and is silent
on any Study outside that narrow shape (multi-arm, ambiguous narrative, or no
extractable structured dose). A `REVIEW_REQUIRED` line in its output is a
signal to re-verify against the primary source before changing canonical
data — it is never itself sufficient grounds for a correction (see
[Clinical Evidence Data Contract](README.md#dose-narrativestructured-consistency-probe-advisory)).

Before claiming completion, reconcile the in-session result-review manifest:

1. every Study has a recorded result-availability check;
2. every entered result has direct supporting source metadata on its Outcome;
3. every comparison family touched in this run was re-evaluated as a whole, with
   no Outcome left on a superseded source;
4. every `NO_PUBLIC_RESULTS` names the surfaces exhausted and the check date, and
   the count of `NO_PUBLIC_RESULTS` recorded without an exhausted search is zero;
5. every `RESULT_AVAILABILITY_UNRESOLVED` names the blocked surface and the
   alternative primary sources attempted;
6. every previously unresolved or deferred result known from an earlier run's
   report was re-searched in this run, and each is reported as newly resolved,
   still blocked by the same obstacle, or moved to a different disposition. A
   prior `RESULT_AVAILABILITY_UNRESOLVED` or deferral is never carried forward
   untested;
7. **completion check** — before completing any Study entered or updated as
   result-bearing in this run:
   1. identify the **highest-priority known result source** for that Study
      (the ranking in step 3, not only what has already been reviewed);
   2. confirm its access status under Source access states above; a source
      that is only identified, not located, or not yet accessed is never
      treated as reviewed;
   3. when it is fully accessible, cross-check the canonical record against
      it to confirm primary/co-primary results, central/key-secondary
      results, headline responder results, and the concise safety summary
      (plus any of the four named safety Endpoints — serious adverse events,
      nausea, vomiting, anti-drug antibodies — that source directly reports a
      per-arm breakdown for) are each reflected, entering any core result
      this finds missing under the ordinary dispositions above;
   4. when it is only partially accessible, apply step 3 to the confirmed
      scope only, and evaluate the missing scope under Fallback equivalence
      above: substitute an equivalent lower-priority source per result where
      one exists, and otherwise leave that result `unresolved` and record it
      in the handover file (step 8);
   5. when it is not accessible at all, repeat step 4 using the
      next-highest-priority known source, and record the fallback in the
      run's report;
   6. for any of the four categories no accessible source supports, record a
      short standing note — `not reported`, `not applicable`, `outside
      scope`, or `unresolved` — rather than leaving it unaddressed.
   This is the only completion gate on result coverage: it does not require
   exhaustively extracting and classifying every disclosed result or
   supplement, and no other step requires an exhaustive per-result
   disposition ledger. Consult an additional source only where needed to
   confirm one of these four categories or to evaluate fallback equivalence.

The JSON validators enforce only facts represented in canonical data. They
cannot inspect external source contents or infer that a Study-level citation is
result-bearing, so validator success does not replace the completion check.

A Clinical Evidence source-access failure blocks only the affected Study or
result, never the whole Clinical Evidence run: continue every other Study and
result that remains independently supportable, apply Fallback equivalence
above where an equivalent lower-priority source exists, and record an
unresolved case in the per-company handover file (step 8). Report the run's
completion as `FULL` when no result was blocked and no fallback was required,
`FULL_WITH_FALLBACK` when every otherwise-blocked result was still entered on
an equivalent fallback source, or `PARTIAL` when at least one result remains
unresolved after fallback. This blocking is case-scoped and does not reach
outside Clinical Evidence. A Clinical Evidence execution never makes
Company/Pipeline changes.

## 7. Report

Report:

- initial Clinical Evidence investigation or update;
- assets traversed, including the declared scope for an asset-scoped run
  (section 1a) and which of the company's other current assets remain outside
  that scope;
- Studies entered or updated, including inventory-only Studies;
- result-availability state, checked sources, and check date for every Study,
  plus the result-bearing sources reviewed. Keep "no result was disclosed" and
  "a source could not be reached" distinct in the wording; do not report a
  blocked source as non-disclosure;
- entered results, with source, disposition, reason, and re-entry condition
  where applicable;
- for each Study checked under the step 6 completion check: any core result
  entered as a result of the check, and the standing note (`not reported`,
  `not applicable`, `outside scope`, or `unresolved`) for any of the four
  categories the highest-priority source did not support;
- exclusions, deferrals, conflicts, and pipeline discrepancies;
- the stored Company/Pipeline manifest baseline used, its read-only validation
  result, and any manifest blocker or re-entry condition;
- Schema boundary report and status counts;
- generated output and validation results;
- source-access states and blockers for every source consulted under the
  completion check, including any fallback used and what it did or did not
  support;
- run-level completion status — `FULL`, `FULL_WITH_FALLBACK`, or `PARTIAL` —
  per the case-scoped rule in step 6;
- for any company with an unresolved or blocked source, confirmation that the
  per-company handover file (step 8) was created, updated, or found to need
  no change.

This report is in-conversation only; it is not persisted as a repository
document. The per-company handover file (step 8) is the sole persisted record
of an unresolved or blocked source.

Do not claim Clinical Evidence completion unless manifest preflight, traversal,
the step 6 completion check, valid updates, Clinical-Evidence-only generation,
validation, Company/Pipeline no-change confirmation, and reporting all
completed.

## 8. Unresolved-source handover

When a Study or result has a source-access failure or an unresolved fallback,
persist a per-company record at:

```text
domains/clinical-evidence/docs/source-access-handover/<company-id>.md
```

One file per company that currently has an unresolved or blocked source,
named by that company's existing `companyId`. This file is Clinical
Evidence-owned research-execution documentation, not operating data: it is
authored and read only during Clinical Evidence research and is never read by
generation or validation.

Each entry records at minimum:

- company / asset / Study;
- the highest-priority known source: identity and URL;
- access status (`FULL_SOURCE_REVIEWED`, `PARTIAL_SOURCE_REVIEWED`,
  `SOURCE_IDENTIFIED_NOT_ACCESSED`, or `SOURCE_NOT_LOCATED`) and blocker
  reason, if any;
- the scope actually confirmed and the scope still missing;
- fallback source(s) attempted and what they did not support;
- the currently affected result or Study scope;
- the re-entry condition;
- last checked date.

Do not delete a resolved entry: mark it resolved in place with the resolving
source and date, or archive it under this repository's existing
documentation-archival convention if one applies. Step 6 item 6 requires
re-searching every previously recorded unresolved case in a later run before
leaving it unresolved again; update or resolve its handover entry accordingly.
