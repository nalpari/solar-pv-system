# solar-precision의 AI 지붕 감지 기능 이식 계획

> **소스 레포**: `../../../solar-precision/`
> **타겟 레포**: solar-pv-system (이 레포)
> **목표**: 사용자가 영역을 크롭하면 Gemini가 자동으로 지붕면 폴리곤을 감지하여 CropPopup에 표출

---

## 1. 개요

solar-precision은 위성 이미지로부터 Gemini Vision으로 지붕면을 자동 감지하는 앱이다.
solar-pv-system은 사용자가 수동으로 지붕 폴리곤을 그려 패널을 배치하는 앱이다.

본 계획은 solar-precision의 **AI 감지 백엔드**를 그대로 이식하고, solar-pv-system의 **크롭 → 폴리곤 → 패널 배치** 워크플로우에 자동 감지 단계를 끼워넣는 작업이다.

### 핵심 인사이트

두 앱의 데이터 형태가 호환된다:
- solar-precision API 입력: `{ imageDataUrl, bounds:{sw,ne} }`
- solar-pv-system `CropData`: 동일 구조 (`src/app/types/index.ts:36`)

→ 백엔드는 거의 복사, 클라이언트는 좌표 어댑터 한 곳만 추가하면 통합 가능.

---

## 2. 의사결정 매트릭스 (확정)

| # | 결정 | 확정 내용 |
|---|------|---------|
| D1 | AI 모델 | **Gemini만**. Claude 라우트/SDK/키 전부 제외 |
| D2 | 트리거 | **수동 트리거** — 크롭 후 CropPopup이 영역 이미지를 표출하고, 하단의 "AI 분석 시작" 버튼을 사용자가 클릭해야 분석 시작. 솔라프리시젼 원본의 `PreviewModal.onConfirm` 흐름을 그대로 옮긴 것. 기획서 V1.0/2026-04-30 반영 |
| D8 | 재분석 confirm | 지붕면이 이미 생성된 상태에서 "AI 분석 시작"을 재클릭하면 confirm 다이얼로그 표시 — "AI 분석을 다시 하시겠습니까? 작성된 지붕면 정보가 모두 초기화 됩니다." 확인 시 기존 지붕면/패널 삭제 후 재분석 |
| D9 | 분석 중 비활성화 | 분석 진행 중에는 사이드바의 **경사 설정 / 모듈 및 배치방법 / 모듈 배치 완료 / 발전 시뮬레이션 계산 입력** 버튼을 모두 비활성화. CropPopup의 "AI 분석 시작" 버튼은 "AI 분석 중" 으로 텍스트 전환 + 비활성, "AI 분석 취소" 버튼만 활성 |
| D10 | 실패 처리 | alert 모달 표시 — "AI 分析に失敗しました。しばらく後でもう一度お試しください。" (i18n으로 ja/en 분리). 닫으면 idle 상태 복귀, 사용자가 재시도 가능 |
| D3 | 폴리곤 충돌 | **D8로 통합 처리됨**. 재분석 시 confirm 다이얼로그 후 기존 사용자/AI 폴리곤 모두 초기화 (수동 트리거 도입으로 충돌 시나리오가 다시 발생 → D8이 명시적으로 처리) |
| D4 | azimuth/tilt 활용 | **완전 무시**. API는 받지만 클라에서 `points`만 사용. PixelPolygon 타입 변경 없음 |
| D5 | API 키 관리 | **`.env` + docker-compose `environment:`**. 기존 Google Maps 키 방식과 동일 패턴 |
| D6 | 에러 처리 | **에러 메시지 표시만**. 폴백/재시도 없음 |
| D7 | graphify | **`graphify update .` (AST-only)는 로컬에서만 실행**. `graphify-out/`은 **git 추적 대상이 아님** (8a9886a로 정책 변경 — `.gitignore`에 `graphify-out/` 추가, AGENTS.md L159 갱신). 따라서 커밋에 포함 안 함. **풀 빌드(`/graphify --update`)도 본 plan 범위 외 — 문서/이미지 변경 시 또는 PR 머지 시점에 형님이 명시적으로 로컬 실행** |

---

## 3. 전체 워크플로우 다이어그램

```mermaid
flowchart TD
  A[사용자: 주소 검색] --> B[지도에서 영역 드래그]
  B --> C[html2canvas로 캡처]
  C --> D[CropData 생성]
  D --> E[CropPopup 표출]
  E --> F{자동 트리거}
  F -->|성공| G[POST /api/detect-roof]
  G --> H[Gemini 2단계 호출]
  H --> I[정규화 폴리곤 응답]
  I --> J[normalizedToPixelPolygons]
  J --> K[setPixelAreas]
  K --> L[CropPopup에 폴리곤 표출]
  L --> M[사용자: 패널 배치/수정]
  F -->|실패| N[에러 배너 표시]
  N --> M
```

---

## 4. 작업 Phase 개요

```mermaid
flowchart LR
  P0[Phase 0<br/>준비] --> P1[Phase 1<br/>백엔드 이식]
  P1 --> P2[Phase 2<br/>어댑터/타입]
  P2 --> P3[Phase 3<br/>UI 통합]
  P3 --> P4[Phase 4<br/>운영 환경]
  P4 --> P5[Phase 5<br/>검증]
  P5 --> P6[Phase 6<br/>마무리]

  style P0 fill:#e3f2fd
  style P1 fill:#fff3e0
  style P2 fill:#fff3e0
  style P3 fill:#fce4ec
  style P4 fill:#f3e5f5
  style P5 fill:#e8f5e9
  style P6 fill:#e8f5e9
```

| Phase | 예상시간 | 검토 체크포인트 |
|-------|---------|-----------|
| 0. 준비 | 15분 | 의존성 설치 확인 |
| 1. 백엔드 이식 | 1시간 | curl로 API 응답 검증 |
| 2. 어댑터/타입 | 1시간 | 단위 검증 (normalized→pixel 매핑) |
| 3. UI 통합 | 1.5~2시간 | end-to-end 동작 |
| 4. 운영 환경 | 30분 | docker compose up 동작 |
| 5. 검증 | 30분 | lint/build/type 통과 |
| 6. 마무리 | 15분 | docs 갱신, graphify update |

**총 예상**: ~5시간

---

## 5. Phase 0 — 준비

```mermaid
flowchart TD
  T01[브랜치 생성<br/>feat/ai-roof-detect] --> T02[의존성 추가]
  T02 --> T03[pnpm install]
  T03 --> T04[.env에 GEMINI_API_KEY 추가]
  T04 --> T05[.gitignore 확인]
```

| # | 태스크 | 명령/위치 | 검증 |
|---|------|---------|------|
| 0.1 | 브랜치 생성 | `git checkout -b feat/ai-roof-detect` | `git branch` |
| 0.2 | 의존성 추가 | `pnpm add @google/genai@^1.0.0 sharp@^0.34.5 zod@^4.3.6` (solar-precision 버전 매칭) | `package.json` 확인 |
| 0.2b | 빌드 승인 (package.json) | `pnpm.onlyBuiltDependencies: ["sharp", "unrs-resolver"]` 블록 추가 (solar-precision 패턴) | jq 또는 grep 확인 |
| 0.2c | 빌드 승인 (pnpm-workspace.yaml 신규) | `allowBuilds: { sharp: true, unrs-resolver: true }` 작성 (solar-precision 패턴) | 파일 존재 확인 |
| 0.3 | 설치 + 빌드스크립트 재실행 | `pnpm install` | sharp 네이티브 바이너리(libvips) 컴파일 완료, "Ignored build scripts" 경고 사라짐 |
| 0.4 | 키 등록 | 기존 `.env`에 `GEMINI_API_KEY=AIza...` 한 줄 추가 (`.env.local` 신규 생성 X — 환경 분리 안 함) | `grep GEMINI_API_KEY .env` |
| 0.5 | gitignore | `.gitignore` L37-38이 `.env*` 와일드카드로 이미 모든 env 파일 무시. 추가 작업 없음 | 확인만 |

**의사결정 없음.**

---

## 6. Phase 1 — 백엔드 이식 (거의 그대로 복사)

```mermaid
flowchart TD
  T11[src/lib/detect/ 폴더 생성] --> T12[schema.ts 복사]
  T12 --> T13[prompt.ts 복사]
  T13 --> T14[overlay.ts 복사]
  T14 --> T15[api/detect-roof/route.ts 복사]
  T15 --> T16[claude 관련 코드 제거]
  T16 --> T17[빌드 확인]
  T17 --> T18[curl로 API 호출 검증]
```

| # | 태스크 | 소스 → 타겟 | 변경 |
|---|------|---------|------|
| 1.1 | 폴더 생성 | — → `src/lib/detect/` | mkdir |
| 1.2 | 스키마 | `../solar-precision/src/lib/detect/schema.ts` → `src/lib/detect/schema.ts` | 그대로 복사 |
| 1.3 | 프롬프트 | `prompt.ts` → 동일 | 그대로 복사 |
| 1.4 | 오버레이 | `overlay.ts` → 동일 | 그대로 복사 |
| 1.5 | Gemini 라우트 | `src/app/api/detect-roof/route.ts` → 동일 경로 | 그대로 복사 |
| 1.6 | **Claude 제외** | `claude.ts`, `api/detect-roof-claude/` | **이식 안 함 (D1)** |
| 1.7 | `mapGeometry.ts` 처리 | — | **이식 안 함** (클라 전용 google.maps 의존, pv-system에선 불필요) |
| 1.8 | path alias 확인 | `tsconfig.json`의 `@/*` 매핑 일치 | tsc 통과 |
| 1.9 | 빌드 확인 | `pnpm build` | 컴파일 에러 0 |
| 1.10 | API 동작 검증 | curl로 작은 PNG dataUrl + 더미 bounds 호출 | 200 응답 + 폴리곤 배열 |

**체크포인트**: UI 변경 0. API만 살아있으면 통과.

---

## 7. Phase 2 — 좌표 어댑터 + 타입 (코어)

```mermaid
flowchart TD
  T21[types/index.ts 검토<br/>변경 없음 확정] --> T22[utils/aiDetect.ts 신규]
  T22 --> T23[normalizedToPixelPolygons 구현]
  T23 --> T24[detectRoofs fetch 래퍼 구현]
  T24 --> T25[Y축/좌표계 단위 검증<br/>수동 매핑 테스트]
```

| # | 태스크 | 위치 | 핵심 로직 |
|---|------|------|--------|
| 2.1 | 타입 변경 | `src/app/types/index.ts` | **변경 없음 (D4)**. PixelPolygon 그대로 |
| 2.2 | 어댑터 파일 신규 | `src/app/utils/aiDetect.ts` | mkfile |
| 2.3 | 좌표 변환 함수 | `normalizedToPixelPolygons(response, canvasW, canvasH)` | `x_px = x * W; y_px = y * H`. label/azimuth/tilt/confidence는 **버림** |
| 2.4 | fetch 래퍼 | `detectRoofs(cropData): Promise<PixelPolygon[]>` | POST `/api/detect-roof` → adapter |
| 2.5 | 좌표계 검증 | 정규화 [0.5, 0.5] → 캔버스 중앙 픽셀이 나오는지 수동 확인 | 콘솔 로그 |

### ⚠️ 리스크 R2 핵심 위치

`canvasW`/`canvasH`로 무엇을 쓸지가 가장 중요한 결정이다:
- **CropPopup이 화면에 표시하는 캔버스 크기** vs **원본 이미지의 naturalWidth/Height**
- AI는 서버에 보낸 이미지의 픽셀 좌표를 [0..1]로 정규화해서 응답함
- → 변환 시 **서버로 보낸 이미지의 W/H** 를 사용해야 함 (즉 cropData.imageDataUrl의 naturalSize)

**검증 방법**: 폴리곤이 캔버스에 그려지는 위치가 위성 이미지의 지붕 위에 정확히 떨어지는지 시각 확인.

---

## 8. Phase 3 — UI 통합 (자동 트리거)

```mermaid
flowchart TD
  T31[page.tsx에 상태 추가<br/>isDetecting, detectError] --> T32[handleCropComplete 확장]
  T32 --> T33[detectRoofs 자동 호출]
  T33 --> T34[setPixelAreas로 결과 주입]
  T34 --> T35[CropPopup 로딩 UI]
  T35 --> T36[에러 배너 UI]
  T36 --> T37[i18n 키 추가]
```

| # | 태스크 | 파일 | 변경 내용 |
|---|------|------|---------|
| 3.1 | 상태 추가 | `src/app/page.tsx` | `isDetecting`, `detectError` useState |
| 3.2 | 자동 트리거 | `handleCropComplete` 콜백 확장 | `setCropData` 직후 `detectRoofs` 호출 |
| 3.3 | 결과 주입 | 동일 | 응답 → `setPixelAreas({areas, metersPerPixel})` |
| 3.4 | 로딩 UI | `src/app/components/CropPopup.tsx` | `isDetecting`이면 반투명 오버레이 + 스피너 |
| 3.5 | 에러 UI | `page.tsx` 또는 `CropPopup` | `detectError`가 있으면 배너 표시 (D6: 표시만, 폴백 없음) |
| 3.6 | i18n | `src/app/utils/i18n.ts` | `aiDetecting`, `aiDetectFailed` 키 추가 (ja/en) |

### 자동 트리거 흐름

```mermaid
sequenceDiagram
  participant U as User
  participant MV as MapView
  participant P as page.tsx
  participant CP as CropPopup
  participant API as /api/detect-roof
  participant G as Gemini

  U->>MV: 영역 드래그
  MV->>P: handleCropComplete(cropData)
  P->>P: setCropData(...)
  P->>CP: render with isDetecting=true
  P->>API: detectRoofs(cropData)
  API->>G: 2-stage call
  G-->>API: polygons (normalized)
  API-->>P: response
  P->>P: setPixelAreas(adapter(response))
  P->>CP: render with polygons
  CP-->>U: 폴리곤 표출
```

**검증**: 실제 일본 주택 좌표 1~2곳에서 크롭 → 자동 감지 → 폴리곤 표출까지 모두 동작.

---

## 9. Phase 4 — 운영 환경

```mermaid
flowchart TD
  T41[docker-compose.yml 수정] --> T42[Dockerfile 검토<br/>변경 불필요 확인]
  T42 --> T43[로컬 dev 모드 동작 확인]
  T43 --> T44[docker compose up --build]
  T44 --> T45[컨테이너 내 환경변수 확인]
```

| # | 태스크 | 위치 | 변경 내용 |
|---|------|------|--------|
| 4.1 | compose 환경변수 | `docker-compose.yml` | `environment:` 섹션에 `GEMINI_API_KEY=${GEMINI_API_KEY}` 한 줄 추가 |
| 4.2 | Dockerfile | `Dockerfile` | **변경 없음** (런타임 env, 빌드 단계 무관) |
| 4.3 | dev 검증 | `pnpm dev` | API 호출 성공 |
| 4.4 | 프로덕션 빌드 | `docker compose up --build` | 컨테이너 정상 시작 |
| 4.5 | env 확인 | `docker exec <container> env \| grep GEMINI_API_KEY` | 키 노출 확인 (단, **공개 서버에선 SSH 접근자=키 접근자임을 인지**) |

---

## 10. Phase 5 — 검증

```mermaid
flowchart TD
  T51[pnpm lint] --> T52[pnpm build]
  T52 --> T53[타입체크]
  T53 --> T54[end-to-end 수동 테스트]
  T54 --> T55[기존 기능 사이드이펙트 점검]
```

| # | 태스크 | 명령 | 통과 기준 |
|---|------|------|--------|
| 5.1 | 린트 | `pnpm lint` | 오류 0. 경고는 가능한 모두 해결 |
| 5.2 | 빌드 | `pnpm build` | 성공 |
| 5.3 | 타입체크 | tsc | 오류 0 |
| 5.4 | end-to-end | 수동 | 일본 주택 1~2곳에서 감지 → 배치 → 저장 |
| 5.5 | 사이드이펙트 | 수동 | 기존 수동 그리기, 패널 배치, 시뮬레이션 입력 모두 정상 동작 |

### 사이드이펙트 체크리스트 (룰 #6)

- [ ] `handleCropComplete` 시그니처 변경 → 호출부 모두 일치
- [ ] `handleCropClose`가 detectError도 초기화하는지
- [ ] `pixelAreas` 상태가 기존 흐름과 충돌 없는지
- [ ] AI 호출 중 사용자가 CropPopup 닫으면 race condition 없는지

---

## 11. Phase 6 — 마무리

```mermaid
flowchart TD
  T61[README.md 갱신] --> T62[AGENTS.md 갱신]
  T62 --> T63[graphify update . 로컬 실행<br/>graphify-out/은 git 추적 X]
  T63 --> T64[형님께 작업 완료 보고]
  T64 --> T65[커밋은 형님이 직접 수행<br/>graphify-out/은 커밋 제외]
```

| # | 태스크 | 위치 | 변경 내용 |
|---|------|------|--------|
| 6.1 | README | `README.md` | AI 감지 기능, `GEMINI_API_KEY` 환경변수 가이드 추가 |
| 6.2 | AGENTS.md | `AGENTS.md` | `Environment Variables` 표에 `GEMINI_API_KEY` 추가. `Tech Stack` 또는 의존성 명시부에 `@google/genai`, `sharp`, `zod` 추가 |
| 6.2b | CLAUDE.md | `CLAUDE.md` | 현재 `@AGENTS.md` 한 줄만 가리킴 → **변경 불필요** |
| 6.3 | graphify | — | **`graphify update .` 로컬에서만 실행** (8a9886a 정책 — `graphify-out/`은 `.gitignore`에 포함됨). 커밋에 절대 포함하지 않음 |
| 6.4 | 커밋 | — | **형님이 직접 수행. AI는 절대 `git add` / `git commit` 실행 안 함.** AGENTS.md "의미있는 한 문장 단위 커밋" 룰은 형님이 적용. `graphify-out/`은 커밋 제외 |

---

## 12. 리스크 관리

| # | 리스크 | 발생 위치 | 대응 |
|---|------|---------|------|
| **R1** | Y축/좌표계 혼동 | Phase 2.5 | 단위 매핑 검증으로 확인 |
| **R2** | 캔버스 W/H vs 원본 이미지 W/H 매핑 오류 | Phase 2.3 | `cropData.imageDataUrl`의 naturalSize를 변환 기준으로 명시 사용. 시각 검증 |
| **R3** | 이미지 크기 한도 (5MB / 25M px) | Phase 1 (서버 라우트 내장) | 크롭 영역 최대 크기 제한 또는 사전 압축 |
| **R5** | Gemini 502/타임아웃 | Phase 3.5 | D6 = 에러 표시만. 폴백 없음 |
| **R8** | API 키 노출 | Phase 4.1 | `NEXT_PUBLIC_` 접두사 절대 금지. 서버 라우트 전용. `.env` git 제외 |
| **R6** | React Compiler stale closure | Phase 3.2 | useCallback 의존성 명시 |
| **R7** | `handleCropClose` 부수효과 | Phase 5.5 | isDetecting 중 닫기 시 race 처리 |
| **R10** | God Node 4개 동시 수정 | Phase 3 전체 | graphify-out/GRAPH_REPORT.md에 따르면 이식 작업이 4개 God Node(`Home`, `CropPopup`, `page.tsx`, `t`)를 동시에 건드림. `graphify path "<A>" "<B>"` 또는 `graphify explain "<concept>"`로 영향 노드 확인 후 진행. 사이드이펙트 점검 강화 (룰 #6) |

---

## 12.5 코드 검색 정책 (PreToolUse hook 반영)

`.codex/hooks.json`의 PreToolUse hook이 `grep`/`rg`/`find`/`fd`/`ack`/`ag` 명령 실행 시 graphify 가이드 메시지를 출력함. 본 plan 실행 중 코드 탐색은 다음 우선순위로:

| 우선순위 | 방법 | 사용 시점 |
|---------|------|---------|
| 1순위 | `graphify query "<question>"` / `graphify path "<A>" "<B>"` / `graphify explain "<concept>"` | 아키텍처/관계/cross-module 질문 |
| 2순위 | `graphify-out/GRAPH_REPORT.md` 직접 참조 | god nodes / community 구조 파악 |
| 3순위 | `grep` / `rg` | 그래프에 아직 반영 안 된 변경 코드, 정확한 문자열 매칭 필요 시 |

---

## 13. 별도 보안 트랙 (이식 범위 외, 참고용)

이식 작업과 분리하지만, 운영 직전 같이 검토할 항목:

| 항목 | 권고 |
|------|------|
| Next.js 패치 | `pnpm update next@latest` — 2026년 5월 보안 릴리즈 (13개 CVE) 반영 |
| `.env` 파일 권한 | 서버에서 `chmod 600 .env` |
| Gemini 키 제한 | Google AI Studio에서 IP 화이트리스트 + 사용량 한도 |
| Rate limiting | `/api/detect-roof`에 IP당 호출 제한 (비용 보호) |
| HTTPS | 공개 도메인이면 TLS reverse proxy 필수 |
| 로그 안전 | 에러 로그에 헤더/env 노출 금지 |

---

## 14. 의사결정이 끝났다는 것의 의미

D1~D7 모두 확정되었기 때문에 이 plan은 **추가 의사결정 없이 순차 실행 가능**하다.
실행 도중 새 의사결정이 발생하면 즉시 형님께 보고하고 답을 받은 뒤 진행한다.

---

## 15. 시작 신호

형님의 "ㄱㄱ" 명령 시 Phase 0부터 순차 실행.
각 Phase 종료 시점에 자동으로 검증 결과를 보고하고, **Phase 1 / Phase 3 종료 후에는 중간 검토를 위해 형님 확인을 기다린다**.

---

## 15.5 Phase 7 — 수동 트리거 + 분석 상태 머신 도입

### 배경
초기 D2 결정(크롭 직후 자동 트리거)이 솔라프리시젼 원본의 `PreviewModal.onConfirm`
수동 트리거 흐름과 달랐음. 정식 기획서(V1.0/2026-04-30)가 솔라프리시젼 원본 패턴을
정확히 명시 → 같은 PR에서 D2 정정 후 작업.

### 7.1 상태 머신

```
detectStatus:
  "idle"      ← CropPopup 진입 직후, 또는 취소/실패/성공 후 복귀
  "detecting" ← "AI 분석 시작" 클릭 직후 ~ 응답 도착 전

(구현은 2상태로 단순화. done/error/canceled는 모두 idle 복귀로 흡수 — 룰 #2 Simplicity)
```

### 7.2 변경 파일

| 파일 | 변경 |
|---|---|
| `src/app/page.tsx` | cropData 변경 시 자동 detect 호출 useEffect 제거 → `handleStartDetect` / `handleCancelDetect` 핸들러로. 분석 중 사이드바 버튼 비활성화 prop 전달 |
| `src/app/components/CropPopup.tsx` | 하단 영역에 버튼 2개 추가 (AI 분석 시작 / AI 분석 취소). 분석 상태에 따른 텍스트/활성화 토글. confirm 다이얼로그 |
| `src/app/utils/i18n.ts` | 기획 문구 ja/en 키 추가 |
| 사이드바 버튼들 | `disabled` prop으로 분석 중 비활성화 (PanelConfig, ResultsPanel, 슬로프 select, 시뮬레이션 입력 CTA). SimulationPanel은 simulation 탭 전용이라 비활성화 불필요 |

### 7.3 핵심 동작

1. 크롭 완료 → CropPopup 열림. **분석 자동 시작 X.** 영역 이미지만 표출
2. 하단 버튼 초기: "AI 분석 시작" 활성, "AI 분석 취소" 비활성
3. "AI 분석 시작" 클릭:
   - 이미 지붕면 있으면 confirm (D8)
   - 확인/없음 → 기존 폴리곤/패널 초기화 + 사이드바 버튼 비활성화 (D9)
   - `detectStatus = "detecting"`. 버튼 텍스트 "AI 분석 중", 취소 버튼 활성
4. 응답 도착 (성공):
   - 폴리곤 표출 + `detectStatus = "idle"` 복귀
   - 버튼 텍스트 "AI 분석 시작" 복원 + 활성
   - 사이드바 버튼 활성화 복원
5. "AI 분석 취소" 클릭:
   - `AbortController.abort()` (F-1 재활용)
   - `detectStatus = "idle"`. 버튼 상태 초기화
6. 실패: alert만 "AI 分析に失敗しました…" (D10/H-2: 배너 없음, 기획서 정합). 닫으면 idle 복귀

### 7.4 i18n 키 (ja / en)

| 키 | ja | en |
|---|---|---|
| `aiDetectStart` | AI 分析開始 | Start AI Analysis |
| `aiDetectInProgress` | AI 分析中 | AI Analyzing... |
| `aiDetectCancel` | AI 分析キャンセル | Cancel AI Analysis |
| `aiDetectConfirmReanalyze` | AI 分析を再実行しますか? 作成された屋根面情報がすべて初期化されます。 | Re-run AI analysis? All created roof faces will be reset. |
| `aiDetectFailedAlert` | AI 分析に失敗しました。しばらく後でもう一度お試しください。 | AI analysis failed. Please try again later. |

기존 `aiDetecting` (로딩 오버레이 텍스트), `aiDetectFailed` (배너 메시지) 두 키는 **이번 Phase 7 fix에서 제거** (F-1 로딩 텍스트 제거 + H-2 배너 제거로 호출처 0).

### 7.5 F-1 / 이전 작업과의 관계

- **F-1 AbortController**: 그대로 활용. 이제 "AI 분석 취소" 버튼이 abort 트리거
- **U1 spin 패턴**: 그대로 활용. `detectStatus === "detecting"`일 때 표시
- **handleCropClose의 cleanup**: 변경 없음. cropData null 시 모든 detect 상태도 자동 정리
- **자동 트리거 useEffect 제거**: 그 자리에 사용자 핸들러 도입

### 7.6 사이드이펙트 점검 (룰 #6)

- [x] page.tsx의 cropData 변경 시 자동 detect 트리거 제거 → handleStartDetect로 분리, useEffect는 reset만
- [x] 사이드바 비활성화 prop이 모든 관련 버튼에 전달됨 (PanelConfig/ResultsPanel/슬로프 select/시뮬레이션 CTA)
- [x] confirm/alert 모두 native 사용 (pv-system에 커스텀 모달 패턴 없음 — 별도 PR 후보)
- [x] 재분석 confirm 후 사용자 그리기 폴리곤도 모두 초기화 (handleDeleteAll 재사용, Mi-7)

---

## 16. 작업 후 추가 처리 (커밋 이후)

### 16.1 1차 코드 리뷰 (`superpowers:code-reviewer`) 반영
- **I-1**: `CropPopup`의 `lastSeedRef` 머지 계약 주석 명시 (같은 cropData 동안 reference 재설정 금지)
- **I-4**: `handleCropClose`의 AI state 중복 reset 제거 (detect useEffect가 cropData null 시 자동 정리)
- **I-5**: detect useEffect 의존성에서 `lang` 제거 — `langRef.current`로 latest read (사용자 토글 시 Gemini 재호출 방지)

### 16.2 2차 코드 리뷰 (`chicago-code-review` 멀티 에이전트) 반영
- **F-1**: detect 중 재크롭 race 처리
  - `detectRoofs(cropData, signal)` 시그니처에 `AbortSignal` 추가
  - useEffect cleanup에 `AbortController.abort()` + `areas/pixelAreas/placedPixelPanels/placedPanelsList` 초기화
  - `AbortError`는 의도된 취소이므로 에러 메시지 표시 안 함
- **U1**: AI 로딩 인디케이터를 기존 `AddressSearch`의 `spin` 패턴(`globals.css @keyframes spin`)으로 일관화

### 16.3 Phase 7-A 셀프 리뷰(1차 superpowers + 2차 chicago) 반영
- **F-1 (Phase 7)**: 로딩 오버레이 텍스트 제거 — 버튼 "AI 分析中"이 충분, 오버레이는 차단 목적만 (스피너만 유지)
- **H-1**: race 가드 — `setAiSeedAreas` 직전 `abortControllerRef.current === controller` 비교 추가 (시작→취소→시작 빠른 클릭 시 stale 응답 차단)
- **H-2**: 실패 시 alert만, 배너 제거 (기획서 D10 정합) — `detectError` state/setter 및 CropPopup 배너 div 모두 삭제
- **M-1**: `areasRef` 패턴(langRef와 동일) 도입, `handleStartDetect` deps에서 `areas.length` 제거
- **Mi-2**: `hasExistingAreas` prop 제거 (CropPopup 인터페이스 + page.tsx 전달 양쪽)
- **Mi-7/A-2**: D8 재분석 리셋을 `handleDeleteAll() + setAiSeedAreas([])` 재사용으로 DRY
- **i18n**: dead key가 된 `aiDetecting` / `aiDetectFailed` 제거

---

## 17. 별도 트랙으로 분리된 후속 작업

이번 PR 범위 외로 분리되어 운영/별도 PR로 처리될 항목들:

| 분류 | 항목 | 상태 |
|------|------|------|
| 기능/UX | F-2 에러 메시지 i18n 매핑 (서버는 에러 코드만 반환, 클라가 i18n으로 표시) | 기획 논의 대기 |
| 기능/UX | F-3 폴리곤 0개 응답(`reason: low_confidence`/`no_polygons`) 사용자 안내 | 기획 논의 대기 — Phase 7 도입으로 "AI 분석 시작" 버튼이 다시 활성화되어 재시도 경로 확보, 우선순위 ↓ |
| UX | U2 AI 폴리곤 vs 사용자 그리기 폴리곤 시각 구분 | **불필요** — 기획상 사용자가 AI 결과 그대로 편집 가능해야 하므로 구분하지 않음 |
| UX | U3 에러 배너 retry/dismiss 버튼 | 기획 논의 대기 |
| 🔒 보안 | V1 Rate limiting (IP/세션 기반) | 별도 PR (배포 전 필수) |
| 🔒 보안 | V2 Sharp 디코드 1회 통합 + decompression-bomb 방어 | 별도 PR |
| 🔒 보안 | V3 dataURL 정규식 base64 문자셋 강제 + MIME 매직바이트 재검증 | 별도 PR |
| 🏗️ 아키텍처 | A1 `route.ts` 도메인별 분할 (gemini-client / crop / pipeline) | 별도 PR |
| 🏗️ 아키텍처 | A3 `<CropPopup key={cropData.id}>` remount 패턴으로 ref 가드 제거 | 별도 PR |
| 🏗️ 아키텍처 | A4 `useRoofDetection` 훅 추출로 page.tsx God Component 완화 | 별도 PR |
| 🔄 운영 | D1 Gemini 토큰 사용량 외부 모니터링 (Sentry/Datadog) | 별도 PR |
| 🔄 운영 | D2 컨테이너 시작 시 키 누락 fail-fast | 별도 PR |
| 🔄 운영 | D3 동시성 상한 + 서버 측 AbortController + 타임아웃 | 별도 PR (클라 측 AbortController는 F-1으로 처리됨) |
| 📖 품질 | C2 결정 번호(D2/D4/I-1) 주석에 plan 경로 명시 | 선택 |
| 🌐 솔라프리시젼 정합성 | 솔라프리시젼 원본도 동일 보안 부재 — PL 공유 보고 검토 | 선택 |

---

## 18. 최종 머지 판단 근거

- ✅ **이식 작업 자체**: solar-precision의 백엔드(`route.ts`, `lib/detect/*`)를 그대로 복사. 솔라프리시젼 원본과 정합
- ✅ **Plan 의사결정 100% 준수**: D1~D7, D-1, W-B 모두 코드 흔적
- ✅ **검증**: tsc / lint / build / 실제 위성 이미지(메구로구) end-to-end 모두 통과
- ✅ **기능 결함**: 1차/2차 리뷰의 즉시 조치 항목(I-1/I-4/I-5/F-1/U1) 모두 반영
- ✅ **Phase 7 추가 도입**: 기획서 V1.0/2026-04-30의 수동 트리거 흐름을 같은 PR에 통합 (D2 정정 + D8/D9/D10 신규)
- ⏸️ **기획 대기 항목**:
  - F-2 에러 메시지 i18n 매핑 — 기획 논의 대기
  - U3 에러 배너 retry/dismiss — Phase 7 도입으로 "취소" 버튼이 retry 경로 일부 대체
- ⏸️ **보안/아키텍처/운영**: 별도 트랙. 솔라프리시젼 원본 정책과 동일하게 운영 시점 책임
