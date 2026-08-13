import {
  developmentStageRank,
  developmentStages,
  getMechanismFamilyId,
  getStageBucketId,
  mechanismFamilyById,
  obesityPurposeQualifyingScopeClasses,
  scopeClasses,
  stageBuckets,
  type MechanismFamilyComposition,
  type StageBucketId,
} from "./constants";
import type {
  Company,
  CompanySummary,
  DevelopmentStage,
  PipelineProgram,
  ProgramFilterOptions,
} from "./types";

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function getLatestUpdateDate(programs: PipelineProgram[]) {
  return programs
    .map((program) => program.metadata.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
}

export function getMostAdvancedDevelopmentStage(programs: PipelineProgram[]) {
  return programs.reduce<DevelopmentStage | undefined>((current, program) => {
    if (!current) {
      return program.development.stage;
    }

    return developmentStageRank[program.development.stage] >
      developmentStageRank[current]
      ? program.development.stage
      : current;
  }, undefined);
}

/**
 * Count of rows whose `scopeClass` expresses an obesity-purpose development
 * objective (`obesity-treatment` or `obesity-adjunct`, Contract 1.2 ADR-0053).
 * Shown alongside the total row count, never in place of it: presence of a
 * record does not imply it is one of these rows (43 of 121 program rows are
 * not, as of the Contract 1.2 backfill) - see
 * `generated-output-contract.md#5-consumer-contract`.
 */
export function getObesityPurposeProgramCount(programs: PipelineProgram[]) {
  const qualifying: readonly string[] = obesityPurposeQualifyingScopeClasses;
  return programs.filter((program) => qualifying.includes(program.scopeClass))
    .length;
}

export function getProgramFilterOptions(
  programs: PipelineProgram[],
): ProgramFilterOptions {
  return {
    companies: uniqueSorted(
      programs.map((program) => program.company?.name ?? ""),
    ),
    indications: uniqueSorted(programs.flatMap((program) => program.indications)),
    routes: uniqueSorted(programs.map((program) => program.administration.route)),
    stages: developmentStages.filter((stage) =>
      programs.some((program) => program.development.stage === stage),
    ),
    scopeClasses: scopeClasses
      .filter((entry) =>
        programs.some((program) => program.scopeClass === entry.id),
      )
      .map((entry) => ({ value: entry.id, label: entry.label })),
  };
}

export type CompanyStageMatrixRow = {
  companyId: string;
  companyName: string;
  counts: Record<StageBucketId, number>;
  total: number;
};

export type CompanyStageMatrix = {
  columns: { id: StageBucketId; label: string }[];
  rows: CompanyStageMatrixRow[];
  maxCellCount: number;
};

export function getCompanyStageMatrix(
  companyRecords: Company[],
  programs: PipelineProgram[],
): CompanyStageMatrix {
  const programsByCompanyId = new Map<string, PipelineProgram[]>();

  for (const program of programs) {
    const companyPrograms = programsByCompanyId.get(program.companyId) ?? [];
    companyPrograms.push(program);
    programsByCompanyId.set(program.companyId, companyPrograms);
  }

  let maxCellCount = 0;

  const rows = companyRecords
    .map((company) => {
      const companyPrograms = programsByCompanyId.get(company.id) ?? [];
      const counts = Object.fromEntries(
        stageBuckets.map((bucket) => [bucket.id, 0]),
      ) as Record<StageBucketId, number>;

      for (const program of companyPrograms) {
        const bucketId = getStageBucketId(program.development.stage);
        counts[bucketId] += 1;
        maxCellCount = Math.max(maxCellCount, counts[bucketId]);
      }

      return {
        companyId: company.id,
        companyName: company.name,
        counts,
        total: companyPrograms.length,
      };
    })
    .sort((a, b) => a.companyName.localeCompare(b.companyName));

  return { columns: stageBuckets, rows, maxCellCount };
}

export type RouteDistributionEntry = {
  route: string;
  count: number;
  share: number;
};

export function getRouteDistribution(
  programs: PipelineProgram[],
): RouteDistributionEntry[] {
  const counts = new Map<string, number>();

  for (const program of programs) {
    const route = program.administration.route?.trim() || "Unknown";
    counts.set(route, (counts.get(route) ?? 0) + 1);
  }

  const total = programs.length || 1;

  return Array.from(counts.entries())
    .map(([route, count]) => ({ route, count, share: count / total }))
    .sort((a, b) => b.count - a.count || a.route.localeCompare(b.route));
}

export type MechanismMixEntry = {
  /** Stable identity for list rendering. Never reused across the three kinds below. */
  key: string;
  kind: "family" | "other" | "undisclosed";
  familyId: string | null;
  label: string;
  composition: MechanismFamilyComposition | null;
  count: number;
  share: number;
};

/**
 * Program count by mechanism family (registry-resolved from
 * `technical.mechanism`), for the Overview's mechanism-mix panel.
 *
 * Capped to the `topN` highest-count families (registry `sortRank` as tie
 * break) plus one "Other mechanisms" aggregate for the rest - the registry
 * carries several dozen families, most represented by one or two programs, and
 * listing every one turns the panel into an illegible scroll of slivers.
 *
 * A program with an undisclosed mechanism (a real source state, not bad data -
 * see `resolveMechanismFamilyFromMechanisms` in
 * `domains/app/lib/efficacy-comparison/mechanism-family.ts`) is never folded
 * into "Other": that bucket is a disclosure state, not a long-tail mechanism,
 * so it always renders as its own trailing row when present.
 */
export function getMechanismMix(
  programs: PipelineProgram[],
  topN = 6,
): MechanismMixEntry[] {
  const counts = new Map<string, number>();
  let undisclosedCount = 0;

  for (const program of programs) {
    const mechanism = program.technical.mechanism;
    if (mechanism === null) {
      undisclosedCount += 1;
      continue;
    }
    const familyId = getMechanismFamilyId(mechanism);
    counts.set(familyId, (counts.get(familyId) ?? 0) + 1);
  }

  const total = programs.length || 1;

  const families = Array.from(counts.entries())
    .map(([familyId, count]) => {
      const family = mechanismFamilyById.get(familyId)!;
      return { familyId, label: family.label, composition: family.composition, count, sortRank: family.sortRank };
    })
    .sort((a, b) => b.count - a.count || a.sortRank - b.sortRank);

  const entries: MechanismMixEntry[] = families.slice(0, topN).map((family) => ({
    key: family.familyId,
    kind: "family",
    familyId: family.familyId,
    label: family.label,
    composition: family.composition,
    count: family.count,
    share: family.count / total,
  }));

  const otherCount = families
    .slice(topN)
    .reduce((sum, family) => sum + family.count, 0);
  if (otherCount > 0) {
    entries.push({
      key: "other",
      kind: "other",
      familyId: null,
      label: "Other mechanisms",
      composition: null,
      count: otherCount,
      share: otherCount / total,
    });
  }

  if (undisclosedCount > 0) {
    entries.push({
      key: "undisclosed",
      kind: "undisclosed",
      familyId: null,
      label: "Mechanism undisclosed",
      composition: null,
      count: undisclosedCount,
      share: undisclosedCount / total,
    });
  }

  return entries;
}

/**
 * Program Register default ordering: most advanced development-stage
 * registry rank first, then company name, then asset name.
 */
export function sortProgramsForRegister(
  programs: PipelineProgram[],
): PipelineProgram[] {
  return programs.slice().sort((a, b) => {
    const rankDiff =
      (developmentStageRank[b.development.stage] ?? 0) -
      (developmentStageRank[a.development.stage] ?? 0);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    const companyDiff = (a.company?.name ?? "").localeCompare(
      b.company?.name ?? "",
    );
    if (companyDiff !== 0) {
      return companyDiff;
    }

    return a.assetName.localeCompare(b.assetName);
  });
}

/**
 * Deterministic ordering for the program variants grouped under one asset.
 * Development maturity uses the same registry-backed rank as the Program
 * Register; the remaining fields are display-stability tie breakers only.
 */
export function sortProgramVariants(
  programs: PipelineProgram[],
): PipelineProgram[] {
  return programs.slice().sort((a, b) => {
    const rankDiff =
      (developmentStageRank[b.development.stage] ?? 0) -
      (developmentStageRank[a.development.stage] ?? 0);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    const indicationDiff = a.indications
      .join("|")
      .localeCompare(b.indications.join("|"));
    if (indicationDiff !== 0) {
      return indicationDiff;
    }

    const administrationDiff = [
      a.administration.route,
      a.administration.dosageForm,
      a.administration.dosingInterval ?? "",
    ]
      .join("|")
      .localeCompare(
        [
          b.administration.route,
          b.administration.dosageForm,
          b.administration.dosingInterval ?? "",
        ].join("|"),
      );

    return administrationDiff || a.id.localeCompare(b.id);
  });
}

export function getCompanySummaries(
  companyRecords: Company[],
  programs: PipelineProgram[],
): CompanySummary[] {
  const programsByCompanyId = new Map<string, PipelineProgram[]>();

  for (const program of programs) {
    const companyPrograms = programsByCompanyId.get(program.companyId) ?? [];
    companyPrograms.push(program);
    programsByCompanyId.set(program.companyId, companyPrograms);
  }

  return companyRecords
    .map((company) => {
      const companyPrograms = programsByCompanyId.get(company.id) ?? [];

      return {
        id: company.id,
        name: company.name,
        headquartersCountry: company.headquartersCountry,
        focusAreas: uniqueSorted(
          companyPrograms.flatMap((program) => program.indications),
        ),
        programCount: companyPrograms.length,
        mostAdvancedStage: getMostAdvancedDevelopmentStage(companyPrograms),
        lastUpdated: getLatestUpdateDate(companyPrograms),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
