---
title: "gongsiri §8 자율 동작 갭"
tags: ["gongsiri", "agent", "next-steps", "disclosure-monitoring-skill", "gap", "pipeline"]
created: 2026-05-21T06:11:07.495Z
updated: 2026-05-21T06:11:07.495Z
sources: ["기획서 §8", "agent/src/triggers/disclosureTrigger.ts", "agent/src/tools/runAnalysisPipeline.ts"]
links: ["gongsiri.md", "tool-vs-skill.md"]
category: decision
confidence: high
schemaVersion: 1
---

# gongsiri §8 자율 동작 갭

# gongsiri §8 자율 동작 갭

## 핵심 문제: 에이전트 코어 루프가 분절돼 있음

기획서 §8 흐름: `트리거 → 신규 공시 감지 → 자동 파이프라인 → 점수 분기 → 알림 → 이력 저장`.

현재 구현은 **감지와 분석이 끊겨 있음**:
- `runTriggeredDisclosureCheck` → `fetchDisclosures`만 하고 **끝** (감지에서 멈춤)
- `runAnalysisPipelineTool` → 완전 별개 CLI (`runPipelineTrigger.ts`)
- 둘을 잇는 코드 없음

## 갭 표 (기획서 §8 vs 현재)

| §8 단계 | 상태 |
|---|---|
| 스케줄러 / 수동 트리거 | ✅ |
| 신규 공시 감지 | ✅ |
| 감지 → **자동 파이프라인 실행** | ❌ 끊김 |
| 4↑ 경고 / 3↓ STEP2 분기 | ❌ agent 분기 없음 |
| 알림 발송 | ❌ preparation payload만 (G003 경계) |
| 분석 이력 저장 | ⚠️ checkpoint = 마지막 rcept_no만 |

## 다음 작업: `disclosure-monitoring-skill`

- 새 tool 0개. 기존 tool 3개를 엮는 **새 skill 1개**.
- 절차: 감지(fetch) → 신규 있으면 분석(pipeline) → risk_level 분기 → 이력 저장.
- AGENTS.md 워크플로: `docs/05-feature-spec.md`에 기능 ID 먼저 등록 → `feature/<owner>-<scope>` 브랜치 → 구현.

## 보류 결정

- backend HTTP 통일 / subprocess→REST 전환은 **재플랫폼**이지 "기획서 채우기"가 아님.
- `docs/06` "no HTTP delegation" 개정 + 팀 합의 필요 → skill 작업 이후 별도 PR.
- 현 subprocess bridge는 동작·테스트 통과 중. 스키마는 이미 `backend/schemas/` + `docs/03·07`로 단일 출처.

관련: [[gongsiri 에이전트 아키텍처]], [[Tool vs Skill — 에이전트 멘탈 모델]]

