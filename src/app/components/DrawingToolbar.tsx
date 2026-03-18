"use client";

import { PenTool, Ban, MousePointer, Trash2 } from "lucide-react";
import type { DrawingMode } from "../types";

interface DrawingToolbarProps {
  mode: DrawingMode;
  onModeChange: (mode: DrawingMode) => void;
  onClearAll: () => void;
  installCount: number;
  excludeCount: number;
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
  mode,
  onModeChange,
  onClearAll,
  installCount,
  excludeCount,
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
        Drawing Tools
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          onClick={() => onModeChange(null)}
          style={{
            ...toolButtonStyle(mode === null, "var(--text-secondary)"),
          }}
          onMouseEnter={(e) => {
            if (mode !== null) e.currentTarget.style.background = "var(--bg-surface-hover)";
          }}
          onMouseLeave={(e) => {
            if (mode !== null) e.currentTarget.style.background = "var(--bg-surface)";
          }}
        >
          <MousePointer size={15} />
          <span>Select / Move</span>
        </button>

        <button
          onClick={() => onModeChange(mode === "install" ? null : "install")}
          style={toolButtonStyle(mode === "install", "var(--accent-blue)")}
          onMouseEnter={(e) => {
            if (mode !== "install")
              e.currentTarget.style.background = "var(--bg-surface-hover)";
          }}
          onMouseLeave={(e) => {
            if (mode !== "install")
              e.currentTarget.style.background = "var(--bg-surface)";
          }}
        >
          <PenTool size={15} />
          <span style={{ flex: 1, textAlign: "left" }}>Installation Area</span>
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
          onClick={() => onModeChange(mode === "exclude" ? null : "exclude")}
          style={toolButtonStyle(mode === "exclude", "var(--accent-red)")}
          onMouseEnter={(e) => {
            if (mode !== "exclude")
              e.currentTarget.style.background = "var(--bg-surface-hover)";
          }}
          onMouseLeave={(e) => {
            if (mode !== "exclude")
              e.currentTarget.style.background = "var(--bg-surface)";
          }}
        >
          <Ban size={15} />
          <span style={{ flex: 1, textAlign: "left" }}>Exclusion Zone</span>
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
      </div>

      {(installCount > 0 || excludeCount > 0) && (
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
          Clear All Areas
        </button>
      )}
    </div>
  );
}
