# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server (Next.js)
- `npm run build` — Production build
- `npm run start` — Serve production build
- `npm run lint` — Run ESLint (flat config, core-web-vitals + typescript rules)

## Tech Stack

- **Next.js 16** with App Router (`src/app/`)
- **React 19** with React Compiler enabled (`reactCompiler: true` in next.config.ts)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- Path alias: `@/*` maps to `./src/*`
- Fonts: Geist Sans + Geist Mono (via `next/font/google`)

## Architecture

This is a fresh Next.js App Router project. All pages/layouts live under `src/app/`. There are no API routes, additional pages, or shared components yet.
