"use client";

import { useEffect, useRef, useState } from "react";
import { Map, useMap } from "@vis.gl/react-google-maps";
import { X } from "lucide-react";
import html2canvas from "html2canvas";
import { t } from "../utils/i18n";
import type { Lang } from "../utils/i18n";
import type { CropData } from "../types";

interface MapViewProps {
  center: { lat: number; lng: number };
  viewport?: google.maps.LatLngBounds | null;
  cropMode: boolean;
  locked: boolean;
  onCropComplete: (cropData: CropData) => void;
  /** 크롭모드 취소(X 버튼) — cropMode를 false로 되돌린다 */
  onCropCancel: () => void;
  /** 좌측 사이드바 건물확정 재클릭(2차) 시 증가하는 신호 — 영역이 그려져 있으면 확정 처리 */
  confirmCropSignal: number;
  address: string;
  lang: Lang;
}

const MAP_ID = "solar-pv-map";


/** 중심 좌표 또는 viewport 변경 시 지도 뷰를 조정 (viewport 우선, 없으면 panTo) */
function ViewUpdater({
  center,
  viewport,
}: {
  center: { lat: number; lng: number };
  viewport?: google.maps.LatLngBounds | null;
}) {
  const map = useMap(MAP_ID);
  const isFirst = useRef(true);

  useEffect(() => {
    if (!map) return;
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (viewport) {
      map.fitBounds(viewport);
    } else {
      map.panTo(center);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- center object reference changes on every render; lat/lng are stable
  }, [map, center.lat, center.lng, viewport]);

  return null;
}

/** 휠 줌의 기준점을 커서 위치가 아닌 지도 중심으로 변경 */
function WheelZoomController() {
  const map = useMap(MAP_ID);
  const accumRef = useRef(0);
  const ZOOM_THRESHOLD = 50;

  useEffect(() => {
    if (!map) return;
    const div = map.getDiv();
    if (!div) return;

    const handleWheel = (e: WheelEvent) => {
      // 좌우 스크롤(트랙패드)은 zoom과 무관 — 통과시켜 페이지/자식 스크롤 보호
      if (e.deltaY === 0) return;
      // 자식 인터랙티브 UI 위에서의 휠은 차단하지 않음 (툴바 버튼/입력 등 자체 처리 보호)
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, a, [role="button"]')) return;

      e.preventDefault();
      accumRef.current += e.deltaY;
      if (Math.abs(accumRef.current) >= ZOOM_THRESHOLD) {
        const currentZoom = map.getZoom() ?? 18;
        const direction = accumRef.current > 0 ? -1 : 1;
        map.setZoom(currentZoom + direction);
        accumRef.current = 0;
      }
    };

    div.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      div.removeEventListener("wheel", handleWheel);
    };
  }, [map]);

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
  onCropCancel,
  confirmCropSignal,
  address,
  lang,
}: {
  active: boolean;
  onCropComplete: (cropData: CropData) => void;
  onCropCancel: () => void;
  confirmCropSignal: number;
  address: string;
  lang: Lang;
}) {
  const map = useMap(MAP_ID);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Selection rect: { left, top, width, height } in px
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
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

    // 최종 캔버스 경계 보장
    newRect.left = Math.max(0, newRect.left);
    newRect.top = Math.max(0, newRect.top);
    newRect.width = Math.min(newRect.width, cw - newRect.left);
    newRect.height = Math.min(newRect.height, ch - newRect.top);

    setRect(newRect);
  }

  /** 포인터 해제 시 드래그 종료 처리 */
  function handlePointerUp() {
    dragTargetRef.current = null;
    dragStartRef.current = null;
  }

  /** 포인터 캡처가 강제 해제될 때 드래그 상태를 정리한다 */
  function handlePointerCancel() {
    dragTargetRef.current = null;
    dragStartRef.current = null;
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
      // 타일 경계 흰 줄 회피: DPR 을 그대로 쓰면 분수/저배율 기기에서 타일이 sub-pixel
      // 위치에 놓여 html2canvas 재구성 시 1px 흰 줄이 생긴다. 최소 2 + 정수 올림으로
      // 타일 경계를 정수 픽셀에 정렬해(레티나 기기와 동일 환경) 줄을 억제한다.
      scale: Math.max(2, Math.ceil(window.devicePixelRatio || 1)),
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

  // 좌측 사이드바 건물확정 재클릭(signal) → 그려진 영역이 있으면 확정 처리
  const prevConfirmSignalRef = useRef(confirmCropSignal);
  useEffect(() => {
    if (confirmCropSignal === prevConfirmSignalRef.current) return;
    prevConfirmSignalRef.current = confirmCropSignal;
    if (!active || !rect) return;
    handleConfirm();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handleConfirm은 매 렌더마다 재생성되지만 signal 변경에만 반응
  }, [confirmCropSignal, active, rect]);

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
      onPointerCancel={handlePointerCancel}
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
              border: "2px solid var(--accent-blue)",
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
                  background: "var(--accent-blue)",
                  border: "1px solid white",
                  borderRadius: 2,
                  pointerEvents: "none",
                }}
              />
            );
          })}

        </>
      )}

      {/* 지도 상단 안내문구 + 취소 버튼 — 크롭모드 활성 동안 노출. 확정은 좌측 사이드바 건물확정 재클릭으로 수행. */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 2,
          pointerEvents: "auto",
          whiteSpace: "nowrap",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* 안내문구 박스 */}
        <div
          style={{
            padding: "8px 20px",
            background: "rgba(0, 0, 0, 0.7)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid transparent",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {t("cropAreaSelectGuide", lang)}
        </div>
        {/* 취소 버튼 (X 아이콘 + 라벨) — AI 분석 컨트롤과 동일 디자인 패턴 */}
        <button
          type="button"
          onClick={onCropCancel}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 20px",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
            transition: "all 0.15s ease",
          }}
        >
          <X size={14} />
          <span>{t("cropAreaCancel", lang)}</span>
        </button>
      </div>
    </div>
  );
}

/** 위성 지도 및 크롭 오버레이를 포함하는 메인 지도 컴포넌트 */
export default function MapView({
  center,
  viewport,
  cropMode,
  locked,
  onCropComplete,
  onCropCancel,
  confirmCropSignal,
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
        gestureHandling={locked || cropMode ? "none" : "greedy"}
        scrollwheel={false}
        style={{ width: "100%", height: "100%" }}
      >
        <ViewUpdater center={center} viewport={viewport} />
        {!locked && !cropMode && <WheelZoomController />}
      </Map>


      <CropOverlay
        active={cropMode}
        onCropComplete={onCropComplete}
        onCropCancel={onCropCancel}
        confirmCropSignal={confirmCropSignal}
        address={address}
        lang={lang}
      />

    </div>
  );
}
