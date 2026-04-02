"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { t } from "../utils/i18n";
import type { Lang } from "../utils/i18n";
import type { PanelSize } from "../types";


function getPresetSizes(lang: Lang): PanelSize[] {
  return [
    { label: t("preset60Cell", lang), width: 991, height: 1650 },
    { label: t("preset72Cell", lang), width: 991, height: 1960 },
    { label: t("presetLarge", lang), width: 1134, height: 2278 },
    { label: t("presetCustom", lang), width: 1000, height: 3000 },
  ];
}

interface PanelConfigProps {
  panelSize: PanelSize;
  onPanelSizeChange: (size: PanelSize) => void;
  lang: Lang;
}

export default function PanelConfig({
  panelSize,
  onPanelSizeChange,
  lang,
}: PanelConfigProps) {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const presetSizes = getPresetSizes(lang);

  function handlePresetChange(index: number) {
    setSelectedPreset(index);
    onPanelSizeChange({ ...presetSizes[index] });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Module Selection */}
      <div style={{ padding: "12px 16px" }}>
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: 6,
          }}
        >
          {t("moduleSelect", lang)}
          <span style={{ color: "var(--accent-red)", marginLeft: 2 }}>*</span>
        </label>
        <div style={{ position: "relative" }}>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(Number(e.target.value))}
            style={{
              width: "100%",
              height: 36,
              fontSize: 13,
              paddingRight: 32,
              appearance: "none",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-primary)",
              padding: "0 32px 0 12px",
            }}
          >
            {presetSizes.map((preset, i) => (
              <option key={i} value={i}>
                {preset.label} ({preset.width} × {preset.height}mm)
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

        {/* Custom size inputs */}
        {selectedPreset === 3 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 8,
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
                {t("widthMm", lang)}
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
                style={{ width: "100%", height: 34, fontSize: 13 }}
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
                {t("heightMm", lang)}
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
                style={{ width: "100%", height: 34, fontSize: 13 }}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
