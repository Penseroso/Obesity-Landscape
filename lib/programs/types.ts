import type { developmentStatuses } from "./constants";

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

export type AssetType =
  | "single-asset"
  | "fixed-dose-combination"
  | "co-formulation";

export type ComponentReference = {
  assetId?: string;
  assetName?: string;
  codeName?: string;
  companyId?: string;
  externalCompanyName?: string;
  role?: string;
};

export type CompanyRelationship = {
  companyId?: string;
  externalCompanyName?: string;
  role: string;
  territories?: string[];
  rights?: string[];
  effectiveDate?: string;
  sourceUrls?: string[];
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

export type DevelopmentStage = string;

export type DevelopmentStatus = (typeof developmentStatuses)[number];

export type DevelopmentProfile = {
  stage: DevelopmentStage;
  status: DevelopmentStatus;
};

export type RegulatoryStateReference = {
  state: string;
  jurisdiction: string;
  authority: string;
  date?: string;
};

export type PipelineProgramRecord = {
  id: string;
  assetId: string;
  companyId: string;
  assetType?: AssetType;
  assetName: string;
  codeName: string | null;
  components?: ComponentReference[];
  technical: TechnicalProfile;
  administration: AdministrationProfile;
  indications: string[];
  development: DevelopmentProfile;
  regulatoryStates?: RegulatoryStateReference[];
  relationships?: CompanyRelationship[];
  metadata: RecordMetadata;
};

export type PipelineProgram = PipelineProgramRecord & {
  company: Company | null;
};

export type RegimenRecord = {
  id: string;
  companyId: string;
  name: string;
  configurationKey?: string;
  components: ComponentReference[];
  indications: string[];
  development: DevelopmentProfile;
  regulatoryStates?: RegulatoryStateReference[];
  administration?: AdministrationProfile;
  relationships?: CompanyRelationship[];
  metadata: RecordMetadata;
};

export type Regimen = RegimenRecord & {
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
