---
title: "gongsiri 에이전트 HTTP + Pi SDK 전환 결정"
tags: ["gongsiri", "agent", "pi-sdk", "architecture", "http", "decision", "report", "qa"]
created: 2026-05-21T13:21:51.667Z
updated: 2026-05-21T13:21:51.667Z
sources: []
links: ["gongsiri.md", "gongsiri-8.md"]
category: decision
confidence: medium
schemaVersion: 1
---

# gongsiri 에이전트 HTTP + Pi SDK 전환 결정

# gongsiri 에이전트 HTTP + Pi SDK 전환 결정

**날짜:** 2026-05-21 | **상태:** 결정됨, 팀 합의 대기 (CLAUDE.md 규칙 6)

## 배경

report·QA 경로를 에이전트와 연결하는 방법을 논의. 기존 `docs/06`은 subprocess
기반("no HTTP delegation in PR1")이었고, `gongsiri-8.md`의 "보류 결정"이
정확히 이 전환을 별도 PR로 미뤄둔 항목이었음 — 그 항목을 지금 take up.

## 핵심 발견

- 기존 `agent/`는 이름만 "Pi"(`PiDisclosureAgent` 등). 실제 Pi SDK 의존성 0건 —
  무의존성 수제 스켈레톤이었음.
- Pi SDK(`@earendil-works/pi-coding-agent`)는 Node/TS SDK. npm 공개, MIT, Node ≥22.19.
- Pi SDK는 Upstage Solar를 **커스텀 프로바이더**로 지원: `models.json`에
  `baseUrl: https://api.upstage.ai/v1`, `api: openai-completions`, model `solar-pro`.
- Pi SDK는 *코딩* 에이전트 — report+QA 단발 호출엔 `noTools: "all"` 필요.

## 결정

1. **Layered, 단일 프론트 표면.** 프론트는 백엔드(FastAPI)만 호출. 에이전트 존재를 모름.
2. **에이전트 런타임 = 별도 상시 Node HTTP 서비스**, 실제 Pi SDK 사용. 기존 `agent/`를
   이 런타임으로 재구성.
3. **백엔드 서비스 계층이 에이전트를 내부 HTTP로 호출.** 에이전트는 컨트롤러 아래,
   서비스 계층이 부르는 위치.
4. **에이전트는 leaf.** 백엔드 HTTP·운영 DB를 절대 안 건드림 → `backend → agent →
   /pipeline/trigger → backend` 순환 제거.
5. **Option A 분담.** 백엔드가 DART 수집 + 6항목 정량 채점, bundle을 에이전트에 전달.
   에이전트는 Solar 추론 + 리포트 서술/QA 답변 생성. Python analyzer 재포팅 없음.

## 호출 흐름

```
Frontend ──HTTP──> Backend (FastAPI)
                     controller : backend/api/
                       └ service 계층
                           1. collector + analyzer → bundle + 6항목 점수
                           2. ──내부 HTTP──> Agent (Node, Pi SDK) → Solar → draft
                           3. 저장 + 프론트 응답
```

규칙: `frontend→backend` 허용, `backend→agent` 허용, `agent→backend` 금지,
`agent→운영 DB` 금지.

## 범위

- **지금**: report 생성 경로 + QA 경로.
- **보류**: 자율 `disclosureScheduler` 루프(§8) — 같은 상시 서비스에 추후 호스팅.

## 통신 방식: 내부 HTTP (subprocess RPC 아님)

상시 Node 서비스 → Pi 세션 상태 유지 + 추후 스케줄러를 같은 프로세스에 호스팅 가능.

## 후속

- `runAnalysisPipelineTool → POST /pipeline/trigger` 제거/역전.
- `agent/`에 Node HTTP 서버 엔트리포인트 신규.
- QA 브리지 경로 신규 (`docs/10` 보류항목 #2 해소).
- A↔B↔C 시임 변경 → `docs/03-interface-schema.md` 갱신 + 팀 합의 후 머지.

관련: [[gongsiri 에이전트 아키텍처]], [[gongsiri §8 자율 동작 갭]]
