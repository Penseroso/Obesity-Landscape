import { companies, pipelinePrograms } from "./data";
import { sortProgramVariants } from "./selectors";
import type {
  AdministrationProfile,
  AssetAlias,
  Company,
  DevelopmentProfile,
  PipelineProgram,
  ScopeClass,
  TechnicalProfile,
} from "./types";

export type CompanyProgramVariant = {
  id: string;
  technical: TechnicalProfile;
  administration: AdministrationProfile;
  indications: string[];
  development: DevelopmentProfile;
  scopeClass: ScopeClass;
};

export type CompanyPortfolioAsset = {
  companyId: string;
  assetId: string;
  assetName: string;
  codeName: string | null;
  aliases?: AssetAlias[];
  programVariants: CompanyProgramVariant[];
};

export type CompanyPortfolioView = {
  company: Company;
  assets: CompanyPortfolioAsset[];
  /** Derived from the variants nested under assets; rows are not duplicated. */
  programRowCount: number;
};

function assetIdentity(program: PipelineProgram) {
  return JSON.stringify({
    assetName: program.assetName,
    codeName: program.codeName,
    aliases: program.aliases ?? [],
  });
}

function toVariant(program: PipelineProgram): CompanyProgramVariant {
  return {
    id: program.id,
    technical: program.technical,
    administration: program.administration,
    indications: program.indications,
    development: program.development,
    scopeClass: program.scopeClass,
  };
}

export function listCompanyIds(): string[] {
  return companies
    .map((company) => company.id)
    .sort((a, b) => a.localeCompare(b));
}

export function getCompanyPortfolio(
  companyId: string,
): CompanyPortfolioView | undefined {
  const company = companies.find((record) => record.id === companyId);
  if (!company) return undefined;

  const grouped = new Map<string, PipelineProgram[]>();
  for (const program of pipelinePrograms) {
    if (program.companyId !== companyId) continue;
    const key = `${program.companyId}|${program.assetId}`;
    const variants = grouped.get(key) ?? [];
    variants.push(program);
    grouped.set(key, variants);
  }

  const assets = Array.from(grouped.values())
    .map<CompanyPortfolioAsset>((programs) => {
      const [first, ...rest] = programs;
      const identity = assetIdentity(first);
      if (rest.some((program) => assetIdentity(program) !== identity)) {
        throw new Error(
          `Conflicting asset identity for "${first.companyId}|${first.assetId}"`,
        );
      }
      return {
        companyId: first.companyId,
        assetId: first.assetId,
        assetName: first.assetName,
        codeName: first.codeName,
        aliases: first.aliases,
        programVariants: sortProgramVariants(programs).map(toVariant),
      };
    })
    .sort(
      (a, b) =>
        a.assetName.localeCompare(b.assetName) ||
        a.assetId.localeCompare(b.assetId),
    );

  return {
    company,
    assets,
    programRowCount: assets.reduce(
      (total, asset) => total + asset.programVariants.length,
      0,
    ),
  };
}
