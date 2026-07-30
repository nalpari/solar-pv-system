---
type: System
title: Solar PV System
description: Google Maps 위성영상 위에 지붕 태양광 모듈 배치를 설계하고 외부 발전 시뮬레이션으로 넘기는 단일 페이지 Next.js 앱.
resource: src/app/page.tsx
tags: [system, nextjs, overview]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: claude-md
    resource: CLAUDE.md
    title: 프로젝트 에이전트 가이드
    last_modified: 2026-07-23
  - id: page
    resource: src/app/page.tsx
    title: Home — 최상위 클라이언트 컴포넌트
  - id: pkg
    resource: package.json
    title: 의존성 목록
    last_modified: 2026-07-23
---

# 무엇을 하는 시스템인가

주소를 검색해 건물 지붕을 위성영상에서 잘라내고(crop), 잘라낸 이미지 위에 지붕면 폴리곤을 그린 뒤,
선택한 모듈 규격으로 최대 장수를 자동 배치하고, 그 결과를 외부 발전 시뮬레이션(MUSBI)으로 넘긴다.

일본 시장용이다. 기본 UI 언어가 일본어이고, 지붕 경사를 각도가 아니라 [寸(sun)](/domain/roof-slope-sun.md) 으로 입력받으며,
모듈 마스터와 시뮬레이션은 한화큐셀 재팬의 사내 시스템(QSP / MUSBI)에 붙는다.

# 런타임 구성

| 축 | 내용 |
|----|------|
| 프레임워크 | Next.js 16.2 App Router, `output: "standalone"`, React Compiler 활성 |
| 렌더링 | `src/app/layout.tsx` 만 서버 컴포넌트. 나머지 UI 는 전부 `"use client"` |
| 상태 | [`Home`](/modules/page-orchestrator.md) 단독 소유 — Props-Down / Callbacks-Up |
| 스타일 | `globals.css` 의 CSS custom property + 인라인 스타일. **Tailwind 유틸리티 클래스를 쓰지 않는다** (v4 는 설치만 되어 있음) |
| 서버 코드 | `src/app/api/**` 라우트 핸들러 + `src/lib/**`. 전부 `runtime = "nodejs"` |
| 저장소 | 없음. 세션 상태는 브라우저 메모리에만 있고 새로고침하면 사라진다 |
| 테스트 | 프레임워크 없음. 검증 수단은 `pnpm lint` / `npx tsc --noEmit` / `pnpm build` 뿐 |

# 경계

- **클라이언트가 직접 부르는 외부 서비스는 Google Maps 뿐이다** — Maps JS / Places / Geometry / Geocoder.
  API 키가 `NEXT_PUBLIC_*` 로 번들에 인라인되므로 키 제한은 Google Cloud 콘솔의 리퍼러 제한에 의존한다.
- **그 외 외부 호출은 전부 BFF 경유** — Gemini · Replicate · QSP · MUSBI · S3 는 서버 라우트가 호출하고
  자격증명은 클라이언트에 노출되지 않는다. [interfaces](/interfaces/index.md) 참조.
- 그 BFF 들은 [`security-perimeter.md`](security-perimeter.md) 의 Origin 검증 + rate limit 뒤에 있다.

# i18n

`src/app/utils/i18n.ts` 의 `t(key, lang)` 함수 하나가 전부다. `Lang = "ja" | "en"`, 사전은 모듈 스코프 객체 리터럴.

⚠️ **언어 전환 UI 는 존재하지 않는다.** `page.tsx:110` 이

```ts
const [lang] = useState<Lang>("ja");
```

로 setter 를 버려서 `"ja"` 고정이다. 저장소 전체에 `setLang` / `onLangChange` 호출부가 없다.
영어 번역문은 전부 갖춰져 있으므로, 토글을 붙이는 작업은 setter 를 노출해 `Lnb` 로 내려주는 것으로 끝난다.

(`CLAUDE.md` 는 2026-07-27 까지 "sidebar footer toggle" 이 있다고 잘못 적고 있었다. 이 번들 작성 중 발견해 수정했다.)

# 참고 자료

- 구조 도식: `docs/architecture.md` · 시퀀스: `docs/sequence-diagrams.md`
- 보안 리뷰: `docs/security-review-2026-06-02.md`
- 지연 진단: `docs/investigations/2026-06-04-detect-roof-latency-analysis.md`
- 지식 그래프: `graphify-out/` (git 미추적 — `graphify update .` 로 재생성)
