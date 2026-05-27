#!/usr/bin/env bash
# Stop hook: 이번 턴에 코드 파일이 수정되었으면 (dirty.flag 존재 시)
# pnpm lint + npx tsc --noEmit 을 순차 실행하고, 하나라도 실패하면 exit 2 로
# Stop 을 차단하고 stderr 로 Claude 에게 결과를 피드백한다.
set -u

FLAG=.claude/state/dirty.flag

if [ ! -f "$FLAG" ]; then
  exit 0
fi

# 플래그를 즉시 삭제 (검사 결과와 무관하게 1회 시도)
rm -f "$FLAG"

LINT_OUT=$(pnpm lint 2>&1)
LINT_RC=$?

TSC_OUT=$(npx tsc --noEmit 2>&1)
TSC_RC=$?

if [ "$LINT_RC" -ne 0 ] || [ "$TSC_RC" -ne 0 ]; then
  {
    echo "=== ESLint (exit $LINT_RC) ==="
    echo "$LINT_OUT"
    echo ""
    echo "=== TypeScript (exit $TSC_RC) ==="
    echo "$TSC_OUT"
    echo ""
    echo "위 오류를 모두 수정한 뒤 응답을 종료하세요."
  } >&2
  exit 2
fi

exit 0