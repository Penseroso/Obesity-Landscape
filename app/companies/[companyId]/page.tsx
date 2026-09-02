import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyDetail } from "@/domains/app/components/CompanyDetail";
import {
  getCompanyDetail,
  listCompanyDetailIds,
} from "@/domains/app/lib/company-detail/read-model";
import { getEfficacyComparison } from "@/domains/app/lib/efficacy-comparison/read-model";

const ASSET_HREF_PATTERN = /^\/assets\/([^/]+)\/([^/]+)$/;

/**
 * Presentation-only lookup from an asset's own `companyId|assetId` key to its
 * Efficacy Comparison `unitKey`, built from the same `getEfficacyComparison()`
 * output the comparison page itself renders. Only rows the view already
 * treats as eligible (`view.families`, never `view.gaps`) produce an entry,
 * so an ineligible asset never gets a "Compare" affordance.
 */
function buildCompareUnitKeyByAsset(): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of getEfficacyComparison().families) {
    for (const row of group.rows) {
      if (!row.href) continue;
      const match = row.href.match(ASSET_HREF_PATTERN);
      if (!match) continue;
      const [, assetCompanyId, assetId] = match;
      map.set(`${assetCompanyId}|${assetId}`, row.unitKey);
    }
  }
  return map;
}

type CompanyPageProps = {
  params: Promise<{ companyId: string }>;
};

export function generateStaticParams() {
  return listCompanyDetailIds().map((companyId) => ({ companyId }));
}

export async function generateMetadata({
  params,
}: CompanyPageProps): Promise<Metadata> {
  const { companyId } = await params;
  const view = getCompanyDetail(companyId);
  return { title: view?.company.name ?? "Company not found" };
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { companyId } = await params;
  const view = getCompanyDetail(companyId);
  if (!view) notFound();

  return (
    <CompanyDetail
      view={view}
      compareUnitKeyByAsset={buildCompareUnitKeyByAsset()}
    />
  );
}
