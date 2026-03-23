"use client";

import { useEffect, useRef, useState } from "react";
import { X, Download, Undo2 } from "lucide-react";
import type { CropData, CropBounds, DrawingMode, LatLng, PolygonArea, PixelPanel, PixelPolygon, PixelPoint, PolygonSubMode } from "../types";
import type { Lang } from "../utils/i18n";
import { t } from "../utils/i18n";
import { isPointInPolygon } from "../utils/panelPlacement";

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

function TooltipButton({ label, color, onClick }: { label: string; color?: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        width: "100%",
        padding: "4px 8px",
        border: "none",
        background: hovered ? "var(--border-primary)" : "transparent",
        color: color ?? "var(--text-primary)",
        fontSize: 13,
        textAlign: "left",
        cursor: "pointer",
        borderRadius: 4,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

const HANDLE_RADIUS = 12;
const HANDLE_VISUAL_RADIUS = 6;


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
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [subMode, setSubMode] = useState<PolygonSubMode>("idle");
  const [tooltipPos, setTooltipPos] = useState<PixelPoint | null>(null);

  // Polygon drag-move refs
  const dragStartRef = useRef<PixelPoint | null>(null);
  const dragOriginalPointsRef = useRef<PixelPoint[] | null>(null);

  // Vertex editing
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);

  // Long-press timer for vertex deletion on touch
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce rapid clicks in drawing mode (prevents double-click adding 2 points)
  const lastPointTimeRef = useRef<number>(0);

  const areasRef = useRef<AreaEntry[]>(areas);
  areasRef.current = areas;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset in-progress points when drawing mode changes
  const prevDrawingModeRef = useRef<DrawingMode>(drawingMode);
  useEffect(() => {
    if (prevDrawingModeRef.current !== drawingMode) {
      prevDrawingModeRef.current = drawingMode;
      setCurrentPoints([]);
      setMousePos(null);
      setSelectedPolygonId(null);
      setSubMode("idle");
      setTooltipPos(null);
    }
  }, [drawingMode]);

  // Calculate the actual rendered area of img with object-fit: contain
  function getRenderedImageRect() {
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
  }

  function syncCanvasSize() {
    const canvas = canvasRef.current;
    const rect = getRenderedImageRect();
    if (!canvas || !rect) return;
    const w = Math.round(rect.renderW);
    const h = Math.round(rect.renderH);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    setCanvasLayout({
      w,
      h,
      offsetX: Math.round(rect.offsetX),
      offsetY: Math.round(rect.offsetY),
    });
  }

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
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps -- syncCanvasSize reads refs, stable across renders

  // Compute metersPerPixel from canvas size and real-world dimensions
  function computeMetersPerPixel() {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return 0;
    const mppX = cropData.sizeMeters.width / canvas.width;
    const mppY = cropData.sizeMeters.height / canvas.height;
    return (mppX + mppY) / 2;
  }

  function notifyParent(updatedAreas: AreaEntry[]) {
    const canvas = canvasRef.current;
    if (canvas && canvas.width > 0) {
      onAreasChange(convertAreas(updatedAreas, canvas.width, canvas.height, cropData.bounds));
      const mpp = computeMetersPerPixel();
      if (mpp > 0) {
        onPixelAreasChange(convertToPixelPolygons(updatedAreas), mpp);
      }
    }
  }

  function handleDeletePolygon() {
    if (!selectedPolygonId) return;
    const updated = areas.filter((a) => a.id !== selectedPolygonId);
    setAreas(updated);
    setSelectedPolygonId(null);
    setSubMode("idle");
    setTooltipPos(null);
    notifyParent(updated);
  }

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
      const isSelected = area.id === selectedPolygonId;
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
      ctx.strokeStyle = isSelected ? "#FFD700" : (isInstall ? "#0693E3" : "#CF2E2E");
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.stroke();
    }

    // Draw vertex handles when editing_vertices
    if (subMode === "editing_vertices" && selectedPolygonId) {
      const selArea = areas.find((a) => a.id === selectedPolygonId);
      if (selArea && selArea.points.length >= 3) {
        // Draw edge midpoint handles with + sign
        for (let i = 0; i < selArea.points.length; i++) {
          const p1 = selArea.points[i];
          const p2 = selArea.points[(i + 1) % selArea.points.length];
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          ctx.beginPath();
          ctx.arc(mx, my, HANDLE_VISUAL_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.fill();
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // + sign
          const s = 3;
          ctx.beginPath();
          ctx.moveTo(mx - s, my);
          ctx.lineTo(mx + s, my);
          ctx.moveTo(mx, my - s);
          ctx.lineTo(mx, my + s);
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        // Draw vertex handles (gold)
        for (const pt of selArea.points) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, HANDLE_VISUAL_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = "#FFD700";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
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
  }, [areas, currentPoints, mousePos, drawingMode, placedPanels, selectedPolygonId, subMode]);

  function getCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>): PixelPoint {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    // 우클릭(보조 버튼)은 점 입력으로 처리하지 않음 — contextmenu(Undo)에서 처리
    if (e.button !== 0) return;
    const pt = getCanvasCoords(e);

    // Selection / move / vertex editing mode
    if (drawingMode === null) {
      if (subMode === "idle") {
        // Check if click is inside any polygon (last to first for z-order)
        for (let i = areas.length - 1; i >= 0; i--) {
          if (areas[i].points.length >= 3 && isPointInPolygon(pt, areas[i].points)) {
            setSelectedPolygonId(areas[i].id);
            setSubMode("selected");
            setTooltipPos(pt);
            return;
          }
        }
      } else if (subMode === "selected") {
        // If clicking on the same polygon again, reposition tooltip
        if (selectedPolygonId) {
          const selArea = areas.find((a) => a.id === selectedPolygonId);
          if (selArea && selArea.points.length >= 3 && isPointInPolygon(pt, selArea.points)) {
            setTooltipPos(pt);
            return;
          }
        }
        // Clicking outside dismisses selection
        setSelectedPolygonId(null);
        setSubMode("idle");
        setTooltipPos(null);
      } else if (subMode === "moving") {
        // Start drag if inside selected polygon
        if (selectedPolygonId) {
          const selArea = areas.find((a) => a.id === selectedPolygonId);
          if (selArea && isPointInPolygon(pt, selArea.points)) {
            dragStartRef.current = pt;
            dragOriginalPointsRef.current = selArea.points.map((p) => ({ ...p }));
          } else {
            // Click outside: cancel moving
            dragStartRef.current = null;
            dragOriginalPointsRef.current = null;
            setSelectedPolygonId(null);
            setSubMode("idle");
          }
        }
      } else if (subMode === "editing_vertices") {
        // Check vertex hit, then midpoint hit, then empty space
        if (selectedPolygonId) {
          const selArea = areas.find((a) => a.id === selectedPolygonId);
          if (selArea) {
            // Check vertex handles
            for (let i = 0; i < selArea.points.length; i++) {
              const vp = selArea.points[i];
              if (Math.hypot(pt.x - vp.x, pt.y - vp.y) <= HANDLE_RADIUS) {
                setDraggingVertexIdx(i);
                // Start long-press timer for vertex deletion
                longPressTimerRef.current = setTimeout(() => {
                  longPressTimerRef.current = null;
                  tryDeleteVertex(i);
                  setDraggingVertexIdx(null);
                }, 500);
                return;
              }
            }
            // Check edge midpoint handles
            for (let i = 0; i < selArea.points.length; i++) {
              const p1 = selArea.points[i];
              const p2 = selArea.points[(i + 1) % selArea.points.length];
              const mx = (p1.x + p2.x) / 2;
              const my = (p1.y + p2.y) / 2;
              if (Math.hypot(pt.x - mx, pt.y - my) <= HANDLE_RADIUS) {
                // Insert new point at midpoint, start dragging it
                const insertIdx = i + 1;
                const newPoints = [...selArea.points];
                newPoints.splice(insertIdx, 0, { x: mx, y: my });
                const updated = areas.map((a) =>
                  a.id === selectedPolygonId ? { ...a, points: newPoints } : a,
                );
                setAreas(updated);
                setDraggingVertexIdx(insertIdx);
                return;
              }
            }
            // Empty space: exit editing
            setSelectedPolygonId(null);
            setSubMode("idle");
          }
        }
      }
      return;
    }

    // Drawing mode
    if (drawingMode !== "install" && drawingMode !== "exclude") return;

    // Prevent double-click from adding two points (300ms debounce)
    const now = performance.now();
    if (now - lastPointTimeRef.current < 300) return;
    lastPointTimeRef.current = now;

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
        notifyParent(updated);
        return;
      }
    }

    setCurrentPoints((prev) => [...prev, pt]);
  }

  function undoLastPoint() {
    if (currentPoints.length >= 1) {
      setCurrentPoints((prev) => {
        const next = prev.slice(0, -1);
        if (next.length === 0) setMousePos(null);
        return next;
      });
    }
  }

  function handleContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Polygon drag-move
    if (drawingMode === null && subMode === "moving" && dragStartRef.current && dragOriginalPointsRef.current && selectedPolygonId) {
      const dx = px - dragStartRef.current.x;
      const dy = py - dragStartRef.current.y;
      const newPoints = dragOriginalPointsRef.current.map((p) => ({
        x: p.x + dx,
        y: p.y + dy,
      }));
      setAreas((prev) =>
        prev.map((a) =>
          a.id === selectedPolygonId ? { ...a, points: newPoints } : a,
        ),
      );
      return;
    }

    // Vertex dragging
    if (drawingMode === null && subMode === "editing_vertices" && draggingVertexIdx !== null && selectedPolygonId) {
      // Cancel long-press if dragging
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      setAreas((prev) =>
        prev.map((a) => {
          if (a.id !== selectedPolygonId) return a;
          const newPoints = [...a.points];
          newPoints[draggingVertexIdx] = { x: px, y: py };
          return { ...a, points: newPoints };
        }),
      );
      return;
    }

    // Drawing mode: dashed guide line
    if (drawingMode !== "install" && drawingMode !== "exclude") return;
    if (currentPoints.length === 0) return;
    setMousePos({ x: px, y: py });
  }

  function handlePointerUp() {
    // Always clear long-press timer on pointer up
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // End polygon drag-move
    if (subMode === "moving" && dragStartRef.current) {
      dragStartRef.current = null;
      dragOriginalPointsRef.current = null;
      notifyParent(areasRef.current);
      setSelectedPolygonId(null);
      setSubMode("idle");
      return;
    }
    // End vertex drag
    if (subMode === "editing_vertices" && draggingVertexIdx !== null) {
      setDraggingVertexIdx(null);
      notifyParent(areasRef.current);
      return;
    }
  }

  // Delete vertex (or entire polygon if <= 3 points)
  function tryDeleteVertex(vertexIdx: number) {
    if (!selectedPolygonId) return;
    const selArea = areas.find((a) => a.id === selectedPolygonId);
    if (!selArea) return;
    let updated: AreaEntry[];
    if (selArea.points.length <= 3) {
      // Delete entire polygon
      updated = areas.filter((a) => a.id !== selectedPolygonId);
      setSelectedPolygonId(null);
      setSubMode("idle");
    } else {
      const newPoints = selArea.points.filter((_, i) => i !== vertexIdx);
      updated = areas.map((a) =>
        a.id === selectedPolygonId ? { ...a, points: newPoints } : a,
      );
    }
    setAreas(updated);
    notifyParent(updated);
  }

  function handleDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (subMode !== "editing_vertices" || !selectedPolygonId) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const selArea = areas.find((a) => a.id === selectedPolygonId);
    if (!selArea) return;
    for (let i = 0; i < selArea.points.length; i++) {
      const vp = selArea.points[i];
      if (Math.hypot(px - vp.x, py - vp.y) <= HANDLE_RADIUS) {
        tryDeleteVertex(i);
        return;
      }
    }
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
                  : subMode === "moving"
                    ? "grabbing"
                    : subMode === "editing_vertices"
                      ? "pointer"
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
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
          />

        </div>

        {/* Polygon selection tooltip */}
        {subMode === "selected" && tooltipPos && (
          <div
            style={{
              position: "absolute",
              left: (canvasLayout?.offsetX ?? 0) + tooltipPos.x + 8,
              top: (canvasLayout?.offsetY ?? 0) + tooltipPos.y - 8,
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              background: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
              padding: 4,
              minWidth: 80,
            }}
          >
            <TooltipButton label={t("polygonMove", lang)} onClick={() => { setSubMode("moving"); setTooltipPos(null); }} />
            <TooltipButton label={t("polygonDelete", lang)} color="#CF2E2E" onClick={handleDeletePolygon} />
            <TooltipButton label={t("polygonEditVertices", lang)} onClick={() => { setSubMode("editing_vertices"); setTooltipPos(null); }} />
          </div>
        )}

        {/* Floating Undo button — bottom-right of popup card */}
        {(drawingMode === "install" || drawingMode === "exclude") &&
          currentPoints.length > 0 && (
            <button
              onClick={undoLastPoint}
              aria-label={t("undoLastPoint", lang)}
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
