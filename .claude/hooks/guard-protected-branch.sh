#!/usr/bin/env bash
# Claude PreToolUse hook — block git commit/push/merge/rebase on main/dev.
# stdin: {"tool":"Bash","tool_input":{"command":"..."},...}
# exit 0 = allow; exit 2 = block.

set -euo pipefail

PROTECTED_RE='^(main|dev)$'

payload=$(cat)
cmd=$(printf '%s' "$payload" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print("")
    sys.exit(0)
ti = data.get("tool_input") or {}
print(ti.get("command", ""))
' 2>/dev/null || true)

case "$cmd" in
    *"git commit"*|*"git push"*|*"git merge"*|*"git rebase"*)
        # GUARD_BRANCH_OVERRIDE lets acceptance demos simulate protected branches
        # without actually checking out main/dev.
        if [[ -n "${GUARD_BRANCH_OVERRIDE:-}" ]]; then
            branch="$GUARD_BRANCH_OVERRIDE"
        elif ! branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null); then
            exit 0
        fi
        if [[ "$branch" =~ $PROTECTED_RE ]]; then
            cat >&2 <<EOF
[guard-protected-branch] BLOCKED on '$branch'.
  Command: $cmd
  Rule: gongsiri 컨벤션상 main·dev 에서는 직접 commit/push/merge 금지.
  Action: feature/<owner>-<scope> 로 분기 후 다시 시도.
    예) git checkout -b feature/C-fix-xyz
EOF
            exit 2
        fi
        ;;
esac
exit 0
