"use client";

import { useEffect, useRef, useState } from "react";
import { X, Download } from "lucide-react";
import type { CropData, CropBounds, DrawingMode, LatLng, PolygonArea, PixelPanel, PixelPolygon, PixelPoint, PolygonSubMode } from "../types";
import type { Lang } from "../utils/i18n";
import type { RoofTool } from "./RoofEditToolbar";
import type { NormalizedPolygon } from "../utils/aiDetect";
import { normalizedToPixelPolygons } from "../utils/aiDetect";
import { t } from "../utils/i18n";
import { isPointInPolygon } from "../utils/panelPlacement";

/** Canvas 렌더링 시 getComputedStyle 호출을 피하기 위해 CSS 변수 값을 상수로 정의 */
const COLOR_INSTALL = "#3366AA"; // --accent-blue
const COLOR_INSTALL_FILL = "rgba(51, 102, 170, 0.2)";
const COLOR_INSTALL_PANEL = "rgba(51, 102, 170, 0.5)";
const COLOR_EXCLUDE = "#CF2E2E"; // --accent-red
const COLOR_EXCLUDE_FILL = "rgba(207, 46, 46, 0.3)";
const COLOR_SELECTED = "#FFD700"; // 선택 강조용 gold (VI 팔레트 --accent-yellow와 별도)
const COLOR_EAVE = "#FF8A00"; // 처마(흐름방향) 기준변 하이라이트 color

interface CropPopupProps {
  cropData: CropData;
  drawingMode: DrawingMode;
  onAreasChange: (areas: PolygonArea[]) => void;
  onPixelAreasChange: (areas: PixelPolygon[], metersPerPixel: number) => void;
  placedPanels: PixelPanel[];
  onClose: () => void;
  lang: Lang;
  /** 지붕 편집 툴바 활성 도구 (현재는 flowSetting만 사용) */
  roofEditTool?: RoofTool;
  /** 특정 폴리곤의 처마 기준선이 변경되었을 때 해당 폴리곤 위 패널 삭제 요청 */
  onEaveChange?: (polygonId: string) => void;
  /** 외부(툴바 undo)로부터 undo 신호. 값이 바뀔 때마다 마지막 점 삭제 실행 */
  undoSignal?: number;
  /** 외부(툴바 deleteAll)로부터 전체 초기화 신호. 값이 바뀔 때마다 내부 areas/currentPoints/선택 상태 초기화 */
  clearSignal?: number;
  /** 외부 주입 폴리곤 (AI 자동 감지 결과, 정규화 [0..1] 좌표). 새 reference로 들어올 때 내부 areas에 1회 머지 */
  initialAreas?: NormalizedPolygon[];
  /** AI 감지 진행 중 (로딩 오버레이 표시) */
  isDetecting?: boolean;
  /** AI 감지 실패 메시지 (배너 표시) */
  detectError?: string | null;
}

interface AreaEntry {
  id: string;
  type: "install" | "exclude";
  points: PixelPoint[];
  /** 처마(흐름방향) 기준변 인덱스 - points[i] → points[i+1] */
  eaveEdgeIndex?: number;
}

/** 꼭짓점 스냅 임계값 (픽셀) - 폴리곤 닫기(첫 점 클릭) 기준과 동일 */
const SNAP_RADIUS = 10;

/**
 * 주어진 위치에서 SNAP_RADIUS 내 가장 가까운 install 폴리곤 꼭짓점 반환
 * @param excludeId 제외할 폴리곤 id (꼭짓점 편집 중 자기 자신 제외용)
 */
function findNearestSnapVertex(
  pt: PixelPoint,
  areas: AreaEntry[],
  excludeId?: string,
): PixelPoint | null {
  let best: PixelPoint | null = null;
  let bestDist = SNAP_RADIUS;
  for (const area of areas) {
    if (area.type !== "install") continue;
    if (area.id === excludeId) continue;
    for (const vertex of area.points) {
      const d = Math.hypot(pt.x - vertex.x, pt.y - vertex.y);
      if (d <= bestDist) {
        bestDist = d;
        best = vertex;
      }
    }
  }
  return best;
}

/** 가장 긴 변의 인덱스를 반환 (i → i+1 기준) */
function findLongestEdgeIndex(points: PixelPoint[]): number {
  let maxLen = 0;
  let idx = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    const len = Math.hypot(dx, dy);
    if (len > maxLen) {
      maxLen = len;
      idx = i;
    }
  }
  return idx;
}

/** 점 pt에서 선분 p1-p2까지의 거리 */
function distanceToSegment(pt: PixelPoint, p1: PixelPoint, p2: PixelPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(pt.x - p1.x, pt.y - p1.y);
  let t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;
  return Math.hypot(pt.x - projX, pt.y - projY);
}

/** 캔버스 픽셀 좌표를 위경도(LatLng)로 변환한다 */
function pixelToLatLng(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  bounds: CropBounds,
): LatLng {
  const lngRange = bounds.ne.lng - bounds.sw.lng;
  const latRange = bounds.ne.lat - bounds.sw.lat;
  return {
    lng: bounds.sw.lng + (x / canvasWidth) * lngRange,
    lat: bounds.ne.lat - (y / canvasHeight) * latRange,
  };
}

/** AreaEntry 배열을 위경도 기반 PolygonArea 배열로 변환한다 */
function convertAreas(
  entries: AreaEntry[],
  canvasWidth: number,
  canvasHeight: number,
  bounds: CropBounds,
): PolygonArea[] {
  return entries
    .filter((a) => a.points.length >= 3)
    .map((area) => ({
      id: area.id,
      type: area.type,
      paths: area.points.map((pt) =>
        pixelToLatLng(pt.x, pt.y, canvasWidth, canvasHeight, bounds),
      ),
      eaveEdgeIndex: area.eaveEdgeIndex,
    }));
}

/** AreaEntry 배열을 픽셀 기반 PixelPolygon 배열로 변환한다 */
function convertToPixelPolygons(entries: AreaEntry[]): PixelPolygon[] {
  return entries
    .filter((a) => a.points.length >= 3)
    .map((area) => ({
      id: area.id,
      type: area.type,
      points: area.points.map((pt) => ({ x: pt.x, y: pt.y })),
      eaveEdgeIndex: area.eaveEdgeIndex,
    }));
}

/** 폴리곤 선택 툴팁 내부의 호버 스타일 버튼 */
function TooltipButton({ label, color, onClick }: { label: string; color?: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        width: "100%",
        padding: "4px 8px",
        border: "none",
        background: hovered ? "var(--border-primary)" : "transparent",
        color: color ?? "var(--text-primary)",
        fontSize: 13,
        textAlign: "left",
        cursor: "pointer",
        borderRadius: 4,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

const HANDLE_RADIUS = 12;
const HANDLE_VISUAL_RADIUS = 6;


/** 크롭된 위성 이미지 위에서 폴리곤 편집·패널 배치를 수행하는 팝업 컴포넌트 */
export default function CropPopup({
  cropData,
  drawingMode,
  onAreasChange,
  onPixelAreasChange,
  placedPanels,
  onClose,
  lang,
  roofEditTool,
  onEaveChange,
  undoSignal,
  clearSignal,
  initialAreas,
  isDetecting,
  detectError,
}: CropPopupProps) {
  const [areas, setAreas] = useState<AreaEntry[]>([]);
  const [currentPoints, setCurrentPoints] = useState<PixelPoint[]>([]);
  const [mousePos, setMousePos] = useState<PixelPoint | null>(null);
  const [canvasLayout, setCanvasLayout] = useState<{
    w: number; h: number; offsetX: number; offsetY: number;
  } | null>(null);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [subMode, setSubMode] = useState<PolygonSubMode>("idle");
  const [tooltipPos, setTooltipPos] = useState<PixelPoint | null>(null);

  // Polygon drag-move refs
  const dragStartRef = useRef<PixelPoint | null>(null);
  const dragOriginalPointsRef = useRef<PixelPoint[] | null>(null);

  // Vertex editing
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);

  // Long-press timer for vertex deletion on touch
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce rapid clicks in drawing mode (prevents double-click adding 2 points)
  const lastPointTimeRef = useRef<number>(0);

  const areasRef = useRef<AreaEntry[]>(areas);
  areasRef.current = areas;

  // AI 감지 결과(initialAreas) 외부 주입 — 캔버스 준비 + 새 reference 조합일 때 1회 머지
  //
  // 계약(주의): page.tsx는 `cropData` 변경 시점에만 `setAiSeedAreas`를 새 reference로 호출해야 함.
  // 같은 cropData 동안 같은 내용의 새 배열로 재설정하면 lastSeedRef의 reference 비교가
  // 무력화되어 중복 머지가 발생함. (I-1)
  const lastSeedRef = useRef<NormalizedPolygon[] | null>(null);
  useEffect(() => {
    if (lastSeedRef.current === initialAreas) return;
    if (!initialAreas || initialAreas.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return; // 캔버스 아직 준비 안 됨

    lastSeedRef.current = initialAreas;

    // 정규화 [0..1] → 캔버스 픽셀 좌표
    const converted = normalizedToPixelPolygons(initialAreas, canvas.width, canvas.height);
    const seeded: AreaEntry[] = converted.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
    }));
    const updated = [...areasRef.current, ...seeded];
    setAreas(updated);
    notifyParent(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAreas, canvasLayout]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // 그리기 모드 또는 지붕편집 툴 변경 시 진행 중 점·선택·드래그·롱프레스 상태 전부 초기화
  const prevDrawingModeRef = useRef<DrawingMode>(drawingMode);
  const prevRoofEditToolRef = useRef<RoofTool | undefined>(roofEditTool);
  useEffect(() => {
    const drawingChanged = prevDrawingModeRef.current !== drawingMode;
    const toolChanged = prevRoofEditToolRef.current !== roofEditTool;
    if (drawingChanged || toolChanged) {
      prevDrawingModeRef.current = drawingMode;
      prevRoofEditToolRef.current = roofEditTool;
      setCurrentPoints([]);
      setMousePos(null);
      setSelectedPolygonId(null);
      setSubMode("idle");
      setTooltipPos(null);
      setDraggingVertexIdx(null);
      dragStartRef.current = null;
      dragOriginalPointsRef.current = null;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, [drawingMode, roofEditTool]);

  // Cleanup long-press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  /** object-fit: contain 적용 후 이미지의 실제 렌더링 영역을 계산한다 */
  function getRenderedImageRect() {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    const containerW = img.clientWidth;
    const containerH = img.clientHeight;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = containerW / containerH;

    let renderW: number, renderH: number, offsetX: number, offsetY: number;
    if (imgRatio > containerRatio) {
      renderW = containerW;
      renderH = containerW / imgRatio;
      offsetX = 0;
      offsetY = (containerH - renderH) / 2;
    } else {
      renderH = containerH;
      renderW = containerH * imgRatio;
      offsetX = (containerW - renderW) / 2;
      offsetY = 0;
    }
    return { renderW, renderH, offsetX, offsetY };
  }

  /** 캔버스 크기를 이미지 렌더링 영역에 맞춰 동기화한다 */
  function syncCanvasSize() {
    const canvas = canvasRef.current;
    const rect = getRenderedImageRect();
    if (!canvas || !rect) return;
    const w = Math.round(rect.renderW);
    const h = Math.round(rect.renderH);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    setCanvasLayout({
      w,
      h,
      offsetX: Math.round(rect.offsetX),
      offsetY: Math.round(rect.offsetY),
    });
  }

  // Sync canvas size on image load and resize
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const handleLoad = () => syncCanvasSize();
    img.addEventListener("load", handleLoad);

    const observer = new ResizeObserver(() => syncCanvasSize());
    observer.observe(img);

    // If image is already loaded, schedule sync outside the synchronous effect body
    if (img.complete) {
      const id = requestAnimationFrame(() => syncCanvasSize());
      return () => {
        cancelAnimationFrame(id);
        img.removeEventListener("load", handleLoad);
        observer.disconnect();
      };
    }

    return () => {
      img.removeEventListener("load", handleLoad);
      observer.disconnect();
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps -- syncCanvasSize reads refs, stable across renders

  /** 캔버스 크기와 실제 크기로부터 픽셀당 미터 비율을 계산한다 */
  function computeMetersPerPixel() {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return 0;
    const mppX = cropData.sizeMeters.width / canvas.width;
    const mppY = cropData.sizeMeters.height / canvas.height;
    return (mppX + mppY) / 2;
  }

  /** 변경된 영역 데이터를 부모 컴포넌트에 전달한다 */
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

  /** 선택된 폴리곤을 삭제한다 */
  function handleDeletePolygon() {
    if (!selectedPolygonId) return;
    const updated = areas.filter((a) => a.id !== selectedPolygonId);
    setAreas(updated);
    setSelectedPolygonId(null);
    setSubMode("idle");
    setTooltipPos(null);
    notifyParent(updated);
  }

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw completed polygons
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
        ? COLOR_INSTALL_FILL
        : COLOR_EXCLUDE_FILL;
      ctx.fill();
      ctx.strokeStyle = isSelected ? COLOR_SELECTED : (isInstall ? COLOR_INSTALL : COLOR_EXCLUDE);
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.stroke();

      // 처마(eave) 기준변 하이라이트 — install 폴리곤만
      if (isInstall && typeof area.eaveEdgeIndex === "number") {
        const i = area.eaveEdgeIndex;
        if (i >= 0 && i < area.points.length) {
          const p1 = area.points[i];
          const p2 = area.points[(i + 1) % area.points.length];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = COLOR_EAVE;
          ctx.lineWidth = 4;
          ctx.stroke();
        }
      }
    }

    // Draw vertex handles when editing_vertices
    if (subMode === "editing_vertices" && selectedPolygonId) {
      const selArea = areas.find((a) => a.id === selectedPolygonId);
      if (selArea && selArea.points.length >= 3) {
        // Draw edge midpoint handles with + sign
        for (let i = 0; i < selArea.points.length; i++) {
          const p1 = selArea.points[i];
          const p2 = selArea.points[(i + 1) % selArea.points.length];
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          ctx.beginPath();
          ctx.arc(mx, my, HANDLE_VISUAL_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.fill();
          ctx.strokeStyle = COLOR_SELECTED;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // + sign
          const s = 3;
          ctx.beginPath();
          ctx.moveTo(mx - s, my);
          ctx.lineTo(mx + s, my);
          ctx.moveTo(mx, my - s);
          ctx.lineTo(mx, my + s);
          ctx.strokeStyle = COLOR_SELECTED;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        // Draw vertex handles (gold)
        for (const pt of selArea.points) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, HANDLE_VISUAL_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = COLOR_SELECTED;
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // Draw in-progress polygon
    if (currentPoints.length > 0) {
      const isInstall = drawingMode === "install";
      const strokeColor = isInstall ? COLOR_INSTALL : COLOR_EXCLUDE;

      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (let i = 1; i < currentPoints.length; i++) {
        ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dashed line from last point to mouse
      if (mousePos) {
        const last = currentPoints[currentPoints.length - 1];
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Vertex circles
      for (let i = 0; i < currentPoints.length; i++) {
        const pt = currentPoints[i];
        const radius = i === 0 ? 6 : 4;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
        if (i === 0) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // Draw placed panels
    for (const panel of placedPanels) {
      ctx.beginPath();
      ctx.moveTo(panel.corners[0].x, panel.corners[0].y);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(panel.corners[i].x, panel.corners[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = COLOR_INSTALL_PANEL;
      ctx.strokeStyle = COLOR_INSTALL;
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    }
  }, [areas, currentPoints, mousePos, drawingMode, placedPanels, selectedPolygonId, subMode]);

  /** 포인터 이벤트에서 캔버스 로컬 좌표를 추출한다 */
  function getCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>): PixelPoint {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  /** 포인터 다운 이벤트를 처리한다 (좌클릭만 허용, 점 추가·폴리곤 선택·드래그 시작·pointer capture 설정) */
  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    // 좌클릭(주 버튼)만 허용
    if (e.button !== 0) return;
    const pt = getCanvasCoords(e);

    // Selection / move / vertex editing mode
    // 흐름설정(처마 기준선 변경) 모드: 가장 가까운 변을 찾아 eaveEdgeIndex 업데이트
    if (roofEditTool === "flowSetting") {
      const EDGE_HIT_THRESHOLD = 15;
      for (let ai = areas.length - 1; ai >= 0; ai--) {
        const area = areas[ai];
        if (area.type !== "install" || area.points.length < 3) continue;
        let bestDist = Infinity;
        let bestIdx = -1;
        for (let i = 0; i < area.points.length; i++) {
          const p1 = area.points[i];
          const p2 = area.points[(i + 1) % area.points.length];
          const d = distanceToSegment(pt, p1, p2);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0 && bestDist <= EDGE_HIT_THRESHOLD && area.eaveEdgeIndex !== bestIdx) {
          const updated = areas.map((a) =>
            a.id === area.id ? { ...a, eaveEdgeIndex: bestIdx } : a,
          );
          setAreas(updated);
          notifyParent(updated);
          onEaveChange?.(area.id);
          return;
        }
      }
      return;
    }

    if (drawingMode === null) {
      if (subMode === "idle") {
        // Check if click is inside any polygon (last to first for z-order)
        for (let i = areas.length - 1; i >= 0; i--) {
          if (areas[i].points.length >= 3 && isPointInPolygon(pt, areas[i].points)) {
            setSelectedPolygonId(areas[i].id);
            setSubMode("selected");
            setTooltipPos(pt);
            return;
          }
        }
      } else if (subMode === "selected") {
        // If clicking on the same polygon again, reposition tooltip
        if (selectedPolygonId) {
          const selArea = areas.find((a) => a.id === selectedPolygonId);
          if (selArea && selArea.points.length >= 3 && isPointInPolygon(pt, selArea.points)) {
            setTooltipPos(pt);
            return;
          }
        }
        // Clicking outside dismisses selection
        setSelectedPolygonId(null);
        setSubMode("idle");
        setTooltipPos(null);
      } else if (subMode === "moving") {
        // Start drag if inside selected polygon
        if (selectedPolygonId) {
          const selArea = areas.find((a) => a.id === selectedPolygonId);
          if (selArea && isPointInPolygon(pt, selArea.points)) {
            dragStartRef.current = pt;
            dragOriginalPointsRef.current = selArea.points.map((p) => ({ ...p }));
            e.currentTarget.setPointerCapture(e.pointerId);
          } else {
            // Click outside: cancel moving
            dragStartRef.current = null;
            dragOriginalPointsRef.current = null;
            setSelectedPolygonId(null);
            setSubMode("idle");
          }
        }
      } else if (subMode === "editing_vertices") {
        // Check vertex hit, then midpoint hit, then empty space
        if (selectedPolygonId) {
          const selArea = areas.find((a) => a.id === selectedPolygonId);
          if (selArea) {
            // Check vertex handles
            for (let i = 0; i < selArea.points.length; i++) {
              const vp = selArea.points[i];
              if (Math.hypot(pt.x - vp.x, pt.y - vp.y) <= HANDLE_RADIUS) {
                setDraggingVertexIdx(i);
                e.currentTarget.setPointerCapture(e.pointerId);
                // 터치 입력에서만 롱프레스 삭제 활성화 (마우스/펜은 더블클릭 사용)
                if (e.pointerType === "touch") {
                  longPressTimerRef.current = setTimeout(() => {
                    longPressTimerRef.current = null;
                    tryDeleteVertex(i);
                    setDraggingVertexIdx(null);
                  }, 500);
                }
                return;
              }
            }
            // Check edge midpoint handles
            for (let i = 0; i < selArea.points.length; i++) {
              const p1 = selArea.points[i];
              const p2 = selArea.points[(i + 1) % selArea.points.length];
              const mx = (p1.x + p2.x) / 2;
              const my = (p1.y + p2.y) / 2;
              if (Math.hypot(pt.x - mx, pt.y - my) <= HANDLE_RADIUS) {
                // Insert new point at midpoint, start dragging it
                const insertIdx = i + 1;
                const newPoints = [...selArea.points];
                newPoints.splice(insertIdx, 0, { x: mx, y: my });
                const updated = areas.map((a) =>
                  a.id === selectedPolygonId
                    ? {
                        ...a,
                        points: newPoints,
                        // 꼭짓점 편집 시 기준선을 가장 긴 변으로 자동 리셋 (install만)
                        eaveEdgeIndex: a.type === "install" ? findLongestEdgeIndex(newPoints) : undefined,
                      }
                    : a,
                );
                setAreas(updated);
                setDraggingVertexIdx(insertIdx);
                e.currentTarget.setPointerCapture(e.pointerId);
                onEaveChange?.(selectedPolygonId);
                return;
              }
            }
            // Empty space: exit editing
            setSelectedPolygonId(null);
            setSubMode("idle");
          }
        }
      }
      return;
    }

    // Drawing mode
    if (drawingMode !== "install" && drawingMode !== "exclude") return;

    // Prevent double-click from adding two points (300ms debounce)
    const now = performance.now();
    if (now - lastPointTimeRef.current < 300) return;
    lastPointTimeRef.current = now;

    // 스냅 처리: 그리는 중인 폴리곤의 첫 점 또는 기존 install 폴리곤의 꼭짓점에 흡착
    // 첫 점 스냅 시 폴리곤 닫기 실행, 기존 폴리곤 꼭짓점 스냅 시 해당 좌표로 점 추가
    let snappedPt = pt;
    let snappedToFirst = false;
    if (currentPoints.length >= 3) {
      const first = currentPoints[0];
      if (Math.hypot(pt.x - first.x, pt.y - first.y) <= SNAP_RADIUS) {
        snappedPt = first;
        snappedToFirst = true;
      }
    }
    if (!snappedToFirst) {
      const nearest = findNearestSnapVertex(pt, areas);
      if (nearest) snappedPt = nearest;
    }

    // 첫 점으로 스냅된 경우 폴리곤 닫기
    if (snappedToFirst) {
      const closedPoints = [...currentPoints];
      const newArea: AreaEntry = {
        id: crypto.randomUUID(),
        type: drawingMode,
        points: closedPoints,
        // install 타입만 eaveEdgeIndex 기본값(가장 긴 변) 설정
        eaveEdgeIndex: drawingMode === "install" ? findLongestEdgeIndex(closedPoints) : undefined,
      };
      const updated = [...areas, newArea];
      setAreas(updated);
      setCurrentPoints([]);
      setMousePos(null);
      notifyParent(updated);
      return;
    }

    setCurrentPoints((prev) => [...prev, snappedPt]);
  }

  /** 마지막으로 추가한 폴리곤 점을 되돌린다 */
  function undoLastPoint() {
    if (currentPoints.length >= 1) {
      setCurrentPoints((prev) => {
        const next = prev.slice(0, -1);
        if (next.length === 0) setMousePos(null);
        return next;
      });
    }
  }

  // 외부(툴바) undo 신호 수신 — 값이 바뀌면 undoLastPoint 실행
  const prevUndoSignalRef = useRef<number | undefined>(undoSignal);
  useEffect(() => {
    if (undoSignal === undefined) return;
    if (prevUndoSignalRef.current !== undoSignal) {
      prevUndoSignalRef.current = undoSignal;
      undoLastPoint();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- undoLastPoint는 currentPoints closure를 참조하므로 signal만 의존
  }, [undoSignal]);

  // 외부(툴바 deleteAll) 전체 초기화 신호 수신 — 내부 polygon 상태도 함께 비움
  const prevClearSignalRef = useRef<number | undefined>(clearSignal);
  useEffect(() => {
    if (clearSignal === undefined) return;
    if (prevClearSignalRef.current !== clearSignal) {
      prevClearSignalRef.current = clearSignal;
      setAreas([]);
      setCurrentPoints([]);
      setMousePos(null);
      setSelectedPolygonId(null);
      setSubMode("idle");
      setTooltipPos(null);
      setDraggingVertexIdx(null);
      dragStartRef.current = null;
      dragOriginalPointsRef.current = null;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, [clearSignal]);

  /** 캔버스에서 브라우저 기본 컨텍스트 메뉴를 차단한다 */
  function handleContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
  }

  /** 포인터 이동 시 폴리곤 드래그(캔버스 경계 클램핑)·꼭짓점 드래그·가이드 라인을 처리한다 */
  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Polygon drag-move (캔버스 경계 내로 클램핑)
    if (drawingMode === null && subMode === "moving" && dragStartRef.current && dragOriginalPointsRef.current && selectedPolygonId) {
      const canvas = canvasRef.current;
      const cw = canvas ? canvas.width : Infinity;
      const ch = canvas ? canvas.height : Infinity;
      const orig = dragOriginalPointsRef.current;
      let dx = px - dragStartRef.current.x;
      let dy = py - dragStartRef.current.y;
      // 폴리곤 전체가 캔버스 안에 머물도록 dx/dy 클램핑
      const minX = Math.min(...orig.map((p) => p.x));
      const maxX = Math.max(...orig.map((p) => p.x));
      const minY = Math.min(...orig.map((p) => p.y));
      const maxY = Math.max(...orig.map((p) => p.y));
      dx = Math.max(-minX, Math.min(cw - maxX, dx));
      dy = Math.max(-minY, Math.min(ch - maxY, dy));
      const newPoints = orig.map((p) => ({
        x: p.x + dx,
        y: p.y + dy,
      }));
      setAreas((prev) =>
        prev.map((a) =>
          a.id === selectedPolygonId ? { ...a, points: newPoints } : a,
        ),
      );
      return;
    }

    // Vertex dragging
    if (drawingMode === null && subMode === "editing_vertices" && draggingVertexIdx !== null && selectedPolygonId) {
      // Cancel long-press if dragging
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // 스냅: 다른 install 폴리곤의 꼭짓점에 흡착 (자기 폴리곤은 제외)
      const snapped = findNearestSnapVertex({ x: px, y: py }, areasRef.current, selectedPolygonId) ?? { x: px, y: py };
      setAreas((prev) =>
        prev.map((a) => {
          if (a.id !== selectedPolygonId) return a;
          const newPoints = [...a.points];
          newPoints[draggingVertexIdx] = snapped;
          return { ...a, points: newPoints };
        }),
      );
      return;
    }

    // Drawing mode: dashed guide line
    if (drawingMode !== "install" && drawingMode !== "exclude") return;
    if (currentPoints.length === 0) return;
    setMousePos({ x: px, y: py });
  }

  /** 포인터 업 시 드래그 이동·꼭짓점 편집을 종료한다 */
  function handlePointerUp() {
    // Always clear long-press timer on pointer up
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // End polygon drag-move
    if (subMode === "moving" && dragStartRef.current) {
      dragStartRef.current = null;
      dragOriginalPointsRef.current = null;
      notifyParent(areasRef.current);
      setSelectedPolygonId(null);
      setSubMode("idle");
      return;
    }
    // End vertex drag
    if (subMode === "editing_vertices" && draggingVertexIdx !== null) {
      finalizeVertexDrag();
      return;
    }
  }

  /**
   * 꼭짓점 드래그 종료 시 상태 정리 + 처마 기준선 가장 긴 변으로 리셋.
   * handlePointerUp(정상 종료)과 handlePointerCancel(강제 취소) 양쪽에서 호출된다.
   */
  function finalizeVertexDrag() {
    setDraggingVertexIdx(null);
    const movedId = selectedPolygonId;
    const resetAreas = areasRef.current.map((a) =>
      a.id === movedId && a.type === "install"
        ? { ...a, eaveEdgeIndex: findLongestEdgeIndex(a.points) }
        : a,
    );
    setAreas(resetAreas);
    notifyParent(resetAreas);
    if (movedId) onEaveChange?.(movedId);
  }

  /** 포인터 캡처가 강제 해제될 때 드래그 상태를 정리한다 */
  function handlePointerCancel() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    dragStartRef.current = null;
    dragOriginalPointsRef.current = null;
    if (draggingVertexIdx !== null) {
      finalizeVertexDrag();
    }
  }

  /** 꼭짓점을 삭제하며, 3개 이하이면 폴리곤 전체를 제거한다 (areasRef로 최신 상태 참조) */
  function tryDeleteVertex(vertexIdx: number) {
    if (!selectedPolygonId) return;
    const currentAreas = areasRef.current;
    const selArea = currentAreas.find((a) => a.id === selectedPolygonId);
    if (!selArea) return;
    let updated: AreaEntry[];
    if (selArea.points.length <= 3) {
      // Delete entire polygon
      updated = currentAreas.filter((a) => a.id !== selectedPolygonId);
      setSelectedPolygonId(null);
      setSubMode("idle");
    } else {
      const newPoints = selArea.points.filter((_, i) => i !== vertexIdx);
      updated = currentAreas.map((a) =>
        a.id === selectedPolygonId
          ? {
              ...a,
              points: newPoints,
              // 꼭짓점 편집 시 기준선을 가장 긴 변으로 자동 리셋 (install만)
              eaveEdgeIndex: a.type === "install" ? findLongestEdgeIndex(newPoints) : undefined,
            }
          : a,
      );
      onEaveChange?.(selectedPolygonId);
    }
    setAreas(updated);
    notifyParent(updated);
  }

  /** 더블클릭으로 꼭짓점을 삭제한다 */
  function handleDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (subMode !== "editing_vertices" || !selectedPolygonId) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const selArea = areas.find((a) => a.id === selectedPolygonId);
    if (!selArea) return;
    for (let i = 0; i < selArea.points.length; i++) {
      const vp = selArea.points[i];
      if (Math.hypot(px - vp.x, py - vp.y) <= HANDLE_RADIUS) {
        tryDeleteVertex(i);
        return;
      }
    }
  }

  /** 캔버스 + 이미지를 합성하여 PNG로 다운로드한다 */
  function handleSave() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const saveCanvas = document.createElement("canvas");
    saveCanvas.width = canvas.width;
    saveCanvas.height = canvas.height;
    const ctx = saveCanvas.getContext("2d");
    if (!ctx) return;

    // Draw the image first
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Draw the overlay canvas on top
    ctx.drawImage(canvas, 0, 0);

    // Trigger download with timestamp
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const link = document.createElement("a");
    link.download = `solar-pv-layout_${ts}.png`;
    link.href = saveCanvas.toDataURL("image/png");
    link.click();
  }

  return (
    /* Popup card — 90% of map area. 외부 wrapper(page.tsx)가 zIndex/배치 담당 */
    <div
      style={{
        width: "90%",
        height: "90%",
        position: "relative",
        background: "var(--bg-primary)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        pointerEvents: "auto",
      }}
    >
        {/* AI 감지 로딩 오버레이 (D2: 크롭 직후 자동 트리거)
            기존 AddressSearch의 spin 패턴(globals.css @keyframes spin)을 재사용해 일관화 (U1) */}
        {isDetecting && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
          >
            <div
              style={{
                background: "var(--bg-surface)",
                padding: "16px 24px",
                borderRadius: "var(--radius-md)",
                fontSize: 14,
                color: "var(--text-primary)",
                boxShadow: "var(--shadow-md)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid var(--text-tertiary)",
                  borderTopColor: "var(--accent-blue)",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  display: "inline-block",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              {t("aiDetecting", lang)}
            </div>
          </div>
        )}

        {/* AI 감지 에러 배너 (D6: 표시만, 폴백 없음) */}
        {detectError && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#ef4444",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              fontSize: 13,
              fontWeight: 500,
              zIndex: 60,
              maxWidth: "80%",
              textAlign: "center",
            }}
          >
            ⚠️ {detectError}
          </div>
        )}

        {/* Top-right buttons: Save + Close */}
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            display: "flex",
            gap: 8,
          }}
        >
          <button
            onClick={handleSave}
            title={t("cropSave", lang)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: "1px solid var(--border-primary)",
              background: "rgba(255, 255, 255, 0.9)",
              color: "var(--text-secondary)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            <Download size={16} />
          </button>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: "1px solid var(--border-primary)",
              background: "rgba(255, 255, 255, 0.9)",
              color: "var(--text-secondary)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Image + Canvas container — fills the popup, image scales to fit */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL from canvas capture */}
          <img
            ref={imgRef}
            src={cropData.imageDataUrl}
            alt=""
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              touchAction: "none",
              cursor:
                drawingMode === "install" || drawingMode === "exclude"
                  ? "crosshair"
                  : subMode === "moving"
                    ? "grabbing"
                    : subMode === "editing_vertices"
                      ? "pointer"
                      : "default",
              ...(canvasLayout
                ? {
                    left: canvasLayout.offsetX,
                    top: canvasLayout.offsetY,
                    width: canvasLayout.w,
                    height: canvasLayout.h,
                  }
                : {
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                  }),
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
          />

        </div>

        {/* Polygon selection tooltip (경계 클램핑 적용) */}
        {subMode === "selected" && tooltipPos && (() => {
          const tooltipW = 88;
          const tooltipH = 90;
          const ox = canvasLayout?.offsetX ?? 0;
          const oy = canvasLayout?.offsetY ?? 0;
          const cw = canvasRef.current?.width ?? 300;
          const ch = canvasRef.current?.height ?? 300;
          const rawX = ox + tooltipPos.x + 8;
          const rawY = oy + tooltipPos.y - 8;
          const clampedX = Math.max(ox, Math.min(rawX, ox + cw - tooltipW));
          const clampedY = Math.max(oy, Math.min(rawY, oy + ch - tooltipH));
          return (
          <div
            style={{
              position: "absolute",
              left: clampedX,
              top: clampedY,
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              background: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
              padding: 4,
              minWidth: 80,
            }}
          >
            <TooltipButton label={t("polygonMove", lang)} onClick={() => { setSubMode("moving"); setTooltipPos(null); }} />
            <TooltipButton label={t("polygonDelete", lang)} color="var(--accent-red)" onClick={handleDeletePolygon} />
            <TooltipButton label={t("polygonEditVertices", lang)} onClick={() => { setSubMode("editing_vertices"); setTooltipPos(null); }} />
          </div>
          );
        })()}

    </div>
  );
}
