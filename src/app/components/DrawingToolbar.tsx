"use client";

import { Crop, MousePointer, PenTool, Ban, Trash2 } from "lucide-react";
import { t } from "../utils/i18n";
import type { Lang } from "../utils/i18n";
import type { DrawingMode } from "../types";

interface DrawingToolbarProps {
  cropMode: boolean;
  onCropModeChange: (active: boolean) => void;
  onClearAll: () => void;
  hasCropData: boolean;
  drawingMode: DrawingMode;
  onDrawingModeChange: (mode: DrawingMode) => void;
  installCount: number;
  excludeCount: number;
  lang: Lang;
}

const toolButtonStyle = (isActive: boolean, color: string) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: "var(--radius-md)",
  border: `1px solid ${isActive ? color : "var(--border-primary)"}`,
  background: isActive ? `${color}15` : "var(--bg-surface)",
  color: isActive ? color : "var(--text-secondary)",
  fontSize: 13,
  fontWeight: isActive ? 500 : 400,
  width: "100%",
  transition: "all 0.15s ease",
});

export default function DrawingToolbar({
  cropMode,
  onCropModeChange,
  onClearAll,
  hasCropData,
  drawingMode,
  onDrawingModeChange,
  installCount,
  excludeCount,
  lang,
}: DrawingToolbarProps) {
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
          marginBottom: 8,
        }}
      >
        {t("cropTools", lang)}
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Crop mode button — show when no crop data yet */}
        {!hasCropData && (
          <>
            <button
              onClick={() => onCropModeChange(!cropMode)}
              style={toolButtonStyle(cropMode, "var(--accent-blue)")}
              onMouseEnter={(e) => {
                if (!cropMode)
                  e.currentTarget.style.background = "var(--bg-surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (!cropMode)
                  e.currentTarget.style.background = "var(--bg-surface)";
              }}
            >
              <Crop size={15} />
              <span>{t("cropMode", lang)}</span>
            </button>

            {cropMode && (
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  margin: "2px 0 0 0",
                  padding: "0 4px",
                }}
              >
                {t("cropModeActive", lang)}
              </p>
            )}
          </>
        )}

        {/* Polygon drawing mode buttons — show when crop data exists */}
        {hasCropData && (
          <>
            <button
              onClick={() => onDrawingModeChange(null)}
              style={toolButtonStyle(drawingMode === null, "var(--text-secondary)")}
              onMouseEnter={(e) => {
                if (drawingMode !== null)
                  e.currentTarget.style.background = "var(--bg-surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (drawingMode !== null)
                  e.currentTarget.style.background = "var(--bg-surface)";
              }}
            >
              <MousePointer size={15} />
              <span>{t("cropSelectMove", lang)}</span>
            </button>

            <button
              onClick={() => onDrawingModeChange(drawingMode === "install" ? null : "install")}
              style={toolButtonStyle(drawingMode === "install", "var(--accent-blue)")}
              onMouseEnter={(e) => {
                if (drawingMode !== "install")
                  e.currentTarget.style.background = "var(--bg-surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (drawingMode !== "install")
                  e.currentTarget.style.background = "var(--bg-surface)";
              }}
            >
              <PenTool size={15} />
              <span style={{ flex: 1, textAlign: "left" }}>{t("cropInstallArea", lang)}</span>
              {installCount > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    background: "var(--accent-blue-muted)",
                    color: "var(--accent-blue)",
                    padding: "2px 6px",
                    borderRadius: 10,
                    fontWeight: 600,
                  }}
                >
                  {installCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onDrawingModeChange(drawingMode === "exclude" ? null : "exclude")}
              style={toolButtonStyle(drawingMode === "exclude", "var(--accent-red)")}
              onMouseEnter={(e) => {
                if (drawingMode !== "exclude")
                  e.currentTarget.style.background = "var(--bg-surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (drawingMode !== "exclude")
                  e.currentTarget.style.background = "var(--bg-surface)";
              }}
            >
              <Ban size={15} />
              <span style={{ flex: 1, textAlign: "left" }}>{t("cropExcludeZone", lang)}</span>
              {excludeCount > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    background: "var(--accent-red-muted)",
                    color: "var(--accent-red)",
                    padding: "2px 6px",
                    borderRadius: 10,
                    fontWeight: 600,
                  }}
                >
                  {excludeCount}
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {(hasCropData || installCount > 0 || excludeCount > 0) && (
        <button
          onClick={onClearAll}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            marginTop: 8,
            padding: "6px 12px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-primary)",
            background: "transparent",
            color: "var(--text-tertiary)",
            fontSize: 12,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent-red)";
            e.currentTarget.style.borderColor = "var(--accent-red)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-tertiary)";
            e.currentTarget.style.borderColor = "var(--border-primary)";
          }}
        >
          <Trash2 size={13} />
          {t("clearAll", lang)}
        </button>
      )}
    </div>
  );
}
