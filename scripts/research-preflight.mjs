#!/usr/bin/env node
/**
 * scripts/research-preflight.mjs
 *
 * Deterministic, zero-LLM-token network preflight utility for Obesity Landscape research workflows.
 *
 * Subcommands:
 *   registry:update      - Inspect known NCTs on ClinicalTrials.gov API v2; detect timestamp & scientific field deltas.
 *   registry:discovery   - Query ClinicalTrials.gov API v2 with company/asset aliases; detect newly registered trials via ID set diff.
 *   literature:health    - Query PubMed EFetch XML for cited PMIDs; detect publisher Errata/Retractions in CommentsCorrectionsList.
 *   literature:discovery - Query PubMed ESearch for asset aliases; detect newly indexed peer-reviewed publications.
 *   sec                  - Query SEC EDGAR CIK submissions JSON for recent 8-K, 10-Q, 10-K, 6-K filings.
 *   all                  - Composite execution of all preflight checks for a target company or asset.
 *
 * Invariant Guarantees:
 *   1. Strictly decoupled from offline CI (`npm run gate` is 100% reproducible and network-independent).
 *   2. Zero shadow databases or persistent external state files created.
 *   3. Free of LLM token consumption (pure HTTP GET + deterministic normalization & diffing).
 *   4. Checkpoint write safety: blocked on any unresolved delta, network error, or incomplete state.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const COMPANY_DIR = path.join(ROOT, "domains", "company-pipeline", "data", "companies");
const CLINICAL_DIR = path.join(ROOT, "domains", "clinical-evidence", "data", "clinical-evidence");

export const CURRENT_FINGERPRINT_VERSION = 2;
export const CURRENT_WORKFLOW_REVISION = "ADR-0070";

export const USER_AGENT_SEC = "ObesityLandscapeResearch/1.0 (research@obesitylandscape.org)";
export const USER_AGENT_PUBMED_TOOL = "obesity-landscape";
export const USER_AGENT_PUBMED_EMAIL = "research@obesitylandscape.org";

// Bootstrap convenience fallback mapping (verified with SEC EDGAR company_tickers.json)
export const KNOWN_SEC_CIKS = {
  "structure-therapeutics": "0001888886", // GPCR
  "viking-therapeutics": "0001607678",    // VKTX
  "eli-lilly-and-company": "0000059478",  // LLY
  "novo-nordisk": "0000353278",           // NVO
  "amgen": "0000318154",                  // AMGN
  "pfizer": "0000078003",                 // PFE
  "astrazeneca": "0000901832",            // AZN
  "regeneron": "0000872589",              // REGN
  "abbvie": "0001551152",                 // ABBV
  "zealand-pharma": "0002068427",         // ZLDPF
  "neurocrine-biosciences": "0000914475", // NBIX
  "merck-co": "0000310158",               // MRK
  "innovent-biologics": "0001774163",     // IVBXF
  "ascletis-pharma": "FOREIGN_EXCHANGE_HKEX",
  "hansoh-pharma": "FOREIGN_EXCHANGE_HKEX",
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
 * Resolves SEC CIK following the authoritative hierarchy:
 * 1. explicit CLI override (`--cik <cik>`)
 * 2. canonical company metadata (`company.secCik`)
 * 3. stored baseline checkpoint (`baseline.secEdgar?.cik`)
 * 4. bootstrap fallback mapping (`KNOWN_SEC_CIKS`)
 *
 * Conflict detection:
 * If canonical `company.secCik` and stored checkpoint CIK both exist and disagree,
 * returns status `CIK_CONFLICT` to halt execution.
 */
export function resolveCik(companyId, cliCik, context = null) {
  // 1. Explicit CLI override takes highest precedence
  if (cliCik) return { cik: cliCik, status: "OK" };

  const canonicalCik = context?.company?.secCik ?? null;
  const checkpointCik = context?.baseline?.discoveryCheckpoint?.secEdgar?.cik ?? null;

  // Conflict check: if both exist and do not match
  if (canonicalCik && checkpointCik && canonicalCik !== checkpointCik) {
    return {
      cik: null,
      status: "CIK_CONFLICT",
      message: `CIK conflict detected: canonical company.secCik (${canonicalCik}) does not match stored checkpoint CIK (${checkpointCik}). Canonical update or re-baseline required.`,
    };
  }

  // 2. Canonical company.secCik takes precedence over checkpoint
  if (canonicalCik) return { cik: canonicalCik, status: "OK" };

  // 3. Stored checkpoint CIK
  if (checkpointCik) return { cik: checkpointCik, status: "OK" };

  // 4. Bootstrap fallback mapping
  const fallback = KNOWN_SEC_CIKS[companyId] ?? null;
  if (fallback) return { cik: fallback, status: "OK" };

  return { cik: null, status: "UNMAPPED_CIK", message: "Company CIK not in registry mapping. Specify --cik <cik>." };
}

/**
 * Parses CLI arguments.
 * Deprecates ambiguous legacy aliases `--baseline`, `--write-checkpoint`, and redundant `--ack-all`.
 */
export function parseArgs(argv) {
  const args = argv.slice(2);
  let command = "all";
  let companyId = null;
  let assetId = null;
  let cik = null;
  let domain = null;
  let bootstrap = false;
  let advance = false;
  let ackFilings = false;
  let ackDeltas = false;
  let json = false;
  let hasCpFlag = false;
  let hasCeFlag = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--company") {
      companyId = args[i + 1];
      i += 2;
    } else if (arg === "--asset") {
      assetId = args[i + 1];
      i += 2;
    } else if (arg === "--domain") {
      domain = args[i + 1];
      if (domain === "company-pipeline") hasCpFlag = true;
      else if (domain === "clinical-evidence") hasCeFlag = true;
      i += 2;
    } else if (arg === "--clinical" || arg === "--ce") {
      domain = "clinical-evidence";
      hasCeFlag = true;
      i += 1;
    } else if (arg === "--pipeline" || arg === "--cp") {
      domain = "company-pipeline";
      hasCpFlag = true;
      i += 1;
    } else if (arg === "--cik") {
      cik = args[i + 1];
      i += 2;
    } else if (arg === "--bootstrap") {
      bootstrap = true;
      i += 1;
    } else if (arg === "--advance") {
      advance = true;
      i += 1;
    } else if (arg === "--baseline" || arg === "--write-checkpoint") {
      console.error("Error: '--baseline' and '--write-checkpoint' are deprecated ambiguous aliases. Explicitly specify '--bootstrap' (to establish initial baseline) or '--advance' (to advance an existing checkpoint).");
      process.exit(1);
    } else if (arg === "--ack-filings") {
      ackFilings = true;
      i += 1;
    } else if (arg === "--ack-deltas") {
      ackDeltas = true;
      ackFilings = true;
      i += 1;
    } else if (arg === "--ack-all") {
      console.error("Error: '--ack-all' is deprecated. Use '--ack-deltas' instead.");
      process.exit(1);
    } else if (arg === "--json") {
      json = true;
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

  if (hasCpFlag && hasCeFlag) {
    console.error("Error: Conflicting domain flags specified. Cannot specify both Company/Pipeline ('--pipeline', '--cp', '--domain company-pipeline') and Clinical Evidence ('--clinical', '--ce', '--domain clinical-evidence') in the same command.");
    process.exit(1);
  }

  if (hasCpFlag && assetId) {
    console.error("Error: Invalid argument combination. '--pipeline' / 'company-pipeline' domain is company-wide and does not support '--asset'. Use '--clinical' / '--ce' with '--asset', or omit '--pipeline' for automatic Clinical Evidence routing with '--asset'.");
    process.exit(1);
  }

  if (domain && !["company-pipeline", "clinical-evidence"].includes(domain)) {
    console.error(`Error: Invalid --domain '${domain}'. Must be 'company-pipeline' or 'clinical-evidence'.`);
    process.exit(1);
  }

  const effectiveDomain = domain || (assetId ? "clinical-evidence" : "company-pipeline");
  return { command, companyId, assetId, domain: effectiveDomain, cik, bootstrap, advance, ackFilings, ackDeltas, json };
}

/**
 * Recursively canonicalizes an object or array by sorting all object keys,
 * ensuring deterministic serialization regardless of property insertion order.
 */
export function canonicalizeJson(val) {
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
export function computeScientificFingerprint(study) {
  const protocol = study?.protocolSection ?? {};
  const status = protocol.statusModule ?? {};
  const design = protocol.designModule ?? {};
  const armsInterventions = protocol.armsInterventionsModule ?? {};
  const eligibility = protocol.eligibilityModule ?? {};
  const outcomes = protocol.outcomesModule ?? {};

  const scientificPayload = {
    armGroups: (armsInterventions.armGroups ?? []).map((arm) => ({
      description: arm.description?.trim() ?? "",
      interventionNames: (arm.interventionNames ?? []).slice().sort(),
      label: arm.label ?? "",
      type: arm.type ?? "",
    })).sort((a, b) => a.label.localeCompare(b.label)),
    dates: {
      completionDate: status.completionDateStruct?.date ?? null,
      primaryCompletionDate: status.primaryCompletionDateStruct?.date ?? null,
      startDate: status.startDateStruct?.date ?? null,
    },
    designInfo: design.designInfo ?? {},
    eligibility: {
      criteria: eligibility.eligibilityCriteria?.trim() ?? "",
      healthyVolunteers: eligibility.healthyVolunteers ?? null,
      maximumAge: eligibility.maximumAge ?? null,
      minimumAge: eligibility.minimumAge ?? null,
      sex: eligibility.sex ?? null,
      stdAges: (eligibility.stdAges ?? []).slice().sort(),
    },
    enrollmentCount: design.enrollmentInfo?.count ?? null,
    interventions: (armsInterventions.interventions ?? []).map((i) => ({
      armGroupLabels: (i.armGroupLabels ?? []).slice().sort(),
      description: i.description?.trim() ?? "",
      name: i.name ?? "",
      otherNames: (i.otherNames ?? []).slice().sort(),
      type: i.type ?? "",
    })).sort((a, b) => a.name.localeCompare(b.name)),
    overallStatus: status.overallStatus ?? null,
    phases: (design.phases ?? []).slice().sort(),
    primaryOutcomes: (outcomes.primaryOutcomes ?? []).map((o) => ({
      description: o.description?.trim() ?? "",
      measure: o.measure ?? "",
      timeFrame: o.timeFrame ?? "",
    })).sort((a, b) => a.measure.localeCompare(b.measure)),
    secondaryOutcomes: (outcomes.secondaryOutcomes ?? []).map((o) => ({
      description: o.description?.trim() ?? "",
      measure: o.measure ?? "",
      timeFrame: o.timeFrame ?? "",
    })).sort((a, b) => a.measure.localeCompare(b.measure)),
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
 * Distinguishes normal 200 OK responses with 0 hits (non-PubMed sources) from API errors.
 */
export async function resolveDoisAndPmcsToPmids(dois, pmcs, fetchFn = fetch) {
  const pmidMap = new Map();
  const unresolved = [];
  const nonPubMed = [];

  for (const doi of dois) {
    try {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi + "[doi]")}&retmode=json&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;
      const res = await fetchFn(url);
      if (res.ok) {
        const data = await res.json();
        const idList = data.esearchresult?.idlist ?? [];
        if (idList.length === 1) {
          pmidMap.set(doi, idList[0]);
        } else if (idList.length > 1) {
          unresolved.push({ type: "doi", identifier: doi, reason: "AMBIGUOUS_MULTIPLE_PMIDS" });
        } else {
          nonPubMed.push({ type: "doi", identifier: doi, reason: "NOT_FOUND_ON_PUBMED" });
        }
      } else {
        unresolved.push({ type: "doi", identifier: doi, reason: `HTTP_${res.status}` });
      }
    } catch (err) {
      unresolved.push({ type: "doi", identifier: doi, reason: err.message });
    }
  }

  for (const pmc of pmcs) {
    try {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(pmc + "[pmc]")}&retmode=json&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;
      const res = await fetchFn(url);
      if (res.ok) {
        const data = await res.json();
        const idList = data.esearchresult?.idlist ?? [];
        if (idList.length === 1) {
          pmidMap.set(pmc, idList[0]);
        } else if (idList.length > 1) {
          unresolved.push({ type: "pmc", identifier: pmc, reason: "AMBIGUOUS_MULTIPLE_PMIDS" });
        } else {
          nonPubMed.push({ type: "pmc", identifier: pmc, reason: "NOT_FOUND_ON_PUBMED" });
        }
      } else {
        unresolved.push({ type: "pmc", identifier: pmc, reason: `HTTP_${res.status}` });
      }
    } catch (err) {
      unresolved.push({ type: "pmc", identifier: pmc, reason: err.message });
    }
  }

  return { pmidMap, unresolved, nonPubMed };
}

/**
 * Reads and indexes company, pipeline, and clinical evidence targets from disk.
 *
 * Domain Authority Separation (ADR-0070):
 * - domain === "company-pipeline":
 *     Operating target is company.json.
 *     Known NCTs and PMIDs are strictly scanned from Company/Pipeline sources
 *     (company.json, pipeline-programs.json, regimens.json).
 *     Clinical Evidence is NOT scanned to prevent cross-domain discovery state pollution.
 * - domain === "clinical-evidence":
 *     When targetAssetId is specified:
 *       Target is <companyId>/<assetId>/clinical-evidence.json.
 *       Known NCTs and PMIDs are strictly scanned from that asset's Clinical Evidence.
 *     When targetAssetId is omitted (company-wide CE):
 *       Target is <companyId>/company-research-state.json.
 *       Known NCTs and PMIDs are aggregated across all CE asset files for that company.
 *     Company/Pipeline source files (company.json) are NEVER touched or written.
 */
export async function loadCompanyContext(companyId, targetAssetId = null, options = null) {
  const companyDir = options?.companyDir ?? COMPANY_DIR;
  const clinicalDir = options?.clinicalDir ?? CLINICAL_DIR;
  const domain = options?.domain ?? (targetAssetId ? "clinical-evidence" : "company-pipeline");
  const fetchFn = options?.fetchFn ?? fetch;

  if (domain === "company-pipeline" && targetAssetId) {
    throw new Error(`Invalid context: domain 'company-pipeline' is company-wide and does not support targetAssetId '${targetAssetId}'`);
  }

  const companyFolderPath = path.join(companyDir, companyId);
  if (!fs.existsSync(companyFolderPath)) {
    throw new Error(`Company folder not found: ${companyFolderPath}`);
  }

  const companyJsonPath = path.join(companyFolderPath, "company.json");
  const pipelineJsonPath = path.join(companyFolderPath, "pipeline-programs.json");
  const regimensJsonPath = path.join(companyFolderPath, "regimens.json");

  const company = JSON.parse(fs.readFileSync(companyJsonPath, "utf8"));
  const allPrograms = fs.existsSync(pipelineJsonPath)
    ? JSON.parse(fs.readFileSync(pipelineJsonPath, "utf8"))
    : [];
  const allRegimens = fs.existsSync(regimensJsonPath)
    ? JSON.parse(fs.readFileSync(regimensJsonPath, "utf8"))
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

  let targetFile = null;
  let targetFileExists = false;
  let baseline = null;

  if (domain === "company-pipeline") {
    // -------------------------------------------------------------------------
    // DOMAIN 1: Company/Pipeline Research
    // Authority Owner: Company/Pipeline domain
    // Operating Target: domains/company-pipeline/data/companies/<companyId>/company.json
    // Known NCTs/PMIDs: strictly from company.json, pipeline-programs.json, regimens.json
    // (Never reads clinical-evidence to prevent cross-domain discovery state pollution)
    // -------------------------------------------------------------------------
    targetFile = companyJsonPath;
    targetFileExists = fs.existsSync(companyJsonPath);
    baseline = company.researchState ?? null;

    scanSources(company.metadata?.sources);

    for (const prog of allPrograms) {
      if (prog.assetName) assetAliases.add(prog.assetName);
      if (prog.codeName) assetAliases.add(prog.codeName);
      for (const alias of prog.aliases ?? []) {
        if (alias.value) assetAliases.add(alias.value);
      }
      scanSources(prog.metadata?.sources);
    }

    for (const reg of allRegimens) {
      scanSources(reg.metadata?.sources);
    }
  } else {
    // -------------------------------------------------------------------------
    // DOMAIN 2: Clinical Evidence Research
    // Authority Owner: Clinical Evidence domain
    // Invariant: Company/Pipeline operating files are strictly read-only reference
    // -------------------------------------------------------------------------
    const ceCompanyPath = path.join(clinicalDir, companyId);

    // Extract asset aliases for search query targeting
    const scopedPrograms = targetAssetId
      ? allPrograms.filter((p) => p.assetId === targetAssetId || p.id === targetAssetId)
      : allPrograms;

    for (const prog of scopedPrograms) {
      if (prog.assetName) assetAliases.add(prog.assetName);
      if (prog.codeName) assetAliases.add(prog.codeName);
      for (const alias of prog.aliases ?? []) {
        if (alias.value) assetAliases.add(alias.value);
      }
    }

    if (targetAssetId) {
      // 2a. Asset-scoped Clinical Evidence run
      const targetAssetCePath = path.join(ceCompanyPath, targetAssetId, "clinical-evidence.json");
      targetFile = targetAssetCePath;
      targetFileExists = fs.existsSync(targetAssetCePath);

      if (targetFileExists) {
        const ceData = JSON.parse(fs.readFileSync(targetAssetCePath, "utf8"));
        baseline = ceData.researchState ?? null;

        for (const study of ceData.studies ?? []) {
          for (const regId of study.registryIdentifiers ?? []) {
            if (regId.id && /^NCT\d{8}$/i.test(regId.id)) {
              knownNCTs.add(regId.id.toUpperCase());
            }
          }
          scanSources(study.metadata?.sources);
        }
      }
    } else {
      // 2b. Company-scoped Clinical Evidence run
      const envelopePath = path.join(ceCompanyPath, "company-research-state.json");
      targetFile = envelopePath;
      targetFileExists = fs.existsSync(envelopePath);

      if (targetFileExists) {
        try {
          const envelope = JSON.parse(fs.readFileSync(envelopePath, "utf8"));
          baseline = envelope.researchState ?? null;
        } catch {
          baseline = null;
        }
      }

      // Aggregate all known NCTs/PMIDs across all CE assets for this company
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
              scanSources(study.metadata?.sources);
            }
          }
        }
      }
    }
  }

  // Resolve external DOIs and PMCs to PMIDs
  const unresolvedIdentifiers = [];
  const nonPubMedIdentifiers = [];
  if (knownDOIs.size > 0 || knownPMCs.size > 0) {
    const { pmidMap, unresolved, nonPubMed } = await resolveDoisAndPmcsToPmids([...knownDOIs], [...knownPMCs], fetchFn);
    for (const pmid of pmidMap.values()) {
      knownPMIDs.add(pmid);
    }
    unresolvedIdentifiers.push(...(unresolved ?? []));
    nonPubMedIdentifiers.push(...(nonPubMed ?? []));
  }

  return {
    domain,
    companyId,
    companyName: company.name,
    company,
    targetAssetId,
    targetFile,
    targetFileExists,
    baseline,
    knownNCTs: [...knownNCTs].sort(),
    knownPMIDs: [...knownPMIDs].sort(),
    assetAliases: [...assetAliases].filter(Boolean).sort(),
    unresolvedIdentifiers,
    nonPubMedIdentifiers,
  };
}

/**
 * PROBE 1: Registry Update Probe (Known NCTs timestamp & scientific hash delta)
 * Checks semanticFingerprintVersion and flags REBASELINE_REQUIRED if version changed.
 */
export async function probeRegistryUpdate(context, fetchFn = fetch) {
  const results = [];
  const fieldMask = "protocolSection.identificationModule,protocolSection.statusModule,protocolSection.designModule,protocolSection.armsInterventionsModule,protocolSection.eligibilityModule,protocolSection.outcomesModule";

  const storedVersion = context.baseline?.discoveryCheckpoint?.clinicalTrials?.semanticFingerprintVersion ?? 1;
  const storedWorkflowRevision = context.baseline?.workflowRevision ?? null;

  const isFingerprintMismatch = Boolean(
    context.baseline?.discoveryCheckpoint && (storedVersion !== CURRENT_FINGERPRINT_VERSION)
  );
  const isWorkflowRevisionMismatch = Boolean(
    context.baseline && (storedWorkflowRevision !== CURRENT_WORKFLOW_REVISION)
  );
  const isVersionMismatch = isFingerprintMismatch || isWorkflowRevisionMismatch;

  let hasDelta = isVersionMismatch;
  let hasError = false;

  for (const nctId of context.knownNCTs) {
    const url = `https://clinicaltrials.gov/api/v2/studies/${nctId}?fields=${fieldMask}`;
    try {
      const res = await fetchFn(url);
      if (!res.ok) {
        hasError = true;
        results.push({ nctId, deltaVerdict: "FETCH_ERROR", hasDelta: false, hasError: true, httpStatus: res.status });
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
      let itemHasDelta = false;

      if (context.baseline?.discoveryCheckpoint) {
        if (isWorkflowRevisionMismatch) {
          deltaVerdict = "REBASELINE_REQUIRED";
          deltaMessage = `Workflow revision mismatch (stored: '${storedWorkflowRevision}', current: '${CURRENT_WORKFLOW_REVISION}'). Re-baseline required.`;
          itemHasDelta = true;
          hasDelta = true;
        } else if (isFingerprintMismatch) {
          deltaVerdict = "REBASELINE_REQUIRED";
          deltaMessage = `Semantic fingerprint version mismatch (stored: ${storedVersion}, current: ${CURRENT_FINGERPRINT_VERSION}). Targeted re-baseline required.`;
          itemHasDelta = true;
          hasDelta = true;
        } else if (!baselineEntry) {
          deltaVerdict = "LEGACY_UNBASELINED";
          deltaMessage = "Trial is known in canonical data but not in stored baseline.";
          itemHasDelta = true;
          hasDelta = true;
        } else if (baselineEntry.lastUpdatePostDate === lastUpdatePostDate) {
          deltaVerdict = "UNCHANGED";
          deltaMessage = `Post date unchanged (${lastUpdatePostDate}). Verification skipped.`;
        } else if (baselineEntry.semanticHash && baselineEntry.semanticHash === hash) {
          deltaVerdict = "ADMIN_UPDATE_BYPASS";
          deltaMessage = `Post date changed (${baselineEntry.lastUpdatePostDate} -> ${lastUpdatePostDate}), but scientific fingerprint is identical. Administrative update only.`;
        } else {
          deltaVerdict = "SCIENTIFIC_UPDATE_DETECTED";
          deltaMessage = `Scientific protocol changed! Post date: ${baselineEntry.lastUpdatePostDate} -> ${lastUpdatePostDate}. Hash changed.`;
          itemHasDelta = true;
          hasDelta = true;
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
        hasDelta: itemHasDelta,
        hasError: false,
        payload,
      });
    } catch (err) {
      hasError = true;
      results.push({ nctId, deltaVerdict: "NETWORK_ERROR", hasDelta: false, hasError: true, message: err.message });
    }
  }

  let deltaVerdict = "UNCHANGED";
  if (isVersionMismatch) {
    deltaVerdict = "REBASELINE_REQUIRED";
  } else if (hasDelta) {
    deltaVerdict = "SCIENTIFIC_UPDATE_DETECTED";
  } else if (hasError) {
    deltaVerdict = "FETCH_ERROR";
  } else if (!context.baseline?.discoveryCheckpoint) {
    deltaVerdict = "LEGACY_UNBASELINED";
  }

  return {
    deltaVerdict,
    hasDelta,
    hasError,
    hasIncomplete: false,
    isVersionMismatch,
    isWorkflowRevisionMismatch,
    isFingerprintMismatch,
    results,
  };
}

/**
 * Helper to fetch studies from CT.gov API v2 with nextPageToken pagination.
 */
export async function fetchCtGovStudies(baseUrl, maxPages = 5, fetchFn = fetch) {
  let currentUrl = baseUrl;
  const allStudies = [];
  let pageCount = 0;
  let truncated = false;
  let hasError = false;

  while (currentUrl && pageCount < maxPages) {
    pageCount += 1;
    try {
      const res = await fetchFn(currentUrl);
      if (!res.ok) {
        hasError = true;
        break;
      }
      const data = await res.json();
      const studies = data.studies ?? [];
      allStudies.push(...studies);
      if (data.nextPageToken) {
        if (pageCount >= maxPages) {
          truncated = true;
          break;
        }
        const parsed = new URL(currentUrl);
        parsed.searchParams.set("pageToken", data.nextPageToken);
        currentUrl = parsed.toString();
      } else {
        break;
      }
    } catch {
      hasError = true;
      break;
    }
  }

  return { studies: allStudies, truncated, hasError };
}

/**
 * PROBE 2: Registry Discovery Probe (Company/Asset search to discover brand-new NCTs)
 * Maintains independent hasDelta, hasError, and hasIncomplete.
 */
export async function probeRegistryDiscovery(context, fetchFn = fetch) {
  const candidateNCTs = new Map();
  const fields = "protocolSection.identificationModule.nctId,protocolSection.identificationModule.briefTitle,protocolSection.statusModule.overallStatus,protocolSection.statusModule.lastUpdatePostDateStruct";
  let hasError = false;
  let truncated = false;

  // 1. Query sponsor with pagination (only if not scoped to a specific asset)
  if (!context.targetAssetId && context.companyName) {
    const sponsorUrl = `https://clinicaltrials.gov/api/v2/studies?query.spons=${encodeURIComponent(context.companyName)}&pageSize=50&fields=${fields}`;
    const sponsorRes = await fetchCtGovStudies(sponsorUrl, 5, fetchFn);
    if (sponsorRes.hasError) hasError = true;
    if (sponsorRes.truncated) truncated = true;

    for (const study of sponsorRes.studies) {
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

  // 2. Query asset aliases
  for (const alias of context.assetAliases) {
    if (alias.length < 4) continue;
    const intrUrl = `https://clinicaltrials.gov/api/v2/studies?query.intr=${encodeURIComponent(alias)}&pageSize=20&fields=${fields}`;
    const aliasRes = await fetchCtGovStudies(intrUrl, 3, fetchFn);
    if (aliasRes.hasError) hasError = true;
    if (aliasRes.truncated) truncated = true;

    for (const study of aliasRes.studies) {
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

  const knownSet = new Set(context.knownNCTs);
  const newlyDiscovered = [];
  for (const [id, record] of candidateNCTs.entries()) {
    if (!knownSet.has(id)) {
      newlyDiscovered.push(record);
    }
  }

  const hasDelta = newlyDiscovered.length > 0;
  const hasIncomplete = truncated;

  let deltaVerdict = "CLEAN";
  if (hasDelta) {
    deltaVerdict = "NEW_TRIALS_DETECTED";
  } else if (hasError) {
    deltaVerdict = "FETCH_ERROR";
  } else if (truncated) {
    deltaVerdict = "PARTIAL_TRUNCATED";
  }

  return {
    totalCandidates: candidateNCTs.size,
    newlyDiscoveredCount: newlyDiscovered.length,
    deltaVerdict,
    hasDelta,
    hasError,
    hasIncomplete,
    truncated,
    newlyDiscovered,
  };
}

/**
 * Parses PubMed EFetch XML to accurately detect CommentsCorrections notices and
 * PublicationType retractions, avoiding silent failures from esummary JSON.
 */
export function parseEfetchXml(xml) {
  const results = new Map();
  if (!xml || typeof xml !== "string") return results;

  const articles = xml.split("</PubmedArticle>");
  for (const art of articles) {
    const pmidMatch = art.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmidMatch) continue;
    const pmid = pmidMatch[1];

    const titleMatch = art.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    const pubDateMatch = art.match(/<PubDate>([\s\S]*?)<\/PubDate>/);
    let pubdate = "";
    if (pubDateMatch) {
      const year = pubDateMatch[1].match(/<Year>([^<]+)<\/Year>/)?.[1] ?? "";
      const month = pubDateMatch[1].match(/<Month>([^<]+)<\/Month>/)?.[1] ?? "";
      pubdate = `${year} ${month}`.trim();
    }

    const journalMatch = art.match(/<Title>([^<]+)<\/Title>/);
    const source = journalMatch ? journalMatch[1].trim() : "";

    const pubTypes = [...art.matchAll(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/g)].map((m) => m[1]);
    const isRetractedPubType = pubTypes.some((pt) => /retracted publication/i.test(pt));

    const notices = [];
    const ccMatches = art.matchAll(/<CommentsCorrections\s+RefType="([^"]+)">([\s\S]*?)<\/CommentsCorrections>/g);
    for (const match of ccMatches) {
      const refType = match[1];
      const body = match[2];
      if (/erratumin|retractionin|expressionofconcernin|correctedandrepublishedin/i.test(refType)) {
        const refSourceMatch = body.match(/<RefSource>([^<]+)<\/RefSource>/);
        const pmidRefMatch = body.match(/<PMID[^>]*>(\d+)<\/PMID>/);
        notices.push({
          refType,
          source: refSourceMatch ? refSourceMatch[1].trim() : "",
          noticePmid: pmidRefMatch ? pmidRefMatch[1].trim() : "",
        });
      }
    }

    if (isRetractedPubType) {
      notices.push({
        refType: "RetractedPublication",
        source: "NLM PublicationType: Retracted Publication",
        noticePmid: "",
      });
    }

    results.set(pmid, {
      pmid,
      title,
      pubdate,
      source,
      notices,
      isRetracted: isRetractedPubType || notices.some((n) => /retraction/i.test(n.refType)),
      hasErratum: notices.length > 0,
    });
  }

  return results;
}

/**
 * Computes a deterministic SHA-256 fingerprint for PubMed adverse notices (errata, retractions, expressions of concern).
 * Any change in notice count, types, notice PMIDs, or individual notice sources will alter the fingerprint.
 */
export function computeNoticeFingerprint(notices, isRetracted = false) {
  if ((!notices || notices.length === 0) && !isRetracted) return null;
  const normalized = (notices ?? []).map((n) => ({
    noticePmid: n.noticePmid || "",
    refType: n.refType || "",
    source: (n.source || "").trim(),
  })).sort((a, b) => `${a.refType}:${a.noticePmid}:${a.source}`.localeCompare(`${b.refType}:${b.noticePmid}:${b.source}`));

  const payload = {
    isRetracted: Boolean(isRetracted),
    notices: normalized,
  };
  const canonical = canonicalizeJson(payload);
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex").slice(0, 16);
}

/**
 * PROBE 3: Literature Health Check (Checks cited PMIDs via PubMed EFetch XML)
 * Maintains independent hasDelta, hasError, and hasIncomplete.
 * Tracks granular noticeFingerprint to catch erratum-to-retraction transitions and secondary errata.
 */
export async function probeLiteratureHealth(context, fetchFn = fetch) {
  const unresolved = context.unresolvedIdentifiers ?? [];
  const nonPubMed = context.nonPubMedIdentifiers ?? [];
  const hasUnresolved = unresolved.length > 0;

  if (context.knownPMIDs.length === 0) {
    return {
      citedCount: 0,
      errataCount: 0,
      newErrataCount: 0,
      deltaVerdict: hasUnresolved ? "UNRESOLVED_IDENTIFIERS" : "CLEAN",
      hasDelta: false,
      hasError: false,
      hasIncomplete: hasUnresolved,
      checked: [],
      unresolvedIdentifiers: unresolved,
      nonPubMedIdentifiers: nonPubMed,
    };
  }

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${context.knownPMIDs.join(",")}&retmode=xml&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;

  let xml = "";
  try {
    const res = await fetchFn(url);
    if (!res.ok) {
      return {
        citedCount: context.knownPMIDs.length,
        errataCount: 0,
        newErrataCount: 0,
        deltaVerdict: "FETCH_ERROR",
        hasDelta: false,
        hasError: true,
        hasIncomplete: hasUnresolved,
        httpStatus: res.status,
        checked: [],
        unresolvedIdentifiers: unresolved,
        nonPubMedIdentifiers: nonPubMed,
      };
    }
    xml = await res.text();
  } catch (err) {
    return {
      citedCount: context.knownPMIDs.length,
      errataCount: 0,
      newErrataCount: 0,
      deltaVerdict: "NETWORK_ERROR",
      hasDelta: false,
      hasError: true,
      hasIncomplete: hasUnresolved,
      message: err.message,
      checked: [],
      unresolvedIdentifiers: unresolved,
      nonPubMedIdentifiers: nonPubMed,
    };
  }

  const parsedArticles = parseEfetchXml(xml);
  const checked = [];
  let errataCount = 0;
  let newErrataCount = 0;
  let hasMissingPmids = false;

  const monitored = context.baseline?.discoveryCheckpoint?.literature?.monitoredPMIDs ?? {};

  for (const pmid of context.knownPMIDs) {
    const doc = parsedArticles.get(pmid);
    if (!doc) {
      hasMissingPmids = true;
      checked.push({ pmid, status: "NOT_FOUND", deltaVerdict: "NOT_FOUND" });
      continue;
    }

    const prevBaseline = monitored[pmid];
    const prevStatus = prevBaseline?.status ?? (prevBaseline ? "clean" : null);
    const prevFingerprint = prevBaseline?.noticeFingerprint ?? null;

    const docStatus = doc.isRetracted ? "retracted" : (doc.hasErratum ? "has-erratum" : "clean");
    const noticeFingerprint = (doc.hasErratum || doc.isRetracted)
      ? computeNoticeFingerprint(doc.notices, doc.isRetracted)
      : null;
    const noticeTypes = [...new Set((doc.notices ?? []).map((n) => n.refType))].sort();

    let itemHasDelta = false;
    let itemDeltaVerdict = "CLEAN";

    if (!prevBaseline) {
      // Unbaselined PMID: if it carries adverse notice, flag as delta
      if (docStatus === "retracted") {
        itemHasDelta = true;
        itemDeltaVerdict = "RETRACTION_DETECTED";
        newErrataCount += 1;
      } else if (docStatus === "has-erratum") {
        itemHasDelta = true;
        itemDeltaVerdict = "NEW_ERRATUM_DETECTED";
        newErrataCount += 1;
      } else {
        itemHasDelta = false;
        itemDeltaVerdict = "CLEAN";
      }
    } else {
      // Baselined PMID: compare previous (status, noticeFingerprint) vs current (status, noticeFingerprint)
      const statusChanged = prevStatus !== docStatus;
      const fingerprintChanged = prevFingerprint !== noticeFingerprint;

      if (statusChanged || fingerprintChanged) {
        itemHasDelta = true;
        newErrataCount += 1;

        if (docStatus === "retracted") {
          itemDeltaVerdict = "RETRACTION_DETECTED";
        } else if (docStatus === "has-erratum") {
          if (prevStatus === "clean") {
            itemDeltaVerdict = "NEW_ERRATUM_DETECTED";
          } else if (prevStatus === "retracted") {
            itemDeltaVerdict = "LITERATURE_NOTICE_CHANGED";
          } else {
            itemDeltaVerdict = "NEW_ERRATUM_DETECTED";
          }
        } else {
          // docStatus === "clean" while prevStatus was "has-erratum" or "retracted"
          // Adverse notice removed / erratum cleared / paper reinstated as clean
          itemDeltaVerdict = "LITERATURE_NOTICE_CHANGED";
        }
      } else {
        itemHasDelta = false;
        if (docStatus === "retracted") {
          itemDeltaVerdict = "KNOWN_RETRACTION";
        } else if (docStatus === "has-erratum") {
          itemDeltaVerdict = "KNOWN_ERRATUM";
        } else {
          itemDeltaVerdict = "CLEAN";
        }
      }
    }

    if (doc.hasErratum || doc.isRetracted) {
      errataCount += 1;
    }

    checked.push({
      pmid,
      title: doc.title,
      pubdate: doc.pubdate,
      source: doc.source,
      status: docStatus,
      deltaVerdict: itemDeltaVerdict,
      notices: doc.notices ?? [],
      noticeFingerprint,
      noticeTypes,
      hasDelta: itemHasDelta,
      prevStatus,
      prevFingerprint,
    });
  }

  const hasDelta = checked.some((c) => c.hasDelta);
  const hasIncomplete = hasMissingPmids || hasUnresolved;

  let deltaVerdict = "CLEAN";
  if (hasDelta) {
    const hasRetractions = checked.some((c) => c.hasDelta && c.status === "retracted");
    const hasNewErrata = checked.some((c) => c.hasDelta && c.status === "has-erratum");
    if (hasRetractions) {
      deltaVerdict = "RETRACTION_DETECTED";
    } else if (hasNewErrata) {
      deltaVerdict = "NEW_ERRATUM_DETECTED";
    } else {
      deltaVerdict = "LITERATURE_NOTICE_CHANGED";
    }
  } else if (hasIncomplete) {
    deltaVerdict = "PARTIAL";
  }

  return {
    citedCount: context.knownPMIDs.length,
    errataCount,
    newErrataCount,
    deltaVerdict,
    hasDelta,
    hasError: false,
    hasIncomplete,
    checked,
    unresolvedIdentifiers: unresolved,
    nonPubMedIdentifiers: nonPubMed,
  };
}

/**
 * PROBE 4: Literature Discovery Probe (Queries PubMed for asset aliases -> ID diff)
 * Preserves new PMIDs and flags hasIncomplete when ESummary fetch fails, never returning false CLEAN.
 */
export async function probeLiteratureDiscovery(context, fetchFn = fetch) {
  if (context.assetAliases.length === 0) {
    return { totalHits: 0, fetchedHits: 0, newDiscoveredCount: 0, deltaVerdict: "CLEAN", hasDelta: false, hasError: false, hasIncomplete: false, newPMIDs: [] };
  }

  const aliasTerms = context.assetAliases
    .filter((a) => a.length >= 4)
    .map((a) => `"${a}"[Title/Abstract]`)
    .join(" OR ");

  if (!aliasTerms) {
    return { totalHits: 0, fetchedHits: 0, newDiscoveredCount: 0, deltaVerdict: "CLEAN", hasDelta: false, hasError: false, hasIncomplete: false, newPMIDs: [] };
  }

  const query = `(${aliasTerms}) AND (obesity[Title/Abstract] OR overweight[Title/Abstract] OR "weight loss"[Title/Abstract] OR "body weight"[Title/Abstract])`;
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=100&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;

  let totalCount = 0;
  let idList = [];
  try {
    const searchRes = await fetchFn(searchUrl);
    if (!searchRes.ok) {
      return { totalHits: 0, fetchedHits: 0, newDiscoveredCount: 0, deltaVerdict: "FETCH_ERROR", hasDelta: false, hasError: true, hasIncomplete: false, httpStatus: searchRes.status, newPMIDs: [] };
    }
    const searchData = await searchRes.json();
    totalCount = Number(searchData.esearchresult?.count ?? 0);
    idList = searchData.esearchresult?.idlist ?? [];
  } catch (err) {
    return { totalHits: 0, fetchedHits: 0, newDiscoveredCount: 0, deltaVerdict: "NETWORK_ERROR", hasDelta: false, hasError: true, hasIncomplete: false, message: err.message, newPMIDs: [] };
  }

  const knownSet = new Set(context.knownPMIDs);
  const newIdList = idList.filter((id) => !knownSet.has(id));
  const isTruncated = totalCount > idList.length;

  const newPMIDs = [];
  let summaryFetchFailed = false;

  if (newIdList.length > 0) {
    try {
      const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${newIdList.slice(0, 20).join(",")}&retmode=json&tool=${USER_AGENT_PUBMED_TOOL}&email=${USER_AGENT_PUBMED_EMAIL}`;
      const sumRes = await fetchFn(summaryUrl);
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
      } else {
        summaryFetchFailed = true;
        for (const id of newIdList.slice(0, 20)) {
          newPMIDs.push({ pmid: id, title: "", source: "", pubdate: "" });
        }
      }
    } catch {
      summaryFetchFailed = true;
      for (const id of newIdList.slice(0, 20)) {
        newPMIDs.push({ pmid: id, title: "", source: "", pubdate: "" });
      }
    }
  }

  const hasDelta = newPMIDs.length > 0;
  const hasIncomplete = isTruncated || summaryFetchFailed;

  let deltaVerdict = "CLEAN";
  if (hasDelta) {
    deltaVerdict = "NEW_PUBLICATIONS_DETECTED";
  } else if (isTruncated) {
    deltaVerdict = "PARTIAL_TRUNCATED";
  }

  return {
    totalHits: totalCount,
    fetchedHits: idList.length,
    newDiscoveredCount: newPMIDs.length,
    deltaVerdict,
    hasDelta,
    hasError: false,
    hasIncomplete,
    truncated: isTruncated,
    summaryFetchFailed,
    newPMIDs,
  };
}

/**
 * PROBE 5: SEC EDGAR Filings Probe (Full scan + checkpoint delta comparator)
 * Evaluates CIK authority hierarchy and detects CIK conflicts.
 */
export async function probeSecFilings(companyId, cikOverride, checkpoint, context = null, fetchFn = fetch) {
  const cikRes = resolveCik(companyId, cikOverride, context);

  if (cikRes.status === "CIK_CONFLICT") {
    return {
      status: "CIK_CONFLICT",
      deltaVerdict: "CIK_CONFLICT",
      hasDelta: false,
      hasError: true,
      hasIncomplete: false,
      message: cikRes.message,
    };
  }

  if (cikRes.status === "UNMAPPED_CIK") {
    return {
      status: "UNMAPPED_CIK",
      deltaVerdict: "ACCESS_UNKNOWN",
      hasDelta: false,
      hasError: true,
      hasIncomplete: false,
      message: cikRes.message,
    };
  }

  const cik = cikRes.cik;
  if (cik.startsWith("FOREIGN_EXCHANGE") || cik.startsWith("PRIVATE")) {
    return {
      status: "NON_SEC_REPORTING",
      deltaVerdict: "NON_SEC_REPORTING",
      hasDelta: false,
      hasError: false,
      hasIncomplete: false,
      classification: cik,
    };
  }

  const paddedCik = cik.padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

  try {
    const res = await fetchFn(url, { headers: { "User-Agent": USER_AGENT_SEC } });
    if (!res.ok) {
      return { status: "FETCH_ERROR", deltaVerdict: "FETCH_ERROR", hasDelta: false, hasError: true, hasIncomplete: false, httpStatus: res.status, cik: paddedCik };
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
    let hasDelta = false;

    if (baselineAcceptance) {
      newFilings = keyFilings.filter((f) => f.acceptanceDateTime > baselineAcceptance);
      if (newFilings.length === 0) {
        deltaVerdict = "UNCHANGED";
      } else {
        deltaVerdict = "NEW_FILINGS_DETECTED";
        hasDelta = true;
      }
    }

    return {
      status: "OK",
      companyName: data.name,
      cik: paddedCik,
      deltaVerdict,
      hasDelta,
      hasError: false,
      hasIncomplete: false,
      baselineAcceptance: baselineAcceptance ?? null,
      totalKeyFilings: keyFilings.length,
      newFilingsCount: newFilings.length,
      filings: deltaVerdict === "UNCHANGED" ? [] : newFilings.slice(0, 10),
      allRecentKeyFilings: keyFilings.slice(0, 10),
    };
  } catch (err) {
    return { status: "NETWORK_ERROR", deltaVerdict: "NETWORK_ERROR", hasDelta: false, hasError: true, hasIncomplete: false, message: err.message, cik: paddedCik };
  }
}

/**
 * Composite evaluation of all preflight probe results.
 * Evaluates hasDelta, hasError, and hasIncomplete independently.
 */
export function evaluatePreflight(context, updateRes, discRes, healthRes, litDiscRes, secRes) {
  const deltaSources = new Set();
  const errorSources = new Set();
  const incompleteSources = new Set();
  const blockedReasons = [];

  const probes = [
    { name: "registryUpdate", res: updateRes },
    { name: "registryDiscovery", res: discRes },
    { name: "literatureHealth", res: healthRes },
    { name: "literatureDiscovery", res: litDiscRes },
    { name: "sec", res: secRes },
  ];

  for (const { name, res } of probes) {
    if (!res) continue;

    if (res.hasDelta) {
      deltaSources.add(name);
      if (res.deltaVerdict === "REBASELINE_REQUIRED") {
        blockedReasons.push(res.deltaMessage || "Workflow revision or semantic fingerprint version mismatch (re-baseline required)");
      } else if (res.deltaMessage) {
        blockedReasons.push(res.deltaMessage);
      } else if (res.newlyDiscoveredCount) {
        blockedReasons.push(`${name}: ${res.newlyDiscoveredCount} newly discovered items`);
      } else if (res.newFilingsCount) {
        blockedReasons.push(`${name}: ${res.newFilingsCount} new filings`);
      } else if (res.newErrataCount) {
        blockedReasons.push(`${name}: ${res.newErrataCount} new errata`);
      } else {
        blockedReasons.push(`${name}: delta detected (${res.deltaVerdict})`);
      }
    }

    if (res.hasError) {
      errorSources.add(name);
      blockedReasons.push(`${name}: error (${res.deltaVerdict || res.status || "network failure"})`);
    }

    if (res.hasIncomplete) {
      incompleteSources.add(name);
      blockedReasons.push(`${name}: incomplete / truncated data or unresolved identifiers`);
    }
  }

  const hasDeltas = deltaSources.size > 0;
  const hasErrors = errorSources.size > 0;
  const hasIncomplete = incompleteSources.size > 0;

  let compositeVerdict = "CLEAN";
  if (hasDeltas) {
    compositeVerdict = "DELTA_DETECTED";
  } else if (hasErrors) {
    compositeVerdict = "FETCH_ERROR";
  } else if (hasIncomplete) {
    compositeVerdict = "PARTIAL";
  } else if (!context.baseline?.discoveryCheckpoint) {
    compositeVerdict = "LEGACY_UNBASELINED";
  }

  return {
    compositeVerdict,
    deltaSources,
    errorSources,
    incompleteSources,
    blockedReasons,
    hasDeltas,
    hasErrors,
    hasIncomplete,
  };
}

/**
 * Validates whether a baseline checkpoint can be written to disk.
 *
 * Rules:
 *   1. Error/Incomplete states: writing is STRICTLY FORBIDDEN under all circumstances,
 *      regardless of whether --ack-deltas is supplied.
 *   2. Missing asset CE target: if targetAssetId specified and CE file does not exist,
 *      blocks with ASSET_CANONICAL_TARGET_MISSING.
 *   3. Bootstrap mode: only permitted for unbaselined targets or when re-baseline is required.
 *   4. Advance mode: only permitted for established baselines with matching workflowRevision
 *      and semanticFingerprintVersion. If deltas exist, requires explicit confirmation flags
 *      (--ack-filings, --ack-deltas). Routine advance is blocked under REBASELINE_REQUIRED.
 */
export function canAdvanceCheckpoint(context, updateRes, discRes, healthRes, litDiscRes, secRes, flags = {}) {
  const isBootstrap = flags.bootstrap === true;
  const isAdvance = flags.advance === true;

  // 0. Explicit mode check: legacy aliases are strictly rejected
  if (!isBootstrap && !isAdvance) {
    return {
      allowed: false,
      reason: "Checkpoint write blocked: Ambiguous mode. Explicitly specify '--bootstrap' (to establish initial baseline) or '--advance' (to advance an existing checkpoint).",
    };
  }

  // 1. Asset-scoped target validity check
  if (context.targetAssetId && !context.targetFileExists) {
    return {
      allowed: false,
      reason: `Checkpoint write blocked: ASSET_CANONICAL_TARGET_MISSING. Clinical evidence canonical target missing at ${context.targetFile}. Create canonical clinical-evidence.json before bootstrapping asset checkpoint.`,
    };
  }

  const evalResult = evaluatePreflight(context, updateRes, discRes, healthRes, litDiscRes, secRes);

  // 2. Error or Incomplete state: STRICTLY FORBIDDEN regardless of --ack-deltas
  if (evalResult.hasErrors || evalResult.hasIncomplete) {
    return {
      allowed: false,
      reason: `Checkpoint write blocked: Errors or incomplete data detected (${evalResult.blockedReasons.join("; ")}). Checkpoint write is strictly prohibited until errors and truncation are resolved.`,
    };
  }

  // 3. Mode enforcement & Version Invalidation Check
  const hasExistingBaseline = Boolean(context.baseline?.discoveryCheckpoint);
  const storedWorkflowRevision = context.baseline?.workflowRevision ?? null;
  const storedFingerprintVersion = context.baseline?.discoveryCheckpoint?.clinicalTrials?.semanticFingerprintVersion ?? 1;
  const hasRevisionMismatch = Boolean(context.baseline && storedWorkflowRevision !== CURRENT_WORKFLOW_REVISION);
  const hasFingerprintMismatch = Boolean(context.baseline?.discoveryCheckpoint && storedFingerprintVersion !== CURRENT_FINGERPRINT_VERSION);
  const hasRebaselineVerdict = [updateRes, discRes, healthRes, litDiscRes, secRes].some((r) => r?.deltaVerdict === "REBASELINE_REQUIRED");
  const isRebaselineRequired = hasRevisionMismatch || hasFingerprintMismatch || hasRebaselineVerdict;

  if (isAdvance && isRebaselineRequired) {
    return {
      allowed: false,
      reason: "Checkpoint advance blocked: REBASELINE_REQUIRED (workflowRevision or semanticFingerprintVersion mismatch). Routine '--advance' is prohibited; re-establish baseline using '--bootstrap --ack-deltas'.",
    };
  }

  if (isBootstrap && hasExistingBaseline && !isRebaselineRequired) {
    return {
      allowed: false,
      reason: "Checkpoint write blocked: Baseline already established. Use --advance to advance existing baseline.",
    };
  }

  if (isAdvance && !hasExistingBaseline) {
    return {
      allowed: false,
      reason: "Checkpoint write blocked: No existing baseline to advance. Use --bootstrap to establish initial baseline.",
    };
  }

  // 4. Delta safety for BOTH bootstrap and advance modes
  if (evalResult.hasDeltas) {
    const unacknowledged = [];
    if (evalResult.deltaSources.has("sec") && !flags.ackFilings && !flags.ackDeltas) {
      unacknowledged.push("SEC filings (pass --ack-filings or --ack-deltas after reviewing)");
    }
    if (evalResult.deltaSources.has("registryUpdate") && !flags.ackDeltas) {
      unacknowledged.push("Registry scientific updates (pass --ack-deltas after reviewing)");
    }
    if (evalResult.deltaSources.has("registryDiscovery") && !flags.ackDeltas) {
      unacknowledged.push("New clinical trials discovered (pass --ack-deltas after reviewing)");
    }
    if (evalResult.deltaSources.has("literatureHealth") && !flags.ackDeltas) {
      unacknowledged.push("Adverse literature notices (errata/retractions) discovered (pass --ack-deltas after reviewing)");
    }
    if (evalResult.deltaSources.has("literatureDiscovery") && !flags.ackDeltas) {
      unacknowledged.push("New literature publications discovered (pass --ack-deltas after reviewing)");
    }

    if (unacknowledged.length > 0) {
      const modeText = isBootstrap ? "Bootstrap write blocked" : "Checkpoint advance blocked";
      return {
        allowed: false,
        reason: `${modeText}: Unresolved deltas detected: ${unacknowledged.join("; ")}`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Constructs and writes the updated researchState checkpoint to canonical JSON.
 * Strictly writes only NCTs and PMIDs present in the canonical source tree.
 */
export function saveBaselineCheckpoint(context, updateRes, healthRes, secRes) {
  const asOf = new Date().toISOString().slice(0, 10);
  const knownNCTsSet = new Set(context.knownNCTs);
  const knownPMIDsSet = new Set(context.knownPMIDs);

  const prevNCTs = context.baseline?.discoveryCheckpoint?.clinicalTrials?.knownNCTs ?? {};
  const prevPMIDs = context.baseline?.discoveryCheckpoint?.literature?.monitoredPMIDs ?? {};

  const knownNCTsMap = updateRes ? {} : { ...prevNCTs };
  // Defensive compatibility: supports updateRes as object ({ results: [...] }) or raw array
  const updateList = updateRes?.results ?? (Array.isArray(updateRes) ? updateRes : []);
  for (const r of updateList) {
    if (r.nctId && r.lastUpdatePostDate && knownNCTsSet.has(r.nctId)) {
      knownNCTsMap[r.nctId] = {
        lastUpdatePostDate: r.lastUpdatePostDate,
        semanticHash: r.scientificHash,
      };
    }
  }

  const monitoredPMIDsMap = healthRes ? {} : { ...prevPMIDs };
  for (const h of (healthRes?.checked ?? [])) {
    if (h.pmid && h.status !== "NOT_FOUND" && knownPMIDsSet.has(h.pmid)) {
      // Defensive compatibility: accept standard status ("retracted", "has-erratum", "clean")
      // and map legacy/diagnostic "ERRATUM_DETECTED" to canonical "has-erratum".
      const status = ["retracted", "has-erratum", "clean"].includes(h.status)
        ? h.status
        : (h.status === "ERRATUM_DETECTED" ? "has-erratum" : "clean");
      monitoredPMIDsMap[h.pmid] = {
        status,
        ...(h.noticeFingerprint ? { noticeFingerprint: h.noticeFingerprint } : {}),
        ...(h.noticeTypes?.length ? { noticeTypes: h.noticeTypes } : {}),
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
  } else if (context.baseline?.discoveryCheckpoint?.secEdgar) {
    secEdgar = context.baseline.discoveryCheckpoint.secEdgar;
  }

  const researchState = {
    checkpointVersion: 1,
    workflowRevision: CURRENT_WORKFLOW_REVISION,
    discoveryCheckpoint: {
      asOf,
      ...(secEdgar ? { secEdgar } : {}),
      clinicalTrials: {
        semanticFingerprintVersion: CURRENT_FINGERPRINT_VERSION,
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
  let existingJson = {};
  if (fs.existsSync(targetPath)) {
    try {
      existingJson = JSON.parse(fs.readFileSync(targetPath, "utf8"));
    } catch {
      existingJson = {};
    }
  } else {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (context.domain === "clinical-evidence" && !context.targetAssetId) {
      existingJson = {
        companyId: context.companyId,
      };
    }
  }
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
export function printReport(context, updateRes, discRes, healthRes, litDiscRes, secRes, savedBaseline, evalResult) {
  const hasBaseline = Boolean(context.baseline?.discoveryCheckpoint);
  const baselineDate = context.baseline?.discoveryCheckpoint?.asOf ?? "NONE";
  const domainBadge = context.domain === "clinical-evidence" ? "[CLINICAL-EVIDENCE]" : "[COMPANY-PIPELINE]";

  console.log("================================================================================");
  console.log(` RESEARCH PREFLIGHT REPORT: ${context.companyId}${context.targetAssetId ? ` (Asset: ${context.targetAssetId})` : ""} ${domainBadge}`);
  console.log(` Target File : ${path.relative(ROOT, context.targetFile)}`);
  console.log(` Baseline    : ${hasBaseline ? `ESTABLISHED (asOf ${baselineDate})` : "LEGACY UNBASELINED"}`);
  if (evalResult) {
    console.log(` Verdict     : [${evalResult.compositeVerdict}]`);
    if (evalResult.blockedReasons.length > 0) {
      console.log(` Alerts      : ${evalResult.blockedReasons.join("; ")}`);
    }
  }
  console.log(" Scope Note  : Preflight directly monitors deterministic surfaces (CT.gov, PubMed, SEC EDGAR).");
  console.log("               Cold-Path CLEAN does NOT prove absence of Sponsor IR/newsroom/congress");
  console.log("               disclosures. Primary source discovery obligations remain active.");
  console.log("================================================================================");

  if (updateRes) {
    const list = updateRes.results ?? (Array.isArray(updateRes) ? updateRes : []);
    console.log(`\n[1/5] Registry Update Probe (Tracked NCTs: ${list.length})`);
    console.log("--------------------------------------------------------------------------------");
    for (const r of list) {
      const badge = `[${r.deltaVerdict}]`.padEnd(28);
      console.log(`  ${badge} ${r.nctId} | ${(r.overallStatus ?? "UNKNOWN").padEnd(20)} | PostDate: ${r.lastUpdatePostDate ?? "N/A"} | Hash: ${r.scientificHash?.slice(0, 10)}...`);
      if (r.briefTitle) console.log(`    "${r.briefTitle.slice(0, 75)}"`);
      if (r.deltaVerdict === "ADMIN_UPDATE_BYPASS") {
        console.log(`    => Administrative update only (PostDate was ${r.baselinePostDate}). Scientific payload identical. Full-text re-reading skipped.`);
      } else if (r.deltaVerdict === "SCIENTIFIC_UPDATE_DETECTED") {
        console.log(`    => ALERT: Scientific payload changed since baseline (${r.baselinePostDate}). Targeted audit required.`);
      } else if (r.deltaVerdict === "REBASELINE_REQUIRED") {
        console.log(`    => NOTICE: Fingerprint version mismatch. Re-baseline required.`);
      }
    }
  }

  if (discRes) {
    console.log(`\n[2/5] Registry Discovery Probe (Total Candidates: ${discRes.totalCandidates}, Newly Discovered: ${discRes.newlyDiscoveredCount})`);
    console.log("--------------------------------------------------------------------------------");
    if (discRes.newlyDiscoveredCount === 0) {
      if (discRes.deltaVerdict === "CLEAN") {
        console.log(`  CLEAN: All ${discRes.totalCandidates} registry candidate trials are already known in repository.`);
      } else {
        console.log(`  WARNING: ${discRes.deltaVerdict} (Candidates inspected: ${discRes.totalCandidates})`);
      }
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
      console.log("  No cited PMIDs found for this target.");
    } else if (healthRes.errataCount === 0 && healthRes.deltaVerdict === "CLEAN") {
      console.log(`  CLEAN: 0 errata/retractions across ${healthRes.citedCount} monitored publications.`);
    } else {
      console.log(`  NOTICES: ${healthRes.errataCount} errata/retractions detected (${healthRes.newErrataCount} new since baseline):`);
      for (const c of healthRes.checked.filter((x) => x.status === "has-erratum" || x.status === "retracted" || x.deltaVerdict === "LITERATURE_NOTICE_CHANGED" || x.hasDelta)) {
        const badge = c.status === "retracted" ? "[RETRACTED]" : `[${c.deltaVerdict}]`;
        console.log(`    ! ${badge} PMID ${c.pmid}: "${c.title}"`);
        if (c.noticeFingerprint) console.log(`      Notice Fingerprint: ${c.noticeFingerprint} (${(c.noticeTypes ?? []).join(", ")})`);
        for (const n of c.notices ?? []) {
          console.log(`      - ${n.refType || "Notice"}: ${n.source}`);
        }
      }
    }
    if (healthRes.nonPubMedIdentifiers?.length > 0) {
      console.log(`  INFO: ${healthRes.nonPubMedIdentifiers.length} non-PubMed literature source(s) excluded from PubMed health monitoring:`);
      for (const np of healthRes.nonPubMedIdentifiers) {
        console.log(`    - [${np.type}] ${np.identifier} (Valid external source, not indexed on PubMed)`);
      }
    }
    if (healthRes.unresolvedIdentifiers?.length > 0) {
      console.log(`  WARNING: ${healthRes.unresolvedIdentifiers.length} literature identifiers could not be resolved:`);
      for (const u of healthRes.unresolvedIdentifiers) {
        console.log(`    ? [${u.type}] ${u.identifier} (${u.reason})`);
      }
    }
  }

  if (litDiscRes) {
    console.log(`\n[4/5] Literature Discovery Probe (Tracked Aliases: ${context.assetAliases.length}, Newly Discovered: ${litDiscRes.newDiscoveredCount})`);
    console.log("--------------------------------------------------------------------------------");
    if (litDiscRes.newDiscoveredCount === 0) {
      if (litDiscRes.deltaVerdict === "CLEAN") {
        console.log("  CLEAN: 0 new indexed PubMed publications for tracked asset aliases.");
      } else {
        console.log(`  STATUS: [${litDiscRes.deltaVerdict}] (Total hits on PubMed: ${litDiscRes.totalHits})`);
      }
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
export async function main() {
  const {
    command,
    companyId,
    assetId,
    domain,
    cik,
    bootstrap,
    advance,
    ackFilings,
    ackDeltas,
    json,
  } = parseArgs(process.argv);

  if (!companyId) {
    console.error("Error: --company <companyId> is required.");
    process.exit(1);
  }

  const context = await loadCompanyContext(companyId, assetId, { domain });

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
    secRes = await probeSecFilings(companyId, cik, context.baseline?.discoveryCheckpoint, context);
  }

  const evalResult = evaluatePreflight(context, updateRes, discRes, healthRes, litDiscRes, secRes);

  let savedBaseline = null;
  const wantsCheckpointWrite = bootstrap || advance;

  if (wantsCheckpointWrite && command !== "all") {
    console.error(`\n[CHECKPOINT WRITE BLOCKED] Checkpoint modification (--bootstrap / --advance) is only permitted with the composite 'all' command to ensure all update and discovery surfaces are verified.`);
    process.exit(1);
  }

  if (wantsCheckpointWrite) {
    const gateCheck = canAdvanceCheckpoint(context, updateRes, discRes, healthRes, litDiscRes, secRes, {
      bootstrap,
      advance,
      ackFilings,
      ackDeltas,
    });

    if (!gateCheck.allowed) {
      console.error(`\n[CHECKPOINT WRITE BLOCKED] ${gateCheck.reason}`);
      process.exit(1);
    }

    savedBaseline = saveBaselineCheckpoint(context, updateRes, healthRes, secRes);
  }

  if (json) {
    console.log(JSON.stringify({ companyId, assetId, evalResult, updateRes, discRes, healthRes, litDiscRes, secRes, savedBaseline }, null, 2));
  } else {
    printReport(context, updateRes, discRes, healthRes, litDiscRes, secRes, savedBaseline, evalResult);
  }
}

// Run CLI when invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal preflight error:", err);
    process.exit(1);
  });
}
