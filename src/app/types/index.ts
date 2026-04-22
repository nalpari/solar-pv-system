export interface LatLng {
  lat: number;
  lng: number;
}

export interface PanelSize {
  label: string;
  width: number; // mm
  height: number; // mm
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
  corners: [PixelPoint, PixelPoint, PixelPoint, PixelPoint];
}

export type PolygonSubMode = "idle" | "selected" | "moving" | "editing_vertices";
