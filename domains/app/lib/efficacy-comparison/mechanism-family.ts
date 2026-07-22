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
 * Asset path. Program rows of one asset must agree on mechanism — they describe the
 * same molecule in different routes or formulations — so disagreement is corrupt
 * generated data and throws, matching the read model's existing fail-loud posture
 * rather than silently picking one row's pharmacology.
 */
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

  const mechanisms = Array.from(
    new Set(programs.map((program) => program.technical.mechanism)),
  );
  if (mechanisms.length > 1) {
    throw new Error(
      `Efficacy Comparison: asset "${companyId}/${assetId}" has conflicting mechanisms across its program rows: ${mechanisms
        .map((mechanism) => JSON.stringify(mechanism))
        .join(", ")}`,
    );
  }

  const mechanism = mechanisms[0];
  if (mechanism === null) {
    // Undisclosed mechanism is a real state in the source policy, not bad data.
    return { family: null, reason: "mechanism-undisclosed" };
  }

  return { family: mechanismFamilyById.get(getMechanismFamilyId(mechanism))!, mechanism };
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

export function getRegimenName(regimenId: string): string {
  return regimensById.get(regimenId)?.name ?? regimenId;
}

export function getAssetDisplay(
  companyId: string,
  assetId: string,
): { assetName: string; companyName: string; mechanism: string | null } {
  const programs = programsByAssetKey.get(`${companyId}|${assetId}`);
  const program = programs?.[0];
  return {
    assetName: program?.assetName ?? assetId,
    companyName: program?.company?.name ?? companyId,
    mechanism: program?.technical.mechanism ?? null,
  };
}
