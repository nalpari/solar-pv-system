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

export function placePanels(
  installAreas: PolygonArea[],
  excludeAreas: PolygonArea[],
  panelSize: PanelSize,
  orientation: PanelOrientation,
  gap: number,
  margin: number,
): PlacedPanel[] {
  if (panelSize.width <= 0 || panelSize.height <= 0) return [];

  const allPanels: PlacedPanel[] = [];

  // Convert panel dimensions from mm to meters; swap width/height for landscape orientation
  const pw = (orientation === "landscape" ? panelSize.height : panelSize.width) / 1000;
  const ph = (orientation === "landscape" ? panelSize.width : panelSize.height) / 1000;
  const gapM = gap / 1000;
  const marginM = margin / 1000;

  const stepX = pw + gapM;
  const stepY = ph + gapM;
  if (stepX <= 0 || stepY <= 0) return [];

  // Convert exclude areas to local coords for point-in-polygon checks
  for (const area of installAreas) {
    if (area.paths.length < 3) continue;

    const origin = area.paths[0];
    const localPoly = area.paths.map((p) => toLocal(origin, p));

    // Inset by margin
    const inset = insetPolygon(localPoly, marginM);
    if (inset.length < 3) continue;

    // Find longest edge of the ORIGINAL polygon for alignment
    let maxLen = 0;
    let angle = 0;
    for (let i = 0; i < localPoly.length; i++) {
      const j = (i + 1) % localPoly.length;
      const dx = localPoly[j].x - localPoly[i].x;
      const dy = localPoly[j].y - localPoly[i].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > maxLen) {
        maxLen = len;
        angle = Math.atan2(dy, dx);
      }
    }

    // Rotate inset polygon so longest edge is horizontal
    const negAngle = -angle;
    const rotatedInset = inset.map((p) => rotate(p, negAngle));

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

    // Place panels in a grid aligned to the longest edge
    for (let x = minX + pw / 2; x <= maxX - pw / 2; x += stepX) {
      for (let y = minY + ph / 2; y <= maxY - ph / 2; y += stepY) {
        const corners: Point[] = [
          { x: x - pw / 2, y: y - ph / 2 },
          { x: x + pw / 2, y: y - ph / 2 },
          { x: x + pw / 2, y: y + ph / 2 },
          { x: x - pw / 2, y: y + ph / 2 },
        ];

        // All corners must be inside the inset polygon
        const allInside = corners.every((c) => isPointInPolygon(c, rotatedInset));
        if (!allInside) continue;

        // Check overlap with exclude areas (bidirectional: panel corners in exclude, and exclude vertices in panel)
        const inExclude = rotatedExcludes.some((exPoly) =>
          exPoly.length >= 3 && (
            corners.some((c) => isPointInPolygon(c, exPoly)) ||
            exPoly.some((ep) => isPointInPolygon(ep, corners))
          )
        );
        if (inExclude) continue;

        // Rotate corners back and convert to lat/lng
        const latLngCorners = corners.map((c) => toLatLng(origin, rotate(c, angle))) as [LatLng, LatLng, LatLng, LatLng];

        allPanels.push({
          id: crypto.randomUUID(),
          corners: latLngCorners,
        });
      }
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
  gapMm: number,
  marginMm: number,
  metersPerPixel: number,
): PixelPanel[] {
  if (panelWidthMm <= 0 || panelHeightMm <= 0 || metersPerPixel <= 0) return [];

  // Convert mm → meters → pixels
  const pw = (orientation === "landscape" ? panelHeightMm : panelWidthMm) / 1000 / metersPerPixel;
  const ph = (orientation === "landscape" ? panelWidthMm : panelHeightMm) / 1000 / metersPerPixel;
  const gapPx = gapMm / 1000 / metersPerPixel;
  const marginPx = marginMm / 1000 / metersPerPixel;

  const stepX = pw + gapPx;
  const stepY = ph + gapPx;
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

    // Find longest edge of the original polygon for alignment
    let maxLen = 0;
    let angle = 0;
    for (let i = 0; i < localPoly.length; i++) {
      const j = (i + 1) % localPoly.length;
      const dx = localPoly[j].x - localPoly[i].x;
      const dy = localPoly[j].y - localPoly[i].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > maxLen) {
        maxLen = len;
        angle = Math.atan2(dy, dx);
      }
    }

    // Rotate inset polygon so longest edge is horizontal
    const negAngle = -angle;
    const rotatedInset = inset.map((p) => rotate(p, negAngle));

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

    // Place panels in a grid aligned to the longest edge
    for (let x = minX + pw / 2; x <= maxX - pw / 2; x += stepX) {
      for (let y = minY + ph / 2; y <= maxY - ph / 2; y += stepY) {
        const corners: Point[] = [
          { x: x - pw / 2, y: y - ph / 2 },
          { x: x + pw / 2, y: y - ph / 2 },
          { x: x + pw / 2, y: y + ph / 2 },
          { x: x - pw / 2, y: y + ph / 2 },
        ];

        // All corners must be inside the inset polygon
        const allInside = corners.every((c) => isPointInPolygon(c, rotatedInset));
        if (!allInside) continue;

        // Check overlap with exclude areas
        const inExclude = rotatedExcludes.some((exPoly) =>
          exPoly.length >= 3 && (
            corners.some((c) => isPointInPolygon(c, exPoly)) ||
            exPoly.some((ep) => isPointInPolygon(ep, corners))
          ),
        );
        if (inExclude) continue;

        // Rotate back to math coords, then flip Y to canvas coords
        const pixelCorners = corners.map((c) => flipY(rotate(c, angle))) as [Point, Point, Point, Point];

        allPanels.push({
          id: crypto.randomUUID(),
          corners: pixelCorners,
        });
      }
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
  gapCm: number,
  marginCm: number,
  metersPerPixel: number,
): PixelPanel[] {
  // cm → mm 변환 후 mm 버전 호출
  return placePanelsOnCanvas(
    installAreas,
    excludeAreas,
    panelWidthMm,
    panelHeightMm,
    orientation,
    gapCm * 10,
    marginCm * 10,
    metersPerPixel,
  );
}
