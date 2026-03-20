# 지붕 크롭 & 폴리곤 에디터 디자인

## 개요

기존 "지도 위에서 직접 폴리곤 그리기" 방식을 **크롭 → 팝업 폴리곤 에디터** 단계별 워크플로우로 전환한다.

## 워크플로우

```
주소 검색 → 지도 탐색 → 크롭 모드 ON → 사각형 영역 드래그
→ 크롭 이미지 팝업 (CSS scale 확대) → 폴리곤 그리기 (설치/제외)
→ 확인 → 패널 배치
```

## 변경 범위

| 기존 | 변경 |
|------|------|
| DrawingToolbar: Install/Exclude 모드 토글 | **크롭 모드 토글** 버튼으로 교체 |
| MapView: Drawing Manager로 지도 위 폴리곤 | **크롭 영역 선택 기능** 추가, 폴리곤 그리기 제거 |
| 없음 | **CropPopup** 신규 — 크롭 이미지 + Canvas 폴리곤 에디터 |

## 크롭 단계 (지도 위)

- 사이드바 크롭 모드 버튼 ON → 지도 위 드래그로 사각형 영역 선택
- 마우스 드래그 / 터치 드래그 동일 동작 (모드 버튼으로 지도 패닝과 구분)
- 크롭 완료 시 저장하는 메타데이터:
  - bounds (SW/NE 위경도)
  - 주소 정보
  - 줌 레벨
  - 실제 크기 (미터 단위)

## 크롭 이미지 획득

- **Canvas 캡처** (지도 타일 재사용, 추가 API 비용 없음)
- CORS 문제 시 **Static API fallback** 고려
- 크롭 영역을 팝업 크기에 맞게 CSS scale 확대
- 화질은 구현 후 테스트하며 판단

## 팝업 (CropPopup)

- 지도 영역 위에 오버레이로 표시
- 좌측 사이드바는 유지
- **이미지 비율 유지**, 팝업 크기가 따라감 (화면 대비 상한선 설정)
- 이미지 고정 (줌/패닝 없음)
- 팝업 내 도구:
  - 설치 영역 폴리곤 그리기
  - 제외 영역 폴리곤 그리기
  - 확인/닫기
- **Canvas 기반** 폴리곤 에디터 (가볍고 클릭+터치 동시 지원)
- 픽셀 좌표 ↔ 위경도 변환 (크롭 bounds 기반 비례 계산)

## 데이터 흐름

```typescript
// page.tsx에 추가되는 state
cropMode: boolean              // 크롭 모드 ON/OFF
cropData: {                    // 크롭 결과
  imageDataUrl: string         // 캡처된 이미지 (data URL 또는 blob URL)
  bounds: {                    // 크롭 영역의 위경도 범위
    sw: { lat: number; lng: number }
    ne: { lat: number; lng: number }
  }
  address: string              // 검색된 주소
  zoom: number                 // 크롭 시점의 줌 레벨
  sizeMeters: {                // 실제 크기 (미터)
    width: number
    height: number
  }
} | null
areas: PolygonArea[]           // 기존 유지 — 팝업에서 생성
```

## i18n

기존 `src/app/utils/i18n.ts`의 커스텀 `t()` 함수 패턴을 따라 새 UI 텍스트 추가 (ja/en).

## 터치 지원

- 크롭 모드 버튼으로 지도 패닝/크롭 드래그 구분 (PC/터치 동일)
- Canvas 폴리곤 에디터에서 pointer events 사용 (mouse + touch 통합)

## 향후 확장

- 폴리곤 영역 수정 기능 (별도 상세화 예정)
- 화질 개선 필요 시 Static API 전환 검토
