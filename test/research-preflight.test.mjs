/**
 * test/research-preflight.test.mjs
 *
 * Offline, zero-network unit test suite for research preflight architecture.
 * Verifies all 8 required invariant guarantees and safety gates.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  KNOWN_SEC_CIKS,
  canAdvanceCheckpoint,
  canonicalizeJson,
  computeScientificFingerprint,
  evaluatePreflight,
  loadCompanyContext,
  parseEfetchXml,
  probeLiteratureDiscovery,
  probeLiteratureHealth,
  probeRegistryDiscovery,
  probeRegistryUpdate,
  probeSecFilings,
  resolveCik,
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
  // Add a new site in contact module
  studyWithNewPostDate.protocolSection.contactsLocationsModule.locations.push({
    facility: "Research Site 2",
    city: "Austin",
    state: "Texas",
  });

  const mockFetch = async () => ({
    ok: true,
    json: async () => studyWithNewPostDate,
  });

  const results = await probeRegistryUpdate(context, mockFetch);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].deltaVerdict, "ADMIN_UPDATE_BYPASS");
  assert.strictEqual(results[0].scientificHash, hash);
  assert.match(results[0].deltaMessage, /Administrative update only/);
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

  const results = await probeRegistryUpdate(context, mockFetch);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].deltaVerdict, "SCIENTIFIC_UPDATE_DETECTED");
  assert.match(results[0].deltaMessage, /Scientific protocol changed/);
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
  assert.notStrictEqual(regDisc.deltaVerdict, "CLEAN");

  // 2. Literature Discovery network failure
  const litDisc = await probeLiteratureDiscovery(context, failingFetch);
  assert.strictEqual(litDisc.deltaVerdict, "NETWORK_ERROR");
  assert.notStrictEqual(litDisc.deltaVerdict, "CLEAN");

  // 3. Literature Health network failure
  const litHealth = await probeLiteratureHealth(context, failingFetch);
  assert.strictEqual(litHealth.deltaVerdict, "NETWORK_ERROR");
  assert.notStrictEqual(litHealth.deltaVerdict, "CLEAN");

  // 4. SEC EDGAR network failure
  const sec = await probeSecFilings("viking-therapeutics", null, null, context, failingFetch);
  assert.strictEqual(sec.deltaVerdict, "NETWORK_ERROR");
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
    baseline: {
      discoveryCheckpoint: {
        asOf: "2024-03-01",
        clinicalTrials: {},
        secEdgar: { latestAcceptanceDateTime: "2024-03-01T16:00:00.000Z" },
      },
    },
  };

  const updateRes = [
    { nctId: "NCT06068946", deltaVerdict: "SCIENTIFIC_UPDATE_DETECTED" },
  ];
  const secRes = {
    status: "OK",
    deltaVerdict: "NEW_FILINGS_DETECTED",
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

  // If a fetch error exists, EVEN full ack MUST BE BLOCKED
  const errorUpdateRes = [
    { nctId: "NCT06068946", deltaVerdict: "FETCH_ERROR" },
  ];
  const gateErrorWithAck = canAdvanceCheckpoint(context, errorUpdateRes, null, null, null, secRes, { advance: true, ackDeltas: true });
  assert.strictEqual(gateErrorWithAck.allowed, false);
  assert.match(gateErrorWithAck.reason, /Network errors or incomplete data detected/);
});

test("Test 5: Legacy no-checkpoint -> bootstrap baseline allowed", async () => {
  const cleanContextNoBaseline = {
    companyId: "novo-nordisk",
    targetFile: path.join(ROOT, "domains", "company-pipeline", "data", "companies", "novo-nordisk", "company.json"),
    baseline: null,
  };

  const updateRes = [
    { nctId: "NCT01234567", deltaVerdict: "LEGACY_UNBASELINED", lastUpdatePostDate: "2024-01-01", scientificHash: "abc123" },
  ];
  const secRes = { status: "OK", deltaVerdict: "LEGACY_UNBASELINED", allRecentKeyFilings: [] };

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
    knownNCTs: ["NCT07169942"], // does not contain NCT09999999
    assetAliases: ["GSBR-1290"],
    targetAssetId: null,
  };
  const mockCtGovFetch = async () => ({
    ok: true,
    json: async () => mockStudyResult,
  });
  const regDisc = await probeRegistryDiscovery(regContext, mockCtGovFetch);
  assert.strictEqual(regDisc.deltaVerdict, "NEW_TRIALS_DETECTED");
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
            "42302084": { status: "clean" }, // was clean, now has erratum
            "42676624": { status: "clean" }, // was clean, now retracted
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
  assert.strictEqual(litHealth.deltaVerdict, "NEW_ERRATUM_DETECTED");
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

test("CIK resolution hierarchy and mapping checks", () => {
  // AstraZeneca CIK check
  assert.strictEqual(KNOWN_SEC_CIKS["astrazeneca"], "0000901832");
  assert.notStrictEqual(KNOWN_SEC_CIKS["astrazeneca"], "0001053092"); // was Credit Suisse

  // Zealand Pharma CIK check
  assert.strictEqual(KNOWN_SEC_CIKS["zealand-pharma"], "0002068427");

  // Neurocrine Biosciences CIK check
  assert.strictEqual(KNOWN_SEC_CIKS["neurocrine-biosciences"], "0000914475");

  // Merck CIK check
  assert.strictEqual(KNOWN_SEC_CIKS["merck-co"], "0000310158");

  // Hierarchy check: CLI override > baseline > company metadata > default mapping
  const mockContext = {
    company: { secCik: "0009999991" },
    baseline: { discoveryCheckpoint: { secEdgar: { cik: "0009999992" } } },
  };

  // 1. CLI override takes top precedence
  assert.strictEqual(resolveCik("astrazeneca", "0009999999", mockContext), "0009999999");
  // 2. Baseline checkpoint takes next precedence
  assert.strictEqual(resolveCik("astrazeneca", null, mockContext), "0009999992");
  // 3. Company metadata takes next precedence
  assert.strictEqual(resolveCik("astrazeneca", null, { company: mockContext.company }), "0009999991");
  // 4. Fallback mapping
  assert.strictEqual(resolveCik("astrazeneca", null, null), "0000901832");
});

test("canonicalizeJson and parseEfetchXml unit assertions", () => {
  // canonicalizeJson sorts nested keys deterministically
  const obj1 = { z: 1, a: { y: 2, b: 3 } };
  const obj2 = { a: { b: 3, y: 2 }, z: 1 };
  assert.strictEqual(JSON.stringify(canonicalizeJson(obj1)), JSON.stringify(canonicalizeJson(obj2)));

  // parseEfetchXml handles empty/malformed input gracefully
  assert.strictEqual(parseEfetchXml("").size, 0);
  assert.strictEqual(parseEfetchXml(null).size, 0);
});

