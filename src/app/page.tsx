"use client";

import { useState, useCallback } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Play } from "lucide-react";
import Header from "./components/Header";
import AddressSearch from "./components/AddressSearch";
import DrawingToolbar from "./components/DrawingToolbar";
import PanelConfig from "./components/PanelConfig";
import ResultsPanel from "./components/ResultsPanel";
import MapView from "./components/MapView";
import { placePanels } from "./utils/panelPlacement";
import type {
  PanelSize,
  PanelOrientation,
  DrawingMode,
  PolygonArea,
  PlacedPanel,
} from "./types";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const DEFAULT_CENTER = { lat: 47.6062, lng: -122.3321 }; // Seattle

function computePolygonAreaM2(paths: { lat: number; lng: number }[]): number {
  if (paths.length < 3) return 0;
  return Math.abs(
    google.maps.geometry.spherical.computeArea(
      paths.map((p) => new google.maps.LatLng(p.lat, p.lng))
    )
  );
}

export default function Home() {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(null);
  const [areas, setAreas] = useState<PolygonArea[]>([]);
  const [panelSize, setPanelSize] = useState<PanelSize>({
    label: "Custom",
    width: 1000,
    height: 3000,
  });
  const [orientation, setOrientation] = useState<PanelOrientation>("portrait");
  const [gap, setGap] = useState(20);
  const [margin, setMargin] = useState(200);
  const [placedPanelsList, setPlacedPanelsList] = useState<PlacedPanel[]>([]);

  const installAreas = areas.filter((a) => a.type === "install");
  const excludeAreas = areas.filter((a) => a.type === "exclude");

  const installAreaM2 = installAreas.reduce(
    (sum, a) => {
      try { return sum + computePolygonAreaM2(a.paths); }
      catch { return sum; }
    },
    0
  );
  const excludeAreaM2 = excludeAreas.reduce(
    (sum, a) => {
      try { return sum + computePolygonAreaM2(a.paths); }
      catch { return sum; }
    },
    0
  );

  function handlePlaceSelect(location: {
    lat: number;
    lng: number;
    address: string;
  }) {
    setCenter({ lat: location.lat, lng: location.lng });
  }

  const handleAreaComplete = useCallback(
    (area: PolygonArea) => {
      setAreas((prev) => [...prev, area]);
    },
    []
  );

  const handleAreasChange = useCallback((newAreas: PolygonArea[]) => {
    setAreas(newAreas);
  }, []);

  function handleClearAll() {
    setAreas([]);
    setPlacedPanelsList([]);
  }

  function handlePlacePanels() {
    const panels = placePanels(
      installAreas,
      excludeAreas,
      panelSize,
      orientation,
      gap,
      margin,
    );
    setPlacedPanelsList(panels);
  }

  const canPlace = installAreas.length > 0;

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
              <AddressSearch onPlaceSelect={handlePlaceSelect} />

              <div
                style={{
                  height: 1,
                  background: "var(--border-primary)",
                }}
              />

              <DrawingToolbar
                mode={drawingMode}
                onModeChange={setDrawingMode}
                onClearAll={handleClearAll}
                installCount={installAreas.length}
                excludeCount={excludeAreas.length}
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
                gap={gap}
                margin={margin}
                onPanelSizeChange={setPanelSize}
                onOrientationChange={setOrientation}
                onGapChange={setGap}
                onMarginChange={setMargin}
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
                Place Panels
              </button>

              <div
                style={{
                  height: 1,
                  background: "var(--border-primary)",
                }}
              />

              <ResultsPanel
                panelCount={placedPanelsList.length}
                installAreaM2={installAreaM2}
                excludeAreaM2={excludeAreaM2}
                panelSize={panelSize}
                orientation={orientation}
              />
            </div>

            {/* Sidebar footer */}
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid var(--border-primary)",
                fontSize: 11,
                color: "var(--text-tertiary)",
                textAlign: "center",
              }}
            >
              Solar PV Planner v0.1.0
            </div>
          </aside>

          {/* Map Area */}
          <main style={{ flex: 1, position: "relative" }}>
            {GOOGLE_MAPS_API_KEY ? (
              <MapView
                center={center}
                drawingMode={drawingMode}
                areas={areas}
                placedPanels={placedPanelsList}
                onAreaComplete={handleAreaComplete}
                onAreasChange={handleAreasChange}
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
                    Google Maps API Key Required
                  </h2>
                  <p
                    style={{
                      fontSize: 14,
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                      marginBottom: 20,
                    }}
                  >
                    Set your API key as an environment variable to enable the
                    interactive map.
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
                    Required APIs: Maps JavaScript, Places, Drawing, Geometry
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </APIProvider>
  );
}
