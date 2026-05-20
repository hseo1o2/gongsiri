---
name: split
description: Split a bulk working tree into atomic commits by concern.
---

# split — gongsiri Bulk-to-Atomic Commit Skill

<Purpose>
여러 관심사(concern)가 뒤섞인 거대한 dirty working tree를 focused·reviewable한 atomic commit 여러 개로 분할한다. 각 concern은 현재 feature 브랜치 위의 한 커밋이 된다. `docs/rules/version-control.md` §3 "코딩 전 1 PR = 1 concern 분해"의 사후 교정 도구다.
</Purpose>

<Use_When>
- working tree에 서로 무관한 여러 concern의 변경이 섞여 있을 때 (예: 새 기능 + 리팩터 + 문서).
- 사용자가 "split", "분할", "atomic", "커밋 쪼개", "커밋 나눠" 등으로 분할 의도를 표현할 때.
</Use_When>

<Do_Not_Use_When>
- working tree가 이미 clean할 때 → 안내 후 종료.
- 변경이 단일 concern일 때 → `/commit` 스킬 사용.
- 현재 브랜치가 `main` 또는 `dev` 일 때 → 즉시 중단 (Step 1 가드).
</Do_Not_Use_When>

<Steps>

1. **브랜치 가드 (먼저)**:
   - `git branch --show-current` 실행.
   - 결과가 `main` 또는 `dev` 이면 **즉시 중단**:
     > "현재 `<branch>` 브랜치입니다. gongsiri 컨벤션상 main·dev 에서는 커밋 금지. `git checkout -b feature/<owner>-<scope>` 로 분기 후 다시 호출하세요."
   - `feature/*` 브랜치면 진행.

2. **Survey (변경 전수조사)**:
   - `git status --short` 와 `git diff --stat HEAD` 를 실행.
   - 모든 modified/untracked 파일을 나열한다.
   - 변경이 없으면 "working tree가 clean합니다 — 분할할 것이 없습니다." 안내 후 종료.

3. **Concern grouping (관심사 그룹핑)**:
   - 파일 경로와 변경 내용을 분석해 concern 그룹을 제안한다.
     - 예: "Group A: `backend/collector/` — 새 DART 엔드포인트", "Group B: `docs/rules/` — 규칙 문서", "Group C: `lefthook.yml` — Prettier 훅 추가".
   - 제안한 그룹 목록을 **사용자에게 보여주고 확인을 받는다**. 사용자가 그룹 경계를 수정할 수 있다.
   - 확인 전에는 어떤 것도 커밋하지 않는다.

4. **Iterative atomic commit (그룹별 순차 커밋)**:
   - 확인된 각 그룹에 대해:
     - `git add <그 그룹의 파일들>` 로 해당 그룹만 staging.
     - `/commit` 스킬 로직을 따른다 — Conventional Commit 메시지(`<type>(<scope>): <summary>`) 제안 → 사용자 확인 → `git commit`.
   - 한 번에 한 그룹씩. 다음 그룹으로 넘어가기 전에 현재 그룹 커밋 완료.

5. **Remainder check (잔여 확인)**:
   - 모든 그룹 커밋 후 `git status` 가 clean한지 확인.
   - 의도적으로 unstaged로 남긴 파일(예: 로컬 설정)이 있으면 사용자에게 명시적으로 알린다.

6. **Summary**:
   - `git log --oneline -N` (N = 생성한 커밋 수) 으로 새 커밋 로그를 출력한다.

</Steps>

<Examples>

<Good>
`feature/A-collector` 브랜치에서 working tree에 DART 수집 코드 + retry 리팩터 + 문서 변경이 섞임:
- 3개 concern 그룹 제안 → 사용자 확인 → 3개 atomic commit 생성.
Why good: 각 커밋이 단일 주제, 리뷰·revert 가능.
</Good>

<Bad>
`dev` 브랜치에서 `/split` 호출:
- Step 1 가드에서 즉시 중단해야 함. main/dev 직접 커밋 금지가 1순위.
</Bad>

</Examples>

<Final_Checklist>
- [ ] 브랜치 가드 통과 (`feature/*` 확인, 아니면 중단)
- [ ] concern 그룹을 사용자에게 보여주고 확인받음
- [ ] 각 커밋이 single-topic
- [ ] 모든 그룹 커밋 후 `git status` clean (또는 의도적 잔여 명시)
- [ ] `git log --oneline` 으로 결과 출력
</Final_Checklist>

> 각 그룹의 실제 커밋 실행은 `/commit` 스킬 로직을 따릅니다 (`.claude/skills/commit/SKILL.md`).
