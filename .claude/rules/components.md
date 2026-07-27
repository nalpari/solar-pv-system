---
globs:
  - "src/app/components/**/*.tsx"
  - "src/app/page.tsx"
---

# Components & Page Structure

이 영역의 지식은 **`docs/okf/` 번들이 진실의 원천**이다. 여기 요약을 복제하지 않는다.

| 무엇을 알고 싶은가 | 읽을 문서 |
|---------------------|-----------|
| `page.tsx` 상태 소유·시그널 패턴·레이스 가드 | `docs/okf/modules/page-orchestrator.md` |
| `CropPopup` 부모와의 프로토콜·색 상수·편집 잠금 | `docs/okf/modules/crop-popup.md` |
| `MapView` 크롭 캡처·2단 클릭·실패 폴백 | `docs/okf/modules/map-view.md` |
| 사용자 흐름과 각 단계 게이트·초기화 전파 | `docs/okf/workflows/design-flow.md` |
| 시뮬레이션 제출 3단계와 파라미터 매핑 | `docs/okf/workflows/simulation-flow.md` |
| 도메인 타입(`PolygonArea` / `PixelPolygon` 등) | `docs/okf/domain/roof-face.md`, `src/app/types/index.ts` |

이 파일들을 수정했다면 `pnpm okf:check` 로 영향받는 문서를 확인한다.
