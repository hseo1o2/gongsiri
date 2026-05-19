# CLAUDE.md — Claude Code Context for gongsiri

## What this repo is

공시리 — 관심종목 공시를 자동 모니터링하고 작전주 6개 항목을 판별해 경고/리포트를 보내는 개인 주식 AI 에이전트 (Upstage AI Ambassador 2기 팀 프로젝트).

## Stack at a glance

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14 App Router + Tailwind → Vercel |
| Backend | FastAPI + APScheduler → Railway |
| DB / Auth | Supabase (PostgreSQL) |
| AI | Upstage Solar Pro + Document Parse |
| Data | OpenDART, KRX 공공데이터(자체 Python 클라이언트), 네이버 뉴스·금융, 증권사 리포트 PDF |
| Pkg | uv (Python) + pnpm (JS) |
| Tooling | lefthook (git hooks) + ruff (Py lint·format) + eslint (JS lint) |

## Repo layout (요약)

```
gongsiri/
├── frontend/                       # Next.js (C 담당) — 이번 PR엔 .gitkeep만
├── backend/
│   ├── collector/                  # 수집·정규화 (A)
│   │   ├── dart.py, dart_parser.py, document_parse.py, normalize.py
│   │   ├── krx/{client,search,trade_info}.py
│   │   └── naver/news.py
│   ├── schemas/bundle.py           # A↔B 공유 Pydantic
│   ├── analyzer/                   # (B 담당, 미생성)
│   ├── api/, agent/, db/           # (C 담당, 미생성)
│   └── main.py                     # FastAPI 부트스트랩
├── assets/                         # 디자인 토큰·기획서 PDF (C 담당)
├── data/                           # 런타임 캐시·정적 데이터
│   ├── price_cache/                # .gitignore (런타임 캐시)
│   └── stock_master.json           # 추적됨 (종목코드 마스터)
├── docs/                           # 설계 문서 (코드 전 필독)
├── scripts/                        # 운영 스크립트 (gh branch protection 등)
├── .claude/                        # 팀 공유 Claude Code 설정 (commit 스킬·PreToolUse hook)
├── .env.example, .gitignore
├── lefthook.yml, pyproject.toml
└── AGENTS.md, README.md, CLAUDE.md
```

자세한 1depth 구조와 의도: `AGENTS.md` 참조.

## A → B → C 인터페이스

- A → B: `normalized_data_bundle` (`backend/schemas/bundle.py`)
- B → C: `analysis_result` (risk_score, risk_level, checklist[], short_term_report, long_term_report, disclaimer)
- 자세히: `docs/03-interface-schema.md`

## 작전주 판정 로직 (요약)

- 정량 임계값 코드 계산 + Solar Pro 정성 해석
- 6개 항목: 사업목적 / 핫테마 / 구조변경 / 주가급등 / CB감자 / 실적괴리
- 총점: 0-1 정상 → STEP2, 2-3 주의 → 배너 + STEP2, 4+ 위험 → 중단
- 상세: `docs/05-feature-spec.md` §5.3, `docs/03-interface-schema.md` §A 6항목

## 작업 규칙

1. **항상 docs/를 먼저 읽고 코드를 짠다.**
2. **기획서 원본**: `assets/공시리 기획서.pdf` (SoT — 모호 시 여기 우선).
3. **브랜치**: `feature/<owner>-<scope>` (예: `feature/A-collector-dart`), PR은 dev 대상. `main`·`dev` 직접 commit/push 금지 (3중 차단).
4. **커밋**: `/commit` 스킬 사용 권장 (Conventional Commit + 자동 staging). 7 types: `feat | fix | docs | chore | refactor | test | style`.
5. **환경변수**: 새 키 추가 시 `.env.example` + `docs/04-env-vars.md` 동시 갱신.
6. **인터페이스 변경**: A↔B↔C 스키마 수정은 반드시 PR + 팀 합의 (`docs/03-interface-schema.md` 갱신).
7. **언어**: 본문·코멘트·커밋 메시지 한국어 OK, 코드·식별자는 영문.
8. **lint**: clone 후 `lefthook install` 한 번. 이후 commit 시 변경된 언어 파일만 자동 lint.
9. **destructive 명령 가드**: `rm -rf`, `git push --force`, `git reset --hard`, `git clean -fd`은 Claude가 실행 전 항상 질문 (`.claude/settings.json`).

## 모름·미정 시 우선순위

1. `docs/` 해당 문서
2. `assets/공시리 기획서.pdf` 해당 섹션
3. 팀 슬랙/디스코드에서 질문 (추측 금지)

## 빠른 명령

```bash
# 최초 1회 (clone 직후)
lefthook install

# Backend dev
cd backend && uv run uvicorn main:app --reload

# Frontend dev
cd frontend && pnpm dev

# 테스트
cd backend && uv run pytest
cd frontend && pnpm test

# branch protection 적용 (운영자만)
bash scripts/setup-branch-protection.sh
```

## Out of scope

- 실시간 주가/매매 연동
- 비상장사·코인·해외주식
- 소셜 기능
- "작전주 사전 탐지" 절대적 주장

## Disclaimer (모든 리포트 하단)

> 이 리포트는 DART 공시·재무 기반 도메인 시그널만 분석하며, 차트·거래량·뉴스·루머는 포함하지 않습니다. 투자 자문이 아닙니다.
