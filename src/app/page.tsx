"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Globe, Sun, BarChart3, Crop, ChevronDown, ArrowRight } from "lucide-react";
import Header from "./components/Header";
import AddressSearch from "./components/AddressSearch";
import PanelConfig from "./components/PanelConfig";
import ResultsPanel from "./components/ResultsPanel";
import SimulationPanel from "./components/SimulationPanel";
import type { SimulationFormState } from "./components/SimulationPanel";
import RoofEditToolbar from "./components/RoofEditToolbar";
import type { RoofTool } from "./components/RoofEditToolbar";
import MapView from "./components/MapView";
import { placePanels, placePanelsOnCanvasCm } from "./utils/panelPlacement";
import { t } from "./utils/i18n";
import type { Lang } from "./utils/i18n";
import CropPopup from "./components/CropPopup";
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

const DEFAULT_CENTER = { lat: 47.6062, lng: -122.3321 }; // Seattle

type SidebarTab = "design" | "simulation";

// 경사 options: 0.5 ~ 10, step 0.5
const SLOPE_OPTIONS = Array.from({ length: 20 }, (_, i) => (i + 1) * 0.5);

const GAP_CM = 0.3; // 모듈 간격 3mm
const MARGIN_CM = 30; // 외곽 여백 300mm

/** Section header bar component */
function SectionHeader({ title, primary }: { title: string; primary?: boolean }) {
  return (
    <div
      style={{
        padding: "10px 16px",
        background: primary ? "var(--accent-blue)" : "var(--bg-surface)",
        borderTop: primary ? "none" : "1px solid var(--border-primary)",
        borderBottom: primary ? "none" : "1px solid var(--border-primary)",
        fontSize: 13,
        fontWeight: 600,
        color: primary ? "#fff" : "var(--text-primary)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {title}
    </div>
  );
}

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
  const [detectStatus, setDetectStatus] = useState<"idle" | "detecting">("idle");
  const [detectError, setDetectError] = useState<string | null>(null);
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
    label: "Custom",
    width: 991,
    height: 1650,
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
  }, []);

  // 크롭 변경 시 AI 분석 상태 reset (Phase 7: 자동 트리거 제거, 사용자 핸들러로 분리)
  useEffect(() => {
    if (!cropData) {
      setAiSeedAreas([]);
      setDetectStatus("idle");
      setDetectError(null);
      return;
    }
    // 새 cropData 진입 = idle 상태로 시작 (분석은 사용자 "AI 분석 시작" 클릭으로)
    setDetectStatus("idle");
    setDetectError(null);
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

  // AI 분석 시작 핸들러 (Phase 7: 수동 트리거)
  const handleStartDetect = useCallback(async () => {
    if (!cropData) return;

    // D8: 이미 지붕면이 있으면 재분석 확인 + 초기화
    if (areas.length > 0) {
      const ok = window.confirm(t("aiDetectConfirmReanalyze", langRef.current));
      if (!ok) return;
      setAreas([]);
      setPixelAreas(null);
      setPlacedPixelPanels([]);
      setPlacedPanelsList([]);
      setAiSeedAreas([]);
      // CropPopup 내부 areas state도 비우는 신호 (handleDeleteAll과 동일 패턴)
      setClearSignal((n) => n + 1);
    }

    // 이전 진행 중 요청 정리
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setDetectStatus("detecting");
    setDetectError(null);

    try {
      const response = await detectRoofs(cropData, controller.signal);
      if (controller.signal.aborted) return;
      setAiSeedAreas(response.polygons.map((p) => p.points));
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === "AbortError") return;
      // D10: 실패 alert (기획서 명시 문구)
      window.alert(t("aiDetectFailedAlert", langRef.current));
      setDetectError(e instanceof Error ? e.message : t("aiDetectFailed", langRef.current));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (!controller.signal.aborted) {
        setDetectStatus("idle");
      }
    }
  }, [cropData, areas.length]);

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
          {/* Left Sidebar */}
          <aside
            style={{
              width: 320,
              flexShrink: 0,
              background: "var(--bg-secondary)",
              borderRight: "1px solid var(--border-primary)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Header />
            {/* Tab Navigation */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--border-primary)",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setActiveTab("design")}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "14px 8px 10px",
                  border: "none",
                  borderBottom: activeTab === "design"
                    ? "2px solid var(--accent-blue)"
                    : "2px solid transparent",
                  background: activeTab === "design"
                    ? "var(--bg-primary)"
                    : "var(--bg-secondary)",
                  color: activeTab === "design"
                    ? "var(--accent-blue)"
                    : "var(--text-tertiary)",
                  fontSize: 11,
                  fontWeight: activeTab === "design" ? 600 : 400,
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: activeTab === "design"
                      ? "var(--accent-blue)"
                      : "var(--bg-surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Sun
                    size={20}
                    color={activeTab === "design" ? "#fff" : "var(--text-tertiary)"}
                  />
                </div>
                {t("tabSolarDesign", lang)}
              </button>

              <button
                onClick={() => switchToSimulation()}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "14px 8px 10px",
                  border: "none",
                  borderBottom: activeTab === "simulation"
                    ? "2px solid var(--accent-blue)"
                    : "2px solid transparent",
                  background: activeTab === "simulation"
                    ? "var(--bg-primary)"
                    : "var(--bg-secondary)",
                  color: activeTab === "simulation"
                    ? "var(--accent-blue)"
                    : "var(--text-tertiary)",
                  fontSize: 11,
                  fontWeight: activeTab === "simulation" ? 600 : 400,
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: activeTab === "simulation"
                      ? "var(--accent-blue)"
                      : "var(--bg-surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  <BarChart3
                    size={20}
                    color={activeTab === "simulation" ? "#fff" : "var(--text-tertiary)"}
                  />
                </div>
                {t("tabSimulationInput", lang)}
              </button>
            </div>

            {/* Scrollable Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {activeTab === "design" ? (
                <>
                  {/* Section: 주소 검색 */}
                  <SectionHeader title={t("searchAddress", lang)} primary />

                  {/* Address Search */}
                  <div style={{ padding: "16px 16px 12px" }}>
                    <AddressSearch onPlaceSelect={handlePlaceSelect} lang={lang} />
                  </div>

                  {/* Confirm Building Button */}
                  <div style={{ padding: "0 16px 12px" }}>
                    <button
                      onClick={() => setCropMode(!cropMode)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        width: "100%",
                        padding: "10px 16px",
                        borderRadius: "var(--radius-md)",
                        border: cropMode
                          ? "1px solid var(--accent-blue)"
                          : "1px solid var(--border-primary)",
                        background: cropMode
                          ? "var(--accent-blue)"
                          : "var(--bg-surface)",
                        color: cropMode ? "#fff" : "var(--text-primary)",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                      onMouseEnter={(e) => {
                        if (!cropMode) {
                          e.currentTarget.style.background = "var(--bg-surface-hover)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!cropMode) {
                          e.currentTarget.style.background = "var(--bg-surface)";
                        }
                      }}
                    >
                      <Crop size={15} />
                      {t("confirmBuilding", lang)}
                    </button>
                  </div>

                  {/* Guide Text */}
                  <div
                    style={{
                      padding: "0 16px 12px",
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      lineHeight: 1.6,
                    }}
                  >
                    {cropMode
                      ? t("cropModeActive", lang)
                      : t("confirmBuildingGuide", lang)}
                  </div>

                  {/* Section: 지붕 편집 */}
                  <SectionHeader title={t("sectionRoofEdit", lang)} primary />

                  {/* Slope Settings */}
                  <div style={{ padding: "12px 16px" }}>
                    <label
                      htmlFor="slope-select"
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        marginBottom: 6,
                      }}
                    >
                      {t("slopeSettings", lang)}
                    </label>
                    <div style={{ position: "relative" }}>
                      <select
                        id="slope-select"
                        value={slope}
                        onChange={(e) => setSlope(Number(e.target.value))}
                        disabled={detectStatus === "detecting"}
                        style={{
                          width: "100%",
                          height: 36,
                          fontSize: 13,
                          appearance: "none",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border-primary)",
                          borderRadius: "var(--radius-md)",
                          color: "var(--text-primary)",
                          padding: "0 32px 0 12px",
                        }}
                      >
                        {SLOPE_OPTIONS.map((val) => (
                          <option key={val} value={val}>
                            {val}{t("slopeUnit", lang)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        color="var(--text-tertiary)"
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  </div>

                  {/* Roof image */}
                  <div style={{ padding: "0 16px 12px" }}>
                    <img
                      src="/roof_one_line.png"
                      alt="roof"
                      style={{
                        width: "100%",
                        borderRadius: "var(--radius-md)",
                        display: "block",
                      }}
                    />
                  </div>

                  {/* Section: 모듈 배치 */}
                  <SectionHeader title={t("sectionModulePlacement", lang)} primary />

                  {/* Panel Config (Module selection) */}
                  <PanelConfig
                    panelSize={panelSize}
                    onPanelSizeChange={setPanelSize}
                    lang={lang}
                    disabled={detectStatus === "detecting"}
                  />

                  {/* Results Panel (Action buttons + Capacity) */}
                  <ResultsPanel
                    panelCount={panelCount}
                    panelSize={panelSize}
                    orientation={orientation}
                    canPlace={canPlace}
                    placementError={placementError}
                    onPlacePanels={handlePlacePanels}
                    onDeleteAllPanels={handleDeleteAllPanels}
                    lang={lang}
                    disabled={detectStatus === "detecting"}
                  />
                </>
              ) : (
                /* Simulation Tab */
                <SimulationPanel
                  lang={lang}
                  formState={simForm}
                  onFormChange={setSimForm}
                  onGoBack={() => setActiveTab("design")}
                  onSubmit={() => {
                    // TODO: 시뮬레이션 결과 조회 API 호출
                    console.log("Simulation submit:", simForm);
                  }}
                />
              )}
            </div>

            {/* Bottom CTA Button */}
            {activeTab === "design" && (
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid var(--border-primary)",
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => switchToSimulation()}
                  disabled={detectStatus === "detecting"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    background: "var(--accent-orange)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    opacity: detectStatus === "detecting" ? 0.5 : 1,
                    cursor: detectStatus === "detecting" ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (detectStatus !== "detecting") {
                      e.currentTarget.style.background = "var(--accent-orange-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (detectStatus !== "detecting") {
                      e.currentTarget.style.background = "var(--accent-orange)";
                    }
                  }}
                >
                  {t("simulationCalcInput", lang)}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* Sidebar footer */}
            <div
              style={{
                padding: "8px 16px",
                borderTop: "1px solid var(--border-primary)",
                fontSize: 11,
                color: "var(--text-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <span>Hanwha Japan PV Simulation v0.1.0</span>
              <button
                onClick={() => setLang(lang === "ja" ? "en" : "ja")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: 10,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                  fontSize: 10,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-blue)";
                  e.currentTarget.style.color = "var(--accent-blue)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-primary)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <Globe size={10} />
                {lang === "ja" ? "EN" : "JA"}
              </button>
            </div>
          </aside>

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
                  detectError={detectError}
                  onStartDetect={handleStartDetect}
                  onCancelDetect={handleCancelDetect}
                  hasExistingAreas={areas.length > 0}
                />
              </div>
            )}
          </main>
      </div>
    </APIProvider>
  );
}
