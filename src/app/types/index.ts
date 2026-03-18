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
}

export interface PlacedPanel {
  id: string;
  corners: LatLng[];
}
