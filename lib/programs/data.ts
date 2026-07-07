import companyData from "@/data/generated/companies.json";
import pipelineProgramData from "@/data/generated/pipeline-programs.json";
import regimenData from "@/data/generated/regimens.json";
import type {
  Company,
  PipelineProgram,
  PipelineProgramRecord,
  Regimen,
  RegimenRecord,
} from "./types";

export const companies = companyData as Company[];
export const pipelineProgramRecords =
  pipelineProgramData as PipelineProgramRecord[];
export const regimenRecords = regimenData as RegimenRecord[];

const companiesById = new Map(companies.map((company) => [company.id, company]));

export const pipelinePrograms: PipelineProgram[] = pipelineProgramRecords.map(
  (program) => ({
    ...program,
    company: companiesById.get(program.companyId) ?? null,
  }),
);

export const regimens: Regimen[] = regimenRecords.map((regimen) => ({
  ...regimen,
  company: companiesById.get(regimen.companyId) ?? null,
}));
