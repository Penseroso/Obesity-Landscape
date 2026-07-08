import {
  clinicalDevelopmentStages,
  developmentStageRank,
  developmentStages,
  developmentStatuses,
  getStageBucketId,
  stageBuckets,
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

export function getClinicalStageProgramCount(programs: PipelineProgram[]) {
  const clinicalStages: readonly DevelopmentStage[] = clinicalDevelopmentStages;

  return programs.filter((program) =>
    clinicalStages.includes(program.development.stage),
  ).length;
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
    statuses: developmentStatuses.filter((status) =>
      programs.some((program) => program.development.status === status),
    ),
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

export function getMostAdvancedPrograms(
  programs: PipelineProgram[],
  limit = 5,
): PipelineProgram[] {
  return programs
    .slice()
    .sort((a, b) => {
      const rankDiff =
        (developmentStageRank[b.development.stage] ?? 0) -
        (developmentStageRank[a.development.stage] ?? 0);

      return rankDiff !== 0
        ? rankDiff
        : a.assetName.localeCompare(b.assetName);
    })
    .slice(0, limit);
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
