"use client";

import { t } from "../utils/i18n";
import type { Lang } from "../utils/i18n";

export type RoofTool = "select" | "drawRoof" | "drawOpening" | "flowSetting" | "editRoof";
export type RoofAction = "deleteSelected" | "deleteAll" | "undo" | "complete";
export type RoofEditTool = RoofTool | RoofAction;

interface ToolDef {
  id: RoofEditTool;
  labelKey: string;
  guideKey: string;
  isAction?: boolean;
}

const TOOLS: ToolDef[] = [
  { id: "select", labelKey: "retSelectMove", guideKey: "retSelectMoveGuide" },
  { id: "drawRoof", labelKey: "retDrawRoof", guideKey: "retDrawRoofGuide" },
  { id: "drawOpening", labelKey: "retDrawOpening", guideKey: "retDrawOpeningGuide" },
  { id: "flowSetting", labelKey: "retFlowSetting", guideKey: "retFlowSettingGuide" },
  { id: "editRoof", labelKey: "retEditRoof", guideKey: "retEditRoofGuide" },
  { id: "deleteSelected", labelKey: "retDeleteSelected", guideKey: "retDeleteSelectedGuide", isAction: true },
  { id: "deleteAll", labelKey: "retDeleteAll", guideKey: "retDeleteAllGuide", isAction: true },
  { id: "undo", labelKey: "retUndo", guideKey: "retUndoGuide", isAction: true },
  { id: "complete", labelKey: "retComplete", guideKey: "retCompleteGuide", isAction: true },
];

interface RoofEditToolbarProps {
  lang: Lang;
  activeTool: RoofTool;
  onToolChange: (tool: RoofTool) => void;
  onAction: (action: RoofAction) => void;
  /** 선택된 지붕면/장애물 존재 여부 — 선택 삭제 버튼 활성화 판정에 사용 */
  hasSelection?: boolean;
  /** 전체 비활성화 — 모듈 배치 완료(편집 잠금) 상태에서 지붕 편집을 막는다 */
  disabled?: boolean;
}

export default function RoofEditToolbar({ lang, activeTool, onToolChange, onAction, hasSelection = false, disabled = false }: RoofEditToolbarProps) {
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
      {/* Floating toolbar (위치/zIndex는 외부 wrapper가 담당) */}
      <div
        style={{
          pointerEvents: "auto",
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
          // 전체 비활성(편집 잠금) 또는 선택 삭제 버튼인데 선택이 없으면 비활성화
          const isDisabled = disabled || (tool.id === "deleteSelected" && !hasSelection);
          return (
            <div key={tool.id} style={{ display: "flex", alignItems: "center" }}>
              {/* 구분선: select 뒤, editRoof 뒤, undo 뒤(작성 완료 앞) */}
              {(i === 1 || i === 5 || i === 8) && (
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
                onClick={() => { if (!isDisabled) handleToolClick(tool); }}
                disabled={isDisabled}
                title={t(tool.labelKey as Parameters<typeof t>[0], lang)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 16px",
                  minHeight: 36,
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  background: isActive ? "var(--accent-blue)" : "transparent",
                  color: isActive ? "#fff" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  opacity: isDisabled ? 0.35 : 1,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.background = "var(--bg-surface-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {t(tool.labelKey as Parameters<typeof t>[0], lang)}
              </button>
            </div>
          );
        })}

      </div>

      {/* Guide text — 외부 wrapper의 flex column에서 toolbar 바로 아래로 자연 배치 */}
      {currentTool && (
        <div
          style={{
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
