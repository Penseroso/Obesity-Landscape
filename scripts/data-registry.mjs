import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dataDir = path.join(root, "data");
const companySourceDir = path.join(dataDir, "companies");
const generatedDir = path.join(dataDir, "generated");
const clinicalEvidenceSourceDir = path.join(dataDir, "clinical-evidence");
const registryDir = path.join(dataDir, "registries");
const syntheticFixtureDir = path.join(dataDir, "validation-fixtures", "synthetic");
const clinicalEvidenceFixtureDir = path.join(dataDir, "validation-fixtures", "clinical-evidence");

const fullDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const partialDatePattern = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const nctPattern = /^NCT\d{8}$/;
const assetTypes = new Set([
  "single-asset",
  "fixed-dose-combination",
  "co-formulation",
]);
const combinationAssetTypes = new Set([
  "fixed-dose-combination",
  "co-formulation",
]);
// Single source of truth shared with the Company/Pipeline TypeScript library.
const assetAliasTypes = new Set(
  readJson(path.join(root, "domains", "company-pipeline", "lib", "asset-alias-types.json")),
);
const developmentStatuses = new Set([
  "Planned",
  "Active",
  "On hold",
  "Discontinued",
  "Unknown",
]);
const developmentStageBases = new Set([
  "Sponsor-declared current pipeline stage",
  "Operational evidence",
  "Official regulatory-development milestone",
]);
const developmentStageOperationalStates = new Set([
  "Initiated or active",
  "Active not recruiting",
  "Not yet recruiting",
  "Planned, not yet initiated",
  "Submitted, pending clearance",
  "Cleared, not yet initiated",
  "Paused",
  "Completed",
  "Not separately confirmed",
]);
// Contract 1.1 allowed development.status x stageOperationalState combinations.
// "Not separately confirmed" is the neutral escape hatch allowed for any status.
const stageOperationalStatesByStatus = {
  Planned: new Set([
    "Planned, not yet initiated",
    "Not yet recruiting",
    "Submitted, pending clearance",
    "Cleared, not yet initiated",
    "Not separately confirmed",
  ]),
  Active: new Set([
    "Initiated or active",
    "Active not recruiting",
    "Not yet recruiting",
    "Submitted, pending clearance",
    "Cleared, not yet initiated",
    "Completed",
    "Not separately confirmed",
  ]),
  "On hold": new Set(["Paused", "Not separately confirmed"]),
  Discontinued: new Set(["Paused", "Completed", "Not separately confirmed"]),
  Unknown: new Set(["Not separately confirmed"]),
};
// Clinical Evidence canonical schema version (ADR-0039). Earlier records do not
// validate here. Namespaced as clinicalEvidenceSchemaVersion (not a bare
// "schemaVersion") because this project also has a separate, differently-numbered
// Company/Pipeline "Contract 1.1" versioning scheme (ADR-0030); a generic field name
// here could be misread as versioning the whole registry contract.
const clinicalEvidenceSchemaVersion = "3.0";
// The derived reciprocal asset index (R2b) is not part of the canonical v3.0
// contract. It is an independently versioned projection,
// regenerated deterministically and may change shape independently of the
// canonical schema. It therefore carries its own,
// separately-numbered version field rather than reusing clinicalEvidenceSchemaVersion.
const clinicalAssetStudyIndexProjectionVersion = "2.0";
const clinicalRegistryStatuses = new Set([
  "not-yet-recruiting",
  "recruiting",
  "enrolling-by-invitation",
  "active-not-recruiting",
  "suspended",
  "terminated",
  "withdrawn",
  "completed",
  "unknown",
]);
const clinicalArmRoles = new Set([
  "experimental",
  "placebo",
  "active comparator",
  "other",
]);
const clinicalAnalysisGroupKinds = new Set([
  "pooled",
  "derived",
  "starting-dose-subgroup",
  "other",
]);
const clinicalEndpointRoles = new Set([
  "primary",
  "co-primary",
  "key-secondary",
  "secondary",
  "exploratory",
  "safety",
  "other",
]);
const clinicalEndpointDomains = new Set([
  "body weight",
  "body composition",
  "glycemic",
  "cardiovascular",
  "renal",
  "hepatic",
  "respiratory",
  "musculoskeletal",
  "patient-reported",
  "safety",
  "other",
]);
const clinicalResultMaturities = new Set([
  "interim",
  "topline",
  "final",
  "registry result",
  "conference result",
  "peer-reviewed publication",
]);
const clinicalResultTypes = new Set(["arm-level", "between-arm"]);
// This deliberately checks structure, not terminology. Any source-reported analysis-set
// vocabulary remains valid, but a value ending in "estimand" or "estimand population" is
// unambiguously an estimand label in the wrong field. A trailing parenthetical subgroup
// qualifier is removed before applying this anchored check.
const clinicalAnalysisPopulationEstimandLabelPattern = /\bestimand(?: population)?$/;
// An effect measure is not a unit (ADR-0037). "hazard ratio" describes what the number
// means, not what it is measured in; it belongs in result.effectMeasure.
const clinicalEffectMeasureUnitPattern =
  /\b(hazard ratio|odds ratio|risk ratio|rate ratio|relative risk|mean difference|treatment difference|difference)\b/;
// Standard analysis-set abbreviations. The vocabulary stays open: an unknown source term is
// canonicalized structurally (casing/punctuation) and passes through unchanged.
const clinicalAnalysisSetAliases = new Map([
  ["itt", "intention to treat"],
  ["intent to treat", "intention to treat"],
  ["mitt", "modified intention to treat"],
  ["modified itt", "modified intention to treat"],
  ["modified intent to treat", "modified intention to treat"],
  ["fas", "full analysis set"],
  ["eas", "efficacy analysis set"],
  ["pp", "per protocol"],
  ["safety set", "safety analysis set"],
]);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalize(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sortedStrings(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

// Field-specific canonicalization (ADR-0037). Used ONLY to compute semantic keys and
// grouping; the source-reported text stays on the record verbatim. normalize() itself is
// left punctuation-sensitive because other domains rely on its exact behaviour.
function canonicalizeClinicalTermText(value) {
  return normalize(value)
    .replace(/[‐-―]/g, "-")
    .replace(/[-_/]+/g, " ")
    .replace(/[.,;:'"()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "Treatment-policy estimand" and "Treatment policy estimand" are one estimand. The
// trailing "estimand" / "estimand population" wording is a suffix, not part of the
// strategy name. Unknown strategies remain valid and are canonicalized structurally.
function canonicalizeClinicalEstimand(value) {
  if (value === undefined) {
    return "";
  }

  return canonicalizeClinicalTermText(value).replace(/\s*estimand(?: population)?$/, "");
}

// The analysis set and any trailing parenthetical subgroup are canonicalized separately, so
// "Full analysis set (overall)" and "Full analysis set (Part B)" stay distinct while "FAS"
// and "Full analysis set" collapse.
function canonicalizeClinicalAnalysisPopulation(value) {
  const trimmed = value.trim();
  const subgroupMatch = /^(.*?)\s*\(([^()]*)\)$/.exec(trimmed);
  const setText = canonicalizeClinicalTermText(subgroupMatch ? subgroupMatch[1] : trimmed);
  const subgroupText = subgroupMatch ? canonicalizeClinicalTermText(subgroupMatch[2]) : "";
  const canonicalSet = clinicalAnalysisSetAliases.get(setText) ?? setText;

  return subgroupText ? `${canonicalSet}(${subgroupText})` : canonicalSet;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidFullDate(value) {
  if (!fullDatePattern.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidPartialDate(value) {
  if (!partialDatePattern.test(value)) {
    return false;
  }

  const parts = value.split("-");
  const year = Number(parts[0]);

  if (year < 1000 || year > 9999) {
    return false;
  }

  if (parts.length >= 2) {
    const month = Number(parts[1]);
    if (month < 1 || month > 12) {
      return false;
    }
  }

  if (parts.length === 3) {
    return isValidFullDate(value);
  }

  return true;
}

function validateUniqueRegistryText(entries, label) {
  const seen = new Map();

  for (const entry of entries) {
    for (const value of [entry.label, ...(entry.aliases ?? [])]) {
      const key = normalize(value);
      const existing = seen.get(key);
      assert(
        !existing,
        `${label} registry text "${value}" is duplicated by ${existing} and ${entry.id}`,
      );
      seen.set(key, entry.id);
    }
  }
}

function validateRegistryEntries(entries, label, requireFamily) {
  assert(Array.isArray(entries), `${label} registry must be an array`);

  const ids = new Set();
  const ranks = new Set();

  for (const entry of entries) {
    assert(isObject(entry), `${label} entries must be objects`);
    assert(isNonEmptyString(entry.id), `${label} entry id is required`);
    assert(isNonEmptyString(entry.label), `${label} entry label is required`);
    assert(Array.isArray(entry.aliases), `${label} entry ${entry.id} aliases must be an array`);
    assert(!ids.has(entry.id), `${label} entry id ${entry.id} is duplicated`);
    ids.add(entry.id);

    for (const alias of entry.aliases) {
      assert(isNonEmptyString(alias), `${label} entry ${entry.id} has an empty alias`);
    }

    if (requireFamily) {
      assert(isNonEmptyString(entry.family), `${label} entry ${entry.id} family is required`);
      assert(Number.isFinite(entry.sortRank), `${label} entry ${entry.id} sortRank is required`);
      assert(!ranks.has(entry.sortRank), `${label} sortRank ${entry.sortRank} is duplicated`);
      ranks.add(entry.sortRank);
    }
  }

  validateUniqueRegistryText(entries, label);
}

function loadRegistries() {
  const stages = readJson(path.join(registryDir, "development-stages.json"));
  const regulatoryStates = readJson(path.join(registryDir, "regulatory-states.json"));
  const relationshipRoles = readJson(path.join(registryDir, "company-relationship-roles.json"));

  validateRegistryEntries(stages, "development-stages", true);
  validateRegistryEntries(regulatoryStates, "regulatory-states", false);
  validateRegistryEntries(relationshipRoles, "company-relationship-roles", false);

  return {
    stageLabels: new Set(stages.map((stage) => stage.label)),
    regulatoryStateLabels: new Set(regulatoryStates.map((state) => state.label)),
    relationshipRoleLabels: new Set(relationshipRoles.map((role) => role.label)),
  };
}

function validateCompany(company, context) {
  assert(isObject(company), `${context}: company must be an object`);
  assert(isNonEmptyString(company.id), `${context}: company.id is required`);
  assert(isNonEmptyString(company.name), `${context}: company.name is required`);
  assert(
    isNonEmptyString(company.headquartersCountry),
    `${context}: company.headquartersCountry is required`,
  );
}

function validateSource(source, context) {
  assert(isObject(source), `${context}: source must be an object`);
  assert(isNonEmptyString(source.url), `${context}: source.url is required`);
  assert(isValidFullDate(source.checkedAt), `${context}: source.checkedAt must be YYYY-MM-DD`);

  if (source.publishedAt !== undefined) {
    assert(
      isNonEmptyString(source.publishedAt) && isValidPartialDate(source.publishedAt),
      `${context}: source.publishedAt must be YYYY, YYYY-MM, or YYYY-MM-DD`,
    );
  }
}

function validateMetadata(metadata, context) {
  assert(isObject(metadata), `${context}: metadata is required`);
  assert(
    isValidFullDate(metadata.lastVerifiedAt),
    `${context}: metadata.lastVerifiedAt must be YYYY-MM-DD`,
  );
  assert(isValidFullDate(metadata.updatedAt), `${context}: metadata.updatedAt must be YYYY-MM-DD`);
  assert(Array.isArray(metadata.sources), `${context}: metadata.sources must be an array`);

  for (const [index, source] of metadata.sources.entries()) {
    validateSource(source, `${context}: metadata.sources[${index}]`);
  }
}

function validateDevelopment(development, context, registries) {
  assert(isObject(development), `${context}: development is required`);
  assert(
    registries.stageLabels.has(development.stage),
    `${context}: development.stage "${development.stage}" is not in the registry`,
  );
  assert(
    developmentStatuses.has(development.status),
    `${context}: development.status "${development.status}" is not allowed`,
  );
  if (development.stageBasis !== undefined) {
    assert(
      developmentStageBases.has(development.stageBasis),
      `${context}: development.stageBasis "${development.stageBasis}" is not allowed`,
    );
  }
  if (development.stageOperationalState !== undefined) {
    assert(
      developmentStageOperationalStates.has(development.stageOperationalState),
      `${context}: development.stageOperationalState "${development.stageOperationalState}" is not allowed`,
    );
    const allowedOperationalStates = stageOperationalStatesByStatus[development.status];
    assert(
      allowedOperationalStates !== undefined &&
        allowedOperationalStates.has(development.stageOperationalState),
      `${context}: development.stageOperationalState "${development.stageOperationalState}" is not allowed with status "${development.status}"`,
    );
  }
}

function validateAdministration(administration, context, required) {
  if (administration === undefined && !required) {
    return;
  }

  assert(isObject(administration), `${context}: administration is required`);
  assert(isNonEmptyString(administration.route), `${context}: route is required`);
  assert(isNonEmptyString(administration.dosageForm), `${context}: dosageForm is required`);
  assert(
    administration.dosingInterval === null ||
      isNonEmptyString(administration.dosingInterval),
    `${context}: invalid dosingInterval`,
  );
}

function validateIndications(indications, context) {
  assert(Array.isArray(indications), `${context}: indications must be an array`);
  assert(indications.length > 0, `${context}: at least one indication is required`);
  for (const indication of indications) {
    assert(isNonEmptyString(indication), `${context}: empty indication`);
  }
}

function validateRegulatoryStates(regulatoryStates, context, registries) {
  if (regulatoryStates === undefined) {
    return;
  }

  assert(Array.isArray(regulatoryStates), `${context}: regulatoryStates must be an array`);
  for (const [index, regulatoryState] of regulatoryStates.entries()) {
    const stateContext = `${context}: regulatoryStates[${index}]`;
    assert(isObject(regulatoryState), `${stateContext} must be an object`);
    assert(
      registries.regulatoryStateLabels.has(regulatoryState.state),
      `${stateContext}.state "${regulatoryState.state}" is not in the registry`,
    );
    assert(isNonEmptyString(regulatoryState.jurisdiction), `${stateContext}.jurisdiction is required`);
    assert(isNonEmptyString(regulatoryState.authority), `${stateContext}.authority is required`);

    if (regulatoryState.date !== undefined) {
      assert(
        isNonEmptyString(regulatoryState.date) && isValidPartialDate(regulatoryState.date),
        `${stateContext}.date must be YYYY, YYYY-MM, or YYYY-MM-DD`,
      );
    }
  }
}

function validateStringArray(value, context, required) {
  if (value === undefined && !required) {
    return;
  }

  assert(Array.isArray(value), `${context} must be an array`);
  assert(!required || value.length > 0, `${context} must not be empty`);

  for (const item of value) {
    assert(isNonEmptyString(item), `${context} has an empty value`);
  }
}

function validateAliases(aliases, assetName, context) {
  if (aliases === undefined) {
    return;
  }

  assert(Array.isArray(aliases), `${context}: aliases must be an array`);

  const seen = new Set();
  const canonical = normalize(assetName);
  for (const [index, alias] of aliases.entries()) {
    const aliasContext = `${context}: aliases[${index}]`;
    assert(isObject(alias), `${aliasContext} must be an object`);
    assert(
      assetAliasTypes.has(alias.type),
      `${aliasContext}.type "${alias.type}" is not allowed`,
    );
    assert(isNonEmptyString(alias.value), `${aliasContext}.value is required`);
    const normalizedValue = normalize(alias.value);
    assert(
      normalizedValue !== canonical,
      `${aliasContext}.value "${alias.value}" duplicates the canonical assetName; an alias records a different label`,
    );
    assert(
      !seen.has(normalizedValue),
      `${aliasContext} duplicates alias value "${alias.value}"; the same value must not repeat across alias types`,
    );
    seen.add(normalizedValue);
  }
}

function getAliasesIdentityKey(aliases) {
  if (aliases === undefined) {
    return "";
  }

  return sortedStrings(
    aliases.map((alias) => `${alias.type}:${normalize(alias.value)}`),
  ).join("|");
}

function getComponentKey(component) {
  if (component.assetId) {
    return `asset:${normalize(component.assetId)}`;
  }

  const assetName = component.assetName ? normalize(component.assetName) : "";
  const codeName = component.codeName ? normalize(component.codeName) : "";
  const company = component.companyId
    ? `company:${normalize(component.companyId)}`
    : `external:${normalize(component.externalCompanyName ?? "")}`;

  return `named:${company}:${assetName}:${codeName}`;
}

function getComponentSetKey(components) {
  return sortedStrings(components.map((component) => getComponentKey(component))).join("|");
}

function getRegimenBaseIdentityKey(regimen) {
  return [
    regimen.companyId,
    getComponentSetKey(regimen.components),
    sortedStrings(regimen.indications.map(normalize)).join(","),
  ].join("|");
}

function getNormalizedConfigurationKey(regimen) {
  return regimen.configurationKey === undefined
    ? ""
    : normalize(regimen.configurationKey);
}

function validateComponent(component, context, dataset) {
  assert(isObject(component), `${context}: component must be an object`);
  assert(
    component.assetId === undefined || isNonEmptyString(component.assetId),
    `${context}: assetId must be non-empty when present`,
  );
  assert(
    component.assetName === undefined || isNonEmptyString(component.assetName),
    `${context}: assetName must be non-empty when present`,
  );
  assert(
    component.codeName === undefined || isNonEmptyString(component.codeName),
    `${context}: codeName must be non-empty when present`,
  );
  assert(
    component.companyId === undefined || isNonEmptyString(component.companyId),
    `${context}: companyId must be non-empty when present`,
  );
  assert(
    component.externalCompanyName === undefined ||
      isNonEmptyString(component.externalCompanyName),
    `${context}: externalCompanyName must be non-empty when present`,
  );
  assert(
    component.role === undefined || isNonEmptyString(component.role),
    `${context}: role must be non-empty when present`,
  );
  assert(
    !(component.companyId && component.externalCompanyName),
    `${context}: companyId and externalCompanyName cannot both be used. Use companyId only for the current company source folder; use externalCompanyName for another company.`,
  );

  if (component.assetId) {
    assert(
      dataset.assetIds.has(component.assetId),
      `${context}: component assetId "${component.assetId}" does not exist in the current company source folder. Use assetName or codeName with externalCompanyName for an asset owned by another company.`,
    );
    assert(
      component.assetName === undefined && component.codeName === undefined,
      `${context}: internal assetId reference must not also provide assetName or codeName`,
    );
  } else {
    assert(
      isNonEmptyString(component.assetName) || isNonEmptyString(component.codeName),
      `${context}: external or untracked component needs assetName or codeName`,
    );
  }

  if (component.companyId) {
    assert(
      dataset.companyIds.has(component.companyId),
      `${context}: companyId "${component.companyId}" is not valid in the current company source folder. Use externalCompanyName for another company.`,
    );
  }
}

function validateComponents(components, context, dataset, minimumCount) {
  assert(Array.isArray(components), `${context}: components must be an array`);
  assert(components.length >= minimumCount, `${context}: at least ${minimumCount} components required`);

  const componentKeys = new Set();
  for (const [index, component] of components.entries()) {
    validateComponent(component, `${context}: components[${index}]`, dataset);
    const key = getComponentKey(component);
    assert(!componentKeys.has(key), `${context}: duplicate component ${key}`);
    componentKeys.add(key);
  }
}

function getRelationshipKey(relationship) {
  const company = relationship.companyId
    ? `company:${normalize(relationship.companyId)}`
    : `external:${normalize(relationship.externalCompanyName ?? "")}`;
  const territories = sortedStrings((relationship.territories ?? []).map(normalize)).join(",");
  const rights = sortedStrings((relationship.rights ?? []).map(normalize)).join(",");

  return [
    company,
    normalize(relationship.role),
    territories,
    rights,
    relationship.effectiveDate ?? "",
  ].join("|");
}

function validateRelationships(relationships, context, registries, dataset) {
  if (relationships === undefined) {
    return;
  }

  assert(Array.isArray(relationships), `${context}: relationships must be an array`);

  const relationshipKeys = new Set();
  for (const [index, relationship] of relationships.entries()) {
    const relationshipContext = `${context}: relationships[${index}]`;
    assert(isObject(relationship), `${relationshipContext}: relationship must be an object`);
    assert(
      isNonEmptyString(relationship.role) &&
        registries.relationshipRoleLabels.has(relationship.role),
      `${relationshipContext}: role "${relationship.role}" is not in the registry`,
    );
    assert(
      isNonEmptyString(relationship.companyId) ||
        isNonEmptyString(relationship.externalCompanyName),
      `${relationshipContext}: companyId or externalCompanyName is required`,
    );
    assert(
      !(relationship.companyId && relationship.externalCompanyName),
      `${relationshipContext}: companyId and externalCompanyName cannot both be used. Use companyId only for the current company source folder; use externalCompanyName for another company.`,
    );

    if (relationship.companyId) {
      assert(
        dataset.companyIds.has(relationship.companyId),
        `${relationshipContext}: companyId "${relationship.companyId}" is not valid in the current company source folder. Use externalCompanyName for another company.`,
      );
    }

    validateStringArray(relationship.territories, `${relationshipContext}.territories`, false);
    validateStringArray(relationship.rights, `${relationshipContext}.rights`, false);
    validateStringArray(relationship.sourceUrls, `${relationshipContext}.sourceUrls`, false);

    if (relationship.effectiveDate !== undefined) {
      assert(
        isNonEmptyString(relationship.effectiveDate) &&
          isValidPartialDate(relationship.effectiveDate),
        `${relationshipContext}: effectiveDate must be YYYY, YYYY-MM, or YYYY-MM-DD`,
      );
    }

    const key = getRelationshipKey(relationship);
    assert(!relationshipKeys.has(key), `${context}: duplicate relationship ${key}`);
    relationshipKeys.add(key);
  }
}

function createDatasetContext(companies, programs, ownerCompanyId) {
  const ownerCompanyIds = ownerCompanyId
    ? [ownerCompanyId]
    : companies.map((company) => company.id);
  const ownerCompanyIdSet = new Set(ownerCompanyIds);

  return {
    companyIds: ownerCompanyIdSet,
    assetIds: new Set(
      programs
        .filter((program) => ownerCompanyIdSet.has(program.companyId))
        .map((program) => program.assetId),
    ),
  };
}

function validateProgram(program, context, registries, dataset) {
  assert(isObject(program), `${context}: program must be an object`);
  assert(isNonEmptyString(program.id), `${context}: program.id is required`);
  assert(isNonEmptyString(program.assetId), `${context}: program.assetId is required`);
  assert(isNonEmptyString(program.companyId), `${context}: program.companyId is required`);
  assert(isNonEmptyString(program.assetName), `${context}: program.assetName is required`);
  assert(program.codeName === null || isNonEmptyString(program.codeName), `${context}: invalid codeName`);
  assert(
    program.codeName === null || normalize(program.codeName) !== normalize(program.assetName),
    `${context}: codeName must not duplicate assetName; leave codeName null when the development code is the canonical name`,
  );
  validateAliases(program.aliases, program.assetName, context);

  const assetType = program.assetType ?? "single-asset";
  assert(assetTypes.has(assetType), `${context}: unsupported assetType ${assetType}`);

  if (assetType === "single-asset") {
    assert(
      program.components === undefined,
      `${context}: single-asset programs must not define components`,
    );
  } else {
    validateComponents(program.components, context, dataset, 2);
  }

  assert(isObject(program.technical), `${context}: technical is required`);
  assert(
    program.technical.mechanism === null || isNonEmptyString(program.technical.mechanism),
    `${context}: invalid mechanism`,
  );
  assert(
    program.technical.platform === null || isNonEmptyString(program.technical.platform),
    `${context}: invalid platform`,
  );

  validateAdministration(program.administration, `${context}: administration`, true);
  validateIndications(program.indications, context);
  validateDevelopment(program.development, context, registries);
  validateRegulatoryStates(program.regulatoryStates, context, registries);
  validateRelationships(program.relationships, context, registries, dataset);
  validateMetadata(program.metadata, context);
}

function validateRegimen(regimen, context, registries, dataset) {
  assert(isObject(regimen), `${context}: regimen must be an object`);
  assert(isNonEmptyString(regimen.id), `${context}: regimen.id is required`);
  assert(isNonEmptyString(regimen.companyId), `${context}: regimen.companyId is required`);
  assert(isNonEmptyString(regimen.name), `${context}: regimen.name is required`);
  if (regimen.configurationKey !== undefined) {
    assert(
      isNonEmptyString(regimen.configurationKey),
      `${context}: configurationKey must be a non-empty string`,
    );
    assert(
      regimen.configurationKey === regimen.configurationKey.trim(),
      `${context}: configurationKey must not have leading or trailing whitespace`,
    );
    assert(
      !developmentStatuses.has(regimen.configurationKey),
      `${context}: configurationKey must not be a development status`,
    );
    assert(
      !registries.stageLabels.has(regimen.configurationKey),
      `${context}: configurationKey must not be a development stage`,
    );
  }
  assert(
    dataset.companyIds.has(regimen.companyId),
    `${context}: missing companyId reference ${regimen.companyId}`,
  );

  validateComponents(regimen.components, context, dataset, 2);
  validateIndications(regimen.indications, context);
  validateDevelopment(regimen.development, context, registries);
  validateRegulatoryStates(regimen.regulatoryStates, context, registries);
  validateAdministration(regimen.administration, `${context}: administration`, false);
  validateRelationships(regimen.relationships, context, registries, dataset);
  validateMetadata(regimen.metadata, context);
}

function validateDataset(
  companies,
  programs,
  regimens,
  context,
  registries,
  options = {},
) {
  assert(Array.isArray(companies), `${context}: companies must be an array`);
  assert(Array.isArray(programs), `${context}: programs must be an array`);
  assert(Array.isArray(regimens), `${context}: regimens must be an array`);

  const companyIds = new Set();
  const programIds = new Set();
  const regimenIds = new Set();
  const assetIdentityById = new Map();
  const programIdentityKeys = new Set();
  const combinationIdentityKeys = new Set();
  const regimensByBaseIdentity = new Map();

  for (const company of companies) {
    validateCompany(company, context);
    assert(!companyIds.has(company.id), `${context}: duplicate company id ${company.id}`);
    companyIds.add(company.id);
  }

  for (const program of programs) {
    const ownerCompanyId = options.companyLocalReferences
      ? program.companyId
      : undefined;
    const dataset = createDatasetContext(companies, programs, ownerCompanyId);
    validateProgram(program, `${context}: ${program.id ?? "unknown-program"}`, registries, dataset);
    assert(!programIds.has(program.id), `${context}: duplicate program id ${program.id}`);
    assert(companyIds.has(program.companyId), `${context}: missing companyId reference ${program.companyId}`);
    programIds.add(program.id);

    const identity = JSON.stringify({
      assetName: program.assetName,
      codeName: program.codeName,
      aliases: getAliasesIdentityKey(program.aliases),
    });
    const assetIdentityKey = `${program.companyId}|${program.assetId}`;
    const priorIdentity = assetIdentityById.get(assetIdentityKey);
    assert(
      priorIdentity === undefined || priorIdentity === identity,
      `${context}: assetId ${program.assetId} is reused with conflicting asset identity`,
    );
    assetIdentityById.set(assetIdentityKey, identity);

    const programIdentityKey = [
      program.companyId,
      program.assetId,
      normalize(program.administration.route),
      normalize(program.administration.dosageForm),
      sortedStrings(program.indications.map(normalize)).join(","),
    ].join("|");
    assert(
      !programIdentityKeys.has(programIdentityKey),
      `${context}: duplicate program identity ${programIdentityKey}`,
    );
    programIdentityKeys.add(programIdentityKey);

    if (combinationAssetTypes.has(program.assetType)) {
      const combinationKey = [
        program.companyId,
        program.assetType,
        getComponentSetKey(program.components),
        normalize(program.administration.route),
        normalize(program.administration.dosageForm),
        sortedStrings(program.indications.map(normalize)).join(","),
      ].join("|");
      assert(
        !combinationIdentityKeys.has(combinationKey),
        `${context}: duplicate combination identity ${combinationKey}`,
      );
      combinationIdentityKeys.add(combinationKey);
    }
  }

  for (const regimen of regimens) {
    const ownerCompanyId = options.companyLocalReferences
      ? regimen.companyId
      : undefined;
    const dataset = createDatasetContext(companies, programs, ownerCompanyId);
    validateRegimen(regimen, `${context}: ${regimen.id ?? "unknown-regimen"}`, registries, dataset);
    assert(!regimenIds.has(regimen.id), `${context}: duplicate regimen id ${regimen.id}`);
    regimenIds.add(regimen.id);

    const baseIdentityKey = getRegimenBaseIdentityKey(regimen);
    const baseRegimens = regimensByBaseIdentity.get(baseIdentityKey) ?? [];
    baseRegimens.push(regimen);
    regimensByBaseIdentity.set(baseIdentityKey, baseRegimens);
  }

  for (const [baseIdentityKey, baseRegimens] of regimensByBaseIdentity.entries()) {
    if (baseRegimens.length === 1) {
      continue;
    }

    const missingConfiguration = baseRegimens.filter(
      (regimen) => regimen.configurationKey === undefined,
    );
    assert(
      missingConfiguration.length === 0 ||
        missingConfiguration.length === baseRegimens.length,
      `${context}: ambiguous regimen identity ${baseIdentityKey}; multiple regimens share the same company, component set, and indications, so every related record must provide configurationKey`,
    );

    const configurationKeys = new Set();
    for (const regimen of baseRegimens) {
      const configurationKey = getNormalizedConfigurationKey(regimen);
      assert(
        !configurationKeys.has(configurationKey),
        `${context}: duplicate regimen identity ${baseIdentityKey}|${configurationKey}`,
      );
      configurationKeys.add(configurationKey);
    }
  }
}

function getCompanySourceFolders(baseDir) {
  if (!existsSync(baseDir)) {
    return [];
  }

  return readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function requireJsonFile(filePath, context) {
  assert(existsSync(filePath), `${context}: missing ${path.basename(filePath)}`);
  return readJson(filePath);
}

function readCompanyFolder(baseDir, folderName, requireRegimens) {
  const folderPath = path.join(baseDir, folderName);
  const regimensPath = path.join(folderPath, "regimens.json");

  return {
    company: requireJsonFile(path.join(folderPath, "company.json"), folderName),
    programs: requireJsonFile(path.join(folderPath, "pipeline-programs.json"), folderName),
    regimens:
      existsSync(regimensPath) || requireRegimens
        ? requireJsonFile(regimensPath, folderName)
        : [],
  };
}

function loadCompanySources() {
  const folders = getCompanySourceFolders(companySourceDir);
  const companies = [];
  const programs = [];
  const regimens = [];

  for (const folder of folders) {
    const {
      company,
      programs: companyPrograms,
      regimens: companyRegimens,
    } = readCompanyFolder(companySourceDir, folder, true);
    companies.push(company);
    programs.push(...companyPrograms);
    regimens.push(...companyRegimens);
  }

  return { folders, companies, programs, regimens };
}

// Index of every name a registry asset is known by (canonical name, development code, and
// typed aliases). A linkedAsset naming one of these resolves internally and must therefore
// carry companyId + assetId rather than free text (ADR-0037).
function createInternalAssetNameIndex(programs) {
  const index = new Map();

  for (const program of programs) {
    const assetKey = `${program.companyId}|${program.assetId}`;
    const names = [
      program.assetName,
      program.codeName,
      ...(program.aliases ?? []).map((alias) => alias.value),
    ];

    for (const name of names) {
      if (!isNonEmptyString(name)) {
        continue;
      }

      const key = normalize(name);
      const assetKeys = index.get(key) ?? new Set();
      assetKeys.add(assetKey);
      index.set(key, assetKeys);
    }
  }

  return index;
}

function createClinicalReferenceContext(companies, programs, regimens) {
  return {
    companyIds: new Set(companies.map((company) => company.id)),
    assetKeys: new Set(
      programs.map((program) => `${program.companyId}|${program.assetId}`),
    ),
    programById: new Map(programs.map((program) => [program.id, program])),
    regimenById: new Map(regimens.map((regimen) => [regimen.id, regimen])),
    internalAssetNames: createInternalAssetNameIndex(programs),
  };
}

function getClinicalEvidenceSourceFiles(baseDir) {
  if (!existsSync(baseDir)) {
    return [];
  }

  const files = [];
  for (const companyFolder of getCompanySourceFolders(baseDir)) {
    const companyPath = path.join(baseDir, companyFolder);
    const assetFolders = getCompanySourceFolders(companyPath);

    for (const assetFolder of assetFolders) {
      const filePath = path.join(companyPath, assetFolder, "clinical-evidence.json");
      if (existsSync(filePath)) {
        files.push({
          filePath,
          companyFolder,
          assetFolder,
          data: readJson(filePath),
        });
      }
    }
  }

  return files;
}

function emptyClinicalEvidenceAggregate() {
  return {
    clinicalEvidenceSchemaVersion,
    studies: [],
    arms: [],
    analysisGroups: [],
    endpoints: [],
    outcomes: [],
  };
}

function sortClinicalEvidenceAggregate(aggregate) {
  aggregate.studies.sort(
    (a, b) =>
      a.companyId.localeCompare(b.companyId) ||
      a.assetId.localeCompare(b.assetId) ||
      a.id.localeCompare(b.id),
  );
  aggregate.arms.sort(
    (a, b) => a.studyId.localeCompare(b.studyId) || a.id.localeCompare(b.id),
  );
  aggregate.analysisGroups.sort(
    (a, b) => a.studyId.localeCompare(b.studyId) || a.id.localeCompare(b.id),
  );
  aggregate.endpoints.sort(
    (a, b) => a.studyId.localeCompare(b.studyId) || a.id.localeCompare(b.id),
  );
  aggregate.outcomes.sort(
    (a, b) =>
      a.studyId.localeCompare(b.studyId) ||
      a.endpointId.localeCompare(b.endpointId) ||
      a.id.localeCompare(b.id),
  );
}

function readClinicalEvidenceSourceTree(baseDir, context) {
  const aggregate = emptyClinicalEvidenceAggregate();
  const files = getClinicalEvidenceSourceFiles(baseDir);

  for (const file of files) {
    const fileContext = `${context}/${file.companyFolder}/${file.assetFolder}/clinical-evidence.json`;
    const data = file.data;
    assert(isObject(data), `${fileContext}: root must be an object`);
    assert(
      data.clinicalEvidenceSchemaVersion === clinicalEvidenceSchemaVersion,
      `${fileContext}: clinicalEvidenceSchemaVersion must be "${clinicalEvidenceSchemaVersion}"; this file is not migrated to the v3.0 Clinical Evidence schema`,
    );
    assert(data.companyId === file.companyFolder, `${fileContext}: companyId must match folder name`);
    assert(data.assetId === file.assetFolder, `${fileContext}: assetId must match folder name`);
    assert(Array.isArray(data.studies), `${fileContext}: studies must be an array`);
    assert(Array.isArray(data.arms), `${fileContext}: arms must be an array`);
    assert(Array.isArray(data.analysisGroups), `${fileContext}: analysisGroups must be an array`);
    assert(Array.isArray(data.endpoints), `${fileContext}: endpoints must be an array`);
    assert(Array.isArray(data.outcomes), `${fileContext}: outcomes must be an array`);

    for (const study of data.studies) {
      assert(study.companyId === data.companyId, `${fileContext}: study ${study.id} companyId must match file companyId`);
      assert(study.assetId === data.assetId, `${fileContext}: study ${study.id} assetId must match file assetId`);
    }

    aggregate.studies.push(...data.studies);
    aggregate.arms.push(...data.arms);
    aggregate.analysisGroups.push(...data.analysisGroups);
    aggregate.endpoints.push(...data.endpoints);
    aggregate.outcomes.push(...data.outcomes);
  }

  sortClinicalEvidenceAggregate(aggregate);
  return aggregate;
}

// Derived projection (ADR-0037): reciprocal asset -> studies discovery computed from the
// canonical internal links only. Never authored, no independent identity, and outside the
// canonical v3.0 contract — it is regenerated deterministically from the aggregate.
function buildClinicalAssetStudyIndex(aggregate) {
  const entries = new Map();

  const entryFor = (companyId, assetId) => {
    const key = `${companyId}|${assetId}`;
    const existing = entries.get(key);
    if (existing) {
      return existing;
    }

    const created = {
      companyId,
      assetId,
      focalStudyIds: new Set(),
      linkedStudyIds: new Set(),
    };
    entries.set(key, created);
    return created;
  };

  for (const study of aggregate.studies) {
    entryFor(study.companyId, study.assetId).focalStudyIds.add(study.id);
  }

  const studyById = new Map(aggregate.studies.map((study) => [study.id, study]));

  for (const arm of aggregate.arms) {
    const linkedAsset = arm.linkedAsset;
    if (!linkedAsset?.assetId || !linkedAsset.companyId) {
      continue;
    }

    const study = studyById.get(arm.studyId);
    if (!study) {
      continue;
    }

    entryFor(linkedAsset.companyId, linkedAsset.assetId).linkedStudyIds.add(study.id);
  }

  return {
    // Independent of clinicalEvidenceSchemaVersion by design: this is a derived
    // projection's own format version, not the canonical contract version (R2b).
    projectionSchemaVersion: clinicalAssetStudyIndexProjectionVersion,
    assets: [...entries.values()]
      .map((entry) => ({
        companyId: entry.companyId,
        assetId: entry.assetId,
        focalStudyIds: sortedStrings(entry.focalStudyIds),
        // A study already anchored to the asset is not re-reported as a linked study; this
        // array is what reciprocal discovery adds beyond the canonical anchor.
        linkedStudyIds: sortedStrings(
          [...entry.linkedStudyIds].filter((studyId) => !entry.focalStudyIds.has(studyId)),
        ),
      }))
      .sort(
        (a, b) =>
          a.companyId.localeCompare(b.companyId) || a.assetId.localeCompare(b.assetId),
      ),
  };
}

function assertOptionalNonEmptyString(value, context) {
  if (value !== undefined) {
    assert(isNonEmptyString(value), `${context} must be non-empty when present`);
  }
}

function assertOptionalPositiveInteger(value, context) {
  if (value !== undefined) {
    assert(Number.isInteger(value) && value >= 0, `${context} must be a non-negative integer`);
  }
}

function validateRegistryIdentifier(identifier, context) {
  assert(isObject(identifier), `${context}: registry identifier must be an object`);
  assert(isNonEmptyString(identifier.registry), `${context}: registry is required`);
  assert(isNonEmptyString(identifier.id), `${context}: id is required`);

  if (identifier.id.startsWith("NCT") || normalize(identifier.registry) === "clinicaltrials.gov") {
    assert(nctPattern.test(identifier.id), `${context}: NCT identifier must match NCT########`);
  }
}

function validateClinicalRegistryStatus(registryStatus, registryIdentifiers, context) {
  assert(isObject(registryStatus), `${context}: registryStatus is required`);
  assert(isNonEmptyString(registryStatus.registry), `${context}: registryStatus.registry is required`);
  assert(isNonEmptyString(registryStatus.registryId), `${context}: registryStatus.registryId is required`);
  assert(
    clinicalRegistryStatuses.has(registryStatus.overallStatus),
    `${context}: registryStatus.overallStatus "${registryStatus.overallStatus}" is not allowed`,
  );
  assert(isNonEmptyString(registryStatus.sourceStatus), `${context}: registryStatus.sourceStatus is required`);
  if (registryStatus.statusUpdatedAt !== undefined) {
    assert(
      isValidPartialDate(registryStatus.statusUpdatedAt),
      `${context}: registryStatus.statusUpdatedAt must be YYYY, YYYY-MM, or YYYY-MM-DD`,
    );
  }
  assert(
    registryIdentifiers.some(
      (identifier) =>
        normalize(identifier.registry) === normalize(registryStatus.registry) &&
        normalize(identifier.id) === normalize(registryStatus.registryId),
    ),
    `${context}: registryStatus registry/id must match one registryIdentifiers entry`,
  );
}

function validateClinicalStudy(study, context, references) {
  assert(isObject(study), `${context}: study must be an object`);
  // These fields are legacy or derived-only and must never be authored in source data:
  // "status" was renamed to registryStatus (ADR-0037/38); resultAvailability and
  // hasReportedOutcomes are computed solely from Outcome existence (ADR-0039) and have
  // no canonical stored form.
  assert(study.status === undefined, `${context}: status is not a valid field; use registryStatus`);
  assert(study.resultAvailability === undefined, `${context}: resultAvailability is not a valid field; it is derived from Outcome existence`);
  assert(study.hasReportedOutcomes === undefined, `${context}: hasReportedOutcomes is not a valid field; it is derived from Outcome existence`);
  assert(isNonEmptyString(study.id), `${context}: id is required`);
  assert(isNonEmptyString(study.companyId), `${context}: companyId is required`);
  assert(isNonEmptyString(study.assetId), `${context}: assetId is required`);
  assert(
    references.companyIds.has(study.companyId),
    `${context}: missing companyId reference ${study.companyId}`,
  );
  assert(
    references.assetKeys.has(`${study.companyId}|${study.assetId}`),
    `${context}: missing asset reference ${study.companyId}/${study.assetId}`,
  );
  assertOptionalNonEmptyString(study.programId, `${context}: programId`);
  assertOptionalNonEmptyString(study.regimenId, `${context}: regimenId`);
  assert(
    (study.programId !== undefined) !== (study.regimenId !== undefined),
    `${context}: exactly one of programId or regimenId is required`,
  );

  if (study.programId !== undefined) {
    const program = references.programById.get(study.programId);
    assert(program, `${context}: missing programId reference ${study.programId}`);
    assert(program.companyId === study.companyId, `${context}: programId ${study.programId} belongs to another company`);
    assert(program.assetId === study.assetId, `${context}: programId ${study.programId} belongs to another asset`);
  }

  if (study.regimenId !== undefined) {
    const regimen = references.regimenById.get(study.regimenId);
    assert(regimen, `${context}: missing regimenId reference ${study.regimenId}`);
    assert(regimen.companyId === study.companyId, `${context}: regimenId ${study.regimenId} belongs to another company`);
    const internalComponentAssetIds = (regimen.components ?? [])
      .filter((component) => isNonEmptyString(component.assetId))
      .map((component) => component.assetId);
    assert(
      internalComponentAssetIds.length > 0,
      `${context}: regimenId ${study.regimenId} has no internal component asset to anchor Clinical Evidence storage`,
    );
    assert(
      internalComponentAssetIds.includes(study.assetId),
      `${context}: assetId ${study.assetId} is not an internal component of regimenId ${study.regimenId}`,
    );
  }

  assert(isNonEmptyString(study.officialTitle), `${context}: officialTitle is required`);
  assertOptionalNonEmptyString(study.acronym, `${context}: acronym`);
  assert(Array.isArray(study.registryIdentifiers), `${context}: registryIdentifiers must be an array`);
  assert(study.registryIdentifiers.length > 0, `${context}: at least one registry identifier is required`);
  for (const [index, identifier] of study.registryIdentifiers.entries()) {
    validateRegistryIdentifier(identifier, `${context}: registryIdentifiers[${index}]`);
  }
  validateStringArray(study.protocolIdentifiers, `${context}: protocolIdentifiers`, false);
  for (const protocolIdentifier of study.protocolIdentifiers ?? []) {
    if (protocolIdentifier.startsWith("NCT")) {
      assert(nctPattern.test(protocolIdentifier), `${context}: NCT protocol identifier must match NCT########`);
    }
  }

  assert(isNonEmptyString(study.phase), `${context}: phase is required`);
  validateClinicalRegistryStatus(study.registryStatus, study.registryIdentifiers, context);
  assert(isObject(study.design), `${context}: design is required`);
  assert(isNonEmptyString(study.design.randomization), `${context}: design.randomization is required`);
  assert(isNonEmptyString(study.design.masking), `${context}: design.masking is required`);
  assert(isNonEmptyString(study.design.comparator), `${context}: design.comparator is required`);
  assertOptionalNonEmptyString(study.design.description, `${context}: design.description`);
  assert(isNonEmptyString(study.population), `${context}: population is required`);
  assertOptionalNonEmptyString(study.overallDuration, `${context}: overallDuration`);
  assertOptionalNonEmptyString(study.followUpDuration, `${context}: followUpDuration`);
  assertOptionalNonEmptyString(study.safetySummary, `${context}: safetySummary`);
  validateMetadata(study.metadata, context);
  assert(study.metadata.sources.length > 0, `${context}: metadata.sources must contain at least one source`);
}

// A comparator or component that resolves to a registry asset must be stored as an internal
// reference (companyId + assetId), including across companies — this is what makes reciprocal
// asset -> studies discovery possible. Free text is reserved for genuinely external or
// unresolved assets (ADR-0037).
function validateClinicalLinkedAsset(linkedAsset, context, references) {
  if (linkedAsset === undefined) {
    return;
  }

  assert(isObject(linkedAsset), `${context}: linkedAsset must be an object`);
  assertOptionalNonEmptyString(linkedAsset.assetId, `${context}: linkedAsset.assetId`);
  assertOptionalNonEmptyString(linkedAsset.assetName, `${context}: linkedAsset.assetName`);
  assertOptionalNonEmptyString(linkedAsset.codeName, `${context}: linkedAsset.codeName`);
  assertOptionalNonEmptyString(linkedAsset.companyId, `${context}: linkedAsset.companyId`);
  assertOptionalNonEmptyString(linkedAsset.externalCompanyName, `${context}: linkedAsset.externalCompanyName`);
  assertOptionalNonEmptyString(linkedAsset.role, `${context}: linkedAsset.role`);
  assert(
    !(linkedAsset.companyId && linkedAsset.externalCompanyName),
    `${context}: linkedAsset companyId and externalCompanyName cannot both be used`,
  );

  if (linkedAsset.companyId !== undefined) {
    assert(
      references.companyIds.has(linkedAsset.companyId),
      `${context}: linkedAsset companyId "${linkedAsset.companyId}" is not a known company`,
    );
  }

  if (linkedAsset.assetId !== undefined) {
    assert(
      isNonEmptyString(linkedAsset.companyId),
      `${context}: linkedAsset assetId requires companyId; an internal asset reference must identify its owning company`,
    );
    assert(
      references.assetKeys.has(`${linkedAsset.companyId}|${linkedAsset.assetId}`),
      `${context}: linkedAsset ${linkedAsset.companyId}/${linkedAsset.assetId} is missing`,
    );
    assert(
      linkedAsset.assetName === undefined && linkedAsset.codeName === undefined,
      `${context}: internal linkedAsset reference must not also provide assetName or codeName`,
    );
    return;
  }

  assert(
    isNonEmptyString(linkedAsset.assetName) || isNonEmptyString(linkedAsset.codeName),
    `${context}: linkedAsset needs assetId or a source-reported assetName or codeName`,
  );

  for (const name of [linkedAsset.assetName, linkedAsset.codeName]) {
    if (!isNonEmptyString(name)) {
      continue;
    }

    const resolved = references.internalAssetNames.get(normalize(name));
    assert(
      resolved === undefined,
      `${context}: linkedAsset "${name}" resolves to the internal registry asset ${sortedStrings(resolved ?? []).join(", ")}; an internally resolvable asset must be linked with companyId + assetId, not free text`,
    );
  }
}

function validateClinicalArm(arm, context, references, requireResultDetails) {
  assert(isObject(arm), `${context}: arm must be an object`);
  assert(isNonEmptyString(arm.id), `${context}: id is required`);
  assert(isNonEmptyString(arm.studyId), `${context}: studyId is required`);
  assert(clinicalArmRoles.has(arm.role), `${context}: role "${arm.role}" is not allowed`);
  assert(isNonEmptyString(arm.label), `${context}: label is required`);
  assert(isNonEmptyString(arm.intervention), `${context}: intervention is required`);
  validateClinicalLinkedAsset(arm.linkedAsset, context, references);
  if (requireResultDetails) {
    assert(isNonEmptyString(arm.dose), `${context}: dose is required for a result-bearing study`);
  } else {
    assertOptionalNonEmptyString(arm.dose, `${context}: dose`);
  }
  assertOptionalNonEmptyString(arm.titration, `${context}: titration`);
  for (const [field, label] of [
    ["route", "route"],
    ["dosingFrequency", "dosingFrequency"],
    ["treatmentDuration", "treatmentDuration"],
  ]) {
    if (requireResultDetails) {
      assert(isNonEmptyString(arm[field]), `${context}: ${label} is required for a result-bearing study`);
    } else {
      assertOptionalNonEmptyString(arm[field], `${context}: ${label}`);
    }
  }
  assertOptionalPositiveInteger(arm.plannedN, `${context}: plannedN`);
  assertOptionalPositiveInteger(arm.analyzedN, `${context}: analyzedN`);
}

// A study-scoped analysis unit that is not a protocol Arm (ADR-0037). Membership is a flat,
// non-empty set of Arms of the same study; groups never nest and are never inferred.
function validateClinicalAnalysisGroup(analysisGroup, context) {
  assert(isObject(analysisGroup), `${context}: analysisGroup must be an object`);
  assert(isNonEmptyString(analysisGroup.id), `${context}: id is required`);
  assert(isNonEmptyString(analysisGroup.studyId), `${context}: studyId is required`);
  assert(
    clinicalAnalysisGroupKinds.has(analysisGroup.kind),
    `${context}: analysisGroup kind "${analysisGroup.kind}" is not allowed`,
  );
  assert(isNonEmptyString(analysisGroup.label), `${context}: label is required`);
  validateStringArray(analysisGroup.memberArmIds, `${context}: memberArmIds`, true);
  assertOptionalNonEmptyString(analysisGroup.description, `${context}: description`);
  assertOptionalPositiveInteger(analysisGroup.analyzedN, `${context}: analyzedN`);
}

function validateClinicalEndpoint(endpoint, context) {
  assert(isObject(endpoint), `${context}: endpoint must be an object`);
  assert(isNonEmptyString(endpoint.id), `${context}: id is required`);
  assert(isNonEmptyString(endpoint.studyId), `${context}: studyId is required`);
  assert(isNonEmptyString(endpoint.name), `${context}: name is required`);
  assert(
    clinicalEndpointRoles.has(endpoint.role),
    `${context}: endpoint role "${endpoint.role}" is not allowed; confirm the prespecified role from the study's cited sources and use "other" when no source confirms it`,
  );
  if (endpoint.domain !== undefined) {
    assert(
      clinicalEndpointDomains.has(endpoint.domain),
      `${context}: endpoint domain "${endpoint.domain}" is not allowed`,
    );
  }
  assertOptionalNonEmptyString(endpoint.classification, `${context}: classification`);
  assert(isNonEmptyString(endpoint.assessmentTimepoint), `${context}: assessmentTimepoint is required`);
}

function validateClinicalOutcomeResult(result, context, isAnalysisGroupAnchored) {
  assert(isObject(result), `${context}: result is required`);
  assert(isNonEmptyString(result.value), `${context}: source-reported result value is required`);
  assert(isNonEmptyString(result.unit), `${context}: source-reported result unit is required`);
  assert(
    !clinicalEffectMeasureUnitPattern.test(normalize(result.unit)),
    `${context}: result.unit "${result.unit}" is an effect measure, not a unit; record it in result.effectMeasure`,
  );
  assert(
    result.numericValue !== undefined,
    `${context}: result.numericValue is required; use null explicitly when the source value is narrative`,
  );
  if (result.numericValue !== null) {
    assert(
      typeof result.numericValue === "number" && Number.isFinite(result.numericValue),
      `${context}: result.numericValue must be a finite number or null when the source value is narrative`,
    );
  }
  assertOptionalNonEmptyString(result.effectMeasure, `${context}: result.effectMeasure`);
  assert(
    clinicalResultTypes.has(result.resultType),
    `${context}: result.resultType "${result.resultType}" is not allowed`,
  );

  if (result.resultType === "between-arm") {
    assert(
      !isAnalysisGroupAnchored,
      `${context}: an analysis-group outcome carries a single-unit result; a comparison between analysis groups is not representable`,
    );
    assert(
      isNonEmptyString(result.comparisonType),
      `${context}: between-arm outcomes require a comparisonType`,
    );
    assert(
      isNonEmptyString(result.effectMeasure),
      `${context}: between-arm outcomes require a result.effectMeasure stating what the number measures`,
    );
  } else {
    assert(
      result.effectMeasure === undefined,
      `${context}: result.effectMeasure applies only to a between-arm comparison`,
    );
    assert(
      result.comparisonType === undefined,
      `${context}: result.comparisonType applies only to a between-arm comparison`,
    );
  }

  assertOptionalNonEmptyString(result.comparisonType, `${context}: result.comparisonType`);
  assertOptionalNonEmptyString(result.confidenceInterval, `${context}: result.confidenceInterval`);
  assertOptionalNonEmptyString(result.pValue, `${context}: result.pValue`);
  assertOptionalNonEmptyString(result.responderThreshold, `${context}: result.responderThreshold`);
}

function validateClinicalOutcome(outcome, context) {
  assert(isObject(outcome), `${context}: outcome must be an object`);
  assert(isNonEmptyString(outcome.id), `${context}: id is required`);
  assert(isNonEmptyString(outcome.studyId), `${context}: studyId is required`);
  assert(isNonEmptyString(outcome.endpointId), `${context}: endpointId is required`);

  const isAnalysisGroupAnchored = outcome.analysisGroupId !== undefined;
  assertOptionalNonEmptyString(outcome.analysisGroupId, `${context}: analysisGroupId`);
  assert(
    isAnalysisGroupAnchored !== (outcome.armIds !== undefined),
    `${context}: an outcome anchors either to armIds or to one analysisGroupId, never both and never neither`,
  );
  if (!isAnalysisGroupAnchored) {
    validateStringArray(outcome.armIds, `${context}: armIds`, true);
  }

  assert(isNonEmptyString(outcome.analysisPopulation), `${context}: analysisPopulation is required`);
  const analysisPopulationWithoutSubgroup = normalize(outcome.analysisPopulation).replace(
    /\s*\([^()]*\)$/,
    "",
  );
  assert(
    !clinicalAnalysisPopulationEstimandLabelPattern.test(analysisPopulationWithoutSubgroup),
    `${context}: analysisPopulation must identify the actual analysis set, not an estimand label`,
  );
  assertOptionalNonEmptyString(outcome.estimand, `${context}: estimand`);

  validateClinicalOutcomeResult(outcome.result, context, isAnalysisGroupAnchored);

  if (!isAnalysisGroupAnchored && outcome.result.resultType === "arm-level") {
    assert(outcome.armIds.length === 1, `${context}: arm-level outcomes require exactly one armId`);
  }
  if (outcome.result.resultType === "between-arm") {
    assert(outcome.armIds.length >= 2, `${context}: between-arm outcomes require at least two armIds`);
  }

  assert(clinicalResultMaturities.has(outcome.maturity), `${context}: maturity "${outcome.maturity}" is not allowed`);
  validateMetadata(outcome.metadata, context);
  assert(outcome.metadata.sources.length > 0, `${context}: metadata.sources must contain at least one source`);
}

// Two outcomes differing only by analysis group, estimand, or analysis population are
// distinct and must never collapse under the Latest-Result Rule. estimand and
// analysisPopulation enter the key canonicalized, so "Treatment-policy estimand" and
// "Treatment policy estimand" are one key rather than two.
function getClinicalOutcomeSemanticKey(outcome) {
  return [
    outcome.studyId,
    outcome.endpointId,
    sortedStrings((outcome.armIds ?? []).map(normalize)).join(","),
    normalize(outcome.analysisGroupId ?? ""),
    canonicalizeClinicalAnalysisPopulation(outcome.analysisPopulation),
    canonicalizeClinicalEstimand(outcome.estimand),
    outcome.result.resultType,
    normalize(outcome.result.comparisonType ?? ""),
  ].join("|");
}

// Content identity for an AnalysisGroup within its study; blocks an obvious duplicate group
// record, mirroring the Arm/Endpoint defensive checks.
function getClinicalAnalysisGroupSemanticKey(analysisGroup) {
  return [
    analysisGroup.studyId,
    normalize(analysisGroup.kind),
    sortedStrings(analysisGroup.memberArmIds.map(normalize)).join(","),
    normalize(analysisGroup.label),
  ].join("|");
}

// Content identity for an Arm within its study. Two Arm records that share this key describe
// the same real-world treatment configuration and would silently split the outcome semantic
// key (getClinicalOutcomeSemanticKey trusts armIds as already-unique). titration and the
// linkedAsset identity are included so genuinely distinct arms are not false-flagged. This is
// a minimal defensive line against obvious duplicates, not complete semantic dedup.
function getClinicalArmSemanticKey(arm) {
  const linkedAsset = arm.linkedAsset ?? {};
  const linkedAssetIdentity = [
    linkedAsset.companyId,
    linkedAsset.assetId,
    linkedAsset.assetName,
    linkedAsset.codeName,
    linkedAsset.externalCompanyName,
    linkedAsset.role,
  ]
    .map((value) => normalize(value ?? ""))
    .join("~");
  return [
    arm.studyId,
    normalize(arm.role),
    normalize(arm.label),
    normalize(arm.intervention),
    normalize(arm.dose ?? ""),
    normalize(arm.titration ?? ""),
    normalize(arm.route ?? ""),
    normalize(arm.dosingFrequency ?? ""),
    normalize(arm.treatmentDuration ?? ""),
    linkedAssetIdentity,
  ].join("|");
}

// Content identity for an Endpoint within its study. assessmentTimepoint is part of the key,
// so the same measure at different timepoints stays distinct (the intended FM-1 modeling)
// while true duplicates under different ids are caught. The key uses the structured role and
// domain, not the legacy free-text classification.
function getClinicalEndpointSemanticKey(endpoint) {
  return [
    endpoint.studyId,
    normalize(endpoint.name),
    normalize(endpoint.role),
    normalize(endpoint.domain ?? ""),
    normalize(endpoint.assessmentTimepoint),
  ].join("|");
}

function validateClinicalEvidenceAggregate(aggregate, references, context) {
  assert(isObject(aggregate), `${context}: aggregate must be an object`);
  assert(
    aggregate.clinicalEvidenceSchemaVersion === clinicalEvidenceSchemaVersion,
    `${context}: clinicalEvidenceSchemaVersion must be "${clinicalEvidenceSchemaVersion}"`,
  );
  assert(Array.isArray(aggregate.studies), `${context}: studies must be an array`);
  assert(Array.isArray(aggregate.arms), `${context}: arms must be an array`);
  assert(Array.isArray(aggregate.analysisGroups), `${context}: analysisGroups must be an array`);
  assert(Array.isArray(aggregate.endpoints), `${context}: endpoints must be an array`);
  assert(Array.isArray(aggregate.outcomes), `${context}: outcomes must be an array`);

  const studyIds = new Set();
  const armIds = new Set();
  const analysisGroupIds = new Set();
  const endpointIds = new Set();
  const outcomeIds = new Set();
  const registryIdentities = new Map();
  const armsByStudy = new Map();
  const endpointsByStudy = new Map();
  const outcomesByStudy = new Map();
  const outcomesByEndpoint = new Map();
  const outcomesByAnalysisGroup = new Map();
  const semanticOutcomeKeys = new Set();
  const armSemanticKeys = new Set();
  const analysisGroupSemanticKeys = new Set();
  const endpointSemanticKeys = new Set();
  const resultBearingStudyIds = new Set(
    aggregate.outcomes.map((outcome) => outcome.studyId),
  );

  for (const study of aggregate.studies) {
    validateClinicalStudy(study, `${context}: study ${study.id ?? "unknown-study"}`, references);
    assert(!studyIds.has(study.id), `${context}: duplicate study id ${study.id}`);
    studyIds.add(study.id);

    for (const identifier of study.registryIdentifiers) {
      const identity = `${normalize(identifier.registry)}|${normalize(identifier.id)}`;
      const existingStudyId = registryIdentities.get(identity);
      assert(
        existingStudyId === undefined,
        `${context}: duplicate study registry identity ${identifier.registry}/${identifier.id} in ${existingStudyId} and ${study.id}`,
      );
      registryIdentities.set(identity, study.id);
    }
  }

  for (const arm of aggregate.arms) {
    validateClinicalArm(
      arm,
      `${context}: arm ${arm.id ?? "unknown-arm"}`,
      references,
      resultBearingStudyIds.has(arm.studyId),
    );
    assert(!armIds.has(arm.id), `${context}: duplicate arm id ${arm.id}`);
    assert(studyIds.has(arm.studyId), `${context}: arm ${arm.id} references missing study ${arm.studyId}`);
    const armSemanticKey = getClinicalArmSemanticKey(arm);
    assert(!armSemanticKeys.has(armSemanticKey), `${context}: duplicate arm semantics ${armSemanticKey}`);
    armSemanticKeys.add(armSemanticKey);
    armIds.add(arm.id);
    const studyArms = armsByStudy.get(arm.studyId) ?? [];
    studyArms.push(arm);
    armsByStudy.set(arm.studyId, studyArms);
  }

  const armById = new Map(aggregate.arms.map((arm) => [arm.id, arm]));

  for (const analysisGroup of aggregate.analysisGroups) {
    const groupContext = `${context}: analysisGroup ${analysisGroup.id ?? "unknown-analysis-group"}`;
    validateClinicalAnalysisGroup(analysisGroup, groupContext);
    assert(
      !analysisGroupIds.has(analysisGroup.id),
      `${context}: duplicate analysis group id ${analysisGroup.id}`,
    );
    assert(
      !armIds.has(analysisGroup.id),
      `${context}: analysis group id ${analysisGroup.id} collides with an arm id`,
    );
    assert(
      studyIds.has(analysisGroup.studyId),
      `${context}: analysis group ${analysisGroup.id} references missing study ${analysisGroup.studyId}`,
    );

    const seenMemberArmIds = new Set();
    for (const memberArmId of analysisGroup.memberArmIds) {
      assert(
        !seenMemberArmIds.has(memberArmId),
        `${context}: analysis group ${analysisGroup.id} repeats member arm ${memberArmId}`,
      );
      seenMemberArmIds.add(memberArmId);
      // Membership is flat: a member must resolve to a protocol Arm, and arm ids and group
      // ids are disjoint, so a group can never contain another group.
      const memberArm = armById.get(memberArmId);
      assert(
        memberArm,
        `${context}: analysis group ${analysisGroup.id} references missing arm ${memberArmId}`,
      );
      assert(
        memberArm.studyId === analysisGroup.studyId,
        `${context}: analysis group ${analysisGroup.id} member arm ${memberArmId} belongs to another study`,
      );
    }

    const analysisGroupSemanticKey = getClinicalAnalysisGroupSemanticKey(analysisGroup);
    assert(
      !analysisGroupSemanticKeys.has(analysisGroupSemanticKey),
      `${context}: duplicate analysis group semantics ${analysisGroupSemanticKey}`,
    );
    analysisGroupSemanticKeys.add(analysisGroupSemanticKey);
    analysisGroupIds.add(analysisGroup.id);
  }

  for (const endpoint of aggregate.endpoints) {
    validateClinicalEndpoint(endpoint, `${context}: endpoint ${endpoint.id ?? "unknown-endpoint"}`);
    assert(!endpointIds.has(endpoint.id), `${context}: duplicate endpoint id ${endpoint.id}`);
    assert(studyIds.has(endpoint.studyId), `${context}: endpoint ${endpoint.id} references missing study ${endpoint.studyId}`);
    const endpointSemanticKey = getClinicalEndpointSemanticKey(endpoint);
    assert(
      !endpointSemanticKeys.has(endpointSemanticKey),
      `${context}: duplicate endpoint semantics ${endpointSemanticKey}`,
    );
    endpointSemanticKeys.add(endpointSemanticKey);
    endpointIds.add(endpoint.id);
    const studyEndpoints = endpointsByStudy.get(endpoint.studyId) ?? [];
    studyEndpoints.push(endpoint);
    endpointsByStudy.set(endpoint.studyId, studyEndpoints);
  }

  const endpointById = new Map(aggregate.endpoints.map((endpoint) => [endpoint.id, endpoint]));
  const analysisGroupById = new Map(
    aggregate.analysisGroups.map((analysisGroup) => [analysisGroup.id, analysisGroup]),
  );

  for (const outcome of aggregate.outcomes) {
    validateClinicalOutcome(outcome, `${context}: outcome ${outcome.id ?? "unknown-outcome"}`);
    assert(!outcomeIds.has(outcome.id), `${context}: duplicate outcome id ${outcome.id}`);
    assert(studyIds.has(outcome.studyId), `${context}: outcome ${outcome.id} references missing study ${outcome.studyId}`);
    const endpoint = endpointById.get(outcome.endpointId);
    assert(endpoint, `${context}: outcome ${outcome.id} references missing endpoint ${outcome.endpointId}`);
    assert(endpoint.studyId === outcome.studyId, `${context}: outcome ${outcome.id} endpoint belongs to another study`);

    const seenArmIds = new Set();
    for (const armId of outcome.armIds ?? []) {
      assert(!seenArmIds.has(armId), `${context}: outcome ${outcome.id} repeats arm ${armId}`);
      seenArmIds.add(armId);
      const arm = armById.get(armId);
      assert(arm, `${context}: outcome ${outcome.id} references missing arm ${armId}`);
      assert(arm.studyId === outcome.studyId, `${context}: outcome ${outcome.id} arm ${armId} belongs to another study`);
    }

    if (outcome.analysisGroupId !== undefined) {
      const analysisGroup = analysisGroupById.get(outcome.analysisGroupId);
      assert(
        analysisGroup,
        `${context}: outcome ${outcome.id} references missing analysis group ${outcome.analysisGroupId}`,
      );
      assert(
        analysisGroup.studyId === outcome.studyId,
        `${context}: outcome ${outcome.id} analysis group ${outcome.analysisGroupId} belongs to another study`,
      );
      const groupOutcomes = outcomesByAnalysisGroup.get(outcome.analysisGroupId) ?? [];
      groupOutcomes.push(outcome);
      outcomesByAnalysisGroup.set(outcome.analysisGroupId, groupOutcomes);
    }

    const semanticKey = getClinicalOutcomeSemanticKey(outcome);
    assert(
      !semanticOutcomeKeys.has(semanticKey),
      `${context}: duplicate semantic outcome ${semanticKey} — if only the timepoint differs, model it as a distinct Endpoint record (assessmentTimepoint and maturity are excluded from the semantic key)`,
    );
    semanticOutcomeKeys.add(semanticKey);
    outcomeIds.add(outcome.id);

    const studyOutcomes = outcomesByStudy.get(outcome.studyId) ?? [];
    studyOutcomes.push(outcome);
    outcomesByStudy.set(outcome.studyId, studyOutcomes);
    const endpointOutcomes = outcomesByEndpoint.get(outcome.endpointId) ?? [];
    endpointOutcomes.push(outcome);
    outcomesByEndpoint.set(outcome.endpointId, endpointOutcomes);
  }

  for (const studyId of studyIds) {
    assert((armsByStudy.get(studyId) ?? []).length > 0, `${context}: study ${studyId} has no arms`);
    const outcomeCount = (outcomesByStudy.get(studyId) ?? []).length;
    const endpointCount = (endpointsByStudy.get(studyId) ?? []).length;
    const analysisGroupCount = aggregate.analysisGroups.filter(
      (analysisGroup) => analysisGroup.studyId === studyId,
    ).length;
    if (outcomeCount === 0) {
      assert(endpointCount === 0, `${context}: inventory study ${studyId} has endpoints but no outcomes`);
      assert(
        analysisGroupCount === 0,
        `${context}: inventory study ${studyId} has analysis groups but no outcomes`,
      );
    } else {
      assert(endpointCount > 0, `${context}: result-bearing study ${studyId} has no endpoints`);
    }
  }

  for (const endpointId of endpointIds) {
    assert((outcomesByEndpoint.get(endpointId) ?? []).length > 0, `${context}: endpoint ${endpointId} has no outcome`);
  }

  // Analysis groups are not stored speculatively: a group exists because a source reports a
  // result for it.
  for (const analysisGroupId of analysisGroupIds) {
    assert(
      (outcomesByAnalysisGroup.get(analysisGroupId) ?? []).length > 0,
      `${context}: analysis group ${analysisGroupId} has no outcome`,
    );
  }
}

function buildClinicalEvidenceAggregate(baseDir, references, context) {
  const aggregate = readClinicalEvidenceSourceTree(baseDir, context);
  validateClinicalEvidenceAggregate(aggregate, references, context);
  return aggregate;
}

function validateCompanySources() {
  const registries = loadRegistries();
  const { folders } = loadCompanySources();

  for (const folder of folders) {
    const { company, programs, regimens } = readCompanyFolder(companySourceDir, folder, true);
    validateDataset([company], programs, regimens, `data/companies/${folder}`, registries, {
      companyLocalReferences: true,
    });
  }

  console.log(`Validated ${folders.length} company source folder(s).`);
}

function generateAggregates() {
  const registries = loadRegistries();
  const { folders, companies, programs, regimens } = loadCompanySources();

  for (const folder of folders) {
    const { company, programs: companyPrograms, regimens: companyRegimens } =
      readCompanyFolder(companySourceDir, folder, true);
    validateDataset([company], companyPrograms, companyRegimens, `data/companies/${folder}`, registries, {
      companyLocalReferences: true,
    });
  }

  validateDataset(companies, programs, regimens, "generated aggregate", registries, {
    companyLocalReferences: true,
  });
  const clinicalEvidence = buildClinicalEvidenceAggregate(
    clinicalEvidenceSourceDir,
    createClinicalReferenceContext(companies, programs, regimens),
    "data/clinical-evidence",
  );
  companies.sort((a, b) => a.id.localeCompare(b.id));
  programs.sort((a, b) => a.companyId.localeCompare(b.companyId) || a.id.localeCompare(b.id));
  regimens.sort((a, b) => a.companyId.localeCompare(b.companyId) || a.id.localeCompare(b.id));

  const clinicalAssetStudyIndex = buildClinicalAssetStudyIndex(clinicalEvidence);

  mkdirSync(generatedDir, { recursive: true });
  writeJson(path.join(generatedDir, "companies.json"), companies);
  writeJson(path.join(generatedDir, "pipeline-programs.json"), programs);
  writeJson(path.join(generatedDir, "regimens.json"), regimens);
  writeJson(path.join(generatedDir, "clinical-evidence.json"), clinicalEvidence);
  writeJson(
    path.join(generatedDir, "clinical-evidence-asset-studies.json"),
    clinicalAssetStudyIndex,
  );
  console.log(
    `Generated ${companies.length} company record(s), ${programs.length} program record(s), ${regimens.length} regimen record(s), ${clinicalEvidence.studies.length} clinical study record(s), ${clinicalEvidence.analysisGroups.length} clinical analysis group(s), and a reciprocal asset index over ${clinicalAssetStudyIndex.assets.length} asset(s).`,
  );
}

function validateGenerated() {
  const registries = loadRegistries();
  const companies = readJson(path.join(generatedDir, "companies.json"));
  const programs = readJson(path.join(generatedDir, "pipeline-programs.json"));
  const regimens = readJson(path.join(generatedDir, "regimens.json"));
  const clinicalEvidence = readJson(path.join(generatedDir, "clinical-evidence.json"));

  validateDataset(companies, programs, regimens, "data/generated", registries, {
    companyLocalReferences: true,
  });
  validateClinicalEvidenceAggregate(
    clinicalEvidence,
    createClinicalReferenceContext(companies, programs, regimens),
    "data/generated/clinical-evidence.json",
  );
  assertClinicalAssetStudyIndexMatches(clinicalEvidence);
  console.log(
    `Validated generated aggregate with ${companies.length} company record(s), ${programs.length} program record(s), ${regimens.length} regimen record(s), and ${clinicalEvidence.studies.length} clinical study record(s).`,
  );
}

// The reciprocal asset index is a derived projection: it must always equal a deterministic
// recomputation from the canonical aggregate, never a hand-edited artifact.
function assertClinicalAssetStudyIndexMatches(clinicalEvidence) {
  const indexPath = path.join(generatedDir, "clinical-evidence-asset-studies.json");
  assert(
    existsSync(indexPath),
    "data/generated/clinical-evidence-asset-studies.json is missing; run npm run data:generate",
  );
  assert(
    JSON.stringify(readJson(indexPath)) ===
      JSON.stringify(buildClinicalAssetStudyIndex(clinicalEvidence)),
    "data/generated/clinical-evidence-asset-studies.json differs from deterministic regeneration",
  );
}

function validateClinicalEvidenceSources() {
  const registries = loadRegistries();
  const { companies, programs, regimens } = loadCompanySources();
  validateDataset(companies, programs, regimens, "clinical-evidence references", registries, {
    companyLocalReferences: true,
  });
  const aggregate = buildClinicalEvidenceAggregate(
    clinicalEvidenceSourceDir,
    createClinicalReferenceContext(companies, programs, regimens),
    "data/clinical-evidence",
  );
  console.log(
    `Validated Clinical Evidence source data with ${aggregate.studies.length} study record(s).`,
  );
}

function validateClinicalEvidenceGenerated() {
  const registries = loadRegistries();
  const { companies, programs, regimens } = loadCompanySources();
  validateDataset(companies, programs, regimens, "clinical-evidence references", registries, {
    companyLocalReferences: true,
  });
  const references = createClinicalReferenceContext(companies, programs, regimens);
  const expected = buildClinicalEvidenceAggregate(
    clinicalEvidenceSourceDir,
    references,
    "data/clinical-evidence",
  );
  const actual = readJson(path.join(generatedDir, "clinical-evidence.json"));
  validateClinicalEvidenceAggregate(actual, references, "data/generated/clinical-evidence.json");
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    "data/generated/clinical-evidence.json differs from deterministic regeneration",
  );
  assertClinicalAssetStudyIndexMatches(actual);
  console.log(
    `Validated generated Clinical Evidence aggregate with ${actual.studies.length} study record(s), ${actual.analysisGroups.length} analysis group(s), and the derived reciprocal asset index.`,
  );
}

function readFixtureReferenceDataset(baseDir, context) {
  const registries = loadRegistries();
  const localCompaniesDir = path.join(baseDir, "companies");
  const companiesDir = existsSync(localCompaniesDir)
    ? localCompaniesDir
    : path.join(clinicalEvidenceFixtureDir, "references", "companies");
  const folders = getCompanySourceFolders(companiesDir);
  const companies = [];
  const programs = [];
  const regimens = [];

  for (const folder of folders) {
    const {
      company,
      programs: companyPrograms,
      regimens: companyRegimens,
    } = readCompanyFolder(companiesDir, folder, true);
    companies.push(company);
    programs.push(...companyPrograms);
    regimens.push(...companyRegimens);
  }

  validateDataset(companies, programs, regimens, context, registries, {
    companyLocalReferences: true,
  });

  return { companies, programs, regimens };
}

function validateClinicalEvidenceSyntheticFixtures() {
  const validDir = path.join(clinicalEvidenceFixtureDir, "valid");
  const validRefs = readFixtureReferenceDataset(validDir, "data/validation-fixtures/clinical-evidence/valid");
  const validReferences = createClinicalReferenceContext(
    validRefs.companies,
    validRefs.programs,
    validRefs.regimens,
  );
  const validAggregate = buildClinicalEvidenceAggregate(
    path.join(validDir, "clinical-evidence"),
    validReferences,
    "data/validation-fixtures/clinical-evidence/valid/clinical-evidence",
  );
  assert(validAggregate.studies.length > 0, "clinical evidence valid fixture must contain at least one study");

  assert(
    validAggregate.analysisGroups.length > 0,
    "clinical evidence valid fixture must contain at least one analysis group",
  );

  const validAnalysisPopulationProbe = cloneJson(validAggregate.outcomes[0]);
  validAnalysisPopulationProbe.analysisPopulation = "Full analysis set (overall)";
  validateClinicalOutcome(
    validAnalysisPopulationProbe,
    "data/validation-fixtures/clinical-evidence/synthetic-valid/analysis-population-with-subgroup",
  );

  const analysisGroupOutcome = validAggregate.outcomes.find(
    (outcome) => outcome.analysisGroupId !== undefined,
  );
  assert(
    analysisGroupOutcome !== undefined,
    "clinical evidence valid fixture must contain an analysis-group-anchored outcome",
  );

  // Mutations that must still validate: a distinct analysis unit or a source-supported
  // subgroup is a distinct outcome, not a duplicate.
  const validExpectations = [
    // Two outcomes that differ only by analysis group are distinct results, never one
    // semantic outcome that the Latest-Result Rule may collapse.
    ["distinct-analysis-groups-stay-distinct", (fixture) => {
      fixture.analysisGroups.push({
        ...cloneJson(fixture.analysisGroups[0]),
        id: "fixture-group-pooled-titration",
        label: "Pooled fixture asset titrated group",
        memberArmIds: ["fixture-arm-dr-10mg-titrated", "fixture-arm-dr-background"],
      });
      const twin = cloneJson(analysisGroupOutcome);
      twin.id = "fixture-outcome-dr-pooled-titration";
      twin.analysisGroupId = "fixture-group-pooled-titration";
      fixture.outcomes.push(twin);
    }],
    ["analysis-population-subgroup-stays-distinct", (fixture) => {
      const subgroup = cloneJson(analysisGroupOutcome);
      subgroup.id = "fixture-outcome-analysis-group-subgroup";
      subgroup.analysisPopulation = "Modified intention-to-treat (baseline type 2 diabetes subgroup)";
      fixture.outcomes.push(subgroup);
    }],
    // A narrative source value (no machine-readable number) is valid only with an
    // explicit numericValue: null — never an omitted field.
    ["narrative-result-explicit-null-numeric-value", (fixture) => {
      const narrative = cloneJson(fixture.outcomes[0]);
      narrative.id = "fixture-outcome-narrative-result";
      narrative.analysisPopulation = "Modified intention-to-treat (narrative probe)";
      narrative.result.value = "Not estimable";
      narrative.result.numericValue = null;
      fixture.outcomes.push(narrative);
    }],
    ["program-linked-inventory-study", (fixture) => {
      fixture.studies.push({
        ...cloneJson(fixture.studies[0]),
        id: "fixture-study-program-inventory",
        officialTitle: "Synthetic Program-linked Inventory Study",
        registryIdentifiers: [{ registry: "ClinicalTrials.gov", id: "NCT30000001" }],
        registryStatus: {
          registry: "ClinicalTrials.gov",
          registryId: "NCT30000001",
          overallStatus: "recruiting",
          sourceStatus: "Recruiting",
          statusUpdatedAt: "2026-07-12",
        },
      });
      fixture.arms.push({
        id: "fixture-arm-program-inventory",
        studyId: "fixture-study-program-inventory",
        role: "experimental",
        label: "Fixture Asset",
        intervention: "Fixture Asset",
        plannedN: 24,
      });
    }],
    ["regimen-linked-inventory-study", (fixture) => {
      const study = {
        ...cloneJson(fixture.studies[0]),
        id: "fixture-study-regimen-inventory",
        officialTitle: "Synthetic Regimen-linked Inventory Study",
        registryIdentifiers: [{ registry: "ClinicalTrials.gov", id: "NCT30000002" }],
        registryStatus: {
          registry: "ClinicalTrials.gov",
          registryId: "NCT30000002",
          overallStatus: "not-yet-recruiting",
          sourceStatus: "Not yet recruiting",
        },
        regimenId: "fixture-co-fixture-asset-partner-combination",
      };
      delete study.programId;
      fixture.studies.push(study);
      fixture.arms.push({
        id: "fixture-arm-regimen-inventory",
        studyId: "fixture-study-regimen-inventory",
        role: "experimental",
        label: "Fixture combination regimen",
        intervention: "Fixture Asset plus Partner X",
      });
    }],
    // The reference registry (registryStatus) is not required to be the first entry in
    // registryIdentifiers; selectors must key off registryStatus.registryId, never position.
    ["reference-registry-not-first-identifier", (fixture) => {
      fixture.studies.push({
        ...cloneJson(fixture.studies[0]),
        id: "fixture-study-reference-registry-second",
        registryIdentifiers: [
          { registry: "Chinese Clinical Trial Registry", id: "ChiCTR3000000001" },
          { registry: "ClinicalTrials.gov", id: "NCT30000005" },
        ],
        registryStatus: {
          registry: "ClinicalTrials.gov",
          registryId: "NCT30000005",
          overallStatus: "recruiting",
          sourceStatus: "Recruiting",
        },
      });
      fixture.arms.push({
        ...cloneJson(fixture.arms[0]),
        id: "fixture-arm-reference-registry-second",
        studyId: "fixture-study-reference-registry-second",
      });
    }],
  ];

  for (const [name, mutate] of validExpectations) {
    const fixture = cloneJson(validAggregate);
    mutate(fixture);
    validateClinicalEvidenceAggregate(
      fixture,
      validReferences,
      `data/validation-fixtures/clinical-evidence/synthetic-valid/${name}`,
    );
  }

  const secondStudy = {
    ...cloneJson(validAggregate.studies[0]),
    id: "fixture-study-2",
    registryIdentifiers: [{ registry: "ClinicalTrials.gov", id: "NCT12345679" }],
    registryStatus: {
      registry: "ClinicalTrials.gov",
      registryId: "NCT12345679",
      overallStatus: "completed",
      sourceStatus: "Completed",
    },
  };
  const secondArm = {
    ...cloneJson(validAggregate.arms[0]),
    id: "fixture-arm-other-study",
    studyId: "fixture-study-2",
  };
  const secondEndpoint = {
    ...cloneJson(validAggregate.endpoints[0]),
    id: "fixture-endpoint-other-study",
    studyId: "fixture-study-2",
  };

  const invalidExpectations = [
    ["bad-nct", /NCT identifier must match/, (fixture) => {
      fixture.studies[0].registryIdentifiers[0].id = "NCT123";
    }],
    ["cross-study-arm", /belongs to another study/, (fixture) => {
      fixture.studies.push(secondStudy);
      fixture.arms.push(secondArm);
      fixture.outcomes[0].armIds.push(secondArm.id);
    }],
    ["cross-study-endpoint", /endpoint belongs to another study/, (fixture) => {
      fixture.studies.push(secondStudy);
      fixture.endpoints.push(secondEndpoint);
      fixture.outcomes[0].endpointId = secondEndpoint.id;
    }],
    ["duplicate-registry-identity", /duplicate study registry identity/, (fixture) => {
      fixture.studies.push({
        ...cloneJson(fixture.studies[0]),
        id: "fixture-study-duplicate-registry",
      });
    }],
    ["duplicate-semantic-outcome", /duplicate semantic outcome/, (fixture) => {
      fixture.outcomes.push({
        ...cloneJson(fixture.outcomes[0]),
        id: "fixture-outcome-duplicate-semantic",
      });
    }],
    ["duplicate-semantic-outcome-reordered-arms", /duplicate semantic outcome/, (fixture) => {
      fixture.outcomes.push({
        ...cloneJson(fixture.outcomes[0]),
        id: "fixture-outcome-duplicate-semantic-reordered-arms",
        armIds: [...fixture.outcomes[0].armIds].reverse(),
      });
    }],
    ["endpoint-without-outcome", /has no outcome/, (fixture) => {
      fixture.endpoints.push({
        ...cloneJson(fixture.endpoints[0]),
        id: "fixture-endpoint-without-outcome",
        name: "Percent change in body weight (secondary timepoint)",
        assessmentTimepoint: "Week 52",
      });
    }],
    ["missing-arm-route", /route is required/, (fixture) => {
      fixture.arms[0].route = "";
    }],
    ["missing-arm-frequency", /dosingFrequency is required/, (fixture) => {
      fixture.arms[0].dosingFrequency = "";
    }],
    ["missing-arm-duration", /treatmentDuration is required/, (fixture) => {
      fixture.arms[0].treatmentDuration = "";
    }],
    ["missing-result", /source-reported result value is required/, (fixture) => {
      fixture.outcomes[0].result.value = "";
    }],
    ["analysis-population-is-estimand-label", /actual analysis set, not an estimand label/, (fixture) => {
      fixture.outcomes[0].analysisPopulation = "Treatment-regimen estimand population";
    }],
    ["analysis-population-is-estimand-population-with-overall", /actual analysis set, not an estimand label/, (fixture) => {
      fixture.outcomes[0].analysisPopulation = "Treatment-regimen estimand population (overall)";
    }],
    ["analysis-population-is-efficacy-estimand-population", /actual analysis set, not an estimand label/, (fixture) => {
      fixture.outcomes[0].analysisPopulation = "Efficacy estimand population (overall)";
    }],
    ["analysis-population-is-estimand-with-subgroup", /actual analysis set, not an estimand label/, (fixture) => {
      fixture.outcomes[0].analysisPopulation = "Efficacy estimand (baseline type 2 diabetes subgroup)";
    }],
    ["study-without-source", /metadata\.sources must contain at least one source/, (fixture) => {
      fixture.studies[0].metadata.sources = [];
    }],
    ["outcome-without-source", /metadata\.sources must contain at least one source/, (fixture) => {
      fixture.outcomes[0].metadata.sources = [];
    }],
    ["arm-level-multiple-arms", /arm-level outcomes require exactly one armId/, (fixture) => {
      fixture.outcomes[0].result.resultType = "arm-level";
      delete fixture.outcomes[0].result.effectMeasure;
      delete fixture.outcomes[0].result.comparisonType;
    }],
    ["between-arm-single-arm", /between-arm outcomes require at least two armIds/, (fixture) => {
      fixture.outcomes[0].armIds = [fixture.outcomes[0].armIds[0]];
    }],
    ["between-arm-without-comparison", /between-arm outcomes require a comparisonType/, (fixture) => {
      delete fixture.outcomes[0].result.comparisonType;
    }],
    ["duplicate-arm-semantics", /duplicate arm semantics/, (fixture) => {
      fixture.arms.push({
        ...cloneJson(fixture.arms[0]),
        id: "fixture-arm-semantic-duplicate",
      });
    }],
    ["duplicate-endpoint-semantics", /duplicate endpoint semantics/, (fixture) => {
      fixture.endpoints.push({
        ...cloneJson(fixture.endpoints[0]),
        id: "fixture-endpoint-semantic-duplicate",
      });
    }],
    ["study-without-arm", /has no arms/, (fixture) => {
      fixture.studies.push(secondStudy);
    }],
    ["stale-schema-version", /clinicalEvidenceSchemaVersion must be "3\.0"/, (fixture) => {
      fixture.clinicalEvidenceSchemaVersion = "1.0";
    }],
    ["study-without-focal-mapping", /exactly one of programId or regimenId is required/, (fixture) => {
      delete fixture.studies[0].programId;
    }],
    ["study-with-both-focal-mappings", /exactly one of programId or regimenId is required/, (fixture) => {
      fixture.studies[0].regimenId = "fixture-co-fixture-asset-partner-combination";
    }],
    ["regimen-linked-study-unrelated-asset", /is not an internal component of regimenId/, (fixture) => {
      const study = {
        ...cloneJson(fixture.studies[0]),
        id: "fixture-study-regimen-unrelated-asset",
        assetId: "fixture-asset-2",
        registryIdentifiers: [{ registry: "ClinicalTrials.gov", id: "NCT30000003" }],
        registryStatus: {
          registry: "ClinicalTrials.gov",
          registryId: "NCT30000003",
          overallStatus: "recruiting",
          sourceStatus: "Recruiting",
        },
        regimenId: "fixture-co-fixture-asset-partner-combination",
      };
      delete study.programId;
      fixture.studies.push(study);
      fixture.arms.push({
        id: "fixture-arm-regimen-unrelated-asset",
        studyId: study.id,
        role: "experimental",
        label: "Fixture Asset 2",
        intervention: "Fixture Asset 2",
      });
    }],
    ["regimen-linked-study-no-internal-anchor", /has no internal component asset to anchor Clinical Evidence storage/, (fixture) => {
      const study = {
        ...cloneJson(fixture.studies[0]),
        id: "fixture-study-regimen-no-internal-anchor",
        registryIdentifiers: [{ registry: "ClinicalTrials.gov", id: "NCT30000004" }],
        registryStatus: {
          registry: "ClinicalTrials.gov",
          registryId: "NCT30000004",
          overallStatus: "recruiting",
          sourceStatus: "Recruiting",
        },
        regimenId: "fixture-co-external-only-combination",
      };
      delete study.programId;
      fixture.studies.push(study);
      fixture.arms.push({
        id: "fixture-arm-regimen-no-internal-anchor",
        studyId: study.id,
        role: "experimental",
        label: "Fixture Asset",
        intervention: "Fixture Asset",
      });
    }],
    ["study-with-legacy-status-field", /status is not a valid field/, (fixture) => {
      fixture.studies[0].status = "Recruiting";
    }],
    ["study-with-result-availability-field", /resultAvailability is not a valid field/, (fixture) => {
      fixture.studies[0].resultAvailability = "reported";
    }],
    ["study-with-has-reported-outcomes-field", /hasReportedOutcomes is not a valid field/, (fixture) => {
      fixture.studies[0].hasReportedOutcomes = true;
    }],
    ["registry-status-unknown-enum", /registryStatus\.overallStatus .* is not allowed/, (fixture) => {
      fixture.studies[0].registryStatus.overallStatus = "planning";
    }],
    ["registry-status-identifier-mismatch", /registryStatus registry\/id must match/, (fixture) => {
      fixture.studies[0].registryStatus.registryId = "NCT99999999";
    }],
    ["registry-status-empty-source-status", /registryStatus\.sourceStatus is required/, (fixture) => {
      fixture.studies[0].registryStatus.sourceStatus = "";
    }],
    ["registry-status-invalid-updated-date", /registryStatus\.statusUpdatedAt must be/, (fixture) => {
      fixture.studies[0].registryStatus.statusUpdatedAt = "2026/07/14";
    }],
    ["inventory-study-with-endpoint", /inventory study .* has endpoints but no outcomes/, (fixture) => {
      fixture.studies.push(secondStudy);
      fixture.arms.push(secondArm);
      fixture.endpoints.push(secondEndpoint);
    }],
    // Estimand and analysis-population canonicalization (G12/G26): a casing/hyphen variant of
    // the same term is the same semantic outcome, not a second one.
    ["estimand-hyphen-variant-duplicate", /duplicate semantic outcome/, (fixture) => {
      fixture.outcomes.push({
        ...cloneJson(fixture.outcomes[0]),
        id: "fixture-outcome-estimand-hyphen-variant",
        estimand: "Treatment-policy estimand",
      });
      fixture.outcomes[0].estimand = "Treatment policy";
    }],
    ["analysis-set-alias-duplicate", /duplicate semantic outcome/, (fixture) => {
      fixture.outcomes.push({
        ...cloneJson(fixture.outcomes[0]),
        id: "fixture-outcome-analysis-set-alias",
        analysisPopulation: "mITT (overall)",
      });
      fixture.outcomes[0].analysisPopulation = "Modified intention-to-treat (overall)";
    }],
    // Internal linked-asset resolution (G8).
    ["linked-asset-internal-name-as-free-text", /resolves to the internal registry asset/, (fixture) => {
      fixture.arms[0].linkedAsset = {
        assetName: "Fixture Asset",
        externalCompanyName: "Fixture Co",
      };
    }],
    ["linked-asset-id-without-company", /linkedAsset assetId requires companyId/, (fixture) => {
      fixture.arms[0].linkedAsset = { assetId: "fixture-asset" };
    }],
    ["linked-asset-mixed-company-identity", /companyId and externalCompanyName cannot both be used/, (fixture) => {
      fixture.arms[0].linkedAsset = {
        companyId: "fixture-co",
        externalCompanyName: "Other Company",
        assetName: "Partner X",
      };
    }],
    // Structured result semantics (G19).
    ["missing-numeric-value", /result\.numericValue is required/, (fixture) => {
      delete fixture.outcomes[0].result.numericValue;
    }],
    ["effect-measure-as-unit", /is an effect measure, not a unit/, (fixture) => {
      fixture.outcomes[0].result.unit = "hazard ratio";
    }],
    ["between-arm-without-effect-measure", /require a result\.effectMeasure/, (fixture) => {
      delete fixture.outcomes[0].result.effectMeasure;
    }],
    ["arm-level-with-effect-measure", /effectMeasure applies only to a between-arm comparison/, (fixture) => {
      const armLevel = fixture.outcomes.find((outcome) => outcome.result.resultType === "arm-level");
      armLevel.result.effectMeasure = "Hazard ratio";
    }],
    ["non-numeric-numeric-value", /numericValue must be a finite number or null/, (fixture) => {
      fixture.outcomes[0].result.numericValue = "-8.0";
    }],
    // Endpoint role and domain (G14a/G17).
    ["unknown-endpoint-role", /endpoint role "Primary efficacy" is not allowed/, (fixture) => {
      fixture.endpoints[0].role = "Primary efficacy";
    }],
    ["unknown-endpoint-domain", /endpoint domain "weight" is not allowed/, (fixture) => {
      fixture.endpoints[0].domain = "weight";
    }],
    // AnalysisGroup invariants (R2a).
    ["analysis-group-empty-members", /memberArmIds must not be empty/, (fixture) => {
      fixture.analysisGroups[0].memberArmIds = [];
    }],
    ["analysis-group-repeated-member", /repeats member arm/, (fixture) => {
      fixture.analysisGroups[0].memberArmIds = [
        fixture.analysisGroups[0].memberArmIds[0],
        fixture.analysisGroups[0].memberArmIds[0],
      ];
    }],
    ["analysis-group-missing-member-arm", /references missing arm/, (fixture) => {
      fixture.analysisGroups[0].memberArmIds = ["fixture-arm-does-not-exist"];
    }],
    ["analysis-group-cross-study-member", /member arm .* belongs to another study/, (fixture) => {
      fixture.studies.push(secondStudy);
      fixture.arms.push(secondArm);
      fixture.analysisGroups[0].memberArmIds = [secondArm.id];
    }],
    ["analysis-group-unknown-kind", /analysisGroup kind "subgroup" is not allowed/, (fixture) => {
      fixture.analysisGroups[0].kind = "subgroup";
    }],
    ["analysis-group-id-collides-with-arm", /collides with an arm id/, (fixture) => {
      const armId = fixture.arms[0].id;
      fixture.analysisGroups.push({
        ...cloneJson(fixture.analysisGroups[0]),
        id: armId,
      });
    }],
    ["duplicate-analysis-group-semantics", /duplicate analysis group semantics/, (fixture) => {
      fixture.analysisGroups.push({
        ...cloneJson(fixture.analysisGroups[0]),
        id: "fixture-group-semantic-duplicate",
      });
    }],
    ["analysis-group-without-outcome", /analysis group .* has no outcome/, (fixture) => {
      fixture.analysisGroups.push({
        ...cloneJson(fixture.analysisGroups[0]),
        id: "fixture-group-orphan",
        label: "Orphan pooled group",
      });
    }],
    ["analysis-group-cross-study-outcome", /analysis group .* belongs to another study/, (fixture) => {
      const groupOutcome = fixture.outcomes.find(
        (outcome) => outcome.analysisGroupId !== undefined,
      );
      groupOutcome.studyId = "fixture-study-1";
      groupOutcome.endpointId = "fixture-endpoint-weight-change";
    }],
    ["outcome-with-both-anchors", /anchors either to armIds or to one analysisGroupId/, (fixture) => {
      const groupOutcome = fixture.outcomes.find(
        (outcome) => outcome.analysisGroupId !== undefined,
      );
      groupOutcome.armIds = ["fixture-arm-dr-5mg"];
    }],
    ["outcome-without-any-anchor", /anchors either to armIds or to one analysisGroupId/, (fixture) => {
      delete fixture.outcomes[0].armIds;
    }],
    ["analysis-group-between-arm-result", /comparison between analysis groups is not representable/, (fixture) => {
      const groupOutcome = fixture.outcomes.find(
        (outcome) => outcome.analysisGroupId !== undefined,
      );
      groupOutcome.result.resultType = "between-arm";
      groupOutcome.result.comparisonType = "Least-squares mean difference, pooled minus placebo";
      groupOutcome.result.effectMeasure = "Least-squares mean difference";
    }],
    ["missing-analysis-group-reference", /references missing analysis group/, (fixture) => {
      const groupOutcome = fixture.outcomes.find(
        (outcome) => outcome.analysisGroupId !== undefined,
      );
      groupOutcome.analysisGroupId = "fixture-group-does-not-exist";
    }],
  ];

  for (const [name, expectedError, mutate] of invalidExpectations) {
    const fixture = cloneJson(validAggregate);
    mutate(fixture);
    let failed = false;
    try {
      validateClinicalEvidenceAggregate(
        fixture,
        validReferences,
        `data/validation-fixtures/clinical-evidence/synthetic-invalid/${name}`,
      );
    } catch (error) {
      failed = true;
      assert(
        expectedError.test(error instanceof Error ? error.message : String(error)),
        `${name}: expected ${expectedError}, received ${error instanceof Error ? error.message : error}`,
      );
    }
    assert(failed, `${name}: invalid Clinical Evidence fixture unexpectedly passed`);
  }

  console.log("Validated Clinical Evidence synthetic fixtures.");
}

function validateSyntheticFixtures() {
  const registries = loadRegistries();
  const validDir = path.join(syntheticFixtureDir, "valid");
  const valid = readCompanyFolder(validDir, "fixture-co", true);
  validateDataset(
    [valid.company],
    valid.programs,
    valid.regimens,
    "data/validation-fixtures/synthetic/valid/fixture-co",
    registries,
    { companyLocalReferences: true },
  );

  const multiCompanyDir = path.join(syntheticFixtureDir, "valid-multi-company");
  const multiCompanyA = readCompanyFolder(multiCompanyDir, "company-a", true);
  const multiCompanyB = readCompanyFolder(multiCompanyDir, "company-b", true);
  validateDataset(
    [multiCompanyA.company, multiCompanyB.company],
    [...multiCompanyA.programs, ...multiCompanyB.programs],
    [...multiCompanyA.regimens, ...multiCompanyB.regimens],
    "data/validation-fixtures/synthetic/valid-multi-company",
    registries,
    { companyLocalReferences: true },
  );

  const invalidExpectations = [
    ["conflicting-asset-identity", /conflicting asset identity/],
    ["duplicate-combination-order", /duplicate combination identity/],
    ["duplicate-regimen-order", /duplicate regimen identity/],
    ["duplicate-regimen-configuration", /duplicate regimen identity/],
    ["partial-regimen-configuration", /ambiguous regimen identity/],
    ["blank-regimen-configuration", /configurationKey must be a non-empty string/],
    ["case-regimen-configuration", /duplicate regimen identity/],
    ["unregistered-relationship-role", /not in the registry/],
    ["invalid-alias-type", /aliases\[0\]\.type "nickname" is not allowed/],
    ["codename-equals-assetname", /codeName must not duplicate assetName/],
    ["duplicate-alias-value", /duplicates alias value/],
    ["invalid-status-operational-state", /is not allowed with status/],
    ["bad-internal-reference", /Use assetName or codeName with externalCompanyName/],
    ["foreign-company-id", /Use externalCompanyName for another company/],
    ["mixed-company-identity", /companyId and externalCompanyName cannot both be used/],
  ];

  for (const [folder, expectedError] of invalidExpectations) {
    const fixture = readCompanyFolder(path.join(syntheticFixtureDir, "invalid"), folder, true);
    let failed = false;
    try {
      validateDataset(
        [fixture.company],
        fixture.programs,
        fixture.regimens,
        `data/validation-fixtures/synthetic/invalid/${folder}`,
        registries,
        { companyLocalReferences: true },
      );
    } catch (error) {
      failed = true;
      assert(
        expectedError.test(error instanceof Error ? error.message : String(error)),
        `${folder}: expected ${expectedError}, received ${error instanceof Error ? error.message : error}`,
      );
    }
    assert(failed, `${folder}: invalid fixture unexpectedly passed`);
  }

  console.log("Validated synthetic fixtures.");
}

const command = process.argv[2];

try {
  switch (command) {
    case "validate:registries":
      loadRegistries();
      console.log("Validated registries.");
      break;
    case "validate:companies":
      validateCompanySources();
      break;
    case "validate:clinical-evidence":
      validateClinicalEvidenceSources();
      break;
    case "validate:clinical-evidence:generated":
      validateClinicalEvidenceGenerated();
      break;
    case "validate:clinical-evidence:synthetic":
      validateClinicalEvidenceSyntheticFixtures();
      break;
    case "validate:synthetic":
      validateSyntheticFixtures();
      break;
    case "generate":
      generateAggregates();
      break;
    case "validate:generated":
      validateGenerated();
      break;
    default:
      throw new Error(`Unknown command: ${command ?? "(none)"}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
