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

/**
 * A relationship on this company's own row, pointing at the other party
 * (never a self-declared entry - e.g. Eli Lilly recording itself as
 * `licensee`, which is excluded). `counterpartyCompanyId` is set only when
 * the other party is itself a company tracked in this dataset.
 */
export type OwnRelationshipDetail = {
  role: string;
  counterpartyCompanyId?: string;
  counterpartyName: string;
  territories: string[];
};

export type OwnProgramVariant = CompanyProgramVariant & {
  relationshipBadges: OwnRelationshipDetail[];
};

export type CompanyPortfolioAsset = {
  companyId: string;
  assetId: string;
  assetName: string;
  codeName: string | null;
  aliases?: AssetAlias[];
  programVariants: OwnProgramVariant[];
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
        programVariants: sortProgramVariants(programs).map((program) => ({
          ...toVariant(program),
          relationshipBadges: deriveOwnRelationshipDetails(program),
        })),
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

/**
 * Resolves a stored `CompanyRelationship` on a program to the *other* party,
 * for display on that row's own (in-scope) company page - the complement of
 * `resolveRelationshipCompanyId`, which instead tests whether a relationship
 * points at one specific target company. Returns `undefined` only for a
 * self-declared entry (the row's own company naming itself, e.g. a licensee
 * recording its own `licensee` role). An `externalCompanyName` that does not
 * resolve to a tracked company (e.g. an untracked originator like Carmot
 * Therapeutics) is still returned, using the raw stored name with no
 * `companyId` to link to.
 */
function resolveRelationshipCounterparty(
  relationship: CompanyRelationship,
  ownCompanyId: string,
): { companyId?: string; name: string } | undefined {
  if (relationship.companyId) {
    if (relationship.companyId === ownCompanyId) return undefined;
    const company = companies.find((c) => c.id === relationship.companyId);
    return {
      companyId: relationship.companyId,
      name: company?.name ?? relationship.companyId,
    };
  }
  if (relationship.externalCompanyName) {
    const resolvedId = companyIdByNormalizedName.get(
      normalizeCompanyName(relationship.externalCompanyName),
    );
    if (resolvedId === ownCompanyId) return undefined;
    if (resolvedId) {
      const company = companies.find((c) => c.id === resolvedId);
      return {
        companyId: resolvedId,
        name: company?.name ?? relationship.externalCompanyName,
      };
    }
    return { name: relationship.externalCompanyName };
  }
  return undefined;
}

function deriveOwnRelationshipDetails(
  program: PipelineProgram,
): OwnRelationshipDetail[] {
  const details: OwnRelationshipDetail[] = [];
  for (const relationship of program.relationships ?? []) {
    const counterparty = resolveRelationshipCounterparty(
      relationship,
      program.companyId,
    );
    if (!counterparty) continue;
    const detail: OwnRelationshipDetail = {
      role: relationship.role,
      counterpartyCompanyId: counterparty.companyId,
      counterpartyName: counterparty.name,
      territories: relationship.territories ?? [],
    };
    if (
      !details.some(
        (existing) =>
          existing.role === detail.role &&
          existing.counterpartyName === detail.counterpartyName &&
          JSON.stringify(existing.territories) ===
            JSON.stringify(detail.territories),
      )
    ) {
      details.push(detail);
    }
  }
  return details;
}

export type PartneredProgramVariant = CompanyProgramVariant & {
  /** This company's own relationship details on this row, preserving role and territory. */
  relationshipDetails: {
    role: string;
    territories: string[];
  }[];
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
    {
      program: PipelineProgram;
      relationshipDetails: PartneredProgramVariant["relationshipDetails"];
    }[]
  >();

  for (const program of pipelinePrograms) {
    if (program.companyId === companyId) continue;
    const relationshipDetails: PartneredProgramVariant["relationshipDetails"] =
      [];
    for (const relationship of program.relationships ?? []) {
      if (
        resolveRelationshipCompanyId(relationship, program.companyId) ===
        companyId
      ) {
        const detail = {
          role: relationship.role,
          territories: relationship.territories ?? [],
        };
        if (
          !relationshipDetails.some(
            (existing) =>
              existing.role === detail.role &&
              JSON.stringify(existing.territories) ===
                JSON.stringify(detail.territories),
          )
        ) {
          relationshipDetails.push(detail);
        }
      }
    }
    if (relationshipDetails.length === 0) continue;

    const key = `${program.companyId}|${program.assetId}`;
    const list = grouped.get(key) ?? [];
    list.push({ program, relationshipDetails });
    grouped.set(key, list);
  }

  return Array.from(grouped.values())
    .map<CompanyPartneredAsset>((entries) => {
      const [first] = entries;
      const sorted = sortProgramVariants(entries.map((entry) => entry.program));
      const relationshipDetailsByProgramId = new Map(
        entries.map((entry) => [
          entry.program.id,
          entry.relationshipDetails,
        ]),
      );
      return {
        ownerCompanyId: first.program.companyId,
        ownerCompanyName: first.program.company?.name ?? first.program.companyId,
        assetId: first.program.assetId,
        assetName: first.program.assetName,
        codeName: first.program.codeName,
        programVariants: sorted.map((program) => ({
          ...toVariant(program),
          relationshipDetails:
            relationshipDetailsByProgramId.get(program.id) ?? [],
        })),
      };
    })
    .sort(
      (a, b) =>
        a.ownerCompanyName.localeCompare(b.ownerCompanyName) ||
        a.assetName.localeCompare(b.assetName),
    );
}
