# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note:** AI 에이전트 공통 가이드는 [AGENTS.md](./AGENTS.md)를 참조하세요. 이 문서는 Claude Code 전용 설정을 포함합니다.

## Commands

- `pnpm dev` — Start dev server (Next.js)
- `pnpm build` — Production build
- `pnpm start` — Serve production build
- `pnpm lint` — Run ESLint (flat config, core-web-vitals + typescript rules)

## Tech Stack

- **Next.js 16.2** with App Router (`src/app/`)
- **React 19** with React Compiler enabled (`reactCompiler: true` in next.config.ts)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **Google Maps** via `@vis.gl/react-google-maps` (requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
- **html2canvas** for map tile capture
- **lucide-react** for icons
- Path alias: `@/*` maps to `./src/*`
- Fonts: Geist Sans + Geist Mono (via `next/font/google`)

## Architecture

Solar PV rooftop panel layout planner — single-page app with a left sidebar + Google Maps main area.

> 상세 아키텍처 정보는 `.claude/rules/`의 조건부 규칙 파일에서 작업 컨텍스트에 맞게 자동 로드됩니다:
> - `components.md` — 컴포넌트 구조 및 도메인 타입 (`src/app/components/`, `page.tsx`)
> - `utils.md` — 핵심 알고리즘 및 유틸리티 (`src/app/utils/`)
> - `styles.md` — 스타일링 규칙 (`globals.css`, 컴포넌트 TSX)
> - `docker.md` — Docker 빌드 및 배포 (`Dockerfile`, `docker-compose*`)

## Memo

- 모든 답변과 추론과정은 한국어로 작성한다.
- 가급적 react 19.2 버전의 최신 문법을 사용한다.
- task가 끝나면 서브 에이전트를 사용해서 린트체크, 타입체크, 빌드체크를 수행한다.
- 린트체크시 오류가 있으면 반드시 해결하고 넘어가도록 하고, 경고가 있더라도 해결하려고 노력한다.
- 커밋시에 접두사는 영어로 나머지 타이틀과 내용은 한국어로 작성한다.
- task 완료시 CLAUDE.md 및 README.md 문서에 업데이트가 필요하면 진행한다.
