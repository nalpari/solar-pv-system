# 폴리곤 UX 개선 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 크롭 팝업 내 폴리곤 에디터에 Undo, 폴리곤 선택/이동/삭제, 꼭짓점 편집 기능 추가 (PC + 터치 지원)

**Architecture:** CropPopup.tsx에 상태 머신 기반 서브모드(idle/selected/moving/editing_vertices) 추가. 캔버스 이벤트 핸들러를 서브모드별로 분기. 폴리곤 편집 로직은 CropPopup 내부에서 처리하되, 히트 테스트와 기하 유틸은 별도 헬퍼로 분리.

**Tech Stack:** React 19, Canvas 2D API, TypeScript strict mode, CSS custom properties

---

## Task 1: 타입 및 i18n 키 추가

**Files:**
- Modify: `src/app/types/index.ts`
- Modify: `src/app/utils/i18n.ts`

**Step 1: types/index.ts에 편집 상태 타입 추가**

```typescript
// types/index.ts 끝에 추가
export type PolygonSubMode = "idle" | "selected" | "moving" | "editing_vertices";
```

**Step 2: i18n.ts에 툴팁 및 Undo 키 추가**

```typescript
// i18n.ts translations 객체에 추가
// Polygon edit tooltip
polygonMove: { ja: "移動", en: "Move" },
polygonDelete: { ja: "削除", en: "Delete" },
polygonEditVertices: { ja: "頂点編集", en: "Edit Vertices" },
undoLastPoint: { ja: "元に戻す", en: "Undo" },
```

**Step 3: 린트/타입 체크**

Run: `pnpm lint && npx tsc --noEmit`
Expected: 오류 없음

**Step 4: 커밋**

```bash
git add src/app/types/index.ts src/app/utils/i18n.ts
git commit -m "feat: 폴리곤 편집 관련 타입 및 i18n 키 추가"
```

---

## Task 2: 그리기 중 Undo 기능

**Files:**
- Modify: `src/app/components/CropPopup.tsx`

**Step 1: 우클릭 Undo 핸들러 추가**

CropPopup 컴포넌트 내부, `handlePointerDown` 아래에 추가:

```typescript
function handleContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
  e.preventDefault();
  // 그리기 모드에서만 동작
  if (drawingMode !== "install" && drawingMode !== "exclude") return;
  if (currentPoints.length === 0) return;
  setCurrentPoints((prev) => prev.slice(0, -1));
  if (currentPoints.length <= 1) {
    setMousePos(null);
  }
}
```

**Step 2: 플로팅 Undo 버튼 추가**

캔버스 아래, popup card 내부에 플로팅 버튼 JSX 추가:

```tsx
{/* Floating Undo button — bottom-right of canvas, visible only while drawing */}
{(drawingMode === "install" || drawingMode === "exclude") && currentPoints.length > 0 && (
  <button
    onClick={() => {
      setCurrentPoints((prev) => prev.slice(0, -1));
      if (currentPoints.length <= 1) setMousePos(null);
    }}
    style={{
      position: "absolute",
      bottom: 16,
      right: 16,
      zIndex: 10,
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "6px 12px",
      border: "1px solid var(--border-primary)",
      background: "rgba(255, 255, 255, 0.9)",
      color: "var(--text-secondary)",
      borderRadius: "var(--radius-md)",
      cursor: "pointer",
      backdropFilter: "blur(8px)",
      fontSize: 13,
    }}
  >
    <Undo2 size={14} />
    {t("undoLastPoint", lang)}
  </button>
)}
```

**Step 3: canvas에 onContextMenu 바인딩**

```tsx
<canvas
  ref={canvasRef}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onContextMenu={handleContextMenu}
  // ... 기존 style
/>
```

**Step 4: lucide-react import에 Undo2 추가**

```typescript
import { X, Download, Undo2 } from "lucide-react";
```

**Step 5: 동작 확인**

1. 설치영역 모드에서 점 3개 찍기
2. 우클릭 → 마지막 점 사라지는지 확인
3. Undo 버튼 클릭 → 같은 동작 확인
4. 점 0개가 되면 Undo 버튼 숨겨지는지 확인

**Step 6: 린트/타입 체크 후 커밋**

Run: `pnpm lint && npx tsc --noEmit`

```bash
git add src/app/components/CropPopup.tsx
git commit -m "feat: 폴리곤 그리기 중 Undo 기능 추가 (플로팅 버튼 + 우클릭)"
```

---

## Task 3: 폴리곤 선택 및 툴팁 표시

**Files:**
- Modify: `src/app/components/CropPopup.tsx`

**Step 1: 선택 상태 관리용 state 추가**

CropPopup 컴포넌트 상단 state 선언부에 추가:

```typescript
import type { PolygonSubMode } from "../types";

const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
const [subMode, setSubMode] = useState<PolygonSubMode>("idle");
const [tooltipPos, setTooltipPos] = useState<PixelPoint | null>(null);
```

**Step 2: 폴리곤 히트 테스트 함수 추가**

CropPopup 파일 상단 (컴포넌트 밖)에 유틸 함수 추가:

```typescript
/** 점이 폴리곤 내부에 있는지 ray-casting 판정 */
function isPointInPolygon(pt: PixelPoint, polygon: PixelPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y))
      && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
```

**Step 3: 선택/이동 모드에서 handlePointerDown 분기 추가**

기존 `handlePointerDown` 함수를 확장. drawingMode === null (선택/이동 모드)일 때 분기:

```typescript
function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
  const pt = getCanvasCoords(e);

  // 선택/이동 모드
  if (drawingMode === null) {
    // 툴팁이 열려있고 빈 곳 클릭 → 선택 해제
    if (subMode === "selected") {
      setSelectedPolygonId(null);
      setSubMode("idle");
      setTooltipPos(null);
      return;
    }

    // idle 상태에서 폴리곤 클릭 검사 (뒤에서부터 — 최근 그린 게 위)
    if (subMode === "idle") {
      for (let i = areas.length - 1; i >= 0; i--) {
        if (areas[i].points.length >= 3 && isPointInPolygon(pt, areas[i].points)) {
          setSelectedPolygonId(areas[i].id);
          setSubMode("selected");
          setTooltipPos(pt);
          e.preventDefault();
          return;
        }
      }
    }
    return;
  }

  // 기존 그리기 모드 로직 (install/exclude)
  if (drawingMode !== "install" && drawingMode !== "exclude") return;
  e.preventDefault();
  // ... 기존 코드 유지
}
```

**Step 4: 모드 전환 시 선택 상태 초기화**

기존 drawingMode 변경 감지 블록 수정:

```typescript
if (prevDrawingMode !== drawingMode) {
  setPrevDrawingMode(drawingMode);
  if (currentPoints.length > 0) {
    setCurrentPoints([]);
    setMousePos(null);
  }
  // 선택 상태 초기화
  setSelectedPolygonId(null);
  setSubMode("idle");
  setTooltipPos(null);
}
```

**Step 5: 선택된 폴리곤 하이라이트 렌더링**

캔버스 렌더링 useEffect 내에서 "Draw completed polygons" 루프 수정:

```typescript
for (const area of areas) {
  if (area.points.length < 3) continue;
  const isInstall = area.type === "install";
  const isSelected = area.id === selectedPolygonId;
  ctx.beginPath();
  ctx.moveTo(area.points[0].x, area.points[0].y);
  for (let i = 1; i < area.points.length; i++) {
    ctx.lineTo(area.points[i].x, area.points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = isInstall
    ? "rgba(6, 147, 227, 0.2)"
    : "rgba(207, 46, 46, 0.3)";
  ctx.fill();
  ctx.strokeStyle = isSelected
    ? "#FFD700"
    : isInstall ? "#0693E3" : "#CF2E2E";
  ctx.lineWidth = isSelected ? 4 : 2;
  ctx.stroke();
}
```

useEffect 의존성 배열에 `selectedPolygonId` 추가.

**Step 6: 툴팁 JSX 추가**

canvas 요소 뒤, popup card 내부에 툴팁 추가:

```tsx
{/* Polygon action tooltip */}
{subMode === "selected" && tooltipPos && (
  <div
    style={{
      position: "absolute",
      left: (canvasLayout?.offsetX ?? 0) + tooltipPos.x + 8,
      top: (canvasLayout?.offsetY ?? 0) + tooltipPos.y - 8,
      zIndex: 20,
      display: "flex",
      flexDirection: "column",
      gap: 2,
      background: "rgba(255, 255, 255, 0.95)",
      border: "1px solid var(--border-primary)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-md)",
      padding: 4,
      backdropFilter: "blur(8px)",
    }}
  >
    {[
      { key: "polygonMove" as const, action: () => { setSubMode("moving"); setTooltipPos(null); } },
      { key: "polygonDelete" as const, action: () => handleDeletePolygon() },
      { key: "polygonEditVertices" as const, action: () => { setSubMode("editing_vertices"); setTooltipPos(null); } },
    ].map(({ key, action }) => (
      <button
        key={key}
        onClick={action}
        style={{
          display: "block",
          width: "100%",
          padding: "6px 12px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          fontSize: 13,
          color: key === "polygonDelete" ? "#CF2E2E" : "var(--text-primary)",
          borderRadius: "var(--radius-sm)",
        }}
        onMouseEnter={(ev) => { (ev.target as HTMLElement).style.background = "var(--bg-secondary)"; }}
        onMouseLeave={(ev) => { (ev.target as HTMLElement).style.background = "transparent"; }}
      >
        {t(key, lang)}
      </button>
    ))}
  </div>
)}
```

**Step 7: 삭제 핸들러 추가**

```typescript
function handleDeletePolygon() {
  if (!selectedPolygonId) return;
  const updated = areas.filter((a) => a.id !== selectedPolygonId);
  setAreas(updated);
  setSelectedPolygonId(null);
  setSubMode("idle");
  setTooltipPos(null);
  notifyParent(updated);
}
```

`notifyParent`는 기존 폴리곤 완성 시 부모에게 알리는 로직을 공통 함수로 추출:

```typescript
function notifyParent(updatedAreas: AreaEntry[]) {
  const canvas = canvasRef.current;
  if (canvas && canvas.width > 0) {
    onAreasChange(convertAreas(updatedAreas, canvas.width, canvas.height, cropData.bounds));
    const mpp = computeMetersPerPixel();
    if (mpp > 0) {
      onPixelAreasChange(convertToPixelPolygons(updatedAreas), mpp);
    }
  }
}
```

기존 `handlePointerDown` 내 폴리곤 완성 부분도 `notifyParent(updated)` 호출로 교체.

**Step 8: 커서 변경**

canvas style의 cursor 로직 수정:

```typescript
cursor:
  drawingMode === "install" || drawingMode === "exclude"
    ? "crosshair"
    : subMode === "moving"
      ? "grabbing"
      : "default",
```

**Step 9: 린트/타입 체크 후 커밋**

Run: `pnpm lint && npx tsc --noEmit`

```bash
git add src/app/components/CropPopup.tsx
git commit -m "feat: 폴리곤 선택, 하이라이트, 툴팁(이동/삭제/점편집) 구현"
```

---

## Task 4: 폴리곤 이동 (드래그)

**Files:**
- Modify: `src/app/components/CropPopup.tsx`

**Step 1: 드래그 시작점 ref 추가**

```typescript
const dragStartRef = useRef<PixelPoint | null>(null);
const dragOriginalPointsRef = useRef<PixelPoint[] | null>(null);
```

**Step 2: handlePointerDown에 이동 시작 로직 추가**

`drawingMode === null` 분기 내에서 `subMode === "moving"` 케이스 추가:

```typescript
if (subMode === "moving" && selectedPolygonId) {
  const selected = areas.find((a) => a.id === selectedPolygonId);
  if (selected && isPointInPolygon(pt, selected.points)) {
    dragStartRef.current = pt;
    dragOriginalPointsRef.current = selected.points.map((p) => ({ ...p }));
    e.preventDefault();
    return;
  }
  // 폴리곤 밖 클릭 → 이동 취소
  setSubMode("idle");
  setSelectedPolygonId(null);
  return;
}
```

**Step 3: handlePointerMove에 이동 중 로직 추가**

함수 상단에 이동 처리 추가:

```typescript
function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
  const rect = canvasRef.current!.getBoundingClientRect();
  const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

  // 폴리곤 이동 중
  if (subMode === "moving" && dragStartRef.current && dragOriginalPointsRef.current && selectedPolygonId) {
    const dx = pt.x - dragStartRef.current.x;
    const dy = pt.y - dragStartRef.current.y;
    setAreas((prev) =>
      prev.map((a) =>
        a.id === selectedPolygonId
          ? { ...a, points: dragOriginalPointsRef.current!.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
          : a,
      ),
    );
    return;
  }

  // 기존 그리기 모드 로직
  if (drawingMode !== "install" && drawingMode !== "exclude") return;
  if (currentPoints.length === 0) return;
  setMousePos(pt);
}
```

**Step 4: handlePointerUp 추가**

```typescript
function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
  // 이동 종료
  if (subMode === "moving" && dragStartRef.current) {
    dragStartRef.current = null;
    dragOriginalPointsRef.current = null;
    notifyParent(areas);
    setSubMode("idle");
    setSelectedPolygonId(null);
    return;
  }
}
```

**Step 5: canvas에 onPointerUp 바인딩**

```tsx
<canvas
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onContextMenu={handleContextMenu}
  // ...
/>
```

**Step 6: 린트/타입 체크 후 커밋**

Run: `pnpm lint && npx tsc --noEmit`

```bash
git add src/app/components/CropPopup.tsx
git commit -m "feat: 폴리곤 드래그 이동 구현"
```

---

## Task 5: 꼭짓점 편집 — 점 이동

**Files:**
- Modify: `src/app/components/CropPopup.tsx`

**Step 1: 핸들 히트 테스트 상수 및 상태 추가**

```typescript
const HANDLE_RADIUS = 12; // 터치 고려 큰 히트 영역
const HANDLE_VISUAL_RADIUS = 6; // 시각적 표시 크기

const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);
```

**Step 2: 꼭짓점 핸들 렌더링**

캔버스 렌더링 useEffect에 추가 (completed polygons 루프 뒤):

```typescript
// 점 편집 모드: 선택된 폴리곤의 꼭짓점 핸들 표시
if (subMode === "editing_vertices" && selectedPolygonId) {
  const selected = areas.find((a) => a.id === selectedPolygonId);
  if (selected) {
    for (let i = 0; i < selected.points.length; i++) {
      const pt = selected.points[i];
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, HANDLE_VISUAL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "#FFD700";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // edge 중간 + 핸들 (점 추가용)
    for (let i = 0; i < selected.points.length; i++) {
      const curr = selected.points[i];
      const next = selected.points[(i + 1) % selected.points.length];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      ctx.beginPath();
      ctx.arc(midX, midY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 215, 0, 0.5)";
      ctx.fill();
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 1;
      ctx.stroke();

      // + 표시
      ctx.beginPath();
      ctx.moveTo(midX - 3, midY);
      ctx.lineTo(midX + 3, midY);
      ctx.moveTo(midX, midY - 3);
      ctx.lineTo(midX, midY + 3);
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}
```

useEffect 의존성 배열에 `subMode` 추가.

**Step 3: handlePointerDown에 꼭짓점 편집 분기 추가**

`drawingMode === null` 분기에서 `subMode === "editing_vertices"` 케이스:

```typescript
if (subMode === "editing_vertices" && selectedPolygonId) {
  const selected = areas.find((a) => a.id === selectedPolygonId);
  if (!selected) return;

  // 꼭짓점 핸들 클릭 확인
  for (let i = 0; i < selected.points.length; i++) {
    const vp = selected.points[i];
    if (Math.hypot(pt.x - vp.x, pt.y - vp.y) <= HANDLE_RADIUS) {
      setDraggingVertexIdx(i);
      e.preventDefault();
      return;
    }
  }

  // edge 중간 핸들 클릭 확인 (점 추가)
  for (let i = 0; i < selected.points.length; i++) {
    const curr = selected.points[i];
    const next = selected.points[(i + 1) % selected.points.length];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    if (Math.hypot(pt.x - midX, pt.y - midY) <= HANDLE_RADIUS) {
      // i+1 위치에 새 점 삽입
      const newPoints = [...selected.points];
      newPoints.splice(i + 1, 0, { x: midX, y: midY });
      setAreas((prev) =>
        prev.map((a) => a.id === selectedPolygonId ? { ...a, points: newPoints } : a)
      );
      setDraggingVertexIdx(i + 1); // 바로 드래그 가능
      e.preventDefault();
      return;
    }
  }

  // 빈 곳 클릭 → 편집 종료
  setSubMode("idle");
  setSelectedPolygonId(null);
  setDraggingVertexIdx(null);
  return;
}
```

**Step 4: handlePointerMove에 꼭짓점 드래그 추가**

함수 상단 (폴리곤 이동 분기 뒤):

```typescript
// 꼭짓점 드래그
if (subMode === "editing_vertices" && draggingVertexIdx !== null && selectedPolygonId) {
  setAreas((prev) =>
    prev.map((a) => {
      if (a.id !== selectedPolygonId) return a;
      const newPoints = [...a.points];
      newPoints[draggingVertexIdx] = pt;
      return { ...a, points: newPoints };
    })
  );
  return;
}
```

**Step 5: handlePointerUp에 꼭짓점 드래그 종료 추가**

```typescript
// 꼭짓점 드래그 종료
if (subMode === "editing_vertices" && draggingVertexIdx !== null) {
  setDraggingVertexIdx(null);
  notifyParent(areas);
  return;
}
```

**Step 6: 린트/타입 체크 후 커밋**

Run: `pnpm lint && npx tsc --noEmit`

```bash
git add src/app/components/CropPopup.tsx
git commit -m "feat: 꼭짓점 편집 — 점 이동 및 점 추가 구현"
```

---

## Task 6: 꼭짓점 삭제 (더블클릭 + 롱프레스)

**Files:**
- Modify: `src/app/components/CropPopup.tsx`

**Step 1: 롱프레스 타이머 ref 추가**

```typescript
const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**Step 2: 더블클릭 핸들러 추가**

```typescript
function handleDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
  if (subMode !== "editing_vertices" || !selectedPolygonId) return;
  const rect = canvasRef.current!.getBoundingClientRect();
  const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  tryDeleteVertex(pt);
}
```

**Step 3: 롱프레스 핸들러**

`handlePointerDown`의 꼭짓점 히트 분기에서, 핸들을 터치했을 때 롱프레스 타이머 시작:

```typescript
// 꼭짓점 핸들 클릭 확인 (기존 코드 수정)
for (let i = 0; i < selected.points.length; i++) {
  const vp = selected.points[i];
  if (Math.hypot(pt.x - vp.x, pt.y - vp.y) <= HANDLE_RADIUS) {
    setDraggingVertexIdx(i);

    // 롱프레스 타이머 시작 (500ms)
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      tryDeleteVertex(pt);
      setDraggingVertexIdx(null);
      longPressTimerRef.current = null;
    }, 500);

    e.preventDefault();
    return;
  }
}
```

**Step 4: 드래그 시작 시 롱프레스 취소**

`handlePointerMove` 꼭짓점 드래그 분기에 추가:

```typescript
if (subMode === "editing_vertices" && draggingVertexIdx !== null && selectedPolygonId) {
  // 드래그 시작 → 롱프레스 취소
  if (longPressTimerRef.current) {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }
  // ... 기존 드래그 로직
}
```

**Step 5: pointerUp에서도 롱프레스 타이머 클리어**

```typescript
if (longPressTimerRef.current) {
  clearTimeout(longPressTimerRef.current);
  longPressTimerRef.current = null;
}
```

**Step 6: tryDeleteVertex 공통 함수**

```typescript
function tryDeleteVertex(pt: PixelPoint) {
  if (!selectedPolygonId) return;
  const selected = areas.find((a) => a.id === selectedPolygonId);
  if (!selected) return;

  for (let i = 0; i < selected.points.length; i++) {
    const vp = selected.points[i];
    if (Math.hypot(pt.x - vp.x, pt.y - vp.y) <= HANDLE_RADIUS) {
      if (selected.points.length <= 3) {
        // 점 3개 이하면 폴리곤 자체 삭제
        const updated = areas.filter((a) => a.id !== selectedPolygonId);
        setAreas(updated);
        setSelectedPolygonId(null);
        setSubMode("idle");
        notifyParent(updated);
      } else {
        const newPoints = selected.points.filter((_, idx) => idx !== i);
        const updated = areas.map((a) =>
          a.id === selectedPolygonId ? { ...a, points: newPoints } : a,
        );
        setAreas(updated);
        notifyParent(updated);
      }
      return;
    }
  }
}
```

**Step 7: canvas에 onDoubleClick 바인딩**

```tsx
<canvas
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onContextMenu={handleContextMenu}
  onDoubleClick={handleDoubleClick}
  // ...
/>
```

**Step 8: 린트/타입 체크 후 커밋**

Run: `pnpm lint && npx tsc --noEmit`

```bash
git add src/app/components/CropPopup.tsx
git commit -m "feat: 꼭짓점 삭제 구현 (더블클릭 + 롱프레스 500ms)"
```

---

## Task 7: 최종 검증 및 문서 업데이트

**Files:**
- Modify: `src/app/utils/i18n.ts` (누락 키 확인)
- Modify: `CLAUDE.md` (필요 시)

**Step 1: 빌드 확인**

Run: `pnpm build`
Expected: 빌드 성공

**Step 2: 입력 매핑 체크리스트 검증**

PC에서 확인:
- [ ] 점 찍기 (클릭)
- [ ] Undo (우클릭 / 플로팅 버튼)
- [ ] 폴리곤 선택 (클릭)
- [ ] 폴리곤 이동 (드래그)
- [ ] 점 이동 (핸들 드래그)
- [ ] 점 추가 (edge 중간 클릭)
- [ ] 점 삭제 (핸들 더블클릭)
- [ ] 선택 해제 (빈 곳 클릭)

터치에서 확인:
- [ ] 점 찍기 (탭)
- [ ] Undo (플로팅 버튼)
- [ ] 폴리곤 선택 (탭)
- [ ] 폴리곤 이동 (드래그)
- [ ] 점 이동 (핸들 드래그)
- [ ] 점 추가 (edge 중간 탭)
- [ ] 점 삭제 (핸들 롱프레스)
- [ ] 선택 해제 (빈 곳 탭)

추가 확인:
- [ ] 모드 전환 시 상태 초기화
- [ ] 점 3개 미만 삭제 시 폴리곤 자동 제거
- [ ] 패널 배치가 편집된 폴리곤에 정상 반영
- [ ] i18n 키 누락 없음
- [ ] 이미지 저장(PNG)에 편집 결과 반영

**Step 3: CLAUDE.md 업데이트 (필요 시)**

CropPopup 설명에 폴리곤 편집 기능 추가.

**Step 4: 커밋**

```bash
git add -A
git commit -m "docs: 폴리곤 편집 기능 관련 문서 업데이트"
```
