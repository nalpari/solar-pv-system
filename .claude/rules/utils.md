---
globs:
  - "src/app/utils/**/*.ts"
---

# Core Logic & Utilities

이 영역의 지식은 **`docs/okf/` 번들이 진실의 원천**이다. 여기 요약을 복제하지 않는다.

| 무엇을 알고 싶은가 | 읽을 문서 |
|---------------------|-----------|
| `panelPlacement.ts` 알고리즘·헬퍼·함정 | `docs/okf/modules/panel-placement.md` |
| `mergePolygons.ts` 판정 순서·상수 | `docs/okf/modules/merge-polygons.md` |
| 좌표계 3종 / mm·cm·m 단위 / **Y축 반전** | `docs/okf/domain/coordinate-systems.md` |
| 배치 규칙·간격 상수·최대 충진 스캔 | `docs/okf/domain/module-layout-rules.md` |
| 처마 기준변(`eaveEdgeIndex`)이 결정하는 것 | `docs/okf/domain/eave-reference-edge.md` |
| 경사(寸) cos 보정과 度 변환 테이블 | `docs/okf/domain/roof-slope-sun.md` |

이 파일들을 수정했다면 `pnpm okf:check` 로 영향받는 문서를 확인한다.
