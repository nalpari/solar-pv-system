"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Lnb } from "./components/lnb/lnb";
import type { SimulationFormState } from "./components/SimulationPanel";
import RoofEditToolbar from "./components/RoofEditToolbar";
import type { RoofTool } from "./components/RoofEditToolbar";
import MapView from "./components/MapView";
import { placePanels, placePanelsOnCanvasCm } from "./utils/panelPlacement";
import { t } from "./utils/i18n";
import type { Lang } from "./utils/i18n";
import CropPopup from "./components/CropPopup";
import AiDetectControls from "./components/AiDetectControls";
import { detectRoofs } from "./utils/aiDetect";
import type { NormalizedPolygon } from "./utils/aiDetect";
import type {
  PanelSize,
  PanelOrientation,
  DrawingMode,
  CropData,
  PolygonArea,
  PlacedPanel,
  PixelPanel,
  PixelPolygon,
} from "./types";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const DEFAULT_CENTER = { lat: 35.6850697, lng: 139.7619073 }; // 〒100-0005 東京都千代田区丸の内1-1-1

type SidebarTab = "design" | "simulation";

const GAP_CM = 0.3; // 모듈 간격 3mm
const MARGIN_CM = 30; // 외곽 여백 300mm

export default function Home() {
  const [lang, setLang] = useState<Lang>("ja");
  const [activeTab, setActiveTab] = useState<SidebarTab>("design");
  const [slope, setSlope] = useState(4); // 4寸 default
  const [roofEditTool, setRoofEditTool] = useState<RoofTool>("select");
  const [simForm, setSimForm] = useState<SimulationFormState>({
    azimuth: "",
    hasBattery: true,
    batteryModel: "q-ready-7.7",
    monthlyElecCost: "",
  });

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // AI 지붕 감지 상태 (Phase 7: 수동 트리거 + 상태 머신)
  // 실패는 alert으로만 표시 (D10/H-2: 배너 제거) → detectError state 불필요
  const [detectStatus, setDetectStatus] = useState<"idle" | "detecting">("idle");
  const [aiSeedAreas, setAiSeedAreas] = useState<NormalizedPolygon[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // detect useEffect 의존성에서 lang 제거 (I-5: 사용자 토글 시 재호출 방지)
  // 단 catch 시점의 메시지는 latest lang으로 보여야 하므로 ref로 read
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [viewport, setViewport] = useState<google.maps.LatLngBounds | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [cropData, setCropData] = useState<CropData | null>(null);
  const [address, setAddress] = useState("");
  // drawingMode는 roofEditTool에서 파생 (drawRoof → install, drawOpening → exclude, 그 외 → null)
  const [undoSignal, setUndoSignal] = useState(0);
  const [clearSignal, setClearSignal] = useState(0);
  const [areas, setAreas] = useState<PolygonArea[]>([]);
  const [panelSize, setPanelSize] = useState<PanelSize>({
    // Default matches first option in Lnb design's MODULE_PRESETS catalog
    // (placeholder until module-loading API is wired).
    label: "Re-RIZE-G3 440",
    width: 991,
    height: 1722,
  });
  const [orientation, setOrientation] = useState<PanelOrientation>("portrait");
  const [placedPanelsList, setPlacedPanelsList] = useState<PlacedPanel[]>([]);
  const [pixelAreas, setPixelAreas] = useState<{ areas: PixelPolygon[]; metersPerPixel: number } | null>(null);
  const [placedPixelPanels, setPlacedPixelPanels] = useState<PixelPanel[]>([]);
  const [placementError, setPlacementError] = useState<string | null>(null);

  const installAreas = areas.filter((a) => a.type === "install");
  const excludeAreas = areas.filter((a) => a.type === "exclude");

  // RoofEditToolbar의 활성 툴에서 CropPopup의 drawingMode를 파생
  const drawingMode: DrawingMode =
    roofEditTool === "drawRoof"
      ? "install"
      : roofEditTool === "drawOpening"
        ? "exclude"
        : null;

  function handlePlaceSelect(location: {
    lat: number;
    lng: number;
    address: string;
    viewport?: google.maps.LatLngBounds;
  }) {
    setCenter({ lat: location.lat, lng: location.lng });
    setAddress(location.address);
    setViewport(location.viewport ?? null);
  }

  const handleCropComplete = useCallback((data: CropData) => {
    setCropData(data);
    setCropMode(false);
    // 크롭 영역 센터를 지도 중심으로 이동 (다음 작업 시점 갱신)
    setCenter({
      lat: (data.bounds.sw.lat + data.bounds.ne.lat) / 2,
      lng: (data.bounds.sw.lng + data.bounds.ne.lng) / 2,
    });
  }, []);

  // 크롭 변경 시 AI 분석 상태 reset (Phase 7: 자동 트리거 제거, 사용자 핸들러로 분리)
  useEffect(() => {
    if (!cropData) {
      setAiSeedAreas([]);
      setDetectStatus("idle");
      return;
    }
    // 새 cropData 진입 = idle 상태로 시작 (분석은 사용자 "AI 분석 시작" 클릭으로)
    setDetectStatus("idle");
    setAiSeedAreas([]);
    return () => {
      // F-1 유지: cropData 교체 시 진행 중 fetch + 이전 폴리곤/패널 정리
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setAreas([]);
      setPixelAreas(null);
      setPlacedPixelPanels([]);
      setPlacedPanelsList([]);
    };
  }, [cropData]);

  // areas의 latest snapshot (M-1: handleStartDetect deps에서 areas.length 제거)
  const areasRef = useRef(areas);
  useEffect(() => {
    areasRef.current = areas;
  }, [areas]);

  // AI 분석 시작 핸들러 (Phase 7: 수동 트리거)
  const handleStartDetect = useCallback(async () => {
    if (!cropData) return;

    // D8/Mi-7: 이미 지붕면이 있으면 재분석 확인 + handleDeleteAll 재사용으로 일괄 초기화
    if (areasRef.current.length > 0) {
      const ok = window.confirm(t("aiDetectConfirmReanalyze", langRef.current));
      if (!ok) return;
      handleDeleteAll();
      setAiSeedAreas([]);
    }

    // 이전 진행 중 요청 정리
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setDetectStatus("detecting");

    try {
      const response = await detectRoofs(cropData, controller.signal);
      if (controller.signal.aborted) return;
      // H-1: 새 controller가 시작됐다면 stale 응답 무시 (race 가드)
      if (abortControllerRef.current !== controller) return;
      setAiSeedAreas(response.polygons.map((p) => p.points));
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === "AbortError") return;
      // D10/H-2: 실패 alert만 (배너 제거 — 기획서 명시 문구)
      window.alert(t("aiDetectFailedAlert", langRef.current));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (!controller.signal.aborted) {
        setDetectStatus("idle");
      }
    }
  }, [cropData]);

  // AI 분석 취소 핸들러 (Phase 7: 사용자 취소 버튼)
  const handleCancelDetect = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setDetectStatus("idle");
  }, []);

  const handleAreasChange = useCallback((newAreas: PolygonArea[]) => {
    const validIds = new Set(newAreas.map((a) => a.id));
    setAreas(newAreas);
    // 없어진 폴리곤에 속한 패널만 제거 (살아있는 폴리곤 패널은 유지)
    setPlacedPanelsList((prev) => prev.filter((p) => validIds.has(p.polygonId)));
  }, []);

  const handlePixelAreasChange = useCallback((areas: PixelPolygon[], metersPerPixel: number) => {
    const validIds = new Set(areas.map((a) => a.id));
    setPixelAreas({ areas, metersPerPixel });
    // 없어진 폴리곤에 속한 패널만 제거
    setPlacedPixelPanels((prev) => prev.filter((p) => validIds.has(p.polygonId)));
  }, []);

  const handleCropClose = useCallback(() => {
    setCropData(null);
    setRoofEditTool("select");
    setAreas([]);
    setPixelAreas(null);
    setPlacedPixelPanels([]);
    setPlacedPanelsList([]);
    // AI 감지 state는 cropData가 null 되면 detect useEffect가 자동 정리함 (I-4: DRY)
  }, []);

  /** 지붕편집 툴바의 "전체 삭제" 액션 - 그려진 폴리곤/패널만 초기화 (cropData 유지) */
  function handleDeleteAll() {
    setAreas([]);
    setPlacedPanelsList([]);
    setPixelAreas(null);
    setPlacedPixelPanels([]);
    setRoofEditTool("select");
    // CropPopup 내부 areas state도 함께 비우도록 신호
    setClearSignal((n) => n + 1);
  }

  function handleDeleteAllPanels() {
    setPlacedPanelsList([]);
    setPlacedPixelPanels([]);
  }

  /** 특정 폴리곤의 처마 기준선이 변경되면 해당 폴리곤 위 패널만 삭제 */
  const handleEaveChange = useCallback((polygonId: string) => {
    setPlacedPanelsList((prev) => prev.filter((p) => p.polygonId !== polygonId));
    setPlacedPixelPanels((prev) => prev.filter((p) => p.polygonId !== polygonId));
  }, []);

  function switchToSimulation() {
    setCropMode(false);
    setRoofEditTool("select");
    setActiveTab("simulation");
  }

  function handlePlacePanels() {
    setPlacementError(null);
    const orientations: PanelOrientation[] = ["portrait", "landscape"];

    if (pixelAreas) {
      try {
        const { areas: pxAreas, metersPerPixel } = pixelAreas;
        const installPx = pxAreas.filter((a) => a.type === "install");
        const excludePx = pxAreas.filter((a) => a.type === "exclude");

        let bestPanels: PixelPanel[] = [];
        let bestOrientation: PanelOrientation = orientation;

        for (const ori of orientations) {
          const panels = placePanelsOnCanvasCm(
            installPx, excludePx,
            panelSize.width, panelSize.height,
            ori, GAP_CM, MARGIN_CM, metersPerPixel,
          );
          if (panels.length > bestPanels.length) {
            bestPanels = panels;
            bestOrientation = ori;
          }
        }

        setOrientation(bestOrientation);
        setPlacedPixelPanels(bestPanels);
      } catch (e) {
        console.error("Panel placement failed:", e);
        setPlacementError(t("panelPlacementFailed", lang));
      }
    } else {
      try {
        let bestPanels: PlacedPanel[] = [];
        let bestOrientation: PanelOrientation = orientation;

        for (const ori of orientations) {
          const panels = placePanels(
            installAreas, excludeAreas,
            panelSize, ori,
            GAP_CM * 10, MARGIN_CM * 10,
          );
          if (panels.length > bestPanels.length) {
            bestPanels = panels;
            bestOrientation = ori;
          }
        }

        setOrientation(bestOrientation);
        setPlacedPanelsList(bestPanels);
      } catch (e) {
        console.error("Panel placement failed:", e);
        setPlacementError(t("panelPlacementFailed", lang));
      }
    }
  }

  const canPlace = cropData !== null
    ? pixelAreas !== null && pixelAreas.areas.some((a) => a.type === "install")
    : installAreas.length > 0;

  const panelCount = placedPixelPanels.length || placedPanelsList.length;

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      libraries={["places", "geometry"]}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100dvh",
          overflow: "hidden",
        }}
      >
        {/* Left Sidebar — pv-pub design */}
        <Lnb
          tab={activeTab}
          onTabChange={setActiveTab}
          lang={lang}
          onLangToggle={() => setLang(lang === "ja" ? "en" : "ja")}
          design={{
            onPlaceSelect: handlePlaceSelect,
            cropMode,
            onCropModeToggle: () => setCropMode(!cropMode),
            slope,
            onSlopeChange: setSlope,
            panelSize,
            onPanelSizeChange: setPanelSize,
            orientation,
            panelCount,
            canPlace,
            placementError,
            onPlacePanels: handlePlacePanels,
            onDeleteAllPanels: handleDeleteAllPanels,
            detectStatus,
            onPlacementDone: switchToSimulation,
            onSwitchToSimulation: switchToSimulation,
          }}
          sim={{
            formState: simForm,
            onFormChange: setSimForm,
            onGoBack: () => setActiveTab("design"),
            onSubmit: () => {
              // TODO: 시뮬레이션 결과 조회 API 호출
              console.log("Simulation submit:", simForm);
            },
          }}
        />

        {/* Map Area */}
        <main style={{ flex: 1, position: "relative" }}>
          {GOOGLE_MAPS_API_KEY ? (
            <MapView
              center={center}
              viewport={viewport}
              cropMode={cropMode}
              locked={cropData !== null}
              onCropComplete={handleCropComplete}
              address={address}
              lang={lang}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-primary)",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 480,
                  padding: 32,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-tertiary)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 8,
                  }}
                >
                  {t("apiKeyRequired", lang)}
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    marginBottom: 20,
                  }}
                >
                  {t("apiKeyDescription", lang)}
                </p>
                <code
                  style={{
                    display: "block",
                    padding: "12px 16px",
                    background: "var(--bg-surface)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-primary)",
                    fontSize: 13,
                    fontFamily: "var(--font-geist-mono)",
                    color: "var(--accent-blue-hover)",
                    textAlign: "left",
                    overflowX: "auto",
                  }}
                >
                  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
                </code>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    marginTop: 12,
                  }}
                >
                  {t("requiredApis", lang)}
                </p>
              </div>
            </div>
          )}
          {cropData && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 100,
                pointerEvents: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <RoofEditToolbar
                lang={lang}
                activeTool={roofEditTool}
                onToolChange={setRoofEditTool}
                onAction={(action) => {
                  if (action === "undo") {
                    setUndoSignal((n) => n + 1);
                  } else if (action === "deleteAll") {
                    handleDeleteAll();
                  }
                }}
                onClose={() => setRoofEditTool("select")}
              />
              <CropPopup
                cropData={cropData}
                drawingMode={drawingMode}
                onAreasChange={handleAreasChange}
                onPixelAreasChange={handlePixelAreasChange}
                placedPanels={placedPixelPanels}
                onClose={handleCropClose}
                lang={lang}
                roofEditTool={roofEditTool}
                onEaveChange={handleEaveChange}
                undoSignal={undoSignal}
                clearSignal={clearSignal}
                initialAreas={aiSeedAreas}
                detectStatus={detectStatus}
              />
              {/* AI 분석 트리거 — 팝업 박스 외부 하단 (RoofEditToolbar 와 대칭) */}
              <AiDetectControls
                detectStatus={detectStatus}
                onStartDetect={handleStartDetect}
                onCancelDetect={handleCancelDetect}
                lang={lang}
              />
            </div>
          )}
        </main>
      </div>
    </APIProvider>
  );
}
