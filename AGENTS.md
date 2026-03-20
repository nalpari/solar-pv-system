# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, GitHub Copilot, etc.) when working with this repository.

## Project Overview

Solar PV rooftop panel layout planner — a single-page web application that lets users design solar panel layouts on building rooftops using Google Maps satellite imagery.

## Quick Start

```bash
pnpm install
cp .env.example .env.local  # Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
pnpm dev                     # http://localhost:3000
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build |
| `pnpm lint` | Run ESLint (flat config) |
| `docker compose up --build` | Docker build & run |

## Tech Stack

- **Next.js 16.2** — App Router, React Compiler enabled, Turbopack
- **React 19.2** — React Compiler (`reactCompiler: true` in next.config.ts)
- **TypeScript** — strict mode
- **Tailwind CSS v4** — via `@tailwindcss/postcss` (CSS custom properties used for styling, not utility classes)
- **Google Maps** — `@vis.gl/react-google-maps` (Maps, Places, Drawing, Geometry APIs)
- **html2canvas** — Map tile capture for crop popup
- **lucide-react** — Icons
- **Docker** — Multi-stage standalone build

## Architecture

### Directory Structure

```
src/app/
├── components/          # UI components (all "use client")
│   ├── AddressSearch    # Google Places autocomplete
│   ├── CropPopup        # Crop image popup with Canvas polygon editor + panel rendering
│   ├── DrawingToolbar   # Crop mode toggle / polygon drawing mode controls
│   ├── Header           # App header with logo
│   ├── MapView          # Google Maps + crop area selection overlay
│   ├── PanelConfig      # Panel size(mm)/orientation/gap(cm)/margin(cm)
│   └── ResultsPanel     # Panel count & area statistics
├── utils/
│   ├── panelPlacement   # Computational geometry (lat/lng + pixel-based panel layout)
│   └── i18n             # Japanese/English translation system
├── types/               # Domain types (LatLng, CropData, PixelPanel, etc.)
├── globals.css          # CSS custom properties theme
├── layout.tsx           # Root layout (Server Component)
└── page.tsx             # Main page (Client Component, owns all state)
```

### Key Patterns

- **State Management**: `page.tsx` owns all state, passes via props (Props-Down / Callbacks-Up)
- **Styling**: CSS custom properties in `globals.css`, inline styles — NOT Tailwind utility classes
- **i18n**: `utils/i18n.ts` with `t(key, lang)` function, `Lang` type (`"ja" | "en"`), toggle in sidebar footer
- **Workflow**: Address search → map crop → popup polygon editor → panel placement → save as image
- **Panel Placement**: Three functions — lat/lng-based (`placePanels`, mm), pixel-based (`placePanelsOnCanvas`, mm), pixel-based (`placePanelsOnCanvasCm`, cm — UI에서 사용)

### Domain Types

| Type | Description |
|------|-------------|
| `LatLng` | Latitude/longitude coordinate |
| `PanelSize` | Panel dimensions (label, width, height in mm) |
| `PanelOrientation` | `"portrait"` or `"landscape"` |
| `DrawingMode` | `"install"`, `"exclude"`, or `null` |
| `PolygonArea` | Install/exclude polygon (id, type, paths) |
| `PlacedPanel` | Placed panel with 4 lat/lng corner coordinates |
| `CropData` | Crop result (image data URL, bounds, address, zoom, sizeMeters) |
| `CropBounds` | SW/NE lat/lng bounds of cropped area |
| `PixelPoint` | x/y coordinate in pixel space |
| `PixelPolygon` | Install/exclude polygon in pixel coordinates |
| `PixelPanel` | Placed panel with 4 pixel corner coordinates |

## Coding Conventions

- Use inline styles with CSS variables (`var(--bg-primary)`, `var(--accent-blue)`, etc.)
- Panel dimensions: mm input → meters internally. Gap/margin: cm input (UI) → mm → meters internally
- Path alias: `@/*` → `./src/*`
- Fonts: Geist Sans + Geist Mono via `next/font/google`
- Prefer React 19.2 patterns and latest API usage
- TypeScript strict mode — no `any` types

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Google Maps API key (Maps JS, Places, Drawing, Geometry APIs) |

## Testing

Currently no test framework configured. Verify changes via:
1. `pnpm lint` — ESLint checks
2. `npx tsc --noEmit` — TypeScript type checks
3. `pnpm build` — Production build validation

## Additional Context

- See `CLAUDE.md` for Claude Code-specific instructions (language preferences, commit conventions)
- The app defaults to Japanese UI with English toggle available
