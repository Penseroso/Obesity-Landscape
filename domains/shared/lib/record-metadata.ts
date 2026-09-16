export type SourceReference = {
  url: string;
  title?: string;
  sourceType?: string;
  publishedAt?: string;
  checkedAt: string;
};

export type ResearchStateMetadata = {
  checkpointVersion: 1;
  workflowRevision: string;
  discoveryCheckpoint: {
    asOf: string;
    secEdgar?: {
      cik: string;
      latestAcceptanceDateTime: string;
      latestAccessionNumber?: string;
    };
    clinicalTrials?: {
      semanticFingerprintVersion?: number;
      sponsorQuery?: string;
      assetAliases?: string[];
      lastQueriedAt?: string;
      knownNCTs?: Record<string, {
        lastUpdatePostDate: string;
        semanticHash?: string;
      }>;
      /**
       * ADR-0074: a registry identity discovered under this focal CE leaf's
       * scope (an asset leaf or a Regimen-native leaf, ADR-0076) but
       * whose ADR-0071 sponsor-resolution cascade confirmed a *different*
       * tracked company as canonical owner. Never a copy of that owner's
       * evidence - purely an operational disposition that suppresses repeat
       * `NEW` discovery noise for the same identity until it fails
       * re-validation (owner company/entity no longer resolves, leadSponsor
       * changed, or CP identity no longer sustains the resolution).
       *
       * The owner entity within that company is exactly one of
       * `ownerAssetId` (Program-anchored) or `ownerRegimenId` (Regimen-native,
       * ADR-0076 follow-up, ADR-0074 attribution closure) - mirroring
       * `ClinicalStudyRecord`'s own `assetId`/`regimenId` discriminant.
       * ADR-0071's cascade still decides *which company*; this field alone
       * decides *which entity within that company* - that responsibility
       * boundary does not move.
       */
      foreignStudyDispositions?: Record<string, {
        disposition: "CROSS_COMPANY_OWNED";
        ownerCompanyId: string;
        recordedAt: string;
        recordedLeadSponsor: string;
      } & (
        | { ownerAssetId: string; ownerRegimenId?: undefined }
        | { ownerRegimenId: string; ownerAssetId?: undefined }
      )>;
    };
    literature?: {
      assetAliases?: string[];
      lastQueriedAt?: string;
      monitoredPMIDs?: Record<string, {
        status: "clean" | "has-erratum" | "retracted";
        noticeFingerprint?: string;
        noticeTypes?: string[];
        lastCheckedAt: string;
      }>;
    };
  };
};

export type RecordMetadata = {
  lastVerifiedAt: string;
  updatedAt: string;
  sources: SourceReference[];
};
