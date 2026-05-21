---
title: "Tool vs Skill — 에이전트 멘탈 모델"
tags: ["agent", "tool", "skill", "api", "mental-model", "pi-agent", "gongsiri", "openclaw"]
created: 2026-05-21T06:10:38.020Z
updated: 2026-05-21T06:10:38.020Z
sources: ["2026-05-21 대화: gongsiri agent 설계 논의", "openclaw repo src/tools, src/gateway, skills/*/SKILL.md"]
links: ["gongsiri.md"]
category: pattern
confidence: high
schemaVersion: 1
---

# Tool vs Skill — 에이전트 멘탈 모델

# Tool vs Skill — 에이전트 멘탈 모델

gongsiri Pi 에이전트 설계 중 정립한 핵심 개념. openclaw(373k★) 레퍼런스로 교차검증됨.

## Tool = 단일 능력 (손)

- `invoke()` 하나 = 한 가지 행동. 결정적. typed request in → typed result out.
- openclaw `src/tools/types.ts`의 `ToolDescriptor`: `{ name, description, inputSchema, outputSchema, owner, executor, availability }`.
- gongsiri tool 3개: `fetch_disclosures`(공시), `run_analysis_pipeline`(분석), `chat_with_solar`(Solar Q&A).

## Skill = 절차·노하우 (머리)

- "이런 종류의 일은 → 어떤 툴을 → 어떤 요청으로 → 어떤 순서로 쓴다"는 패키지된 노하우.
- 툴을 직접 실행하지 않음. 툴을 *언제·어떻게* 쓸지 알 뿐.
- openclaw `skills/*/SKILL.md` = 코드가 아니라 **frontmatter(name/description) + 지침 마크다운**.
- gongsiri skill: `disclosure-intake-skill` 하나뿐 — `fetch_disclosures`만 엮은 얇은 절차.

## 계층

```
Agent (프롬프트/트리거 받고 처리 가능 판단)
  └─ Skill (어떤 툴을, 어떤 요청으로, 어떤 순서로)
       └─ Tool (실제 실행)
```

비유: **Tool = 망치·드라이버 / Skill = 조립 설명서 / Agent = 작업자**.

## Tool vs API — `tool ⊃ API`

- 기계적으로 tool 호출 = API 호출 (동일).
- 차이는 **명세 대상**: API = 개발자용 계약 / Tool = 모델용 계약.
- Tool = API + 자연어 description + JSON schema + availability → **LLM이 "이걸 쓸까" 스스로 판단**할 수 있게 한 겹 더.
- openclaw `ToolDescriptor.executor.kind`는 `core | plugin | channel | mcp` — 외부 API를 tool로 노출하는 정석은 MCP.

## "어떤 엔드포인트를 tool로 감쌀까" — 판단 기준

> **"에이전트가 이걸로 *판단/추론*을 하는가, 사람이 *보기만* 하는가?"**

- 주가·공시 → 에이전트가 작전주 6항목 판정에 씀 → tool ✅
- 워치리스트 CRUD·리포트 열람 → 사람이 화면에서 보기만 함 → tool ❌
- 모든 엔드포인트가 아니라 **추론에 필요한 부분집합만** tool로 래핑.

관련: [[gongsiri 에이전트 아키텍처]]

