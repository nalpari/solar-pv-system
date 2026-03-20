"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Map, useMap } from "@vis.gl/react-google-maps";
import html2canvas from "html2canvas";
import { ZoomIn, ZoomOut, Layers, Maximize2 } from "lucide-react";
import { t } from "../utils/i18n";
import type { Lang } from "../utils/i18n";
import type { CropData } from "../types";

interface MapViewProps {
  center: { lat: number; lng: number };
  cropMode: boolean;
  locked: boolean;
  onCropComplete: (cropData: CropData) => void;
  address: string;
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

function CropOverlay({
  active,
  onCropComplete,
  address,
}: {
  active: boolean;
  onCropComplete: (cropData: CropData) => void;
  address: string;
}) {
  const map = useMap(MAP_ID);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    setDragging(true);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPos({ x, y });
  }, [dragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragging || !startPos || !currentPos || !map || !overlayRef.current) {
      setDragging(false);
      setStartPos(null);
      setCurrentPos(null);
      return;
    }

    const dx = Math.abs(currentPos.x - startPos.x);
    const dy = Math.abs(currentPos.y - startPos.y);

    // Ignore drags smaller than 20px
    if (dx < 20 || dy < 20) {
      setDragging(false);
      setStartPos(null);
      setCurrentPos(null);
      return;
    }

    const bounds = map.getBounds();
    if (!bounds) {
      setDragging(false);
      setStartPos(null);
      setCurrentPos(null);
      return;
    }

    const containerWidth = overlayRef.current.clientWidth;
    const containerHeight = overlayRef.current.clientHeight;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const minX = Math.min(startPos.x, currentPos.x);
    const maxX = Math.max(startPos.x, currentPos.x);
    const minY = Math.min(startPos.y, currentPos.y);
    const maxY = Math.max(startPos.y, currentPos.y);

    // Interpolate pixel position to lat/lng
    // X maps to lng, Y maps to lat (top = north, bottom = south)
    const cropSw = {
      lat: ne.lat() - (maxY / containerHeight) * (ne.lat() - sw.lat()),
      lng: sw.lng() + (minX / containerWidth) * (ne.lng() - sw.lng()),
    };
    const cropNe = {
      lat: ne.lat() - (minY / containerHeight) * (ne.lat() - sw.lat()),
      lng: sw.lng() + (maxX / containerWidth) * (ne.lng() - sw.lng()),
    };

    const zoom = map.getZoom() || 19;

    // Calculate real-world size in meters
    const latDiff = cropNe.lat - cropSw.lat;
    const lngDiff = cropNe.lng - cropSw.lng;
    const avgLat = (cropSw.lat + cropNe.lat) / 2;
    const heightMeters = latDiff * 111320;
    const widthMeters = lngDiff * 111320 * Math.cos((avgLat * Math.PI) / 180);

    const cropW = Math.round(maxX - minX);
    const cropH = Math.round(maxY - minY);

    // Capture the map DOM using html2canvas, then crop the selected region
    const mapContainer = overlayRef.current.parentElement;
    if (!mapContainer) {
      setDragging(false);
      setStartPos(null);
      setCurrentPos(null);
      return;
    }

    // Hide the crop overlay during capture
    overlayRef.current.style.display = "none";

    html2canvas(mapContainer, {
      useCORS: true,
      allowTaint: true,
      scale: window.devicePixelRatio || 1,
    })
      .then((fullCanvas) => {
        // Crop the selected region from the full capture
        const scale = fullCanvas.width / containerWidth;
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = Math.round(cropW * scale);
        croppedCanvas.height = Math.round(cropH * scale);
        const ctx = croppedCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(
            fullCanvas,
            Math.round(minX * scale),
            Math.round(minY * scale),
            Math.round(cropW * scale),
            Math.round(cropH * scale),
            0,
            0,
            croppedCanvas.width,
            croppedCanvas.height,
          );
        }
        return croppedCanvas.toDataURL("image/png");
      })
      .catch(() => {
        // Fallback: gray canvas with coordinates text
        const fallback = document.createElement("canvas");
        fallback.width = cropW;
        fallback.height = cropH;
        const ctx = fallback.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#6B7280";
          ctx.fillRect(0, 0, cropW, cropH);
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "14px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Satellite Image", cropW / 2, cropH / 2 - 10);
          ctx.font = "11px sans-serif";
          ctx.fillText(
            `${cropSw.lat.toFixed(6)}, ${cropSw.lng.toFixed(6)}`,
            cropW / 2,
            cropH / 2 + 10,
          );
        }
        return fallback.toDataURL("image/png");
      })
      .then((imageDataUrl) => {
        onCropComplete({
          imageDataUrl,
          bounds: { sw: cropSw, ne: cropNe },
          address,
          zoom,
          sizeMeters: { width: widthMeters, height: heightMeters },
        });
      })
      .finally(() => {
        // Always restore overlay visibility
        if (overlayRef.current) {
          overlayRef.current.style.display = "";
        }
      });

    setDragging(false);
    setStartPos(null);
    setCurrentPos(null);
  }, [dragging, startPos, currentPos, map, address, onCropComplete]);

  if (!active) return null;

  // Calculate selection rectangle
  const selectionRect = startPos && currentPos && dragging
    ? {
        left: Math.min(startPos.x, currentPos.x),
        top: Math.min(startPos.y, currentPos.y),
        width: Math.abs(currentPos.x - startPos.x),
        height: Math.abs(currentPos.y - startPos.y),
      }
    : null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: "absolute",
        inset: 0,
        cursor: "crosshair",
        touchAction: "none",
        zIndex: 20,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {selectionRect && (
        <div
          style={{
            position: "absolute",
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
            background: "rgba(6, 147, 227, 0.2)",
            border: "2px solid #0693E3",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

export default function MapView({
  center,
  cropMode,
  locked,
  onCropComplete,
  address,
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
        gestureHandling={locked ? "none" : "greedy"}
        style={{ width: "100%", height: "100%" }}
      >
        <CenterUpdater center={center} />
      </Map>

      <MapControls center={center} lang={lang} />

      <CropOverlay
        active={cropMode}
        onCropComplete={onCropComplete}
        address={address}
      />

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
