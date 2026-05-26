# AGENTS.md — gongsiri 팀 R&R

> 공시리 = 관심종목 공시를 자동 모니터링하고 작전주 6개 항목을 판별해 경고/리포트를 보내는 개인 주식 AI 에이전트.
> 작업 전 반드시 `docs/`를 먼저 읽는다 (인터페이스·스키마·기능 ID 모두 `docs/`가 SoT, 모호 시 `assets/공시리 기획서.pdf`).

## Repo 1depth 구조

```
gongsiri/
├── agent/                    # PR1 canonical Pi runtime root (C 담당) — prompt, session, skill, tool, contracts
├── backend/                  # Python domain executors (collector = A, analyzer = B, schemas = 공유)
├── assets/                   # 정적 자산 — 기획서 PDF, 디자인 토큰, stock_master.json, dart_debug_main.html
├── docs/                     # 설계 문서 (02~07) — 코드 작성 전 필독
├── .claude/                  # 팀 공유 Claude Code 설정 (hooks, /commit skill)
├── lefthook.yml              # pre-commit 변경파일 lint + pre-push 보호브랜치 차단
├── pyproject.toml            # ruff 설정
├── .env.example
├── .gitignore                # data/, runtime noise(.clawhip/.openchrome), local state(.omc/.omx), node_modules 제외
└── AGENTS.md / CLAUDE.md / README.md
```

> 런타임 데이터의 SoT는 `.gitignore`된 `data/dev.sqlite` (SQLite file mode). dev fixture는 부팅 시 `backend/fixtures/dev_seed.json`에서 upsert된다. Supabase(Postgres) 이행 시 schema/repository 패턴을 그대로 옮긴다. `data/*.json` 형태의 별도 store는 더 이상 만들지 말 것. Pi/OMX 로컬 상태는 `.clawhip/`, `.openchrome/`, `.omc/`, `.omx/`에만 남긴다.

## 사람 담당 (A / B / C)

| 담당  | 영역                     | 코드 경로                                                                               | 핵심 산출                                                                                |
| ----- | ------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **A** | 수집·정규화              | `backend/collector/` (`dart.py`, `krx/`, `naver/`, `document_parse.py`, `normalize.py`) | `normalized_data_bundle` (A→B 인터페이스, `backend/schemas/bundle.py`)                   |
| **B** | 분석·리포트              | `backend/analyzer/` (`checklist.py`, `solar_step1.py`, `solar_step2.py`, `qa.py`)       | `analysis_result` (B→C 인터페이스: risk_score/level + 단기·장기 리포트)                  |
| **C** | Pi 런타임·오케스트레이션 | `agent/`                                                                                | Pi SDK HTTP service, manual prompt runtime, skill/tool orchestration, typed Pi envelopes |

> PR23(`feature/C-pi-agent-demo`) 이후 C의 canonical runtime root는 `agent/`이고, report/QA 데모 경로는 `frontend → backend → agent(Pi SDK)` 순서로 호출된다. cron, DB 히스토리, 인증 고도화는 여전히 out-of-scope다.

## 작전주 6개 항목 owner 매핑

| #   | 항목                     | 정량 임계값 (코드)      | 정성 해석 (Solar) | 정량 owner | Solar owner |
| --- | ------------------------ | ----------------------- | ----------------- | ---------- | ----------- |
| 1   | 사업목적 변경            | A (DART 정관변경)       | B (`solar_step1`) | A          | B           |
| 2   | 핫테마 편승              | A (뉴스·사업목적)       | B                 | A          | B           |
| 3   | 구조변경 (지배구조·인수) | A (DART 주요사항보고서) | B                 | A          | B           |
| 4   | 비정상 주가급등          | A (`krx/trade_info`)    | B                 | A          | B           |
| 5   | CB·감자 이력             | A (DART)                | B                 | A          | B           |
| 6   | 실적괴리                 | A (DART 재무)           | B                 | A          | B           |

- 총점 0–1 정상 → STEP2 진행
- 총점 2–3 주의 → 배너 + STEP2 진행
- 총점 4+ 위험 → STEP2 중단, 위험 리포트만 (B 담당)

상세: `docs/05-feature-spec.md` §5.3, `docs/03-interface-schema.md` §A 6항목.

## A → B → C 데이터 인터페이스 (요약)

```
[외부 데이터]              [A: collector]             [B: analyzer]                [C: agent runtime]
DART, KRX, 네이버 뉴스  →  normalized_data_bundle  →  analysis_result          →  Pi skill/tool envelope
증권사 PDF (Document Parse)  (Pydantic, schemas/)      (risk_score/level + 리포트)   + typed agent response
```

자세한 필드: `docs/03-interface-schema.md`.

## 로컬 서버 구동 메모

> 자세한 아키텍처/계약은 `docs/03-interface-schema.md`, `docs/04-env-vars.md`, `docs/06-pi-agent-architecture.md`, `docs/07-pi-agent-contracts.md`가 SoT다. 여기에는 다음 세션의 agent가 바로 틀리기 쉬운 실행 메모만 둔다.

- 데모 서버는 새 스크립트를 만들지 말고 **직접** 띄운다. 각 명령은 별도 터미널/tmux pane에서 실행.
- 호출 방향은 `frontend(3000) → backend(8000) → agent(8787)`이다. 브라우저/프론트는 agent를 직접 호출하지 않는다.
- `.env`는 로컬 전용이다. 최소 `UPSTAGE_API_KEY`, `DART_API_KEY`, `GONGSIRI_AGENT_URL=http://127.0.0.1:8787`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`가 필요하다. 실제 키는 커밋 금지.
- report/QA는 **strict Pi SDK-first**다. agent/Upstage 실패 시 Solar-only fallback을 만들지 않는다.
- 사용자에게 보이는 agent 답변/오류 문구는 1인칭 `공시리` 톤을 유지한다.

```bash
# agent pane A: build watch (repo root에서 .env 로드 후 실행)
set -a; source .env; set +a
cd agent && npm run build -- --watch --preserveWatchOutput

# agent pane B: server watch
set -a; source .env; set +a
cd agent && node --watch dist/server.js
# health: curl http://127.0.0.1:8787/health

# backend: 반드시 repo root에서 실행 (backend.main import 경로 유지)
set -a; source .env; set +a
uv run --project backend uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
# health: curl http://127.0.0.1:8000/

# frontend
cd frontend && npm run dev -- --hostname 127.0.0.1 --port 3000
# demo: http://127.0.0.1:3000/qa , http://127.0.0.1:3000/report
```

## 작업 규칙 (요약)

1. **항상 `docs/`를 먼저 읽고 코드를 짠다** — 인터페이스·스키마·기능 ID 모두 `docs/`가 SoT. 모호 시 `assets/공시리 기획서.pdf`.
2. **브랜치**: `feature/<owner>-<scope>` (예: `feature/A-collector-dart`). PR 타겟은 항상 `dev`.
   PR 단위 = 도메인 단위 (front+backend 한 PR, 기능 단위).
3. **main·dev 직접 push 금지** — Claude PreToolUse hook + lefthook pre-push + GitHub branch protection 3중 차단.
4. **commit**: `/commit` 스킬 사용 권장. Conventional Commits `<type>(<scope>): <summary>`, 7 types: `feat | fix | docs | chore | refactor | test | style`.
5. **인터페이스 변경**: A↔B↔C 스키마 수정은 PR + 팀 합의 + `docs/03-interface-schema.md` 갱신 필수.
6. **환경변수**: 새 키 추가 시 `.env.example` + `docs/04-env-vars.md` 동시 갱신. 환경변수는 리포 루트의 `.env.example`을 참조한다 (agent 폴더 별도 env 파일 없음).
7. **언어**: 본문·코멘트·커밋 메시지 한국어 OK, 코드·식별자는 영문.
8. **lint**: `lefthook install` 한 번으로 자동 활성화. pre-commit이 변경 파일만 검사 (`*.py`→ruff, `*.{js,ts,jsx,tsx}`→eslint).

## 협업 규칙 (docs/rules/)

바이브 코딩 시 "기능 구현 폭발"을 막기 위한 SE 컨벤션. 코드 작성 전 필독.

| 파일                                                    | 분과                 | 한 줄 요약                                                                                |
| ------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| [code-style.md](docs/rules/code-style.md)               | Code Style / Quality | Modular Code 4규칙(진입점 순수성·잡동사니 파일 금지·단일 책임·200 LOC 상한) + 포맷·네이밍 |
| [version-control.md](docs/rules/version-control.md)     | Version Control      | 브랜치·Conventional Commit·"코딩 전 1 PR = 1 concern 분해"·PR 크기 가이드                 |
| [change-management.md](docs/rules/change-management.md) | Change Management    | A↔B↔C 인터페이스 변경 절차·CODEOWNERS·자동 라벨·에스컬레이션                              |

> 규칙 본문은 `docs/rules/`에만 있음 — 여기에 복붙 금지. 이 표는 포인터일 뿐이다.
> Codex 도 `.codex/hooks.json` SessionStart 훅으로 동일 규칙 요약을 주입받는다 (Claude Code 와 같은 경험).

## 새 기능 추가 워크플로

1. `feature/<owner>-<scope>` 브랜치 분기 (base=dev)
2. `docs/05-feature-spec.md` §5.x에 기능 ID 등록
3. 인터페이스 변경 있으면 `docs/03-interface-schema.md` 갱신
4. 환경변수 추가 있으면 `.env.example` + `docs/04-env-vars.md`
5. 코드 작성·테스트
6. `/commit` 스킬로 커밋 (스킬이 자동으로 type/scope 분석)
7. `git push -u origin feature/<owner>-<scope>` → GitHub PR (base=dev)
8. 모든 `dev` 대상 PR은 **최소 1명 이상 리뷰 후 머지**. 인터페이스/문서 권한 변경은 반드시 리뷰 확보.
9. `dev → main`은 데모 전날/배포 직전에만

## 빠른 명령

```bash
# 3 서비스 한 번에
make dev      # backend 8000 / frontend 3000 / agent 8787 동시 기동
make stop     # 깔끔하게 종료
make status   # health 체크
```

```bash
# Pi runtime typecheck
cd agent && npm run typecheck

# Agent server (after `npm run build -- --watch` in another pane)
# (pnpm-workspace.yaml의 onlyBuiltDependencies 확정 이후 `pnpm approve-builds` 불필요)
cd agent && node --watch dist/server.js

# Backend dev (repo root)
uv run --project backend uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

# Frontend dev
cd frontend && npm run dev -- --hostname 127.0.0.1 --port 3000

# 테스트
cd backend && uv run python -m pytest tests -q
cd agent && npm test
cd frontend && pnpm test

# git hook 활성화 (clone 직후 1회)
lefthook install
```

## Out of scope

- 실시간 주가/매매 연동
- 비상장사·코인·해외주식
- 소셜 기능
- "작전주 사전 탐지" 절대적 주장 (포지셔닝: "공시 기반 위험 점검")
