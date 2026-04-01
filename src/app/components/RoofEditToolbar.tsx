"use client";

import {
  MousePointer,
  Pentagon,
  SquareDashed,
  Workflow,
  PencilRuler,
  Trash2,
  XCircle,
  Undo2,
  X,
} from "lucide-react";
import { t } from "../utils/i18n";
import type { Lang } from "../utils/i18n";

export type RoofTool = "select" | "drawRoof" | "drawOpening" | "flowSetting" | "editRoof";
export type RoofAction = "deleteSelected" | "deleteAll" | "undo";
export type RoofEditTool = RoofTool | RoofAction;

interface ToolDef {
  id: RoofEditTool;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  labelKey: string;
  guideKey: string;
  isAction?: boolean;
  danger?: boolean;
}

const TOOLS: ToolDef[] = [
  { id: "select", icon: MousePointer, labelKey: "retSelectMove", guideKey: "retSelectMoveGuide" },
  { id: "drawRoof", icon: Pentagon, labelKey: "retDrawRoof", guideKey: "retDrawRoofGuide" },
  { id: "drawOpening", icon: SquareDashed, labelKey: "retDrawOpening", guideKey: "retDrawOpeningGuide" },
  { id: "flowSetting", icon: Workflow, labelKey: "retFlowSetting", guideKey: "retFlowSettingGuide" },
  { id: "editRoof", icon: PencilRuler, labelKey: "retEditRoof", guideKey: "retEditRoofGuide" },
  { id: "deleteSelected", icon: Trash2, labelKey: "retDeleteSelected", guideKey: "retDeleteSelectedGuide", isAction: true, danger: true },
  { id: "deleteAll", icon: XCircle, labelKey: "retDeleteAll", guideKey: "retDeleteAllGuide", isAction: true, danger: true },
  { id: "undo", icon: Undo2, labelKey: "retUndo", guideKey: "retUndoGuide", isAction: true },
];

interface RoofEditToolbarProps {
  lang: Lang;
  activeTool: RoofTool;
  onToolChange: (tool: RoofTool) => void;
  onAction: (action: RoofAction) => void;
  onClose: () => void;
}

export default function RoofEditToolbar({ lang, activeTool, onToolChange, onAction, onClose }: RoofEditToolbarProps) {
  const currentTool = TOOLS.find((tool) => tool.id === activeTool);

  function handleToolClick(tool: ToolDef) {
    if (tool.isAction) {
      onAction(tool.id as RoofAction);
      return;
    }
    onToolChange(tool.id as RoofTool);
  }

  return (
    <>
      {/* Floating toolbar */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "4px 6px",
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border-primary)",
        }}
      >
        {TOOLS.map((tool, i) => {
          const isActive = !tool.isAction && activeTool === tool.id;
          const Icon = tool.icon;
          return (
            <div key={tool.id} style={{ display: "flex", alignItems: "center" }}>
              {/* 구분선: select 뒤, editRoof 뒤 */}
              {(i === 1 || i === 5) && (
                <div
                  style={{
                    width: 1,
                    height: 24,
                    background: "var(--border-primary)",
                    margin: "0 4px",
                    flexShrink: 0,
                  }}
                />
              )}
              <button
                onClick={() => handleToolClick(tool)}
                title={t(tool.labelKey as Parameters<typeof t>[0], lang)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  background: isActive ? "var(--accent-blue)" : "transparent",
                  color: isActive
                    ? "#fff"
                    : tool.danger
                      ? "var(--accent-red)"
                      : "var(--text-secondary)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = tool.danger
                      ? "var(--accent-red-muted)"
                      : "var(--bg-surface-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <Icon size={18} />
              </button>
            </div>
          );
        })}

        {/* 구분선 + 편집 종료 */}
        <div
          style={{
            width: 1,
            height: 24,
            background: "var(--border-primary)",
            margin: "0 4px",
            flexShrink: 0,
          }}
        />
        <button
          onClick={onClose}
          title={t("retEndEditing", lang)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            border: "none",
            background: "transparent",
            color: "var(--text-secondary)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Bottom guide text */}
      {currentTool && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 30,
            padding: "8px 20px",
            background: "rgba(0, 0, 0, 0.7)",
            borderRadius: "var(--radius-lg)",
            fontSize: 12,
            color: "#fff",
            whiteSpace: "nowrap",
            maxWidth: "90%",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {t(currentTool.guideKey as Parameters<typeof t>[0], lang)}
        </div>
      )}
    </>
  );
}
