## 변경 요약 (What & Why)

<!-- 무엇을, 왜 바꿨는지. "왜"를 빼먹지 말 것. -->

## 관련 이슈 / 기능 ID

- Closes #
- 기능 ID:
  <!-- 구현자 관점 ID (AUTH/ON/W/P/D/AN/R/PF-NN) 또는 에이전트 관점 ID (AGENT-{ROLE}-NN) / 없으면 N/A -->

## 인터페이스 영향

- [ ] A↔B 인터페이스 (`normalized_data_bundle`) 변경 있음
- [ ] B↔C 인터페이스 (`analysis_result`) 변경 있음
- [ ] 인터페이스 변경 없음

> 인터페이스 변경이 있다면: `docs/03-interface-schema.md` 를 **이 PR 안에서** 갱신했고, 상대편 담당자 리뷰어를 지정했는지 확인. (`docs/rules/change-management.md` §1)

## 체크리스트

- [ ] `feature/<owner>-<scope>` 브랜치에서 작업 (PR 타겟 = `dev`)
- [ ] Conventional Commit 형식 준수 (`feat|fix|docs|chore|refactor|test|style`)
- [ ] `docs/rules/` 규칙 확인 (code-style / version-control / change-management)
- [ ] lint / type / build 로컬 통과 확인
- [ ] 인터페이스 변경 시 `docs/03-interface-schema.md` 갱신
- [ ] 새 환경변수 추가 시 `.env.example` + `docs/04-env-vars.md` 동시 갱신
