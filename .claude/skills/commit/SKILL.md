---
name: commit
description: Commit changes to git.
---

# commit — gongsiri Conventional Commit Skill

<Purpose>
Stage relevant changes, write a Conventional Commit message, and execute `git commit` on a feature branch. Blocks on main/dev.
</Purpose>

<Use_When>
- 사용자가 "commit", "커밋", "git commit", "이거 커밋", "커밋 메시지" 등으로 commit 의도를 표현
- 작업이 일단락되어 working tree의 변경을 commit으로 묶어야 할 때
</Use_When>

<Do_Not_Use_When>
- 현재 브랜치가 `main` 또는 `dev` 인 경우 → 즉시 중단하고 안내
- 사용자가 단지 메시지 초안만 원할 때 → 메시지만 보여주고 멈춤
- 변경 사항이 없을 때 (working tree clean) → 안내 후 종료
</Do_Not_Use_When>

<Steps>

1. **브랜치 가드 (먼저)**:
   - `git branch --show-current` 실행.
   - 결과가 `main` 또는 `dev` 이면 **즉시 중단** 하고 사용자에게 다음을 안내:
     > "현재 `<branch>` 브랜치입니다. gongsiri 컨벤션상 main·dev 에서는 commit 금지. `git checkout -b feature/<owner>-<scope>` 로 분기 후 다시 호출하세요."
   - 그 외 브랜치면 진행.

2. **변경 사항 파악**:
   - `git status --short` 와 `git diff --stat HEAD` 를 동시에 실행.
   - 이미 staged 된 게 있으면 그대로 사용. 없으면 staging 단계로.

3. **Staging 결정**:
   - 명백히 의도와 무관한 파일(`.env`, `*.log`, 빌드 산출물 등)은 staging에서 제외.
   - 변경 의도가 단일 주제로 묶이면 관련 파일만 `git add <paths>`.
   - 여러 주제가 섞여 있으면 가장 큰 주제 하나만 staging 하고 나머지는 후속 commit으로 안내.

4. **Conventional Commit 메시지 작성**:
   - 형식: `<type>(<scope>): <summary>`
   - **type (7개 중 1)**: `feat | fix | docs | chore | refactor | test | style`
     - `feat` 새 기능 / 사용자 영향이 있는 추가
     - `fix` 버그 수정
     - `docs` 문서 변경만
     - `chore` 빌드·도구·잡일 (코드 동작 변화 없음)
     - `refactor` 동작 동일, 구조 개선
     - `test` 테스트 추가·수정
     - `style` 포맷·세미콜론·공백만 (로직 변화 없음)
   - **scope (선택)**: 작업 범위 단어 한 개. 작은 변경이거나 범위가 명확하면 생략 가능.
     - 예: `collector-dart`, `solar-step1`, `scheduler`, `bundle-schema`, `eslint`
   - **summary**: 50자 내, 명령형 동사로 시작, 마침표 없음. 한국어/영어 모두 가능 (한국어 본문 권장).
   - **본문 (선택)**: 빈 줄 후 wrap 72, 변경 이유·맥락. 한국어 OK.

5. **커밋 메시지 후보 제시 → 사용자 확인**:
   - 후보 메시지를 출력하고 OK 여부를 확인한 뒤 `git commit -m` 으로 실행. 메시지만 출력하고 끝내지 않는다.

6. **`git commit` 실행**:
   - `git commit -m "<type>(<scope>): <summary>"` (단행) 또는 본문 필요 시 HEREDOC.
   - lefthook pre-commit이 자동으로 변경 파일 lint (`*.py`→ruff, `*.{js,ts,jsx,tsx}`→eslint). 실패하면 auto-fix 시도 후 재-stage하고 한 번 더 commit.
   - 두 번 실패하면 사용자에게 에러 노출하고 중단.

7. **결과 확인**:
   - `git log -1 --stat` 으로 커밋 결과 1줄 + 변경 파일 요약 출력.

</Steps>

<Examples>

<Good>
브랜치 `feature/A-collector-dart` 에서 `backend/collector/dart.py` 수정 후:
```
feat(collector-dart): OpenDART 공시 페이지네이션 지원

- list.json 의 page_count 반영해 다음 페이지 자동 호출
- max_pages 인자로 안전 상한 (기본 5)
```
Why good: 단일 주제, type+scope+summary 명확, 본문이 "왜"를 설명.
</Good>

<Good>
브랜치 `feature/C-scaffold` 에서 설정 파일들만 변경:
```
chore: lefthook + ruff + claude hook 초기 셋업
```
Why good: 범위가 명확하고 잡일성이라 scope 생략, 본문 없이도 충분.
</Good>

<Bad>
```
update some files
```
Why bad: type 없음, 의미 없는 summary, Conventional Commit 위반.
</Bad>

<Bad>
브랜치가 `dev` 인데 commit 시도:
- 즉시 중단해야 함. dev 직접 commit 금지가 1순위 가드.
</Bad>

</Examples>

<Final_Checklist>
- [ ] 현재 브랜치가 `feature/*` 인지 확인 (아니면 즉시 중단)
- [ ] 변경 사항이 single-topic 으로 묶이는지 확인
- [ ] 메시지가 `<type>(<scope>): <summary>` 형식 + 7 types 중 1
- [ ] `git commit` 실제 실행 완료
- [ ] lefthook pre-commit이 통과 (또는 auto-fix 후 통과)
- [ ] `git log -1` 으로 결과 확인
</Final_Checklist>
