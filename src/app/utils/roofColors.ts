/**
 * 지붕면(install 폴리곤) 구분용 색 팔레트.
 *
 * 선정 기준 — 값은 전부 하드코딩이다. 런타임에 계산하지 않는다(색이 매번 달라지면 안 되고, 리뷰 가능해야 한다).
 * 1. hue 를 [78°, 336°] 구간에만 균등 분배한다. 아래 색역은 기존 상태색을 잡아먹으므로 통째로 배제:
 *    - hue 20~60° 고채도·중명도 → 선택 강조 `#FFD700`(gold) · 처마 기준변 `#FF8A00`(orange)
 *    - hue 345~15° 고채도·중명도 → 개구 `#CF2E2E`(red)
 * 2. saturation 64~72% 유지 — 35% 미만 회색계는 위성사진의 회색 지붕·아스팔트에 묻힌다.
 * 3. lightness 를 60 / 45 / 73% 세 단으로 교대 — 25% 미만은 그림자에, 80% 초과는 반사면에 묻힌다.
 * 4. 균등 배치한 hue 를 stride 13 으로 재배열해 **인접 인덱스끼리 색상환에서 약 112° 떨어지게** 했다.
 *    그 결과 인접 인덱스 간 최소 CIELAB ΔE = 56.2, 30색 전체 임의 쌍의 최소 ΔE = 11.9.
 */
export const ROOF_FACE_COLORS: readonly string[] = [
  "#B6E250",
  "#27A6BE",
  "#E68EE4",
  "#50E2A6",
  "#6C27BE",
  "#8EE690",
  "#5061E2",
  "#7BBE27",
  "#8ECBE6",
  "#E250C9",
  "#27BE96",
  "#C38EE6",
  "#50E267",
  "#2B27BE",
  "#B3E68E",
  "#50A0E2",
  "#BE278F",
  "#8EE6DB",
  "#BC50E2",
  "#27BE55",
  "#9D8EE6",
  "#77E250",
  "#2765BE",
  "#E68EBE",
  "#50E0E2",
  "#AD27BE",
  "#8EE6B5",
  "#7D50E2",
  "#3ABE27",
  "#8EA5E6",
];

/** 팔레트에서 파생한 RGB 삼원색 캐시 — fill 문자열을 만들 때마다 hex 를 파싱하지 않기 위함 */
const ROOF_FACE_RGB: readonly (readonly [number, number, number])[] = ROOF_FACE_COLORS.map(
  (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ] as const,
);

/** 음수·소수·팔레트 길이 초과 인덱스를 0..29 로 정규화한다 */
function wrapIndex(index: number): number {
  const len = ROOF_FACE_COLORS.length;
  if (!Number.isFinite(index)) return 0;
  return ((Math.trunc(index) % len) + len) % len;
}

/** 팔레트 색 (index 는 0-based, 30 초과 시 순환) */
export function getRoofFaceColor(index: number): string {
  return ROOF_FACE_COLORS[wrapIndex(index)];
}

/** 같은 색의 반투명 fill — 위성사진 위에서 지붕이 비쳐 보이도록 기본 alpha 0.25 */
export function getRoofFaceFill(index: number, alpha = 0.25): string {
  const [r, g, b] = ROOF_FACE_RGB[wrapIndex(index)];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
