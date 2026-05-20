# 협업 규칙 — Change Management

> SE 분과: **Change Management**
> 이 문서는 gongsiri 의 인터페이스 변경·소유권·자동 라벨·에스컬레이션 규칙을 정의한다.
> 규칙 본문은 여기에만 있다 — 다른 곳은 포인터일 뿐이다.

---

## 1. Interface Change Protocol

A↔B↔C 사이의 공유 스키마는 무단 변경 시 전체 파이프라인이 깨진다. 변경에는 절차가 있다.

대상 인터페이스:
- **A → B**: `normalized_data_bundle` (`backend/schemas/bundle.py`)
- **B → C**: `analysis_result` (`backend/schemas/`)

변경 절차 (3가지 모두 필수):
1. **PR 에 `interface` 라벨** — 경로 기반 자동 라벨러가 `backend/schemas/**` 또는 `docs/03-interface-schema.md` 변경 시 자동 부착.
2. **상대편 리뷰어 최소 1명** — A 가 만든 인터페이스 변경은 B 가, B 의 변경은 C 가 리뷰. 변경의 영향을 받는 쪽이 본다.
3. **같은 PR 에서 `docs/03-interface-schema.md` 갱신** — 스키마 문서와 코드가 한 PR 안에서 함께 움직인다. 따로 가지 않는다.

> 인터페이스 변경 = "기능 폭발"의 주된 경로. 절차 없이 필드를 추가/제거하면 다른 담당자의 코드가 조용히 깨진다.

## 2. CODEOWNERS

`.github/CODEOWNERS` 가 아래 경로에 대해 자동 리뷰어를 지정한다:

| 경로 | 소유자 | 이유 |
|------|--------|------|
| `/backend/schemas/` | A · B · C 전원 | 공유 인터페이스 — 누가 바꿔도 전원이 본다 |
| `/docs/` | A · B · C 전원 | 설계 문서는 SoT — 전원 합의 |

- CODEOWNERS 에 등록된 경로가 변경되면 GitHub 가 해당 소유자를 자동으로 리뷰 요청한다.
- 실제 GitHub 핸들(`@handle`)은 PR 리뷰 시점에 C 가 채워 넣는다 (현재 플레이스홀더).

## 3. Auto-label Trigger Paths

`.github/workflows/auto-label.yml` + `.github/labeler.yml` 가 변경 경로 기반으로 라벨을 자동 부착한다:

| 라벨 | 트리거 경로 |
|------|------------|
| `frontend` | `frontend/**` |
| `backend` | `backend/**` |
| `interface` | `backend/schemas/**`, `docs/03-interface-schema.md` |
| `docs` | `docs/**`, `*.md` |
| `ci` | `.github/**`, `lefthook.yml`, `.codex/**`, `.claude/**` |

라벨은 PR 분류·필터링용 — 게이트가 아니다. `interface` 라벨이 붙으면 §1 의 변경 절차를 적용한다.

## 4. Environment Variable Changes

새 환경변수 키를 추가할 때는 **같은 PR 에서** 두 파일을 동시에 갱신한다:
- `.env.example` — 키 이름 + 더미/설명 값
- `docs/04-env-vars.md` — 키 용도·필수 여부·기본값

코드에서 새 키를 읽는데 위 두 파일이 안 바뀐 PR 은 리뷰에서 반려한다.

## 5. Escalation

인터페이스 변경에 대한 이견이 PR 리뷰에서 해소되지 않으면:
1. PR 코멘트 스레드에서 1차 논의.
2. 해소 안 되면 **머지 전에** 팀 슬랙/디스코드로 에스컬레이션.
3. 추측으로 머지하지 않는다 — 모호하면 `docs/` → `assets/공시리 기획서.pdf` → 팀 채널 순으로 확인.

---

## 관련 문서

- 모듈 경계·포맷·네이밍 → [code-style.md](code-style.md)
- 브랜치·커밋·PR 분할 → [version-control.md](version-control.md)
- 인터페이스 스키마 상세 → `docs/03-interface-schema.md`
