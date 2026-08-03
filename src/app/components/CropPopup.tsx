"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CropData, CropBounds, DrawingMode, LatLng, PolygonArea, PixelPanel, PixelPolygon, PixelPoint } from "../types";
import type { Lang } from "../utils/i18n";
import type { RoofTool } from "./RoofEditToolbar";
import type { NormalizedPolygon } from "../utils/aiDetect";
import { normalizedToPixelPolygons } from "../utils/aiDetect";
import { t } from "../utils/i18n";
import { isPointInPolygon } from "../utils/panelPlacement";
import { mergeAreaPolygons } from "../utils/mergePolygons";
import { getRoofFaceColor, getRoofFaceFill } from "../utils/roofColors";

/** Canvas 렌더링 시 getComputedStyle 호출을 피하기 위해 CSS 변수 값을 상수로 정의 */
// install 폴리곤은 더 이상 단색이 아니다 — 지붕면마다 ROOF_FACE_COLORS 팔레트 색을 쓴다.
// 아래 두 상수는 소속 지붕면을 찾지 못한 모듈의 폴백 색으로만 남는다 (구 --accent-blue).
// (면 자체의 fill 로 쓰던 COLOR_INSTALL_FILL 은 팔레트로 완전히 대체되어 삭제했다.)
const COLOR_INSTALL = "#3366AA"; // --accent-blue
const COLOR_INSTALL_PANEL = "rgba(51, 102, 170, 0.5)";
const COLOR_EXCLUDE = "#CF2E2E"; // --accent-red
const COLOR_EXCLUDE_FILL = "rgba(207, 46, 46, 0.3)";
const COLOR_SELECTED = "#FFD700"; // 선택 강조용 gold (VI 팔레트 --accent-yellow와 별도)
const COLOR_EAVE = "#FF8A00"; // 처마(흐름방향) 기준변 하이라이트 color

export interface CropPopupHandle {
  /** 배경 이미지 + 패널 오버레이 캔버스를 합성한 PNG Blob 반환 (없으면 null) */
  getLayoutBlob: () => Promise<Blob | null>;
}

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
  /** 편집 잠금 — 모듈 배치 완료 상태에서 캔버스 편집(클릭/드래그/꼭짓점) 전체 차단 */
  editLocked?: boolean;
  /** 특정 폴리곤의 처마 기준선이 변경되었을 때 해당 폴리곤 위 패널 삭제 요청 */
  onEaveChange?: (polygonId: string) => void;
  /** 외부(툴바 undo)로부터 undo 신호. 값이 바뀔 때마다 마지막 점 삭제 실행 */
  undoSignal?: number;
  /** 외부(툴바 deleteAll)로부터 전체 초기화 신호. 값이 바뀔 때마다 내부 areas/currentPoints/선택 상태 초기화 */
  clearSignal?: number;
  /** 외부(툴바 선택 삭제)로부터 선택 삭제 신호. 값이 바뀔 때마다 선택된 지붕면/장애물 삭제 */
  deleteSelectedSignal?: number;
  /** 외부(툴바 지붕결합)로부터 병합 신호. 값이 바뀔 때마다 선택된 인접 지붕면 병합 */
  mergeSelectedSignal?: number;
  /** 선택된 지붕면/장애물 존재 여부를 부모에 알림 (툴바 선택 삭제 버튼 활성화 판정용) */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** 병합 가능 여부(인접 install 면 2개 이상 선택)를 부모에 알림 (지붕결합 버튼 활성화 판정용) */
  onMergeableChange?: (canMerge: boolean) => void;
  /** 되돌릴 점 존재 여부(그리는 중 찍은 점이 1개 이상)를 부모에 알림 (뒤로 버튼 활성화 판정용) */
  onUndoableChange?: (canUndo: boolean) => void;
  /** 외부 주입 폴리곤 (AI 자동 감지 결과, 정규화 [0..1] 좌표). 새 reference로 들어올 때 내부 areas에 1회 머지 */
  initialAreas?: NormalizedPolygon[];
  /** AI 감지 상태 머신 (Phase 7) — 로딩 오버레이 + Close X 버튼 가드에 사용 */
  detectStatus?: "idle" | "detecting";
  /** 부모가 합성 이미지(getLayoutBlob)에 접근하기 위한 ref */
  ref?: React.Ref<CropPopupHandle>;
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
 * 꼭짓점이 "같은 자리에 겹쳐 있다"고 볼 거리(px).
 * 핸들 시각 반지름(`HANDLE_VISUAL_RADIUS`)과 같은 값이라, **눈에 겹쳐 보이면 함께 잡힌다**.
 * 스냅으로 붙은 꼭짓점은 좌표가 정확히 같지만 병합·AI 감지 결과는 미세하게 어긋날 수 있어 여유를 둔다.
 */
const VERTEX_LINK_RADIUS = 6;

/** 드래그로 함께 움직일 꼭짓점 한 개 — 폴리곤 id 와 그 안에서의 인덱스 */
type VertexRef = { id: string; idx: number };

/**
 * 주어진 위치에서 SNAP_RADIUS 내 가장 가까운 install 폴리곤 꼭짓점 반환
 * @param excludeIds 제외할 폴리곤 id 집합 (꼭짓점 편집 중 함께 끌리는 폴리곤 제외용)
 */
function findNearestSnapVertex(
  pt: PixelPoint,
  areas: AreaEntry[],
  excludeIds?: ReadonlySet<string>,
): PixelPoint | null {
  let best: PixelPoint | null = null;
  let bestDist = SNAP_RADIUS;
  for (const area of areas) {
    if (area.type !== "install") continue;
    if (excludeIds?.has(area.id)) continue;
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

/**
 * `origin` 에 겹쳐 있는 install 폴리곤 꼭짓점을 전부 모은다 — 시작 꼭짓점 자신을 항상 첫 원소로 포함한다.
 *
 * 인접한 지붕면은 스냅(`SNAP_RADIUS`)으로 꼭짓점을 공유하게 되므로, 하나만 끌면 맞닿아 있던 면 사이가
 * 벌어진다. 겹친 것들을 한 덩어리로 묶어 같이 끌어야 지붕면이 계속 맞물린다.
 *
 * 개구(exclude)는 지붕면 위에 얹힌 별개 요소라 딸려오지 않는다 — 스냅 대상도 install 뿐이라
 * 개구 꼭짓점이 겹치는 것은 우연이고, 지붕면을 끌 때 개구까지 따라오면 예측을 벗어난다.
 * 폴리곤마다 가장 가까운 꼭짓점 하나만 잡아, 한 면 안에서 두 꼭짓점이 붙어 있어도 같이 끌리지 않게 한다.
 */
function collectCoincidentVertices(
  origin: PixelPoint,
  areas: AreaEntry[],
  originId: string,
  originIdx: number,
): VertexRef[] {
  const group: VertexRef[] = [{ id: originId, idx: originIdx }];
  for (const area of areas) {
    if (area.id === originId) continue;
    if (area.type !== "install") continue;
    if (area.points.length < 3) continue;
    let bestIdx = -1;
    let bestDist = VERTEX_LINK_RADIUS;
    for (let i = 0; i < area.points.length; i++) {
      const d = Math.hypot(origin.x - area.points[i].x, origin.y - area.points[i].y);
      if (d <= bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) group.push({ id: area.id, idx: bestIdx });
  }
  return group;
}

/** inner 폴리곤이 outer 폴리곤 안에 완전히 포함되는지 — inner의 모든 꼭짓점이 outer 내부 */
function polygonFullyInside(inner: PixelPoint[], outer: PixelPoint[]): boolean {
  return inner.every((p) => isPointInPolygon(p, outer));
}

/** 점 q가 공선인 선분 p-r 의 범위(바운딩 박스) 안에 있는지 */
function onSegment(p: PixelPoint, q: PixelPoint, r: PixelPoint): boolean {
  return Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) &&
         Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);
}

/** 두 선분(a-b, c-d) 교차 판정 — 점 접촉·공선(경계 닿음)까지 포함 (장애물 걸침·접촉 감지용) */
function segmentsIntersectInclusive(a: PixelPoint, b: PixelPoint, c: PixelPoint, d: PixelPoint): boolean {
  const o = (p: PixelPoint, q: PixelPoint, r: PixelPoint) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
  if (d1 !== d2 && d3 !== d4) return true;            // 정상 가로지름
  if (d1 === 0 && onSegment(a, c, b)) return true;    // c 가 선분 a-b 위
  if (d2 === 0 && onSegment(a, d, b)) return true;    // d 가 선분 a-b 위
  if (d3 === 0 && onSegment(c, a, d)) return true;    // a 가 선분 c-d 위
  if (d4 === 0 && onSegment(c, b, d)) return true;    // b 가 선분 c-d 위
  return false;
}

/** 두 폴리곤이 겹치거나 맞닿는지 — 정점 포함 + 변 교차(점 접촉 포함). 장애물 이동 시 영향받는 지붕면 판별용 */
function polygonsOverlap(a: PixelPoint[], b: PixelPoint[]): boolean {
  if (a.some((p) => isPointInPolygon(p, b)) || b.some((p) => isPointInPolygon(p, a))) return true;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i], a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j], b2 = b[(j + 1) % b.length];
      if (segmentsIntersectInclusive(a1, a2, b1, b2)) return true;
    }
  }
  return false;
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

const HANDLE_RADIUS = 12;
const HANDLE_VISUAL_RADIUS = 6;
const DRAG_THRESHOLD = 8; // 드래그로 인정할 최소 이동 거리(px) — 터치 미세 지터를 클릭으로 처리


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
  editLocked = false,
  onEaveChange,
  undoSignal,
  clearSignal,
  deleteSelectedSignal,
  mergeSelectedSignal,
  onSelectionChange,
  onMergeableChange,
  onUndoableChange,
  initialAreas,
  detectStatus = "idle",
  ref,
}: CropPopupProps) {
  const [areas, setAreas] = useState<AreaEntry[]>([]);
  const [currentPoints, setCurrentPoints] = useState<PixelPoint[]>([]);
  const [mousePos, setMousePos] = useState<PixelPoint | null>(null);
  const [canvasLayout, setCanvasLayout] = useState<{
    w: number; h: number; offsetX: number; offsetY: number;
  } | null>(null);
  // 다중 선택 (select 모드): 클릭 토글로 여러 폴리곤을 동시에 선택한다.
  const [selectedPolygonIds, setSelectedPolygonIds] = useState<Set<string>>(new Set());
  // select 모드에서 폴리곤을 실제로 잡고 끌고 있는 상태 — grabbing 커서 표시용
  const [isDraggingPolygon, setIsDraggingPolygon] = useState(false);

  // Polygon drag-move refs (select 모드)
  // 이동 시작 시 이동 대상(install)과 함께 움직일 폴리곤들(install 본체 + 겹치는 exclude 장애물)의
  // 원본 좌표를 id별로 저장 — 그룹 단위로 같은 dx/dy 만큼 이동시킨다.
  const dragStartRef = useRef<PixelPoint | null>(null);
  const dragOriginalGroupRef = useRef<Map<string, PixelPoint[]> | null>(null);
  // 드래그 후보 — pointerdown 시 포인터 아래에 있던 폴리곤 id (장애물 우선).
  // 다중 선택 상태여도 드래그는 이 단일 폴리곤만 이동시킨다.
  const dragCandidateIdRef = useRef<string | null>(null);
  // press 후 실제 이동이 발생했는지 — pointerUp 시 "클릭(선택/해제)"과 "드래그 이동"을 구분
  const didDragRef = useRef<boolean>(false);
  // 꼭짓점 드래그 임계값 체크용 — 시작 좌표와 실제 이동 여부 (editRoof 모드)
  const vertexDragStartRef = useRef<PixelPoint | null>(null);
  const didVertexDragRef = useRef<boolean>(false);

  // Vertex editing (editRoof 모드)
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);
  // 꼭짓점 드래그/삽입/삭제 중인 폴리곤 id — editRoof가 모든 폴리곤을 대상으로 하므로
  // 선택 상태(selectedPolygonIds)와 무관하게 별도 ref로 편집 대상 폴리곤을 추적한다.
  const editingPolygonIdRef = useRef<string | null>(null);
  // 이번 드래그로 함께 움직일 수 있는 꼭짓점 묶음 — 겹쳐 있던 인접 지붕면들의 꼭짓점이 여기 들어온다.
  // 첫 원소가 사용자가 실제로 집은 꼭짓점(= editingPolygonIdRef 의 것)이다.
  // Alt 를 누르고 끌면 첫 원소만 움직이지만, 묶음 자체는 그대로 둔다 — 스냅 제외 대상이기도 하기 때문이다.
  const vertexDragGroupRef = useRef<VertexRef[] | null>(null);
  // 이번 드래그에서 실제로 좌표가 바뀐 폴리곤 id — Alt 를 눌렀다 뗐다 해도 정확히 추적하려고 누적한다.
  // 드래그 종료 시 여기 담긴 면만 처마 기준선을 리셋하고 그 위 모듈을 지운다.
  const vertexMovedIdsRef = useRef<Set<string>>(new Set());

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

  // 그리기 모드 또는 지붕편집 툴 변경 시 진행 중 점·선택·드래그 상태 전부 초기화
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
      setSelectedPolygonIds(new Set());
      setDraggingVertexIdx(null);
      dragStartRef.current = null;
      dragOriginalGroupRef.current = null;
      dragCandidateIdRef.current = null;
      didDragRef.current = false;
      editingPolygonIdRef.current = null;
      vertexDragGroupRef.current = null;
      vertexMovedIdsRef.current.clear();
    }
  }, [drawingMode, roofEditTool]);

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

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 지붕면 색 인덱스는 상태로 저장하지 않고 areas 에서 **파생**한다 —
    // install 만 필터링한 등장 순서(0,1,2,…)가 곧 팔레트 인덱스다.
    // 그리기/삭제/병합/undo/AI 재감지 어느 경로로 areas 가 바뀌어도 자동으로 일관되고,
    // install 이 30개 이하인 동안에는 색 중복이 구조적으로 발생하지 않는다.
    // 매 폴리곤마다 indexOf 로 훑지 않도록 여기서 Map 을 한 번만 만든다.
    const installColorIndex = new Map<string, number>();
    for (const area of areas) {
      if (area.type === "install") installColorIndex.set(area.id, installColorIndex.size);
    }

    // Draw completed polygons
    for (const area of areas) {
      if (area.points.length < 3) continue;
      const isInstall = area.type === "install";
      const isSelected = selectedPolygonIds.has(area.id);
      const colorIndex = installColorIndex.get(area.id) ?? 0;
      ctx.beginPath();
      ctx.moveTo(area.points[0].x, area.points[0].y);
      for (let i = 1; i < area.points.length; i++) {
        ctx.lineTo(area.points[i].x, area.points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = isInstall
        ? getRoofFaceFill(colorIndex)
        : COLOR_EXCLUDE_FILL;
      ctx.fill();
      ctx.strokeStyle = isSelected
        ? COLOR_SELECTED
        : (isInstall ? getRoofFaceColor(colorIndex) : COLOR_EXCLUDE);
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

    // Draw vertex/midpoint handles for ALL polygons in editRoof mode
    // (editRoof 모드: 그려진 모든 지붕면과 모든 장애물에 점 표시)
    if (roofEditTool === "editRoof") {
      for (const area of areas) {
        if (area.points.length < 3) continue;
        // 핸들도 소속 면의 색을 그대로 쓴다 — 면이 여러 개일 때 어느 면의 핸들인지 색으로 읽힌다.
        // install 은 팔레트 색, exclude(개구)는 자기 색인 빨강.
        const handleColor = area.type === "install"
          ? getRoofFaceColor(installColorIndex.get(area.id) ?? 0)
          : COLOR_EXCLUDE;
        // Draw edge midpoint handles with + sign
        for (let i = 0; i < area.points.length; i++) {
          const p1 = area.points[i];
          const p2 = area.points[(i + 1) % area.points.length];
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          ctx.beginPath();
          ctx.arc(mx, my, HANDLE_VISUAL_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.fill();
          ctx.strokeStyle = handleColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // + sign
          const s = 3;
          ctx.beginPath();
          ctx.moveTo(mx - s, my);
          ctx.lineTo(mx + s, my);
          ctx.moveTo(mx, my - s);
          ctx.lineTo(mx, my + s);
          ctx.strokeStyle = handleColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        // Draw vertex handles — 면 색으로 채우고 흰 테두리로 배경에서 띄운다
        for (const pt of area.points) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, HANDLE_VISUAL_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = handleColor;
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
      // 그리는 중인 지붕면은 **완성되면 배정받을 색**(= 현재 install 개수 인덱스)으로 미리 그린다
      const strokeColor = isInstall
        ? getRoofFaceColor(installColorIndex.size)
        : COLOR_EXCLUDE;

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

    // Draw placed panels — 소속 지붕면(polygonId)의 팔레트 색을 따라간다.
    // 소속 면을 찾지 못하면(고아 참조 방어) 기존 파랑으로 폴백한다.
    for (const panel of placedPanels) {
      const panelColorIndex = installColorIndex.get(panel.polygonId);
      ctx.beginPath();
      ctx.moveTo(panel.corners[0].x, panel.corners[0].y);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(panel.corners[i].x, panel.corners[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = panelColorIndex === undefined
        ? COLOR_INSTALL_PANEL
        : getRoofFaceFill(panelColorIndex, 0.5);
      ctx.strokeStyle = panelColorIndex === undefined
        ? COLOR_INSTALL
        : getRoofFaceColor(panelColorIndex);
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    }

  }, [areas, currentPoints, mousePos, drawingMode, placedPanels, selectedPolygonIds, roofEditTool]);

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
      // select 모드: 폴리곤 클릭으로 토글 선택/해제, press+drag로 단일 폴리곤 이동
      if (roofEditTool === "select") {
        // 포인터 아래 폴리곤 탐색 — 장애물(exclude)을 지붕면(install)보다 우선해서 hit-test
        // (지붕면과 장애물이 겹친 경우 장애물 선택 우선). 같은 타입 내에서는 z-order 역순.
        let hit: AreaEntry | null = null;
        for (let i = areas.length - 1; i >= 0; i--) {
          const a = areas[i];
          if (a.type === "exclude" && a.points.length >= 3 && isPointInPolygon(pt, a.points)) {
            hit = a;
            break;
          }
        }
        if (!hit) {
          for (let i = areas.length - 1; i >= 0; i--) {
            const a = areas[i];
            if (a.type === "install" && a.points.length >= 3 && isPointInPolygon(pt, a.points)) {
              hit = a;
              break;
            }
          }
        }

        if (hit) {
          // 드래그 후보로 준비 (실제 토글/이동 구분은 pointerUp에서). 다중 선택 여부와 무관하게
          // 드래그하면 이 폴리곤만 단독 이동한다.
          dragCandidateIdRef.current = hit.id;
          dragStartRef.current = pt;
          didDragRef.current = false;
          // 이동 대상 본체 + (install인 경우) 완전히 포함된 exclude 장애물을 그룹으로 묶어 원본 좌표 저장
          const group = new Map<string, PixelPoint[]>();
          group.set(hit.id, hit.points.map((p) => ({ ...p })));
          if (hit.type === "install") {
            for (const a of areas) {
              if (a.type === "exclude" && polygonFullyInside(a.points, hit.points)) {
                group.set(a.id, a.points.map((p) => ({ ...p })));
              }
            }
          }
          dragOriginalGroupRef.current = group;
          setIsDraggingPolygon(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }

        // 빈 공간 클릭: 전체 선택 해제
        setSelectedPolygonIds(new Set());
        return;
      }

      // editRoof 모드: 모든 폴리곤의 꼭짓점/변 중점 핸들을 대상으로 편집
      if (roofEditTool === "editRoof") {
        // 꼭짓점 hit 검사 (모든 폴리곤, z-order 역순)
        for (let ai = areas.length - 1; ai >= 0; ai--) {
          const area = areas[ai];
          if (area.points.length < 3) continue;
          for (let i = 0; i < area.points.length; i++) {
            const vp = area.points[i];
            if (Math.hypot(pt.x - vp.x, pt.y - vp.y) <= HANDLE_RADIUS) {
              editingPolygonIdRef.current = area.id;
              // 포인터 위치가 아니라 집은 꼭짓점의 실제 좌표를 기준으로 겹친 것들을 모은다.
              // 개구를 집은 경우는 단독 이동 — 지붕면끼리만 묶는다.
              // Alt 여부는 여기서 보지 않는다. 묶음은 드래그 도중 Alt 를 눌렀다 뗄 수 있도록 항상 모아 두고,
              // 실제로 몇 개를 옮길지는 handlePointerMove 가 그때그때 정한다.
              vertexDragGroupRef.current = area.type === "install"
                ? collectCoincidentVertices(vp, areas, area.id, i)
                : [{ id: area.id, idx: i }];
              vertexMovedIdsRef.current.clear();
              setDraggingVertexIdx(i);
              vertexDragStartRef.current = pt;
              didVertexDragRef.current = false;
              e.currentTarget.setPointerCapture(e.pointerId);
              return;
            }
          }
        }
        // 변 중점 hit 검사 (모든 폴리곤, z-order 역순) — 새 점 삽입 후 드래그 시작
        for (let ai = areas.length - 1; ai >= 0; ai--) {
          const area = areas[ai];
          if (area.points.length < 3) continue;
          for (let i = 0; i < area.points.length; i++) {
            const p1 = area.points[i];
            const p2 = area.points[(i + 1) % area.points.length];
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            if (Math.hypot(pt.x - mx, pt.y - my) <= HANDLE_RADIUS) {
              const insertIdx = i + 1;
              const newPoints = [...area.points];
              newPoints.splice(insertIdx, 0, { x: mx, y: my });
              const updated = areas.map((a) =>
                a.id === area.id
                  ? {
                      ...a,
                      points: newPoints,
                      // 꼭짓점 편집 시 기준선을 가장 긴 변으로 자동 리셋 (install만)
                      eaveEdgeIndex: a.type === "install" ? findLongestEdgeIndex(newPoints) : undefined,
                    }
                  : a,
              );
              setAreas(updated);
              editingPolygonIdRef.current = area.id;
              // 변 중점에서 새로 삽입한 점은 아직 어디에도 겹쳐 있지 않다 — 단독으로 끈다.
              // 끌다가 다른 면 꼭짓점에 스냅되면 그때부터 겹치고, 다음 드래그에서 묶인다.
              vertexDragGroupRef.current = [{ id: area.id, idx: insertIdx }];
              vertexMovedIdsRef.current.clear();
              setDraggingVertexIdx(insertIdx);
              vertexDragStartRef.current = pt;
              // 변 중점 클릭은 점 삽입 자체가 변경 — finalize가 미이동이어도 마무리되도록 true로 시작
              didVertexDragRef.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              onEaveChange?.(area.id);
              return;
            }
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
      setSelectedPolygonIds(new Set());
      setDraggingVertexIdx(null);
      dragStartRef.current = null;
      dragOriginalGroupRef.current = null;
      dragCandidateIdRef.current = null;
      didDragRef.current = false;
      editingPolygonIdRef.current = null;
      vertexDragGroupRef.current = null;
      vertexMovedIdsRef.current.clear();
    }
  }, [clearSignal]);

  // 선택된 폴리곤 id 목록을 부모에 통지 (툴바 선택 삭제 버튼 활성화 + 선택 면 모듈 삭제용)
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedPolygonIds));
  }, [selectedPolygonIds, onSelectionChange]);

  // 되돌릴 점 존재 여부를 부모에 통지 (툴바 뒤로 버튼 활성화 판정용).
  // undoLastPoint 의 실행 조건(currentPoints.length >= 1)과 동일해 버튼 상태와 동작이 어긋나지 않는다.
  // 지붕면/장애물 구분 없이 그리는 중이면 활성 — currentPoints 를 둘이 공용하기 때문.
  useEffect(() => {
    onUndoableChange?.(currentPoints.length >= 1);
  }, [currentPoints, onUndoableChange]);

  // 병합 가능 여부를 부모에 통지 — bridge-then-union이 단일 폴리곤을 만들 때만 true.
  // 버튼 판정과 실제 병합이 같은 mergeAreaPolygons를 공유하므로 "켜지는데 무반응"이 원천 차단된다.
  // (장애물 exclude는 대상 아님. 면 포개짐/코너접촉/떨어진 면/중정이면 null → 버튼 비활성)
  useEffect(() => {
    const selectedInstall = areas.filter(
      (a) => a.type === "install" && selectedPolygonIds.has(a.id),
    );
    const canMerge =
      selectedInstall.length >= 2 &&
      mergeAreaPolygons(selectedInstall.map((a) => a.points)) !== null;
    onMergeableChange?.(canMerge);
  }, [selectedPolygonIds, areas, onMergeableChange]);

  // 편집 잠금(배치 완료) 진입 시 미완성 그리기·점편집·선택 잔상 정리 (모드는 부모가 select로 전환).
  // 툴 변경 시 자동 정리 effect(위)가 못 잡는 케이스(이미 select 모드에서 선택 중 완료)까지 커버.
  // 이미 비어있으면 새 참조 생성을 피해 불필요한 캔버스 재드로우를 막는다.
  useEffect(() => {
    if (editLocked) {
      setCurrentPoints((prev) => (prev.length === 0 ? prev : []));
      setSelectedPolygonIds((prev) => (prev.size === 0 ? prev : new Set()));
      setDraggingVertexIdx(null);
    }
  }, [editLocked]);

  // 외부(툴바 선택 삭제) 신호 수신 — 선택된 지붕면/장애물 삭제
  // 지붕면(install) 삭제 시 그 안에 완전히 포함된 장애물(exclude)도 함께 삭제.
  // 모듈은 notifyParent 후 부모가 없어진 폴리곤 기준으로 자동 제거한다.
  const prevDeleteSelectedRef = useRef<number | undefined>(deleteSelectedSignal);
  useEffect(() => {
    if (deleteSelectedSignal === undefined) return;
    if (prevDeleteSelectedRef.current === deleteSelectedSignal) return;
    prevDeleteSelectedRef.current = deleteSelectedSignal;
    if (selectedPolygonIds.size === 0) return;
    // 선택된 모든 폴리곤 삭제. 각 install 삭제 시 그 안에 완전히 포함된 exclude 장애물도 함께 삭제.
    const toRemove = new Set<string>(selectedPolygonIds);
    for (const id of selectedPolygonIds) {
      const target = areasRef.current.find((a) => a.id === id);
      if (!target || target.type !== "install") continue;
      for (const a of areasRef.current) {
        if (a.type === "exclude" && polygonFullyInside(a.points, target.points)) {
          toRemove.add(a.id);
        }
      }
    }
    const updated = areasRef.current.filter((a) => !toRemove.has(a.id));
    setAreas(updated);
    notifyParent(updated);
    setSelectedPolygonIds(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps -- areasRef/notifyParent는 stable, signal·선택 변경에만 반응
  }, [deleteSelectedSignal, selectedPolygonIds]);

  // 외부(툴바 지붕결합) 신호 수신 — 선택된 인접 install 지붕면들을 하나로 병합한다.
  // - union 결과가 단일 폴리곤일 때만 병합 (떨어진 조각이면 거부).
  // - 병합된 면 위의 장애물(내부 포함 exclude)과 패널은 함께 삭제:
  //   exclude는 여기서 제거, 패널은 옛 면 id 소멸 시 부모(notifyParent→handleAreasChange)가 자동 prune.
  // - 병합면은 새 id로 추가하되 즉시 선택 상태로 남긴다.
  const prevMergeSelectedRef = useRef<number | undefined>(mergeSelectedSignal);
  useEffect(() => {
    if (mergeSelectedSignal === undefined) return;
    if (prevMergeSelectedRef.current === mergeSelectedSignal) return;
    prevMergeSelectedRef.current = mergeSelectedSignal;

    const selectedInstall = areasRef.current.filter(
      (a) => a.type === "install" && selectedPolygonIds.has(a.id),
    );
    if (selectedInstall.length < 2) return;

    const mergedPoints = mergeAreaPolygons(selectedInstall.map((a) => a.points));
    if (!mergedPoints) {
      // 인접 판정 통과했으나 union이 단일 폴리곤이 아닌 예외적 케이스 — 조용히 무시
      return;
    }

    const mergedIds = new Set(selectedInstall.map((a) => a.id));
    // 병합면 위(내부 완전 포함)의 장애물 exclude 도 함께 삭제.
    // 개별 원본 면이 아니라 "병합된 외곽" 기준으로 검사 — 옛 공유변을 걸친 장애물은
    // 원본 어느 면에도 완전히 포함되지 않아 누락되기 때문.
    const toRemove = new Set<string>(mergedIds);
    for (const a of areasRef.current) {
      if (a.type === "exclude" && polygonFullyInside(a.points, mergedPoints)) {
        toRemove.add(a.id);
      }
    }

    const mergedArea: AreaEntry = {
      id: crypto.randomUUID(),
      type: "install",
      points: mergedPoints,
      eaveEdgeIndex: findLongestEdgeIndex(mergedPoints),
    };
    const updated = [
      ...areasRef.current.filter((a) => !toRemove.has(a.id)),
      mergedArea,
    ];
    setAreas(updated);
    notifyParent(updated);
    setSelectedPolygonIds(new Set([mergedArea.id])); // 병합면 선택 유지
  // eslint-disable-next-line react-hooks/exhaustive-deps -- areasRef/notifyParent는 stable, signal·선택 변경에만 반응
  }, [mergeSelectedSignal, selectedPolygonIds]);

  /** 캔버스에서 브라우저 기본 컨텍스트 메뉴를 차단한다 */
  function handleContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
  }

  /** 포인터 이동 시 폴리곤 드래그(캔버스 경계 클램핑)·꼭짓점 드래그·가이드 라인을 처리한다 */
  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (editLocked) return; // 배치 완료(편집 잠금) 중엔 캡처된 포인터 이동도 무시 (pointer-events:none 우회 방어)
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Polygon drag-move (select 모드, 캔버스 경계 내로 클램핑)
    if (drawingMode === null && roofEditTool === "select" && dragStartRef.current && dragOriginalGroupRef.current && dragCandidateIdRef.current) {
      const canvas = canvasRef.current;
      const cw = canvas ? canvas.width : Infinity;
      const ch = canvas ? canvas.height : Infinity;
      const group = dragOriginalGroupRef.current;
      // 클램핑 기준은 이동 본체(드래그 후보) 좌표 — 동반 장애물은 본체와 같은 offset으로 따라간다
      const selOrig = group.get(dragCandidateIdRef.current);
      if (!selOrig) return;
      let dx = px - dragStartRef.current.x;
      let dy = py - dragStartRef.current.y;
      // 임계값 미만 이동은 클릭으로 간주 — 터치 미세 지터로 인한 오이동/모듈 증발 방지
      if (!didDragRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      didDragRef.current = true;
      // 본체가 캔버스 안에 머물도록 dx/dy 클램핑
      const minX = Math.min(...selOrig.map((p) => p.x));
      const maxX = Math.max(...selOrig.map((p) => p.x));
      const minY = Math.min(...selOrig.map((p) => p.y));
      const maxY = Math.max(...selOrig.map((p) => p.y));
      dx = Math.max(-minX, Math.min(cw - maxX, dx));
      dy = Math.max(-minY, Math.min(ch - maxY, dy));
      setAreas((prev) =>
        prev.map((a) => {
          const orig = group.get(a.id);
          if (!orig) return a;
          return { ...a, points: orig.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
        }),
      );
      return;
    }

    // Vertex dragging (editRoof 모드)
    const editingId = editingPolygonIdRef.current;
    const dragGroup = vertexDragGroupRef.current;
    if (drawingMode === null && roofEditTool === "editRoof" && draggingVertexIdx !== null && editingId && dragGroup) {
      // 임계값 미만 이동은 무시 — 꼭짓점 탭만으로 모양 변경/모듈 삭제 방지 (변 중점 삽입 경로는 시작 시 true라 영향 없음)
      if (!didVertexDragRef.current) {
        const start = vertexDragStartRef.current;
        if (start && Math.hypot(px - start.x, py - start.y) < DRAG_THRESHOLD) return;
        didVertexDragRef.current = true;
      }
      // 스냅: 다른 install 폴리곤의 꼭짓점에 흡착.
      // 묶음에 든 폴리곤은 **전부** 제외한다 — 그냥 끌어 하나만 뗄 때 남겨둔 꼭짓점에 도로 붙어버리면
      // SNAP_RADIUS 안에서 영영 뗄 수 없고, Alt 로 함께 끌 때는 서로에게 흡착돼 제자리에 고정되기 때문이다.
      const groupIds = new Set(dragGroup.map((v) => v.id));
      const snapped = findNearestSnapVertex({ x: px, y: py }, areasRef.current, groupIds) ?? { x: px, y: py };
      // 기본은 집은 꼭짓점 하나만 움직인다 — 붙어 있던 면을 떼어내는 쪽이 손에 익는다는 판단.
      // Alt(Option) 를 누른 채 끌면 겹쳐 있던 꼭짓점이 같은 좌표로 함께 따라와 지붕면들이 계속 맞물린다.
      // 드래그 도중에 눌렀다 떼도 다음 move 부터 바로 반영된다.
      const targets = e.altKey ? dragGroup : dragGroup.slice(0, 1);
      for (const v of targets) vertexMovedIdsRef.current.add(v.id);
      setAreas((prev) =>
        prev.map((a) => {
          const ref = targets.find((v) => v.id === a.id);
          if (!ref || ref.idx >= a.points.length) return a;
          const newPoints = [...a.points];
          newPoints[ref.idx] = snapped;
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
    if (editLocked) return; // 배치 완료(편집 잠금) 중엔 놓을 때 변경 저장(notifyParent) 차단
    // End polygon drag-move / click-toggle (select 모드)
    if (roofEditTool === "select" && dragStartRef.current) {
      const candidateId = dragCandidateIdRef.current;
      const moved = didDragRef.current;
      dragStartRef.current = null;
      dragOriginalGroupRef.current = null;
      dragCandidateIdRef.current = null;
      didDragRef.current = false;
      setIsDraggingPolygon(false);
      if (moved) {
        // 실제로 이동한 경우: 부모 동기화 + 해당 지붕면 위 모듈 자동 삭제. 이동한 폴리곤은 선택 유지(추가).
        notifyParent(areasRef.current);
        if (candidateId) {
          const movedArea = areasRef.current.find((a) => a.id === candidateId);
          if (movedArea?.type === "exclude") {
            // 장애물 단독 이동: 새 위치에 겹친 install 지붕면들의 패널을 정리 (장애물 아래 패널 잔존 방지).
            // 본체(install)는 placedPanel.polygonId === install.id 이므로 install id로 onEaveChange를 호출해야 삭제된다.
            for (const a of areasRef.current) {
              if (a.type === "install" && a.points.length >= 3 && polygonsOverlap(movedArea.points, a.points)) {
                onEaveChange?.(a.id);
              }
            }
          } else {
            // install 본체 이동: 해당 지붕면 위 패널 삭제
            onEaveChange?.(candidateId);
          }
          setSelectedPolygonIds((prev) => {
            if (prev.has(candidateId)) return prev;
            const next = new Set(prev);
            next.add(candidateId);
            return next;
          });
        }
      } else if (candidateId) {
        // 이동 없이 클릭 → 해당 폴리곤을 Set에서 토글 (있으면 해제, 없으면 추가)
        setSelectedPolygonIds((prev) => {
          const next = new Set(prev);
          if (next.has(candidateId)) next.delete(candidateId);
          else next.add(candidateId);
          return next;
        });
      }
      return;
    }
    // End vertex drag (editRoof 모드)
    if (roofEditTool === "editRoof" && draggingVertexIdx !== null) {
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
    // 실제로 좌표가 바뀐 폴리곤 전부가 모양 변경 대상이다 — 함께 끌렸는데 하나만 마무리하면
    // 나머지 면의 처마 기준선이 옛 모양 기준으로 남고 그 위 모듈도 그대로 살아남는다.
    // Alt 로 하나만 옮겼다면 여기에도 그 하나만 담겨 있어, 건드리지 않은 면은 그대로 보존된다.
    const editedId = editingPolygonIdRef.current;
    const moved = vertexMovedIdsRef.current;
    // 변 중점 삽입 후 한 번도 움직이지 않고 놓은 경우: 삽입 자체가 모양 변경이므로 집은 면을 대상으로 삼는다.
    const movedIds = moved.size > 0 ? new Set(moved) : new Set(editedId ? [editedId] : []);
    moved.clear();
    editingPolygonIdRef.current = null;
    vertexDragGroupRef.current = null;
    const didMove = didVertexDragRef.current;
    didVertexDragRef.current = false;
    vertexDragStartRef.current = null;
    // 실제 이동(또는 점 삽입)이 일어난 경우만 모양 변경 마무리 — 단순 탭으로 모듈이 삭제되는 것 방지
    if (!didMove) return;
    const resetAreas = areasRef.current.map((a) =>
      movedIds.has(a.id) && a.type === "install"
        ? { ...a, eaveEdgeIndex: findLongestEdgeIndex(a.points) }
        : a,
    );
    setAreas(resetAreas);
    notifyParent(resetAreas);
    for (const id of movedIds) onEaveChange?.(id);
  }

  /** 포인터 캡처가 강제 해제될 때 드래그 상태를 정리한다 */
  function handlePointerCancel() {
    dragStartRef.current = null;
    dragOriginalGroupRef.current = null;
    dragCandidateIdRef.current = null;
    didDragRef.current = false;
    setIsDraggingPolygon(false);
    if (draggingVertexIdx !== null) {
      finalizeVertexDrag();
    }
  }

  /**
   * 지정 폴리곤의 꼭짓점을 삭제하며, 3개 이하이면 폴리곤 전체를 제거한다 (areasRef로 최신 상태 참조).
   * editRoof 모드에서 편집 대상 폴리곤(targetId)을 명시해 호출한다.
   */
  function tryDeleteVertex(vertexIdx: number, targetId: string) {
    if (!targetId) return;
    const currentAreas = areasRef.current;
    const selArea = currentAreas.find((a) => a.id === targetId);
    if (!selArea) return;
    let updated: AreaEntry[];
    if (selArea.points.length <= 3) {
      // Delete entire polygon
      updated = currentAreas.filter((a) => a.id !== targetId);
      editingPolygonIdRef.current = null;
      // 폴리곤이 통째로 사라졌으니 드래그 묶음에 죽은 id 가 남지 않게 비운다
      vertexDragGroupRef.current = null;
      vertexMovedIdsRef.current.clear();
    } else {
      const newPoints = selArea.points.filter((_, i) => i !== vertexIdx);
      updated = currentAreas.map((a) =>
        a.id === targetId
          ? {
              ...a,
              points: newPoints,
              // 꼭짓점 편집 시 기준선을 가장 긴 변으로 자동 리셋 (install만)
              eaveEdgeIndex: a.type === "install" ? findLongestEdgeIndex(newPoints) : undefined,
            }
          : a,
      );
      onEaveChange?.(targetId);
    }
    setAreas(updated);
    notifyParent(updated);
  }

  /** editRoof 모드에서 더블클릭으로 (모든 폴리곤 중) 꼭짓점을 삭제한다 */
  function handleDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (roofEditTool !== "editRoof") return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // z-order 역순으로 꼭짓점 hit 검사
    for (let ai = areas.length - 1; ai >= 0; ai--) {
      const area = areas[ai];
      if (area.points.length < 3) continue;
      for (let i = 0; i < area.points.length; i++) {
        const vp = area.points[i];
        if (Math.hypot(px - vp.x, py - vp.y) <= HANDLE_RADIUS) {
          tryDeleteVertex(i, area.id);
          return;
        }
      }
    }
  }

  // 배경 이미지 + 패널 오버레이 캔버스를 합성해 PNG Blob 으로 반환.
  // (구 handleSave 의 다운로드용 합성 로직 재활용 — toDataURL → toBlob)
  function getLayoutBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img) return resolve(null);

      const saveCanvas = document.createElement("canvas");
      saveCanvas.width = canvas.width;
      saveCanvas.height = canvas.height;
      const ctx = saveCanvas.getContext("2d");
      if (!ctx) return resolve(null);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height); // 배경
      ctx.drawImage(canvas, 0, 0); // 패널 오버레이
      saveCanvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  useImperativeHandle(ref, () => ({ getLayoutBlob }), []);

  return (
    /* Popup card — 외부 wrapper(page.tsx)가 zIndex/배치 담당.
       height 80%: 위 toolbar(2)+guide+아래 AI 버튼+gap 합 약 176px 공간 확보용 (반응형 vh 전환은 별도 트랙) */
    <div
      style={{
        width: "90%",
        height: "80%",
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
        {/* AI 감지 로딩 오버레이 (Phase 7: 사용자가 "AI 분석 시작" 클릭 시)
            globals.css @keyframes spin 패턴을 재사용해 일관화 (U1) */}
        {detectStatus === "detecting" && (
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
            {/* F-1: 텍스트 제거 — 버튼 "AI 分析中"이 충분한 안내, 오버레이는 차단 목적만 */}
            <span
              style={{
                width: 40,
                height: 40,
                border: "3px solid rgba(255,255,255,0.3)",
                borderTopColor: "var(--accent-blue)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                display: "inline-block",
              }}
              aria-hidden="true"
            />
          </div>
        )}

        {/* 지붕 편집 모드 조작 힌트 — Alt 드래그는 화면에 드러나지 않아 안내가 없으면 발견되지 않는다 */}
        {roofEditTool === "editRoof" && !editLocked && (
          <div
            style={{
              position: "absolute",
              left: 12,
              bottom: 12,
              zIndex: 10,
              maxWidth: "min(420px, calc(100% - 24px))",
              padding: "7px 11px",
              border: "1px solid var(--border-primary)",
              background: "rgba(255, 255, 255, 0.9)",
              color: "var(--text-secondary)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
              lineHeight: 1.5,
              backdropFilter: "blur(8px)",
              pointerEvents: "none", // 캔버스 조작을 가리지 않는다
            }}
          >
            {t("hintVertexDragAlt", lang)}
          </div>
        )}

        {/* Top-right Close button (편집 종료 — 동일 동작이 RoofEditToolbar X 에도 연결됨) */}
        <button
          onClick={onClose}
          disabled={detectStatus === "detecting"}
          title={detectStatus === "detecting" ? t("aiDetectInProgress", lang) : undefined}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            border: "1px solid var(--border-primary)",
            background: "rgba(255, 255, 255, 0.9)",
            color: "var(--text-secondary)",
            borderRadius: "var(--radius-md)",
            cursor: detectStatus === "detecting" ? "not-allowed" : "pointer",
            opacity: detectStatus === "detecting" ? 0.5 : 1,
            backdropFilter: "blur(8px)",
          }}
        >
          <X size={16} />
        </button>

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
          <Image
            ref={imgRef}
            src={cropData.imageDataUrl}
            alt=""
            fill
            unoptimized
            style={{ objectFit: "contain" }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              touchAction: "none",
              // 편집 잠금 시 캔버스 포인터 이벤트 전체 차단 (시각 렌더는 유지)
              pointerEvents: editLocked ? "none" : "auto",
              cursor:
                drawingMode === "install" || drawingMode === "exclude"
                  ? "crosshair"
                  : roofEditTool === "select"
                    ? isDraggingPolygon
                      ? "grabbing"
                      : selectedPolygonIds.size > 0
                        ? "grab"
                        : "default"
                    : roofEditTool === "editRoof"
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

    </div>
  );
}
