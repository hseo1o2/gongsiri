import { execFile } from "node:child_process";

import type { SolarChatRequest, SolarChatResult, SolarChatFailure } from "../contracts/chat.js";
import { SOLAR_CHAT_TOOL_NAME } from "../contracts/chat.js";
import { loadLocalEnvFiles } from "../env/loadLocalEnv.js";

type ExecFileLike = typeof execFile;

type CreateSolarChatToolOptions = {
  pythonBin?: string;
  env?: Record<string, string | undefined>;
  execFileImpl?: ExecFileLike;
};

const DEFAULT_CONTRACT_VERSION = "v1" as const;
const DEFAULT_MODEL = "solar-pro3";
const DEFAULT_TRACE_ID = "solar-chat-trace";

const PYTHON_SCRIPT = `
import json, os, sys, urllib.request, urllib.error
request = json.loads(os.environ["SOLAR_CHAT_REQUEST"])
api_key = os.environ.get("UPSTAGE_API_KEY")
model = os.environ.get("UPSTAGE_MODEL") or "${DEFAULT_MODEL}"
trace_id = request.get("traceId") or "${DEFAULT_TRACE_ID}"
contract_version = request.get("contractVersion") or "${DEFAULT_CONTRACT_VERSION}"
if not api_key:
    print(json.dumps({
        "ok": False,
        "traceId": trace_id,
        "contractVersion": contract_version,
        "observedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "error": {"code": "missing_env", "message": "UPSTAGE_API_KEY가 설정되지 않았습니다."}
    }, ensure_ascii=False))
    sys.exit(1)
payload = {
    "model": model,
    "messages": [],
    "stream": False,
    "temperature": 0,
}
system_prompt = request.get("systemPrompt")
if system_prompt:
    payload["messages"].append({"role": "system", "content": system_prompt})
payload["messages"].append({"role": "user", "content": request["prompt"]})
req = urllib.request.Request(
    "https://api.upstage.ai/v1/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    method="POST"
)
req.add_header("Authorization", f"Bearer {api_key}")
req.add_header("Content-Type", "application/json")
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
        parsed = json.loads(body)
        text = parsed["choices"][0]["message"]["content"]
        print(json.dumps({
            "ok": True,
            "traceId": trace_id,
            "contractVersion": contract_version,
            "observedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "model": parsed.get("model") or model,
            "text": text
        }, ensure_ascii=False))
except urllib.error.HTTPError as exc:
    body = exc.read().decode("utf-8", "ignore")
    print(json.dumps({
        "ok": False,
        "traceId": trace_id,
        "contractVersion": contract_version,
        "observedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "error": {"code": "solar_api_error", "message": f"HTTP {exc.code}: {body[:500]}"}
    }, ensure_ascii=False))
    sys.exit(1)
except Exception as exc:
    print(json.dumps({
        "ok": False,
        "traceId": trace_id,
        "contractVersion": contract_version,
        "observedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "error": {"code": "solar_api_error", "message": str(exc)}
    }, ensure_ascii=False))
    sys.exit(1)
`;

const buildFailure = (
  request: SolarChatRequest,
  code: SolarChatFailure["error"]["code"],
  message: string
): SolarChatFailure => ({
  ok: false,
  traceId: request.traceId ?? DEFAULT_TRACE_ID,
  contractVersion: request.contractVersion ?? DEFAULT_CONTRACT_VERSION,
  observedAt: new Date().toISOString(),
  error: { code, message }
});

const isSolarChatResult = (value: unknown): value is SolarChatResult => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.ok === "boolean" &&
    typeof candidate.traceId === "string" &&
    typeof candidate.contractVersion === "string" &&
    typeof candidate.observedAt === "string"
  );
};

const runExecFile = async (
  execFileImpl: ExecFileLike,
  pythonBin: string,
  args: string[],
  env: Record<string, string | undefined>
): Promise<{ exitCode: number; stdout: string; stderr: string }> =>
  new Promise((resolve) => {
    execFileImpl(
      pythonBin,
      args,
      {
        env,
        maxBuffer: 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            exitCode: typeof error.code === "number" ? error.code : 1,
            stdout,
            stderr
          });
          return;
        }

        resolve({ exitCode: 0, stdout, stderr });
      }
    );
  });

export type SolarChatTool = {
  descriptor: {
    name: typeof SOLAR_CHAT_TOOL_NAME;
    description: string;
    pythonCommand: "python3 -c <script>";
  };
  invoke(request: SolarChatRequest): Promise<SolarChatResult>;
};

export const createSolarChatTool = (
  options: CreateSolarChatToolOptions = {}
): SolarChatTool => ({
  descriptor: {
    name: SOLAR_CHAT_TOOL_NAME,
    description: "Live Upstage Solar chat tool for Pi runtime verification.",
    pythonCommand: "python3 -c <script>"
  },
  async invoke(request: SolarChatRequest): Promise<SolarChatResult> {
    loadLocalEnvFiles();
    const env = {
      ...process.env,
      ...options.env,
      SOLAR_CHAT_REQUEST: JSON.stringify({
        ...request,
        traceId: request.traceId ?? DEFAULT_TRACE_ID,
        contractVersion: request.contractVersion ?? DEFAULT_CONTRACT_VERSION
      })
    };
    const pythonBin = options.pythonBin ?? process.env.PYTHON_BIN ?? "python3";
    const { stdout, stderr } = await runExecFile(
      options.execFileImpl ?? execFile,
      pythonBin,
      ["-c", PYTHON_SCRIPT],
      env
    );

    const raw = stdout.trim();
    if (!raw) {
      return buildFailure(
        request,
        "solar_malformed_output",
        stderr.trim() || "저 공시리가 Solar chat stdout에서 응답 본문을 찾지 못했습니다."
      );
    }

    try {
      const parsed = JSON.parse(raw);
      if (isSolarChatResult(parsed)) {
        return parsed;
      }

      return buildFailure(
        request,
        "solar_malformed_output",
        "저 공시리가 Solar chat 응답을 계약 형태로 해석하지 못했습니다."
      );
    } catch (error) {
      return buildFailure(
        request,
        "solar_malformed_output",
        error instanceof Error ? error.message : "저 공시리가 Solar chat JSON을 파싱하지 못했습니다."
      );
    }
  }
});

export const solarChatTool = createSolarChatTool();
