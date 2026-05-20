export type ResolutionEvidence = {
  source: "corp_code_input" | "keyword_resolution";
  corpCode: string;
  keyword?: string;
  corpName?: string;
};

export type FetchEvidence = {
  source: "dart_fetch";
  disclosureCount: number;
  bgnDe: string;
  endDe: string;
  pageCount: number;
};

export type ToolEvidence = ResolutionEvidence | FetchEvidence;
