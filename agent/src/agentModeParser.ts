import type {
  AgentAnalysisGuard,
  AgentChecklistExplanationItem,
  AgentServiceMode,
  AgentServiceRequest,
  AgentServiceSuccess,
} from "./contracts/agentService.js";

type JsonObject = Record<string, unknown>;
export type ParsedAgentModeResult = Pick<
  AgentServiceSuccess,
  "markdown" | "warnings" | "data"
>;

export class AgentResponseParseError extends Error {}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

function analysisGuardFrom(
  request: AgentServiceRequest,
  parsedChecklist?: unknown[],
): AgentAnalysisGuard {
  const analysis = (
    isObject(request.analysisResult) ? request.analysisResult : {}
  ) as Record<string, unknown>;
  const rawChecklist =
    parsedChecklist ??
    (Array.isArray(analysis.checklist) ? analysis.checklist : []);
  return {
    riskScore:
      typeof analysis.risk_score === "number" ? analysis.risk_score : 0,
    riskLevel:
      analysis.risk_level === "high" ||
      analysis.risk_level === "caution" ||
      analysis.risk_level === "normal"
        ? analysis.risk_level
        : "normal",
    checklistIds: rawChecklist.flatMap((item: unknown) =>
      isObject(item) && typeof item.id === "string" ? [item.id] : [],
    ),
    checklist: rawChecklist,
  };
}

function requireString(
  value: unknown,
  options: { fieldName: string; allowEmpty?: boolean },
): string {
  const { fieldName, allowEmpty = false } = options;
  if (typeof value !== "string") {
    throw new AgentResponseParseError(
      `저 공시리가 ${fieldName} 문자열을 찾지 못했습니다.`,
    );
  }
  if (!allowEmpty && !value.trim()) {
    throw new AgentResponseParseError(
      `저 공시리가 ${fieldName} 문자열을 비워 둘 수 없습니다.`,
    );
  }
  return value;
}

function parseChecklistItems(value: unknown): AgentChecklistExplanationItem[] {
  if (!Array.isArray(value)) {
    throw new AgentResponseParseError(
      "저 공시리가 checklist explanation items 배열을 찾지 못했습니다.",
    );
  }

  return value.map((item) => {
    if (!isObject(item) || typeof item.id !== "string") {
      throw new AgentResponseParseError(
        "저 공시리가 checklist explanation item.id 문자열을 찾지 못했습니다.",
      );
    }
    return {
      id: item.id,
      title: typeof item.title === "string" ? item.title : undefined,
      markdown: requireString(item.markdown, {
        fieldName: "checklist explanation markdown",
      }),
    };
  });
}

export const parseModeResult = (
  mode: AgentServiceMode,
  rawText: string,
  request: AgentServiceRequest,
): ParsedAgentModeResult => {
  // qa mode는 자연어 한국어 답변(free-form markdown)이 계약상 허용된다.
  // (docs/07-pi-agent-contracts.md: "QA 출력: JSON 강제 없음")
  // Solar/Pi가 plain text를 반환하면 answerMarkdown으로 wrapping해 처리한다.
  if (mode === "qa") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // plain text fallback — wrap into qa JSON contract
      parsed = { answerMarkdown: rawText.trim() };
    }
    if (!isObject(parsed)) {
      parsed = { answerMarkdown: rawText.trim() };
    }
    const p = parsed as Record<string, unknown>;
    const warnings = stringArray(p.warnings);
    const parsedChecklist = Array.isArray(p.checklist)
      ? (p.checklist as unknown[])
      : undefined;
    const analysisGuard = analysisGuardFrom(request, parsedChecklist);
    const answerMarkdown = requireString(p.answerMarkdown, {
      fieldName: "answerMarkdown",
    });
    return {
      markdown: answerMarkdown,
      warnings,
      data: {
        qa: { answerMarkdown },
        analysisGuard,
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new AgentResponseParseError(
      "저 공시리가 응답을 mode JSON으로 해석하지 못했습니다.",
    );
  }

  if (!isObject(parsed)) {
    throw new AgentResponseParseError(
      "저 공시리가 응답을 JSON 객체로 해석하지 못했습니다.",
    );
  }

  const warnings = stringArray(parsed.warnings);
  const parsedChecklist = Array.isArray(parsed.checklist)
    ? (parsed.checklist as unknown[])
    : undefined;
  const analysisGuard = analysisGuardFrom(request, parsedChecklist);

  if (mode === "checklist_explanation") {
    const summaryMarkdown = requireString(parsed.summaryMarkdown, {
      fieldName: "summaryMarkdown",
      allowEmpty: true,
    });
    const items = parseChecklistItems(parsed.items);
    const markdown =
      summaryMarkdown.trim() ||
      items.map((item) => `- ${item.markdown}`).join("\n");
    return {
      markdown,
      warnings,
      data: {
        checklistExplanation: {
          summaryMarkdown,
          items,
        },
        analysisGuard,
      },
    };
  }

  const shortTermMarkdown = requireString(parsed.shortTermMarkdown, {
    fieldName: "shortTermMarkdown",
  });
  const longTermMarkdown = requireString(parsed.longTermMarkdown, {
    fieldName: "longTermMarkdown",
    allowEmpty: true,
  });
  const disclaimerMarkdown = requireString(parsed.disclaimerMarkdown, {
    fieldName: "disclaimerMarkdown",
    allowEmpty: true,
  });
  return {
    markdown: [shortTermMarkdown, longTermMarkdown, disclaimerMarkdown]
      .filter(Boolean)
      .join("\n\n"),
    warnings,
    data: {
      report: {
        shortTermMarkdown,
        longTermMarkdown,
        disclaimerMarkdown,
      },
      analysisGuard,
    },
  };
};
