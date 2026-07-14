import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetStudies } from "@/components/clinical/AssetStudies";
import {
  getAssetStudies,
  listClinicalAssetKeys,
} from "@/lib/clinical-evidence/selectors";

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
  return <AssetStudies view={view} />;
}
