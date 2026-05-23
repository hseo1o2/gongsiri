import * as nodePath from "node:path";
import * as nodeUrl from "node:url";

/**
 * 호출 파일의 __dirname(또는 import.meta.url 기준 디렉터리)에서
 * dist/ 디렉터리까지 올라가 agent 패키지 루트를 찾는다.
 *
 * 컴파일 결과물 위치에 따른 단계 수:
 *   dist/pi/piSession.js  → 두 단계 위가 루트
 *   dist/agentPrompt.js   → 한 단계 위가 루트
 *
 * 어느 경우든 "dist"라는 이름의 세그먼트가 나올 때까지 올라가면
 * 그 한 단계 위가 루트다.
 */
export const resolveAgentRoot = (): string => {
  const currentDir =
    typeof __dirname !== "undefined"
      ? __dirname
      : nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));

  // dist 세그먼트를 찾아 그 부모를 반환한다.
  const parts = currentDir.split(nodePath.sep);
  const distIdx = parts.lastIndexOf("dist");
  if (distIdx !== -1) {
    return parts.slice(0, distIdx).join(nodePath.sep);
  }
  // fallback: 한 단계 위 (개발 환경 등)
  return nodePath.resolve(currentDir, "..");
};

/**
 * 지정한 skill 이름에 해당하는 SKILL.md 경로를 반환한다.
 */
export const resolveSkillPath = (skillName: string): string => {
  const root = resolveAgentRoot();
  return nodePath.join(root, ".pi", "skills", skillName, "SKILL.md");
};
