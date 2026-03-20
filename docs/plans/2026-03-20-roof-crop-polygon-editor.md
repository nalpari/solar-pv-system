# 지붕 크롭 & 폴리곤 에디터 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 지도 위에서 사각형 영역을 크롭하고, 크롭된 이미지 위에서 Canvas 기반 폴리곤을 그리는 단계별 워크플로우를 구현한다.

**Architecture:** 기존 DrawingToolbar를 크롭 모드 토글로 변경하고, MapView에 크롭 오버레이를 추가한다. 크롭 완료 시 Canvas 캡처로 이미지를 얻어 CropPopup 컴포넌트에서 폴리곤 에디터를 제공한다. 폴리곤 좌표는 크롭 bounds 기반 비례 계산으로 픽셀 ↔ 위경도 변환한다.

**Tech Stack:** React 19, TypeScript, Canvas API, Pointer Events, Google Maps JavaScript API (`@vis.gl/react-google-maps`)

---

### Task 1: 타입 정의 추가

**Files:**
- Modify: `src/app/types/index.ts`

**Step 1: CropData 타입 추가**

```typescript
// src/app/types/index.ts 에 추가
export interface CropBounds {
  sw: LatLng;
  ne: LatLng;
}

export interface CropData {
  imageDataUrl: string;
  bounds: CropBounds;
  address: string;
  zoom: number;
  sizeMeters: { width: number; height: number };
}
```

기존 `DrawingMode` 타입은 유지한다 (CropPopup 안에서 재사용).

**Step 2: 커밋**

```bash
git add src/app/types/index.ts
git commit -m "feat: CropData, CropBounds 타입 정의 추가"
```

---

### Task 2: i18n 키 추가

**Files:**
- Modify: `src/app/utils/i18n.ts`

**Step 1: 크롭/폴리곤 에디터 관련 번역 키 추가**

`translations` 객체에 다음 키를 추가한다:

```typescript
// CropToolbar (DrawingToolbar 대체)
cropTools: { ja: "屋根選択", en: "Roof Selection" },
cropMode: { ja: "範囲選択", en: "Select Area" },
cropModeActive: { ja: "地図上でドラッグして範囲を選択", en: "Drag on map to select area" },

// CropPopup
cropEditor: { ja: "屋根エディタ", en: "Roof Editor" },
cropInstallArea: { ja: "設置エリア", en: "Installation Area" },
cropExcludeZone: { ja: "除外ゾーン", en: "Exclusion Zone" },
cropConfirm: { ja: "確定", en: "Confirm" },
cropCancel: { ja: "キャンセル", en: "Cancel" },
cropSelectMove: { ja: "選択 / 移動", en: "Select / Move" },
cropDrawPrompt: {
  ja: "範囲を選択すると屋根エディタが表示されます。",
  en: "Select an area on the map to open the roof editor.",
},
```

**Step 2: 커밋**

```bash
git add src/app/utils/i18n.ts
git commit -m "feat: 크롭/폴리곤 에디터 i18n 키 추가"
```

---

### Task 3: DrawingToolbar → CropToolbar 변환

**Files:**
- Modify: `src/app/components/DrawingToolbar.tsx`

**Step 1: 크롭 모드 토글 버튼으로 변경**

DrawingToolbar의 props와 내부를 변경한다:

```typescript
interface CropToolbarProps {
  cropMode: boolean;
  onCropModeChange: (active: boolean) => void;
  onClearAll: () => void;
  hasCropData: boolean;
  installCount: number;
  excludeCount: number;
  lang: Lang;
}
```

- 기존 Install/Exclude/Select 3개 버튼 → **크롭 모드 토글** 1개 버튼으로 교체
- Clear All 버튼 유지 (cropData 또는 areas가 있을 때 표시)
- lucide-react 아이콘: `Crop` (크롭 모드), `Trash2` (클리어)
- 크롭 모드 활성 시 안내 텍스트 표시 (`cropModeActive` i18n 키 사용)
- 파일명은 `DrawingToolbar.tsx` 유지 (import 변경 최소화)

**Step 2: 린트 확인**

```bash
pnpm lint
```

**Step 3: 커밋**

```bash
git add src/app/components/DrawingToolbar.tsx
git commit -m "refactor: DrawingToolbar를 크롭 모드 토글로 변환"
```

---

### Task 4: MapView에서 폴리곤 그리기 제거, 크롭 오버레이 추가

**Files:**
- Modify: `src/app/components/MapView.tsx`

**Step 1: DrawingOverlay, PanelOverlay 컴포넌트 제거**

기존 `DrawingOverlay` (Drawing Manager, 폴리곤 렌더링) 와 `PanelOverlay` 를 제거한다.

**Step 2: CropOverlay 서브컴포넌트 추가**

MapView 내부에 `CropOverlay` 컴포넌트를 추가한다:

```typescript
interface CropOverlayProps {
  active: boolean;
  onCropComplete: (rect: { x: number; y: number; width: number; height: number }) => void;
}
```

동작:
- `active`가 true일 때 지도 위에 투명 div 오버레이 (pointer-events를 가로챔)
- Pointer Events (`onPointerDown`, `onPointerMove`, `onPointerUp`) 사용 — 마우스/터치 통합
- 드래그 시 반투명 파란 사각형 표시 (CSS absolute positioning)
- 드래그 완료 시 `onCropComplete`에 사각형 좌표(px) 전달
- `touch-action: none` CSS로 브라우저 기본 터치 동작 방지

**Step 3: MapView props 변경**

```typescript
interface MapViewProps {
  center: { lat: number; lng: number };
  cropMode: boolean;
  onCropComplete: (cropData: CropData) => void;
  areas: PolygonArea[];        // 확인된 폴리곤 표시용 (편집 불가)
  placedPanels: PlacedPanel[];
  lang: Lang;
}
```

기존 `drawingMode`, `onAreaComplete`, `onAreasChange` props 제거.
`cropMode`, `onCropComplete` props 추가.

**Step 4: 크롭 영역 → CropData 변환 로직**

CropOverlay의 `onCropComplete` 콜백에서:
1. `map.getBounds()`로 현재 지도 전체 bounds 취득
2. 크롭 사각형의 px 좌표를 지도 컨테이너 크기에 대한 비율로 계산
3. 비율을 적용해 크롭 영역의 SW/NE 위경도 계산
4. `map.getZoom()`으로 줌 레벨 취득
5. 위경도 차이로 실제 크기(미터) 계산
6. **Canvas 캡처**: 지도 컨테이너의 DOM에서 내부 canvas/div를 찾아 `html2canvas` 또는 직접 Canvas API로 크롭 영역만 캡처 → data URL 생성
7. 캡처 실패 시 빈 Canvas에 회색 배경 + "캡처 실패" 텍스트 fallback

**Step 5: 린트 확인**

```bash
pnpm lint
```

**Step 6: 커밋**

```bash
git add src/app/components/MapView.tsx
git commit -m "refactor: MapView 폴리곤 그리기 제거, 크롭 오버레이 추가"
```

---

### Task 5: CropPopup 컴포넌트 — 기본 구조

**Files:**
- Create: `src/app/components/CropPopup.tsx`

**Step 1: 팝업 레이아웃 구현**

```typescript
interface CropPopupProps {
  cropData: CropData;
  onConfirm: (areas: PolygonArea[]) => void;
  onCancel: () => void;
  lang: Lang;
}
```

구조:
- 지도 영역 위 오버레이 (position: fixed, 좌측 사이드바 320px 제외)
- 반투명 배경 (backdrop)
- 중앙에 팝업 카드:
  - 상단: 타이틀 + 닫기 버튼
  - 중앙: 크롭 이미지 (비율 유지, 화면 80% 상한)
  - 하단: 도구 버튼 (설치/제외/선택) + 확인/취소 버튼
- 이미지는 `<img src={cropData.imageDataUrl}>` 위에 `<canvas>` 오버레이

**Step 2: 린트 확인**

```bash
pnpm lint
```

**Step 3: 커밋**

```bash
git add src/app/components/CropPopup.tsx
git commit -m "feat: CropPopup 컴포넌트 기본 구조 구현"
```

---

### Task 6: CropPopup — Canvas 폴리곤 에디터

**Files:**
- Modify: `src/app/components/CropPopup.tsx`

**Step 1: Canvas 기반 폴리곤 그리기 구현**

상태:
```typescript
const [drawingMode, setDrawingMode] = useState<DrawingMode>(null);
const [areas, setAreas] = useState<PolygonArea[]>([]);
const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
```

Canvas 위 Pointer Events:
- `onPointerDown`:
  - drawingMode가 활성이면 현재 클릭 위치를 `currentPoints`에 추가
  - 첫 점 근처 클릭 시 (10px 이내) 폴리곤 닫기 → `areas`에 추가
- 모든 이벤트에 `touch-action: none` + `e.preventDefault()` 적용

Canvas 렌더링 (`useEffect` + `requestAnimationFrame`):
- 완성된 폴리곤: 채우기 + 외곽선 (install=파랑, exclude=빨강)
- 진행 중인 폴리곤: 점선 + 꼭짓점 원
- 꼭짓점에 작은 원(6px) 표시

**Step 2: 픽셀 → 위경도 변환 유틸리티**

```typescript
function pixelToLatLng(
  x: number, y: number,
  canvasWidth: number, canvasHeight: number,
  bounds: CropBounds
): LatLng {
  const lngRange = bounds.ne.lng - bounds.sw.lng;
  const latRange = bounds.ne.lat - bounds.sw.lat;
  return {
    lng: bounds.sw.lng + (x / canvasWidth) * lngRange,
    lat: bounds.ne.lat - (y / canvasHeight) * latRange, // y축 반전
  };
}
```

**Step 3: 확인 버튼 핸들러**

확인 클릭 시:
1. Canvas 상의 폴리곤 픽셀 좌표를 위경도로 변환
2. `PolygonArea[]` 생성
3. `onConfirm(areas)` 호출

**Step 4: 린트 확인**

```bash
pnpm lint
```

**Step 5: 커밋**

```bash
git add src/app/components/CropPopup.tsx
git commit -m "feat: CropPopup Canvas 폴리곤 에디터 구현"
```

---

### Task 7: page.tsx 통합

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: 상태 추가 및 기존 상태 조정**

```typescript
const [cropMode, setCropMode] = useState(false);
const [cropData, setCropData] = useState<CropData | null>(null);
```

`drawingMode` 상태 제거 (더 이상 사용하지 않음).

**Step 2: 핸들러 추가**

```typescript
const handleCropComplete = useCallback((data: CropData) => {
  setCropData(data);
  setCropMode(false);
}, []);

const handleCropConfirm = useCallback((newAreas: PolygonArea[]) => {
  setAreas(newAreas);
  setCropData(null);
  setPlacedPanelsList([]);
}, []);

const handleCropCancel = useCallback(() => {
  setCropData(null);
}, []);
```

`handleClearAll` 수정: `setCropData(null)` 추가.

**Step 3: DrawingToolbar props 변경**

```tsx
<DrawingToolbar
  cropMode={cropMode}
  onCropModeChange={setCropMode}
  onClearAll={handleClearAll}
  hasCropData={cropData !== null}
  installCount={installAreas.length}
  excludeCount={excludeAreas.length}
  lang={lang}
/>
```

**Step 4: MapView props 변경**

```tsx
<MapView
  center={center}
  cropMode={cropMode}
  onCropComplete={handleCropComplete}
  areas={areas}
  placedPanels={placedPanelsList}
  lang={lang}
/>
```

**Step 5: CropPopup 조건부 렌더링**

```tsx
{cropData && (
  <CropPopup
    cropData={cropData}
    onConfirm={handleCropConfirm}
    onCancel={handleCropCancel}
    lang={lang}
  />
)}
```

`<main>` 태그 안, MapView 아래에 배치.

**Step 6: ResultsPanel의 drawPrompt 업데이트**

`drawPrompt` i18n 키를 `cropDrawPrompt`로 변경하여 새 워크플로우에 맞는 안내 문구 표시.

**Step 7: 린트 확인**

```bash
pnpm lint
```

**Step 8: 커밋**

```bash
git add src/app/page.tsx
git commit -m "feat: page.tsx 크롭 워크플로우 통합"
```

---

### Task 8: 빌드 검증 및 최종 정리

**Files:**
- Modify: `src/app/components/MapView.tsx` (필요 시)
- Modify: `src/app/page.tsx` (필요 시)

**Step 1: 타입 체크**

```bash
npx tsc --noEmit
```

사용하지 않는 import, 타입 불일치 등 수정.

**Step 2: 린트 체크**

```bash
pnpm lint
```

경고 포함 모두 해결.

**Step 3: 빌드 체크**

```bash
pnpm build
```

**Step 4: CLAUDE.md 업데이트**

Architecture 섹션의 Key components에 `CropPopup` 추가, `DrawingToolbar` 설명 변경.

**Step 5: 커밋**

```bash
git add -A
git commit -m "chore: 빌드 검증 및 문서 업데이트"
```
