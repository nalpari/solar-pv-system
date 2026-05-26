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
- **html2canvas** ^1.4.1 — Map tile capture for crop popup + PNG export
- **lucide-react** ^0.577.0 — Icons
- **Docker** — Multi-stage standalone build (see `Dockerfile`, `docker-compose.yml`)
- **Gemini API** — `@google/genai` ^1.0.0 (AI 지붕 자동 감지)
- **sharp** ^0.34.5 — 서버 측 이미지 처리 (북방 마커 오버레이)
- **zod** ^4.3.6 — API 응답 스키마 검증
- **zod-openapi** ^5.4 — 기존 zod 스키마 → OpenAPI 3.1 문서 생성
- **@scalar/nextjs-api-reference** ^0.10 — `/reference` 페이지에서 Scalar UI 렌더

## Architecture

### Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── detect-roof/      # /api/detect-roof — Gemini Vision 호출 라우트 (서버)
│   │   ├── openapi/          # /api/openapi — buildOpenApiDocument() JSON 제공
│   │   └── qsp/              # /api/qsp/* — QSP BFF 3종 (btc-items / sim-check / sim-calc)
│   ├── reference/           # /reference — Scalar API Reference UI
│   ├── components/          # UI components (all "use client")
│   │   ├── AddressSearch    # Google Places autocomplete
│   │   ├── CropPopup        # Crop image popup with Canvas polygon editor, panel rendering, PNG save
│   │   ├── Header           # App header with Hanwha Japan logo
│   │   ├── MapView          # Google Maps satellite view + crop overlay + zoom/recenter controls
│   │   ├── PanelConfig      # Panel size preset (60-cell / 72-cell / Large / Custom, mm)
│   │   ├── ResultsPanel     # Panel count, capacity, area, coverage ratio
│   │   ├── RoofEditToolbar  # Floating toolbar over map (select / drawRoof / drawOpening / flowSetting / editRoof / undo / delete)
│   │   └── SimulationPanel  # Generation simulation inputs (azimuth, battery, monthly electric cost)
│   ├── utils/
│   │   ├── aiDetect         # Gemini detect fetch 래퍼 + 정규화→픽셀 변환 어댑터
│   │   ├── panelPlacement   # Computational geometry (lat/lng + pixel-based panel layout)
│   │   └── i18n             # Japanese/English translation system
│   ├── types/               # Domain types (LatLng, CropData, PixelPanel, NormalizedPolygon, etc.)
│   ├── globals.css          # CSS custom properties theme
│   ├── layout.tsx           # Root layout (Server Component, html lang="ja")
│   └── page.tsx             # Main page (Client Component, owns all state, hosts design/simulation tabs)
└── lib/
    ├── detect/              # Gemini Vision 백엔드 모듈 (schema.ts / prompt.ts / overlay.ts)
    ├── qsp/                 # QSP BFF 모듈 (schema.ts / client.ts)
    └── openapi.ts           # 기존 zod 스키마 → OpenAPI 3.1 문서 빌더 (SSOT)
```

### API Documentation

- 사양 SSOT: `src/lib/qsp/schema.ts`, `src/lib/detect/schema.ts` 의 zod 스키마
- 빌더: `src/lib/openapi.ts` — `createDocument({ reused: "ref" })` 로 OpenAPI 3.1 생성. `.meta({ id })` 부여된 스키마는 `components.schemas` 에 자동 등록되며 paths 에서 `$ref` 로 참조된다 (8개 컴포넌트: `DetectRequest`, `DetectResponse`, `DetectPolygon`, `BboxResponse`, `ErrorEnvelope`, `BtcItem`, `SimulationInput`, `SimCalcResponse` + 3개 응답 envelope `BtcItemsResponse` / `SimCheckResponse` / `SimCalcSuccessResponse`)
- 엔드포인트 (둘 다 `ENABLE_API_DOCS=true` 환경에서만 노출, 그 외에는 404 — 내부 API 명세 노출 차단. `NODE_ENV` 가드는 dev/prod 모두 production 빌드를 쓰는 배포 모델과 충돌하므로 사용하지 않음):
  - `GET /api/openapi` — OpenAPI 3.1 JSON (모듈 스코프 lazy memoize)
  - `GET /reference` — Scalar 기반 API Reference UI (dev: http://localhost:3000/reference)
- 라우트 보호: `/api/qsp/*` 는 `src/proxy.ts` 에서 Origin 검증 + per-IP rate limit (1분 30회, in-memory sliding window) 적용 — 단일 인스턴스 배포 전제, 스케일아웃 시 분산 저장소로 교체 필요. Next.js 16 의 proxy 컨벤션을 따른다 (구 `middleware` 컨벤션 deprecated)

### Key Patterns

- **State Management**: `page.tsx` owns all state, passes via props (Props-Down / Callbacks-Up). Sidebar tabs (`design` | `simulation`) are also held there.
- **Styling**: CSS custom properties in `globals.css`, inline styles — NOT Tailwind utility classes
- **i18n**: `utils/i18n.ts` with `t(key, lang)` function, `Lang` type (`"ja" | "en"`), sidebar footer toggle synced to `<html lang>` in `page.tsx`
- **Workflow**: Address search → confirm building (drag crop on map, captured via `html2canvas`) → CropPopup polygon editor (drawRoof / drawOpening / flowSetting / editRoof) → set slope (寸 단위, 0.5–10) and module preset → place modules (auto picks portrait or landscape, whichever fits more) → results panel + PNG save → optional Simulation tab input
- **Panel Placement**: Three functions in `utils/panelPlacement.ts`
  - `placePanels` — lat/lng-based (mm internal)
  - `placePanelsOnCanvas` — pixel-based (mm internal)
  - `placePanelsOnCanvasCm` — pixel-based, **cm UI-facing entry** used by `page.tsx`; internally calls the mm version
- **Eave-parallel layout**: Each install polygon's `eaveEdgeIndex` (set via `flowSetting` tool) drives grid orientation so modules align with the chosen eave edge; without it, the longest edge is used.
- **Constants**: `GAP_CM = 0.3`, `MARGIN_CM = 30` are hardcoded in `page.tsx` (not part of `PanelConfig` UI).

### Domain Types (`src/app/types/index.ts`)

| Type | Description |
|------|-------------|
| `LatLng` | Latitude/longitude coordinate |
| `PanelSize` | Panel dimensions (label, width, height in mm) |
| `PanelOrientation` | `"portrait"` or `"landscape"` |
| `DrawingMode` | `"install"`, `"exclude"`, or `null` |
| `PolygonArea` | Install/exclude polygon (id, type, paths, optional `eaveEdgeIndex`) |
| `PlacedPanel` | Placed panel (`polygonId` + 4 lat/lng corners) |
| `CropData` | Crop result (image data URL, bounds, address, zoom, sizeMeters) |
| `CropBounds` | SW/NE lat/lng bounds of cropped area |
| `PixelPoint` | x/y coordinate in pixel space |
| `PixelPolygon` | Install/exclude polygon in pixel coordinates (optional `eaveEdgeIndex`) |
| `PixelPanel` | Placed panel (`polygonId` + 4 pixel corners) |
| `PolygonSubMode` | `"idle"` \| `"selected"` \| `"moving"` \| `"editing_vertices"` |

### Supplementary Guides

코드 작업 전에 해당 영역의 룰 파일을 참고하세요. AGENTS.md 가 본 파일을 import 하므로 동일 컨텍스트로 로드됩니다.

| 위치 | 내용 |
|------|------|
| `.claude/rules/components.md` | Page 구조 · 주요 컴포넌트 · 도메인 타입 요약 |
| `.claude/rules/utils.md` | `panelPlacement.ts` 좌표 변환 / 단위 체계 / Y축 flip |
| `.claude/rules/styles.md` | CSS 커스텀 프로퍼티 vs Tailwind 사용 원칙 |
| `.claude/rules/docker.md` | Docker 멀티스테이지 빌드 / compose 명령 |
| `docs/architecture.md` | 시스템 전체 아키텍처 도식 |
| `docs/sequence-diagrams.md` | App init / i18n toggle / area calc 시퀀스 다이어그램 |
| `docs/context-manage.md` | AI 에이전트 컨텍스트 관리 사례 노트 |
| `docs/graphify-setup.md` | graphify 도입·운영 세팅 가이드 |
| `docs/codemap-playground.html` | 인터랙티브 코드맵 (브라우저 열람용) |
| `docs/plans/` | UX 개선·기능 도입 계획 문서 |

## Coding Conventions

- Use inline styles with CSS variables (`var(--bg-primary)`, `var(--accent-blue)`, etc.)
- Panel dimensions: mm input → meters internally. Gap/margin constants are cm in UI/code (`GAP_CM`, `MARGIN_CM` in `page.tsx`) → converted to mm → meters in `panelPlacement.ts`
- Coordinate flow: lat/lng ↔ local meters ↔ pixels (Y-axis flipped for canvas)
- Path alias: `@/*` → `./src/*`
- Fonts: Figtree + Noto Sans JP + Geist Mono via `next/font/google` (`--font-figtree`, `--font-noto-sans-jp`, `--font-geist-mono` CSS vars)
- Prefer React 19.2 patterns and latest API usage
- TypeScript strict mode — no `any` types

## Environment Variables

`.env` 는 세 파일로 분리되어 운영됩니다:

| 파일 | 역할 | Jenkins credential |
|------|------|---------------------|
| `.env` | 공통 키 (dev/prod 모두 동일) | `pv-simulation-env-common` (file) |
| `.env.dev` | dev 배포 전용 오버라이드 | `pv-simulation-env-dev` (file) |
| `.env.prod` | prod 배포 전용 오버라이드 | `pv-simulation-env-prod` (file) |

Jenkinsfile 의 `Load Env Credential` 스테이지에서 `cat common + 선택된 profile > .env` 로 병합되며, 같은 키가 양쪽에 있으면 **profile 파일이 공통을 오버라이드** 합니다. docker-compose 는 `env_file: .env` 로 통째 마운트해 컨테이너에 주입합니다.

> ⚠️ 파일명에 `.env.development` / `.env.production` 을 쓰지 않는 이유 — Next.js 가 `NODE_ENV` 에 따라 해당 파일을 자동 로드하기 때문. 배포는 dev/prod 모두 `NODE_ENV=production` 으로 빌드되므로 의미 충돌을 피하기 위해 `.env.dev` / `.env.prod` 로 명명합니다.

| Variable | 위치 | 빌드/런타임 | 설명 |
|----------|------|-------------|------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `.env` (공통) | **빌드타임 ARG** (클라이언트 번들 인라인) | Google Maps API key (Maps JS, Places, Geometry APIs) |
| `NEXT_PUBLIC_AWS_S3_BASE_URL` | `.env` (공통) | **빌드타임 ARG** (클라이언트 번들 인라인) | S3 기준 이미지 베이스 URL |
| `GEMINI_API_KEY` | `.env` (공통) | 런타임 | Gemini API key. Server route only |
| `GEMINI_MODEL` | `.env` (공통) | 런타임 | Gemini model identifier (예: `"gemini-3.1-pro-preview"`). 미설정 시 `/api/detect-roof`는 500 응답 |
| `AWS_REGION` | `.env` (공통) | 런타임 | S3 리전 (예: `ap-northeast-1`) |
| `AMPLIFY_BUCKET` | `.env` (공통) | 런타임 | S3 버킷명 (지붕 형상 추론 기준 이미지 업로드용) |
| `AWS_ACCESS_KEY_ID` | `.env` (공통) | 런타임 | S3 업로드 IAM 자격 |
| `AWS_SECRET_ACCESS_KEY` | `.env` (공통) | 런타임 | S3 업로드 IAM 자격 |
| `QSP_API_HOST` | `.env.dev` / `.env.prod` | 런타임 | QSalesPlatform 마스터 데이터 API 호스트. 환경별로 다름 |
| `ENABLE_API_DOCS` | `.env.dev` / `.env.prod` | 런타임 | `"true"` 일 때만 `/api/openapi` 와 `/reference` 노출. dev=true / prod=false 권장 |

새 키 추가 워크플로:
- **공통 키**: Jenkins UI 의 `pv-simulation-env-common` credential 파일에 추가
- **환경별 키**: `pv-simulation-env-dev` / `pv-simulation-env-prod` credential 파일에 추가
- **`NEXT_PUBLIC_*` 키**: 위 + Dockerfile 에 `ARG`/`ENV` 2줄 + docker-compose.yml 각 서비스 `build.args` 에 1줄 추가
- **모든 키**: Jenkinsfile `Validate Environment` 스테이지의 `: "${VAR:?...}"` 검증 라인 추가 (전수 검증 정책)

## Testing

Currently no test framework configured. Verify changes via:
1. `pnpm lint` — ESLint checks
2. `npx tsc --noEmit` — TypeScript type checks
3. `pnpm build` — Production build validation

## Additional Context

- `AGENTS.md` 는 본 파일(`CLAUDE.md`)을 그대로 import 하는 shim 입니다 — 모든 가이드는 여기에서 관리합니다
- See `README.md` for the user-facing feature list, screenshots, and step-by-step usage
- The app defaults to Japanese UI (`<html lang="ja">`) with English toggle available in the sidebar footer
- Generation simulation backend is not wired up yet — `SimulationPanel` only collects input

## graphify

This project has a graphify knowledge graph at graphify-out/.

`graphify-out/` 은 `.gitignore` 에 포함되어 git 추적 대상이 아닙니다 — 로컬에서 `graphify update .` 로 재생성하세요.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
