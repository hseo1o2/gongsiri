# 07. Pi Agent Contracts — PR1

## Purpose
Pi runtime envelope 계약을 문서화해서 future TypeScript runtime implementation이 Python truth와 충돌하지 않게 한다.

## Tool Request Contract
Tool name: `fetch_disclosures`

Accepted request:

```ts
type FetchDisclosuresRequest =
  | {
      keyword: string;
      bgnDe?: string;
      endDe?: string;
      pageCount?: number;
    }
  | {
      corpCode: string;
      bgnDe?: string;
      endDe?: string;
      pageCount?: number;
    };
```

Rules:
- `corpCode` wins when both inputs are present
- at least one of `keyword` or `corpCode` must be present
- runtime contract version for PR1 is `v1`

## Tool Result Contract
```ts
type ToolResultSuccess = {
  ok: true;
  traceId: string;
  contractVersion: "v1";
  observedAt: string;
  data: {
    corpCode: string;
    company: {
      corp_name: string;
      stock_code: string;
      corp_code?: string;
      market?: string;
    } | null;
    disclosures: Array<{
      rcept_no: string;
      report_nm: string;
      rcept_dt: string;
      parsed_text?: string | null;
      url?: string | null;
      category?: string | null;
    }>;
  };
  evidence: Array<Record<string, unknown>>;
};

type ToolResultFailure = {
  ok: false;
  traceId: string;
  contractVersion: "v1";
  observedAt: string;
  error: {
    code:
      | "invalid_request"
      | "corp_code_unresolved"
      | "missing_env"
      | "dart_api_error"
      | "bridge_process_failed"
      | "bridge_malformed_output";
    message: string;
  };
  evidence: [];
};
```

## Agent-Level Expectations
- `PiDisclosureAgent` selects `disclosure-intake-skill` for disclosure-oriented prompts.
- `disclosure-intake-skill` delegates to `fetch_disclosures`.
- agent response must preserve `traceId`, `contractVersion`, and tool evidence.

## Bridge Invocation Contract
Canonical command:

```bash
python -m backend.collector.cli.fetch_disclosures
```

Rules:
- stdout emits JSON only
- stderr is diagnostic only
- nonzero exit with **no valid ToolResult JSON** must map to `bridge_process_failed` in the TS runner layer
- nonzero exit with a valid typed failure envelope may pass through intact
- malformed stdout JSON must map to `bridge_malformed_output`

## Side-Effect Rule
- `assets/stock_master.json` is read-only for Pi runtime execution.
- PR1 runtime paths must use read-only company resolution and must not call `save_company_to_master()` while serving a tool request.

## G002 Trigger Contract
Trigger source is extended to:

```ts
type TriggerSource = "user" | "system" | "cron";
```

Triggered disclosure checks accept:

```ts
type DisclosureTriggerRequest = FetchDisclosuresRequest & {
  source: TriggerSource;
  metadata?: {
    intervalMinutes?: number;
    runReason?: string;
  };
};
```

Triggered disclosure checks return:

```ts
type TriggeredDisclosureResult = {
  ok: boolean;
  triggerSource: TriggerSource;
  traceId: string;
  contractVersion: "v1";
  hasNewDisclosure: boolean;
  newDisclosureCount: number;
  newDisclosureIds: string[];
  checkpoint: {
    checkpointPath: string;
    previousLastSeen: string | null;
    currentLastSeen: string | null;
  };
  result: ToolResult;
};
```

Rules:
- successful runs may update ignored local checkpoint state
- failed runs must not advance the checkpoint
- first successful run initializes checkpoint state without counting all existing disclosures as new

## G003 Pipeline Contract

Tool name: `run_analysis_pipeline`

Accepted request:

```ts
type PipelineTriggerRequest = {
  source: "user" | "system" | "cron";
  keyword?: string;
  corpCode?: string;
  traceId?: string;
  contractVersion?: "v1";
  metadata?: {
    intervalMinutes?: number;
    runReason?: string;
  };
};
```

Rules:
- at least one of `keyword` or `corpCode` must be present
- runtime pipeline path must support both request forms
- pipeline normalization path must be read-only/additive

Returned envelope:

```ts
type PipelineResult = {
  ok: boolean;
  triggerSource: "user" | "system" | "cron";
  traceId: string;
  contractVersion: "v1";
  observedAt: string;
  result?: {
    normalizedDataBundle: Record<string, unknown>;
    analysisResult: {
      risk_score: number;
      risk_level: "normal" | "caution" | "high";
      checklist: Array<{
        id: string;
        title: string;
        status: "pass" | "fail" | "unknown";
        score: number;
        reason: string;
        evidence: string[];
      }>;
      short_term_report: string;
      long_term_report: string;
      disclaimer: string;
      missing_evidence: string[];
    };
    preparation: {
      persistence: Record<string, unknown>;
      notification: Record<string, unknown>;
    };
  };
  error?: {
    code: string;
    message: string;
  };
  evidence: Array<Record<string, unknown>>;
};
```

Rules:
- stdout must remain JSON-only
- failures must remain machine-readable
- preparation payloads are interfaces only and must not trigger real DB writes or notification delivery

## Solar Chat Contract

Tool name: `chat_with_solar`

Accepted request:

```ts
type SolarChatRequest = {
  prompt: string;
  systemPrompt?: string;
  traceId?: string;
  contractVersion?: "v1";
};
```

Returned envelope:

```ts
type SolarChatResult =
  | {
      ok: true;
      traceId: string;
      contractVersion: "v1";
      observedAt: string;
      model: string;
      text: string;
    }
  | {
      ok: false;
      traceId: string;
      contractVersion: "v1";
      observedAt: string;
      error: {
        code: "missing_env" | "solar_api_error" | "solar_malformed_output";
        message: string;
      };
    };
```

Rules:
- `UPSTAGE_API_KEY` must come from env, never tracked files
- the runtime may default `UPSTAGE_MODEL` to `solar-pro3`
- stdout remains JSON-only and safe to use as PR evidence
