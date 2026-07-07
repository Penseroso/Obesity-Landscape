import type { developmentStages, developmentStatuses } from "./constants";

export type Company = {
  id: string;
  name: string;
  headquartersCountry: string;
};

export type SourceReference = {
  url: string;
  title?: string;
  sourceType?: string;
  publishedAt?: string;
  checkedAt: string;
};

export type RecordMetadata = {
  lastVerifiedAt: string;
  updatedAt: string;
  sources: SourceReference[];
};

export type TechnicalProfile = {
  mechanism: string | null;
  platform: string | null;
};

export type AdministrationProfile = {
  route: string;
  dosageForm: string;
  dosingInterval: string | null;
};

export type DevelopmentStage = (typeof developmentStages)[number];

export type DevelopmentStatus = (typeof developmentStatuses)[number];

export type DevelopmentProfile = {
  stage: DevelopmentStage;
  status: DevelopmentStatus;
};

export type PipelineProgramRecord = {
  id: string;
  assetId: string;
  companyId: string;
  assetName: string;
  codeName: string | null;
  technical: TechnicalProfile;
  administration: AdministrationProfile;
  indications: string[];
  development: DevelopmentProfile;
  metadata: RecordMetadata;
};

export type PipelineProgram = PipelineProgramRecord & {
  company: Company | null;
};

export type CompanySummary = {
  id: string;
  name: string;
  headquartersCountry: string;
  focusAreas: string[];
  programCount: number;
  mostAdvancedStage?: DevelopmentStage;
  lastUpdated?: string;
};

export type DevelopmentStageFilter = DevelopmentStage | "All";
export type DevelopmentStatusFilter = DevelopmentStatus | "All";

export type ProgramFilters = {
  company: string;
  indication: string;
  route: string;
  stage: DevelopmentStageFilter;
  status: DevelopmentStatusFilter;
  keyword: string;
};

export type ProgramFilterOptions = {
  companies: string[];
  indications: string[];
  routes: string[];
  stages: string[];
  statuses: string[];
};
