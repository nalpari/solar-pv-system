---
type: Workflow
title: Design Flow
description: 주소 검색 → 건물 크롭 → 지붕면 편집 → 경사·모듈 선택 → 배치 → 편집 잠금. 앱의 주 흐름과 각 단계의 게이트.
resource: src/app/page.tsx
tags: [workflow, ux]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
verified: { by: claude-code/opus-5, at: 2026-07-31T00:00:00Z }
status: stable
sources:
  - id: page
    resource: src/app/page.tsx
    title: 상태 전이 소유
  - id: lnb-design
    resource: src/app/components/lnb/lnb-design.tsx
    title: 디자인 탭 UI
  - id: readme
    resource: README.md
    title: 사용자향 사용법
    last_modified: 2026-07-23
---

# 단계

```
① 주소 검색        Places autocomplete → center/viewport 이동
   (기본 위치: 마운트 시 geolocation 1회 시도, 거부되면 도쿄 마루노우치)
② 건물 확정        "건물확정" 1차 클릭 → 크롭모드 / 드래그로 영역 지정 / 2차 클릭 → 확정
                   html2canvas 캡처 → CropData → 크롭 팝업 오픈, 지도 잠금
③ 지붕면 작성      AI 자동 감지(수동 트리거) 또는 직접 그리기
                   drawRoof / drawOpening / flowSetting / mergeSelected / editRoof / undo / delete
④ 경사 선택        1·3·4·6·8寸 중 하나 (필수)
⑤ 모듈 선택        QSP 모듈 마스터에서 선택 (필수)
⑥ 배치             정렬(aligned) 또는 치도리(staggered)
⑦ 배치 완료        편집 잠금 → 시뮬레이션 탭 활성
```

# 게이트

**배치 버튼(`canPlace`)** 은 세 조건이 모두 참일 때만 켜진다:

```ts
slope !== null && panelSize !== null && (크롭 있음 ? install 픽셀 폴리곤 ≥ 1 : installAreas ≥ 1)
```

`handlePlacePanels` 는 UI 비활성화에 더해 함수 진입부에서도 `slope === null || !panelSize` 를 다시 막는다.

**배치 완료(`isPlacementDone`)** 는 토글이다. 켜면 지붕 편집·경사·모듈·배치가 전부 비활성화되고
`CropPopup` 이 `editLocked` 로 들어가 캔버스 조작을 차단한다. 진입 시 도구를 `select` 로 되돌리고
미완성 그리기·선택 잔상을 정리한다.

# 초기화가 전파되는 규칙

| 트리거 | 지워지는 것 | 남는 것 |
|--------|-------------|---------|
| install 면이 0개가 됨 | 경사·모듈·moduleId | 폴리곤(exclude), 크롭 |
| 툴바 "전체 삭제" | 폴리곤·모듈·경사·모듈선택·도구 | **크롭은 유지** |
| 크롭 팝업 닫기 | 위 전부 + 배치잠금 + 시뮬 폼 + 탭 → design | 주소·center |
| AI 재분석 승인 | `handleDeleteAll` + 경사·모듈·배치잠금 | 크롭 |
| 모듈 변경 | 배치된 모듈 전부 (선택 여부 무관) | 폴리곤 |
| 처마 기준선 변경 | **그 폴리곤 위 모듈만** | 다른 면의 배치 |

"exclude(장애물)만 남은 상태"는 install 0개로 센다 — 경사·모듈이 초기화된다.

# 선택의 의미

지붕면을 선택하고 배치·삭제하면 **선택된 면에만** 적용되고, 선택이 없으면 전체가 대상이다.
배치와 삭제가 같은 규칙을 따르도록 맞춰져 있다.

# 관련

- 크롭 캡처의 실패 폴백(회색 플레이스홀더)이 조용하다는 점: [`modules/map-view.md`](/modules/map-view.md)
- AI 감지의 수동 트리거·취소·재분석 확인: [`modules/ai-roof-detection.md`](/modules/ai-roof-detection.md)
- 배치 규칙과 상수: [`domain/module-layout-rules.md`](/domain/module-layout-rules.md)
