"use client";

import { LayoutGrid, Trash2 } from "lucide-react";
import { t } from "../utils/i18n";
import type { Lang } from "../utils/i18n";
import type { PanelSize, PanelOrientation } from "../types";

interface ResultsPanelProps {
  panelCount: number;
  installAreaM2: number;
  excludeAreaM2: number;
  panelSize: PanelSize;
  orientation: PanelOrientation;
  canPlace: boolean;
  onPlacePanels: () => void;
  onDeleteAllPanels: () => void;
  lang: Lang;
}

export default function ResultsPanel({
  panelCount,
  panelSize,
  orientation,
  canPlace,
  onPlacePanels,
  onDeleteAllPanels,
  lang,
}: ResultsPanelProps) {
  const panelW = orientation === "landscape" ? panelSize.height : panelSize.width;
  const panelH = orientation === "landscape" ? panelSize.width : panelSize.height;
  const panelKw = (panelW * panelH) / 1_000_000 * 0.2; // rough estimate ~200W/m²
  const totalKw = panelCount * panelKw;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Action Buttons */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Place Modules Button */}
        <button
          onClick={onPlacePanels}
          disabled={!canPlace}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: canPlace ? "var(--accent-blue)" : "var(--bg-surface)",
            color: canPlace ? "#fff" : "var(--text-tertiary)",
            fontSize: 13,
            fontWeight: 600,
            cursor: canPlace ? "pointer" : "not-allowed",
            opacity: canPlace ? 1 : 0.5,
          }}
        >
          <LayoutGrid size={15} />
          {t("placeModules", lang)}
        </button>

        {/* Delete Selected Modules (placeholder - disabled for now) */}
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
            fontWeight: 500,
            cursor: "not-allowed",
            opacity: 0.5,
          }}
        >
          <Trash2 size={15} />
          {t("deleteSelectedModules", lang)}
        </button>

        {/* Delete All Modules */}
        <button
          onClick={onDeleteAllPanels}
          disabled={panelCount === 0}
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
            color: panelCount > 0 ? "var(--accent-red)" : "var(--text-tertiary)",
            fontSize: 13,
            fontWeight: 500,
            cursor: panelCount > 0 ? "pointer" : "not-allowed",
            opacity: panelCount > 0 ? 1 : 0.5,
          }}
          onMouseEnter={(e) => {
            if (panelCount > 0) {
              e.currentTarget.style.background = "var(--accent-red-muted)";
              e.currentTarget.style.borderColor = "var(--accent-red)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-surface)";
            e.currentTarget.style.borderColor = "var(--border-primary)";
          }}
        >
          <Trash2 size={15} />
          {t("deleteAllModules", lang)}
        </button>
      </div>

      {/* North roof warning */}
      <div
        style={{
          margin: "0 16px",
          padding: "10px 12px",
          background: "var(--accent-orange-muted)",
          borderRadius: "var(--radius-md)",
          fontSize: 11,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
          whiteSpace: "pre-line",
        }}
      >
        {t("northRoofWarning", lang)}
      </div>

      {/* Installation Capacity */}
      <div style={{ padding: "16px 16px 12px" }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: 6,
          }}
        >
          {t("installCapacity", lang)}
        </div>
        <div
          style={{
            padding: "10px 16px",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-primary)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            fontFamily: "var(--font-geist-mono)",
            textAlign: "center",
          }}
        >
          {panelCount}{t("capacityUnit", lang)} · {totalKw.toFixed(1)}kW
        </div>
      </div>
    </div>
  );
}
