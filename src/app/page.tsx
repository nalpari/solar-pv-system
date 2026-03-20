"use client";

import { useState, useCallback, useEffect } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Play, Globe } from "lucide-react";
import Header from "./components/Header";
import AddressSearch from "./components/AddressSearch";
import DrawingToolbar from "./components/DrawingToolbar";
import PanelConfig from "./components/PanelConfig";
import ResultsPanel from "./components/ResultsPanel";
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

function computePolygonAreaM2(paths: { lat: number; lng: number }[]): number {
  if (paths.length < 3) return 0;
  if (typeof google === "undefined" || !google.maps?.geometry?.spherical) return 0;
  return Math.abs(
    google.maps.geometry.spherical.computeArea(
      paths.map((p) => new google.maps.LatLng(p.lat, p.lng))
    )
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("ja");

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
    width: 1000,
    height: 3000,
  });
  const [orientation, setOrientation] = useState<PanelOrientation>("portrait");
  const [gapCm, setGapCm] = useState(2);      // cm 단위 (기존 20mm = 2cm)
  const [marginCm, setMarginCm] = useState(20); // cm 단위 (기존 200mm = 20cm)
  const [placedPanelsList, setPlacedPanelsList] = useState<PlacedPanel[]>([]);
  const [pixelAreas, setPixelAreas] = useState<{ areas: PixelPolygon[]; metersPerPixel: number } | null>(null);
  const [placedPixelPanels, setPlacedPixelPanels] = useState<PixelPanel[]>([]);

  const installAreas = areas.filter((a) => a.type === "install");
  const excludeAreas = areas.filter((a) => a.type === "exclude");

  const installAreaM2 = installAreas.reduce(
    (sum, a) => {
      try { return sum + computePolygonAreaM2(a.paths); }
      catch (e) { console.error(`Area calc failed for ${a.id}:`, e); return sum; }
    },
    0
  );
  const excludeAreaM2 = excludeAreas.reduce(
    (sum, a) => {
      try { return sum + computePolygonAreaM2(a.paths); }
      catch (e) { console.error(`Area calc failed for ${a.id}:`, e); return sum; }
    },
    0
  );

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

  function handlePlacePanels() {
    if (pixelAreas) {
      // Use pixel-based placement when crop data is available
      try {
        const { areas: pxAreas, metersPerPixel } = pixelAreas;
        const installPx = pxAreas.filter((a) => a.type === "install");
        const excludePx = pxAreas.filter((a) => a.type === "exclude");
        const panels = placePanelsOnCanvasCm(
          installPx,
          excludePx,
          panelSize.width,
          panelSize.height,
          orientation,
          gapCm,
          marginCm,
          metersPerPixel,
        );
        setPlacedPixelPanels(panels);

        // Console log results
        const panelAreaM2 = (panelSize.width * panelSize.height) / 1_000_000;
        const totalPanelArea = panels.length * panelAreaM2;
        console.log("=== Panel Placement Results ===");
        console.log(`Total panels: ${panels.length}`);
        console.log(`Panel size: ${panelSize.width}mm × ${panelSize.height}mm (${panelAreaM2.toFixed(3)} m²)`);
        console.log(`Total panel area: ${totalPanelArea.toFixed(2)} m²`);
        console.log(`Orientation: ${orientation}`);
        console.log(`Gap: ${gapCm}cm, Margin: ${marginCm}cm`);
        console.log(`Scale: ${metersPerPixel.toFixed(6)} m/px`);
        console.log(`Panel in pixels: ${(panelSize.width / 1000 / metersPerPixel).toFixed(1)}px × ${(panelSize.height / 1000 / metersPerPixel).toFixed(1)}px`);
        console.log(`Gap in pixels: ${(gapCm / 100 / metersPerPixel).toFixed(1)}px`);
        console.log(`Margin in pixels: ${(marginCm / 100 / metersPerPixel).toFixed(1)}px`);
      } catch (e) {
        console.error("Panel placement failed:", e);
        setPlacedPixelPanels([]);
      }
    } else {
      // Fallback to lat/lng placement
      try {
        const panels = placePanels(
          installAreas,
          excludeAreas,
          panelSize,
          orientation,
          gapCm * 10,   // cm → mm for lat/lng version
          marginCm * 10, // cm → mm for lat/lng version
        );
        setPlacedPanelsList(panels);
      } catch (e) {
        console.error("Panel placement failed:", e);
        setPlacedPanelsList([]);
      }
    }
  }

  const canPlace = cropData !== null
    ? pixelAreas !== null && pixelAreas.areas.some((a) => a.type === "install")
    : installAreas.length > 0;

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      libraries={["drawing", "places", "geometry"]}
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
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <AddressSearch onPlaceSelect={handlePlaceSelect} lang={lang} />

              <div
                style={{
                  height: 1,
                  background: "var(--border-primary)",
                }}
              />

              <DrawingToolbar
                cropMode={cropMode}
                onCropModeChange={setCropMode}
                onClearAll={handleClearAll}
                hasCropData={cropData !== null}
                drawingMode={drawingMode}
                onDrawingModeChange={setDrawingMode}
                installCount={installAreas.length}
                excludeCount={excludeAreas.length}
                lang={lang}
              />

              <div
                style={{
                  height: 1,
                  background: "var(--border-primary)",
                }}
              />

              <PanelConfig
                panelSize={panelSize}
                orientation={orientation}
                panelGap={gapCm}
                edgeMargin={marginCm}
                onPanelSizeChange={setPanelSize}
                onOrientationChange={setOrientation}
                onGapChange={setGapCm}
                onMarginChange={setMarginCm}
                lang={lang}
              />

              {/* Place Panels Button */}
              <button
                onClick={handlePlacePanels}
                disabled={!canPlace}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  background: canPlace ? "var(--accent-blue)" : "var(--bg-surface)",
                  color: canPlace ? "#fff" : "var(--text-tertiary)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: canPlace ? "pointer" : "not-allowed",
                  opacity: canPlace ? 1 : 0.5,
                }}
              >
                <Play size={16} />
                {t("placePanels", lang)}
              </button>

              <div
                style={{
                  height: 1,
                  background: "var(--border-primary)",
                }}
              />

              <ResultsPanel
                panelCount={placedPixelPanels.length || placedPanelsList.length}
                installAreaM2={installAreaM2}
                excludeAreaM2={excludeAreaM2}
                panelSize={panelSize}
                orientation={orientation}
                lang={lang}
              />
            </div>

            {/* Sidebar footer */}
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid var(--border-primary)",
                fontSize: 11,
                color: "var(--text-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
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
