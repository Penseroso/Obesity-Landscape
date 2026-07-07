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
const stressTestDir = path.join(dataDir, "stress-tests");
const registryDir = path.join(dataDir, "registries");
const syntheticFixtureDir = path.join(dataDir, "validation-fixtures", "synthetic");

const fullDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const partialDatePattern = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const assetTypes = new Set([
  "single-asset",
  "fixed-dose-combination",
  "co-formulation",
]);
const combinationAssetTypes = new Set([
  "fixed-dose-combination",
  "co-formulation",
]);
const developmentStatuses = new Set([
  "Planned",
  "Active",
  "On hold",
  "Discontinued",
  "Unknown",
]);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
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
    });
    const priorIdentity = assetIdentityById.get(program.assetId);
    assert(
      priorIdentity === undefined || priorIdentity === identity,
      `${context}: assetId ${program.assetId} is reused with conflicting asset identity`,
    );
    assetIdentityById.set(program.assetId, identity);

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

function validateCompanySources() {
  const registries = loadRegistries();
  const folders = getCompanySourceFolders(companySourceDir);

  for (const folder of folders) {
    const { company, programs, regimens } = readCompanyFolder(companySourceDir, folder, true);
    validateDataset([company], programs, regimens, `data/companies/${folder}`, registries, {
      companyLocalReferences: true,
    });
  }

  console.log(`Validated ${folders.length} company source folder(s).`);
}

function validateStressTests() {
  const folders = getCompanySourceFolders(stressTestDir);

  for (const folder of folders) {
    const folderPath = path.join(stressTestDir, folder);
    const company = requireJsonFile(path.join(folderPath, "company.json"), folder);
    const programs = requireJsonFile(path.join(folderPath, "pipeline-programs.json"), folder);

    validateCompany(company, `data/stress-tests/${folder}`);
    assert(Array.isArray(programs), `${folder}: pipeline-programs.json must be an array`);
    for (const program of programs) {
      assert(isObject(program), `${folder}: archive program must be an object`);
      assert(isNonEmptyString(program.id), `${folder}: archive program id is required`);
      assert(
        program.companyId === company.id,
        `${folder}: archive program ${program.id} must reference archive company id`,
      );
    }

    assert(existsSync(path.join(folderPath, "deferred-items.json")), `${folder}: deferred-items.json is required`);
    assert(existsSync(path.join(folderPath, "findings.md")), `${folder}: findings.md is required`);
    assert(existsSync(path.join(folderPath, "contract-gaps.md")), `${folder}: contract-gaps.md is required`);
  }

  console.log(`Validated ${folders.length} stress-test diagnostic archive(s).`);
}

function generateAggregates() {
  const registries = loadRegistries();
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
    validateDataset([company], companyPrograms, companyRegimens, `data/companies/${folder}`, registries, {
      companyLocalReferences: true,
    });
    companies.push(company);
    programs.push(...companyPrograms);
    regimens.push(...companyRegimens);
  }

  validateDataset(companies, programs, regimens, "generated aggregate", registries, {
    companyLocalReferences: true,
  });
  companies.sort((a, b) => a.id.localeCompare(b.id));
  programs.sort((a, b) => a.companyId.localeCompare(b.companyId) || a.id.localeCompare(b.id));
  regimens.sort((a, b) => a.companyId.localeCompare(b.companyId) || a.id.localeCompare(b.id));

  mkdirSync(generatedDir, { recursive: true });
  writeJson(path.join(generatedDir, "companies.json"), companies);
  writeJson(path.join(generatedDir, "pipeline-programs.json"), programs);
  writeJson(path.join(generatedDir, "regimens.json"), regimens);
  console.log(
    `Generated ${companies.length} company record(s), ${programs.length} program record(s), and ${regimens.length} regimen record(s).`,
  );
}

function validateGenerated() {
  const registries = loadRegistries();
  const companies = readJson(path.join(generatedDir, "companies.json"));
  const programs = readJson(path.join(generatedDir, "pipeline-programs.json"));
  const regimens = readJson(path.join(generatedDir, "regimens.json"));

  validateDataset(companies, programs, regimens, "data/generated", registries, {
    companyLocalReferences: true,
  });
  console.log(
    `Validated generated aggregate with ${companies.length} company record(s), ${programs.length} program record(s), and ${regimens.length} regimen record(s).`,
  );
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

  const invalidExpectations = [
    ["duplicate-combination-order", /duplicate combination identity/],
    ["duplicate-regimen-order", /duplicate regimen identity/],
    ["duplicate-regimen-configuration", /duplicate regimen identity/],
    ["partial-regimen-configuration", /ambiguous regimen identity/],
    ["blank-regimen-configuration", /configurationKey must be a non-empty string/],
    ["case-regimen-configuration", /duplicate regimen identity/],
    ["unregistered-relationship-role", /not in the registry/],
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
    case "validate:stress":
      validateStressTests();
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
