// src/app/utils/mergePolygons.ts
// 지붕면(폴리곤) 병합 — bridge-then-union 단일 판정.
// 선택된 면들 중 근접(gap ≤ GAP_TOL)하고 충분히 겹치는(≥ MIN_OVERLAP) 변쌍의 틈을
// "필러 사각형"으로 메운 뒤 union → 결과가 단일 폴리곤(구멍 없음)이면 병합.
// 버튼 활성 판정과 실제 병합이 이 한 함수를 공유하므로 둘이 절대 어긋나지 않는다.
// 단, 면이 area로 크게 포개진 경우(면 이동 중 겹침 등)는 "인접"이 아니므로 사전 배제한다
// — 쌍의 작은 면 대비 OVERLAP_RATIO 초과가 기준이라, 그 이하의 미세 겹침은 인접으로 허용한다.

import polygonClipping from "polygon-clipping";
import type { PixelPoint } from "../types";

/** 이어붙일 수 있는 최대 gap(px). 겹침 구간 양끝에서 잰 두 변 사이 거리가
 *  이 값 이하일 때만 필러로 연결한다(선분까지의 거리 기준 — 끝점 바깥은 그 끝점까지의 거리). */
const GAP_TOL = 3.0;
/** 필러를 만들 최소 겹침 길이(px). gap을 사이에 둔 변쌍이 이 길이 이상 겹쳐야 인접 인정. */
const MIN_OVERLAP = 10.0;
/** 병합 후 톱니(미세 회전으로 생기는 준-공선 정점) 제거 임계(px). */
const SIMPLIFY_EPS = 0.5;
/** 면 포개짐 허용 상한 — 작은 면 대비 이 비율 초과로 area가 겹치면 인접이 아닌 포개짐으로 보고 거부. */
const OVERLAP_RATIO = 0.05;

type Seg = { a: PixelPoint; b: PixelPoint };

function edges(points: PixelPoint[]): Seg[] {
  const segs: Seg[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) segs.push({ a: points[i], b: points[(i + 1) % n] });
  return segs;
}

/** 선분 s 위에서 점 p에 가장 가까운 점(구간 [a,b]로 clamp) */
function closestOnSeg(p: PixelPoint, s: Seg): PixelPoint {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: s.a.x, y: s.a.y };
  let t = ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: s.a.x + t * dx, y: s.a.y + t * dy };
}

/** 점 p에서 선분 s의 무한직선까지 수직거리 (공선/톱니 판정) */
function perpDistToLine(p: PixelPoint, s: Seg): number {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - s.a.x, p.y - s.a.y);
  return Math.abs((p.x - s.a.x) * dy - (p.y - s.a.y) * dx) / len;
}

/** s의 방향축에 점 p를 사영한 스칼라(0=a) */
function projectScalar(p: PixelPoint, s: Seg, len: number): number {
  if (len === 0) return 0;
  return ((p.x - s.a.x) * (s.b.x - s.a.x) + (p.y - s.a.y) * (s.b.y - s.a.y)) / len;
}

function dist(p: PixelPoint, q: PixelPoint): number {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** 폴리곤(PixelPoint[]) 면적 (shoelace) */
function ringArea(pts: PixelPoint[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    s += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(s / 2);
}

/** polygon-clipping 결과(MultiPolygon)의 순 면적 — 구멍은 반대 winding이라 부호로 상쇄된다. */
function multiPolyArea(mp: number[][][][]): number {
  let s = 0;
  for (const poly of mp) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) {
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      }
    }
  }
  return Math.abs(s / 2);
}

/** PixelPoint[] → polygon-clipping Polygon 지오메트리 */
function toGeom(pts: PixelPoint[]): number[][][] {
  return [pts.map((p) => [p.x, p.y] as [number, number])];
}

/** polygon-clipping union 래퍼 (캐스트 보일러플레이트 은닉) */
function unionAll(geoms: number[][][][]): number[][][][] {
  return polygonClipping.union(
    geoms[0] as unknown as Parameters<typeof polygonClipping.union>[0],
    ...(geoms.slice(1) as unknown as Parameters<typeof polygonClipping.union>[1][]),
  );
}

/** 두 폴리곤이 area로 겹치는 교집합 면적 (0=경계만 닿거나 분리) */
function pairOverlapArea(a: PixelPoint[], b: PixelPoint[]): number {
  const inter = polygonClipping.intersection(
    toGeom(a) as unknown as Parameters<typeof polygonClipping.intersection>[0],
    toGeom(b) as unknown as Parameters<typeof polygonClipping.intersection>[1],
  );
  return multiPolyArea(inter);
}

/**
 * 두 변 ea, eb가 근접·겹침이면 그 겹침 구간을 잇는 필러 사각형(4점)을 반환, 아니면 null.
 * - ea 축 기준 겹침 구간 길이 ≥ MIN_OVERLAP
 * - 그 구간 양끝에서 ea↔eb 간격 ≤ GAP_TOL (한쪽만 붙은 회전도 흡수)
 * - 이미 붙어있으면(간격≈0) union이 알아서 병합하므로 필러 불필요(null)
 */
function makeFiller(ea: Seg, eb: Seg): PixelPoint[] | null {
  const lenA = Math.hypot(ea.b.x - ea.a.x, ea.b.y - ea.a.y);
  if (lenA === 0) return null;
  let t0 = projectScalar(eb.a, ea, lenA);
  let t1 = projectScalar(eb.b, ea, lenA);
  if (t0 > t1) [t0, t1] = [t1, t0];
  const lo = Math.max(0, t0);
  const hi = Math.min(lenA, t1);
  if (hi - lo < MIN_OVERLAP) return null;
  const ux = (ea.b.x - ea.a.x) / lenA, uy = (ea.b.y - ea.a.y) / lenA;
  const pALo: PixelPoint = { x: ea.a.x + ux * lo, y: ea.a.y + uy * lo };
  const pAHi: PixelPoint = { x: ea.a.x + ux * hi, y: ea.a.y + uy * hi };
  const pBLo = closestOnSeg(pALo, eb);
  const pBHi = closestOnSeg(pAHi, eb);
  const gLo = dist(pALo, pBLo), gHi = dist(pAHi, pBHi);
  if (gLo > GAP_TOL || gHi > GAP_TOL) return null;
  if (gLo < 0.05 && gHi < 0.05) return null; // 이미 붙음 → 필러 불필요
  return [pALo, pAHi, pBHi, pBLo];
}

/** 앞뒤 점과 거의 일직선(수직편차 < eps)인 정점을 반복 제거 → 톱니 단순화 */
function simplifyRing(ring: PixelPoint[], eps: number): PixelPoint[] {
  const pts = ring.slice();
  while (pts.length > 3) {
    let minDev = Infinity, minIdx = -1;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const dev = perpDistToLine(pts[i], { a: pts[(i - 1 + n) % n], b: pts[(i + 1) % n] });
      if (dev < minDev) { minDev = dev; minIdx = i; }
    }
    if (minDev >= eps) break;
    pts.splice(minIdx, 1);
  }
  return pts;
}

/**
 * 선택 지붕면들을 병합해 단일 외곽 링을 반환. 병합 불가면 null.
 * 버튼 활성 판정(null 여부)과 실제 병합이 이 함수를 공유한다.
 * - 두 면이 area로 포개지면(쌍의 작은 면 대비 OVERLAP_RATIO 초과) 인접이 아니므로 거부.
 * - 근접·겹침 변쌍의 틈을 필러로 메운 뒤 union.
 * - 결과가 단일 폴리곤이 아니면(코너접촉·분리 → 2개) null.
 * - 구멍이 있으면(중정 등) null → 빈 공간을 메우지 않고 병합 거부.
 * - 미세 회전으로 생긴 톱니 정점은 제거.
 */
export function mergeAreaPolygons(polys: PixelPoint[][]): PixelPoint[] | null {
  if (polys.length < 2) return null;

  // 0) 면적이 0인(정점이 모두 공선인) 면 배제 — union이 zero-area 지오메트리를 소거해 버려
  //    "떨어져 있는데도 병합 대상에 포함되어 조용히 삭제"되고, OVERLAP_RATIO * minArea 임계도
  //    0이 되어 포개짐 판정이 무의미해진다.
  if (polys.some((p) => ringArea(p) <= 0)) return null;

  // 1) 면 포개짐 배제 — 어떤 두 면이라도 작은 쪽의 OVERLAP_RATIO 초과로 area가 겹치면
  //    "인접"이 아닌 포개짐(면 이동 중 겹침 등)이므로 병합 거부. 점·변만 공유하는 인접은 겹침 0.
  //    쌍 단위 판정이라 선택 집합에 무관한 작은 면이 섞여도 다른 쌍 판정이 흔들리지 않는다.
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      let overlap: number;
      try {
        overlap = pairOverlapArea(polys[i], polys[j]);
      } catch {
        return null;
      }
      const minArea = Math.min(ringArea(polys[i]), ringArea(polys[j]));
      if (overlap > OVERLAP_RATIO * minArea) return null;
    }
  }

  // 2) 근접·겹침 변쌍마다 틈을 잇는 필러 생성
  const fillers: PixelPoint[][] = [];
  for (let i = 0; i < polys.length; i++) {
    const ei = edges(polys[i]);
    for (let j = i + 1; j < polys.length; j++) {
      const ej = edges(polys[j]);
      for (const ea of ei) {
        for (const eb of ej) {
          const f = makeFiller(ea, eb);
          if (f) fillers.push(f);
        }
      }
    }
  }

  // 3) 원본 + 필러 union
  let result: number[][][][];
  try {
    result = unionAll([...polys, ...fillers].map(toGeom));
  } catch {
    return null;
  }

  // 4) 단일 폴리곤 + 구멍 없음만 유효 (코너접촉·분리→2개, 중정→hole)
  if (!Array.isArray(result) || result.length !== 1) return null;
  if (result[0].length > 1) return null;
  const outer = result[0][0];
  if (!Array.isArray(outer) || outer.length < 4) return null;

  // 5) 닫는 중복점 제거 → 톱니 단순화
  const ring = simplifyRing(
    outer.slice(0, outer.length - 1).map(([x, y]) => ({ x, y })),
    SIMPLIFY_EPS,
  );
  return ring.length >= 3 ? ring : null;
}
