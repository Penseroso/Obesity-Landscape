import type { RecordMetadata } from "@/domains/shared/lib/record-metadata";
import type { developmentStatuses, StageBucketId } from "./constants";

export type {
  RecordMetadata,
  SourceReference,
} from "@/domains/shared/lib/record-metadata";

export type Company = {
  id: string;
  name: string;
  headquartersCountry: string;
};

export type AssetType =
  | "single-asset"
  | "fixed-dose-combination"
  | "co-formulation";

/**
 * Contract 1.1 asset alias types. The runtime value list is single-sourced in
 * `asset-alias-types.json` (see `constants.ts` and the validator); this union
 * is its compile-time counterpart.
 */
export type AssetAliasType =
  | "former-name"
  | "development-code"
  | "brand-name"
  | "alternative-spelling";

/**
 * An alternative label for the asset that is not its current official
 * canonical `assetName`: a former name after a rename, a confirmed internal
 * development code, a brand name, or an alternative spelling. Aliases support
 * search and traceability; they never change `assetId` or asset identity.
 */
export type AssetAlias = {
  type: AssetAliasType;
  value: string;
};

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

export type DevelopmentStageBasis =
  | "Sponsor-declared current pipeline stage"
  | "Operational evidence"
  | "Official regulatory-development milestone";

export type DevelopmentStageOperationalState =
  | "Initiated or active"
  | "Active not recruiting"
  | "Not yet recruiting"
  | "Planned, not yet initiated"
  | "Submitted, pending clearance"
  | "Cleared, not yet initiated"
  | "Paused"
  | "Completed"
  | "Not separately confirmed";

export type DevelopmentProfile = {
  stage: DevelopmentStage;
  status: DevelopmentStatus;
  stageBasis?: DevelopmentStageBasis;
  stageOperationalState?: DevelopmentStageOperationalState;
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
  aliases?: AssetAlias[];
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
  /**
   * Authored mechanism-family id from `mechanism-families.json`.
   *
   * A Regimen carries no `technical.mechanism` of its own - only free-text
   * component `role`s, which must never be parsed to derive pharmacology. The
   * family is therefore assigned explicitly here, and must name a
   * `multi-component` family because a regimen is by definition more than one
   * independently administered product. Absent means unassigned: such a regimen
   * is dispositioned as a coverage gap on comparison surfaces, never bucketed
   * into an "other" family.
   */
  mechanismFamilyId?: string;
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
/**
 * Overview stage-bucket filter. Coarser than `stage` (a single stage label):
 * a bucket such as `phase-1` aggregates several labels. URL-driven only (the
 * Company × Development Stage Matrix drill-down); the FilterBar exposes the
 * label-level `stage` control, not this. Defaults to "All".
 */
export type StageBucketFilter = StageBucketId | "All";

export type ProgramFilters = {
  company: string;
  indication: string;
  route: string;
  stage: DevelopmentStageFilter;
  stageBucket: StageBucketFilter;
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
