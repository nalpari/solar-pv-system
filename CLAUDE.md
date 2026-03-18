# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — Start dev server (Next.js)
- `pnpm build` — Production build
- `pnpm start` — Serve production build
- `pnpm lint` — Run ESLint (flat config, core-web-vitals + typescript rules)

## Tech Stack

- **Next.js 16** with App Router (`src/app/`)
- **React 19** with React Compiler enabled (`reactCompiler: true` in next.config.ts)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- Path alias: `@/*` maps to `./src/*`
- Fonts: Geist Sans + Geist Mono (via `next/font/google`)

## Architecture

This is a fresh Next.js App Router project. All pages/layouts live under `src/app/`. There are no API routes, additional pages, or shared components yet.

## Memo

- 모든 답변과 추론과정은 한국어로 작성한다.
- task가 끝나면 서브 에이전트를 사용해서 린트체크, 타입체크, 빌드체크를 수행한다.
- 린트체크시 오류가 있으면 반드시 해결하고 넘어가도록 하고, 경고가 있더라도 해결하려고 노력한다.
- 커밋시에 접두사는 영어로 나머지 타이틀과 내용은 한국어로 작성한다.
- task 완료시 CLAUDE.md 및 README.md 문서에 업데이트가 필요하면 진행한다.