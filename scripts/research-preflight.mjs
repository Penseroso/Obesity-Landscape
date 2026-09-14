#!/usr/bin/env node
/**
 * scripts/research-preflight.mjs
 *
 * Deterministic, zero-LLM-token network preflight utility for Obesity Landscape research workflows.
 *
 * Subcommands:
 *   registry:update      - Inspect known NCTs on ClinicalTrials.gov API v2; detect timestamp & scientific field deltas.
 *   registry:discovery   - Query ClinicalTrials.gov API v2 with company/asset aliases; detect newly registered trials via ID set diff.
 *   literature:health    - Query PubMed E-utilities for cited PMIDs; detect publisher Errata/Retractions in CommentsCorrectionsList.
 *   literature:discovery - Query PubMed E-utilities for asset aliases; detect newly indexed peer-reviewed publications.
 *   sec                  - Query SEC EDGAR CIK submissions JSON for recent 8-K, 10-Q, 10-K, 6-K filings.
 *   all                  - Composite execution of all preflight checks for a target company.
 *
 * Invariant Guarantees:
 *   1. Strictly decoupled from offline CI (`npm run gate` is 100% reproducible and network-independent).
 *   2. Zero shadow databases or persistent external state files created.
 *   3. Free of LLM token consumption (pure HTTP GET + deterministic normalization & diffing).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";


const ROOT = process.cwd();
const COMPANY_DIR = path.join(ROOT, "domains", "company-pipeline", "data", "companies");
const CLINICAL_DIR = path.join(ROOT, "domains", "clinical-evidence", "data", "clinical-evidence");

const USER_AGENT_SEC = "ObesityLandscapeResearch/1.0 (research@obesitylandscape.org)";
const USER_AGENT_PUBMED_TOOL = "obesity-landscape";
const USER_AGENT_PUBMED_EMAIL = "research@obesitylandscape.org";

// Known public biopharma CIK registry mapping
const KNOWN_SEC_CIKS = {
  "structure-therapeutics": "0001888886", // GPCR
  "viking-therapeutics": "0001607678",    // VKTX
  "eli-lilly-and-company": "0000059478",  // LLY
  "novo-nordisk": "0000353278",           // NVO
  "amgen": "0000318154",                  // AMGN
  "pfizer": "0000078003",                 // PFE
  "astrazeneca": "0001053092",            // AZN
  "regeneron": "0000872589",              // REGN
  "abbvie": "0001551152",                 // ABBV
  "zealand-pharma": "0001664724",         // ZEAL
  "neurocrine-biosciences": "0000914404", // NBIX
  "merck-co": "0000064978",               // MRK
  "ascletis-pharma": "FOREIGN_EXCHANGE_HKEX",
  "hansoh-pharma": "FOREIGN_EXCHANGE_HKEX",
  "innovent-biologics": "FOREIGN_EXCHANGE_HKEX",
  "jiangsu-hengrui-pharmaceuticals": "FOREIGN_EXCHANGE_SSE",
  "gan-lee-pharmaceuticals": "FOREIGN_EXCHANGE_SSE",
  "chugai-pharmaceutical": "FOREIGN_EXCHANGE_TSE",
  "hanmi-pharmaceutical": "FOREIGN_EXCHANGE_KRX",
  "roche": "FOREIGN_EXCHANGE_SWX",
  "boehringer-ingelheim": "PRIVATE_NON_REPORTING",
  "sciwind-biosciences": "PRIVATE_NON_REPORTING",
  "kailera-therapeutics": "PRIVATE_NON_REPORTING",
  "verdiva-bio": "PRIVATE_NON_REPORTING",
  "ql-biopharm": "PRIVATE_NON_REPORTING",
};

/**
 * Parses CLI arguments.
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  let command = "all";
  let companyId = null;
  let assetId = null;
  let cik = null;
  let baseline = false;
  let json = false;
  let verbose = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--company") {
      companyId = args[i + 1];
      i += 2;
    } else if (arg === "--asset") {
      assetId = args[i + 1];
      i += 2;
    } else if (arg === "--cik") {
      cik = args[i + 1];
      i += 2;
    } else if (arg === "--baseline" || arg === "--write-checkpoint") {
      baseline = true;
      i += 1;
    } else if (arg === "--json") {
      json = true;
      i += 1;
    } else if (arg === "--verbose") {
      verbose = true;
      i += 1;
    } else if (!arg.startsWith("--")) {
      if (["all", "registry:update", "registry:discovery", "literature:health", "literature:discovery", "sec"].includes(arg)) {
        command = arg;
      } else if (!companyId) {
        companyId = arg;
      } else {
        console.error(`Unknown positional argument: ${arg}`);
        process.exit(1);
      }
      i += 1;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  return { command, companyId, assetId, cik, baseline, json, verbose };
}

/**
 * Recursively canonicalizes an object or array by sorting all object keys,
 * ensuring deterministic serialization regardless of property insertion order.
 */
function canonicalizeJson(val) {
  if (val === null || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(canonicalizeJson);
  const sorted = {};
  for (const key of Object.keys(val).sort()) {
    sorted[key] = canonicalizeJson(val[key]);
  }
  return sorted;
}

/**
 * Normalizes scientific fields of a CT.gov study and computes a SHA-256 fingerprint.
 */
function computeScientificFingerprint(study) {
  const protocol = study.protocolSection ?? {};
  const scientificPayload = {
    arms: (protocol.armsInterventionsModule?.armGroups ?? []).map((arm) => ({
      interventions: (arm.interventionNames ?? []).slice().sort(),
      label: arm.label ?? "",
      type: arm.type ?? "",
    })),
    designInfo: protocol.designModule?.designInfo ?? {},
    overallStatus: protocol.statusModule?.overallStatus ?? null,
    phase: protocol.designModule?.phases ?? [],
    primaryOutcomes: (protocol.outcomesModule?.primaryOutcomes ?? []).map((o) => ({
      measure: o.measure ?? "",
      timeFrame: o.timeFrame ?? "",
    })),
    secondaryOutcomes: (protocol.outcomesModule?.secondaryOutcomes ?? []).map((o) => ({
      measure: o.measure ?? "",
      timeFrame: o.timeFrame ?? "",
    })),
  };

  const canonicalObj = canonicalizeJson(scientificPayload);
  const canonicalString = JSON.stringify(canonicalObj);
  return {
    hash: crypto.createHash("sha256").update(canonicalString).digest("hex"),
    payload: scientificPayload,
  };
}

/**
 * Resolves external DOIs and PMC IDs to PMIDs via PubMed E-utilities.
 */
async function resolveDoisAndPmcsToPmids(dois, pmcs) {
  const pmidMap = new Map();

  for (const doi of dois) {
    try {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi + "[doi]")}&retmode=json&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const idList = data.esearchresult?.idlist ?? [];
        if (idList.length > 0) {
          pmidMap.set(doi, idList[0]);
        }
      }
    } catch {
      // Ignore transient network failure during identifier resolution
    }
  }

  for (const pmc of pmcs) {
    try {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(pmc + "[pmc]")}&retmode=json&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const idList = data.esearchresult?.idlist ?? [];
        if (idList.length > 0) {
          pmidMap.set(pmc, idList[0]);
        }
      }
    } catch {
      // Ignore transient network failure
    }
  }

  return pmidMap;
}

/**
 * Reads and indexes company, pipeline, and clinical evidence targets from disk.
 * Extracts NCTs, PMIDs, DOIs, PMCs, and existing checkpoints.
 */
async function loadCompanyContext(companyId, targetAssetId) {
  const companyFolderPath = path.join(COMPANY_DIR, companyId);
  if (!fs.existsSync(companyFolderPath)) {
    throw new Error(`Company folder not found: ${companyFolderPath}`);
  }

  const companyJsonPath = path.join(companyFolderPath, "company.json");
  const pipelineJsonPath = path.join(companyFolderPath, "pipeline-programs.json");

  const company = JSON.parse(fs.readFileSync(companyJsonPath, "utf8"));
  const programs = fs.existsSync(pipelineJsonPath)
    ? JSON.parse(fs.readFileSync(pipelineJsonPath, "utf8"))
    : [];

  const knownNCTs = new Set();
  const knownPMIDs = new Set();
  const knownDOIs = new Set();
  const knownPMCs = new Set();
  const assetAliases = new Set();

  function scanSources(sources) {
    for (const src of sources ?? []) {
      if (src.pmid) knownPMIDs.add(String(src.pmid));
      if (src.doi) {
        const match = src.doi.match(/10\.\d{4,9}\/[^\s"'>#?]+/i);
        if (match) knownDOIs.add(match[0]);
      }
      if (src.url) {
        const nctMatch = src.url.match(/NCT\d{8}/i);
        if (nctMatch) knownNCTs.add(nctMatch[0].toUpperCase());

        const pmidMatch = src.url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
        if (pmidMatch) knownPMIDs.add(pmidMatch[1]);

        const pmcMatch = src.url.match(/ncbi\.nlm\.nih\.gov\/pmc\/articles\/(PMC\d+)/i);
        if (pmcMatch) knownPMCs.add(pmcMatch[1].toUpperCase());

        const doiMatch = src.url.match(/10\.\d{4,9}\/[^\s"'>#?]+/i);
        if (doiMatch) knownDOIs.add(doiMatch[0]);
      }
    }
  }

  // 1. Extract from pipeline programs
  for (const prog of programs) {
    if (prog.assetName) assetAliases.add(prog.assetName);
    if (prog.codeName) assetAliases.add(prog.codeName);
    for (const alias of prog.aliases ?? []) {
      if (alias.value) assetAliases.add(alias.value);
    }
    scanSources(prog.metadata?.sources);
  }

  // 2. Extract from clinical evidence
  let assetBaseline = null;
  let assetClinicalEvidencePath = null;
  const ceCompanyPath = path.join(CLINICAL_DIR, companyId);

  if (fs.existsSync(ceCompanyPath)) {
    const assetFolders = fs.readdirSync(ceCompanyPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const assetFolder of assetFolders) {
      if (targetAssetId && assetFolder !== targetAssetId) continue;

      const ceFile = path.join(ceCompanyPath, assetFolder, "clinical-evidence.json");
      if (fs.existsSync(ceFile)) {
        const ceData = JSON.parse(fs.readFileSync(ceFile, "utf8"));
        if (targetAssetId && assetFolder === targetAssetId) {
          assetBaseline = ceData.researchState ?? null;
          assetClinicalEvidencePath = ceFile;
        }

        for (const study of ceData.studies ?? []) {
          for (const regId of study.registryIdentifiers ?? []) {
            if (regId.id && /^NCT\d{8}$/i.test(regId.id)) {
              knownNCTs.add(regId.id.toUpperCase());
            }
          }
          scanSources(study.metadata?.sources);
        }
      }
    }
  }

  // 3. Resolve external DOIs and PMCs to PMIDs
  if (knownDOIs.size > 0 || knownPMCs.size > 0) {
    const resolved = await resolveDoisAndPmcsToPmids([...knownDOIs], [...knownPMCs]);
    for (const pmid of resolved.values()) {
      knownPMIDs.add(pmid);
    }
  }

  // Select authoritative baseline: asset-specific if targetAssetId provided, else company-level
  const baseline = targetAssetId ? assetBaseline : (company.researchState ?? null);
  const targetFile = targetAssetId ? assetClinicalEvidencePath : companyJsonPath;

  return {
    companyId,
    companyName: company.name,
    targetAssetId,
    targetFile,
    baseline,
    knownNCTs: [...knownNCTs].sort(),
    knownPMIDs: [...knownPMIDs].sort(),
    assetAliases: [...assetAliases].filter(Boolean).sort(),
  };
}

/**
 * PROBE 1: Registry Update Probe (Known NCTs timestamp & scientific hash delta)
 */
async function probeRegistryUpdate(context) {
  const results = [];
  const fieldMask = "protocolSection.identificationModule,protocolSection.statusModule,protocolSection.designModule,protocolSection.armsInterventionsModule,protocolSection.outcomesModule";

  for (const nctId of context.knownNCTs) {
    const url = `https://clinicaltrials.gov/api/v2/studies/${nctId}?fields=${fieldMask}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        results.push({ nctId, deltaVerdict: "FETCH_ERROR", httpStatus: res.status });
        continue;
      }
      const data = await res.json();
      const lastUpdatePostDate = data.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date ?? null;
      const overallStatus = data.protocolSection?.statusModule?.overallStatus ?? "UNKNOWN";
      const briefTitle = data.protocolSection?.identificationModule?.briefTitle ?? "";
      const { hash, payload } = computeScientificFingerprint(data);

      const baselineEntry = context.baseline?.discoveryCheckpoint?.clinicalTrials?.knownNCTs?.[nctId];
      let deltaVerdict = "LEGACY_UNBASELINED";
      let deltaMessage = "No stored baseline for study.";

      if (baselineEntry) {
        if (baselineEntry.lastUpdatePostDate === lastUpdatePostDate) {
          deltaVerdict = "UNCHANGED";
          deltaMessage = `Post date unchanged (${lastUpdatePostDate}). Verification skipped.`;
        } else if (baselineEntry.semanticHash && baselineEntry.semanticHash === hash) {
          deltaVerdict = "ADMIN_UPDATE_BYPASS";
          deltaMessage = `Post date changed (${baselineEntry.lastUpdatePostDate} -> ${lastUpdatePostDate}), but scientific fingerprint is identical. Administrative update only.`;
        } else {
          deltaVerdict = "SCIENTIFIC_UPDATE_DETECTED";
          deltaMessage = `Scientific protocol changed! Post date: ${baselineEntry.lastUpdatePostDate} -> ${lastUpdatePostDate}. Hash changed.`;
        }
      }

      results.push({
        nctId,
        briefTitle,
        overallStatus,
        lastUpdatePostDate,
        scientificHash: hash,
        baselinePostDate: baselineEntry?.lastUpdatePostDate ?? null,
        deltaVerdict,
        deltaMessage,
        payload,
      });
    } catch (err) {
      results.push({ nctId, deltaVerdict: "NETWORK_ERROR", message: err.message });
    }
  }

  return results;
}

/**
 * Helper to fetch studies from CT.gov API v2 with nextPageToken pagination.
 */
async function fetchCtGovStudies(baseUrl, maxPages = 5) {
  let currentUrl = baseUrl;
  const allStudies = [];
  let pageCount = 0;

  while (currentUrl && pageCount < maxPages) {
    pageCount += 1;
    const res = await fetch(currentUrl);
    if (!res.ok) break;
    const data = await res.json();
    const studies = data.studies ?? [];
    allStudies.push(...studies);
    if (data.nextPageToken) {
      const parsed = new URL(currentUrl);
      parsed.searchParams.set("pageToken", data.nextPageToken);
      currentUrl = parsed.toString();
    } else {
      break;
    }
  }

  return allStudies;
}

/**
 * PROBE 2: Registry Discovery Probe (Company/Asset search to discover brand-new NCTs)
 */
async function probeRegistryDiscovery(context) {
  const candidateNCTs = new Map();
  const fields = "protocolSection.identificationModule.nctId,protocolSection.identificationModule.briefTitle,protocolSection.statusModule.overallStatus,protocolSection.statusModule.lastUpdatePostDateStruct";

  // 1. Query sponsor with pagination
  const sponsorUrl = `https://clinicaltrials.gov/api/v2/studies?query.spons=${encodeURIComponent(context.companyName)}&pageSize=50&fields=${fields}`;
  try {
    const studies = await fetchCtGovStudies(sponsorUrl, 5);
    for (const study of studies) {
      const id = study.protocolSection?.identificationModule?.nctId;
      if (id) {
        candidateNCTs.set(id, {
          nctId: id,
          briefTitle: study.protocolSection?.identificationModule?.briefTitle ?? "",
          overallStatus: study.protocolSection?.statusModule?.overallStatus ?? "UNKNOWN",
          lastUpdatePostDate: study.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date ?? null,
          matchedOn: `sponsor: ${context.companyName}`,
        });
      }
    }
  } catch {
    // Continue to asset queries if sponsor query encounters network error
  }

  // 2. Query asset aliases
  for (const alias of context.assetAliases) {
    if (alias.length < 4) continue; // skip ambiguous short tokens
    const intrUrl = `https://clinicaltrials.gov/api/v2/studies?query.intr=${encodeURIComponent(alias)}&pageSize=20&fields=${fields}`;
    try {
      const studies = await fetchCtGovStudies(intrUrl, 2);
      for (const study of studies) {
        const id = study.protocolSection?.identificationModule?.nctId;
        if (id && !candidateNCTs.has(id)) {
          candidateNCTs.set(id, {
            nctId: id,
            briefTitle: study.protocolSection?.identificationModule?.briefTitle ?? "",
            overallStatus: study.protocolSection?.statusModule?.overallStatus ?? "UNKNOWN",
            lastUpdatePostDate: study.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date ?? null,
            matchedOn: `intervention: ${alias}`,
          });
        }
      }
    } catch {
      // Ignore transient query error
    }
  }

  const knownSet = new Set(context.knownNCTs);
  const newlyDiscovered = [];
  for (const [id, record] of candidateNCTs.entries()) {
    if (!knownSet.has(id)) {
      newlyDiscovered.push(record);
    }
  }

  const deltaVerdict = newlyDiscovered.length > 0 ? "NEW_TRIALS_DETECTED" : "CLEAN";

  return {
    totalCandidates: candidateNCTs.size,
    newlyDiscoveredCount: newlyDiscovered.length,
    deltaVerdict,
    newlyDiscovered,
  };
}

/**
 * PROBE 3: Literature Health Check (Checks cited PMIDs for errata / retractions)
 */
async function probeLiteratureHealth(context) {
  if (context.knownPMIDs.length === 0) {
    return { citedCount: 0, errataCount: 0, deltaVerdict: "CLEAN", checked: [] };
  }

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${context.knownPMIDs.join(",")}&retmode=json&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`PubMed esummary query failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const checked = [];
  let errataCount = 0;
  let newErrataCount = 0;

  const monitored = context.baseline?.discoveryCheckpoint?.literature?.monitoredPMIDs ?? {};

  for (const pmid of context.knownPMIDs) {
    const doc = data.result?.[pmid];
    if (!doc) {
      checked.push({ pmid, status: "NOT_FOUND", deltaVerdict: "NOT_FOUND" });
      continue;
    }

    const commentsCorrections = doc.commentcorrectionlist ?? [];
    const adverseNotices = commentsCorrections.filter((c) =>
      /erratum|retraction|corrected|expressionofconcern/i.test(c.refstring || c.type || ""),
    );

    const prevBaseline = monitored[pmid];

    if (adverseNotices.length > 0) {
      errataCount += 1;
      const isKnown = prevBaseline?.status === "has-erratum" || prevBaseline?.status === "retracted";
      const deltaVerdict = isKnown ? "KNOWN_ERRATUM" : "NEW_ERRATUM_DETECTED";
      if (!isKnown) newErrataCount += 1;

      checked.push({
        pmid,
        title: doc.title,
        status: "ERRATUM_DETECTED",
        deltaVerdict,
        notices: adverseNotices,
      });
    } else {
      checked.push({
        pmid,
        title: doc.title,
        pubdate: doc.pubdate,
        source: doc.source,
        status: "CLEAN",
        deltaVerdict: "CLEAN",
      });
    }
  }

  const overallVerdict = newErrataCount > 0 ? "NEW_ERRATA_DETECTED" : "CLEAN";

  return {
    citedCount: context.knownPMIDs.length,
    errataCount,
    newErrataCount,
    deltaVerdict: overallVerdict,
    checked,
  };
}

/**
 * PROBE 4: Literature Discovery Probe (Queries PubMed for asset aliases -> ID diff)
 */
async function probeLiteratureDiscovery(context) {
  if (context.assetAliases.length === 0) {
    return { totalHits: 0, newDiscoveredCount: 0, deltaVerdict: "CLEAN", newPMIDs: [] };
  }

  const aliasTerms = context.assetAliases
    .filter((a) => a.length >= 4)
    .map((a) => `"${a}"[Title/Abstract]`)
    .join(" OR ");

  const query = `(${aliasTerms}) AND (obesity[Title/Abstract] OR overweight[Title/Abstract] OR "weight loss"[Title/Abstract] OR "body weight"[Title/Abstract])`;
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=100&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    throw new Error(`PubMed esearch query failed: HTTP ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  const idList = searchData.esearchresult?.idlist ?? [];
  const knownSet = new Set(context.knownPMIDs);
  const newIdList = idList.filter((id) => !knownSet.has(id));

  const newPMIDs = [];
  if (newIdList.length > 0) {
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${newIdList.slice(0, 20).join(",")}&retmode=json&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;
    const sumRes = await fetch(summaryUrl);
    if (sumRes.ok) {
      const sumData = await sumRes.json();
      for (const id of newIdList.slice(0, 20)) {
        const doc = sumData.result?.[id];
        newPMIDs.push({
          pmid: id,
          title: doc?.title ?? "",
          source: doc?.source ?? "",
          pubdate: doc?.pubdate ?? "",
        });
      }
    }
  }

  const deltaVerdict = newPMIDs.length > 0 ? "NEW_PUBLICATIONS_DETECTED" : "CLEAN";

  return {
    totalHits: idList.length,
    newDiscoveredCount: newPMIDs.length,
    deltaVerdict,
    newPMIDs,
  };
}

/**
 * PROBE 5: SEC EDGAR Filings Probe (Full scan + checkpoint delta comparator)
 */
async function probeSecFilings(companyId, cikOverride, checkpoint) {
  const cik = cikOverride || KNOWN_SEC_CIKS[companyId];

  if (!cik) {
    return { status: "UNMAPPED_CIK", message: "Company CIK not in registry mapping. Specify --cik <cik>." };
  }

  if (cik.startsWith("FOREIGN_EXCHANGE") || cik.startsWith("PRIVATE")) {
    return { status: "NON_SEC_REPORTING", classification: cik };
  }

  const paddedCik = cik.padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT_SEC } });
    if (!res.ok) {
      return { status: "FETCH_ERROR", httpStatus: res.status };
    }

    const data = await res.json();
    const recent = data.filings?.recent ?? {};
    const totalFilings = recent.form?.length ?? 0;
    const keyFilings = [];

    for (let i = 0; i < totalFilings; i += 1) {
      const form = recent.form[i];
      if (/^(8-K|10-Q|10-K|6-K|20-F)(\/A)?$/i.test(form)) {
        keyFilings.push({
          form,
          filingDate: recent.filingDate[i],
          acceptanceDateTime: recent.acceptanceDateTime[i],
          accessionNumber: recent.accessionNumber[i],
          primaryDocument: recent.primaryDocument[i],
          description: recent.primaryDocDescription[i] || form,
        });
      }
    }

    const baselineAcceptance = checkpoint?.secEdgar?.latestAcceptanceDateTime;
    let deltaVerdict = "LEGACY_UNBASELINED";
    let newFilings = keyFilings;

    if (baselineAcceptance) {
      newFilings = keyFilings.filter((f) => f.acceptanceDateTime > baselineAcceptance);
      if (newFilings.length === 0) {
        deltaVerdict = "UNCHANGED";
      } else {
        deltaVerdict = "NEW_FILINGS_DETECTED";
      }
    }

    return {
      status: "OK",
      companyName: data.name,
      cik: paddedCik,
      deltaVerdict,
      baselineAcceptance: baselineAcceptance ?? null,
      totalKeyFilings: keyFilings.length,
      newFilingsCount: newFilings.length,
      filings: deltaVerdict === "UNCHANGED" ? [] : newFilings.slice(0, 10),
      allRecentKeyFilings: keyFilings.slice(0, 10),
    };
  } catch (err) {
    return { status: "NETWORK_ERROR", message: err.message };
  }
}

/**
 * Constructs and writes the updated researchState checkpoint to canonical JSON.
 */
function saveBaselineCheckpoint(context, updateRes, healthRes, secRes) {
  const asOf = new Date().toISOString().slice(0, 10);
  const knownNCTsMap = {};

  for (const r of (updateRes ?? [])) {
    if (r.nctId && r.lastUpdatePostDate) {
      knownNCTsMap[r.nctId] = {
        lastUpdatePostDate: r.lastUpdatePostDate,
        semanticHash: r.scientificHash,
      };
    }
  }

  const monitoredPMIDsMap = {};
  for (const h of (healthRes?.checked ?? [])) {
    if (h.pmid) {
      monitoredPMIDsMap[h.pmid] = {
        status: h.status === "ERRATUM_DETECTED" ? "has-erratum" : "clean",
        lastCheckedAt: asOf,
      };
    }
  }

  let secEdgar;
  if (secRes && secRes.status === "OK" && secRes.allRecentKeyFilings?.length > 0) {
    const latest = secRes.allRecentKeyFilings[0];
    secEdgar = {
      cik: secRes.cik,
      latestAcceptanceDateTime: latest.acceptanceDateTime,
      latestAccessionNumber: latest.accessionNumber,
    };
  }

  const researchState = {
    checkpointVersion: 1,
    workflowRevision: "ADR-0070",
    coldPathEligible: true,
    discoveryCheckpoint: {
      asOf,
      ...(secEdgar ? { secEdgar } : {}),
      clinicalTrials: {
        sponsorQuery: context.companyName,
        assetAliases: context.assetAliases,
        lastQueriedAt: asOf,
        knownNCTs: knownNCTsMap,
      },
      literature: {
        assetAliases: context.assetAliases,
        lastQueriedAt: asOf,
        monitoredPMIDs: monitoredPMIDsMap,
      },
    },
  };

  const targetPath = context.targetFile;
  const existingJson = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  existingJson.researchState = researchState;
  fs.writeFileSync(targetPath, JSON.stringify(existingJson, null, 2) + "\n", "utf8");

  return {
    targetPath,
    researchState,
  };
}

/**
 * Formats results for clean, readable CLI reporting.
 */
function printReport(context, updateRes, discRes, healthRes, litDiscRes, secRes, savedBaseline) {
  const hasBaseline = Boolean(context.baseline?.discoveryCheckpoint);
  const baselineDate = context.baseline?.discoveryCheckpoint?.asOf ?? "NONE";

  console.log("================================================================================");
  console.log(` RESEARCH PREFLIGHT REPORT: ${context.companyId}`);
  console.log(` Target File : ${path.relative(ROOT, context.targetFile)}`);
  console.log(` Baseline    : ${hasBaseline ? `ESTABLISHED (asOf ${baselineDate})` : "LEGACY UNBASELINED"}`);
  console.log("================================================================================");

  if (updateRes) {
    console.log(`\n[1/5] Registry Update Probe (Tracked NCTs: ${updateRes.length})`);
    console.log("--------------------------------------------------------------------------------");
    for (const r of updateRes) {
      const badge = `[${r.deltaVerdict}]`.padEnd(28);
      console.log(`  ${badge} ${r.nctId} | ${r.overallStatus.padEnd(20)} | PostDate: ${r.lastUpdatePostDate ?? "N/A"} | Hash: ${r.scientificHash?.slice(0, 10)}...`);
      console.log(`    "${r.briefTitle.slice(0, 75)}"`);
      if (r.deltaVerdict === "ADMIN_UPDATE_BYPASS") {
        console.log(`    => Administrative update only (PostDate was ${r.baselinePostDate}). Scientific payload identical. Full-text re-reading skipped.`);
      } else if (r.deltaVerdict === "SCIENTIFIC_UPDATE_DETECTED") {
        console.log(`    => ALERT: Scientific payload changed since baseline (${r.baselinePostDate}). Targeted audit required.`);
      }
    }
  }

  if (discRes) {
    console.log(`\n[2/5] Registry Discovery Probe (Total Candidates: ${discRes.totalCandidates}, Newly Discovered: ${discRes.newlyDiscoveredCount})`);
    console.log("--------------------------------------------------------------------------------");
    if (discRes.newlyDiscoveredCount === 0) {
      console.log(`  CLEAN: All ${discRes.totalCandidates} registry candidate trials are already known in repository.`);
    } else {
      console.log(`  ALERT: ${discRes.newlyDiscoveredCount} newly registered trials discovered:`);
      for (const d of discRes.newlyDiscovered) {
        console.log(`    + ${d.nctId} [${d.overallStatus}] (PostDate: ${d.lastUpdatePostDate})`);
        console.log(`      "${d.briefTitle}"`);
        console.log(`      Matched: ${d.matchedOn}`);
      }
    }
  }

  if (healthRes) {
    console.log(`\n[3/5] Literature Health Check (Monitored PMIDs: ${healthRes.citedCount})`);
    console.log("--------------------------------------------------------------------------------");
    if (healthRes.citedCount === 0) {
      console.log("  No cited PMIDs or resolvable literature DOIs found for this target.");
    } else if (healthRes.errataCount === 0) {
      console.log(`  CLEAN: 0 errata/retractions across ${healthRes.citedCount} monitored publications.`);
    } else {
      console.log(`  NOTICES: ${healthRes.errataCount} errata/retractions detected (${healthRes.newErrataCount} new since baseline):`);
      for (const c of healthRes.checked.filter((x) => x.status === "ERRATUM_DETECTED")) {
        console.log(`    ! [${c.deltaVerdict}] PMID ${c.pmid}: "${c.title}"`);
        for (const n of c.notices) {
          console.log(`      - ${n.type || "Notice"}: ${n.refstring}`);
        }
      }
    }
  }

  if (litDiscRes) {
    console.log(`\n[4/5] Literature Discovery Probe (Tracked Aliases: ${context.assetAliases.length}, Newly Discovered: ${litDiscRes.newDiscoveredCount})`);
    console.log("--------------------------------------------------------------------------------");
    if (litDiscRes.newDiscoveredCount === 0) {
      console.log("  CLEAN: 0 new indexed PubMed publications for tracked asset aliases.");
    } else {
      console.log(`  DISCOVERED: ${litDiscRes.newDiscoveredCount} newly indexed publications:`);
      for (const p of litDiscRes.newPMIDs) {
        console.log(`    * PMID ${p.pmid} (${p.source}, ${p.pubdate}):`);
        console.log(`      "${p.title}"`);
      }
    }
  }

  if (secRes) {
    console.log("\n[5/5] SEC EDGAR Filings Probe");
    console.log("--------------------------------------------------------------------------------");
    if (secRes.status === "NON_SEC_REPORTING") {
      console.log(`  BYPASS: Company classification is ${secRes.classification}. SEC probe skipped.`);
    } else if (secRes.status === "OK") {
      console.log(`  SEC CIK: ${secRes.cik} (${secRes.companyName}) | Verdict: [${secRes.deltaVerdict}]`);
      if (secRes.deltaVerdict === "UNCHANGED") {
        console.log(`  CLEAN: 0 new filings since checkpoint acceptance (${secRes.baselineAcceptance}).`);
        if (secRes.allRecentKeyFilings.length > 0) {
          const l = secRes.allRecentKeyFilings[0];
          console.log(`  Latest on record: Form ${l.form} | Filed: ${l.filingDate} | Accepted: ${l.acceptanceDateTime}`);
        }
      } else {
        console.log(`  Filings to review (${secRes.newFilingsCount} new):`);
        for (const f of secRes.filings) {
          console.log(`    - Form ${f.form.padEnd(6)} | Filed: ${f.filingDate} | Accepted: ${f.acceptanceDateTime}`);
          console.log(`      Doc: ${f.primaryDocument} (${f.description})`);
        }
      }
    } else {
      console.log(`  Status: ${secRes.status} (${secRes.message || "See details"})`);
    }
  }

  if (savedBaseline) {
    console.log("\n[BASELINE PERSISTENCE]");
    console.log("--------------------------------------------------------------------------------");
    console.log(`  [SUCCESS] Written authoritative researchState checkpoint to:`);
    console.log(`  ${path.relative(ROOT, savedBaseline.targetPath)}`);
    console.log(`  Recorded ${Object.keys(savedBaseline.researchState.discoveryCheckpoint.clinicalTrials?.knownNCTs ?? {}).length} NCT hashes and ${Object.keys(savedBaseline.researchState.discoveryCheckpoint.literature?.monitoredPMIDs ?? {}).length} monitored PMIDs.`);
  }

  console.log("================================================================================\n");
}

/**
 * Main dispatcher.
 */
async function main() {
  const { command, companyId, assetId, cik, baseline, json } = parseArgs(process.argv);

  if (!companyId) {
    console.error("Error: --company <companyId> is required.");
    process.exit(1);
  }

  const context = await loadCompanyContext(companyId, assetId);

  let updateRes = null;
  let discRes = null;
  let healthRes = null;
  let litDiscRes = null;
  let secRes = null;

  if (command === "registry:update" || command === "all") {
    updateRes = await probeRegistryUpdate(context);
  }
  if (command === "registry:discovery" || command === "all") {
    discRes = await probeRegistryDiscovery(context);
  }
  if (command === "literature:health" || command === "all") {
    healthRes = await probeLiteratureHealth(context);
  }
  if (command === "literature:discovery" || command === "all") {
    litDiscRes = await probeLiteratureDiscovery(context);
  }
  if (command === "sec" || command === "all") {
    secRes = await probeSecFilings(companyId, cik, context.baseline?.discoveryCheckpoint);
  }

  let savedBaseline = null;
  if (baseline) {
    savedBaseline = saveBaselineCheckpoint(context, updateRes, healthRes, secRes);
  }

  if (json) {
    console.log(JSON.stringify({ companyId, assetId, updateRes, discRes, healthRes, litDiscRes, secRes, savedBaseline }, null, 2));
  } else {
    printReport(context, updateRes, discRes, healthRes, litDiscRes, secRes, savedBaseline);
  }
}

main().catch((err) => {
  console.error("Fatal preflight error:", err);
  process.exit(1);
});
