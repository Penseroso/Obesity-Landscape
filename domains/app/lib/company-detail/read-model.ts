import {
  getAssetClinicalRollup,
  type AssetClinicalRollup,
} from "@/domains/app/lib/clinical-evidence/selectors";
import {
  getCompanyPortfolio,
  listCompanyIds,
  type CompanyPortfolioAsset,
} from "@/domains/company-pipeline/lib/portfolio";
import type { Company } from "@/domains/company-pipeline/lib/types";

export type CompanyDetailAssetView = CompanyPortfolioAsset & {
  clinical: Pick<
    AssetClinicalRollup,
    | "hasStudies"
    | "hasClinicalEvidence"
    | "focalStudyCount"
    | "linkedStudyCount"
    | "href"
  >;
};

export type CompanyDetailView = {
  company: Company;
  summary: {
    assetCount: number;
    programRowCount: number;
    clinicalEvidenceAssetCount: number;
    associatedClinicalStudyCount: number;
  };
  assets: CompanyDetailAssetView[];
};

export function listCompanyDetailIds(): string[] {
  return listCompanyIds();
}

export function getCompanyDetail(
  companyId: string,
): CompanyDetailView | undefined {
  const portfolio = getCompanyPortfolio(companyId);
  if (!portfolio) return undefined;

  const assetRollups = portfolio.assets.map((asset) => {
    const clinical = getAssetClinicalRollup(asset.companyId, asset.assetId);
    if (!clinical) {
      throw new Error(
        `Clinical rollup could not resolve pipeline asset "${asset.companyId}|${asset.assetId}"`,
      );
    }
    return { ...asset, clinical };
  });

  const associatedStudyIds = new Set<string>();
  for (const asset of assetRollups) {
    for (const studyId of [
      ...asset.clinical.focalStudyIds,
      ...asset.clinical.linkedStudyIds,
    ]) {
      associatedStudyIds.add(studyId);
    }
  }

  const assets = assetRollups.map<CompanyDetailAssetView>((asset) => ({
    ...asset,
    clinical: {
      hasStudies: asset.clinical.hasStudies,
      hasClinicalEvidence: asset.clinical.hasClinicalEvidence,
      focalStudyCount: asset.clinical.focalStudyCount,
      linkedStudyCount: asset.clinical.linkedStudyCount,
      href: asset.clinical.href,
    },
  }));

  return {
    company: portfolio.company,
    summary: {
      assetCount: assets.length,
      programRowCount: portfolio.programRowCount,
      clinicalEvidenceAssetCount: assets.filter(
        (asset) => asset.clinical.hasClinicalEvidence,
      ).length,
      associatedClinicalStudyCount: associatedStudyIds.size,
    },
    assets,
  };
}
