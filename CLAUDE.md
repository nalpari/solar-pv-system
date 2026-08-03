# CLAUDE.md

This file provides guidance to AI coding agents (Claude Code, Cursor, GitHub Copilot, etc.) when working with this repository.

## Project Overview

Solar PV rooftop panel layout planner — a single-page web application that lets users design solar panel layouts on building rooftops using Google Maps satellite imagery.

## Quick Start

사전 요구사항: Node.js 20+ · pnpm · Google Maps API 키 (Maps JS / Places / Geometry API 활성)

```bash
pnpm install
echo 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key' > .env.local
pnpm dev                     # http://localhost:3000
```

## Always Do

- 모든 답변과 추론과정은 한국어로 작성한다.
- 가급적 react 19.2, nextjs 16 버전의 최신 문법을 사용한다.
- 이 앱은 데스크톱 전용이다 — 모바일/태블릿 디바이스는 고려하지 않는다. 반응형 대응, 터치 전용 대체 조작(길게 누르기 등), 모바일 브라우저 호환성은 구현·리뷰 대상이 아니며 코드리뷰에서 이런 지적이 나오면 무시한다. 마우스·키보드(Alt/Shift 등 modifier 포함) 입력을 전제로 설계한다.
- 코드 파일(`.ts/.tsx/.js/.jsx/.mjs/.cjs`)을 수정한 턴이 끝나면 Stop 훅이 자동으로 `pnpm lint` + `npx tsc --noEmit` 을 실행한다 (`.claude/hooks/check-lint-tsc.sh`). 실패 시 stderr 가 Claude 에게 피드백되어 자동 수정 루프에 들어간다.
- 린트체크시 오류가 있으면 반드시 해결하고 넘어가도록 하고, 경고가 있더라도 해결하려고 노력한다.
- 빌드 검증(`pnpm build`)은 자동 훅에 포함되지 않는다 — 큰 변경 후 또는 사용자가 명시적으로 요청할 때만 수동 실행한다.
- 커밋시에 접두사는 영어로 나머지 타이틀과 내용은 한국어로 작성한다.
- task 완료시 CLAUDE.md, AGENTS.md 및 README.md 문서에 업데이트가 필요하면 진행한다.
- 작업시 한 문장으로 설명되는 의미있는 단위로 commit 한다.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build (`output: "standalone"`) |
| `pnpm start` | Serve production build |
| `pnpm lint` | Run ESLint (flat config) |
| `pnpm okf:check` | OKF 지식 번들 신선도 점검 (BROKEN/STALE/EXPIRED). git 만 사용, API 비용 0 |
| `npx tsc --noEmit` | TypeScript type-check |
| `docker compose up --build` | Docker build & run |
| `docker compose up --build -d` | Docker build & run (백그라운드) |
| `docker compose down` | Docker 컨테이너 중지 |
| `graphify update .` | AST-only knowledge graph refresh |

## Tech Stack

- **Next.js 16.2** — App Router, `output: "standalone"`, React Compiler enabled
- **React 19.2** — React Compiler (`reactCompiler: true` in `next.config.ts`, `babel-plugin-react-compiler` 1.0.0)
- **TypeScript** — strict mode
- **Tailwind CSS v4** — via `@tailwindcss/postcss` (CSS custom properties used for styling, not utility classes)
- **Google Maps** — `@vis.gl/react-google-maps` ^1.7.1 (Maps JS, Places, Geometry APIs)
- **html2canvas** ^1.4.1 — Map tile capture for crop popup
- **lucide-react** ^0.577.0 — Icons
- **polygon-clipping** ^0.15.7 — 지붕면 병합용 폴리곤 boolean 연산 (union / intersection)
- **Docker** — Multi-stage standalone build (see `Dockerfile`, `docker-compose.yml`)
- **Gemini API** — `@google/genai` ^1.0.0 (AI 지붕 자동 감지)
- **@aws-sdk/client-s3** ^3.1065 — 참조 이미지 S3 업로드 (`/api/image/upload`)
- **zod** ^4.3.6 — API 응답 스키마 검증
- **zod-openapi** ^5.4 — 기존 zod 스키마 → OpenAPI 3.1 문서 생성
- **@scalar/nextjs-api-reference** ^0.10 — `/reference` 페이지에서 Scalar UI 렌더

## Architecture

```
src/
├── app/            # App Router. layout.tsx 만 서버 컴포넌트, 나머지 UI 는 전부 "use client"
│   ├── api/        # 라우트 핸들러 — detect-roof / qsp / musbi / image / openapi
│   ├── components/ # MapView · CropPopup · RoofEditToolbar · AiDetectControls · lnb/
│   ├── utils/      # panelPlacement · mergePolygons · aiDetect · i18n
│   ├── types/      # 도메인 타입 **SSOT** — 타입 질문은 이 파일을 읽는다
│   └── page.tsx    # Home — 모든 상태를 소유하는 단일 클라이언트 컴포넌트
└── lib/            # 서버 모듈 — detect / image / qsp 의 zod 스키마·클라이언트 + openapi.ts
```

그 아래 세부(모듈 책임·불변식·외부 계약·도메인 규칙)는 **본 파일에 복제하지 않는다** — 전부 `docs/okf/` 에 있다.
소스 파일을 열면 `.claude/hooks/okf-hint.py` 가 관련 문서를 자동으로 지목하므로 보통은 아래 표를 볼 일이 없다.
미리 훑고 싶을 때만 쓴다.

| 알고 싶은 것 | 문서 |
|---|---|
| 앱이 무엇을 하는가 · 런타임 구성 · 스타일/i18n 현황 | `docs/okf/system/solar-pv-system.md` |
| 상태 소유·시그널 패턴·레이스 가드 (`page.tsx`) | `docs/okf/modules/page-orchestrator.md` |
| 배치 알고리즘 · 처마 기준변 · 좌표계와 mm/cm/m 단위 · 간격 상수 | `docs/okf/domain/index.md`, `docs/okf/modules/panel-placement.md` |
| HTTP 엔드포인트 계약 · 응답 envelope · OpenAPI/Scalar 노출 조건 | `docs/okf/interfaces/index.md` |
| `proxy.ts` Origin 검증 · per-IP rate limit · 알려진 한계 | `docs/okf/system/security-perimeter.md` |
| 사용자 흐름 단계별 게이트 · 시뮬레이션 제출 3단계 | `docs/okf/workflows/index.md` |
| 환경변수 3파일 체계 · 빌드타임/런타임 구분 | `docs/okf/system/configuration.md` |
| Docker 멀티스테이지 빌드 · Jenkins 파이프라인 | `docs/okf/system/deployment.md` |

### Supplementary Guides

> **우선순위**: 도메인·아키텍처 질문은 `docs/okf/` 가 진실의 원천이다. 본 파일과 어긋나면 **okf 를 따르고 본 파일을 고친다**.
>
> `src/**` 를 수정한 PR 은 `grep -rl "<수정한 파일>" docs/okf/` 로 영향받는 개념을 확인하고, 내용이 어긋나면 고치거나 `status: draft` 로 내린다. 기계 점검은 `pnpm okf:check`.

| 위치 | 내용 |
|------|------|
| `docs/okf/` | **OKF v0.2 지식 번들** (30개 개념). 진입점 `docs/okf/index.md` — 위 표가 그 색인이다 |
| `docs/architecture.md` / `.html` | 시스템 전체 아키텍처 — 레이어·상태 소유·BFF 계약·배치 알고리즘·좌표계·구조적 한계. `.html` 은 SVG 도식 강화판 |
| `docs/ci-cd-pipeline.md` / `.html` | Jenkins 파이프라인 스테이지별 상세 · Docker 멀티스테이지 · 환경변수 주입 경로 · 운영/롤백 절차 |
| `docs/sequence-diagrams.md` | App init / i18n toggle / area calc 시퀀스 다이어그램 |
| `docs/context-manage.md` | 에이전트 컨텍스트 관리 — 세션 상시 로딩 vs Skill/훅 지연 로딩의 실제 동작 |
| `docs/graphify-setup.md` | graphify 도입·운영 세팅 가이드 |
| `docs/codemap-playground.html` | 인터랙티브 코드맵 (브라우저 열람용) |
| `docs/plans/` | UX 개선·기능 도입 계획 문서 |
| `docs/security-review-2026-06-02.md` | 멀티에이전트 보안 코드리뷰 결과 (BFF/detect 공격면·심각도별 발견·완화책) |
| `docs/investigations/2026-06-04-detect-roof-latency-analysis.md` | detect-roof Gemini 지연 진단 (근본원인 랭킹·해결책 우선순위·측정 공백) |

## Coding Conventions

- Use inline styles with CSS variables (`var(--bg-primary)`, `var(--accent-blue)`, etc.)
- Panel dimensions: mm input → meters internally. Gap/margin constants are cm in UI/code (`GAP_X_CM`/`GAP_Y_CM`/`MARGIN_CM` in `page.tsx`) → converted to mm → meters in `panelPlacement.ts`
- Coordinate flow: lat/lng ↔ local meters ↔ pixels (Y-axis flipped for canvas)
- Path alias: `@/*` → `./src/*`
- Fonts: Figtree + Noto Sans JP + Geist Mono via `next/font/google` (`--font-figtree`, `--font-noto-sans-jp`, `--font-geist-mono` CSS vars)
- Prefer React 19.2 patterns and latest API usage
- TypeScript strict mode — no `any` types

## Environment Variables

`.env`(공통) / `.env.dev` / `.env.prod` 3파일로 운영된다. Jenkins 가 `cat 공통 + 선택된 프로파일 > .env` 로
병합하므로 **같은 키는 프로파일이 이긴다**. `NEXT_PUBLIC_*` 두 개만 빌드타임 ARG 라 값을 바꾸려면 컨테이너
재시작이 아니라 이미지 재빌드가 필요하다.

전체 키 목록 · 새 키 추가 절차 · `.env.development` 라는 이름을 쓰지 않는 이유 → **`docs/okf/system/configuration.md`**

⚠️ 새 키를 추가하면 Jenkinsfile `Validate Environment` 스테이지에 `: "${VAR:?...}"` 검증 라인을 반드시
같이 추가한다 (전수 검증 정책). 빠뜨리면 값이 없는 채로 배포가 성공하고 런타임 500/403 으로 나타난다.

## Testing

Currently no test framework configured. Verify changes via:
1. `pnpm lint` — ESLint checks
2. `npx tsc --noEmit` — TypeScript type checks
3. `pnpm build` — Production build validation

## Additional Context

- `AGENTS.md` 는 본 파일(`CLAUDE.md`)을 그대로 import 하는 shim 입니다 — 모든 가이드는 여기에서 관리합니다
- See `README.md` for the user-facing feature list, screenshots, and step-by-step usage
- UI 는 일본어 고정(`<html lang="ja">`)이다. `utils/i18n.ts` 에 영어 번역문이 다 있지만 **전환 UI 가 연결돼 있지 않다** — `docs/okf/system/solar-pv-system.md` 의 i18n 절 참조

## graphify

This project has a graphify knowledge graph at graphify-out/.

`graphify-out/` 은 `.gitignore` 에 포함되어 git 추적 대상이 아닙니다 — 로컬에서 `graphify update .` 로 재생성하세요.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
