"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Download, Undo2 } from "lucide-react";
import type { CropData, CropBounds, DrawingMode, LatLng, PolygonArea, PixelPanel, PixelPolygon, PixelPoint } from "../types";
import type { Lang } from "../utils/i18n";
import { t } from "../utils/i18n";

interface CropPopupProps {
  cropData: CropData;
  drawingMode: DrawingMode;
  onAreasChange: (areas: PolygonArea[]) => void;
  onPixelAreasChange: (areas: PixelPolygon[], metersPerPixel: number) => void;
  placedPanels: PixelPanel[];
  onClose: () => void;
  lang: Lang;
}

interface AreaEntry {
  id: string;
  type: "install" | "exclude";
  points: PixelPoint[];
}

function pixelToLatLng(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  bounds: CropBounds,
): LatLng {
  const lngRange = bounds.ne.lng - bounds.sw.lng;
  const latRange = bounds.ne.lat - bounds.sw.lat;
  return {
    lng: bounds.sw.lng + (x / canvasWidth) * lngRange,
    lat: bounds.ne.lat - (y / canvasHeight) * latRange,
  };
}

function convertAreas(
  entries: AreaEntry[],
  canvasWidth: number,
  canvasHeight: number,
  bounds: CropBounds,
): PolygonArea[] {
  return entries
    .filter((a) => a.points.length >= 3)
    .map((area) => ({
      id: area.id,
      type: area.type,
      paths: area.points.map((pt) =>
        pixelToLatLng(pt.x, pt.y, canvasWidth, canvasHeight, bounds),
      ),
    }));
}

function convertToPixelPolygons(entries: AreaEntry[]): PixelPolygon[] {
  return entries
    .filter((a) => a.points.length >= 3)
    .map((area) => ({
      id: area.id,
      type: area.type,
      points: area.points.map((pt) => ({ x: pt.x, y: pt.y })),
    }));
}

export default function CropPopup({
  cropData,
  drawingMode,
  onAreasChange,
  onPixelAreasChange,
  placedPanels,
  onClose,
  lang,
}: CropPopupProps) {
  const [areas, setAreas] = useState<AreaEntry[]>([]);
  const [currentPoints, setCurrentPoints] = useState<PixelPoint[]>([]);
  const [mousePos, setMousePos] = useState<PixelPoint | null>(null);
  const [canvasLayout, setCanvasLayout] = useState<{
    w: number; h: number; offsetX: number; offsetY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [prevDrawingMode, setPrevDrawingMode] = useState<DrawingMode>(drawingMode);

  // Reset in-progress points when drawing mode changes (render-phase state sync)
  if (prevDrawingMode !== drawingMode) {
    setPrevDrawingMode(drawingMode);
    setCurrentPoints([]);
    setMousePos(null);
  }

  // Calculate the actual rendered area of img with object-fit: contain
  const getRenderedImageRect = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    const containerW = img.clientWidth;
    const containerH = img.clientHeight;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = containerW / containerH;

    let renderW: number, renderH: number, offsetX: number, offsetY: number;
    if (imgRatio > containerRatio) {
      renderW = containerW;
      renderH = containerW / imgRatio;
      offsetX = 0;
      offsetY = (containerH - renderH) / 2;
    } else {
      renderH = containerH;
      renderW = containerH * imgRatio;
      offsetX = (containerW - renderW) / 2;
      offsetY = 0;
    }
    return { renderW, renderH, offsetX, offsetY };
  }, []);

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const rect = getRenderedImageRect();
    if (!canvas || !rect) return;
    const w = Math.round(rect.renderW);
    const h = Math.round(rect.renderH);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    // Update layout state (React controls positioning via style)
    setCanvasLayout({
      w,
      h,
      offsetX: Math.round(rect.offsetX),
      offsetY: Math.round(rect.offsetY),
    });
  }, [getRenderedImageRect]);

  // Sync canvas size on image load and resize
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const handleLoad = () => syncCanvasSize();
    img.addEventListener("load", handleLoad);

    const observer = new ResizeObserver(() => syncCanvasSize());
    observer.observe(img);

    // If image is already loaded, schedule sync outside the synchronous effect body
    if (img.complete) {
      const id = requestAnimationFrame(() => syncCanvasSize());
      return () => {
        cancelAnimationFrame(id);
        img.removeEventListener("load", handleLoad);
        observer.disconnect();
      };
    }

    return () => {
      img.removeEventListener("load", handleLoad);
      observer.disconnect();
    };
  }, [syncCanvasSize]);

  // Compute metersPerPixel from canvas size and real-world dimensions
  const computeMetersPerPixel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return 0;
    const mppX = cropData.sizeMeters.width / canvas.width;
    const mppY = cropData.sizeMeters.height / canvas.height;
    return (mppX + mppY) / 2;
  }, [cropData.sizeMeters]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw completed polygons
    for (const area of areas) {
      if (area.points.length < 3) continue;
      const isInstall = area.type === "install";
      ctx.beginPath();
      ctx.moveTo(area.points[0].x, area.points[0].y);
      for (let i = 1; i < area.points.length; i++) {
        ctx.lineTo(area.points[i].x, area.points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = isInstall
        ? "rgba(6, 147, 227, 0.2)"
        : "rgba(207, 46, 46, 0.3)";
      ctx.fill();
      ctx.strokeStyle = isInstall ? "#0693E3" : "#CF2E2E";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw in-progress polygon
    if (currentPoints.length > 0) {
      const isInstall = drawingMode === "install";
      const strokeColor = isInstall ? "#0693E3" : "#CF2E2E";

      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (let i = 1; i < currentPoints.length; i++) {
        ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dashed line from last point to mouse
      if (mousePos) {
        const last = currentPoints[currentPoints.length - 1];
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Vertex circles
      for (let i = 0; i < currentPoints.length; i++) {
        const pt = currentPoints[i];
        const radius = i === 0 ? 6 : 4;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
        if (i === 0) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // Draw placed panels
    for (const panel of placedPanels) {
      ctx.beginPath();
      ctx.moveTo(panel.corners[0].x, panel.corners[0].y);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(panel.corners[i].x, panel.corners[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(6, 147, 227, 0.5)";
      ctx.strokeStyle = "#0693E3";
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    }
  }, [areas, currentPoints, mousePos, drawingMode, placedPanels]);

  function getCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>): PixelPoint {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drawingMode !== "install" && drawingMode !== "exclude") return;
    e.preventDefault();
    const pt = getCanvasCoords(e);

    // Close polygon: near first point with >= 3 points
    if (currentPoints.length >= 3) {
      const first = currentPoints[0];
      const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
      if (dist <= 10) {
        const newArea: AreaEntry = {
          id: crypto.randomUUID(),
          type: drawingMode,
          points: [...currentPoints],
        };
        const updated = [...areas, newArea];
        setAreas(updated);
        setCurrentPoints([]);
        setMousePos(null);

        // Notify parent
        const canvas = canvasRef.current;
        if (canvas && canvas.width > 0) {
          onAreasChange(convertAreas(updated, canvas.width, canvas.height, cropData.bounds));
          const mpp = computeMetersPerPixel();
          if (mpp > 0) {
            console.log(`[CropPopup] canvas: ${canvas.width}×${canvas.height}px, sizeMeters: ${cropData.sizeMeters.width.toFixed(1)}×${cropData.sizeMeters.height.toFixed(1)}m, mpp: ${mpp.toFixed(6)}`);
            onPixelAreasChange(convertToPixelPolygons(updated), mpp);
          }
        }
        return;
      }
    }

    setCurrentPoints((prev) => [...prev, pt]);
  }

  function handleContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (drawingMode !== "install" && drawingMode !== "exclude") return;
    if (currentPoints.length >= 1) {
      setCurrentPoints((prev) => {
        const next = prev.slice(0, -1);
        if (next.length === 0) setMousePos(null);
        return next;
      });
    }
  }

  function handleUndo() {
    if (currentPoints.length >= 1) {
      setCurrentPoints((prev) => {
        const next = prev.slice(0, -1);
        if (next.length === 0) setMousePos(null);
        return next;
      });
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drawingMode !== "install" && drawingMode !== "exclude") return;
    if (currentPoints.length === 0) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function handleSave() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const saveCanvas = document.createElement("canvas");
    saveCanvas.width = canvas.width;
    saveCanvas.height = canvas.height;
    const ctx = saveCanvas.getContext("2d");
    if (!ctx) return;

    // Draw the image first
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Draw the overlay canvas on top
    ctx.drawImage(canvas, 0, 0);

    // Trigger download with timestamp
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const link = document.createElement("a");
    link.download = `solar-pv-layout_${ts}.png`;
    link.href = saveCanvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      {/* Popup card — 90% of map area */}
      <div
        style={{
          width: "90%",
          height: "90%",
          position: "relative",
          background: "var(--bg-primary)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          pointerEvents: "auto",
        }}
      >
        {/* Top-right buttons: Save + Close */}
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            display: "flex",
            gap: 8,
          }}
        >
          <button
            onClick={handleSave}
            title={t("cropSave", lang)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: "1px solid var(--border-primary)",
              background: "rgba(255, 255, 255, 0.9)",
              color: "var(--text-secondary)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            <Download size={16} />
          </button>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: "1px solid var(--border-primary)",
              background: "rgba(255, 255, 255, 0.9)",
              color: "var(--text-secondary)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Image + Canvas container — fills the popup, image scales to fit */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL from canvas capture */}
          <img
            ref={imgRef}
            src={cropData.imageDataUrl}
            alt=""
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              touchAction: "none",
              cursor:
                drawingMode === "install" || drawingMode === "exclude"
                  ? "crosshair"
                  : "default",
              ...(canvasLayout
                ? {
                    left: canvasLayout.offsetX,
                    top: canvasLayout.offsetY,
                    width: canvasLayout.w,
                    height: canvasLayout.h,
                  }
                : {
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                  }),
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onContextMenu={handleContextMenu}
          />

        </div>

        {/* Floating Undo button — bottom-right of popup card */}
        {(drawingMode === "install" || drawingMode === "exclude") &&
          currentPoints.length > 0 && (
            <button
              onClick={handleUndo}
              title="Undo"
              style={{
                position: "absolute",
                bottom: 16,
                right: 16,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                border: "1px solid var(--border-primary)",
                background: "rgba(255, 255, 255, 0.9)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
              }}
            >
              <Undo2 size={16} />
            </button>
          )}
      </div>
    </div>
  );
}
