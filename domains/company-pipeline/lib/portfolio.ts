import { companies, pipelinePrograms } from "./data";
import { sortProgramVariants } from "./selectors";
import type {
  AdministrationProfile,
  AssetAlias,
  Company,
  CompanyRelationship,
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

/**
 * A relationship's `externalCompanyName` is free text (source-and-entry-policy.md),
 * so matching it against `Company.name` normalizes common legal-entity suffixes
 * ("Verdiva Bio Limited" vs. the canonical "Verdiva Bio") rather than requiring
 * an exact string match.
 */
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(
      /\b(inc|incorporated|ltd|limited|corp|corporation|co|company|gmbh|plc|sa|ag|nv|kk)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

const companyIdByNormalizedName = new Map(
  companies.map((company) => [normalizeCompanyName(company.name), company.id]),
);

/**
 * Resolves a stored `CompanyRelationship` to another company already tracked
 * in this dataset, or `undefined` when it names the row's own company (a
 * self-declared role, e.g. Eli Lilly recording itself as `licensee` on an
 * in-licensed asset - see entities-and-rows.md#licensed-and-in-licensed-assets)
 * or an external company this dataset has no record for.
 */
function resolveRelationshipCompanyId(
  relationship: CompanyRelationship,
  ownCompanyId: string,
): string | undefined {
  if (relationship.companyId) {
    return relationship.companyId !== ownCompanyId
      ? relationship.companyId
      : undefined;
  }
  if (relationship.externalCompanyName) {
    const resolved = companyIdByNormalizedName.get(
      normalizeCompanyName(relationship.externalCompanyName),
    );
    if (resolved && resolved !== ownCompanyId) return resolved;
  }
  return undefined;
}

export type PartneredProgramVariant = CompanyProgramVariant & {
  /** This company's own role(s) on this row, as stored on its `relationships`. */
  relationshipRoles: string[];
};

export type CompanyPartneredAsset = {
  ownerCompanyId: string;
  ownerCompanyName: string;
  assetId: string;
  assetName: string;
  codeName: string | null;
  programVariants: PartneredProgramVariant[];
};

/**
 * Assets **another** company owns (`companyId`) where this company appears in
 * a row's `relationships` - e.g. Roche co-developing Zealand Pharma's
 * petrelintide, or Zealand Pharma originating Boehringer Ingelheim's
 * survodutide. Distinct from `getCompanyPortfolio`, which only returns rows
 * this company itself principally develops (ADR-0018/0019 keep `companyId`
 * singular; this view is the read-only complement that surfaces the
 * relationship side without changing that identity rule).
 */
export function getPartneredAssets(companyId: string): CompanyPartneredAsset[] {
  const grouped = new Map<
    string,
    { program: PipelineProgram; roles: string[] }[]
  >();

  for (const program of pipelinePrograms) {
    if (program.companyId === companyId) continue;
    const roles = new Set<string>();
    for (const relationship of program.relationships ?? []) {
      if (
        resolveRelationshipCompanyId(relationship, program.companyId) ===
        companyId
      ) {
        roles.add(relationship.role);
      }
    }
    if (roles.size === 0) continue;

    const key = `${program.companyId}|${program.assetId}`;
    const list = grouped.get(key) ?? [];
    list.push({ program, roles: Array.from(roles) });
    grouped.set(key, list);
  }

  return Array.from(grouped.values())
    .map<CompanyPartneredAsset>((entries) => {
      const [first] = entries;
      const sorted = sortProgramVariants(entries.map((entry) => entry.program));
      const rolesByProgramId = new Map(
        entries.map((entry) => [entry.program.id, entry.roles]),
      );
      return {
        ownerCompanyId: first.program.companyId,
        ownerCompanyName: first.program.company?.name ?? first.program.companyId,
        assetId: first.program.assetId,
        assetName: first.program.assetName,
        codeName: first.program.codeName,
        programVariants: sorted.map((program) => ({
          ...toVariant(program),
          relationshipRoles: rolesByProgramId.get(program.id) ?? [],
        })),
      };
    })
    .sort(
      (a, b) =>
        a.ownerCompanyName.localeCompare(b.ownerCompanyName) ||
        a.assetName.localeCompare(b.assetName),
    );
}
