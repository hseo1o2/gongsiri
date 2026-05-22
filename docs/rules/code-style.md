# 협업 규칙 — Code Style / Quality

> SE 분과: **Code Style / Quality**
> 이 문서는 gongsiri 코드의 모듈 경계·포맷·네이밍 규칙을 정의한다.
> 규칙 본문은 여기에만 있다 — `AGENTS.md`·`.codex/hooks.json`은 이 파일을 가리키는 포인터일 뿐이다.

---

## 1. Modular Code — 4 Rules

바이브 코딩(에이전트 주도 개발)에서 가장 흔한 실패는 "기능 구현 폭발" — 한 파일이 모든 책임을 빨아들이고, 진입점에 비즈니스 로직이 쌓이고, `utils.ts` 하나가 200줄을 넘는 것이다. 아래 4규칙은 그것을 사전에 차단한다. TypeScript(frontend)와 Python(backend) 양쪽에 동일하게 적용된다.

### Rule 1 — Entry-point purity (진입점 순수성)

진입점 파일은 **re-export + wiring만** 한다. 비즈니스 로직·헬퍼 함수 금지.

- **TypeScript**: `index.ts` 는 하위 모듈을 모아 re-export 하거나 의존성을 조립(wiring)하는 역할만.
  ```ts
  // ✅ frontend/lib/dart/index.ts — 좋음
  export { fetchDisclosures } from "./fetch";
  export { parseDisclosure } from "./parse";
  export type { Disclosure } from "./types";

  // ❌ index.ts 안에 로직
  export function fetchDisclosures(corp: string) {
    const url = `https://opendart.fss.or.kr/...`; // ← 진입점에 구현 금지
    /* ... */
  }
  ```
- **Python**: `__init__.py` 는 패키지 공개 API를 re-export 하는 용도만.
  ```python
  # ✅ backend/collector/krx/__init__.py — 좋음
  from .trade_info import fetch_trade_info
  from .client import KrxClient

  __all__ = ["fetch_trade_info", "KrxClient"]

  # ❌ __init__.py 안에 로직
  def fetch_trade_info(code: str):  # ← 진입점에 구현 금지
      ...
  ```

### Rule 2 — No catch-all files (잡동사니 파일 금지)

`utils.ts` · `helpers.ts` · `service.ts` · `common.ts` · `utils.py` · `helpers.py` 같은 **이름이 책임을 말해주지 않는** 파일을 만들지 않는다. 함수는 목적이 드러나는 모듈에 둔다.

- ❌ `backend/collector/utils.py` 에 `format_date()`, `retry()`, `parse_corp_code()` 가 뒤섞임
- ✅ 각각 `dates.py`, `retry.py`, `corp_code.py` — 파일명이 곧 책임
- ✅ TS도 동일: `formatDate.ts`, `withRetry.ts`, `corpCode.ts`

"여기 둘 데가 없어서" 잡동사니 파일에 넣고 싶어지면, 그건 새 목적 모듈이 필요하다는 신호다.

### Rule 3 — Single Responsibility (단일 책임)

모든 `.ts` / `.py` 파일은 **한 문장으로 설명 가능**해야 한다. "그리고"가 들어가면 분리 신호다.

- ✅ "`dart.py` — OpenDART 공시 목록·상세를 가져온다."
- ❌ "`dart.py` — OpenDART 공시를 가져오고 **그리고** 정규화하고 **그리고** Supabase에 저장한다." → `dart.py` / `normalize.py` / `repository.py` 로 분리.

### Rule 4 — 200 LOC hard limit (200줄 상한)

한 파일은 **200 LOC를 넘지 않는다**. 빈 줄·주석·프롬프트 템플릿 문자열은 카운트에서 제외한다.

- 200줄 초과 = 즉시 리팩터(분리) 대상. 예외 협의는 PR에서.
- Solar 프롬프트처럼 긴 템플릿 문자열은 별도 모듈(`prompts/step1.py` 등)로 빼면 본문 LOC가 자연히 줄어든다.
- 측정: `grep -cvE '^\s*($|#|//)' <file>` 수준의 비-공백·비-주석 줄 기준 (엄밀한 도구 강제는 없음 — 코드 리뷰 판단).

---

## 2. Formatting Policy

| 언어 | 포매터 | 린터 | 설정 위치 |
|------|--------|------|-----------|
| Python | `ruff format` | `ruff check` | `pyproject.toml` |
| TypeScript / JS | Prettier | ESLint | `frontend/.prettierrc` · `frontend/.eslintrc` |

- **로컬 강제**: `lefthook` pre-commit 훅이 staged 파일에 자동 적용 (`*.py`→ruff, `*.{js,ts,jsx,tsx}`→eslint, `*.{...,json,md}`→prettier). clone 직후 `lefthook install` 1회 필요.
- **CI 강제**: `.github/workflows/ci.yml` 의 `python-lint` 잡이 `ruff check` + `ruff format --check` 를 required check로 실행. JS 계열은 `frontend/` 가 아직 stub 이라 graceful skip.
- frontend 가 초기화되지 않은 현재, Prettier/ESLint/tsc 단계는 로그만 남기고 skip 된다 — 의도된 동작.

---

## 3. Naming Conventions

- **식별자(변수·함수·클래스·파일명)는 영문.** 한국어 식별자 금지.
- **주석·docstring·커밋 본문은 한국어 OK.** 도메인 용어(작전주, 공시, 감자 등)는 한국어가 더 정확하면 한국어로.
- Python: `snake_case` 함수·변수, `PascalCase` 클래스, `UPPER_SNAKE` 상수.
- TypeScript: `camelCase` 함수·변수, `PascalCase` 타입·컴포넌트, `UPPER_SNAKE` 상수.
- 파일명: Python `snake_case.py`, TS 컴포넌트 `PascalCase.tsx`, TS 일반 모듈 `camelCase.ts`.
- 약어보다 의미. `corpCd` 보다 `corpCode`, `tinfo` 보다 `tradeInfo`.

### User-facing naming / tone

- **사용자에게 보이는 문구에서 에이전트의 이름은 항상 `공시리`다.**
  - ✅ `공시리가 답변을 준비하고 있습니다.`
  - ✅ `저 공시리가 확인한 바로는...`
  - ❌ `Pi agent가 분석 중...`
  - ❌ `Pi SDK 응답을 기다리는 중입니다.`
- frontend 화면 문구, toast, empty/error/loading state, 버튼 보조 문구, BFF가 그대로 전달하는 사용자용 에러 메시지에는 **내부 구현명**(`Pi agent`, `Pi SDK`, `agent service`)을 노출하지 않는다.
- 내부 구현명은 **개발자용 코드/로그/문서**에서만 사용한다. 예: `agent/src/`, `GONGSIRI_AGENT_URL`, 아키텍처 문서의 backend→agent 설명.
- 1인칭 주체가 필요할 때는 `저 공시리가...` / `공시리가...`를 기본으로 한다.

---

## 관련 문서

- 버전 관리·커밋·PR 분할 → [version-control.md](version-control.md)
- 인터페이스 변경·CODEOWNERS → [change-management.md](change-management.md)
