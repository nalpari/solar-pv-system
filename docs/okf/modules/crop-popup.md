---
type: Module
title: Crop Popup
description: 크롭 이미지 위의 Canvas 폴리곤 에디터. 지붕면 편집·모듈 렌더·합성 이미지 산출을 모두 담당하는 1293줄 컴포넌트.
resource: src/app/components/CropPopup.tsx
tags: [module, canvas, editor, ui]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
verified: { by: claude-code/opus-5, at: 2026-08-03T00:00:00Z }
status: stable
sources:
  - id: croppopup
    resource: src/app/components/CropPopup.tsx
    title: 구현
  - id: page
    resource: src/app/page.tsx
    title: 시그널·핸들 연결부
---

# 책임

크롭된 위성 이미지를 배경으로 깔고 그 위 캔버스에서:

- 지붕면(install) / 개구(exclude) 폴리곤 그리기·선택·이동·꼭짓점 편집
  (겹쳐 있던 꼭짓점은 기본적으로 첫 원소만 움직이고, Alt 를 누르면 `vertexDragGroupRef` 묶음 전체가 따라온다
  → [`domain/roof-face.md`](/domain/roof-face.md))
- 처마 기준변 지정(`flowSetting`)
- 인접 면 병합 호출 → [`merge-polygons`](merge-polygons.md)
- 배치된 모듈 렌더
- **배경 + 모듈 오버레이 합성 PNG 산출** (`getLayoutBlob`)

# 부모와의 프로토콜

폴리곤의 진실은 이 컴포넌트 내부 `AreaEntry[]` 에 있다. 부모는 두 방향으로만 개입한다.

**내려보내는 것 — 시그널(증가하는 숫자)**

| prop | 동작 |
|------|------|
| `undoSignal` | 그리는 중 마지막 점 삭제 |
| `clearSignal` | 내부 areas / currentPoints / 선택 전부 초기화 |
| `deleteSelectedSignal` | 선택된 면·개구 삭제 |
| `mergeSelectedSignal` | 선택된 인접 지붕면 병합 |

**올려보내는 것 — 콜백**

| prop | 용도 |
|------|------|
| `onAreasChange` / `onPixelAreasChange` | 두 좌표계 폴리곤 동기화 |
| `onSelectionChange` | 툴바 "선택 삭제" 활성 판정 |
| `onMergeableChange` | 툴바 "지붕결합" 활성 판정 — `mergeAreaPolygons` 결과가 `null` 인지로 계산 |
| `onUndoableChange` | 툴바 "뒤로" 활성 판정 |
| `onEaveChange(polygonId)` | 처마가 바뀐 면의 모듈만 삭제 요청 |

**유일한 imperative handle**: `getLayoutBlob(): Promise<Blob | null>` — 반환값이 필요해 시그널로 표현할 수 없다.

# 색 상수

`getComputedStyle` 호출을 피하려고 CSS 변수 값을 모듈 상수로 **복제**해 두었다.

| 상수 | 값 | 대응 |
|------|-----|------|
| `COLOR_EXCLUDE` / `COLOR_EXCLUDE_FILL` | `#CF2E2E` | `--accent-red` — 개구 |
| `COLOR_SELECTED` | `#FFD700` | (팔레트 밖 gold) — 선택 강조, lineWidth 4 |
| `COLOR_EAVE` | `#FF8A00` | 처마 기준변 강조, lineWidth 4 |
| `COLOR_INSTALL` / `COLOR_INSTALL_PANEL` | `#3366AA` | 구 `--accent-blue` — **폴백 전용** (아래) |

⚠️ `globals.css` 의 값이 바뀌면 여기도 손으로 맞춰야 한다. 자동 동기화가 없다.

## 설치면은 단색이 아니다

install 폴리곤은 `COLOR_INSTALL` 을 쓰지 않는다. 지붕면마다 `getRoofFaceColor` / `getRoofFaceFill`
(`src/app/utils/roofColors.ts` · `ROOF_FACE_COLORS` 30색)에서 색을 받는다.

draw effect 는 시작할 때 `areas` 를 한 번 훑어 `install id → 색 인덱스` **Map 을 파생 생성**하고(등장 순서 0,1,2,…)
그 Map 을 네 곳에 쓴다 — 완성된 면의 stroke/fill, 그리는 중인 폴리곤(= 다음에 배정될 색),
배치된 모듈(`panel.polygonId` 조회), 그리고 `roofEditTool === "editRoof"` 일 때의 꼭짓점·중점 핸들.
인덱스를 상태로 들고 있지 않으므로 `areas` 가 바뀌면 색이 따라 재배정된다.
배정 규칙·색 이동 트레이드오프·31개 초과 시 순환은 [`domain/roof-face.md`](/domain/roof-face.md) 참조.

`COLOR_INSTALL` / `COLOR_INSTALL_PANEL` 은 **모듈의 `polygonId` 가 살아있는 install 면과 매칭되지 않을 때의 방어적 폴백**으로만 남았다.
면 자체의 fill 로 쓰이던 `COLOR_INSTALL_FILL` 은 팔레트로 완전히 대체되어 삭제했다.

⚠️ 상태색이 팔레트를 이긴다 — 선택된 면은 gold, 처마 변은 orange 가 팔레트 색 위에 덮인다. 이 우선순위를 팔레트가 바꾸지 않는다.

**편집 핸들은 예외다.** 지붕 편집 모드(`editRoof`)의 꼭짓점·중점 핸들은 gold 가 아니라 **소속 면 색**으로 그린다(개구는 빨강).
꼭짓점은 면 색으로 채우고 흰 테두리로 배경에서 띄우며, 중점(`+`)은 흰 채움에 면 색 테두리·기호다.
면이 여러 개일 때 어느 면의 핸들을 잡고 있는지 색으로 읽히게 하려는 것이다.
합성 PNG(`getLayoutBlob`)는 이 오버레이 캔버스를 그대로 `drawImage` 하므로 팔레트가 자동 반영된다 — 별도 그리기 경로가 없다.

# 상태 게이트

- `editLocked`(= 부모의 `isPlacementDone`) — 배치 완료 시 캔버스 편집을 전면 차단.
  진입 시 미완성 그리기·점편집·선택 잔상을 정리한다.
- `detectStatus === "detecting"` — 로딩 오버레이 + 닫기(X) 버튼 가드.
- `initialAreas`(AI 결과, 정규화 [0..1]) — **새 reference 로 들어올 때 1회만** 내부 areas 에 머지한다.
  좌표 변환은 캔버스 크기를 아는 이 시점에 수행한다([`ai-roof-detection`](ai-roof-detection.md) 참조).

# 규모에 대한 메모

1293줄로 저장소 최대 파일이다. 그리기 상태 머신 · 히트테스트 · 렌더 · 합성이 한 파일에 있다.
분리한다면 경계는 "캔버스 렌더러"와 "포인터 상태 머신" 사이가 자연스럽다.
다만 `CropPopupHandle` 계약과 시그널 프로토콜은 부모가 의존하므로 유지해야 한다.
