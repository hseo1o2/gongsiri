---
name: worklog
description: Record why this change was made to the team wiki work log.
---

# worklog — gongsiri 팀 작업 기록 Skill

<Purpose>
의미 있는 작업을 마친 뒤 "왜 이 변경을 만들었는가"를 사용자에게 물어, 날짜·시간이 찍힌 항목을 팀 공유 위키 작업 로그 `.omc/wiki/worklog.md` 에 추가한다. `.omc/` 는 gitignore 되지만 `.omc/wiki/` 는 `.gitignore` 예외로 팀에 공유된다.
</Purpose>

<Use_When>
- 의미 있는 코딩 작업이 일단락된 후.
- 사용자가 "worklog", "작업 기록", "왜 기록", "wiki 기록", "작업로그" 등으로 기록 의도를 표현할 때.
</Use_When>

<Do_Not_Use_When>
- 사소한 변경(오타 1개 등)이라 기록 가치가 없을 때.
- 사용자가 기록을 원하지 않는다고 명시할 때.
</Do_Not_Use_When>

<Steps>

1. **디렉토리 보장**:
   - `mkdir -p .omc/wiki` 실행 (idempotent — 없으면 생성, 있으면 no-op).

2. **컨텍스트 수집**:
   - `git log --oneline -5` 로 최근 커밋 5개를 가져와 작업 맥락으로 삼는다.
   - `git branch --show-current` 로 현재 브랜치명을 가져온다.

3. **사용자에게 질문**:
   - "이 작업을 한 이유를 한두 줄로 적어주세요. (왜 이 변경이 필요했나요?)"
   - 사용자의 답을 받는다.

4. **`.omc/wiki/worklog.md` 에 append**:
   - 파일이 없으면 `# gongsiri 팀 작업 로그` 헤더로 새로 만든다.
   - 아래 형식의 항목을 파일 끝에 추가한다 (YYYY-MM-DD HH:MM 은 실제 현재 시각):
     ```
     ## YYYY-MM-DD HH:MM — <branch-name>
     **Commits**: <Step 2 의 git log --oneline 결과>
     **Why**: <사용자의 답>
     ```

5. **확인**:
   - "`.omc/wiki/worklog.md` 에 기록 완료." 출력.

</Steps>

<Examples>

<Good>
`feature/C-collab-guardrails` 작업 후 `/worklog` 호출:
```
## 2026-05-20 16:30 — feature/C-collab-guardrails
**Commits**: a1b2c3d chore(collab): 팀 협업 룰셋 + CI 가드레일 구축
**Why**: 본격 개발 전 바이브 코딩의 "기능 폭발"을 막을 SE 컨벤션·CI 가드레일을 미리 깔아둠.
```
Why good: 날짜·시간·브랜치·커밋·이유가 모두 기록됨 — 나중에 팀원이 맥락을 복원 가능.
</Good>

<Bad>
사용자에게 이유를 묻지 않고 그냥 "기록했습니다" 하고 끝냄.
Why bad: "왜"가 비어 있으면 작업 로그의 가치가 없다. Step 3 질문은 필수.
</Bad>

</Examples>

<Final_Checklist>
- [ ] `.omc/wiki/` 디렉토리 존재 보장 (`mkdir -p`)
- [ ] 사용자에게 "왜" 질문하고 답을 받음
- [ ] 날짜·시간·브랜치·커밋·이유가 모두 들어간 항목 append
- [ ] `.omc/wiki/worklog.md` 에 기록 완료 안내
</Final_Checklist>
