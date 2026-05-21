export type ContractVersion = "v1";
export type TriggerSource = "user" | "system" | "cron";

type SharedFetchDisclosuresFields = {
  bgnDe?: string;
  endDe?: string;
  pageCount?: number;
  traceId?: string;
  contractVersion?: ContractVersion;
};

export type FetchDisclosuresByKeywordRequest = SharedFetchDisclosuresFields & {
  keyword: string;
  corpCode?: string;
};

export type FetchDisclosuresByCorpCodeRequest = SharedFetchDisclosuresFields & {
  corpCode: string;
  keyword?: string;
};

export type FetchDisclosuresRequest =
  | FetchDisclosuresByKeywordRequest
  | FetchDisclosuresByCorpCodeRequest;

export type PromptRequest = {
  text: string;
  traceId?: string;
  contractVersion?: ContractVersion;
};

export type TriggerMetadata = {
  intervalMinutes?: number;
  runReason?: string;
  newDisclosureCount?: number;
  newDisclosureIds?: string[];
};

export type DisclosureTriggerRequest = FetchDisclosuresRequest & {
  source: TriggerSource;
  metadata?: TriggerMetadata;
};

export type DisclosureTriggerInput = {
  source: TriggerSource;
  keyword?: string;
  corpCode?: string;
  traceId?: string;
  contractVersion?: ContractVersion;
  intervalMinutes?: number;
  runReason?: string;
};
