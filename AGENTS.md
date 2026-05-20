# AGENTS.md — gongsiri 팀 R&R

> 공시리 = 관심종목 공시를 자동 모니터링하고 작전주 6개 항목을 판별해 경고/리포트를 보내는 개인 주식 AI 에이전트.
> 작업 전 반드시 `docs/`를 먼저 읽는다 (인터페이스·스키마·기능 ID 모두 `docs/`가 SoT, 모호 시 `assets/공시리 기획서.pdf`).

## Repo 1depth 구조

```
gongsiri/
├── frontend/                 # Next.js 14 App Router (C 담당)
├── backend/                  # FastAPI 단일 서비스 (api/agent/db = C, collector = A, analyzer = B, schemas = 공유)
├── assets/                   # 정적 자산 — 기획서 PDF, 디자인 토큰, stock_master.json, dart_debug_main.html
├── docs/                     # 설계 문서 (01~05) — 코드 작성 전 필독
├── .claude/                  # 팀 공유 Claude Code 설정 (hooks, /commit skill)
├── lefthook.yml              # pre-commit 변경파일 lint + pre-push 보호브랜치 차단
├── pyproject.toml            # ruff 설정
├── .env.example
├── .gitignore                # data/ 등 런타임 캐시·.omc/·.omx/·node_modules 제외
└── AGENTS.md / CLAUDE.md / README.md
```

> 런타임 데이터는 `.gitignore`된 `data/`에 A의 collector가 자동 생성.

## 사람 담당 (A / B / C)

| 담당 | 영역 | 코드 경로 | 핵심 산출 |
|------|------|----------|----------|
| **A** | 수집·정규화 | `backend/collector/` (`dart.py`, `krx/`, `naver/`, `document_parse.py`, `normalize.py`) | `normalized_data_bundle` (A→B 인터페이스, `backend/schemas/bundle.py`) |
| **B** | 분석·리포트 | `backend/analyzer/` (`checklist.py`, `solar_step1.py`, `solar_step2.py`, `qa.py`) | `analysis_result` (B→C 인터페이스: risk_score/level + 단기·장기 리포트) |
| **C** | API·스케줄러·DB·Frontend | `backend/api/`, `backend/agent/`, `backend/db/`, `frontend/` | REST API + 30분 폴링 오케스트레이션 + Supabase + Next.js UI |

## 작전주 6개 항목 owner 매핑

| # | 항목 | 정량 임계값 (코드) | 정성 해석 (Solar) | 정량 owner | Solar owner |
|---|------|----------------------|-------------------|-----------|-------------|
| 1 | 사업목적 변경 | A (DART 정관변경) | B (`solar_step1`) | A | B |
| 2 | 핫테마 편승 | A (뉴스·사업목적) | B | A | B |
| 3 | 구조변경 (지배구조·인수) | A (DART 주요사항보고서) | B | A | B |
| 4 | 비정상 주가급등 | A (`krx/trade_info`) | B | A | B |
| 5 | CB·감자 이력 | A (DART) | B | A | B |
| 6 | 실적괴리 | A (DART 재무) | B | A | B |

- 총점 0–1 정상 → STEP2 진행
- 총점 2–3 주의 → 배너 + STEP2 진행
- 총점 4+ 위험 → STEP2 중단, 위험 리포트만 (B 담당)

상세: `docs/05-feature-spec.md` §5.3, `docs/03-interface-schema.md` §A 6항목.

## A → B → C 데이터 인터페이스 (요약)

```
[외부 데이터]              [A: collector]             [B: analyzer]                [C: api/agent/frontend]
DART, KRX, 네이버 뉴스  →  normalized_data_bundle  →  analysis_result          →  REST API → Next.js UI
증권사 PDF (Document Parse)  (Pydantic, schemas/)      (risk_score/level + 리포트)   + 30분 APScheduler 폴링
```

자세한 필드: `docs/03-interface-schema.md`.

## 작업 규칙 (요약)

1. **항상 `docs/`를 먼저 읽고 코드를 짠다** — 인터페이스·스키마·기능 ID 모두 `docs/`가 SoT. 모호 시 `assets/공시리 기획서.pdf`.
2. **브랜치**: `feature/<owner>-<scope>` (예: `feature/A-collector-dart`). PR 타겟은 항상 `dev`.
3. **main·dev 직접 push 금지** — Claude PreToolUse hook + lefthook pre-push + GitHub branch protection 3중 차단.
4. **commit**: `/commit` 스킬 사용 권장. Conventional Commits `<type>(<scope>): <summary>`, 7 types: `feat | fix | docs | chore | refactor | test | style`.
5. **인터페이스 변경**: A↔B↔C 스키마 수정은 PR + 팀 합의 + `docs/03-interface-schema.md` 갱신 필수.
6. **환경변수**: 새 키 추가 시 `.env.example` + `docs/04-env-vars.md` 동시 갱신.
7. **언어**: 본문·코멘트·커밋 메시지 한국어 OK, 코드·식별자는 영문.
8. **lint**: `lefthook install` 한 번으로 자동 활성화. pre-commit이 변경 파일만 검사 (`*.py`→ruff, `*.{js,ts,jsx,tsx}`→eslint).

## 협업 규칙 (docs/rules/)

바이브 코딩 시 "기능 구현 폭발"을 막기 위한 SE 컨벤션. 코드 작성 전 필독.

| 파일 | 분과 | 한 줄 요약 |
|------|------|-----------|
| [code-style.md](docs/rules/code-style.md) | Code Style / Quality | Modular Code 4규칙(진입점 순수성·잡동사니 파일 금지·단일 책임·200 LOC 상한) + 포맷·네이밍 |
| [version-control.md](docs/rules/version-control.md) | Version Control | 브랜치·Conventional Commit·"코딩 전 1 PR = 1 concern 분해"·PR 크기 가이드 |
| [change-management.md](docs/rules/change-management.md) | Change Management | A↔B↔C 인터페이스 변경 절차·CODEOWNERS·자동 라벨·에스컬레이션 |

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
8. 리뷰 권장 (개발 속도를 위해 GitHub 차원의 review-required는 끔). 큰 변경·인터페이스 수정은 1명 이상 리뷰 후 머지.
9. `dev → main`은 데모 전날/배포 직전에만

## 빠른 명령

```bash
# Backend dev
cd backend && uv run uvicorn main:app --reload

# Frontend dev
cd frontend && pnpm dev

# 테스트
cd backend && uv run pytest
cd frontend && pnpm test

# git hook 활성화 (clone 직후 1회)
lefthook install
```

## Out of scope

- 실시간 주가/매매 연동
- 비상장사·코인·해외주식
- 소셜 기능
- "작전주 사전 탐지" 절대적 주장 (포지셔닝: "공시 기반 위험 점검")