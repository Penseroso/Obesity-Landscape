/**
 * Explicit cross-company asset identity for Efficacy Comparison.
 *
 * Company/Pipeline assets remain company-local. This registry is deliberately
 * feature-local: it groups only assets whose shared molecule identity and
 * development-rights split have been reviewed for this comparison surface.
 */
export type EfficacyGlobalAssetMember = {
  companyId: string;
  assetId: string;
  /** Lower values win before the ordinary evidence-ranking keys. */
  evidencePriority: number;
  developmentScope: string;
  sponsorName: string;
};

export type EfficacyGlobalAssetGroup = {
  id: string;
  displayName: string;
  members: EfficacyGlobalAssetMember[];
};

export const efficacyGlobalAssetGroups =
  globalAssetGroupData as EfficacyGlobalAssetGroup[];

const memberByAssetKey = new Map<
  string,
  { group: EfficacyGlobalAssetGroup; member: EfficacyGlobalAssetMember }
>();
const groupIds = new Set<string>();

for (const group of efficacyGlobalAssetGroups) {
  if (!group.id.trim() || groupIds.has(group.id)) {
    throw new Error(
      `Efficacy global asset group id "${group.id}" is empty or duplicated`,
    );
  }
  if (!group.displayName.trim() || group.members.length < 2) {
    throw new Error(
      `Efficacy global asset group "${group.id}" requires a display name and at least two members`,
    );
  }
  groupIds.add(group.id);
  const priorities = new Set<number>();
  for (const member of group.members) {
    if (
      !member.companyId.trim() ||
      !member.assetId.trim() ||
      !Number.isInteger(member.evidencePriority) ||
      member.evidencePriority < 0 ||
      !member.developmentScope.trim() ||
      !member.sponsorName.trim()
    ) {
      throw new Error(
        `Efficacy global asset group "${group.id}" has an invalid member`,
      );
    }
    const key = `${member.companyId}|${member.assetId}`;
    if (memberByAssetKey.has(key)) {
      throw new Error(
        `Efficacy global asset member "${key}" belongs to more than one group`,
      );
    }
    if (priorities.has(member.evidencePriority)) {
      throw new Error(
        `Efficacy global asset group "${group.id}" repeats priority ${member.evidencePriority}`,
      );
    }
    priorities.add(member.evidencePriority);
    memberByAssetKey.set(key, { group, member });
  }
}

export function getEfficacyGlobalAssetMembership(
  companyId: string,
  assetId: string,
) {
  return memberByAssetKey.get(`${companyId}|${assetId}`);
}
import globalAssetGroupData from "./efficacy-global-assets.json";
