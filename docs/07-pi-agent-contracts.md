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

> 2026-05-25 갱신: agent → backend subprocess(`execFile python3 -m backend.*`) 호출이 **HTTP internal endpoint**로 일원화되었다. 이 결정은 `docs/06-pi-agent-architecture.md` Architecture Decision (2026-05-21) 의 구현이며, A↔B↔C 인터페이스 변경에 해당한다.

Canonical invocation:

```
POST {AGENT_BACKEND_URL}/internal/disclosures
content-type: application/json

<FetchDisclosuresRequest JSON body, with traceId/contractVersion injected by the agent>
```

Rules:

- backend route는 `backend/routes/disclosure_routes.py` (`APIRouter(tags=["internal"])`, `@router.post("/internal/disclosures")`) 로 노출되며, `backend/main.py` 의 `include_router(disclosure_router)` 로 마운트된다.
- request body schema 는 기존 `FetchDisclosuresRequest` 와 1:1 — `keyword` 또는 `corpCode` 중 하나 필수, `bgnDe`/`endDe`/`pageCount` 선택, `traceId`/`contractVersion` 은 agent가 주입.
- response body 는 `ToolResult` envelope (`ok`/`traceId`/`contractVersion`/`observedAt`/`data | error`/`evidence`) — 기존 subprocess stdout JSON 그대로다.
- backend 는 envelope-driven status 를 사용한다: `ok:true` → 200, `invalid_request`/`corp_code_unresolved` → 400, `missing_env` → 503, 그 외 → 500. agent fetch 레이어는 status 와 무관하게 body 를 ToolResult 로 파싱한다.
- network/timeout/connect 실패 → `bridge_process_failed`. JSON 파싱 실패 또는 envelope contract 미충족 → `bridge_malformed_output`. agent fetch 호출은 30 초 `AbortController` 타임아웃을 적용한다.
- `/internal/*` 는 외부 노출 금지 — Compose internal network / Railway internal-only 토폴로지에서 동작한다. MVP 단계에서 인증/토큰은 도입하지 않는다.
- backend URL 은 `AGENT_BACKEND_URL` 환경변수로 해석한다 (default `http://127.0.0.1:8000`). 신조어 금지.

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

> 2026-05-25 제거됨: 별도 `chat_with_solar` tool / `disclosure-expert-skill` / `runSolarChat` CLI 는 production QA/report 경로에 도달하지 않는 dead code 였다. Solar 호출 단일 진입점은 `agent/src/pi/piSession.ts (runPiSolarChat)` → Pi SDK → Upstage 이며, 본 문서의 "Demo Pi SDK HTTP Service Contract" 가 SoT 다. JSON-mode 결정론적 호출이 필요해질 경우 `backend/analyzer/solar_client.py:chat_json()` 또는 `runPiSolarChat` 에 JSON 옵션 추가 경로를 사용한다.

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
