import {
  clinicalDevelopmentStages,
  developmentStageRank,
  developmentStages,
  developmentStatuses,
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
