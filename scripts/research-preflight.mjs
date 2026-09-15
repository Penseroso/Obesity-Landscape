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
// Shared with scripts/data-registry.mjs (ADR-0072's relationship-reciprocity
// probe) so this preflight's notions of "reciprocal role" and "same asset
// identity" cannot drift apart from the probe's.
import {
  RECIPROCAL_RELATIONSHIP_ROLES,
  buildRowIdentityKeys,
  buildRowOwnIdentityKeys,
  collectRowOwnSearchTerms,
  identityKeysIntersect,
  normalizeIdentityText,
} from "../domains/company-pipeline/lib/relationship-identity.mjs";

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
 * Partner-aware Clinical Evidence discovery (ADR-0071 companion, ADR-0073).
 *
 * A licensed, co-developed, or regional-rights-split asset can be registered
 * on ClinicalTrials.gov under the *partner* company's own code name (for
 * example Kailera Therapeutics' "KAI-9531" for Jiangsu Hengrui
 * Pharmaceuticals' HRS9531/ribupatide). Focal-company-only discovery never
 * queries that name, so such a trial can be missed entirely. This extends
 * discovery to also query a partner's own code name for the *same,
 * identity-confirmed* asset - never the partner's whole pipeline, never a
 * different asset of the same company pair, and never a fuzzy company/asset
 * guess.
 *
 * Scope is deliberately narrow: `focal asset identities + partner-side
 * identities for the same asset`, gated on every one of:
 *   1. The relationship's own `role` is one of `RECIPROCAL_RELATIONSHIP_ROLES`
 *      (`licensor`/`licensee`/`co-developer`) - the same role scope ADR-0072's
 *      reciprocity probe checks. `originator` and every acquisition/
 *      historical-transfer-flavored role are one-directional by meaning and
 *      are never treated as a partner-discovery signal.
 *   2. The focal row's own `relationships[]` names a counterpart whose
 *      `externalCompanyName` exactly matches a tracked company's own
 *      `company.name` (ADR-0072's exact-normalized-match rule - no
 *      subsidiary/legal-entity resolution, no fuzzy matching).
 *   3. That counterpart has at least one of its own Program or Regimen rows
 *      whose name/code identity overlaps the focal asset's own identity -
 *      `buildRowIdentityKeys`/`identityKeysIntersect` from
 *      `domains/company-pipeline/lib/relationship-identity.mjs`, the exact
 *      same shared authority ADR-0072's asset/deal-aware matching uses (no
 *      separate, potentially-drifting copy of the identity rule here). This
 *      is what tells apart a genuine same-asset partner from an untracked or
 *      unrelated counterpart.
 * A relationship that resolves to an untracked counterpart, or to a tracked
 * counterpart with no matching asset row, adds no query terms - it is
 * reported as a diagnostic, never as an error, and never blocks discovery
 * for the rest of the run (a structurally non-actionable
 * `counterpart-asset-row-absent` case, per ADR-0072, is not a blocker here
 * either).
 *
 * The focal side itself spans both the directly-named Program row and any
 * Regimen or fixed-dose-combination Program row that, per the asset-scoped
 * workflow's own reach (ADR-0069), composes the named asset with another
 * asset of the *same* company - `loadCompanyContext` resolves that reach
 * once and passes both `scopedPrograms` and `scopedRegimens` in here.
 *
 * This only decides what to *search for*. Which company's Clinical Evidence
 * folder a resulting Study belongs in is decided afterward by ADR-0071's
 * sponsor-resolution cascade - a candidate found via a partner query is not
 * thereby attributed to the partner, and is not thereby kept with the focal
 * company either.
 */
function loadTrackedCompanyDirectory(companyDir) {
  const nameById = new Map();
  const idByNormalizedName = new Map();
  if (!fs.existsSync(companyDir)) return { nameById, idByNormalizedName };

  for (const entry of fs.readdirSync(companyDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const companyJsonPath = path.join(companyDir, entry.name, "company.json");
    if (!fs.existsSync(companyJsonPath)) continue;
    try {
      const company = JSON.parse(fs.readFileSync(companyJsonPath, "utf8"));
      if (company.id && company.name) {
        nameById.set(company.id, company.name);
        idByNormalizedName.set(normalizeIdentityText(company.name), company.id);
      }
    } catch {
      // An unreadable company.json is not this function's concern; skip it
      // rather than fail partner-aware discovery for every other company.
    }
  }
  return { nameById, idByNormalizedName };
}

function loadCounterpartRows(companyDir, companyId, fileName, kind) {
  const filePath = path.join(companyDir, companyId, fileName);
  if (!fs.existsSync(filePath)) return [];
  try {
    const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return rows.map((row) => ({ row, kind }));
  } catch {
    return [];
  }
}

function loadCounterpartAssetRows(companyDir, companyId) {
  return [
    ...loadCounterpartRows(companyDir, companyId, "pipeline-programs.json", "program"),
    ...loadCounterpartRows(companyDir, companyId, "regimens.json", "regimen"),
  ];
}

/**
 * Computes the additional (partner-side) query terms for a set of
 * asset-scoped focal Program and Regimen rows, plus a full diagnostic trail
 * of every relationship considered - resolved, skipped, or excluded - so a
 * caller can inspect exactly why a term was or was not added. Program and
 * Regimen focal rows are treated with identical same-asset identity
 * semantics throughout.
 *
 * Two different identity checks are used deliberately, for two different
 * questions:
 *   - `buildRowIdentityKeys` (components-inclusive) answers "is this
 *     counterpart row connected to the focal asset at all" - it is what lets
 *     a combination row's own `components[]` text find a partner's molecule
 *     row in the first place, and what distinguishes a genuine
 *     `counterpart-asset-row-absent` from something being found.
 *   - `buildRowOwnIdentityKeys` (the row's own name/code only, never a
 *     component's) answers "does the matched row denote *this same asset*
 *     under another company's code, safe to search for directly" - only a
 *     match confirmed this way ever contributes query terms. A row found
 *     only through a components[] reference denotes a *different*,
 *     genuinely distinct real-world asset that merely gets combined with the
 *     focal one (for example a fixed-dose-combination's second component,
 *     or a Regimen's co-administered product) - adding *its* own standalone
 *     terms would search for that different asset directly and pull in its
 *     otherwise-unrelated trials, not the focal asset's. Such a match is
 *     still reported (`component-only-match`), just never expanded.
 */
function computePartnerAwareDiscoveryTerms(scopedPrograms, scopedRegimens, companyDir) {
  const { nameById, idByNormalizedName } = loadTrackedCompanyDirectory(companyDir);
  const scopedRows = [
    ...scopedPrograms.map((row) => ({ row, kind: "program" })),
    ...(scopedRegimens ?? []).map((row) => ({ row, kind: "regimen" })),
  ];

  const focalOwnTerms = new Set();
  for (const { row, kind } of scopedRows) {
    for (const key of buildRowOwnIdentityKeys(row, kind)) focalOwnTerms.add(key);
  }

  const termProvenance = new Map(); // normalized term -> { term, counterpartCompanyId, counterpartCompanyName, focalAssetId }
  const diagnostics = [];

  for (const { row: focalRow, kind: focalKind } of scopedRows) {
    const focalAssetId = focalKind === "program" ? focalRow.assetId : focalRow.id;
    const focalKeys = buildRowIdentityKeys(focalRow, focalKind);
    const focalOwnKeys = buildRowOwnIdentityKeys(focalRow, focalKind);

    for (const relationship of focalRow.relationships ?? []) {
      if (!RECIPROCAL_RELATIONSHIP_ROLES.has(relationship.role)) continue; // one-directional role - never a discovery signal
      if (relationship.externalCompanyName === undefined) continue; // self-referential or malformed - not a counterpart

      const normalizedExternalName = normalizeIdentityText(relationship.externalCompanyName);
      const counterpartCompanyId = idByNormalizedName.get(normalizedExternalName);

      if (counterpartCompanyId === undefined) {
        diagnostics.push({
          status: "untracked-counterpart",
          focalAssetId,
          externalCompanyName: relationship.externalCompanyName,
        });
        continue; // never guess a tracked company for an unresolved name
      }
      if (counterpartCompanyId === focalRow.companyId) continue; // self-reference, not a partner

      const counterpartRows = loadCounterpartAssetRows(companyDir, counterpartCompanyId);
      const matchedRows = counterpartRows.filter(({ row: counterpartRow, kind: counterpartKind }) =>
        identityKeysIntersect(focalKeys, buildRowIdentityKeys(counterpartRow, counterpartKind)),
      );

      if (matchedRows.length === 0) {
        diagnostics.push({
          status: "counterpart-asset-row-absent",
          focalAssetId,
          counterpartCompanyId,
          counterpartCompanyName: nameById.get(counterpartCompanyId),
        });
        continue; // structurally non-actionable here too - not an error, adds no terms
      }

      // Narrow to rows confirmed to be *this same asset* (own-identity
      // overlap, no components on either side) - never a merely
      // component-linked, genuinely different asset.
      const sameAssetRows = matchedRows.filter(({ row: counterpartRow, kind: counterpartKind }) =>
        identityKeysIntersect(focalOwnKeys, buildRowOwnIdentityKeys(counterpartRow, counterpartKind)),
      );

      if (sameAssetRows.length === 0) {
        diagnostics.push({
          status: "component-only-match",
          focalAssetId,
          counterpartCompanyId,
          counterpartCompanyName: nameById.get(counterpartCompanyId),
          matchedRowIds: matchedRows.map(({ row }) => row.id),
        });
        continue; // confirmed relevant, but a different asset - never expanded into search terms
      }

      const addedTerms = [];
      for (const { row: matchedRow, kind: matchedKind } of sameAssetRows) {
        for (const term of collectRowOwnSearchTerms(matchedRow, matchedKind)) {
          if (term.length < 4) continue;
          const normalizedTerm = normalizeIdentityText(term);
          if (focalOwnTerms.has(normalizedTerm)) continue; // already covered by focal-side aliases
          if (!termProvenance.has(normalizedTerm)) {
            termProvenance.set(normalizedTerm, {
              term,
              counterpartCompanyId,
              counterpartCompanyName: nameById.get(counterpartCompanyId),
              focalAssetId,
            });
            addedTerms.push(term);
          }
        }
      }

      diagnostics.push({
        status: "partner-expanded",
        focalAssetId,
        counterpartCompanyId,
        counterpartCompanyName: nameById.get(counterpartCompanyId),
        matchedRowIds: sameAssetRows.map(({ row }) => row.id),
        addedTerms,
      });
    }
  }

  return {
    partnerAssetAliases: [...termProvenance.values()].map((entry) => entry.term).sort(),
    partnerAliasProvenance: termProvenance,
    partnerDiscoveryDiagnostics: diagnostics,
  };
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
  const partnerAwareDiscoveryResult = {
    partnerAssetAliases: [],
    partnerAliasProvenance: new Map(),
    partnerDiscoveryDiagnostics: [],
  };
  let foreignStudyDispositions = {};
  const focalIdentityKeys = new Set();

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

    // Extract asset aliases for search query targeting. An asset-scoped run
    // also reaches any same-company Regimen or fixed-dose-combination
    // Program row that directly composes the named asset with another asset
    // of the same company (ADR-0069's asset-scoped reach) - both feed the
    // same alias collection and the partner-aware expansion below with
    // identical same-asset identity semantics.
    const directPrograms = targetAssetId
      ? allPrograms.filter((p) => p.assetId === targetAssetId || p.id === targetAssetId)
      : allPrograms;

    let scopedPrograms = directPrograms;
    let scopedRegimens = [];

    if (targetAssetId) {
      const composesTargetAsset = (row) =>
        row.companyId === companyId && (row.components ?? []).some((component) => component?.assetId === targetAssetId);
      const directIds = new Set(directPrograms.map((p) => p.id));
      const composingPrograms = allPrograms.filter((p) => !directIds.has(p.id) && composesTargetAsset(p));
      scopedPrograms = [...directPrograms, ...composingPrograms];
      scopedRegimens = allRegimens.filter(composesTargetAsset);
    }

    // A composing row's own name/code (for example a fixed-dose combination's
    // own "Petrelintide / CT-388") is searched - that row's own identity is
    // why it was pulled into scope. Its components[] are deliberately *not*
    // scanned here: a component names a different, genuinely distinct
    // real-world asset the row combines with, not another name for the
    // focal asset, so turning a sibling component's standalone code into a
    // direct focal search term would search for that different asset's own
    // trials too (`collectRowOwnSearchTerms` excludes components for exactly
    // this reason - see domains/company-pipeline/lib/relationship-identity.mjs).
    for (const prog of scopedPrograms) {
      for (const term of collectRowOwnSearchTerms(prog, "program")) assetAliases.add(term);
    }
    for (const reg of scopedRegimens) {
      for (const term of collectRowOwnSearchTerms(reg, "regimen")) assetAliases.add(term);
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

      // Partner-aware discovery expansion (ADR-0071 companion): asset-scoped
      // only, gated per relationship on tracked-counterpart resolution and
      // confirmed same-asset identity - see computePartnerAwareDiscoveryTerms.
      Object.assign(
        partnerAwareDiscoveryResult,
        computePartnerAwareDiscoveryTerms(scopedPrograms, scopedRegimens, companyDir),
      );

      // ADR-0074: raw operator-authored foreign-owner dispositions for this
      // asset envelope, plus the focal side's own identity keys (reusing the
      // same shared identity authority as the partner-aware expansion above)
      // so probeRegistryDiscovery can re-check condition 5 ("CP identity
      // still sustains the resolution") without a second identity mechanism.
      foreignStudyDispositions = baseline?.discoveryCheckpoint?.clinicalTrials?.foreignStudyDispositions ?? {};
      for (const { row, kind } of [
        ...scopedPrograms.map((row) => ({ row, kind: "program" })),
        ...scopedRegimens.map((row) => ({ row, kind: "regimen" })),
      ]) {
        for (const key of buildRowOwnIdentityKeys(row, kind)) focalIdentityKeys.add(key);
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
    partnerAssetAliases: partnerAwareDiscoveryResult.partnerAssetAliases,
    partnerAliasProvenance: partnerAwareDiscoveryResult.partnerAliasProvenance,
    partnerDiscoveryDiagnostics: partnerAwareDiscoveryResult.partnerDiscoveryDiagnostics,
    foreignStudyDispositions,
    focalIdentityKeys,
    companyDir,
    unresolvedIdentifiers,
    nonPubMedIdentifiers,
  };
}

/**
 * ADR-0074: re-validates one operator-authored foreign-owner disposition
 * against the *current* local Company/Pipeline manifests only (no network) -
 * conditions 2 ("ownerCompanyId no longer tracked"), 3 ("ownerAssetId no
 * longer resolves"), and 5 ("CP identity no longer sustains the resolution")
 * of the five deterministic invalidation conditions. Reuses exactly the same
 * lookups and shared identity authority `computePartnerAwareDiscoveryTerms`
 * already relies on - no new resolver.
 */
function checkForeignDispositionLocalValidity(disp, context) {
  const { nameById } = loadTrackedCompanyDirectory(context.companyDir);
  if (!nameById.has(disp.ownerCompanyId)) {
    return { valid: false, reason: "owner-company-untracked" };
  }
  if (!disp.ownerAssetId || typeof disp.ownerAssetId !== "string" || disp.ownerAssetId.trim().length === 0) {
    return { valid: false, reason: "owner-asset-unresolvable" };
  }
  const ownerRow = loadCounterpartAssetRows(context.companyDir, disp.ownerCompanyId).find(
    ({ row, kind }) => (kind === "program" ? row.assetId : row.id) === disp.ownerAssetId,
  );
  if (!ownerRow) {
    return { valid: false, reason: "owner-asset-unresolvable" };
  }
  if (!identityKeysIntersect(context.focalIdentityKeys, buildRowOwnIdentityKeys(ownerRow.row, ownerRow.kind))) {
    return { valid: false, reason: "identity-no-longer-sustained" };
  }
  return { valid: true };
}

/**
 * ADR-0074: re-validates every foreign disposition in this asset's envelope
 * for the current preflight run - local checks first (cheap, no network),
 * then a single lightweight leadSponsor-only fetch per still-locally-valid
 * entry (condition 1, "leadSponsor materially changed").
 *
 * Missing or unparseable leadSponsor in the registry response is treated as
 * schema/fetch incompleteness (`hasIncomplete: true`), which strictly blocks
 * checkpoint write and advance. Network failure is flagged `hasError: true`,
 * also blocking checkpoint advance.
 */
async function checkForeignStudyDispositions(context, fetchFn) {
  const valid = [];
  const invalidated = [];
  const unconfirmed = [];
  let hasError = false;
  let hasIncomplete = false;

  for (const [nctId, disp] of Object.entries(context.foreignStudyDispositions ?? {})) {
    const localCheck = checkForeignDispositionLocalValidity(disp, context);
    if (!localCheck.valid) {
      invalidated.push({ nctId, reason: localCheck.reason });
      continue;
    }

    try {
      const sponsorUrl = `https://clinicaltrials.gov/api/v2/studies/${nctId}?fields=protocolSection.sponsorCollaboratorsModule.leadSponsor.name`;
      const res = await fetchFn(sponsorUrl);
      if (!res.ok) {
        hasError = true;
        unconfirmed.push({ nctId, reason: "lead-sponsor-fetch-error" });
        continue;
      }
      const data = await res.json();
      const rawLeadSponsor = data.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name;
      const liveLeadSponsor =
        typeof rawLeadSponsor === "string" && rawLeadSponsor.trim().length > 0
          ? rawLeadSponsor.trim()
          : null;

      if (liveLeadSponsor === null) {
        hasIncomplete = true;
        unconfirmed.push({ nctId, reason: "lead-sponsor-missing" });
      } else if (liveLeadSponsor !== disp.recordedLeadSponsor) {
        invalidated.push({ nctId, reason: "lead-sponsor-changed" });
      } else {
        valid.push(nctId);
      }
    } catch {
      hasError = true;
      unconfirmed.push({ nctId, reason: "lead-sponsor-fetch-error" });
    }
  }

  return { valid, invalidated, unconfirmed, hasError, hasIncomplete };
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
  let hasIncomplete = false;

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
          discoveryPath: "focal",
        });
      }
    }
  }

  // 2. Query asset aliases (focal company's own asset identity)
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
          discoveryPath: "focal",
        });
      }
    }
  }

  // 3. Query partner-side asset identity (ADR-0071 companion, asset-scoped
  // only - see computePartnerAwareDiscoveryTerms). Each term is only ever a
  // name/code confirmed, via CP identity, to denote the same focal asset on
  // a tracked counterpart's own row - never a partner's whole pipeline.
  for (const alias of context.partnerAssetAliases ?? []) {
    if (alias.length < 4) continue;
    const intrUrl = `https://clinicaltrials.gov/api/v2/studies?query.intr=${encodeURIComponent(alias)}&pageSize=20&fields=${fields}`;
    const aliasRes = await fetchCtGovStudies(intrUrl, 3, fetchFn);
    if (aliasRes.hasError) hasError = true;
    if (aliasRes.truncated) truncated = true;

    const provenance = context.partnerAliasProvenance?.get(normalizeIdentityText(alias));
    const counterpartLabel = provenance?.counterpartCompanyName ?? provenance?.counterpartCompanyId ?? "unknown counterpart";

    for (const study of aliasRes.studies) {
      const id = study.protocolSection?.identificationModule?.nctId;
      if (id && !candidateNCTs.has(id)) {
        candidateNCTs.set(id, {
          nctId: id,
          briefTitle: study.protocolSection?.identificationModule?.briefTitle ?? "",
          overallStatus: study.protocolSection?.statusModule?.overallStatus ?? "UNKNOWN",
          lastUpdatePostDate: study.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date ?? null,
          matchedOn: `partner-intervention: ${alias} (via ${counterpartLabel})`,
          discoveryPath: "partner",
        });
      }
    }
  }

  // ADR-0074: re-validate every operator-authored foreign disposition for
  // this run, then suppress `NEW` for the still-valid subset only.
  // `knownSet` (local canonical), valid foreign dispositions, and unconfirmed
  // dispositions stay visibly distinct sets. Genuinely new trials are those
  // not in knownNCTs, not in currently-valid foreign dispositions, not in
  // unconfirmed (interim suppressed to prevent false NEW on transient error),
  // and not in resurfacedForeignDispositions (invalidated entries are reported
  // exclusively under resurfacedForeignDispositions, never duplicated in newlyDiscovered).
  const foreignDispositionStatus = await checkForeignStudyDispositions(context, fetchFn);
  if (foreignDispositionStatus.hasError) hasError = true;
  if (foreignDispositionStatus.hasIncomplete || truncated) hasIncomplete = true;

  const knownSet = new Set(context.knownNCTs);
  const validForeignSet = new Set(foreignDispositionStatus.valid);
  const unconfirmedForeignSet = new Set((foreignDispositionStatus.unconfirmed ?? []).map((u) => u.nctId));
  const resurfacedForeignDispositions = foreignDispositionStatus.invalidated;
  const resurfacedForeignSet = new Set(resurfacedForeignDispositions.map((r) => r.nctId));

  const newlyDiscovered = [];
  for (const [id, record] of candidateNCTs.entries()) {
    if (
      !knownSet.has(id) &&
      !validForeignSet.has(id) &&
      !unconfirmedForeignSet.has(id) &&
      !resurfacedForeignSet.has(id)
    ) {
      newlyDiscovered.push(record);
    }
  }

  const newlyDiscoveredFocalCount = newlyDiscovered.filter((r) => r.discoveryPath !== "partner").length;
  const newlyDiscoveredPartnerCount = newlyDiscovered.filter((r) => r.discoveryPath === "partner").length;

  const hasDelta = newlyDiscovered.length > 0 || resurfacedForeignDispositions.length > 0;

  let deltaVerdict = "CLEAN";
  if (hasDelta) {
    if (newlyDiscovered.length > 0 && resurfacedForeignDispositions.length > 0) {
      deltaVerdict = "NEW_TRIALS_AND_RESURFACED_DISPOSITIONS";
    } else if (newlyDiscovered.length > 0) {
      deltaVerdict = "NEW_TRIALS_DETECTED";
    } else {
      deltaVerdict = "RESURFACED_DISPOSITIONS_DETECTED";
    }
  } else if (hasError) {
    deltaVerdict = "FETCH_ERROR";
  } else if (hasIncomplete) {
    deltaVerdict = truncated ? "PARTIAL_TRUNCATED" : "PARTIAL_INCOMPLETE";
  }

  return {
    totalCandidates: candidateNCTs.size,
    newlyDiscoveredCount: newlyDiscovered.length,
    resurfacedForeignDispositionCount: resurfacedForeignDispositions.length,
    newlyDiscoveredFocalCount,
    newlyDiscoveredPartnerCount,
    deltaVerdict,
    hasDelta,
    hasError,
    hasIncomplete,
    truncated,
    newlyDiscovered,
    partnerDiscoveryDiagnostics: context.partnerDiscoveryDiagnostics ?? [],
    foreignDispositionStatus,
    resurfacedForeignDispositions,
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
      if (discRes?.resurfacedForeignDispositions?.length > 0 && discRes?.newlyDiscovered?.length === 0) {
        unacknowledged.push("Resurfaced foreign study dispositions requiring re-review (pass --ack-deltas after reviewing)");
      } else if (discRes?.resurfacedForeignDispositions?.length > 0 && discRes?.newlyDiscovered?.length > 0) {
        unacknowledged.push("New clinical trials discovered and resurfaced foreign study dispositions (pass --ack-deltas after reviewing)");
      } else {
        unacknowledged.push("New clinical trials discovered (pass --ack-deltas after reviewing)");
      }
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
export function saveBaselineCheckpoint(context, updateRes, discRes, healthRes, secRes) {
  const asOf = new Date().toISOString().slice(0, 10);
  const knownNCTsSet = new Set(context.knownNCTs);
  const knownPMIDsSet = new Set(context.knownPMIDs);

  const prevNCTs = context.baseline?.discoveryCheckpoint?.clinicalTrials?.knownNCTs ?? {};
  const prevPMIDs = context.baseline?.discoveryCheckpoint?.literature?.monitoredPMIDs ?? {};
  const prevForeignDispositions = context.baseline?.discoveryCheckpoint?.clinicalTrials?.foreignStudyDispositions ?? {};

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

  // ADR-0074: pure filter, never invention - an entry survives only if this
  // run's foreign-disposition re-validation (local + sponsor-drift checks)
  // still confirms it. A dropped entry is not deleted state, it simply
  // re-qualifies as an ordinary NEW discovery candidate on the next run,
  // exactly like knownNCtsMap's own "start from previous, filter by current
  // truth" reconstruction above never invents a new known NCT either - new
  // dispositions are hand-authored into the source JSON, the same way a new
  // Study is.
  const validForeignIds = new Set(discRes?.foreignDispositionStatus?.valid ?? []);
  const foreignDispositionsMap = discRes
    ? Object.fromEntries(
        Object.entries(prevForeignDispositions).filter(([nctId]) => validForeignIds.has(nctId)),
      )
    : { ...prevForeignDispositions };

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
        ...(Object.keys(foreignDispositionsMap).length > 0 ? { foreignStudyDispositions: foreignDispositionsMap } : {}),
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
      console.log(
        `  ALERT: ${discRes.newlyDiscoveredCount} newly registered trials discovered (${discRes.newlyDiscoveredFocalCount ?? discRes.newlyDiscoveredCount} focal, ${discRes.newlyDiscoveredPartnerCount ?? 0} partner-expanded):`,
      );
      for (const d of discRes.newlyDiscovered) {
        console.log(`    + ${d.nctId} [${d.overallStatus}] (PostDate: ${d.lastUpdatePostDate})`);
        console.log(`      "${d.briefTitle}"`);
        console.log(`      Matched: ${d.matchedOn}`);
      }
      if ((discRes.newlyDiscoveredPartnerCount ?? 0) > 0) {
        console.log(
          "      NOTE (ADR-0071): a partner-expanded candidate is not thereby attributed to the partner or kept with the focal company - the sponsor-resolution cascade decides the Study anchor after discovery, independent of which query found it.",
        );
      }
    }

    const partnerDiag = discRes.partnerDiscoveryDiagnostics ?? [];
    if (partnerDiag.length > 0) {
      console.log("  Partner-aware discovery diagnostics (ADR-0071 companion):");
      for (const d of partnerDiag) {
        if (d.status === "untracked-counterpart") {
          console.log(
            `    - ${d.focalAssetId}: relationship names "${d.externalCompanyName}" - not a tracked company; no query expansion (never guessed)`,
          );
        } else if (d.status === "counterpart-asset-row-absent") {
          console.log(
            `    - ${d.focalAssetId}: ${d.counterpartCompanyName} (${d.counterpartCompanyId}) has no row matching this asset's identity - no query expansion (structurally non-actionable per ADR-0072, not a blocker)`,
          );
        } else if (d.status === "partner-expanded") {
          const termsLabel = d.addedTerms.length > 0 ? d.addedTerms.join(", ") : "(no new terms - already covered by focal aliases)";
          console.log(
            `    - ${d.focalAssetId}: expanded via ${d.counterpartCompanyName} (${d.counterpartCompanyId}), matched row(s) [${d.matchedRowIds.join(", ")}] - terms added: ${termsLabel}`,
          );
        } else if (d.status === "component-only-match") {
          console.log(
            `    - ${d.focalAssetId}: relationship confirmed via ${d.counterpartCompanyName} (${d.counterpartCompanyId}), matched row(s) [${d.matchedRowIds.join(", ")}], but only through a components[] reference to a different asset - no query expansion (would search that different asset's own trials, not this one)`,
          );
        }
      }
    }

    // ADR-0074: currently-suppressed and resurfaced foreign dispositions.
    const foreignStatus = discRes.foreignDispositionStatus;
    if (
      foreignStatus &&
      (foreignStatus.valid.length > 0 ||
        foreignStatus.invalidated.length > 0 ||
        (foreignStatus.unconfirmed && foreignStatus.unconfirmed.length > 0))
    ) {
      console.log("  Foreign-owner dispositions (ADR-0074):");
      if (foreignStatus.valid.length > 0) {
        console.log(
          `    - ${foreignStatus.valid.length} still suppressed (previously confirmed as another tracked company's canonical CE): ${foreignStatus.valid.join(", ")}`,
        );
      }
      for (const r of discRes.resurfacedForeignDispositions ?? []) {
        console.log(`    ! RESURFACED ${r.nctId}: disposition invalidated (${r.reason}) - requires re-review, not re-attributed automatically`);
      }
      for (const u of foreignStatus.unconfirmed ?? []) {
        console.log(`    ? UNCONFIRMED ${u.nctId}: lead sponsor could not be verified (${u.reason}) - checkpoint write blocked`);
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

    savedBaseline = saveBaselineCheckpoint(context, updateRes, discRes, healthRes, secRes);
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
