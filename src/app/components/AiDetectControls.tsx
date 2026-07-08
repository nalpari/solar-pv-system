"use client";

import { t, type Lang } from "../utils/i18n";

interface AiDetectControlsProps {
  detectStatus: "idle" | "detecting";
  onStartDetect: () => void;
  onCancelDetect: () => void;
  /** 모듈 배치 완료(편집 잠금) 상태 — true면 "AI 분석 시작" 비활성 (재분석 차단) */
  isPlacementDone?: boolean;
  lang: Lang;
}

/** AI 지붕 자동 감지 시작/취소 컨트롤. 크롭 팝업 영역 외부 하단에 배치된다. */
export default function AiDetectControls({
  detectStatus,
  onStartDetect,
  onCancelDetect,
  isPlacementDone = false,
  lang,
}: AiDetectControlsProps) {
  const isDetecting = detectStatus === "detecting";
  // 분석 중이거나 배치 완료(편집 잠금) 상태면 "AI 분석 시작" 비활성
  const isStartDisabled = isDetecting || isPlacementDone;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        pointerEvents: "none",
      }}
    >
      <button
        onClick={onCancelDetect}
        disabled={!isDetecting}
        style={{
          padding: "10px 20px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-primary)",
          background: "var(--bg-surface)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: isDetecting ? "pointer" : "not-allowed",
          opacity: isDetecting ? 1 : 0.5,
          pointerEvents: "auto",
          transition: "all 0.15s ease",
        }}
      >
        {t("aiDetectCancel", lang)}
      </button>
      <button
        onClick={onStartDetect}
        disabled={isStartDisabled}
        style={{
          padding: "10px 20px",
          borderRadius: "var(--radius-md)",
          border: "none",
          background: "var(--accent-blue)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: isStartDisabled ? "not-allowed" : "pointer",
          opacity: isStartDisabled ? 0.6 : 1,
          pointerEvents: "auto",
          transition: "all 0.15s ease",
        }}
      >
        {isDetecting ? t("aiDetectInProgress", lang) : t("aiDetectStart", lang)}
      </button>
    </div>
  );
}
