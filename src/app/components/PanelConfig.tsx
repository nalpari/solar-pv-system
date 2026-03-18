"use client";

import { useState } from "react";
import { RotateCw, RectangleHorizontal, RectangleVertical, Settings2 } from "lucide-react";
import type { PanelSize, PanelOrientation } from "../types";

const PRESET_SIZES: PanelSize[] = [
  { label: "Standard 60-Cell", width: 991, height: 1650 },
  { label: "Standard 72-Cell", width: 991, height: 1960 },
  { label: "Large Format", width: 1134, height: 2278 },
  { label: "Custom", width: 1000, height: 3000 },
];

interface PanelConfigProps {
  panelSize: PanelSize;
  orientation: PanelOrientation;
  gap: number;
  margin: number;
  onPanelSizeChange: (size: PanelSize) => void;
  onOrientationChange: (orientation: PanelOrientation) => void;
  onGapChange: (gap: number) => void;
  onMarginChange: (margin: number) => void;
}

export default function PanelConfig({
  panelSize,
  orientation,
  gap,
  margin,
  onPanelSizeChange,
  onOrientationChange,
  onGapChange,
  onMarginChange,
}: PanelConfigProps) {
  const [selectedPreset, setSelectedPreset] = useState(3); // Custom default
  const isCustom = selectedPreset === 3;

  function handlePresetChange(index: number) {
    setSelectedPreset(index);
    onPanelSizeChange({ ...PRESET_SIZES[index] });
  }

  const displayW = orientation === "landscape" ? panelSize.height : panelSize.width;
  const displayH = orientation === "landscape" ? panelSize.width : panelSize.height;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 12,
        }}
      >
        <Settings2 size={14} color="var(--text-tertiary)" />
        <label
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Panel Configuration
        </label>
      </div>

      {/* Preset selector */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 6,
          }}
        >
          Panel Type
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
          }}
        >
          {PRESET_SIZES.map((preset, i) => (
            <button
              key={preset.label}
              onClick={() => handlePresetChange(i)}
              style={{
                padding: "6px 8px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${
                  selectedPreset === i
                    ? "var(--accent-blue)"
                    : "var(--border-primary)"
                }`,
                background:
                  selectedPreset === i
                    ? "var(--accent-blue-muted)"
                    : "var(--bg-surface)",
                color:
                  selectedPreset === i
                    ? "var(--accent-blue-hover)"
                    : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: selectedPreset === i ? 500 : 400,
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {preset.label}
              <br />
              <span style={{ fontSize: 10, opacity: 0.7 }}>
                {preset.width} x {preset.height}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom size inputs */}
      {isCustom && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  marginBottom: 4,
                }}
              >
                Width (mm)
              </label>
              <input
                type="number"
                value={panelSize.width}
                onChange={(e) =>
                  onPanelSizeChange({
                    ...panelSize,
                    width: Number(e.target.value) || 0,
                  })
                }
                min={100}
                max={3000}
                step={10}
                style={{ width: "100%", height: 36, fontSize: 13 }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  marginBottom: 4,
                }}
              >
                Height (mm)
              </label>
              <input
                type="number"
                value={panelSize.height}
                onChange={(e) =>
                  onPanelSizeChange({
                    ...panelSize,
                    height: Number(e.target.value) || 0,
                  })
                }
                min={100}
                max={5000}
                step={10}
                style={{ width: "100%", height: 36, fontSize: 13 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Orientation */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 6,
          }}
        >
          Orientation
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => onOrientationChange("portrait")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${
                orientation === "portrait"
                  ? "var(--accent-blue)"
                  : "var(--border-primary)"
              }`,
              background:
                orientation === "portrait"
                  ? "var(--accent-blue-muted)"
                  : "var(--bg-surface)",
              color:
                orientation === "portrait"
                  ? "var(--accent-blue-hover)"
                  : "var(--text-secondary)",
              fontSize: 12,
              fontWeight: orientation === "portrait" ? 500 : 400,
            }}
          >
            <RectangleVertical size={14} />
            Portrait
          </button>
          <button
            onClick={() => onOrientationChange("landscape")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${
                orientation === "landscape"
                  ? "var(--accent-blue)"
                  : "var(--border-primary)"
              }`,
              background:
                orientation === "landscape"
                  ? "var(--accent-blue-muted)"
                  : "var(--bg-surface)",
              color:
                orientation === "landscape"
                  ? "var(--accent-blue-hover)"
                  : "var(--text-secondary)",
              fontSize: 12,
              fontWeight: orientation === "landscape" ? 500 : 400,
            }}
          >
            <RectangleHorizontal size={14} />
            Landscape
          </button>
        </div>
      </div>

      {/* Gap control */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Panel Gap
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-primary)",
              fontFamily: "var(--font-geist-mono)",
              fontWeight: 500,
            }}
          >
            {gap} mm
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={gap}
          onChange={(e) => onGapChange(Number(e.target.value))}
          style={{
            width: "100%",
            accentColor: "var(--accent-blue)",
            height: 4,
          }}
        />
      </div>

      {/* Edge Margin */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Edge Margin
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-primary)",
              fontFamily: "var(--font-geist-mono)",
              fontWeight: 500,
            }}
          >
            {margin} mm
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          step={50}
          value={margin}
          onChange={(e) => onMarginChange(Number(e.target.value))}
          style={{
            width: "100%",
            accentColor: "var(--accent-blue)",
            height: 4,
          }}
        />
      </div>

      {/* Size preview */}
      <div
        style={{
          padding: 12,
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: orientation === "portrait" ? 28 : 48,
              height: orientation === "portrait" ? 48 : 28,
              background: "var(--accent-blue-muted)",
              border: "1.5px solid var(--accent-blue)",
              borderRadius: 3,
              transition: "all 0.2s ease",
            }}
          />
          <RotateCw size={12} color="var(--text-tertiary)" />
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              fontFamily: "var(--font-geist-mono)",
            }}
          >
            {displayW} x {displayH} mm
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            textAlign: "center",
          }}
        >
          {orientation === "portrait" ? "Portrait" : "Landscape"} orientation
          &middot;{" "}
          {((displayW * displayH) / 1_000_000).toFixed(2)} m&sup2; per panel
        </div>
      </div>
    </div>
  );
}
