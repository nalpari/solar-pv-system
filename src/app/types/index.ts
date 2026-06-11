export interface LatLng {
  lat: number;
  lng: number;
}

export interface PanelSize {
  label: string;
  width: number; // mm
  height: number; // mm
  watt?: number; // 모듈 출력(W) — QSP wpOut. 설치 용량 계산용
}

export type PanelOrientation = "landscape" | "portrait";

export type DrawingMode = "install" | "exclude" | null;

export interface PolygonArea {
  id: string;
  type: "install" | "exclude";
  paths: LatLng[];
  /** 처마(흐름방향) 기준변 인덱스 - points[i] → points[i+1] */
  eaveEdgeIndex?: number;
}

export interface PlacedPanel {
  id: string;
  /** 이 패널이 배치된 install 폴리곤의 id */
  polygonId: string;
  corners: [LatLng, LatLng, LatLng, LatLng];
}

export interface CropBounds {
  sw: LatLng;
  ne: LatLng;
}

export interface CropData {
  imageDataUrl: string;
  bounds: CropBounds;
  address: string;
  zoom: number;
  sizeMeters: { width: number; height: number };
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface PixelPolygon {
  id: string;
  type: "install" | "exclude";
  points: PixelPoint[];
  /** 처마(흐름방향) 기준변 인덱스 - points[i] → points[i+1] */
  eaveEdgeIndex?: number;
}

export interface PixelPanel {
  id: string;
  /** 이 패널이 배치된 install 폴리곤의 id */
  polygonId: string;
  corners: [PixelPoint, PixelPoint, PixelPoint, PixelPoint];
}

export interface SimulationFormState {
  azimuth: string;
  hasBattery: boolean;
  batteryModel: string;
  monthlyElecCost: string;
}
