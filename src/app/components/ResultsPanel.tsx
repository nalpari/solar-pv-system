"use client";

import { Zap, LayoutGrid, Ruler, ArrowRight } from "lucide-react";
import type { PanelSize, PanelOrientation } from "../types";

interface ResultsPanelProps {
  panelCount: number;
  installAreaM2: number;
  excludeAreaM2: number;
  panelSize: PanelSize;
  orientation: PanelOrientation;
}

export default function ResultsPanel({
  panelCount,
  installAreaM2,
  excludeAreaM2,
  panelSize,
  orientation,
}: ResultsPanelProps) {
  const panelW = orientation === "landscape" ? panelSize.height : panelSize.width;
  const panelH = orientation === "landscape" ? panelSize.width : panelSize.height;
  const panelAreaM2 = (panelW * panelH) / 1_000_000;
  const totalPanelArea = panelCount * panelAreaM2;
  const netArea = installAreaM2 - excludeAreaM2;
  const coveragePercent = netArea > 0 ? ((totalPanelArea / netArea) * 100).toFixed(1) : "0.0";

  const stats = [
    {
      label: "Total Panels",
      value: panelCount.toLocaleString(),
      icon: LayoutGrid,
      color: "var(--accent-blue)",
      bgColor: "var(--accent-blue-muted)",
    },
    {
      label: "Panel Coverage",
      value: `${totalPanelArea.toFixed(1)} m²`,
      icon: Ruler,
      color: "var(--accent-green)",
      bgColor: "var(--accent-green-muted)",
    },
    {
      label: "Coverage Rate",
      value: `${coveragePercent}%`,
      icon: Zap,
      color: "var(--accent-orange)",
      bgColor: "var(--accent-orange-muted)",
    },
  ];

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 10,
        }}
      >
        Layout Results
      </label>

      {panelCount === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <LayoutGrid
            size={24}
            color="var(--text-tertiary)"
            style={{ margin: "0 auto 8px", opacity: 0.5 }}
          />
          Draw an installation area on the map to see panel layout results.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: "var(--bg-surface)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-sm)",
                  background: stat.bgColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <stat.icon size={16} color={stat.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    marginBottom: 2,
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-geist-mono)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {stat.value}
                </div>
              </div>
            </div>
          ))}

          {/* Area breakdown */}
          <div
            style={{
              padding: 12,
              background: "var(--bg-surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
              fontSize: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
                color: "var(--text-secondary)",
              }}
            >
              <span>Install Area</span>
              <span style={{ fontFamily: "var(--font-geist-mono)" }}>
                {installAreaM2.toFixed(1)} m²
              </span>
            </div>
            {excludeAreaM2 > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                  color: "var(--accent-red)",
                }}
              >
                <span>Exclusion Zone</span>
                <span style={{ fontFamily: "var(--font-geist-mono)" }}>
                  -{excludeAreaM2.toFixed(1)} m²
                </span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: 6,
                borderTop: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
                fontWeight: 500,
              }}
            >
              <span>Net Available</span>
              <span style={{ fontFamily: "var(--font-geist-mono)" }}>
                {netArea.toFixed(1)} m²
              </span>
            </div>
          </div>

          {/* Future: Power estimation */}
          <button
            disabled
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "10px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
              background: "var(--bg-surface)",
              color: "var(--text-tertiary)",
              fontSize: 13,
              opacity: 0.6,
              cursor: "not-allowed",
            }}
          >
            <Zap size={14} />
            Estimate Power Generation
            <ArrowRight size={14} style={{ marginLeft: "auto" }} />
          </button>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            Power estimation — coming soon
          </div>
        </div>
      )}
    </div>
  );
}
