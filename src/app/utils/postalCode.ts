// 주소 구성요소 배열에서 우편번호(postal_code)를 추출 — Places getDetails / Geocoder 공통.
export function extractPostalCode(
  components?: google.maps.GeocoderAddressComponent[],
): string {
  return (
    components?.find((c) => c.types.includes("postal_code"))?.long_name ?? ""
  );
}
