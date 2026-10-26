---
title: Docker builder 의 pnpm lint 는 빌드 컨텍스트 전체를 검사하므로 에이전트 도구 디렉터리는 eslint 에서 제외해야 한다
author: Nalpari
date: 2026-10-26
branch: main
cost: { minutes: 2, tokens: 17179 }
id: l-103f60e9
scope: repo
status: active
touches:
  - Dockerfile
  - docs/architecture.html
  - docs/architecture.md
  - docs/ci-cd-pipeline.html
  - docs/ci-cd-pipeline.md
  - docs/okf/system/deployment.md
  - eslint.config.mjs
---

## Decided
- 베이스 이미지는 정확한 패치 버전(node:24.22.1-alpine)으로 고정한다. node:20 은 EOL 이라 2026-10-21 Node 보안 릴리스(Brotli OOB write 등) 패치를 받지 못한다. 24.x LTS 를 고른 이유: Next 16 요구(>=20.9) 충족 + 로컬 개발 메이저와 일치.
- Jenkins 에이전트에는 Node 가 없다. Node 버전은 Dockerfile 의 FROM 두 줄(base, runner)만이 결정한다.

## Watch out
- Dockerfile builder 스테이지가 `pnpm lint` 를 돌리고, .dockerignore 는 .trail/ 등을 제외하지 않는다. 그래서 vendored CJS(.trail/hook.cjs, statusline.cjs)가 no-require-imports 로 빌드를 깨뜨린다. 새 에이전트 도구 디렉터리를 추가하면 eslint.config.mjs globalIgnores 에도 추가할 것.
- Node 를 올릴 때는 문서의 이미지 표기도 함께 고친다: docs/architecture.md·html, docs/ci-cd-pipeline.md·html, docs/okf/system/deployment.md. 과거 리뷰 문서(security-review, codebase-audit)는 당시 기록이므로 그대로 둔다.
- 외부 TLS 체인(OpenRouter/Replicate=GTS, QSP/MUSBI=Sectigo, files.hanasys.jp=Amazon)은 eMudhra 를 쓰지 않는다(2026-10-26 확인). dev 의 QSP/MUSBI 는 평문 HTTP 로 IP 에 직접 붙는다.
