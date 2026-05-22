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

## G003 Pipeline Contract Note

The former agent-side `run_analysis_pipeline` tool/CLI surface is removed. Pipeline execution is backend-owned, and the agent no longer calls backend HTTP routes directly.

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

## Demo Pi SDK HTTP Service Contract

Implementation surface:
- Node package: `agent/`
- Runtime entrypoint: `agent/src/server.ts`
- Pi SDK runner: `agent/src/pi/piSession.ts`
- Backend client: `backend/agent_client.py`
- Backend merge helpers: `backend/agent_service.py`

Local service:
- `GET /health`
- `POST /report`
- `POST /qa`
- `POST /checklist-explanation`
- default bind: `GONGSIRI_AGENT_HOST=127.0.0.1`, `GONGSIRI_AGENT_PORT=8787`
- backend base URL: `GONGSIRI_AGENT_URL` or `AGENT_SERVICE_URL`, default `http://127.0.0.1:8787`

Request envelope:

```ts
type AgentAnalysisGuard = {
  riskScore: number;
  riskLevel: "normal" | "caution" | "high";
  checklistIds: string[];
};

type AgentServiceRequest = {
  mode?: "report" | "qa" | "checklist_explanation";
  traceId?: string;
  contractVersion?: "v1";
  source?: "user" | "system" | "cron";
  corpCode?: string;
  corpName?: string;
  question?: string; // required for /qa
  checklistIds?: string[]; // optional focus list for /checklist-explanation
  normalizedDataBundle?: Record<string, unknown>;
  bundle?: Record<string, unknown>;
  analysisResult?: Record<string, unknown>;
  preparation?: Record<string, unknown>;
  evidence?: Array<Record<string, unknown>>;
};
```

Response envelope:

```ts
type AgentServiceResponse =
  | {
      ok: true;
      mode: "report" | "qa" | "checklist_explanation";
      traceId: string;
      contractVersion: "v1";
      observedAt: string;
      markdown: string;
      text: string;
      warnings: string[];
      data:
        | {
            report: {
              shortTermMarkdown: string;
              longTermMarkdown: string;
              disclaimerMarkdown: string;
            };
            analysisGuard: AgentAnalysisGuard;
          }
        | {
            qa: {
              answerMarkdown: string;
            };
            analysisGuard: AgentAnalysisGuard;
          }
        | {
            checklistExplanation: {
              summaryMarkdown: string;
              items: Array<{ id: string; title?: string; markdown: string }>;
            };
            analysisGuard: AgentAnalysisGuard;
          };
      evidence: Array<Record<string, unknown>>;
    }
  | {
      ok: false;
      mode: "report" | "qa" | "checklist_explanation";
      traceId: string;
      contractVersion: "v1";
      observedAt: string;
      markdown: "";
      text: "";
      warnings: [];
      error: {
        code:
          | "invalid_request"
          | "method_not_allowed"
          | "not_found"
          | "missing_env"
          | "pi_agent_error"
          | "pi_agent_malformed_output";
        message: string;
      };
      evidence: Array<Record<string, unknown>>;
    };
```

Rules:
- `POST /report`, `POST /qa`, and `POST /checklist-explanation` must use the Pi SDK (`createAgentSession`) with Upstage configured as an OpenAI-compatible provider.
- Strict Pi SDK-first: backend must not fall back to legacy Solar-only QA/report generation when the agent service fails.
- The agent service is leaf-only: it must not call backend HTTP endpoints or mutate DB/report history.
- Runtime tools are disabled for the demo path with `noTools: "all"`; all source material must come from backend-generated JSON context.
- User-facing text must be Korean Markdown, first-person, and explicitly identify the speaker as `공시리`.
- `analysisGuard` is backend-authored deterministic truth echoed through the service boundary; agent-written Markdown must not alter `riskScore`, `riskLevel`, or checklist IDs.
