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
  CURRENT_WORKFLOW_REVISION,
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
      workflowRevision: CURRENT_WORKFLOW_REVISION,
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
      workflowRevision: CURRENT_WORKFLOW_REVISION,
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
      workflowRevision: CURRENT_WORKFLOW_REVISION,
      discoveryCheckpoint: {
        asOf: "2024-03-01",
        clinicalTrials: { semanticFingerprintVersion: CURRENT_FINGERPRINT_VERSION },
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
    baseline: {
      workflowRevision: CURRENT_WORKFLOW_REVISION,
      discoveryCheckpoint: {
        asOf: "2024-01-01",
        clinicalTrials: { semanticFingerprintVersion: CURRENT_FINGERPRINT_VERSION },
      },
    },
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

test("Regression 3: Semantic fingerprint version and workflowRevision mismatch -> REBASELINE_REQUIRED", async () => {
  const { hash } = computeScientificFingerprint(baseStudy);

  // 1. Same workflowRevision + same fingerprint -> clean UNCHANGED behavior
  const currentContext = {
    knownNCTs: ["NCT06068946"],
    baseline: {
      workflowRevision: CURRENT_WORKFLOW_REVISION,
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
  const mockFetch = async () => ({ ok: true, json: async () => baseStudy });
  const cleanRes = await probeRegistryUpdate(currentContext, mockFetch);
  assert.strictEqual(cleanRes.deltaVerdict, "UNCHANGED");
  assert.strictEqual(cleanRes.isVersionMismatch, false);
  assert.strictEqual(cleanRes.hasDelta, false);

  // 2. Old workflowRevision + same fingerprint -> REBASELINE_REQUIRED
  const oldWfContext = {
    knownNCTs: ["NCT06068946"],
    baseline: {
      workflowRevision: "ADR-0055", // old revision
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
  const oldWfRes = await probeRegistryUpdate(oldWfContext, mockFetch);
  assert.strictEqual(oldWfRes.deltaVerdict, "REBASELINE_REQUIRED");
  assert.strictEqual(oldWfRes.isWorkflowRevisionMismatch, true);
  assert.strictEqual(oldWfRes.isVersionMismatch, true);
  assert.strictEqual(oldWfRes.hasDelta, true);
  assert.strictEqual(oldWfRes.results[0].deltaVerdict, "REBASELINE_REQUIRED");
  assert.match(oldWfRes.results[0].deltaMessage, /Workflow revision mismatch/);

  // 3. Current workflowRevision + old fingerprint version -> REBASELINE_REQUIRED
  const oldFpContext = {
    knownNCTs: ["NCT06068946"],
    baseline: {
      workflowRevision: CURRENT_WORKFLOW_REVISION,
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
  const oldFpRes = await probeRegistryUpdate(oldFpContext, mockFetch);
  assert.strictEqual(oldFpRes.deltaVerdict, "REBASELINE_REQUIRED");
  assert.strictEqual(oldFpRes.isFingerprintMismatch, true);
  assert.strictEqual(oldFpRes.isVersionMismatch, true);
  assert.strictEqual(oldFpRes.hasDelta, true);
  assert.strictEqual(oldFpRes.results[0].deltaVerdict, "REBASELINE_REQUIRED");
  assert.match(oldFpRes.results[0].deltaMessage, /Semantic fingerprint version mismatch/);

  // 4. Both current with real change -> normal delta comparison (SCIENTIFIC_UPDATE_DETECTED)
  const modifiedStudy = JSON.parse(JSON.stringify(baseStudy));
  modifiedStudy.protocolSection.statusModule.lastUpdatePostDateStruct.date = "2026-09-01";
  modifiedStudy.protocolSection.statusModule.overallStatus = "TERMINATED";
  const modFetch = async () => ({ ok: true, json: async () => modifiedStudy });
  const deltaRes = await probeRegistryUpdate(currentContext, modFetch);
  assert.strictEqual(deltaRes.deltaVerdict, "SCIENTIFIC_UPDATE_DETECTED");
  assert.strictEqual(deltaRes.isVersionMismatch, false);
  assert.strictEqual(deltaRes.hasDelta, true);

  // 5. Workflow revision mismatch blocks routine advance
  const advanceBlockedGate = canAdvanceCheckpoint(oldWfContext, oldWfRes, null, null, null, null, { advance: true, ackDeltas: true });
  assert.strictEqual(advanceBlockedGate.allowed, false);
  assert.match(advanceBlockedGate.reason, /REBASELINE_REQUIRED/);

  // 6. Workflow revision mismatch rebaseline requires explicit --ack-deltas:
  // a) mismatch + --bootstrap (without ackDeltas) -> BLOCKED
  const bootstrapWithoutAck = canAdvanceCheckpoint(oldWfContext, oldWfRes, null, null, null, null, { bootstrap: true });
  assert.strictEqual(bootstrapWithoutAck.allowed, false);
  assert.match(bootstrapWithoutAck.reason, /Unresolved deltas detected/);
  assert.match(bootstrapWithoutAck.reason, /Registry scientific updates/);

  // b) mismatch + --bootstrap --ack-deltas -> ALLOWED
  const bootstrapWithAck = canAdvanceCheckpoint(oldWfContext, oldWfRes, null, null, null, null, { bootstrap: true, ackDeltas: true });
  assert.strictEqual(bootstrapWithAck.allowed, true);
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

test("Regression 5: Asset-scoped Clinical Evidence context isolates known NCTs from target asset's canonical CE source (including anchored regimen studies) and excludes unrelated regimen studies", async () => {
  // Eli Lilly: ly3298176 (Tirzepatide)
  const tirzContext = await loadCompanyContext("eli-lilly-and-company", "ly3298176");

  // In Lilly CE source (domains/clinical-evidence/data/clinical-evidence/eli-lilly-and-company/ly3298176/clinical-evidence.json):
  // Study NCT06643728 is anchored to regimen "eli-lilly-and-company-bimagrumab-tirzepatide-obesity"
  // which belongs to Tirzepatide CE scope:
  assert.ok(
    tirzContext.knownNCTs.includes("NCT06643728"),
    "NCT06643728 from Bimagrumab+Tirzepatide regimen study in Tirzepatide CE file must be included in Tirzepatide scope",
  );

  // In contrast, Bimagrumab+Semaglutide regimen (NCT05616013) is not an asset in Lilly CE
  // and has no study in ly3298176 CE file:
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
    parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--ce", "--asset", "vk2735"]).domain,
    "clinical-evidence",
  );
  assert.strictEqual(
    parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics"]).domain,
    "company-pipeline",
  );

  // 5. Explicitly forbidden hybrid path: company-pipeline + --asset
  const origExit = process.exit;
  const origError = console.error;
  let exitCode = null;
  let errorMsg = "";
  try {
    process.exit = (code) => { exitCode = code; throw new Error("EXIT"); };
    console.error = (msg) => { errorMsg = msg; };

    // a. --pipeline + --asset
    exitCode = null;
    errorMsg = "";
    assert.throws(
      () => parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--pipeline", "--asset", "vk2735"]),
      /EXIT/,
    );
    assert.strictEqual(exitCode, 1);
    assert.match(errorMsg, /'--pipeline' \/ 'company-pipeline' domain is company-wide and does not support '--asset'/);

    // b. --domain company-pipeline + --asset
    exitCode = null;
    errorMsg = "";
    assert.throws(
      () => parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--domain", "company-pipeline", "--asset", "vk2735"]),
      /EXIT/,
    );
    assert.strictEqual(exitCode, 1);
    assert.match(errorMsg, /'--pipeline' \/ 'company-pipeline' domain is company-wide and does not support '--asset'/);

    // c. Conflicting domain flags: --pipeline + --ce
    exitCode = null;
    errorMsg = "";
    assert.throws(
      () => parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--pipeline", "--ce"]),
      /EXIT/,
    );
    assert.strictEqual(exitCode, 1);
    assert.match(errorMsg, /Conflicting domain flags specified/);

    // d. Conflicting domain flags with asset: --pipeline --asset X --ce
    exitCode = null;
    errorMsg = "";
    assert.throws(
      () => parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--pipeline", "--asset", "vk2735", "--ce"]),
      /EXIT/,
    );
    assert.strictEqual(exitCode, 1);
    assert.match(errorMsg, /Conflicting domain flags specified/);

    // e. Conflicting domain flags: --cp + --clinical
    exitCode = null;
    errorMsg = "";
    assert.throws(
      () => parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--cp", "--clinical"]),
      /EXIT/,
    );
    assert.strictEqual(exitCode, 1);
    assert.match(errorMsg, /Conflicting domain flags specified/);

    // f. Conflicting domain flags: --domain company-pipeline + --domain clinical-evidence
    exitCode = null;
    errorMsg = "";
    assert.throws(
      () => parseArgs(["node", "research-preflight.mjs", "--company", "viking-therapeutics", "--domain", "company-pipeline", "--domain", "clinical-evidence"]),
      /EXIT/,
    );
    assert.strictEqual(exitCode, 1);
    assert.match(errorMsg, /Conflicting domain flags specified/);
  } finally {
    process.exit = origExit;
    console.error = origError;
  }

  // c. Programmatic loadCompanyContext with company-pipeline + targetAssetId rejects
  await assert.rejects(
    async () => loadCompanyContext("viking-therapeutics", "vk2735", { domain: "company-pipeline" }),
    /domain 'company-pipeline' is company-wide and does not support targetAssetId/,
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
    baseline: {
      workflowRevision: CURRENT_WORKFLOW_REVISION,
      discoveryCheckpoint: {
        asOf: "2026-01-01",
        clinicalTrials: { semanticFingerprintVersion: CURRENT_FINGERPRINT_VERSION },
      },
    },
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

// -----------------------------------------------------------------------
// Partner-aware Clinical Evidence discovery (ADR-0071 companion)
// -----------------------------------------------------------------------

/**
 * Builds a synthetic tracked-company fixture covering every representative
 * case for partner-aware discovery: a two-asset licensor/licensee pair
 * (Hengrui/Kailera-shaped) proving no cross-asset leak, a territory-split
 * pair (Hansoh/Regeneron-shaped), a reciprocal-relationship pair added after
 * an ADR-0072-style fix (Roche/Chugai-shaped, with a Japan-only code), an
 * untracked counterpart (no company folder for it at all), and a
 * structurally non-actionable pair where the counterpart is tracked but has
 * no row for the named asset (Lilly/Chugai-shaped).
 */
function buildPartnerDiscoveryFixture(fixtureDir) {
  const companyDir = path.join(fixtureDir, "companies");
  const clinicalDir = path.join(fixtureDir, "clinical-evidence");

  function writeCompany(id, name, programs, regimens = []) {
    fs.mkdirSync(path.join(companyDir, id), { recursive: true });
    fs.writeFileSync(
      path.join(companyDir, id, "company.json"),
      JSON.stringify({ id, name }, null, 2) + "\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(companyDir, id, "pipeline-programs.json"),
      JSON.stringify(programs, null, 2) + "\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(companyDir, id, "regimens.json"),
      JSON.stringify(regimens, null, 2) + "\n",
      "utf8",
    );
  }

  const regimen = (overrides) => ({
    components: [],
    relationships: [],
    ...overrides,
  });

  const program = (overrides) => ({
    id: `${overrides.companyId}-${overrides.assetId}`,
    aliases: [],
    relationships: [],
    ...overrides,
  });

  // Hengrui/Kailera-shaped: two separate concurrent licensed assets between
  // the same pair - must not cross-contaminate. Hengrui's own rows deliberately
  // do *not* cross-list Kailera's internal codes (unlike this pair's real-world
  // data) so the test isolates partner-aware expansion as the only source of
  // those terms, rather than the terms being redundant with focal aliases.
  // Kailera's own rows still reference Hengrui's codes as aliases, which is
  // what confirms same-asset identity in both directions.
  writeCompany("hengrui-fx", "Hengrui Fixture Co.", [
    program({
      companyId: "hengrui-fx",
      assetId: "hrs9531-asset",
      assetName: "Ribupatide",
      codeName: "HRS9531",
      relationships: [{ externalCompanyName: "Kailera Therapeutics Fixture", role: "licensee", sourceUrls: ["https://example.test/a"] }],
    }),
    program({
      companyId: "hengrui-fx",
      assetId: "hrs7535-asset",
      assetName: "HRS-7535",
      codeName: null,
      relationships: [{ externalCompanyName: "Kailera Therapeutics Fixture", role: "licensee", sourceUrls: ["https://example.test/b"] }],
    }),
  ]);
  writeCompany("kailera-fx", "Kailera Therapeutics Fixture", [
    program({
      companyId: "kailera-fx",
      assetId: "kai9531-asset",
      assetName: "KAI-9531",
      codeName: "KAI-9531",
      aliases: [{ type: "development-code", value: "HRS9531" }],
      relationships: [{ externalCompanyName: "Hengrui Fixture Co.", role: "licensor", sourceUrls: ["https://example.test/a"] }],
    }),
    program({
      companyId: "kailera-fx",
      assetId: "kai7535-asset",
      assetName: "KAI-7535",
      codeName: "KAI-7535",
      aliases: [{ type: "development-code", value: "HRS-7535" }],
      relationships: [{ externalCompanyName: "Hengrui Fixture Co.", role: "licensor", sourceUrls: ["https://example.test/b"] }],
    }),
  ]);

  // Hansoh/Regeneron-shaped: same molecule, territory split.
  writeCompany("hansoh-fx", "Hansoh Fixture Pharma", [
    program({
      companyId: "hansoh-fx",
      assetId: "olatorepatide-cn-asset",
      assetName: "Olatorepatide",
      codeName: "HS-20094",
      relationships: [{ externalCompanyName: "Regeneron Fixture", role: "licensee", territories: ["Worldwide excluding China"], sourceUrls: ["https://example.test/c"] }],
    }),
  ]);
  writeCompany("regeneron-fx", "Regeneron Fixture", [
    program({
      companyId: "regeneron-fx",
      assetId: "olatorepatide-global-asset",
      assetName: "Olatorepatide",
      codeName: "REGN-OLA",
      aliases: [{ type: "development-code", value: "HS-20094" }],
      relationships: [{ externalCompanyName: "Hansoh Fixture Pharma", role: "licensor", territories: ["China"], sourceUrls: ["https://example.test/c"] }],
    }),
  ]);

  // Roche/Chugai-shaped: reciprocal relationship already present on both
  // sides (post-ADR-0072-fix shape), with a Japan-only code on Chugai's row
  // that Roche's own aliases do not carry - the concrete value partner-aware
  // discovery adds.
  writeCompany("roche-fx", "Roche Fixture", [
    program({
      companyId: "roche-fx",
      assetId: "enicepatide-asset",
      assetName: "Enicepatide",
      codeName: "RO7795068",
      aliases: [{ type: "development-code", value: "CT-388" }],
      relationships: [
        { externalCompanyName: "Chugai Fixture Pharmaceutical", role: "licensee", territories: ["Japan"], sourceUrls: ["https://example.test/d"] },
        // Role-scope guard: `originator` is deliberately excluded from
        // reciprocal-role/partner-aware handling. Carmot Fixture is tracked
        // and genuinely shares this asset's identity, so if role filtering
        // were absent this would wrongly expand or at least appear in
        // diagnostics - it must not.
        { externalCompanyName: "Carmot Fixture Therapeutics", role: "originator", sourceUrls: ["https://example.test/h"] },
      ],
    }),
  ]);
  writeCompany("carmot-fx", "Carmot Fixture Therapeutics", [
    program({
      companyId: "carmot-fx",
      assetId: "ct388-origin-asset",
      assetName: "CT-388",
      codeName: "CT-388",
      relationships: [{ externalCompanyName: "Roche Fixture", role: "originator", sourceUrls: ["https://example.test/h"] }],
    }),
  ]);
  writeCompany("chugai-fx", "Chugai Fixture Pharmaceutical", [
    program({
      companyId: "chugai-fx",
      assetId: "enicepatide-jp-asset",
      assetName: "Enicepatide",
      codeName: "RO7795068",
      aliases: [
        { type: "development-code", value: "CT-388" },
        { type: "development-code", value: "RO7795068-JP" },
      ],
      relationships: [{ externalCompanyName: "Roche Fixture", role: "licensor", territories: ["Japan"], sourceUrls: ["https://example.test/d"] }],
    }),
  ]);

  // Untracked-counterpart-shaped: the named partner has no company folder at
  // all - must never be guessed.
  writeCompany("az-fx", "AstraZeneca Fixture", [
    program({
      companyId: "az-fx",
      assetId: "elecoglipron-asset",
      assetName: "Elecoglipron",
      codeName: "AZD5004",
      aliases: [{ type: "development-code", value: "ECC5004" }],
      relationships: [{ externalCompanyName: "Eccogene Fixture (Untracked)", role: "licensor", territories: ["Worldwide except China"], sourceUrls: ["https://example.test/e"] }],
    }),
  ]);

  // Lilly/Chugai-shaped: counterpart is tracked (reuses chugai-fx) but has no
  // row at all for this different asset - structurally non-actionable, must
  // never block or error.
  writeCompany("lilly-fx", "Lilly Fixture", [
    program({
      companyId: "lilly-fx",
      assetId: "orforglipron-asset",
      assetName: "Orforglipron",
      codeName: "LY3502970",
      relationships: [{ externalCompanyName: "Chugai Fixture Pharmaceutical", role: "licensor", territories: ["Worldwide"], sourceUrls: ["https://example.test/f"] }],
    }),
  ]);

  // Regimen-only partner relationship: the focal asset's own Program row
  // carries no relationships at all - the *only* place the cross-company
  // relationship is recorded is a same-company Regimen row that composes
  // the focal asset with a partner's molecule. An asset-scoped run targeting
  // the plain Program must still reach this Regimen (ADR-0069's compose
  // reach) and expand via the partner's own matched identity.
  writeCompany("wexler-fx", "Wexler Fixture Biosciences", [
    program({
      companyId: "wexler-fx",
      assetId: "wex101-asset",
      assetName: "Wexatide",
      codeName: "WEX-101",
      // Deliberately no relationships here - proves the Regimen, not this
      // row, is what must supply the partner-aware expansion.
    }),
  ], [
    regimen({
      id: "wexler-fx-wex101-plus-partner-regimen",
      companyId: "wexler-fx",
      name: "Wexatide + Partner Combination Regimen",
      components: [
        { assetId: "wex101-asset", role: "component" },
        { assetName: "Partneratide", codeName: "PTX-9", externalCompanyName: "Partner Fixture Therapeutics", role: "component" },
      ],
      relationships: [{ externalCompanyName: "Partner Fixture Therapeutics", role: "co-developer", territories: ["Worldwide"], sourceUrls: ["https://example.test/g"] }],
    }),
  ]);
  writeCompany("partner-fixture-fx", "Partner Fixture Therapeutics", [
    program({
      companyId: "partner-fixture-fx",
      assetId: "ptx9-asset",
      assetName: "Partneratide",
      codeName: "PTX-9",
      // An internal code Wexler's own Regimen never mentions - the concrete
      // new discovery surface, distinguishing genuine partner-aware
      // expansion from names already reachable via the Regimen's own
      // components[] text alone.
      aliases: [{ type: "development-code", value: "PTX9-INTERNAL-9001" }],
      relationships: [{ externalCompanyName: "Wexler Fixture Biosciences", role: "co-developer", territories: ["Worldwide"], sourceUrls: ["https://example.test/g"] }],
    }),
  ]);

  fs.mkdirSync(clinicalDir, { recursive: true });
  return { companyDir, clinicalDir };
}

test("Regression 18: Partner-aware CE discovery term computation - representative cases", async () => {
  const fixtureDir = path.join(ROOT, "test", "fixtures", "partner-discovery-terms");
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  const { companyDir, clinicalDir } = buildPartnerDiscoveryFixture(fixtureDir);

  try {
    // Hengrui/Kailera: HRS9531 must expand via KAI-9531 only, never KAI-7535.
    const hrs9531Context = await loadCompanyContext("hengrui-fx", "hrs9531-asset", {
      companyDir,
      clinicalDir,
      domain: "clinical-evidence",
    });
    const hrs9531Terms = hrs9531Context.partnerAssetAliases.map((t) => t.toLowerCase());
    assert.ok(hrs9531Terms.includes("kai-9531"), "HRS9531 must expand to include Kailera's own KAI-9531 code");
    assert.ok(
      !hrs9531Terms.some((t) => t.includes("kai-7535") || t.includes("kai7535")),
      "HRS9531 must never pull in Kailera's unrelated KAI-7535 asset code (same company pair, different asset)",
    );
    const hrs9531Partnered = hrs9531Context.partnerDiscoveryDiagnostics.find((d) => d.status === "partner-expanded");
    assert.ok(hrs9531Partnered && hrs9531Partnered.counterpartCompanyId === "kailera-fx");

    // HRS-7535 (the sibling asset) must expand via KAI-7535 only.
    const hrs7535Context = await loadCompanyContext("hengrui-fx", "hrs7535-asset", {
      companyDir,
      clinicalDir,
      domain: "clinical-evidence",
    });
    const hrs7535Terms = hrs7535Context.partnerAssetAliases.map((t) => t.toLowerCase());
    assert.ok(hrs7535Terms.includes("kai-7535"));
    assert.ok(!hrs7535Terms.some((t) => t.includes("kai-9531")));

    // Hansoh/Regeneron: territory split, same molecule - must still resolve
    // via shared name/alias identity.
    const hansohContext = await loadCompanyContext("hansoh-fx", "olatorepatide-cn-asset", {
      companyDir,
      clinicalDir,
      domain: "clinical-evidence",
    });
    const hansohTerms = hansohContext.partnerAssetAliases.map((t) => t.toLowerCase());
    assert.ok(
      hansohTerms.some((t) => t.includes("regn-ola") || t.includes("olatorepatide-global-asset")),
      "Hansoh's asset-scoped run must expand via Regeneron's own code/asset identity for the same molecule",
    );

    // Roche/Chugai: after the reciprocal relationship exists on both sides,
    // Roche's own asset-scoped run must pick up Chugai's Japan-only code -
    // the concrete new discovery surface, not merely a re-confirmation of
    // Roche's own already-known aliases.
    const rocheContext = await loadCompanyContext("roche-fx", "enicepatide-asset", {
      companyDir,
      clinicalDir,
      domain: "clinical-evidence",
    });
    const rocheTerms = rocheContext.partnerAssetAliases.map((t) => t.toLowerCase());
    assert.ok(
      rocheTerms.includes("ro7795068-jp"),
      "Roche's asset-scoped run must surface Chugai's Japan-only development code once the reciprocal relationship is recorded",
    );
    assert.ok(
      !rocheTerms.includes("ro7795068") && !rocheTerms.includes("ct-388"),
      "Terms Roche's own row already carries must not be duplicated into the partner-expansion list",
    );
    // Role-scope guard: the same row also carries an `originator` entry
    // naming a tracked, genuinely-identity-matching company (Carmot
    // Fixture) - it must never appear in diagnostics or expand terms at all,
    // proving role filtering runs before company/identity resolution, not
    // merely that it happens not to match.
    assert.ok(
      !rocheContext.partnerDiscoveryDiagnostics.some((d) => d.counterpartCompanyId === "carmot-fx"),
      "an originator relationship must never be processed for partner-aware discovery, even when the counterpart is tracked and identity-matching",
    );
    assert.ok(!rocheTerms.some((t) => t.includes("ct388-origin-asset")));

    // Untracked counterpart: must never guess a tracked company, must add no terms.
    const azContext = await loadCompanyContext("az-fx", "elecoglipron-asset", {
      companyDir,
      clinicalDir,
      domain: "clinical-evidence",
    });
    assert.strictEqual(azContext.partnerAssetAliases.length, 0);
    const azDiag = azContext.partnerDiscoveryDiagnostics.find((d) => d.status === "untracked-counterpart");
    assert.ok(azDiag && azDiag.externalCompanyName === "Eccogene Fixture (Untracked)");

    // Structurally non-actionable (Lilly/Chugai-shaped): tracked counterpart,
    // no matching row - must not throw, must not block, must add no terms.
    const lillyContext = await loadCompanyContext("lilly-fx", "orforglipron-asset", {
      companyDir,
      clinicalDir,
      domain: "clinical-evidence",
    });
    assert.strictEqual(lillyContext.partnerAssetAliases.length, 0);
    const lillyDiag = lillyContext.partnerDiscoveryDiagnostics.find((d) => d.status === "counterpart-asset-row-absent");
    assert.ok(lillyDiag && lillyDiag.counterpartCompanyId === "chugai-fx");
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("Regression 19: probeRegistryDiscovery partner-expanded query surfaces a partner-code-only candidate without pulling in unrelated partner trials", async () => {
  const fixtureDir = path.join(ROOT, "test", "fixtures", "partner-discovery-fetch");
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  const { companyDir, clinicalDir } = buildPartnerDiscoveryFixture(fixtureDir);

  try {
    const context = await loadCompanyContext("hengrui-fx", "hrs9531-asset", {
      companyDir,
      clinicalDir,
      domain: "clinical-evidence",
    });
    // Simulate one already-known focal trial so the "existing discovered
    // Study is preserved" behavior is actually exercised, not merely absent.
    context.knownNCTs = ["NCT10000001"];

    const requestedUrls = [];
    const studyFor = (nctId, title) => ({
      protocolSection: {
        identificationModule: { nctId, briefTitle: title },
        statusModule: { overallStatus: "RECRUITING", lastUpdatePostDateStruct: { date: "2026-01-01" } },
      },
    });

    const mockFetch = async (url) => {
      requestedUrls.push(url);
      const parsed = new URL(url);
      const intr = parsed.searchParams.get("query.intr");
      const spons = parsed.searchParams.get("query.spons");

      if (spons) {
        // Asset-scoped runs never issue a bare sponsor query.
        throw new Error(`unexpected sponsor query in an asset-scoped run: ${spons}`);
      }
      if (intr === "Ribupatide" || intr === "HRS9531") {
        return { ok: true, json: async () => ({ studies: [studyFor("NCT10000001", "Known Hengrui ribupatide trial")] }) };
      }
      if (intr === "KAI-9531") {
        return { ok: true, json: async () => ({ studies: [studyFor("NCT20000002", "Kailera-registered ribupatide trial")] }) };
      }
      if (intr === "KAI-7535" || intr === "HRS-7535") {
        // Must never be queried at all when scoped to the HRS9531 asset -
        // if it is, fail loudly rather than silently returning noise.
        throw new Error(`unrelated sibling-asset code must never be queried: ${intr}`);
      }
      return { ok: true, json: async () => ({ studies: [] }) };
    };

    const result = await probeRegistryDiscovery(context, mockFetch);

    // Existing discovered Study is preserved (known, not re-reported as new).
    assert.ok(!result.newlyDiscovered.some((d) => d.nctId === "NCT10000001"));

    // Partner-code-only candidate is discoverable.
    const partnerCandidate = result.newlyDiscovered.find((d) => d.nctId === "NCT20000002");
    assert.ok(partnerCandidate, "a trial registered only under the partner's own code must be discovered");
    assert.strictEqual(partnerCandidate.discoveryPath, "partner");
    assert.ok(partnerCandidate.matchedOn.includes("KAI-9531"));
    assert.ok(partnerCandidate.matchedOn.includes("Kailera"));
    assert.strictEqual(result.newlyDiscoveredPartnerCount, 1);
    assert.strictEqual(result.newlyDiscoveredFocalCount, 0);

    // Confirm no request ever carried the sibling asset's own codes.
    assert.ok(!requestedUrls.some((u) => u.includes("KAI-7535") || u.includes("HRS-7535")));
    // Confirm the partner query was scoped to the one confirmed code, never
    // a bare company-name/whole-pipeline search for Kailera.
    assert.ok(!requestedUrls.some((u) => u.toLowerCase().includes("kailera") && !u.includes("query.intr")));
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("Regression 20: Regimen-only partner relationship - asset-scoped run reaches a composing Regimen row, but a component-linked (genuinely different) partner asset is never expanded into a search term", async () => {
  const fixtureDir = path.join(ROOT, "test", "fixtures", "partner-discovery-regimen");
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  const { companyDir, clinicalDir } = buildPartnerDiscoveryFixture(fixtureDir);

  try {
    // The scoped asset itself (wex101-asset) carries zero relationships -
    // only the composing Regimen does. Partner Fixture Therapeutics'
    // molecule (Partneratide/PTX-9) is a genuinely *different* real-world
    // asset combined with Wexatide, named only via the Regimen's
    // components[] - not "Wexatide under another company's code" the way
    // Kailera's KAI-9531 is Hengrui's HRS9531.
    const context = await loadCompanyContext("wexler-fx", "wex101-asset", {
      companyDir,
      clinicalDir,
      domain: "clinical-evidence",
    });

    // The relationship must still be reached and reported - just never
    // expanded, since expanding it would search for Partner Fixture's own,
    // otherwise-unrelated Partneratide trials under a Wexatide-scoped run.
    const componentOnly = context.partnerDiscoveryDiagnostics.find(
      (d) => d.status === "component-only-match" && d.counterpartCompanyId === "partner-fixture-fx",
    );
    assert.ok(componentOnly, "the composing Regimen's relationship must still be surfaced in diagnostics, as component-only-match");
    assert.ok(
      !context.partnerDiscoveryDiagnostics.some((d) => d.status === "partner-expanded" && d.counterpartCompanyId === "partner-fixture-fx"),
      "a component-linked (different-asset) counterpart must never also appear as partner-expanded",
    );

    // None of Partner Fixture's own terms - neither the component-text
    // names nor its own internal code - may appear anywhere in the actual
    // partner query-term list.
    const partnerTerms = context.partnerAssetAliases.map((t) => t.toLowerCase());
    for (const leaked of ["ptx-9", "partneratide", "ptx9-asset", "ptx9-internal-9001"]) {
      assert.ok(!partnerTerms.includes(leaked), `"${leaked}" must never be expanded into a partner query term`);
    }

    // The focal alias collection must include the composing Regimen's own
    // name (so the combination itself remains searchable) but never the
    // component's own standalone name/code.
    const focalTerms = context.assetAliases.map((a) => a.toLowerCase());
    assert.ok(
      focalTerms.some((a) => a.includes("wexatide + partner combination regimen")),
      "focal asset alias collection must include the composing Regimen's own name",
    );
    for (const leaked of ["ptx-9", "partneratide"]) {
      assert.ok(!focalTerms.includes(leaked), `"${leaked}" must never leak into the focal query-term list via components[]`);
    }

    // A regimen-free, company-pipeline-domain context must not error or
    // attempt partner-aware expansion at all (asset-scoped only, and
    // company-pipeline domain never sets targetAssetId).
    const cpContext = await loadCompanyContext("wexler-fx", null, {
      companyDir,
      clinicalDir,
      domain: "company-pipeline",
    });
    assert.deepStrictEqual(cpContext.partnerAssetAliases, []);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("Regression 21: a fixed-dose-combination is itself searchable, but its sibling component's standalone code never leaks into query.intr on either the focal or partner side - no B-only trial is discovered under an A-scoped run", async () => {
  const fixtureDir = path.join(ROOT, "test", "fixtures", "partner-discovery-fdc");
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  const companyDir = path.join(fixtureDir, "companies");
  const clinicalDir = path.join(fixtureDir, "clinical-evidence");

  function writeCompany(id, name, programs) {
    fs.mkdirSync(path.join(companyDir, id), { recursive: true });
    fs.writeFileSync(path.join(companyDir, id, "company.json"), JSON.stringify({ id, name }, null, 2) + "\n", "utf8");
    fs.writeFileSync(path.join(companyDir, id, "pipeline-programs.json"), JSON.stringify(programs, null, 2) + "\n", "utf8");
    fs.writeFileSync(path.join(companyDir, id, "regimens.json"), "[]\n", "utf8");
  }

  try {
    // Company A: a plain molecule (core-asset) plus a fixed-dose combination
    // of that molecule with Company B's own molecule (component-only link -
    // B is a real, separately-tracked, genuinely different asset).
    writeCompany("alpha-fx", "Alpha Fixture Biosciences", [
      {
        id: "alpha-fx-core-asset",
        companyId: "alpha-fx",
        assetId: "core-asset",
        assetName: "Coreatide",
        codeName: "ALF-100",
        aliases: [],
        relationships: [],
      },
      {
        id: "alpha-fx-core-beta-fdc",
        companyId: "alpha-fx",
        assetId: "core-beta-fdc-asset",
        assetType: "fixed-dose-combination",
        assetName: "Coreatide / Sidekick Combo",
        codeName: "ALF-100/SK-77",
        aliases: [],
        components: [
          { assetId: "core-asset", role: "component" },
          { assetName: "Sidekick Molecule", codeName: "SK-77", externalCompanyName: "Beta Fixture Sidekick Co.", role: "component" },
        ],
        relationships: [{ externalCompanyName: "Beta Fixture Sidekick Co.", role: "co-developer", sourceUrls: ["https://example.test/i"] }],
      },
    ]);
    writeCompany("beta-fx", "Beta Fixture Sidekick Co.", [
      {
        id: "beta-fx-sk77",
        companyId: "beta-fx",
        assetId: "sk77-asset",
        assetName: "Sidekick Molecule",
        codeName: "SK-77",
        aliases: [],
        relationships: [{ externalCompanyName: "Alpha Fixture Biosciences", role: "co-developer", sourceUrls: ["https://example.test/i"] }],
      },
    ]);
    fs.mkdirSync(clinicalDir, { recursive: true });

    const context = await loadCompanyContext("alpha-fx", "core-asset", {
      companyDir,
      clinicalDir,
      domain: "clinical-evidence",
    });

    // Term-level check: the FDC's own combination name/code is focal-searchable,
    // but "SK-77"/"Sidekick Molecule" appear nowhere in either term list.
    const allTerms = [...context.assetAliases, ...context.partnerAssetAliases].map((t) => t.toLowerCase());
    assert.ok(
      allTerms.some((t) => t.includes("alf-100/sk-77") || t.includes("coreatide / sidekick combo")),
      "the A+B fixed-dose combination's own name/code must remain searchable",
    );
    for (const leaked of ["sk-77", "sidekick molecule", "sk77-asset"]) {
      assert.ok(!allTerms.includes(leaked), `component "${leaked}" must never appear as a standalone query term`);
    }

    // Fetch-level check (mirrors Regression 19's rigor): actually run
    // discovery with a mock that returns a real match only for "SK-77" - a
    // B-only trial with nothing to do with Coreatide. If any query the
    // preflight issues ever carries "SK-77" alone, that trial would
    // wrongly surface as discovered under this A-scoped run.
    const requestedUrls = [];
    const mockFetch = async (url) => {
      requestedUrls.push(url);
      const intr = new URL(url).searchParams.get("query.intr");
      if (intr === "SK-77" || intr === "Sidekick Molecule") {
        return {
          ok: true,
          json: async () => ({
            studies: [
              {
                protocolSection: {
                  identificationModule: { nctId: "NCT30000003", briefTitle: "Sidekick Molecule monotherapy trial (unrelated to Coreatide)" },
                  statusModule: { overallStatus: "RECRUITING", lastUpdatePostDateStruct: { date: "2026-01-01" } },
                },
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({ studies: [] }) };
    };

    const result = await probeRegistryDiscovery(context, mockFetch);

    assert.ok(
      !result.newlyDiscovered.some((d) => d.nctId === "NCT30000003"),
      "a trial found only under the sibling component's own standalone code must never be discovered by an A-scoped run",
    );
    // Check the exact `query.intr` value, not a raw substring match on the
    // URL - the FDC's own compound code ("ALF-100/SK-77") legitimately
    // contains "SK-77" as a substring and must remain queryable; only the
    // *bare*, standalone component code/name must never appear as the
    // entire query.intr value.
    const queriedIntrValues = requestedUrls.map((u) => new URL(u).searchParams.get("query.intr"));
    assert.ok(
      !queriedIntrValues.includes("SK-77") && !queriedIntrValues.includes("Sidekick Molecule"),
      "no request issued by an A-scoped run may query the sibling component's own standalone code/name as an exact query.intr value",
    );
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});
