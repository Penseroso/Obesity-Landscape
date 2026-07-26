import {
  getMechanismFamilyId,
  mechanismFamilies,
  mechanismFamilyById,
  type MechanismFamilyRegistryEntry,
} from "@/domains/company-pipeline/lib/constants";
import { pipelinePrograms, regimens } from "@/domains/company-pipeline/lib/data";

/**
 * Resolves a comparison unit to its mechanism family.
 *
 * Two different paths, because the two unit kinds store pharmacology differently:
 * an asset carries `technical.mechanism` free text that the registry maps by exact
 * string, while a regimen has no `technical` block at all and carries an authored
 * `mechanismFamilyId`. Neither path parses free text — a regimen's component `role`
 * strings are display metadata, not a derivation source.
 */

export type EfficacyMechanismFamily = MechanismFamilyRegistryEntry;

/** Registry display order. Authored `sortRank`, never derived from the data. */
export const efficacyMechanismFamilies = mechanismFamilies;

const programsByAssetKey = new Map<string, typeof pipelinePrograms>();
for (const program of pipelinePrograms) {
  const key = `${program.companyId}|${program.assetId}`;
  const list = programsByAssetKey.get(key);
  if (list) list.push(program);
  else programsByAssetKey.set(key, [program]);
}

const regimensById = new Map(regimens.map((regimen) => [regimen.id, regimen]));

export type MechanismFamilyResolution =
  | { family: EfficacyMechanismFamily; mechanism: string | null }
  | { family: null; reason: "mechanism-undisclosed" | "family-unassigned" };

/**
 * Pure resolution core, decoupled from the live `pipelinePrograms` lookup so it can
 * be exercised directly against synthetic mechanism combinations (see
 * `scripts/probe-efficacy-comparison.mts`'s mechanism-family self-check).
 *
 * Program rows of one asset must agree on pharmacology — the resolved mechanism
 * family — not on verbatim wording: two rows may legitimately store different
 * published wording for the same molecule (for example an oral-formulation press
 * release versus a peer-reviewed subcutaneous-arm publication) while both resolve
 * to the same family (Entities and Rows §Technical profile level). Only a genuine
 * cross-family disagreement, or a mix of disclosed and undisclosed rows, is corrupt
 * generated data and throws, matching the read model's existing fail-loud posture
 * rather than silently picking one row's pharmacology.
 */
export function resolveMechanismFamilyFromMechanisms(
  rowMechanisms: readonly (string | null)[],
  contextLabel: string,
): MechanismFamilyResolution {
  const mechanisms = Array.from(new Set(rowMechanisms));
  const disclosed = mechanisms.filter((mechanism): mechanism is string => mechanism !== null);

  if (disclosed.length === 0) {
    // Undisclosed mechanism is a real state in the source policy, not bad data.
    return { family: null, reason: "mechanism-undisclosed" };
  }

  const familyIds = new Set(disclosed.map((mechanism) => getMechanismFamilyId(mechanism)));
  if (familyIds.size > 1 || disclosed.length !== mechanisms.length) {
    throw new Error(
      `Efficacy Comparison: ${contextLabel} has conflicting mechanisms across its program rows: ${mechanisms
        .map((mechanism) => JSON.stringify(mechanism))
        .join(", ")}`,
    );
  }

  const mechanism = disclosed[0];
  return { family: mechanismFamilyById.get(getMechanismFamilyId(mechanism))!, mechanism };
}

/** Asset path: looks up the asset's program rows, then defers to the pure core. */
export function resolveAssetMechanismFamily(
  companyId: string,
  assetId: string,
): MechanismFamilyResolution {
  const programs = programsByAssetKey.get(`${companyId}|${assetId}`);
  if (!programs || programs.length === 0) {
    throw new Error(
      `Efficacy Comparison: asset "${companyId}/${assetId}" has no Company/Pipeline program row`,
    );
  }

  return resolveMechanismFamilyFromMechanisms(
    programs.map((program) => program.technical.mechanism),
    `asset "${companyId}/${assetId}"`,
  );
}

/**
 * Regimen path. The family is authored, so an unassigned regimen is a coverage gap
 * rather than an error — and never an "other" bucket, which would place it beside
 * assets whose pharmacology was actually established.
 */
export function resolveRegimenMechanismFamily(
  regimenId: string,
): MechanismFamilyResolution {
  const regimen = regimensById.get(regimenId);
  if (!regimen) {
    throw new Error(
      `Efficacy Comparison: Study references missing regimen "${regimenId}"`,
    );
  }
  if (!regimen.mechanismFamilyId) {
    return { family: null, reason: "family-unassigned" };
  }
  const family = mechanismFamilyById.get(regimen.mechanismFamilyId);
  if (!family) {
    throw new Error(
      `Efficacy Comparison: regimen "${regimenId}" names unknown mechanism family "${regimen.mechanismFamilyId}"`,
    );
  }
  return { family, mechanism: null };
}

export type EfficacyUnitDisplay = {
  name: string;
  companyName: string;
  mechanism: string | null;
  mechanismFamilyId: string | null;
};

/**
 * Display identity for a regimen unit, resolved from the regimen record and its own
 * joined company.
 *
 * Deliberately does **not** route through the asset lookup: a regimen has no
 * `assetId`, so an asset-keyed lookup would miss and fall back to printing the raw
 * `companyId` slug where the company's registered name belongs.
 */
export function getRegimenDisplay(regimenId: string): EfficacyUnitDisplay {
  const regimen = regimensById.get(regimenId);
  if (!regimen) {
    throw new Error(
      `Efficacy Comparison: Study references missing regimen "${regimenId}"`,
    );
  }
  return {
    name: regimen.name,
    companyName: regimen.company?.name ?? regimen.companyId,
    mechanism: null,
    mechanismFamilyId: regimen.mechanismFamilyId ?? null,
  };
}

export function getAssetDisplay(
  companyId: string,
  assetId: string,
): EfficacyUnitDisplay {
  const programs = programsByAssetKey.get(`${companyId}|${assetId}`);
  const program = programs?.[0];
  const mechanism = program?.technical.mechanism ?? null;
  return {
    name: program?.assetName ?? assetId,
    companyName: program?.company?.name ?? companyId,
    mechanism,
    mechanismFamilyId: mechanism === null ? null : getMechanismFamilyId(mechanism),
  };
}
