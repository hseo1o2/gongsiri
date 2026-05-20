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
