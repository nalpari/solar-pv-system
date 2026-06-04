import type { LatLng, PanelSize, PanelOrientation, PlacedPanel, PolygonArea, PixelPanel, PixelPolygon } from "../types";

interface Point {
  x: number;
  y: number;
}

const METERS_PER_LAT = 111320;

function metersPerLng(lat: number): number {
  return 111320 * Math.cos((lat * Math.PI) / 180);
}

function toLocal(origin: LatLng, p: LatLng): Point {
  return {
    x: (p.lng - origin.lng) * metersPerLng(origin.lat),
    y: (p.lat - origin.lat) * METERS_PER_LAT,
  };
}

function toLatLng(origin: LatLng, p: Point): LatLng {
  return {
    lat: origin.lat + p.y / METERS_PER_LAT,
    lng: origin.lng + p.x / metersPerLng(origin.lat),
  };
}

function signedArea(pts: Point[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return area / 2;
}

function lineIntersection(
  a1: Point, a2: Point,
  b1: Point, b2: Point,
): Point | null {
  const dx1 = a2.x - a1.x, dy1 = a2.y - a1.y;
  const dx2 = b2.x - b1.x, dy2 = b2.y - b1.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denom;
  return { x: a1.x + t * dx1, y: a1.y + t * dy1 };
}

function ensureCCW(pts: Point[]): Point[] {
  return signedArea(pts) < 0 ? [...pts].reverse() : pts;
}

// Insets a polygon inward by `distance`. Assumes math coordinate system (Y up).
// For canvas coordinates (Y down), flip Y before calling and flip back after.
function insetPolygon(pts: Point[], distance: number): Point[] {
  const n = pts.length;
  if (n < 3) return [];

  const ccw = ensureCCW(pts);

  const offsetEdges: { p1: Point; p2: Point }[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = ccw[j].x - ccw[i].x;
    const dy = ccw[j].y - ccw[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    // Inward normal for CCW polygon: (-dy, dx) normalized
    const nx = (-dy / len) * distance;
    const ny = (dx / len) * distance;
    offsetEdges.push({
      p1: { x: ccw[i].x + nx, y: ccw[i].y + ny },
      p2: { x: ccw[j].x + nx, y: ccw[j].y + ny },
    });
  }

  const result: Point[] = [];
  for (let i = 0; i < offsetEdges.length; i++) {
    const j = (i + 1) % offsetEdges.length;
    const pt = lineIntersection(
      offsetEdges[i].p1, offsetEdges[i].p2,
      offsetEdges[j].p1, offsetEdges[j].p2,
    );
    if (pt) result.push(pt);
  }

  if (result.length < 3) return [];

  // Validate that inset polygon hasn't self-intersected (area should be positive)
  if (signedArea(result) <= 0) return [];

  return result;
}

export function isPointInPolygon(pt: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function rotate(pt: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: pt.x * cos - pt.y * sin, y: pt.x * sin + pt.y * cos };
}

/** 두 선분 (a-b)와 (c-d)가 교차하는지 (CCW orientation 방식) */
function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const ccw = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = ccw(a, b, c);
  const d2 = ccw(a, b, d);
  const d3 = ccw(c, d, a);
  const d4 = ccw(c, d, b);
  // 양 끝이 서로 반대편에 있으면 교차 (경계 접촉은 교차로 보지 않음 — 부동소수 여유)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** 패널(사각형 corners)의 변이 폴리곤 변과 하나라도 교차하는지 — 오목부를 가로지르는 패널 검출용 */
function panelCrossesPolygon(corners: Point[], poly: Point[]): boolean {
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    for (let j = 0; j < poly.length; j++) {
      const c = poly[j];
      const d = poly[(j + 1) % poly.length];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

// 시작 위상 스캔 해상도 — x·y 시작점을 각 축 이만큼 분할해 가장 많이 채워지는 배치를 채택.
// (최대 배치 시뮬레이션이므로 처마선 정렬보다 최다 장수를 우선)
const X_PHASE_STEPS = 10;
const Y_PHASE_STEPS = 10;

export function placePanels(
  installAreas: PolygonArea[],
  excludeAreas: PolygonArea[],
  panelSize: PanelSize,
  orientation: PanelOrientation,
  layout: "aligned" | "staggered",
  gapX: number,
  gapY: number,
  margin: number,
  slopeSun: number,
): PlacedPanel[] {
  if (panelSize.width <= 0 || panelSize.height <= 0) return [];

  const allPanels: PlacedPanel[] = [];

  // 경사(寸) 투영 보정 — 위성 평면뷰에서 처마 수직 방향은 cos(경사각)만큼 압축돼 보인다.
  // θ = atan(촌/10) → cosθ = 10/√(100+촌²). slopeSun=0이면 1 (보정 없음).
  const cosSlope = 10 / Math.sqrt(100 + slopeSun * slopeSun);

  // Convert panel dimensions from mm to meters; swap width/height for landscape orientation
  const pw = (orientation === "landscape" ? panelSize.height : panelSize.width) / 1000;
  const ph = (orientation === "landscape" ? panelSize.width : panelSize.height) / 1000 * cosSlope;
  // 간격은 그리드 축 기준 — x축(처마 평행, 좌우) gapX / y축(처마 수직, 상하) gapY (경사 압축)
  const gapXM = gapX / 1000;
  const gapYM = gapY / 1000 * cosSlope;
  const marginM = margin / 1000;

  const stepX = pw + gapXM;
  const stepY = ph + gapYM;
  if (stepX <= 0 || stepY <= 0) return [];

  // Convert exclude areas to local coords for point-in-polygon checks
  for (const area of installAreas) {
    if (area.paths.length < 3) continue;

    const origin = area.paths[0];
    const localPoly = area.paths.map((p) => toLocal(origin, p));

    // Inset by margin
    const inset = insetPolygon(localPoly, marginM);
    if (inset.length < 3) continue;

    // Determine reference edge angle: use eaveEdgeIndex if provided, else longest edge.
    // 처마(흐름) 기준변의 두 끝점도 함께 기록 — 배치 y앵커(처마선)로 사용한다.
    let angle = 0;
    let eaveP1 = localPoly[0];
    let eaveP2 = localPoly[1 % localPoly.length];
    if (typeof area.eaveEdgeIndex === "number" && area.eaveEdgeIndex >= 0 && area.eaveEdgeIndex < localPoly.length) {
      const i = area.eaveEdgeIndex;
      const j = (i + 1) % localPoly.length;
      eaveP1 = localPoly[i];
      eaveP2 = localPoly[j];
      angle = Math.atan2(eaveP2.y - eaveP1.y, eaveP2.x - eaveP1.x);
    } else {
      let maxLen = 0;
      for (let i = 0; i < localPoly.length; i++) {
        const j = (i + 1) % localPoly.length;
        const dx = localPoly[j].x - localPoly[i].x;
        const dy = localPoly[j].y - localPoly[i].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > maxLen) {
          maxLen = len;
          angle = Math.atan2(dy, dx);
          eaveP1 = localPoly[i];
          eaveP2 = localPoly[j];
        }
      }
    }

    // Rotate inset polygon so reference edge is horizontal
    const negAngle = -angle;
    const rotatedInset = inset.map((p) => rotate(p, negAngle));
    // 회전 후 처마선의 y 좌표 (수평이 되므로 두 끝점 y는 동일)
    const eaveYRot = rotate(eaveP1, negAngle).y;

    // Also rotate exclude areas to same coordinate system
    const rotatedExcludes: Point[][] = excludeAreas.map((ex) =>
      ex.paths.map((p) => rotate(toLocal(origin, p), negAngle))
    );

    // Bounding box of rotated inset polygon
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const p of rotatedInset) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    // 처마선이 회전 후 bbox의 위(minY)/아래(maxY) 어느 쪽에 있는지 — 그 쪽에서 배치를 시작한다.
    const eaveAtTop = Math.abs(eaveYRot - minY) <= Math.abs(eaveYRot - maxY);

    // x·y 시작 위상을 모두 스캔해 가장 많이 채워지는 배치를 채택 (최대 배치 시뮬레이션).
    // eaveAtTop은 행 진행 방향(처마선 쪽→안쪽) 결정에만 사용. 치도리(staggered): 행마다 stepX/2 offset.
    let bestCorners: Point[][] = [];
    for (let qi = 0; qi < Y_PHASE_STEPS; qi++) {
      const yPhase = (stepY / Y_PHASE_STEPS) * qi;
      const ys: number[] = [];
      if (eaveAtTop) {
        for (let y = minY + ph / 2 + yPhase; y <= maxY - ph / 2; y += stepY) ys.push(y);
      } else {
        for (let y = maxY - ph / 2 - yPhase; y >= minY + ph / 2; y -= stepY) ys.push(y);
      }

      for (let pi = 0; pi < X_PHASE_STEPS; pi++) {
        const xPhase = (stepX / X_PHASE_STEPS) * pi;
        const collected: Point[][] = [];
        let row = 0;
        for (const y of ys) {
          const xOffset = layout === "staggered" ? (row % 2) * (stepX / 2) : 0;
          row++;
          for (let x = minX + pw / 2 + xPhase + xOffset; x <= maxX - pw / 2; x += stepX) {
            const corners: Point[] = [
              { x: x - pw / 2, y: y - ph / 2 },
              { x: x + pw / 2, y: y - ph / 2 },
              { x: x + pw / 2, y: y + ph / 2 },
              { x: x - pw / 2, y: y + ph / 2 },
            ];

            // 4꼭짓점이 모두 inset 폴리곤 안 + 패널 변이 폴리곤 경계를 가로지르지 않음(오목부 방어)
            const allInside = corners.every((c) => isPointInPolygon(c, rotatedInset));
            if (!allInside) continue;
            if (panelCrossesPolygon(corners, rotatedInset)) continue;

            // Check overlap with exclude areas (corner-in / vertex-in / 변 교차 모두 검사)
            const inExclude = rotatedExcludes.some((exPoly) =>
              exPoly.length >= 3 && (
                corners.some((c) => isPointInPolygon(c, exPoly)) ||
                exPoly.some((ep) => isPointInPolygon(ep, corners)) ||
                panelCrossesPolygon(corners, exPoly)
              )
            );
            if (inExclude) continue;

            collected.push(corners);
          }
        }
        if (collected.length > bestCorners.length) bestCorners = collected;
      }
    }

    // 최다 위상의 패널만 좌표 변환 (rotate back → lat/lng)
    for (const corners of bestCorners) {
      const latLngCorners = corners.map((c) => toLatLng(origin, rotate(c, angle))) as [LatLng, LatLng, LatLng, LatLng];
      allPanels.push({
        id: crypto.randomUUID(),
        polygonId: area.id,
        corners: latLngCorners,
      });
    }
  }

  return allPanels;
}

// mm 단위 버전 — 패널 크기(mm), 간격(mm), 마진(mm) 입력
// 현재 UI는 cm 단위로 전환했지만, mm 버전도 향후 단위 선택 기능 등을 위해 유지한다.
// (2026-03-20 논의: 단위를 cm로 바꿔줘 → cm 버전 추가, mm 버전 유지)
export function placePanelsOnCanvas(
  installAreas: PixelPolygon[],
  excludeAreas: PixelPolygon[],
  panelWidthMm: number,
  panelHeightMm: number,
  orientation: "portrait" | "landscape",
  layout: "aligned" | "staggered",
  gapXMm: number,
  gapYMm: number,
  marginMm: number,
  metersPerPixel: number,
  slopeSun: number,
): PixelPanel[] {
  if (panelWidthMm <= 0 || panelHeightMm <= 0 || metersPerPixel <= 0) return [];

  // 경사(寸) 투영 보정 — 처마 수직 방향은 cos(경사각)만큼 압축. slopeSun=0이면 1.
  const cosSlope = 10 / Math.sqrt(100 + slopeSun * slopeSun);

  // Convert mm → meters → pixels
  const pw = (orientation === "landscape" ? panelHeightMm : panelWidthMm) / 1000 / metersPerPixel;
  const ph = (orientation === "landscape" ? panelWidthMm : panelHeightMm) / 1000 / metersPerPixel * cosSlope;
  // 간격은 그리드 축 기준 — x축(처마 평행, 좌우) gapX / y축(처마 수직, 상하) gapY (경사 압축)
  const gapXPx = gapXMm / 1000 / metersPerPixel;
  const gapYPx = gapYMm / 1000 / metersPerPixel * cosSlope;
  const marginPx = marginMm / 1000 / metersPerPixel;

  const stepX = pw + gapXPx;
  const stepY = ph + gapYPx;
  if (stepX <= 0 || stepY <= 0) return [];

  const allPanels: PixelPanel[] = [];

  // Canvas has Y increasing downward, but geometry helpers (ensureCCW, insetPolygon)
  // assume math coordinates (Y up). Flip Y for all geometry, flip back for output.
  const flipY = (p: Point): Point => ({ x: p.x, y: -p.y });

  const excludePolys: Point[][] = excludeAreas
    .filter((ex) => ex.points.length >= 3)
    .map((ex) => ex.points.map(flipY));

  for (const area of installAreas) {
    if (area.points.length < 3) continue;

    const localPoly: Point[] = area.points.map(flipY);

    // Inset by margin (works correctly in math coords)
    const inset = insetPolygon(localPoly, marginPx);
    if (inset.length < 3) continue;

    // Determine reference edge angle: use eaveEdgeIndex if provided, else longest edge.
    // 처마(흐름) 기준변의 두 끝점도 함께 기록 — 배치 y앵커(처마선)로 사용한다.
    let angle = 0;
    let eaveP1 = localPoly[0];
    let eaveP2 = localPoly[1 % localPoly.length];
    if (typeof area.eaveEdgeIndex === "number" && area.eaveEdgeIndex >= 0 && area.eaveEdgeIndex < localPoly.length) {
      const i = area.eaveEdgeIndex;
      const j = (i + 1) % localPoly.length;
      eaveP1 = localPoly[i];
      eaveP2 = localPoly[j];
      angle = Math.atan2(eaveP2.y - eaveP1.y, eaveP2.x - eaveP1.x);
    } else {
      let maxLen = 0;
      for (let i = 0; i < localPoly.length; i++) {
        const j = (i + 1) % localPoly.length;
        const dx = localPoly[j].x - localPoly[i].x;
        const dy = localPoly[j].y - localPoly[i].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > maxLen) {
          maxLen = len;
          angle = Math.atan2(dy, dx);
          eaveP1 = localPoly[i];
          eaveP2 = localPoly[j];
        }
      }
    }

    // Rotate inset polygon so longest edge is horizontal
    const negAngle = -angle;
    const rotatedInset = inset.map((p) => rotate(p, negAngle));
    // 회전 후 처마선의 y 좌표 (수평이 되므로 두 끝점 y는 동일)
    const eaveYRot = rotate(eaveP1, negAngle).y;

    // Rotate exclude areas to same coordinate system
    // Both install inset and excludes rotate around (0,0), preserving relative positions
    const rotatedExcludes: Point[][] = excludePolys.map((exPoly) =>
      exPoly.map((p) => rotate(p, negAngle)),
    );

    // Bounding box of rotated inset polygon
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const p of rotatedInset) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    // 처마선이 회전 후 bbox의 위(minY)/아래(maxY) 어느 쪽에 있는지 — 그 쪽에서 배치를 시작한다.
    const eaveAtTop = Math.abs(eaveYRot - minY) <= Math.abs(eaveYRot - maxY);

    // x·y 시작 위상을 모두 스캔해 가장 많이 채워지는 배치를 채택 (최대 배치 시뮬레이션).
    // eaveAtTop은 행 진행 방향(처마선 쪽→안쪽) 결정에만 사용. 치도리(staggered): 행마다 stepX/2 offset.
    let bestCorners: Point[][] = [];
    for (let qi = 0; qi < Y_PHASE_STEPS; qi++) {
      const yPhase = (stepY / Y_PHASE_STEPS) * qi;
      // 처마선 쪽에서 안쪽으로 진행하는 행 중심 y 목록
      const ys: number[] = [];
      if (eaveAtTop) {
        for (let y = minY + ph / 2 + yPhase; y <= maxY - ph / 2; y += stepY) ys.push(y);
      } else {
        for (let y = maxY - ph / 2 - yPhase; y >= minY + ph / 2; y -= stepY) ys.push(y);
      }

      for (let pi = 0; pi < X_PHASE_STEPS; pi++) {
        const xPhase = (stepX / X_PHASE_STEPS) * pi;
        const collected: Point[][] = [];
        let row = 0;
        for (const y of ys) {
          const xOffset = layout === "staggered" ? (row % 2) * (stepX / 2) : 0;
          row++;
          for (let x = minX + pw / 2 + xPhase + xOffset; x <= maxX - pw / 2; x += stepX) {
            const corners: Point[] = [
              { x: x - pw / 2, y: y - ph / 2 },
              { x: x + pw / 2, y: y - ph / 2 },
              { x: x + pw / 2, y: y + ph / 2 },
              { x: x - pw / 2, y: y + ph / 2 },
            ];

            // 4꼭짓점이 모두 inset 폴리곤 안 + 패널 변이 폴리곤 경계를 가로지르지 않음(오목부 방어)
            const allInside = corners.every((c) => isPointInPolygon(c, rotatedInset));
            if (!allInside) continue;
            if (panelCrossesPolygon(corners, rotatedInset)) continue;

            // Check overlap with exclude areas (corner-in / vertex-in / 변 교차 모두 검사)
            const inExclude = rotatedExcludes.some((exPoly) =>
              exPoly.length >= 3 && (
                corners.some((c) => isPointInPolygon(c, exPoly)) ||
                exPoly.some((ep) => isPointInPolygon(ep, corners)) ||
                panelCrossesPolygon(corners, exPoly)
              ),
            );
            if (inExclude) continue;

            collected.push(corners);
          }
        }
        if (collected.length > bestCorners.length) bestCorners = collected;
      }
    }

    // 최다 위상의 패널만 좌표 변환 (rotate back → flip Y → canvas)
    for (const corners of bestCorners) {
      const pixelCorners = corners.map((c) => flipY(rotate(c, angle))) as [Point, Point, Point, Point];
      allPanels.push({
        id: crypto.randomUUID(),
        polygonId: area.id,
        corners: pixelCorners,
      });
    }
  }

  return allPanels;
}

// cm 단위 버전 — 패널 크기(mm), 간격(cm), 마진(cm) 입력
// UI에서 간격/마진을 cm로 표시하므로 이 함수를 사용한다.
// (2026-03-20 논의: 단위를 cm로 바꿔줘 → cm 버전 추가, mm 버전 유지)
export function placePanelsOnCanvasCm(
  installAreas: PixelPolygon[],
  excludeAreas: PixelPolygon[],
  panelWidthMm: number,
  panelHeightMm: number,
  orientation: "portrait" | "landscape",
  layout: "aligned" | "staggered",
  gapXCm: number,
  gapYCm: number,
  marginCm: number,
  metersPerPixel: number,
  slopeSun: number,
): PixelPanel[] {
  // cm → mm 변환 후 mm 버전 호출
  return placePanelsOnCanvas(
    installAreas,
    excludeAreas,
    panelWidthMm,
    panelHeightMm,
    orientation,
    layout,
    gapXCm * 10,
    gapYCm * 10,
    marginCm * 10,
    metersPerPixel,
    slopeSun,
  );
}
