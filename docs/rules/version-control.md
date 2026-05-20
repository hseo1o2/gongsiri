# 협업 규칙 — Version Control

> SE 분과: **Version Control**
> 이 문서는 gongsiri 의 브랜치·커밋·PR 규칙을 정의한다.
> 규칙 본문은 여기에만 있다 — 다른 곳은 포인터일 뿐이다.

---

## 1. Branch Naming

- 형식: **`feature/<owner>-<scope>`**
  - `<owner>` = `A` / `B` / `C` (사람 담당) 또는 기능 약어.
  - `<scope>` = 작업 범위 단어. 예: `feature/A-collector-dart`, `feature/C-collab-guardrails`.
- **PR 타겟은 항상 `dev`.** `main` 으로 직접 PR 금지.
- `main` · `dev` 직접 commit/push 금지 — Claude Code PreToolUse 훅 + `.codex/hooks.json` 미러 + `lefthook` pre-push 3중 차단.
- `dev → main` 머지는 데모 전날/배포 직전에만.

## 2. Conventional Commits

- 형식: **`<type>(<scope>): <summary>`**
- **type — 7개 중 1개:**

  | type | 용도 |
  |------|------|
  | `feat` | 새 기능 / 사용자 영향 있는 추가 |
  | `fix` | 버그 수정 |
  | `docs` | 문서만 변경 |
  | `chore` | 빌드·도구·잡일 (코드 동작 변화 없음) |
  | `refactor` | 동작 동일, 구조 개선 |
  | `test` | 테스트 추가·수정 |
  | `style` | 포맷·공백·세미콜론만 (로직 변화 없음) |

- `<scope>` 는 선택. 범위가 명확하거나 작은 변경이면 생략 가능.
- `<summary>` 는 50자 내, 명령형 동사로 시작, 마침표 없음. 한국어/영어 모두 OK.
- 본문은 빈 줄 후 wrap 72, **"왜"를 설명**. 한국어 권장.
- breaking change 는 type 뒤에 `!` 표기: `feat(bundle)!: normalized_data_bundle 필드 제거`.

## 3. Plan-first PR Split — "코딩 전 1 PR = 1 concern 분해"

**바이브 코딩의 핵심 가드레일.** 코드를 쓰기 *전에* 작업을 concern(관심사) 단위로 분해하고, **1 concern = 1 브랜치 = 1 PR** 로 매핑한다.

- 작업 시작 전: "이 작업은 몇 개의 독립적 concern 으로 나뉘는가?"를 먼저 답한다.
  - 예: "DART 페이지네이션 추가" + "기존 retry 로직 리팩터" + "관련 문서 갱신" = 3 concern → 3 PR.
- 한 PR 은 리뷰어가 **한 번에 머릿속에 담을 수 있는** 크기여야 한다.
- 이미 여러 concern 이 섞인 bulk working tree 가 생겨버렸다면 → **`/split` 스킬**로 사후 분할한다 (§6 참조).
- 진입점부터 한 번에 다 짜고 나중에 쪼개는 것보다, 처음부터 concern 을 나눠 짜는 게 항상 싸다.

## 4. Atomic Commit

- **1 커밋 = 1 논리적 변경.** `fix: everything` · `update files` 같은 커밋 금지.
- 한 커밋의 변경은 한 문장으로 설명 가능해야 한다 (code-style.md Rule 3 와 같은 정신).
- 리뷰·revert·bisect 가 가능하려면 커밋이 atomic 해야 한다.
- 여러 주제가 staged 되었으면 `/commit` 스킬이 가장 큰 주제만 묶고 나머지는 후속 커밋으로 안내한다.

## 5. PR Size Guidance (soft)

soft 목표치 — **블록이 아니라 경고**:

- diff **< 400 LOC**
- 변경 파일 **< 20개** (`.lock`·생성 파일 제외)

초과 시 `.github/workflows/pr-check.yml` 의 size-check 잡이 `size/large` 라벨 + 경고 코멘트를 단다. **머지를 막지 않는다** (exit 0). 거대 PR 은 리뷰 품질을 떨어뜨리므로 분할을 권장하는 신호일 뿐이다.

> 예외: 인프라/거버넌스 셋업 PR (이 룰셋 도입 PR 자체 등)은 일회성으로 한도를 넘을 수 있다. 경고는 떠도 정상이다.

## 6. Skill References — `/split` & `/commit`

- **`/split`** — bulk working tree 를 concern 별 atomic commit 으로 분할. 작업이 이미 여러 주제로 섞였을 때 사용. 정의: `.claude/skills/split/SKILL.md`.
- **`/commit`** — 단일 주제 변경을 Conventional Commit 으로 커밋. 정의: `.claude/skills/commit/SKILL.md`.
- `/split` 은 각 그룹의 실제 커밋 실행을 `/commit` 스킬 로직에 위임한다.

---

## 관련 문서

- 모듈 경계·포맷·네이밍 → [code-style.md](code-style.md)
- 인터페이스 변경·CODEOWNERS → [change-management.md](change-management.md)
