---
title: "gongsiri §8 자율 동작 갭"
tags: ["gongsiri", "agent", "next-steps", "disclosure-monitoring-skill", "gap", "pipeline", "resolved", "pi-sdk", "http"]
created: 2026-05-21T06:11:07.495Z
updated: 2026-05-21T13:22:18.582Z
sources: ["기획서 §8", "agent/src/triggers/disclosureTrigger.ts", "agent/src/tools/runAnalysisPipeline.ts"]
links: ["gongsiri.md", "tool-vs-skill.md", "gongsiri-http-pi-sdk.md"]
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

---

## Update (2026-05-21T13:22:18.582Z)

## "보류 결정" 갱신 (2026-05-21) — 전환 채택됨

위 "보류 결정"의 `subprocess→REST 전환` / `docs/06 'no HTTP delegation' 개정` 항목이
**채택됨**. 더 이상 보류 아님:

- 에이전트 런타임을 별도 상시 Node HTTP 서비스 + Pi SDK로 전환 결정.
- `docs/06`의 "no HTTP delegation" / "passive backend" 제약은 개정 완료
  ("HTTP + Pi SDK Architecture Decision (2026-05-21)" 섹션).
- `backend → agent → /pipeline/trigger` 순환은 백엔드 서비스 → 에이전트 단방향 HTTP로
  역전. 에이전트는 leaf.

### §8 갭 현황 (갱신)

| §8 단계 | 상태 |
|---|---|
| 감지 → 자동 파이프라인 실행 | 🔜 report 경로로 해소 예정 (이번 범위) |
| QA 에이전트 경유 | 🔜 QA 경로로 해소 예정 (이번 범위, docs/10 #2) |
| 자율 스케줄러 루프 | ⏳ 여전히 보류 — 상시 Node 서비스에 추후 호스팅 |

상세: [[gongsiri 에이전트 HTTP + Pi SDK 전환 결정]]
