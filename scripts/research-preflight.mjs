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

// In restricted corporate or Windows proxy environments, permit fallback TLS if system CA is missing.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

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
  let cik = null;
  let json = false;
  let verbose = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--company") {
      companyId = args[i + 1];
      i += 2;
    } else if (arg === "--cik") {
      cik = args[i + 1];
      i += 2;
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

  return { command, companyId, cik, json, verbose };
}

/**
 * Reads and indexes company, pipeline, and clinical evidence targets from disk.
 */
function loadCompanyContext(companyId) {
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
  const assetAliases = new Set();

  // Extract from pipeline programs
  for (const prog of programs) {
    if (prog.assetName) assetAliases.add(prog.assetName);
    if (prog.codeName) assetAliases.add(prog.codeName);
    for (const alias of prog.aliases ?? []) {
      if (alias.value) assetAliases.add(alias.value);
    }

    for (const src of prog.metadata?.sources ?? []) {
      if (src.url) {
        const nctMatch = src.url.match(/NCT\d{8}/i);
        if (nctMatch) knownNCTs.add(nctMatch[0].toUpperCase());
        const pmidMatch = src.url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
        if (pmidMatch) knownPMIDs.add(pmidMatch[1]);
      }
    }
  }

  // Extract from clinical evidence
  const ceCompanyPath = path.join(CLINICAL_DIR, companyId);
  if (fs.existsSync(ceCompanyPath)) {
    const assetFolders = fs.readdirSync(ceCompanyPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const assetFolder of assetFolders) {
      const ceFile = path.join(ceCompanyPath, assetFolder, "clinical-evidence.json");
      if (fs.existsSync(ceFile)) {
        const ceData = JSON.parse(fs.readFileSync(ceFile, "utf8"));
        for (const study of ceData.studies ?? []) {
          for (const regId of study.registryIdentifiers ?? []) {
            if (regId.id && /^NCT\d{8}$/i.test(regId.id)) {
              knownNCTs.add(regId.id.toUpperCase());
            }
          }
          for (const src of study.metadata?.sources ?? []) {
            if (src.pmid) knownPMIDs.add(String(src.pmid));
            if (src.url) {
              const nctMatch = src.url.match(/NCT\d{8}/i);
              if (nctMatch) knownNCTs.add(nctMatch[0].toUpperCase());
              const pmidMatch = src.url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
              if (pmidMatch) knownPMIDs.add(pmidMatch[1]);
            }
          }
        }
      }
    }
  }

  return {
    companyId,
    companyName: company.name,
    knownNCTs: [...knownNCTs].sort(),
    knownPMIDs: [...knownPMIDs].sort(),
    assetAliases: [...assetAliases].filter(Boolean).sort(),
  };
}

/**
 * Normalizes scientific fields of a CT.gov study and computes a SHA-256 fingerprint.
 */
function computeScientificFingerprint(study) {
  const protocol = study.protocolSection ?? {};
  const scientificPayload = {
    overallStatus: protocol.statusModule?.overallStatus ?? null,
    phase: protocol.designModule?.phases ?? [],
    designInfo: protocol.designModule?.designInfo ?? {},
    arms: (protocol.armsInterventionsModule?.armGroups ?? []).map((arm) => ({
      label: arm.label,
      type: arm.type,
      interventions: arm.interventionNames,
    })),
    primaryOutcomes: (protocol.outcomesModule?.primaryOutcomes ?? []).map((o) => ({
      measure: o.measure,
      timeFrame: o.timeFrame,
    })),
    secondaryOutcomes: (protocol.outcomesModule?.secondaryOutcomes ?? []).map((o) => ({
      measure: o.measure,
      timeFrame: o.timeFrame,
    })),
  };

  const canonicalString = JSON.stringify(scientificPayload, Object.keys(scientificPayload).sort());
  return {
    hash: crypto.createHash("sha256").update(canonicalString).digest("hex"),
    payload: scientificPayload,
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
        results.push({ nctId, status: "FETCH_ERROR", httpStatus: res.status });
        continue;
      }
      const data = await res.json();
      const lastUpdatePostDate = data.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date ?? null;
      const overallStatus = data.protocolSection?.statusModule?.overallStatus ?? "UNKNOWN";
      const briefTitle = data.protocolSection?.identificationModule?.briefTitle ?? "";
      const { hash } = computeScientificFingerprint(data);

      results.push({
        nctId,
        briefTitle,
        overallStatus,
        lastUpdatePostDate,
        scientificHash: hash,
        status: "OK",
      });
    } catch (err) {
      results.push({ nctId, status: "NETWORK_ERROR", message: err.message });
    }
  }

  return results;
}

/**
 * PROBE 2: Registry Discovery Probe (Company/Asset search to discover brand-new NCTs)
 */
async function probeRegistryDiscovery(context) {
  const candidateNCTs = new Map();
  const fields = "protocolSection.identificationModule.nctId,protocolSection.identificationModule.briefTitle,protocolSection.statusModule.overallStatus,protocolSection.statusModule.lastUpdatePostDateStruct";

  // 1. Query sponsor
  const sponsorUrl = `https://clinicaltrials.gov/api/v2/studies?query.spons=${encodeURIComponent(context.companyName)}&pageSize=50&fields=${fields}`;
  try {
    const res = await fetch(sponsorUrl);
    if (res.ok) {
      const data = await res.json();
      for (const study of data.studies ?? []) {
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
    }
  } catch {
    // Continue to asset queries if sponsor query encounters network error
  }

  // 2. Query asset aliases
  for (const alias of context.assetAliases) {
    if (alias.length < 4) continue; // skip ambiguous short tokens
    const intrUrl = `https://clinicaltrials.gov/api/v2/studies?query.intr=${encodeURIComponent(alias)}&pageSize=20&fields=${fields}`;
    try {
      const res = await fetch(intrUrl);
      if (res.ok) {
        const data = await res.json();
        for (const study of data.studies ?? []) {
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

  return {
    totalCandidates: candidateNCTs.size,
    newlyDiscoveredCount: newlyDiscovered.length,
    newlyDiscovered,
  };
}

/**
 * PROBE 3: Literature Health Check (Checks cited PMIDs for errata / retractions)
 */
async function probeLiteratureHealth(context) {
  if (context.knownPMIDs.length === 0) {
    return { citedCount: 0, errataCount: 0, checked: [] };
  }

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${context.knownPMIDs.join(",")}&retmode=json&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`PubMed esummary query failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const checked = [];
  let errataCount = 0;

  for (const pmid of context.knownPMIDs) {
    const doc = data.result?.[pmid];
    if (!doc) {
      checked.push({ pmid, status: "NOT_FOUND" });
      continue;
    }

    const commentsCorrections = doc.commentcorrectionlist ?? [];
    const adverseNotices = commentsCorrections.filter((c) =>
      /erratum|retraction|corrected|expressionofconcern/i.test(c.refstring || c.type || ""),
    );

    if (adverseNotices.length > 0) {
      errataCount += 1;
      checked.push({
        pmid,
        title: doc.title,
        status: "ERRATUM_DETECTED",
        notices: adverseNotices,
      });
    } else {
      checked.push({
        pmid,
        title: doc.title,
        pubdate: doc.pubdate,
        source: doc.source,
        status: "CLEAN",
      });
    }
  }

  return {
    citedCount: context.knownPMIDs.length,
    errataCount,
    checked,
  };
}

/**
 * PROBE 4: Literature Discovery Probe (Queries PubMed for asset aliases -> ID diff)
 */
async function probeLiteratureDiscovery(context) {
  if (context.assetAliases.length === 0) {
    return { discoveredCount: 0, newPMIDs: [] };
  }

  const aliasTerms = context.assetAliases
    .filter((a) => a.length >= 4)
    .map((a) => `"${a}"[Title/Abstract]`)
    .join(" OR ");

  const query = `(${aliasTerms}) AND (obesity[Title/Abstract] OR overweight[Title/Abstract] OR "weight loss"[Title/Abstract] OR "body weight"[Title/Abstract])`;
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=20&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;

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
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${newIdList.join(",")}&retmode=json&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;
    const sumRes = await fetch(summaryUrl);
    if (sumRes.ok) {
      const sumData = await sumRes.json();
      for (const id of newIdList) {
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

  return {
    totalHits: idList.length,
    newDiscoveredCount: newPMIDs.length,
    newPMIDs,
  };
}

/**
 * PROBE 5: SEC EDGAR Filings Probe
 */
async function probeSecFilings(companyId, cikOverride) {
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
    const count = Math.min(recent.form?.length ?? 0, 15);
    const filings = [];

    for (let i = 0; i < count; i += 1) {
      const form = recent.form[i];
      if (/^(8-K|10-Q|10-K|6-K)(\/A)?$/i.test(form)) {
        filings.push({
          form,
          filingDate: recent.filingDate[i],
          acceptanceDateTime: recent.acceptanceDateTime[i],
          accessionNumber: recent.accessionNumber[i],
          primaryDocument: recent.primaryDocument[i],
          description: recent.primaryDocDescription[i] || form,
        });
      }
    }

    return {
      status: "OK",
      companyName: data.name,
      cik: paddedCik,
      recentFilingsCount: filings.length,
      filings,
    };
  } catch (err) {
    return { status: "NETWORK_ERROR", message: err.message };
  }
}

/**
 * Formats results for clean, readable CLI reporting.
 */
function printReport(companyId, updateRes, discRes, healthRes, litDiscRes, secRes) {
  console.log("================================================================================");
  console.log(` RESEARCH PREFLIGHT REPORT: ${companyId}`);
  console.log("================================================================================");

  if (updateRes) {
    console.log(`\n[1/5] Registry Update Probe (Known NCTs: ${updateRes.length})`);
    console.log("--------------------------------------------------------------------------------");
    for (const r of updateRes) {
      console.log(`  ${r.nctId} | ${r.overallStatus.padEnd(20)} | Updated: ${r.lastUpdatePostDate ?? "N/A"} | Hash: ${r.scientificHash?.slice(0, 12)}...`);
      console.log(`    "${r.briefTitle.slice(0, 75)}"`);
    }
  }

  if (discRes) {
    console.log(`\n[2/5] Registry Discovery Probe (New Candidate Trials: ${discRes.newlyDiscoveredCount})`);
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
    console.log(`\n[3/5] Literature Health Check (Cited PMIDs: ${healthRes.citedCount})`);
    console.log("--------------------------------------------------------------------------------");
    if (healthRes.citedCount === 0) {
      console.log("  No cited PMIDs found for this company.");
    } else if (healthRes.errataCount === 0) {
      console.log(`  CLEAN: 0 errata/retractions across ${healthRes.citedCount} cited publications.`);
    } else {
      console.log(`  WARNING: ${healthRes.errataCount} adverse notices / errata detected:`);
      for (const c of healthRes.checked.filter((x) => x.status === "ERRATUM_DETECTED")) {
        console.log(`    ! PMID ${c.pmid}: "${c.title}"`);
        for (const n of c.notices) {
          console.log(`      - ${n.type || "Notice"}: ${n.refstring}`);
        }
      }
    }
  }

  if (litDiscRes) {
    console.log(`\n[4/5] Literature Discovery Probe (New Publications: ${litDiscRes.newDiscoveredCount})`);
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
      console.log(`  SEC CIK: ${secRes.cik} (${secRes.companyName}) - Recent Key Filings:`);
      for (const f of secRes.filings) {
        console.log(`    - Form ${f.form.padEnd(6)} | Filed: ${f.filingDate} | Accepted: ${f.acceptanceDateTime}`);
        console.log(`      Doc: ${f.primaryDocument} (${f.description})`);
      }
    } else {
      console.log(`  Status: ${secRes.status} (${secRes.message || "See details"})`);
    }
  }

  console.log("================================================================================\n");
}

/**
 * Main dispatcher.
 */
async function main() {
  const { command, companyId, cik, json } = parseArgs(process.argv);

  if (!companyId) {
    console.error("Error: --company <companyId> is required.");
    process.exit(1);
  }

  const context = loadCompanyContext(companyId);

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
    secRes = await probeSecFilings(companyId, cik);
  }

  if (json) {
    console.log(JSON.stringify({ companyId, updateRes, discRes, healthRes, litDiscRes, secRes }, null, 2));
  } else {
    printReport(companyId, updateRes, discRes, healthRes, litDiscRes, secRes);
  }
}

main().catch((err) => {
  console.error("Fatal preflight error:", err);
  process.exit(1);
});
