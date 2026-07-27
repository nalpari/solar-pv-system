#!/usr/bin/env python3
"""PreToolUse hook: Read/Edit 로 소스 파일에 접근할 때, 그 파일을 frontmatter 의
`resource:` 로 인용하는 OKF 개념 문서 경로를 컨텍스트에 주입한다.

일반적인 "okf 를 읽어라" 잔소리가 아니라 지금 여는 파일에 맞는 문서만 지목한다.
본문에서 파일명을 언급하기만 한 문서(index.md 의 예시, log.md 의 이력)는 제외하려고
frontmatter 안의 `resource:` 줄만 정확히 매칭한다.

매 Read 마다 도는 훅이라 프로세스를 하나만 쓴다 (bash+python3+grep 3개 → python3 1개).

ponytail: 같은 파일을 반복해 열면 같은 힌트가 매번 뜬다. 거슬리면 .claude/state/ 에
  세션 마커를 두고 Stop 훅에서 지우는 방식으로 억제할 것.
"""

import json
import os
import re
import sys

BUNDLE = "docs/okf"
SCOPE_PREFIXES = ("src/",)
SCOPE_FILES = {
    "Dockerfile",
    "docker-compose.yml",
    "Jenkinsfile",
    "package.json",
    "next.config.ts",
}


def cited_by(rel: str) -> list[str]:
    """rel 을 frontmatter 의 resource 로 인용하는 번들 문서 경로."""
    pattern = re.compile(r"^\s*resource:\s*%s\s*$" % re.escape(rel), re.M)
    hits = []
    for root, _dirs, files in os.walk(BUNDLE):
        for name in files:
            if not name.endswith(".md"):
                continue
            path = os.path.join(root, name)
            try:
                with open(path, encoding="utf-8") as fh:
                    head = fh.read(4000)  # frontmatter 는 파일 맨 앞에만 있다
            except OSError:
                continue
            if not head.startswith("---"):
                continue
            end = head.find("\n---", 3)
            if pattern.search(head[:end] if end != -1 else head):
                hits.append(path)
    return sorted(hits)


def main() -> None:
    if not os.path.isdir(BUNDLE):
        return
    try:
        data = json.load(sys.stdin)
    except Exception:
        return

    path = (data.get("tool_input") or {}).get("file_path") or ""
    if not path:
        return
    rel = os.path.relpath(path, os.getcwd()) if os.path.isabs(path) else path

    if rel.startswith(BUNDLE + os.sep):
        return  # 번들 자신을 열 때는 조용히 — 이미 읽고 있다
    if not (rel.startswith(SCOPE_PREFIXES) or rel in SCOPE_FILES):
        return

    hits = cited_by(rel)
    if not hits:
        return

    msg = (
        f"okf: `{rel}` 를 다루는 개념 문서가 있습니다 — {', '.join(hits)}. "
        "도메인 규칙·불변식·함정은 코드보다 이쪽이 진실의 원천입니다. "
        "내용이 코드와 어긋나면 문서를 고치거나 status: draft 로 내리세요."
    )
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "additionalContext": msg,
                }
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
