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
- **lucide-react** — Icons
- **Docker** — Multi-stage standalone build

## Architecture

### Directory Structure

```
src/app/
├── components/          # UI components (all "use client")
│   ├── AddressSearch    # Google Places autocomplete
│   ├── DrawingToolbar   # Drawing mode controls
│   ├── Header           # App header with logo
│   ├── MapView          # Google Maps + polygon drawing + panel overlay
│   ├── PanelConfig      # Panel size/orientation/gap/margin
│   └── ResultsPanel     # Panel count & area statistics
├── utils/
│   ├── panelPlacement   # Computational geometry for panel layout
│   └── i18n             # Japanese/English translation system
├── types/               # Domain types (LatLng, PanelSize, etc.)
├── globals.css          # CSS custom properties theme
├── layout.tsx           # Root layout (Server Component)
└── page.tsx             # Main page (Client Component, owns all state)
```

### Key Patterns

- **State Management**: `page.tsx` owns all state, passes via props (Props-Down / Callbacks-Up)
- **Styling**: CSS custom properties in `globals.css`, inline styles — NOT Tailwind utility classes
- **i18n**: `utils/i18n.ts` with `t(key, lang)` function, `Lang` type (`"ja" | "en"`), toggle in sidebar footer
- **Panel Placement**: lat/lng → local meters → grid aligned to longest polygon edge → validation → lat/lng

### Domain Types

| Type | Description |
|------|-------------|
| `LatLng` | Latitude/longitude coordinate |
| `PanelSize` | Panel dimensions (label, width, height in mm) |
| `PanelOrientation` | `"portrait"` or `"landscape"` |
| `DrawingMode` | `"install"`, `"exclude"`, or `null` |
| `PolygonArea` | Install/exclude polygon (id, type, paths) |
| `PlacedPanel` | Placed panel with 4 corner coordinates |

## Coding Conventions

- Use inline styles with CSS variables (`var(--bg-primary)`, `var(--accent-blue)`, etc.)
- All panel dimensions: mm input → meters internally
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
