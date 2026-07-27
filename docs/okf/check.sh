#!/usr/bin/env bash
# docs/okf/check.sh — OKF 번들 신선도 점검. git 만 사용하며 API 비용이 없다.
#
#   BROKEN  : frontmatter 의 resource 가 가리키는 파일이 없음 → 문서가 확실히 틀림 (exit 1)
#   STALE   : 소스의 마지막 커밋일이 문서 기준일보다 새로움 → 사람이 확인 (경고, exit 0)
#   EXPIRED : stale_after 날짜가 지남 → 재검증 필요 (경고, exit 0)
#
# 기준일은 frontmatter 안 `at:` 값 중 가장 최근 것의 날짜다. 즉 사람이 검토하고
# `verified: { by: human:<id>, at: ... }` 를 추가하면 STALE 판정이 자동으로 해제된다.
#
# 사용: pnpm okf:check
set -uo pipefail

BUNDLE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$BUNDLE" rev-parse --show-toplevel)" || exit 1
cd "$REPO" || exit 1

TODAY="$(date -u +%Y-%m-%d)"
broken=0
stale=0
expired=0

# 첫 --- 와 두 번째 --- 사이(frontmatter)만 출력. frontmatter 가 없으면 아무것도 출력하지 않는다.
frontmatter() {
  awk 'NR==1 && $0!="---"{exit} NR>1 && $0=="---"{exit} NR>1' "$1"
}

while IFS= read -r doc; do
  fm="$(frontmatter "$doc")"
  [ -n "$fm" ] || continue
  rel="${doc#"$REPO"/}"

  # 기준일 — generated.at / verified[].at 중 최신값의 날짜 부분.
  # 날짜 단위로 비교한다. 문서를 고치고 같은 날 커밋하면 커밋 시각이 항상 더 나중이라
  # 시:분:초로 비교하면 커밋 직후 곧바로 STALE 이 뜬다. 문서 신선도는 시간 단위 관심사가 아니다.
  base="$(printf '%s\n' "$fm" \
    | sed -n 's/.*[^a-z]at: *\([0-9][0-9-]*\)T[0-9:]*Z.*/\1/p' | sort | tail -1)"
  after="$(printf '%s\n' "$fm" | sed -n 's/^stale_after: *\([0-9-]*\).*/\1/p' | head -1)"

  if [ -n "$after" ] && [[ "$TODAY" > "$after" || "$TODAY" == "$after" ]]; then
    echo "EXPIRED  $rel  (stale_after: $after)"
    expired=$((expired + 1))
  fi

  while IFS= read -r src; do
    [ -n "$src" ] || continue
    case "$src" in http*) continue ;; esac
    # git 추적 대상이 아닌 경로(graphify-out 등)는 판정하지 않는다 — 클린 체크아웃에서 오탐이 된다.
    git check-ignore -q "$src" 2>/dev/null && continue

    if [ ! -e "$src" ]; then
      echo "BROKEN   $rel  →  $src"
      broken=$((broken + 1))
      continue
    fi

    [ -n "$base" ] || continue
    last="$(TZ=UTC git log -1 --format=%cd --date=format-local:%Y-%m-%d -- "$src")"
    [ -n "$last" ] || continue
    if [[ "$last" > "$base" ]]; then
      echo "STALE    $rel  →  $src  ($last)"
      stale=$((stale + 1))
    fi
  # 최상위 resource 와 sources[].resource 에 같은 경로가 오면 중복 보고되므로 sort -u.
  done < <(printf '%s\n' "$fm" | sed -n 's/^ *resource: *\(.*\)/\1/p' | sed 's/[[:space:]]*$//' | sort -u)
done < <(find "$BUNDLE" -name '*.md' | sort)

echo "---"
echo "BROKEN $broken · STALE $stale · EXPIRED $expired"

if [ "$broken" -gt 0 ]; then
  echo "포인터가 깨진 문서는 고치거나 status: draft 로 내리세요."
  exit 1
fi
if [ "$stale" -gt 0 ] || [ "$expired" -gt 0 ]; then
  echo "해당 문서를 확인하고, 내용이 맞으면 verified 를 추가해 판정을 해제하세요."
fi
exit 0
