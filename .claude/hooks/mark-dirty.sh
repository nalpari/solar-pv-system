#!/usr/bin/env bash
# PostToolUse hook: Edit/Write/MultiEdit이 코드 파일(.ts/.tsx/.js/.jsx/.mjs/.cjs)을
# 수정했을 때만 .claude/state/dirty.flag 를 생성한다. Stop 훅이 이 플래그를 보고
# lint + typecheck 를 돌릴지 결정한다.
set -eu

FILE=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || true)

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    mkdir -p .claude/state
    touch .claude/state/dirty.flag
    ;;
esac

exit 0