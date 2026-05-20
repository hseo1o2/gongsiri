export type ContractVersion = "v1";

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
