"use client";

import { useEffect, useRef, useState } from "react";
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

/** 지도 줌/위성/재중심 컨트롤 버튼 모음 */
function MapControls({ center, lang }: { center: { lat: number; lng: number }; lang: Lang }) {
  const map = useMap(MAP_ID);

  /** 지도 줌 인 */
  const handleZoomIn = () => map?.setZoom((map.getZoom() || 18) + 1);
  /** 지도 줌 아웃 */
  const handleZoomOut = () => map?.setZoom((map.getZoom() || 18) - 1);
  /** 지도를 지정된 중심 좌표로 재이동 */
  const handleRecenter = () => {
    if (map) map.panTo(center);
  };
  /** 위성/로드맵 지도 타입 토글 */
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

/** 중심 좌표 변경 시 지도를 부드럽게 이동시키는 컴포넌트 */
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

type DragTarget = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null;

const HANDLE_SIZE = 12;

/** 드래그 대상에 따른 마우스 커서 스타일 반환 */
function getCursorForTarget(target: DragTarget): string {
  switch (target) {
    case "n": case "s": return "ns-resize";
    case "e": case "w": return "ew-resize";
    case "ne": case "sw": return "nesw-resize";
    case "nw": case "se": return "nwse-resize";
    case "move": return "move";
    default: return "default";
  }
}

/** 지도 위 크롭 영역 선택 오버레이 */
function CropOverlay({
  active,
  onCropComplete,
  address,
  lang,
}: {
  active: boolean;
  onCropComplete: (cropData: CropData) => void;
  address: string;
  lang: Lang;
}) {
  const map = useMap(MAP_ID);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Selection rect: { left, top, width, height } in px
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const dragTargetRef = useRef<DragTarget>(null);
  const dragStartRef = useRef<{ x: number; y: number; rect: { left: number; top: number; width: number; height: number } } | null>(null);

  // Initialize default rect (50% centered) when overlay activates
  useEffect(() => {
    if (!active) return;
    // Delay to ensure overlayRef is mounted and sized
    const id = requestAnimationFrame(() => {
      const el = overlayRef.current;
      if (!el) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw === 0 || ch === 0) return;
      setContainerSize({ w: cw, h: ch });
      const rw = Math.round(cw * 0.5);
      const rh = Math.round(ch * 0.5);
      setRect({
        left: Math.round((cw - rw) / 2),
        top: Math.round((ch - rh) / 2),
        width: rw,
        height: rh,
      });
    });
    return () => {
      cancelAnimationFrame(id);
      setRect(null);
    };
  }, [active]);

  /** 마우스 좌표가 크롭 영역의 어느 핸들/내부에 해당하는지 판정 */
  function hitTest(x: number, y: number): DragTarget {
    if (!rect) return null;
    const { left: l, top: tp, width: w, height: h } = rect;
    const r = l + w;
    const b = tp + h;
    const hs = HANDLE_SIZE;

    // Corner handles (prioritize over edges)
    if (Math.abs(x - l) <= hs && Math.abs(y - tp) <= hs) return "nw";
    if (Math.abs(x - r) <= hs && Math.abs(y - tp) <= hs) return "ne";
    if (Math.abs(x - l) <= hs && Math.abs(y - b) <= hs) return "sw";
    if (Math.abs(x - r) <= hs && Math.abs(y - b) <= hs) return "se";

    // Edge handles
    if (Math.abs(y - tp) <= hs && x > l + hs && x < r - hs) return "n";
    if (Math.abs(y - b) <= hs && x > l + hs && x < r - hs) return "s";
    if (Math.abs(x - l) <= hs && y > tp + hs && y < b - hs) return "w";
    if (Math.abs(x - r) <= hs && y > tp + hs && y < b - hs) return "e";

    // Inside = move
    if (x > l && x < r && y > tp && y < b) return "move";

    return null;
  }

  /** 포인터 누름 시 드래그 시작 처리 */
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!rect) return;
    const el = overlayRef.current!;
    const elRect = el.getBoundingClientRect();
    const x = e.clientX - elRect.left;
    const y = e.clientY - elRect.top;
    const target = hitTest(x, y);
    if (!target) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    dragTargetRef.current = target;
    dragStartRef.current = { x, y, rect: { ...rect } };
    setIsDragging(true);
  }

  /** 포인터 이동 시 크롭 영역 이동/리사이즈 처리 */
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!rect || !overlayRef.current) return;
    const elRect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - elRect.left;
    const y = e.clientY - elRect.top;

    // Update cursor when not dragging
    if (!dragStartRef.current) {
      const target = hitTest(x, y);
      overlayRef.current.style.cursor = getCursorForTarget(target);
      return;
    }

    e.preventDefault();
    const { x: sx, y: sy, rect: orig } = dragStartRef.current;
    const dx = x - sx;
    const dy = y - sy;
    const target = dragTargetRef.current;
    const cw = overlayRef.current.clientWidth;
    const ch = overlayRef.current.clientHeight;
    const MIN_SIZE = 40;

    const newRect = { ...orig };

    if (target === "move") {
      newRect.left = Math.max(0, Math.min(cw - orig.width, orig.left + dx));
      newRect.top = Math.max(0, Math.min(ch - orig.height, orig.top + dy));
    } else {
      // Resize
      if (target?.includes("w")) {
        const newLeft = Math.max(0, Math.min(orig.left + orig.width - MIN_SIZE, orig.left + dx));
        newRect.width = orig.width + (orig.left - newLeft);
        newRect.left = newLeft;
      }
      if (target?.includes("e")) {
        newRect.width = Math.max(MIN_SIZE, Math.min(cw - orig.left, orig.width + dx));
      }
      if (target?.includes("n")) {
        const newTop = Math.max(0, Math.min(orig.top + orig.height - MIN_SIZE, orig.top + dy));
        newRect.height = orig.height + (orig.top - newTop);
        newRect.top = newTop;
      }
      if (target?.includes("s")) {
        newRect.height = Math.max(MIN_SIZE, Math.min(ch - orig.top, orig.height + dy));
      }
    }

    setRect(newRect);
  }

  /** 포인터 해제 시 드래그 종료 처리 */
  function handlePointerUp() {
    dragTargetRef.current = null;
    dragStartRef.current = null;
    setIsDragging(false);
  }

  /** 크롭 영역 확정 후 이미지 캡처 및 콜백 호출 */
  function handleConfirm() {
    if (!rect || !map || !overlayRef.current) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const containerWidth = overlayRef.current.clientWidth;
    const containerHeight = overlayRef.current.clientHeight;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const { left: minX, top: minY, width: cropW, height: cropH } = rect;
    const maxX = minX + cropW;
    const maxY = minY + cropH;

    const cropSw = {
      lat: ne.lat() - (maxY / containerHeight) * (ne.lat() - sw.lat()),
      lng: sw.lng() + (minX / containerWidth) * (ne.lng() - sw.lng()),
    };
    const cropNe = {
      lat: ne.lat() - (minY / containerHeight) * (ne.lat() - sw.lat()),
      lng: sw.lng() + (maxX / containerWidth) * (ne.lng() - sw.lng()),
    };

    const zoom = map.getZoom() || 19;
    const latDiff = cropNe.lat - cropSw.lat;
    const lngDiff = cropNe.lng - cropSw.lng;
    const avgLat = (cropSw.lat + cropNe.lat) / 2;
    const heightMeters = latDiff * 111320;
    const widthMeters = lngDiff * 111320 * Math.cos((avgLat * Math.PI) / 180);

    const mapContainer = overlayRef.current.parentElement;
    if (!mapContainer) return;

    overlayRef.current.style.display = "none";

    html2canvas(mapContainer, {
      useCORS: true,
      allowTaint: true,
      scale: window.devicePixelRatio || 1,
    })
      .then((fullCanvas) => {
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
        if (overlayRef.current) {
          overlayRef.current.style.display = "";
        }
      });
  }

  if (!active) return null;

  // Build dark overlay with cutout using clip-path
  const clipPath = rect
    ? `polygon(
        0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
        ${rect.left}px ${rect.top}px,
        ${rect.left}px ${rect.top + rect.height}px,
        ${rect.left + rect.width}px ${rect.top + rect.height}px,
        ${rect.left + rect.width}px ${rect.top}px,
        ${rect.left}px ${rect.top}px
      )`
    : undefined;

  return (
    <div
      ref={overlayRef}
      style={{
        position: "absolute",
        inset: 0,
        touchAction: "none",
        zIndex: 20,
        cursor: "default",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Dark overlay with cutout */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          clipPath,
          pointerEvents: "none",
        }}
      />

      {/* Selection border */}
      {rect && (
        <>
          <div
            style={{
              position: "absolute",
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              border: "2px solid #0693E3",
              pointerEvents: "none",
            }}
          />

          {/* Corner handles */}
          {(["nw", "ne", "sw", "se"] as const).map((corner) => {
            const x = corner.includes("w") ? rect.left : rect.left + rect.width;
            const y = corner.includes("n") ? rect.top : rect.top + rect.height;
            return (
              <div
                key={corner}
                style={{
                  position: "absolute",
                  left: x - 5,
                  top: y - 5,
                  width: 10,
                  height: 10,
                  background: "#0693E3",
                  border: "1px solid white",
                  borderRadius: 2,
                  pointerEvents: "none",
                }}
              />
            );
          })}

          {/* Confirm button — hidden while dragging, flips above if no space below */}
          {!isDragging && (() => {
            const btnH = 44;
            const showAbove = rect.top + rect.height + 12 + btnH > containerSize.h;
            return <button
            onClick={handleConfirm}
            style={{
              position: "absolute",
              left: rect.left + rect.width / 2,
              top: showAbove ? rect.top - 12 - btnH : rect.top + rect.height + 12,
              transform: "translateX(-50%)",
              padding: "8px 24px",
              background: "#0693E3",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              zIndex: 1,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {t("cropConfirmArea", lang)}
          </button>;
          })()}
        </>
      )}
    </div>
  );
}

/** 위성 지도 및 크롭 오버레이를 포함하는 메인 지도 컴포넌트 */
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
        lang={lang}
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
