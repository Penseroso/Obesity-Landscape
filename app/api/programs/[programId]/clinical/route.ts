import { NextResponse, type NextRequest } from "next/server";
import {
  getAssetClinicalRollup,
  getProgramStudyPreview,
} from "@/domains/app/lib/clinical-evidence/selectors";

/**
 * On-demand clinical preview/context for one Program, fetched only when the
 * Program Register drawer opens. See domains/app/docs/README.md for why this
 * replaced eager precomputation for every program in the register.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> },
) {
  const { programId } = await params;
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const assetId = searchParams.get("assetId");

  return NextResponse.json({
    preview: getProgramStudyPreview(programId) ?? null,
    context:
      companyId && assetId
        ? (getAssetClinicalRollup(companyId, assetId) ?? null)
        : null,
  });
}
