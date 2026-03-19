# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — Start dev server (Next.js)
- `pnpm build` — Production build
- `pnpm start` — Serve production build
- `pnpm lint` — Run ESLint (flat config, core-web-vitals + typescript rules)
- `docker compose up --build` — Docker 컨테이너 빌드 및 실행
- `docker compose down` — Docker 컨테이너 중지

## Tech Stack

- **Next.js 16** with App Router (`src/app/`)
- **React 19** with React Compiler enabled (`reactCompiler: true` in next.config.ts)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **Google Maps** via `@vis.gl/react-google-maps` (requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
- **lucide-react** for icons
- **Docker** — Multi-stage build with standalone output for production deployment
- Path alias: `@/*` maps to `./src/*`
- Fonts: Geist Sans + Geist Mono (via `next/font/google`)

## Architecture

Solar PV rooftop panel layout planner — single-page app with a left sidebar + Google Maps main area.

### Page structure

`page.tsx` is a `"use client"` component that owns all application state (areas, panel config, placed panels) and passes it down to child components. No server components beyond `layout.tsx`.

### Key components (`src/app/components/`)

- **MapView** — Google Maps with satellite imagery, polygon drawing (install/exclude areas), and panel overlay rendering
- **AddressSearch** — Places autocomplete to navigate the map
- **DrawingToolbar** — Toggle install/exclude polygon drawing modes
- **PanelConfig** — Panel size (mm), orientation, gap, and margin controls
- **ResultsPanel** — Displays panel count and area calculations

### Core logic (`src/app/utils/`)

- **panelPlacement.ts** — Computational geometry engine: converts lat/lng to local meter coordinates, insets polygons by margin, aligns panel grid to the longest polygon edge, checks point-in-polygon containment, and excludes panels overlapping exclusion zones. All dimensions are in mm (user input) converted to meters internally.

### Types (`src/app/types/index.ts`)

Domain types: `LatLng`, `PanelSize`, `PanelOrientation`, `DrawingMode`, `PolygonArea`, `PlacedPanel`.

### Styling

CSS custom properties defined in `globals.css` (e.g., `--bg-primary`, `--text-primary`, `--accent-blue`). Components use inline styles with these variables — not Tailwind utility classes.

## Memo

- 모든 답변과 추론과정은 한국어로 작성한다.
- 가급적 react 19.2 버전의 최신 문법을 사용한다.
- task가 끝나면 서브 에이전트를 사용해서 린트체크, 타입체크, 빌드체크를 수행한다.
- 린트체크시 오류가 있으면 반드시 해결하고 넘어가도록 하고, 경고가 있더라도 해결하려고 노력한다.
- 커밋시에 접두사는 영어로 나머지 타이틀과 내용은 한국어로 작성한다.
- task 완료시 CLAUDE.md 및 README.md 문서에 업데이트가 필요하면 진행한다.
