import * as nodeFs from "node:fs";
import type {
  AgentChecklistExplanationRequest,
  AgentQaRequest,
  AgentReportRequest,
  AgentServiceRequest,
} from "./contracts/agentService.js";
import { resolveSkillPath } from "./agentPaths.js";

// YAML frontmatter(--- 블록)를 제거하고 마크다운 본문만 반환한다.
function stripFrontmatter(content: string): string {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) {
    return content;
  }
  const end = trimmed.indexOf("---", 3);
  if (end === -1) {
    return content;
  }
  return trimmed.slice(end + 3).trimStart();
}

// 지정한 skill 이름의 SKILL.md 본문을 읽어 frontmatter를 제거해 반환한다.
function loadSkillBody(skillName: string): string {
  const skillPath = resolveSkillPath(skillName);
  try {
    const raw = nodeFs.readFileSync(skillPath, "utf8");
    return stripFrontmatter(raw);
  } catch (err) {
    throw new Error(
      `SKILL.md를 읽지 못했습니다: ${skillPath} — ${String(err)}`,
    );
  }
}

function contextFrom(request: AgentServiceRequest): unknown {
  if ("context" in request && request.context !== undefined) {
    return request.context;
  }
  if (
    request.bundle ||
    request.normalizedDataBundle ||
    request.analysisResult ||
    request.preparation
  ) {
    return {
      corpCode: request.corpCode,
      corpName: request.corpName,
      normalizedDataBundle: request.normalizedDataBundle ?? request.bundle,
      analysisResult: request.analysisResult,
      preparation: request.preparation,
    };
  }
  return undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export const buildPrompt = (request: AgentServiceRequest): string => {
  const context = JSON.stringify(contextFrom(request), null, 2);

  if (request.mode === "qa") {
    const skillBody = loadSkillBody("gongsiri-qa");
    return [
      skillBody,
      `질문: ${(request as AgentQaRequest).question}`,
      "JSON context:",
      context,
    ].join("\n\n");
  }

  if (request.mode === "checklist_explanation") {
    const skillBody = loadSkillBody("gongsiri-checklist-explanation");
    const checklistIds = stringArray(
      (request as AgentChecklistExplanationRequest).checklistIds,
    );
    return [
      skillBody,
      checklistIds.length > 0
        ? `설명 대상 checklist ids: ${checklistIds.join(", ")}`
        : "설명 대상 checklist ids: analysisResult.checklist 전체",
      "JSON context:",
      context,
    ].join("\n\n");
  }

  // report (기본)
  const skillBody = loadSkillBody("gongsiri-report");
  const parts = [skillBody];
  const extraPrompt = (request as AgentReportRequest).prompt;
  if (extraPrompt) {
    parts.push(`추가 작성 지시: ${extraPrompt}`);
  }
  parts.push("JSON context:", context);
  return parts.join("\n\n");
};
