import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetStudies } from "@/domains/app/components/clinical/AssetStudies";
import {
  getAssetStudies,
  listClinicalAssetKeys,
} from "@/domains/app/lib/clinical-evidence/selectors";
import { getEfficacyComparison } from "@/domains/app/lib/efficacy-comparison/read-model";

type AssetPageProps = {
  params: Promise<{ companyId: string; assetId: string }>;
};

export function generateStaticParams() {
  return listClinicalAssetKeys();
}

export async function generateMetadata({
  params,
}: AssetPageProps): Promise<Metadata> {
  const { companyId, assetId } = await params;
  const view = getAssetStudies(companyId, assetId);
  if (!view) {
    return { title: "Asset not found" };
  }
  return { title: view.assetName };
}

export default async function AssetPage({ params }: AssetPageProps) {
  const { companyId, assetId } = await params;
  const view = getAssetStudies(companyId, assetId);
  if (!view) {
    notFound();
  }

  // Presentation-only: this asset is Compare-eligible only if it already has
  // a row (never a gap) in the same getEfficacyComparison() output the
  // comparison page itself renders.
  const assetHref = `/assets/${companyId}/${assetId}`;
  const compareUnitKey = getEfficacyComparison()
    .families.flatMap((group) => group.rows)
    .find((row) => row.href === assetHref)?.unitKey;

  return <AssetStudies view={view} compareUnitKey={compareUnitKey} />;
}
