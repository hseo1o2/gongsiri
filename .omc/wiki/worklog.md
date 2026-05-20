# gongsiri 팀 작업 로그

> 의미 있는 작업 후 `/worklog` 스킬로 항목을 추가한다 (날짜·시간·브랜치·커밋·이유).
> 이 디렉토리(`.omc/wiki/`)는 `.gitignore` 예외로 팀에 공유된다. `.omc/` 의 나머지는 로컬 전용.

---

## 2026-05-20 — feature/C-collab-guardrails
**Commits**: chore(collab): 팀 협업 룰셋 + CI 가드레일 구축
**Why**: 본격 개발(Claude Code + Codex 주력)에 들어가기 전, 바이브 코딩의 "기능 구현 폭발"을 막을 SE 컨벤션과 CI 가드레일을 미리 깔아둠. modular-code 4규칙·Conventional Commit·PR 분할·인터페이스 변경 절차를 `docs/rules/` 3분과로 문서화하고, lefthook·GitHub Actions·`.codex/hooks.json` 으로 Claude Code와 Codex 양쪽에 동일한 가드 경험을 강제. 팀 작업 로그(이 파일)도 이 PR에서 함께 도입.
