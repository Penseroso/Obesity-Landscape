/**
 * test/research-preflight.test.mjs
 *
 * Offline, zero-network unit test suite for research preflight architecture.
 * Verifies all invariant guarantees, safety gates, and regression cases.
 */

import assert from "node:assert";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  CURRENT_FINGERPRINT_VERSION,
  KNOWN_SEC_CIKS,
  canAdvanceCheckpoint,
  canonicalizeJson,
  computeNoticeFingerprint,
  computeScientificFingerprint,
  evaluatePreflight,
  loadCompanyContext,
  parseArgs,
  parseEfetchXml,
  probeLiteratureDiscovery,
  probeLiteratureHealth,
  probeRegistryDiscovery,
  probeRegistryUpdate,
  probeSecFilings,
  resolveCik,
  resolveDoisAndPmcsToPmids,
  saveBaselineCheckpoint,
} from "../scripts/research-preflight.mjs";

const ROOT = process.cwd();

// Synthetic sample study data
const baseStudy = {
  protocolSection: {
    identificationModule: {
      nctId: "NCT06068946",
      briefTitle: "A Study to Evaluate the Efficacy and Safety of VK2735 in Patients With Obesity",
    },
    statusModule: {
      overallStatus: "COMPLETED",
      startDateStruct: { date: "2023-09-01" },
      primaryCompletionDateStruct: { date: "2024-02-01" },
      completionDateStruct: { date: "2024-02-27" },
      lastUpdatePostDateStruct: { date: "2024-03-01" },
    },
    designModule: {
      phases: ["PHASE_2"],
      designInfo: { allocation: "RANDOMIZED", interventionModel: "PARALLEL" },
      enrollmentInfo: { count: 176 },
    },
    armsInterventionsModule: {
      armGroups: [
        {
          label: "VK2735 2.5 mg",
          type: "EXPERIMENTAL",
          description: "2.5 mg once weekly for 13 weeks",
          interventionNames: ["Drug: VK2735"],
        },
        {
          label: "Placebo",
          type: "PLACEBO_COMPARATOR",
          description: "Matching placebo once weekly for 13 weeks",
          interventionNames: ["Drug: Placebo"],
        },
      ],
      interventions: [
        {
          name: "VK2735",
          type: "DRUG",
          description: "Dual GLP-1/GIP receptor agonist",
          armGroupLabels: ["VK2735 2.5 mg"],
        },
      ],
    },
    eligibilityModule: {
      eligibilityCriteria: "Inclusion: BMI >= 30 kg/m2. Exclusion: T2D.",
      healthyVolunteers: false,
      sex: "ALL",
      minimumAge: "18 Years",
      maximumAge: "75 Years",
      stdAges: ["ADULT", "OLDER_ADULT"],
    },
    outcomesModule: {
      primaryOutcomes: [
        {
          measure: "Percent change in body weight from baseline to Week 13",
          timeFrame: "Baseline to Week 13",
          description: "Percentage reduction in body weight assessed via calibrated scale.",
        },
      ],
      secondaryOutcomes: [
        {
          measure: "Proportion of participants achieving >= 5% weight loss",
          timeFrame: "Week 13",
          description: "Categorical response rate.",
        },
      ],
    },
    contactsLocationsModule: {
      centralContacts: [
        { name: "Clinical Trial Operations", phone: "858-704-4400", email: "clinical@vikingtx.com" },
      ],
      locations: [
        { facility: "Research Site 1", city: "San Diego", state: "California", zip: "92121", country: "United States" },
      ],
    },
  },
};

test("Test 1: Administrative-only update -> ADMIN_UPDATE_BYPASS", async () => {
  const { hash } = computeScientificFingerprint(baseStudy);

  const context = {
    knownNCTs: ["NCT06068946"],
    baseline: {
      discoveryCheckpoint: {
        clinicalTrials: {
          semanticFingerprintVersion: CURRENT_FINGERPRINT_VERSION,
          knownNCTs: {
            NCT06068946: {
              lastUpdatePostDate: "2024-03-01",
              semanticHash: hash,
            },
          },
        },
      },
    },
  };

  // Study has updated post date, but scientific fields are unchanged
  const studyWithNewPostDate = JSON.parse(JSON.stringify(baseStudy));
  studyWithNewPostDate.protocolSection.statusModule.lastUpdatePostDateStruct.date = "2024-05-15";
  studyWithNewPostDate.protocolSection.contactsLocationsModule.locations.push({
    facility: "Research Site 2",
    city: "Austin",
    state: "Texas",
  });

  const mockFetch = async () => ({
    ok: true,
    json: async () => studyWithNewPostDate,
  });

  const updateRes = await probeRegistryUpdate(context, mockFetch);
  assert.strictEqual(updateRes.results.length, 1);
  assert.strictEqual(updateRes.results[0].deltaVerdict, "ADMIN_UPDATE_BYPASS");
  assert.strictEqual(updateRes.results[0].scientificHash, hash);
  assert.strictEqual(updateRes.hasDelta, false);
  assert.strictEqual(updateRes.hasError, false);
  assert.match(updateRes.results[0].deltaMessage, /Administrative update only/);
});

test("Test 2: Dose/intervention scientific change -> SCIENTIFIC_UPDATE_DETECTED", async () => {
  const baseFp = computeScientificFingerprint(baseStudy);

  // 1. Contact info change alone does NOT change scientific hash
  const studyWithContactChange = JSON.parse(JSON.stringify(baseStudy));
  studyWithContactChange.protocolSection.contactsLocationsModule.centralContacts = [
    { name: "New Contact Person", phone: "800-555-0199", email: "new@vikingtx.com" },
  ];
  const contactChangeFp = computeScientificFingerprint(studyWithContactChange);
  assert.strictEqual(
    contactChangeFp.hash,
    baseFp.hash,
    "Contact changes must not alter the scientific fingerprint hash",
  );

  // 2. Dose / arm description change DOES change scientific hash
  const studyWithDoseChange = JSON.parse(JSON.stringify(baseStudy));
  studyWithDoseChange.protocolSection.armsInterventionsModule.armGroups[0].description =
    "2.5 mg once weekly for 3 weeks followed by 5.0 mg for 10 weeks";
  studyWithDoseChange.protocolSection.statusModule.lastUpdatePostDateStruct.date = "2024-06-01";

  const doseChangeFp = computeScientificFingerprint(studyWithDoseChange);
  assert.notStrictEqual(
    doseChangeFp.hash,
    baseFp.hash,
    "Arm/regimen description modification must alter the scientific fingerprint hash",
  );

  const context = {
    knownNCTs: ["NCT06068946"],
    baseline: {
      discoveryCheckpoint: {
        clinicalTrials: {
          semanticFingerprintVersion: CURRENT_FINGERPRINT_VERSION,
          knownNCTs: {
            NCT06068946: {
              lastUpdatePostDate: "2024-03-01",
              semanticHash: baseFp.hash,
            },
          },
        },
      },
    },
  };

  const mockFetch = async () => ({
    ok: true,
    json: async () => studyWithDoseChange,
  });

  const updateRes = await probeRegistryUpdate(context, mockFetch);
  assert.strictEqual(updateRes.results.length, 1);
  assert.strictEqual(updateRes.results[0].deltaVerdict, "SCIENTIFIC_UPDATE_DETECTED");
  assert.strictEqual(updateRes.hasDelta, true);
  assert.match(updateRes.results[0].deltaMessage, /Scientific protocol changed/);
});

test("Test 3: Discovery network failure -> CLEAN forbidden (ACCESS_UNKNOWN / PARTIAL / FETCH_ERROR)", async () => {
  const context = {
    companyId: "viking-therapeutics",
    companyName: "Viking Therapeutics, Inc.",
    knownNCTs: ["NCT06068946"],
    knownPMIDs: ["38411234"],
    assetAliases: ["VK2735"],
    targetAssetId: null,
    baseline: {
      discoveryCheckpoint: {
        asOf: "2024-03-01",
      },
    },
  };

  const failingFetch = async () => {
    throw new Error("Network timeout: failed to connect to upstream server");
  };

  // 1. Registry Discovery network failure
  const regDisc = await probeRegistryDiscovery(context, failingFetch);
  assert.strictEqual(regDisc.deltaVerdict, "FETCH_ERROR");
  assert.strictEqual(regDisc.hasError, true);
  assert.notStrictEqual(regDisc.deltaVerdict, "CLEAN");

  // 2. Literature Discovery network failure
  const litDisc = await probeLiteratureDiscovery(context, failingFetch);
  assert.strictEqual(litDisc.deltaVerdict, "NETWORK_ERROR");
  assert.strictEqual(litDisc.hasError, true);
  assert.notStrictEqual(litDisc.deltaVerdict, "CLEAN");

  // 3. Literature Health network failure
  const litHealth = await probeLiteratureHealth(context, failingFetch);
  assert.strictEqual(litHealth.deltaVerdict, "NETWORK_ERROR");
  assert.strictEqual(litHealth.hasError, true);
  assert.notStrictEqual(litHealth.deltaVerdict, "CLEAN");

  // 4. SEC EDGAR network failure
  const sec = await probeSecFilings("viking-therapeutics", null, null, context, failingFetch);
  assert.strictEqual(sec.deltaVerdict, "NETWORK_ERROR");
  assert.strictEqual(sec.hasError, true);
  assert.notStrictEqual(sec.deltaVerdict, "CLEAN");

  // 5. Composite verdict must promote child network errors
  const composite = evaluatePreflight(context, null, regDisc, litHealth, litDisc, sec);
  assert.strictEqual(composite.compositeVerdict, "FETCH_ERROR");
  assert.strictEqual(composite.hasErrors, true);
  assert.notStrictEqual(composite.compositeVerdict, "CLEAN");
});

test("Test 4: Unresolved delta -> checkpoint write blocked", async () => {
  const context = {
    companyId: "viking-therapeutics",
    targetFile: path.join(ROOT, "domains", "company-pipeline", "data", "companies", "viking-therapeutics", "company.json"),
    targetFileExists: true,
    baseline: {
      discoveryCheckpoint: {
        asOf: "2024-03-01",
        clinicalTrials: {},
        secEdgar: { latestAcceptanceDateTime: "2024-03-01T16:00:00.000Z" },
      },
    },
  };

  const updateRes = {
    hasDelta: true,
    hasError: false,
    hasIncomplete: false,
    deltaVerdict: "SCIENTIFIC_UPDATE_DETECTED",
    results: [{ nctId: "NCT06068946", deltaVerdict: "SCIENTIFIC_UPDATE_DETECTED" }],
  };
  const secRes = {
    status: "OK",
    deltaVerdict: "NEW_FILINGS_DETECTED",
    hasDelta: true,
    hasError: false,
    hasIncomplete: false,
    newFilingsCount: 2,
    filings: [{ form: "8-K" }],
  };

  // Attempt advance without ack flags -> must be BLOCKED
  const gateWithoutAck = canAdvanceCheckpoint(context, updateRes, null, null, null, secRes, { advance: true });
  assert.strictEqual(gateWithoutAck.allowed, false);
  assert.match(gateWithoutAck.reason, /Unresolved deltas detected/);
  assert.match(gateWithoutAck.reason, /Registry scientific updates/);
  assert.match(gateWithoutAck.reason, /SEC filings/);

  // Attempt advance with partial ack (only ackFilings) -> still blocked by registry update
  const gatePartialAck = canAdvanceCheckpoint(context, updateRes, null, null, null, secRes, { advance: true, ackFilings: true });
  assert.strictEqual(gatePartialAck.allowed, false);
  assert.match(gatePartialAck.reason, /Registry scientific updates/);

  // Attempt advance with full ack (--ack-deltas) -> ALLOWED
  const gateFullAck = canAdvanceCheckpoint(context, updateRes, null, null, null, secRes, { advance: true, ackDeltas: true });
  assert.strictEqual(gateFullAck.allowed, true);
});

test("Test 5: Legacy no-checkpoint -> bootstrap baseline allowed", async () => {
  const cleanContextNoBaseline = {
    companyId: "novo-nordisk",
    targetFile: path.join(ROOT, "domains", "company-pipeline", "data", "companies", "novo-nordisk", "company.json"),
    targetFileExists: true,
    baseline: null,
  };

  const updateRes = {
    hasDelta: false,
    hasError: false,
    hasIncomplete: false,
    deltaVerdict: "LEGACY_UNBASELINED",
    results: [{ nctId: "NCT01234567", deltaVerdict: "LEGACY_UNBASELINED", lastUpdatePostDate: "2024-01-01", scientificHash: "abc123" }],
  };
  const secRes = { status: "OK", deltaVerdict: "LEGACY_UNBASELINED", hasDelta: false, hasError: false, hasIncomplete: false, allRecentKeyFilings: [] };

  // Bootstrap allowed when baseline is null
  const bootstrapGate = canAdvanceCheckpoint(cleanContextNoBaseline, updateRes, null, null, null, secRes, { bootstrap: true });
  assert.strictEqual(bootstrapGate.allowed, true);

  // Advance NOT allowed when baseline is null
  const advanceGate = canAdvanceCheckpoint(cleanContextNoBaseline, updateRes, null, null, null, secRes, { advance: true });
  assert.strictEqual(advanceGate.allowed, false);
  assert.match(advanceGate.reason, /No existing baseline to advance/);

  // Bootstrap NOT allowed when baseline already exists
  const contextWithBaseline = {
    companyId: "novo-nordisk",
    targetFile: path.join(ROOT, "domains", "company-pipeline", "data", "companies", "novo-nordisk", "company.json"),
    targetFileExists: true,
    baseline: { discoveryCheckpoint: { asOf: "2024-01-01" } },
  };
  const bootstrapOnExisting = canAdvanceCheckpoint(contextWithBaseline, updateRes, null, null, null, secRes, { bootstrap: true });
  assert.strictEqual(bootstrapOnExisting.allowed, false);
  assert.match(bootstrapOnExisting.reason, /Baseline already established/);
});

test("Test 6: New NCT / new PMID / new SEC filing -> delta detection", async () => {
  // 1. Registry Discovery finds new trial
  const mockStudyResult = {
    studies: [
      {
        protocolSection: {
          identificationModule: { nctId: "NCT09999999", briefTitle: "Brand New Trial" },
          statusModule: { overallStatus: "RECRUITING", lastUpdatePostDateStruct: { date: "2024-06-01" } },
        },
      },
    ],
  };
  const regContext = {
    companyName: "Structure Therapeutics",
    knownNCTs: ["NCT07169942"],
    assetAliases: ["GSBR-1290"],
    targetAssetId: null,
  };
  const mockCtGovFetch = async () => ({
    ok: true,
    json: async () => mockStudyResult,
  });
  const regDisc = await probeRegistryDiscovery(regContext, mockCtGovFetch);
  assert.strictEqual(regDisc.deltaVerdict, "NEW_TRIALS_DETECTED");
  assert.strictEqual(regDisc.hasDelta, true);
  assert.strictEqual(regDisc.newlyDiscoveredCount, 1);
  assert.strictEqual(regDisc.newlyDiscovered[0].nctId, "NCT09999999");

  // 2. Literature Health detects Erratum and Retraction via EFetch XML
  const syntheticEfetchXml = `
    <PubmedArticleSet>
      <PubmedArticle>
        <MedlineCitation>
          <PMID>42302084</PMID>
          <Article>
            <ArticleTitle>Structure-based design of oral peptide agonists</ArticleTitle>
            <PublicationType>Journal Article</PublicationType>
            <CommentsCorrectionsList>
              <CommentsCorrections RefType="ErratumIn">
                <RefSource>PLoS Pathog. 2026;22(2):e1013456</RefSource>
                <PMID>42309999</PMID>
              </CommentsCorrections>
            </CommentsCorrectionsList>
          </Article>
        </MedlineCitation>
      </PubmedArticle>
      <PubmedArticle>
        <MedlineCitation>
          <PMID>42676624</PMID>
          <Article>
            <ArticleTitle>Flawed analysis of GLP-1 kinetics</ArticleTitle>
            <PublicationType>Retracted Publication</PublicationType>
          </Article>
        </MedlineCitation>
      </PubmedArticle>
    </PubmedArticleSet>
  `;
  const litContext = {
    knownPMIDs: ["42302084", "42676624"],
    baseline: {
      discoveryCheckpoint: {
        literature: {
          monitoredPMIDs: {
            "42302084": { status: "clean" },
            "42676624": { status: "clean" },
          },
        },
      },
    },
  };
  const mockXmlFetch = async () => ({
    ok: true,
    text: async () => syntheticEfetchXml,
  });
  const litHealth = await probeLiteratureHealth(litContext, mockXmlFetch);
  assert.strictEqual(litHealth.deltaVerdict, "RETRACTION_DETECTED");
  assert.strictEqual(litHealth.checked[0].deltaVerdict, "NEW_ERRATUM_DETECTED");
  assert.strictEqual(litHealth.checked[1].deltaVerdict, "RETRACTION_DETECTED");
  assert.strictEqual(litHealth.hasDelta, true);
  assert.strictEqual(litHealth.newErrataCount, 2);

  // 3. SEC EDGAR detects new filing past baseline
  const secMockData = {
    name: "Structure Therapeutics Inc.",
    filings: {
      recent: {
        form: ["8-K", "10-Q"],
        filingDate: ["2024-07-01", "2024-05-01"],
        acceptanceDateTime: ["2024-07-01T16:05:00.000Z", "2024-05-01T16:00:00.000Z"],
        accessionNumber: ["0001888886-24-000020", "0001888886-24-000015"],
        primaryDocument: ["gpcr-20240701.htm", "gpcr-20240501.htm"],
        primaryDocDescription: ["Current Report", "Quarterly Report"],
      },
    },
  };
  const mockSecFetch = async () => ({
    ok: true,
    json: async () => secMockData,
  });
  const checkpoint = { secEdgar: { latestAcceptanceDateTime: "2024-06-01T00:00:00.000Z" } };
  const secRes = await probeSecFilings("structure-therapeutics", "0001888886", checkpoint, null, mockSecFetch);
  assert.strictEqual(secRes.deltaVerdict, "NEW_FILINGS_DETECTED");
  assert.strictEqual(secRes.hasDelta, true);
  assert.strictEqual(secRes.newFilingsCount, 1);
  assert.strictEqual(secRes.filings[0].accessionNumber, "0001888886-24-000020");
});

test("Test 7: Asset-scoped run -> sibling asset excluded", async () => {
  const fullCompanyContext = await loadCompanyContext("structure-therapeutics");
  assert.ok(fullCompanyContext.assetAliases.includes("GSBR-1290"));
  assert.ok(fullCompanyContext.assetAliases.includes("ACCG-3535"));
  assert.ok(fullCompanyContext.assetAliases.includes("ANPA-0073"));

  // Scoped to gsbr-1290
  const scopedContext = await loadCompanyContext("structure-therapeutics", "gsbr-1290");
  assert.strictEqual(scopedContext.targetAssetId, "gsbr-1290");
  assert.ok(scopedContext.assetAliases.includes("GSBR-1290"));
  assert.ok(scopedContext.assetAliases.includes("Aleniglipron"));

  // Sibling assets ACCG-3535 and ANPA-0073 MUST NOT contaminate scoped run
  assert.strictEqual(
    scopedContext.assetAliases.includes("ACCG-3535"),
    false,
    "Sibling asset ACCG-3535 must be excluded from asset-scoped aliases",
  );
  assert.strictEqual(
    scopedContext.assetAliases.includes("ANPA-0073"),
    false,
    "Sibling asset ANPA-0073 must be excluded from asset-scoped aliases",
  );
});

test("Test 8: Generated outputs -> researchState omitted", () => {
  const generatedCompaniesPath = path.join(ROOT, "data", "generated", "companies.json");
  assert.ok(fs.existsSync(generatedCompaniesPath), "data/generated/companies.json must exist");

  const generatedCompanies = JSON.parse(fs.readFileSync(generatedCompaniesPath, "utf8"));
  assert.ok(generatedCompanies.length > 0, "Generated companies array must not be empty");

  for (const company of generatedCompanies) {
    assert.strictEqual(
      company.researchState,
      undefined,
      `Company '${company.id}' in data/generated/companies.json must NOT expose internal researchState metadata`,
    );
  }
});

// ============================================================================
// REGRESSION TESTS FOR 10 REMAINING DEFECTS
// ============================================================================

test("Regression 1: Mixed state delta + fetch error -> write BLOCKED even with --ack-deltas", () => {
  const context = {
    companyId: "viking-therapeutics",
    targetFile: path.join(ROOT, "domains", "company-pipeline", "data", "companies", "viking-therapeutics", "company.json"),
    targetFileExists: true,
    baseline: {
      discoveryCheckpoint: {
        asOf: "2024-03-01",
        clinicalTrials: {},
      },
    },
  };

  // Mixed state: 1 new trial discovered, but sponsor query encountered a fetch error
  const discRes = {
    deltaVerdict: "NEW_TRIALS_DETECTED",
    hasDelta: true,
    hasError: true,
    hasIncomplete: false,
    newlyDiscoveredCount: 1,
    newlyDiscovered: [{ nctId: "NCT09999999" }],
  };

  const gate = canAdvanceCheckpoint(context, null, discRes, null, null, null, { advance: true, ackDeltas: true });
  assert.strictEqual(gate.allowed, false, "Must block write when hasError is true, despite ackDeltas");
  assert.match(gate.reason, /Errors or incomplete data detected/);
});

test("Regression 2: Mixed state delta + truncation -> write BLOCKED even with --ack-deltas", () => {
  const context = {
    companyId: "viking-therapeutics",
    targetFile: path.join(ROOT, "domains", "company-pipeline", "data", "companies", "viking-therapeutics", "company.json"),
    targetFileExists: true,
    baseline: {
      discoveryCheckpoint: {
        asOf: "2024-03-01",
        clinicalTrials: {},
      },
    },
  };

  // Mixed state: 2 new publications discovered, but pagination was truncated
  const litDiscRes = {
    deltaVerdict: "NEW_PUBLICATIONS_DETECTED",
    hasDelta: true,
    hasError: false,
    hasIncomplete: true,
    newDiscoveredCount: 2,
    truncated: true,
  };

  const gate = canAdvanceCheckpoint(context, null, null, null, litDiscRes, null, { advance: true, ackDeltas: true });
  assert.strictEqual(gate.allowed, false, "Must block write when hasIncomplete is true, despite ackDeltas");
  assert.match(gate.reason, /Errors or incomplete data detected/);
});

test("Regression 3: Semantic fingerprint version mismatch -> REBASELINE_REQUIRED", async () => {
  const { hash } = computeScientificFingerprint(baseStudy);

  // Baseline has old version 1, whereas current version is 2
  const context = {
    knownNCTs: ["NCT06068946"],
    baseline: {
      discoveryCheckpoint: {
        clinicalTrials: {
          semanticFingerprintVersion: 1, // old version
          knownNCTs: {
            NCT06068946: {
              lastUpdatePostDate: "2024-03-01",
              semanticHash: hash,
            },
          },
        },
      },
    },
  };

  const mockFetch = async () => ({
    ok: true,
    json: async () => baseStudy,
  });

  const updateRes = await probeRegistryUpdate(context, mockFetch);
  assert.strictEqual(updateRes.deltaVerdict, "REBASELINE_REQUIRED");
  assert.strictEqual(updateRes.isVersionMismatch, true);
  assert.strictEqual(updateRes.hasDelta, true);
  assert.strictEqual(updateRes.results[0].deltaVerdict, "REBASELINE_REQUIRED");
  assert.match(updateRes.results[0].deltaMessage, /Semantic fingerprint version mismatch/);
});

test("Regression 4: Asset bootstrap without canonical CE file -> blocked with ASSET_CANONICAL_TARGET_MISSING", async () => {
  // Target asset has no clinical-evidence.json
  const context = await loadCompanyContext("structure-therapeutics", "non-existent-synthetic-asset");
  assert.strictEqual(context.targetAssetId, "non-existent-synthetic-asset");
  assert.strictEqual(context.targetFileExists, false);
  assert.notStrictEqual(context.targetFile, path.join(ROOT, "domains", "company-pipeline", "data", "companies", "structure-therapeutics", "company.json"));

  const gate = canAdvanceCheckpoint(context, null, null, null, null, null, { bootstrap: true });
  assert.strictEqual(gate.allowed, false);
  assert.match(gate.reason, /ASSET_CANONICAL_TARGET_MISSING/);
});

test("Regression 5: Regimen components[].assetId scope correctly includes related and excludes unrelated sibling regimens", async () => {
  // Eli Lilly: ly3298176 (Tirzepatide)
  const tirzContext = await loadCompanyContext("eli-lilly-and-company", "ly3298176");

  // In Lilly regimens.json:
  // "eli-lilly-and-company-bimagrumab-tirzepatide-obesity" components:
  // [{ "assetName": "Bimagrumab" }, { "assetId": "ly3298176" }] -> cites NCT06643728
  assert.ok(
    tirzContext.knownNCTs.includes("NCT06643728"),
    "NCT06643728 from Bimagrumab+Tirzepatide regimen component must be included in Tirzepatide scope",
  );

  // In Lilly regimens.json:
  // "eli-lilly-and-company-bimagrumab-semaglutide-obesity" components:
  // [{ "assetName": "Bimagrumab" }, { "assetName": "Semaglutide" }] -> cites NCT05616013 (no Tirzepatide)
  assert.strictEqual(
    tirzContext.knownNCTs.includes("NCT05616013"),
    false,
    "NCT05616013 from Bimagrumab+Semaglutide regimen must NOT be included in Tirzepatide scope",
  );
});

test("Regression 6: ESearch new PMID found + ESummary failure -> delta preserved, hasIncomplete flagged, never CLEAN", async () => {
  const context = {
    knownPMIDs: ["11111111"],
    assetAliases: ["TestAssetX"],
  };

  const mockFetch = async (url) => {
    if (url.includes("esearch.fcgi")) {
      return {
        ok: true,
        json: async () => ({
          esearchresult: { count: "2", idlist: ["11111111", "99999999"] }, // 99999999 is brand new
        }),
      };
    }
    if (url.includes("esummary.fcgi")) {
      // Upstream ESummary service 500 error
      return { ok: false, status: 500 };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const litDisc = await probeLiteratureDiscovery(context, mockFetch);
  assert.strictEqual(litDisc.deltaVerdict, "NEW_PUBLICATIONS_DETECTED");
  assert.strictEqual(litDisc.hasDelta, true);
  assert.strictEqual(litDisc.hasIncomplete, true, "Must flag hasIncomplete when summary enrichment fails");
  assert.notStrictEqual(litDisc.deltaVerdict, "CLEAN");
  assert.strictEqual(litDisc.newPMIDs.length, 1);
  assert.strictEqual(litDisc.newPMIDs[0].pmid, "99999999");
});

test("Regression 7: Canonical CIK vs checkpoint CIK disagreement -> CIK_CONFLICT", async () => {
  const conflictingContext = {
    company: { secCik: "0001888886" }, // Structure CIK
    baseline: { discoveryCheckpoint: { secEdgar: { cik: "0001607678" } } }, // Viking CIK
  };

  const resolved = resolveCik("structure-therapeutics", null, conflictingContext);
  assert.strictEqual(resolved.status, "CIK_CONFLICT");
  assert.strictEqual(resolved.cik, null);
  assert.match(resolved.message, /CIK conflict detected/);

  const secRes = await probeSecFilings("structure-therapeutics", null, null, conflictingContext);
  assert.strictEqual(secRes.status, "CIK_CONFLICT");
  assert.strictEqual(secRes.deltaVerdict, "CIK_CONFLICT");
  assert.strictEqual(secRes.hasError, true);
});

test("Regression 8: Ambiguous checkpoint write mode without --bootstrap/--advance is blocked", () => {
  const context = {
    companyId: "viking-therapeutics",
    targetFile: path.join(ROOT, "domains", "company-pipeline", "data", "companies", "viking-therapeutics", "company.json"),
    targetFileExists: true,
    baseline: { discoveryCheckpoint: { asOf: "2024-03-01" } },
  };

  // Calling canAdvanceCheckpoint with empty flags (or legacy ambiguous flags) must be rejected
  const gateNoMode = canAdvanceCheckpoint(context, null, null, null, null, null, {});
  assert.strictEqual(gateNoMode.allowed, false);
  assert.match(gateNoMode.reason, /Ambiguous mode/);

  // parseArgs correctly parses explicit modes
  const parsedBootstrap = parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--bootstrap"]);
  assert.strictEqual(parsedBootstrap.bootstrap, true);
  assert.strictEqual(parsedBootstrap.advance, false);

  const parsedAdvance = parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--advance"]);
  assert.strictEqual(parsedAdvance.advance, true);
  assert.strictEqual(parsedAdvance.bootstrap, false);

  const parsedAckDeltas = parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--ack-deltas"]);
  assert.strictEqual(parsedAckDeltas.ackDeltas, true);
  assert.strictEqual(parsedAckDeltas.ackFilings, true);
  assert.strictEqual("verbose" in parsedAckDeltas, false);

  // Deprecated --ack-all triggers exit(1)
  const origExit = process.exit;
  const origError = console.error;
  let exitCode = null;
  let errorMsg = "";
  try {
    process.exit = (code) => { exitCode = code; throw new Error("EXIT"); };
    console.error = (msg) => { errorMsg = msg; };
    assert.throws(() => parseArgs(["node", "research-preflight.mjs", "--ack-all"]), /EXIT/);
    assert.strictEqual(exitCode, 1);
    assert.match(errorMsg, /'--ack-all' is deprecated/);
  } finally {
    process.exit = origExit;
    console.error = origError;
  }
});

test("Regression 9: Package engines node requirement is at least >=22.19.0", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.ok(pkg.engines?.node, "package.json must declare engines.node");
  assert.match(pkg.engines.node, />=22\.19\.0/, "engines.node must require >=22.19.0 for reliable system CA");
});

test("Regression 10: saveBaselineCheckpoint defends unrun probes against map deletion", () => {
  const tempDir = path.join(ROOT, "test", "fixtures");
  fs.mkdirSync(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, "temp-test-checkpoint.json");

  const initialJson = {
    id: "temp-company",
    name: "Temp Company",
    researchState: {
      checkpointVersion: 1,
      workflowRevision: "ADR-0070",
      discoveryCheckpoint: {
        asOf: "2026-01-01",
        clinicalTrials: {
          knownNCTs: {
            NCT09999999: { lastUpdatePostDate: "2026-01-01", semanticHash: "dummyhash123" },
          },
        },
        literature: {
          monitoredPMIDs: {
            "99999999": { status: "clean", lastCheckedAt: "2026-01-01" },
          },
        },
        secEdgar: { cik: "0009999999", latestAcceptanceDateTime: "2026-01-01T00:00:00.000Z" },
      },
    },
  };
  fs.writeFileSync(tempFile, JSON.stringify(initialJson, null, 2), "utf8");

  try {
    const context = {
      companyId: "temp-company",
      companyName: "Temp Company",
      targetFile: tempFile,
      knownNCTs: ["NCT09999999"],
      knownPMIDs: ["99999999"],
      assetAliases: ["TEMP"],
      baseline: initialJson.researchState,
    };

    // When saveBaselineCheckpoint is called with null updateRes & healthRes (e.g. only SEC probe ran)
    const mockSecRes = {
      status: "OK",
      cik: "0009999999",
      allRecentKeyFilings: [{ acceptanceDateTime: "2026-02-01T00:00:00.000Z", accessionNumber: "0001" }],
    };

    const saved = saveBaselineCheckpoint(context, null, null, mockSecRes);
    assert.ok(saved.targetPath, "saveBaselineCheckpoint must return targetPath");
    const written = JSON.parse(fs.readFileSync(tempFile, "utf8"));

    // Checkpoint must NOT wipe knownNCTs or monitoredPMIDs to {}
    assert.strictEqual(
      written.researchState.discoveryCheckpoint.clinicalTrials.knownNCTs["NCT09999999"]?.semanticHash,
      "dummyhash123",
      "Unrun trial probe must preserve previous knownNCTs baseline data",
    );
    assert.strictEqual(
      written.researchState.discoveryCheckpoint.literature.monitoredPMIDs["99999999"]?.status,
      "clean",
      "Unrun literature probe must preserve previous monitoredPMIDs baseline data",
    );
    assert.strictEqual(
      written.researchState.discoveryCheckpoint.secEdgar.latestAcceptanceDateTime,
      "2026-02-01T00:00:00.000Z",
      "Executed SEC probe must update acceptance timestamp",
    );
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
});

test("Regression 11: Erratum to Retraction transition triggers RETRACTION_DETECTED and flags new delta", async () => {
  const pmid = "12345678";
  const initialNotices = [{ refType: "ErratumIn", source: "Nat Med. 2026", noticePmid: "12345679" }];
  const initialFp = computeNoticeFingerprint(initialNotices, false);

  const context = {
    knownPMIDs: [pmid],
    baseline: {
      discoveryCheckpoint: {
        literature: {
          monitoredPMIDs: {
            [pmid]: {
              status: "has-erratum",
              noticeFingerprint: initialFp,
              noticeTypes: ["ErratumIn"],
              lastCheckedAt: "2026-09-01",
            },
          },
        },
      },
    },
  };

  // 1. Same erratum notice -> KNOWN_ERRATUM, no delta
  const sameErratumXml = `
    <PubmedArticle>
      <MedlineCitation>
        <PMID>${pmid}</PMID>
        <Article><ArticleTitle>Test Study</ArticleTitle></Article>
        <CommentsCorrectionsList>
          <CommentsCorrections RefType="ErratumIn">
            <RefSource>Nat Med. 2026</RefSource>
            <PMID>12345679</PMID>
          </CommentsCorrections>
        </CommentsCorrectionsList>
      </MedlineCitation>
    </PubmedArticle>
  `;
  const resSame = await probeLiteratureHealth(context, async () => ({ ok: true, text: async () => sameErratumXml }));
  assert.strictEqual(resSame.checked[0].deltaVerdict, "KNOWN_ERRATUM");
  assert.strictEqual(resSame.hasDelta, false);
  assert.strictEqual(resSame.newErrataCount, 0);

  // 2. Paper receives subsequent Retraction -> RETRACTION_DETECTED, hasDelta = true!
  const retractedXml = `
    <PubmedArticle>
      <MedlineCitation>
        <PMID>${pmid}</PMID>
        <Article><ArticleTitle>Test Study</ArticleTitle></Article>
        <CommentsCorrectionsList>
          <CommentsCorrections RefType="ErratumIn">
            <RefSource>Nat Med. 2026</RefSource>
            <PMID>12345679</PMID>
          </CommentsCorrections>
          <CommentsCorrections RefType="RetractionIn">
            <RefSource>Nat Med. 2027</RefSource>
            <PMID>12345680</PMID>
          </CommentsCorrections>
        </CommentsCorrectionsList>
      </MedlineCitation>
    </PubmedArticle>
  `;
  const resRetracted = await probeLiteratureHealth(context, async () => ({ ok: true, text: async () => retractedXml }));
  assert.strictEqual(resRetracted.checked[0].deltaVerdict, "RETRACTION_DETECTED");
  assert.strictEqual(resRetracted.checked[0].status, "retracted");
  assert.strictEqual(resRetracted.hasDelta, true);
  assert.strictEqual(resRetracted.newErrataCount, 1);
  assert.strictEqual(resRetracted.deltaVerdict, "RETRACTION_DETECTED");
});

test("Regression 12: Unbaselined target with adverse notice is BLOCKED on --bootstrap without --ack-deltas", () => {
  const cleanContextNoBaseline = {
    companyId: "temp-unbaselined",
    targetFile: path.join(ROOT, "domains", "company-pipeline", "data", "companies", "viking-therapeutics", "company.json"),
    targetFileExists: true,
    baseline: null,
  };

  const healthResWithErratum = {
    citedCount: 1,
    errataCount: 1,
    newErrataCount: 1,
    deltaVerdict: "NEW_ERRATUM_DETECTED",
    hasDelta: true,
    hasError: false,
    hasIncomplete: false,
    checked: [{ pmid: "99999999", status: "has-erratum", deltaVerdict: "NEW_ERRATUM_DETECTED", hasDelta: true }],
  };

  // Attempt bootstrap without ack -> BLOCKED!
  const gateWithoutAck = canAdvanceCheckpoint(cleanContextNoBaseline, null, null, healthResWithErratum, null, null, { bootstrap: true });
  assert.strictEqual(gateWithoutAck.allowed, false);
  assert.match(gateWithoutAck.reason, /Bootstrap write blocked/);
  assert.match(gateWithoutAck.reason, /Adverse literature notices/);

  // Attempt bootstrap with explicit ack-deltas -> ALLOWED!
  const gateWithAck = canAdvanceCheckpoint(cleanContextNoBaseline, null, null, healthResWithErratum, null, null, { bootstrap: true, ackDeltas: true });
  assert.strictEqual(gateWithAck.allowed, true);
});

test("Regression 13: Clinical Evidence company-wide bootstrap/advance targets company-research-state.json and does not touch company.json", async () => {
  const tempFixtureDir = path.join(ROOT, "test", "fixtures", "reg13");
  const tempCompanyDir = path.join(tempFixtureDir, "companies");
  const tempClinicalDir = path.join(tempFixtureDir, "clinical-evidence");

  fs.mkdirSync(path.join(tempCompanyDir, "mock-corp"), { recursive: true });
  fs.mkdirSync(path.join(tempClinicalDir, "mock-corp", "mock-asset"), { recursive: true });

  const initialCompanyJson = {
    id: "mock-corp",
    name: "Mock Corp",
    researchState: {
      checkpointVersion: 1,
      workflowRevision: "ADR-0070",
      discoveryCheckpoint: {
        asOf: "2026-01-01",
        clinicalTrials: { knownNCTs: {} },
        literature: { monitoredPMIDs: {} },
      },
    },
  };
  const companyJsonPath = path.join(tempCompanyDir, "mock-corp", "company.json");
  fs.writeFileSync(companyJsonPath, JSON.stringify(initialCompanyJson, null, 2) + "\n", "utf8");
  const originalCompanyJsonContent = fs.readFileSync(companyJsonPath, "utf8");

  const initialCeAssetJson = {
    clinicalEvidenceSchemaVersion: "3.1",
    companyId: "mock-corp",
    assetId: "mock-asset",
    studies: [
      {
        id: "mock-corp-mock-asset-study1",
        companyId: "mock-corp",
        assetId: "mock-asset",
        registryIdentifiers: [{ registry: "ClinicalTrials.gov", id: "NCT99990001" }],
      },
    ],
    arms: [],
    analysisGroups: [],
    endpoints: [],
    outcomes: [],
  };
  fs.writeFileSync(
    path.join(tempClinicalDir, "mock-corp", "mock-asset", "clinical-evidence.json"),
    JSON.stringify(initialCeAssetJson, null, 2) + "\n",
    "utf8",
  );

  // Load CE context for company-wide execution
  const ceContext = await loadCompanyContext("mock-corp", null, {
    companyDir: tempCompanyDir,
    clinicalDir: tempClinicalDir,
    domain: "clinical-evidence",
  });

  assert.strictEqual(ceContext.domain, "clinical-evidence");
  assert.strictEqual(
    ceContext.targetFile,
    path.join(tempClinicalDir, "mock-corp", "company-research-state.json"),
  );
  assert.ok(ceContext.knownNCTs.includes("NCT99990001"));

  // Bootstrap baseline checkpoint for Clinical Evidence company-wide
  const mockUpdateRes = {
    results: [
      {
        nctId: "NCT99990001",
        lastUpdatePostDate: "2026-09-15",
        scientificHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      },
    ],
  };
  const saved = saveBaselineCheckpoint(ceContext, mockUpdateRes, null, null);

  // 1. Assert company-research-state.json was created
  const envelopePath = path.join(tempClinicalDir, "mock-corp", "company-research-state.json");
  assert.strictEqual(saved.targetPath, envelopePath);
  assert.ok(fs.existsSync(envelopePath));

  const envelope = JSON.parse(fs.readFileSync(envelopePath, "utf8"));
  assert.strictEqual(envelope.companyId, "mock-corp");
  assert.strictEqual(envelope.researchState.checkpointVersion, 1);
  assert.ok(envelope.researchState.discoveryCheckpoint.clinicalTrials.knownNCTs["NCT99990001"]);

  // 2. Assert Company/Pipeline company.json was NEVER modified
  const currentCompanyJsonContent = fs.readFileSync(companyJsonPath, "utf8");
  assert.strictEqual(
    currentCompanyJsonContent,
    originalCompanyJsonContent,
    "Company/Pipeline company.json must NOT be touched by Clinical Evidence bootstrap/advance",
  );

  // Clean up
  fs.rmSync(tempFixtureDir, { recursive: true, force: true });
});

test("Regression 14: Company/Pipeline and Clinical Evidence maintain strictly isolated known NCT/PMID sets", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({ esearchresult: { idlist: [] } }),
  });

  // 1. Synthetic test verifying strict bidirectional isolation
  const tempFixtureDir = path.join(ROOT, "test", "fixtures", "reg14");
  const tempCompanyDir = path.join(tempFixtureDir, "companies");
  const tempClinicalDir = path.join(tempFixtureDir, "clinical-evidence");

  fs.mkdirSync(path.join(tempCompanyDir, "iso-corp"), { recursive: true });
  fs.mkdirSync(path.join(tempClinicalDir, "iso-corp", "iso-asset"), { recursive: true });

  fs.writeFileSync(
    path.join(tempCompanyDir, "iso-corp", "company.json"),
    JSON.stringify({ id: "iso-corp", name: "Isolation Corp", metadata: { sources: [{ url: "https://clinicaltrials.gov/study/NCT11111111", pmid: "11111111" }] } }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(tempClinicalDir, "iso-corp", "iso-asset", "clinical-evidence.json"),
    JSON.stringify({
      clinicalEvidenceSchemaVersion: "3.1",
      companyId: "iso-corp",
      assetId: "iso-asset",
      studies: [{
        id: "iso-study",
        companyId: "iso-corp",
        assetId: "iso-asset",
        registryIdentifiers: [{ registry: "ClinicalTrials.gov", id: "NCT22222222" }],
        metadata: { sources: [{ pmid: "22222222" }] },
      }],
      arms: [], analysisGroups: [], endpoints: [], outcomes: [],
    }, null, 2),
    "utf8",
  );

  const syntheticCpContext = await loadCompanyContext("iso-corp", null, {
    companyDir: tempCompanyDir,
    clinicalDir: tempClinicalDir,
    domain: "company-pipeline",
    fetchFn: mockFetch,
  });
  const syntheticCeContext = await loadCompanyContext("iso-corp", null, {
    companyDir: tempCompanyDir,
    clinicalDir: tempClinicalDir,
    domain: "clinical-evidence",
    fetchFn: mockFetch,
  });

  // Synthetic CP context knows ONLY CP sources
  assert.deepStrictEqual(syntheticCpContext.knownNCTs, ["NCT11111111"]);
  assert.deepStrictEqual(syntheticCpContext.knownPMIDs, ["11111111"]);
  assert.strictEqual(syntheticCpContext.knownNCTs.includes("NCT22222222"), false);
  assert.strictEqual(syntheticCpContext.knownPMIDs.includes("22222222"), false);

  // Synthetic CE context knows ONLY CE sources
  assert.deepStrictEqual(syntheticCeContext.knownNCTs, ["NCT22222222"]);
  assert.deepStrictEqual(syntheticCeContext.knownPMIDs, ["22222222"]);
  assert.strictEqual(syntheticCeContext.knownNCTs.includes("NCT11111111"), false);
  assert.strictEqual(syntheticCeContext.knownPMIDs.includes("11111111"), false);

  fs.rmSync(tempFixtureDir, { recursive: true, force: true });

  // 2. Real repo verification: Structure Therapeutics
  const cpStructureContext = await loadCompanyContext("structure-therapeutics", null, {
    domain: "company-pipeline",
    fetchFn: mockFetch,
  });
  const ceStructureContext = await loadCompanyContext("structure-therapeutics", null, {
    domain: "clinical-evidence",
    fetchFn: mockFetch,
  });

  // Company/Pipeline knows only its 3 active pipeline NCTs
  assert.deepStrictEqual(cpStructureContext.knownNCTs, ["NCT07400588", "NCT07654361", "NCT07654374"]);
  // Company/Pipeline must not know Clinical Evidence's 5 earlier/completed study NCTs
  assert.strictEqual(cpStructureContext.knownNCTs.includes("NCT05762471"), false);
  assert.strictEqual(cpStructureContext.knownNCTs.includes("NCT06139055"), false);
  assert.strictEqual(cpStructureContext.knownNCTs.includes("NCT06693843"), false);
  assert.strictEqual(cpStructureContext.knownNCTs.includes("NCT06703021"), false);
  assert.strictEqual(cpStructureContext.knownNCTs.includes("NCT07169942"), false);
  assert.strictEqual(cpStructureContext.knownPMIDs.length, 0);

  // Clinical Evidence knows all 8 of its authored studies
  assert.strictEqual(ceStructureContext.knownNCTs.length, 8);
  assert.ok(ceStructureContext.knownNCTs.includes("NCT05762471"));

  // 3. Real repo verification: Viking Therapeutics
  const cpVikingContext = await loadCompanyContext("viking-therapeutics", null, {
    domain: "company-pipeline",
    fetchFn: mockFetch,
  });
  const ceVikingContext = await loadCompanyContext("viking-therapeutics", null, {
    domain: "clinical-evidence",
    fetchFn: mockFetch,
  });

  // Company/Pipeline knows only its 2 pipeline NCTs
  assert.deepStrictEqual(cpVikingContext.knownNCTs, ["NCT07104383", "NCT07104500"]);
  // Company/Pipeline must not know Clinical Evidence's 3 completed trial NCTs
  assert.strictEqual(cpVikingContext.knownNCTs.includes("NCT05203237"), false);
  assert.strictEqual(cpVikingContext.knownNCTs.includes("NCT06068946"), false);
  assert.strictEqual(cpVikingContext.knownNCTs.includes("NCT06828055"), false);

  // Clinical Evidence knows its completed trial NCTs
  assert.ok(ceVikingContext.knownNCTs.includes("NCT05203237"));
  assert.ok(ceVikingContext.knownNCTs.includes("NCT06068946"));
  assert.ok(ceVikingContext.knownNCTs.includes("NCT06828055"));

  // 4. parseArgs domain flags validation
  assert.strictEqual(
    parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--ce"]).domain,
    "clinical-evidence",
  );
  assert.strictEqual(
    parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--clinical"]).domain,
    "clinical-evidence",
  );
  assert.strictEqual(
    parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--domain", "clinical-evidence"]).domain,
    "clinical-evidence",
  );
  assert.strictEqual(
    parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--cp"]).domain,
    "company-pipeline",
  );
  assert.strictEqual(
    parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--pipeline"]).domain,
    "company-pipeline",
  );
  assert.strictEqual(
    parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--domain", "company-pipeline"]).domain,
    "company-pipeline",
  );
  assert.strictEqual(
    parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--asset", "vk2735"]).domain,
    "clinical-evidence",
  );
  assert.strictEqual(
    parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics"]).domain,
    "company-pipeline",
  );
});

test("CIK resolution hierarchy and mapping checks", () => {
  // AstraZeneca CIK check
  assert.strictEqual(KNOWN_SEC_CIKS["astrazeneca"], "0000901832");
  assert.notStrictEqual(KNOWN_SEC_CIKS["astrazeneca"], "0001053092");

  // Zealand Pharma CIK check
  assert.strictEqual(KNOWN_SEC_CIKS["zealand-pharma"], "0002068427");

  // Neurocrine Biosciences CIK check
  assert.strictEqual(KNOWN_SEC_CIKS["neurocrine-biosciences"], "0000914475");

  // Merck CIK check
  assert.strictEqual(KNOWN_SEC_CIKS["merck-co"], "0000310158");

  // Hierarchy check: CLI override > company metadata > baseline > default mapping
  const mockContext = {
    company: { secCik: "0009999991" },
    baseline: { discoveryCheckpoint: { secEdgar: { cik: "0009999991" } } },
  };

  // 1. CLI override takes top precedence
  assert.strictEqual(resolveCik("astrazeneca", "0009999999", mockContext).cik, "0009999999");
  // 2. Canonical company metadata
  assert.strictEqual(resolveCik("astrazeneca", null, mockContext).cik, "0009999991");
  // 3. Stored checkpoint (when company metadata absent)
  assert.strictEqual(resolveCik("astrazeneca", null, { baseline: mockContext.baseline }).cik, "0009999991");
  // 4. Fallback mapping
  assert.strictEqual(resolveCik("astrazeneca", null, null).cik, "0000901832");
});

test("canonicalizeJson and parseEfetchXml unit assertions", () => {
  const obj1 = { z: 1, a: { y: 2, b: 3 } };
  const obj2 = { a: { b: 3, y: 2 }, z: 1 };
  assert.strictEqual(JSON.stringify(canonicalizeJson(obj1)), JSON.stringify(canonicalizeJson(obj2)));

  assert.strictEqual(parseEfetchXml("").size, 0);
  assert.strictEqual(parseEfetchXml(null).size, 0);
});

test("Regression 15: researchState schema placement restricted strictly to authoritative envelopes", () => {
  // 1. Assert data/generated/clinical-evidence.json does not carry researchState
  const generatedClinicalPath = path.join(ROOT, "data", "generated", "clinical-evidence.json");
  if (fs.existsSync(generatedClinicalPath)) {
    const aggregate = JSON.parse(fs.readFileSync(generatedClinicalPath, "utf8"));
    assert.strictEqual(
      aggregate.researchState,
      undefined,
      "ClinicalEvidenceAggregate in data/generated/clinical-evidence.json must NOT expose operational researchState",
    );
  }

  // 2. Validate synthetic fixtures enforce RecordMetadata exclusion and envelope placement
  const cpSynthetic = childProcess.execSync("node scripts/data-registry.mjs validate:synthetic", {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(cpSynthetic, /Validated synthetic fixtures/);

  const ceSynthetic = childProcess.execSync("node scripts/data-registry.mjs validate:clinical-evidence:synthetic", {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(ceSynthetic, /Validated Clinical Evidence synthetic fixtures/);

  // 3. Assert no canonical record in programs or regimens carries researchState in metadata
  const companiesDir = path.join(ROOT, "domains", "company-pipeline", "data", "companies");
  for (const companyFolder of fs.readdirSync(companiesDir)) {
    const programsPath = path.join(companiesDir, companyFolder, "pipeline-programs.json");
    if (fs.existsSync(programsPath)) {
      const programs = JSON.parse(fs.readFileSync(programsPath, "utf8"));
      for (const p of programs) {
        assert.strictEqual(
          p.metadata?.researchState,
          undefined,
          `Program ${p.id} metadata must not carry researchState`,
        );
      }
    }
    const regimensPath = path.join(companiesDir, companyFolder, "regimens.json");
    if (fs.existsSync(regimensPath)) {
      const regimens = JSON.parse(fs.readFileSync(regimensPath, "utf8"));
      for (const r of regimens) {
        assert.strictEqual(
          r.metadata?.researchState,
          undefined,
          `Regimen ${r.id} metadata must not carry researchState`,
        );
      }
    }
  }

  // 4. Assert no clinical study, arm, endpoint, outcome carries researchState in metadata
  const ceDir = path.join(ROOT, "domains", "clinical-evidence", "data", "clinical-evidence");
  for (const companyFolder of fs.readdirSync(ceDir)) {
    const companyPath = path.join(ceDir, companyFolder);
    if (!fs.statSync(companyPath).isDirectory()) continue;
    for (const assetFolder of fs.readdirSync(companyPath)) {
      const assetPath = path.join(companyPath, assetFolder);
      if (!fs.statSync(assetPath).isDirectory()) continue;
      const ceFilePath = path.join(assetPath, "clinical-evidence.json");
      if (fs.existsSync(ceFilePath)) {
        const ceData = JSON.parse(fs.readFileSync(ceFilePath, "utf8"));
        for (const s of ceData.studies ?? []) {
          assert.strictEqual(s.metadata?.researchState, undefined, `Study ${s.id} metadata must not carry researchState`);
        }
        for (const a of ceData.arms ?? []) {
          assert.strictEqual(a.metadata?.researchState, undefined, `Arm ${a.id} metadata must not carry researchState`);
        }
        for (const ag of ceData.analysisGroups ?? []) {
          assert.strictEqual(ag.metadata?.researchState, undefined, `AnalysisGroup ${ag.id} metadata must not carry researchState`);
        }
        for (const ep of ceData.endpoints ?? []) {
          assert.strictEqual(ep.metadata?.researchState, undefined, `Endpoint ${ep.id} metadata must not carry researchState`);
        }
        for (const o of ceData.outcomes ?? []) {
          assert.strictEqual(o.metadata?.researchState, undefined, `Outcome ${o.id} metadata must not carry researchState`);
        }
      }
    }
  }
});

test("Regression 16: Bi-directional adverse notice delta detection and noticeFingerprint validator invariant", async () => {
  const pmid = "12345678";
  const initialNotices = [{ refType: "ErratumIn", source: "Nat Med. 2026", noticePmid: "12345679" }];
  const initialFp = computeNoticeFingerprint(initialNotices, false);

  // 1. erratum -> clean transition: baseline had erratum, now PubMed returns clean paper
  const erratumBaselineContext = {
    knownPMIDs: [pmid],
    baseline: {
      discoveryCheckpoint: {
        literature: {
          monitoredPMIDs: {
            [pmid]: {
              status: "has-erratum",
              noticeFingerprint: initialFp,
              noticeTypes: ["ErratumIn"],
              lastCheckedAt: "2026-09-01",
            },
          },
        },
      },
    },
  };

  const cleanPaperXml = `
    <PubmedArticle>
      <MedlineCitation>
        <PMID>${pmid}</PMID>
        <Article>
          <ArticleTitle>Clean Paper Without Erratum</ArticleTitle>
          <Journal><JournalIssue><PubDate><Year>2026</Year></PubDate></JournalIssue></Journal>
        </Article>
      </MedlineCitation>
    </PubmedArticle>
  `;

  const mockFetchClean = async () => ({ ok: true, text: async () => cleanPaperXml });
  const resClean = await probeLiteratureHealth(erratumBaselineContext, mockFetchClean);

  assert.strictEqual(resClean.hasDelta, true, "erratum -> clean transition must be flagged as a delta");
  assert.strictEqual(resClean.deltaVerdict, "LITERATURE_NOTICE_CHANGED");
  assert.notStrictEqual(resClean.deltaVerdict, "CLEAN", "Silent clean on notice removal/resolution is strictly forbidden");
  assert.strictEqual(resClean.checked[0].deltaVerdict, "LITERATURE_NOTICE_CHANGED");
  assert.strictEqual(resClean.checked[0].hasDelta, true);

  // 2. retracted -> changed notice set: baseline had retraction with initialFp, now retraction notice set has changed
  const retractionBaselineContext = {
    knownPMIDs: [pmid],
    baseline: {
      discoveryCheckpoint: {
        literature: {
          monitoredPMIDs: {
            [pmid]: {
              status: "retracted",
              noticeFingerprint: initialFp,
              noticeTypes: ["RetractionIn"],
              lastCheckedAt: "2026-09-01",
            },
          },
        },
      },
    },
  };

  const updatedRetractionXml = `
    <PubmedArticle>
      <MedlineCitation>
        <PMID>${pmid}</PMID>
        <CommentsCorrectionsList>
          <CommentsCorrections RefType="RetractionIn">
            <RefSource>Nat Med. 2026 Nov; Updated Retraction Notice</RefSource>
            <PMID>99999999</PMID>
          </CommentsCorrections>
        </CommentsCorrectionsList>
        <Article>
          <ArticleTitle>Retracted Paper With Modified Notice</ArticleTitle>
          <Journal><JournalIssue><PubDate><Year>2026</Year></PubDate></JournalIssue></Journal>
        </Article>
      </MedlineCitation>
    </PubmedArticle>
  `;

  const mockFetchUpdatedRetraction = async () => ({ ok: true, text: async () => updatedRetractionXml });
  const resUpdatedRetraction = await probeLiteratureHealth(retractionBaselineContext, mockFetchUpdatedRetraction);

  assert.strictEqual(resUpdatedRetraction.hasDelta, true, "retracted -> changed notice set must be flagged as a delta");
  assert.strictEqual(resUpdatedRetraction.deltaVerdict, "RETRACTION_DETECTED");
  assert.strictEqual(resUpdatedRetraction.checked[0].hasDelta, true);

  // 3. 동일 notice -> no delta
  const sameErratumXml = `
    <PubmedArticle>
      <MedlineCitation>
        <PMID>${pmid}</PMID>
        <CommentsCorrectionsList>
          <CommentsCorrections RefType="ErratumIn">
            <RefSource>Nat Med. 2026</RefSource>
            <PMID>12345679</PMID>
          </CommentsCorrections>
        </CommentsCorrectionsList>
        <Article>
          <ArticleTitle>Paper with Identical Erratum</ArticleTitle>
          <Journal><JournalIssue><PubDate><Year>2026</Year></PubDate></JournalIssue></Journal>
        </Article>
      </MedlineCitation>
    </PubmedArticle>
  `;

  const mockFetchSame = async () => ({ ok: true, text: async () => sameErratumXml });
  const resSame = await probeLiteratureHealth(erratumBaselineContext, mockFetchSame);

  assert.strictEqual(resSame.hasDelta, false, "Identical notice must produce no delta");
  assert.strictEqual(resSame.deltaVerdict, "CLEAN");
  assert.strictEqual(resSame.checked[0].deltaVerdict, "KNOWN_ERRATUM");
  assert.strictEqual(resSame.checked[0].hasDelta, false);

  // 4. Invariant assertion via synthetic data validation
  const synthOut = childProcess.execSync("node scripts/data-registry.mjs validate:synthetic", {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(synthOut, /Validated synthetic fixtures/);
});

test("Regression 17: Genuine non-PubMed DOIs do not block checkpoint advance, while API/network errors do", async () => {
  const nonPubMedDoi = "10.1016/j.jacc.2026.01.001";
  const failingDoi = "10.1056/nejmoa2600001";

  // 1. Normal 200 OK query with 0 hits on PubMed (e.g. non-PubMed indexed journal or book)
  const mockFetchNonPubMed = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ esearchresult: { idlist: [] } }),
  });

  const { pmidMap: pm1, unresolved: un1, nonPubMed: np1 } = await resolveDoisAndPmcsToPmids([nonPubMedDoi], [], mockFetchNonPubMed);
  assert.strictEqual(pm1.size, 0);
  assert.strictEqual(un1.length, 0, "Normal 0-hit query must NOT be placed in unresolvedIdentifiers");
  assert.strictEqual(np1.length, 1, "Normal 0-hit query must be placed in nonPubMed");
  assert.strictEqual(np1[0].reason, "NOT_FOUND_ON_PUBMED");

  const cleanContextNonPubMed = {
    companyId: "viking-therapeutics",
    targetFile: path.join(ROOT, "domains", "company-pipeline", "data", "companies", "viking-therapeutics", "company.json"),
    targetFileExists: true,
    baseline: { discoveryCheckpoint: { asOf: "2026-01-01" } },
    knownPMIDs: [],
    unresolvedIdentifiers: un1,
    nonPubMedIdentifiers: np1,
  };

  const healthResNonPubMed = await probeLiteratureHealth(cleanContextNonPubMed, mockFetchNonPubMed);
  assert.strictEqual(healthResNonPubMed.hasIncomplete, false, "Non-PubMed sources must NOT set hasIncomplete");
  assert.strictEqual(healthResNonPubMed.deltaVerdict, "CLEAN");
  assert.strictEqual(healthResNonPubMed.nonPubMedIdentifiers.length, 1);

  const gateAllowed = canAdvanceCheckpoint(cleanContextNonPubMed, null, null, healthResNonPubMed, null, null, { advance: true });
  assert.strictEqual(gateAllowed.allowed, true, "Checkpoint advance must be permitted when valid sources are non-PubMed");

  // 2. Network / API failure (e.g. HTTP 500 error from NCBI)
  const mockFetchApiError = async () => ({
    ok: false,
    status: 500,
  });

  const { pmidMap: pm2, unresolved: un2, nonPubMed: np2 } = await resolveDoisAndPmcsToPmids([failingDoi], [], mockFetchApiError);
  assert.strictEqual(pm2.size, 0);
  assert.strictEqual(un2.length, 1);
  assert.strictEqual(un2[0].reason, "HTTP_500");
  assert.strictEqual(np2.length, 0);

  const errorContext = {
    ...cleanContextNonPubMed,
    unresolvedIdentifiers: un2,
    nonPubMedIdentifiers: np2,
  };

  const healthResApiError = await probeLiteratureHealth(errorContext, mockFetchApiError);
  assert.strictEqual(healthResApiError.hasIncomplete, true, "API failure must set hasIncomplete=true");
  assert.strictEqual(healthResApiError.deltaVerdict, "UNRESOLVED_IDENTIFIERS");

  const gateBlockedApi = canAdvanceCheckpoint(errorContext, null, null, healthResApiError, null, null, { advance: true });
  assert.strictEqual(gateBlockedApi.allowed, false, "Checkpoint advance must be blocked on API failure");
  assert.match(gateBlockedApi.reason, /Errors or incomplete data detected/);

  // 3. Ambiguous resolution (multiple PMIDs returned for single DOI)
  const mockFetchAmbiguous = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ esearchresult: { idlist: ["12345678", "87654321"] } }),
  });

  const { unresolved: un3 } = await resolveDoisAndPmcsToPmids([failingDoi], [], mockFetchAmbiguous);
  assert.strictEqual(un3.length, 1);
  assert.strictEqual(un3[0].reason, "AMBIGUOUS_MULTIPLE_PMIDS");

  const ambiguousContext = {
    ...cleanContextNonPubMed,
    unresolvedIdentifiers: un3,
  };
  const healthResAmbiguous = await probeLiteratureHealth(ambiguousContext, mockFetchAmbiguous);
  assert.strictEqual(healthResAmbiguous.hasIncomplete, true);

  const gateBlockedAmbiguous = canAdvanceCheckpoint(ambiguousContext, null, null, healthResAmbiguous, null, null, { advance: true });
  assert.strictEqual(gateBlockedAmbiguous.allowed, false);
});
