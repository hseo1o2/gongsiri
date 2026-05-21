---
title: "gongsiri 에이전트 아키텍처"
tags: ["gongsiri", "agent", "architecture", "pi-agent", "frontend", "backend", "layer"]
created: 2026-05-21T06:10:55.215Z
updated: 2026-05-21T06:10:55.215Z
sources: ["assets/공시리 기획서.pdf §4·§8", "AGENTS.md R&R", "docs/05~07", "agent/src/*"]
links: ["tool-vs-skill.md", "gongsiri-8.md"]
category: architecture
confidence: high
schemaVersion: 1
---

# gongsiri 에이전트 아키텍처

# gongsiri 에이전트 아키텍처

## 팀 R&R (AGENTS.md)

- **A** = 수집·정규화 (`backend/collector/`) → `normalized_data_bundle`
- **B** = 분석·**리포트** (`backend/analyzer/`) → `analysis_result` (단기/장기 리포트 본문, 6항목 체크리스트)
- **C** = Pi 런타임·**오케스트레이션** (`agent/`) → manual prompt runtime, skill/tool orchestration, typed envelope

주의: **리포트 본문 생성은 B(analyzer)의 일**. agent(C)는 리포트를 *쓰는* 게 아니라 *생성을 트리거·오케스트레이션*함.

## 기획서 기준 agent = 레이어 2 "에이전트 코어"

기획서 §4 5개 레이어 중 agent 몫:
1. **스케줄러** — 30분 주기 신규 공시 폴링
2. **수동 트리거** — "지금 공시 체크" 버튼
3. **기억 저장소** — 분석 이력 보존 → 변화 패턴 감지

기획서 §3 "에이전트가 에이전트인 이유" = 능동성·지속성·대화성·기억·포트폴리오 시각. (도구 반복 호출 reasoning loop가 아니라 **자율 동작**으로 정의됨.)

## 프론트 ↔ 에이전트 ↔ backend 관계

프론트와 에이전트는 backend 위에 쌓이는 게 아니라 **형제 클라이언트**다.

```
프론트  ──REST──>  backend/main.py (FastAPI)  ─┐
                                                ├─> backend 도메인 (collector/analyzer)
에이전트 ──subprocess bridge──> python CLI ────┘
```

- `docs/06`: "no HTTP delegation", "backend/main.py remains passive and separate from Pi hosting".
- 프론트 6개 페이지 중 4개(워치리스트·대시보드·리포트·포트폴리오)는 에이전트 무관 — REST 직접.
- 2개(QA·"지금 공시 체크")만 에이전트 경유.

## 현재 agent/ 코드 상태

- ✅ tool 3개: `fetchDisclosures`, `runAnalysisPipeline`, `chatWithSolar`
- ✅ skill 1개: `disclosure-intake-skill` (얇음 — fetch만)
- ✅ `disclosureScheduler.ts`(30분 폴링 골격), `disclosureTrigger.ts`(checkpoint diff), `disclosureCheckpoint.ts`
- subagent 불필요 — 파이프라인이 결정적 고정 순서라 추론 루프 분기 없음.

관련: [[Tool vs Skill — 에이전트 멘탈 모델]], [[gongsiri §8 자율 동작 갭]]

