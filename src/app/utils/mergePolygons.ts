// src/app/utils/mergePolygons.ts
// 지붕면(폴리곤) 병합 관련 순수 기하 함수.
// - sharesEdge: 두 폴리곤이 "변을 공유"하는지 (같은 직선상에서 일정 길이 이상 겹침, 코너 접촉은 제외)
// - canMergeGroup: 여러 폴리곤이 변 공유로 하나로 연결되는지 (병합 버튼 활성 판정)
// - mergeAreaPolygons: polygon-clipping union → 단일 외곽 링 반환 (병합 실행)

import polygonClipping from "polygon-clipping";
import type { PixelPoint } from "../types";

/** 변 공유 판정 허용 오차 (px). AI는 정확 공유, 수동은 스냅(10px) 근사이므로 여유를 둔다. */
const COLLINEAR_TOL = 2.0; // 점이 이 거리 안에 있으면 선분 위(공선)로 간주
const MIN_OVERLAP = 4.0; // 겹치는 구간 길이가 이 값 이상이어야 "변 공유"로 인정 (코너 접촉 배제)

type Seg = { a: PixelPoint; b: PixelPoint };

function edges(points: PixelPoint[]): Seg[] {
  const segs: Seg[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    segs.push({ a: points[i], b: points[(i + 1) % n] });
  }
  return segs;
}

/** 점 p에서 선분 s까지의 거리 */
function distPointToSeg(p: PixelPoint, s: Seg): number {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - s.a.x, p.y - s.a.y);
  let t = ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (s.a.x + t * dx), p.y - (s.a.y + t * dy));
}

/** 점 p를 선분 s의 방향축에 사영한 스칼라(0=a, |ab|=b) */
function projectScalar(p: PixelPoint, s: Seg, segLen: number): number {
  if (segLen === 0) return 0;
  const dx = (s.b.x - s.a.x) / segLen;
  const dy = (s.b.y - s.a.y) / segLen;
  return (p.x - s.a.x) * dx + (p.y - s.a.y) * dy;
}

/**
 * 두 폴리곤이 변을 공유하는지 — 어떤 변 쌍이 (거의) 같은 직선 위에서 MIN_OVERLAP 이상 겹치면 true.
 * 단순히 한 꼭짓점만 닿는(코너 접촉) 경우는 겹침 길이가 0에 가까워 배제된다.
 */
export function sharesEdge(polyA: PixelPoint[], polyB: PixelPoint[]): boolean {
  const edgesA = edges(polyA);
  const edgesB = edges(polyB);
  for (const ea of edgesA) {
    const lenA = Math.hypot(ea.b.x - ea.a.x, ea.b.y - ea.a.y);
    if (lenA === 0) continue;
    for (const eb of edgesB) {
      // eb의 양 끝점이 ea 직선 위(공선)에 있는지
      if (distPointToSeg(eb.a, ea) > COLLINEAR_TOL) continue;
      if (distPointToSeg(eb.b, ea) > COLLINEAR_TOL) continue;
      // ea 축 기준 [0, lenA]와 eb의 사영 구간 [t0,t1]의 1D 겹침 길이
      let t0 = projectScalar(eb.a, ea, lenA);
      let t1 = projectScalar(eb.b, ea, lenA);
      if (t0 > t1) [t0, t1] = [t1, t0];
      const overlap = Math.min(t1, lenA) - Math.max(t0, 0);
      if (overlap >= MIN_OVERLAP) return true;
    }
  }
  return false;
}

/**
 * 폴리곤 그룹이 변 공유로 하나로 연결되는지 (BFS). 2개면 서로 변 공유, 3개 이상이면
 * 전체가 하나의 연결 요소를 이뤄야 한다. 떨어진 폴리곤이 섞이면 false.
 */
export function canMergeGroup(polys: PixelPoint[][]): boolean {
  const n = polys.length;
  if (n < 2) return false;

  // 인접 그래프
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (sharesEdge(polys[i], polys[j])) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  // BFS로 0번에서 도달 가능한 노드 수 == n 이면 전부 연결됨
  const visited = new Array<boolean>(n).fill(false);
  const queue = [0];
  visited[0] = true;
  let count = 1;
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj[cur]) {
      if (!visited[nb]) {
        visited[nb] = true;
        count++;
        queue.push(nb);
      }
    }
  }
  return count === n;
}

/**
 * 여러 지붕면 폴리곤을 union으로 병합해 단일 외곽 링을 반환.
 * - 결과가 단일 폴리곤이 아니면(떨어진 조각) null → 호출자가 병합 거부.
 * - 구멍(hole)은 무시하고 외곽 링만 사용 (지붕면 병합에서는 사실상 발생 안 함).
 * - polygon-clipping 링은 닫혀 있으므로(마지막=처음) 마지막 점을 제거해 open ring으로 반환.
 */
export function mergeAreaPolygons(polys: PixelPoint[][]): PixelPoint[] | null {
  if (polys.length < 2) return null;

  // polygon-clipping 입력: MultiPolygon 각 = [ [outerRing], [hole...] ], ring = [ [x,y], ... ]
  const geoms = polys.map((pts) => [pts.map((p) => [p.x, p.y] as [number, number])]);

  let result: number[][][][];
  try {
    result = polygonClipping.union(
      geoms[0] as unknown as Parameters<typeof polygonClipping.union>[0],
      ...(geoms.slice(1) as unknown as Parameters<typeof polygonClipping.union>[1][]),
    );
  } catch {
    return null;
  }

  // 단일 폴리곤(연결됨)만 유효
  if (!Array.isArray(result) || result.length !== 1) return null;
  const outer = result[0]?.[0];
  if (!Array.isArray(outer) || outer.length < 4) return null; // 닫힌 링이라 최소 4점(삼각형+닫힘)

  // 닫는 중복점 제거 후 PixelPoint[] 변환
  const ring = outer.slice(0, outer.length - 1).map(([x, y]) => ({ x, y }));
  return ring.length >= 3 ? ring : null;
}
