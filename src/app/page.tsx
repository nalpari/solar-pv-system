"use client";

import { useState, useCallback, useEffect } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Globe, Sun, BarChart3, Crop, ChevronDown, ArrowRight, PenTool } from "lucide-react";
import Header from "./components/Header";
import AddressSearch from "./components/AddressSearch";
import DrawingToolbar from "./components/DrawingToolbar";
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
  const [roofEditing, setRoofEditing] = useState(false);
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

  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [cropMode, setCropMode] = useState(false);
  const [cropData, setCropData] = useState<CropData | null>(null);
  const [address, setAddress] = useState("");
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(null);
  const [areas, setAreas] = useState<PolygonArea[]>([]);
  const [panelSize, setPanelSize] = useState<PanelSize>({
    label: "Custom",
    width: 991,
    height: 1650,
  });
  const [orientation, setOrientation] = useState<PanelOrientation>("portrait");
  const [gapCm, setGapCm] = useState(2);
  const [marginCm, setMarginCm] = useState(20);
  const [placedPanelsList, setPlacedPanelsList] = useState<PlacedPanel[]>([]);
  const [pixelAreas, setPixelAreas] = useState<{ areas: PixelPolygon[]; metersPerPixel: number } | null>(null);
  const [placedPixelPanels, setPlacedPixelPanels] = useState<PixelPanel[]>([]);
  const [placementError, setPlacementError] = useState<string | null>(null);

  const installAreas = areas.filter((a) => a.type === "install");
  const excludeAreas = areas.filter((a) => a.type === "exclude");


  function handlePlaceSelect(location: {
    lat: number;
    lng: number;
    address: string;
  }) {
    setCenter({ lat: location.lat, lng: location.lng });
    setAddress(location.address);
  }

  const handleCropComplete = useCallback((data: CropData) => {
    setCropData(data);
    setCropMode(false);
  }, []);

  const handleAreasChange = useCallback((newAreas: PolygonArea[]) => {
    setAreas(newAreas);
    setPlacedPanelsList([]);
  }, []);

  const handlePixelAreasChange = useCallback((areas: PixelPolygon[], metersPerPixel: number) => {
    setPixelAreas({ areas, metersPerPixel });
    setPlacedPixelPanels([]);
  }, []);

  const handleCropClose = useCallback(() => {
    setCropData(null);
    setDrawingMode(null);
    setAreas([]);
    setPixelAreas(null);
    setPlacedPixelPanels([]);
    setPlacedPanelsList([]);
  }, []);

  function handleClearAll() {
    setAreas([]);
    setPlacedPanelsList([]);
    setCropData(null);
    setDrawingMode(null);
    setPixelAreas(null);
    setPlacedPixelPanels([]);
  }

  function handleDeleteAllPanels() {
    setPlacedPanelsList([]);
    setPlacedPixelPanels([]);
  }

  function switchToSimulation() {
    setCropMode(false);
    setRoofEditing(false);
    setRoofEditTool("select");
    setDrawingMode(null);
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
            ori, gapCm, marginCm, metersPerPixel,
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
            gapCm * 10, marginCm * 10,
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
          flexDirection: "column",
          height: "100dvh",
          overflow: "hidden",
        }}
      >
        <Header />

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
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

                  {/* Roof Edit Toggle Button */}
                  <div style={{ padding: "12px 16px 0" }}>
                    <button
                      onClick={() => cropData && setRoofEditing(!roofEditing)}
                      disabled={!cropData}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        width: "100%",
                        padding: "10px 16px",
                        borderRadius: "var(--radius-md)",
                        border: roofEditing
                          ? "1px solid var(--accent-blue)"
                          : "1px solid var(--border-primary)",
                        background: roofEditing
                          ? "var(--accent-blue)"
                          : "var(--bg-surface)",
                        color: roofEditing
                          ? "#fff"
                          : !cropData
                            ? "var(--text-tertiary)"
                            : "var(--text-primary)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: cropData ? "pointer" : "not-allowed",
                        opacity: cropData ? 1 : 0.5,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!roofEditing && cropData) {
                          e.currentTarget.style.background = "var(--bg-surface-hover)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!roofEditing && cropData) {
                          e.currentTarget.style.background = "var(--bg-surface)";
                        }
                      }}
                    >
                      <PenTool size={15} />
                      {roofEditing ? t("roofEditing", lang) : t("roofEditStart", lang)}
                    </button>
                  </div>

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

                  {/* Drawing Toolbar (polygon tools) - only when crop data exists */}
                  <DrawingToolbar
                    onClearAll={handleClearAll}
                    hasCropData={cropData !== null}
                    drawingMode={drawingMode}
                    onDrawingModeChange={setDrawingMode}
                    installCount={installAreas.length}
                    excludeCount={excludeAreas.length}
                    lang={lang}
                  />

                  {/* Section: 모듈 배치 */}
                  <SectionHeader title={t("sectionModulePlacement", lang)} primary />

                  {/* Panel Config (Module selection + Gap settings) */}
                  <PanelConfig
                    panelSize={panelSize}
                    panelGap={gapCm}
                    edgeMargin={marginCm}
                    onPanelSizeChange={setPanelSize}
                    onGapChange={setGapCm}
                    onMarginChange={setMarginCm}
                    lang={lang}
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
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--accent-orange-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--accent-orange)";
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
            {/* Roof Edit Toolbar (floating over map) */}
            {roofEditing && cropData && (
              <RoofEditToolbar
                lang={lang}
                activeTool={roofEditTool}
                onToolChange={setRoofEditTool}
                onAction={(action) => {
                  // TODO: 각 액션(deleteSelected, deleteAll, undo) 처리 로직 추가
                  console.log("Roof edit action:", action);
                }}
                onClose={() => {
                  setRoofEditing(false);
                  setRoofEditTool("select");
                }}
              />
            )}
            {GOOGLE_MAPS_API_KEY ? (
              <MapView
                center={center}
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
              <CropPopup
                cropData={cropData}
                drawingMode={drawingMode}
                onAreasChange={handleAreasChange}
                onPixelAreasChange={handlePixelAreasChange}
                placedPanels={placedPixelPanels}
                onClose={handleCropClose}
                lang={lang}
              />
            )}
          </main>
        </div>
      </div>
    </APIProvider>
  );
}
