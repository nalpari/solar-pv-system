// src/app/utils/mergePolygons.ts
// 지붕면(폴리곤) 병합 — bridge-then-union 단일 판정.
// 선택된 면들 중 근접(gap ≤ GAP_TOL)하고 충분히 겹치는(≥ MIN_OVERLAP) 변쌍의 틈을
// "필러 사각형"으로 메운 뒤 union → 결과가 단일 폴리곤(구멍 없음)이면 병합.
// 버튼 활성 판정과 실제 병합이 이 한 함수를 공유하므로 둘이 절대 어긋나지 않는다.

import polygonClipping from "polygon-clipping";
import type { PixelPoint } from "../types";

/** 이어붙일 수 있는 최대 gap(px). 두 변의 수직 간격이 이 값 이하일 때만 필러로 연결. */
const GAP_TOL = 3.0;
/** 필러를 만들 최소 겹침 길이(px). gap을 사이에 둔 변쌍이 이 길이 이상 겹쳐야 인접 인정. */
const MIN_OVERLAP = 10.0;
/** 병합 후 톱니(미세 회전으로 생기는 준-공선 정점) 제거 임계(px). */
const SIMPLIFY_EPS = 0.5;

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
 * - 근접·겹침 변쌍의 틈을 필러로 메운 뒤 union.
 * - 결과가 단일 폴리곤이 아니면(코너접촉·분리 → 2개) null.
 * - 구멍이 있으면(중정 등) null → 빈 공간을 메우지 않고 병합 거부.
 * - 미세 회전으로 생긴 톱니 정점은 제거.
 */
export function mergeAreaPolygons(polys: PixelPoint[][]): PixelPoint[] | null {
  if (polys.length < 2) return null;

  // 1) 근접·겹침 변쌍마다 틈을 잇는 필러 생성
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

  // 2) 원본 + 필러 union
  const toGeom = (pts: PixelPoint[]) => [pts.map((p) => [p.x, p.y] as [number, number])];
  const geoms = [...polys, ...fillers].map(toGeom);
  let result: number[][][][];
  try {
    result = polygonClipping.union(
      geoms[0] as unknown as Parameters<typeof polygonClipping.union>[0],
      ...(geoms.slice(1) as unknown as Parameters<typeof polygonClipping.union>[1][]),
    );
  } catch {
    return null;
  }

  // 3) 단일 폴리곤 + 구멍 없음만 유효 (코너접촉·분리→2개, 중정→hole)
  if (!Array.isArray(result) || result.length !== 1) return null;
  if (result[0].length > 1) return null;
  const outer = result[0][0];
  if (!Array.isArray(outer) || outer.length < 4) return null;

  // 4) 닫는 중복점 제거 → 톱니 단순화
  const ring = simplifyRing(
    outer.slice(0, outer.length - 1).map(([x, y]) => ({ x, y })),
    SIMPLIFY_EPS,
  );
  return ring.length >= 3 ? ring : null;
}
