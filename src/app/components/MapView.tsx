"use client";

import { useEffect, useRef } from "react";
import { Map, useMap } from "@vis.gl/react-google-maps";
import { Crosshair, ZoomIn, ZoomOut, Layers, Maximize2 } from "lucide-react";
import { t } from "../utils/i18n";
import type { Lang } from "../utils/i18n";
import type { DrawingMode, PolygonArea, PlacedPanel, LatLng } from "../types";

interface MapViewProps {
  center: { lat: number; lng: number };
  drawingMode: DrawingMode;
  areas: PolygonArea[];
  placedPanels: PlacedPanel[];
  onAreaComplete: (area: PolygonArea) => void;
  onAreasChange: (areas: PolygonArea[]) => void;
  lang: Lang;
}

const MAP_ID = "solar-pv-map";

function MapControls({ center, lang }: { center: { lat: number; lng: number }; lang: Lang }) {
  const map = useMap(MAP_ID);

  const handleZoomIn = () => map?.setZoom((map.getZoom() || 18) + 1);
  const handleZoomOut = () => map?.setZoom((map.getZoom() || 18) - 1);
  const handleRecenter = () => {
    if (map) map.panTo(center);
  };
  const handleSatellite = () => {
    const current = map?.getMapTypeId();
    map?.setMapTypeId(current === "satellite" ? "roadmap" : "satellite");
  };

  const btnStyle = {
    width: 36,
    height: 36,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    background: "rgba(255, 255, 255, 0.9)",
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-secondary)",
    cursor: "pointer" as const,
    transition: "all 0.15s ease",
    backdropFilter: "blur(8px)",
  };

  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        top: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        zIndex: 10,
      }}
    >
      <button onClick={handleZoomIn} style={btnStyle} aria-label={t("zoomIn", lang)}>
        <ZoomIn size={16} />
      </button>
      <button onClick={handleZoomOut} style={btnStyle} aria-label={t("zoomOut", lang)}>
        <ZoomOut size={16} />
      </button>
      <button onClick={handleSatellite} style={btnStyle} aria-label={t("toggleSatellite", lang)}>
        <Layers size={16} />
      </button>
      <button onClick={handleRecenter} style={btnStyle} aria-label={t("recenterMap", lang)}>
        <Maximize2 size={16} />
      </button>
    </div>
  );
}

function CenterUpdater({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap(MAP_ID);
  const isFirst = useRef(true);

  useEffect(() => {
    if (!map) return;
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    map.panTo(center);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- center object reference changes on every render; lat/lng are stable
  }, [map, center.lat, center.lng]);

  return null;
}

function DrawingOverlay({
  drawingMode,
  areas,
  onAreaComplete,
  onAreasChange,
}: {
  drawingMode: DrawingMode;
  areas: PolygonArea[];
  onAreaComplete: (area: PolygonArea) => void;
  onAreasChange: (areas: PolygonArea[]) => void;
}) {
  const map = useMap(MAP_ID);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const polygonsRef = useRef<Map<string, google.maps.Polygon>>(new globalThis.Map());

  const areasRef = useRef(areas);
  useEffect(() => {
    areasRef.current = areas;
  }, [areas]);

  // Stable key: only changes when areas are added or removed, not when paths change from editing
  const areaIds = areas.map((a) => a.id).join(",");

  // Render polygons — only recreate when area set changes (add/remove), not on path edits
  useEffect(() => {
    if (!map) return;

    // Clear old polygons and their listeners
    polygonsRef.current.forEach((poly) => {
      google.maps.event.clearInstanceListeners(poly);
      poly.setMap(null);
    });
    polygonsRef.current.clear();

    areasRef.current.forEach((area) => {
      const polygon = new google.maps.Polygon({
        paths: area.paths,
        strokeColor: area.type === "install" ? "#0693E3" : "#CF2E2E",
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: area.type === "install" ? "#0693E3" : "#CF2E2E",
        fillOpacity: area.type === "install" ? 0.2 : 0.3,
        editable: true,
        draggable: true,
        map,
      });

      // Track path changes — use ref to avoid stale closure over areas
      const updatePaths = () => {
        const path = polygon.getPath();
        const newPaths: LatLng[] = [];
        for (let i = 0; i < path.getLength(); i++) {
          const point = path.getAt(i);
          newPaths.push({ lat: point.lat(), lng: point.lng() });
        }
        const updated = areasRef.current.map((a) =>
          a.id === area.id ? { ...a, paths: newPaths } : a
        );
        onAreasChange(updated);
      };

      google.maps.event.addListener(polygon.getPath(), "set_at", updatePaths);
      google.maps.event.addListener(polygon.getPath(), "insert_at", updatePaths);
      google.maps.event.addListener(polygon.getPath(), "remove_at", updatePaths);
      google.maps.event.addListener(polygon, "dragend", updatePaths);

      polygonsRef.current.set(area.id, polygon);
    });

    const currentPolygons = polygonsRef.current;
    return () => {
      currentPolygons.forEach((poly) => {
        google.maps.event.clearInstanceListeners(poly);
        poly.setMap(null);
      });
      currentPolygons.clear();
    };
  }, [map, areaIds, onAreasChange]);

  // Drawing manager
  useEffect(() => {
    if (!map) return;

    if (drawingManagerRef.current) {
      drawingManagerRef.current.setMap(null);
      drawingManagerRef.current = null;
    }

    if (!drawingMode) return;

    const color = drawingMode === "install" ? "#0693E3" : "#CF2E2E";

    const dm = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: {
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: drawingMode === "install" ? 0.2 : 0.3,
        editable: true,
        draggable: true,
      },
    });

    dm.setMap(map);
    drawingManagerRef.current = dm;

    google.maps.event.addListener(dm, "polygoncomplete", (polygon: google.maps.Polygon) => {
      const path = polygon.getPath();
      const paths: LatLng[] = [];
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        paths.push({ lat: point.lat(), lng: point.lng() });
      }

      // Remove the drawn polygon (we manage our own)
      polygon.setMap(null);

      onAreaComplete({
        id: crypto.randomUUID(),
        type: drawingMode,
        paths,
      });
    });

    return () => {
      dm.setMap(null);
    };
  }, [map, drawingMode, onAreaComplete]);

  return null;
}

function PanelOverlay({ panels }: { panels: PlacedPanel[] }) {
  const map = useMap(MAP_ID);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clear previous panels
    polygonsRef.current.forEach((p) => p.setMap(null));
    polygonsRef.current = [];

    panels.forEach((panel) => {
      const polygon = new google.maps.Polygon({
        paths: panel.corners,
        strokeColor: "#0693E3",
        strokeOpacity: 0.9,
        strokeWeight: 1,
        fillColor: "#0693E3",
        fillOpacity: 0.5,
        clickable: false,
        map,
      });
      polygonsRef.current.push(polygon);
    });

    return () => {
      polygonsRef.current.forEach((p) => p.setMap(null));
      polygonsRef.current = [];
    };
  }, [map, panels]);

  return null;
}

export default function MapView({
  center,
  drawingMode,
  areas,
  placedPanels,
  onAreaComplete,
  onAreasChange,
  lang,
}: MapViewProps) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Map
        id={MAP_ID}
        defaultCenter={center}
        defaultZoom={19}
        mapTypeId="satellite"
        tilt={0}
        disableDefaultUI
        gestureHandling="greedy"
        style={{ width: "100%", height: "100%" }}
      >
        <CenterUpdater center={center} />
        <DrawingOverlay
          drawingMode={drawingMode}
          areas={areas}
          onAreaComplete={onAreaComplete}
          onAreasChange={onAreasChange}
        />
        <PanelOverlay panels={placedPanels} />
      </Map>

      <MapControls center={center} lang={lang} />

      {/* Drawing mode indicator */}
      {drawingMode && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: drawingMode === "install" ? "rgba(6, 147, 227, 0.9)" : "rgba(207, 46, 46, 0.9)",
            borderRadius: 20,
            color: "white",
            fontSize: 13,
            fontWeight: 500,
            zIndex: 10,
            backdropFilter: "blur(8px)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <Crosshair size={14} />
          {drawingMode === "install"
            ? t("drawInstall", lang)
            : t("drawExclude", lang)}
        </div>
      )}

      {/* Coordinates display */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          padding: "6px 10px",
          background: "rgba(255, 255, 255, 0.9)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-primary)",
          color: "var(--text-tertiary)",
          fontSize: 11,
          fontFamily: "var(--font-geist-mono)",
          backdropFilter: "blur(8px)",
          zIndex: 10,
        }}
      >
        {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
      </div>
    </div>
  );
}
