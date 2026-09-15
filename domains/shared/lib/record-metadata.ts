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
       * ADR-0074: a registry identity discovered under this asset's scope but
       * whose ADR-0071 sponsor-resolution cascade confirmed a *different*
       * tracked company/asset as canonical owner. Never a copy of that
       * owner's evidence - purely an operational disposition that suppresses
       * repeat `NEW` discovery noise for the same identity until it fails
       * re-validation (owner company/asset no longer resolves, leadSponsor
       * changed, or CP identity no longer sustains the resolution).
       */
      foreignStudyDispositions?: Record<string, {
        disposition: "CROSS_COMPANY_OWNED";
        ownerCompanyId: string;
        ownerAssetId: string;
        recordedAt: string;
        recordedLeadSponsor: string;
      }>;
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
