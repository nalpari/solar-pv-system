# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note:** AI 에이전트 공통 가이드는 [AGENTS.md](./AGENTS.md)를 참조하세요. 이 문서는 Claude Code 전용 설정을 포함합니다.

## Commands

- `pnpm dev` — Start dev server (Next.js)
- `pnpm build` — Production build
- `pnpm start` — Serve production build
- `pnpm lint` — Run ESLint (flat config, core-web-vitals + typescript rules)
- `docker compose up --build` — Docker 컨테이너 빌드 및 실행
- `docker compose down` — Docker 컨테이너 중지

## Tech Stack

- **Next.js 16.2** with App Router (`src/app/`)
- **React 19** with React Compiler enabled (`reactCompiler: true` in next.config.ts)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **Google Maps** via `@vis.gl/react-google-maps` (requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
- **html2canvas** for map tile capture
- **lucide-react** for icons
- **Docker** — Multi-stage build with standalone output for production deployment
- Path alias: `@/*` maps to `./src/*`
- Fonts: Geist Sans + Geist Mono (via `next/font/google`)

## Architecture

Solar PV rooftop panel layout planner — single-page app with a left sidebar + Google Maps main area.

### Page structure

`page.tsx` is a `"use client"` component that owns all application state (areas, panel config, placed panels) and passes it down to child components. No server components beyond `layout.tsx`.

### Key components (`src/app/components/`)

- **MapView** — Google Maps with satellite imagery and crop area selection overlay (html2canvas capture)
- **CropPopup** — Cropped image popup with Canvas-based polygon editor and panel rendering. Supports image save (PNG download)
- **AddressSearch** — Places autocomplete to navigate the map
- **DrawingToolbar** — Crop mode toggle (before crop) / polygon drawing mode controls (after crop)
- **PanelConfig** — Panel size (mm), orientation, gap (cm), and margin (cm) controls
- **ResultsPanel** — Displays panel count and area calculations

### Core logic (`src/app/utils/`)

- **panelPlacement.ts** — Computational geometry engine with placement functions:
  - `placePanels` — lat/lng-based (mm 단위): converts to local meters, grid-aligns to longest edge, validates containment
  - `placePanelsOnCanvas` — pixel-based (mm 단위): uses metersPerPixel scale factor, flips Y-axis for canvas coordinates
  - `placePanelsOnCanvasCm` — pixel-based (cm 단위): UI에서 사용, 내부적으로 mm 버전 호출

### Types (`src/app/types/index.ts`)

Domain types: `LatLng`, `PanelSize`, `PanelOrientation`, `DrawingMode`, `PolygonArea`, `PlacedPanel`, `CropData`, `CropBounds`, `PixelPoint`, `PixelPolygon`, `PixelPanel`.

### Styling

CSS custom properties defined in `globals.css` (e.g., `--bg-primary`, `--text-primary`, `--accent-blue`). Components use inline styles with these variables — not Tailwind utility classes.

## Memo

- 모든 답변과 추론과정은 한국어로 작성한다.
- 가급적 react 19.2 버전의 최신 문법을 사용한다.
- task가 끝나면 서브 에이전트를 사용해서 린트체크, 타입체크, 빌드체크를 수행한다.
- 린트체크시 오류가 있으면 반드시 해결하고 넘어가도록 하고, 경고가 있더라도 해결하려고 노력한다.
- 커밋시에 접두사는 영어로 나머지 타이틀과 내용은 한국어로 작성한다.
- task 완료시 CLAUDE.md 및 README.md 문서에 업데이트가 필요하면 진행한다.
