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
  researchState?: ResearchStateMetadata;
};
