"use client";

import { ChevronDown, Compass, Battery, Banknote } from "lucide-react";
import { t } from "../utils/i18n";
import type { Lang } from "../utils/i18n";

// 16方位
const COMPASS_DIRECTIONS = [
  { value: "S", ja: "南", en: "S" },
  { value: "SSW", ja: "南南西", en: "SSW" },
  { value: "SW", ja: "南西", en: "SW" },
  { value: "WSW", ja: "西南西", en: "WSW" },
  { value: "W", ja: "西", en: "W" },
  { value: "WNW", ja: "西北西", en: "WNW" },
  { value: "NW", ja: "北西", en: "NW" },
  { value: "NNW", ja: "北北西", en: "NNW" },
  { value: "N", ja: "北", en: "N" },
  { value: "NNE", ja: "北北東", en: "NNE" },
  { value: "NE", ja: "北東", en: "NE" },
  { value: "ENE", ja: "東北東", en: "ENE" },
  { value: "E", ja: "東", en: "E" },
  { value: "ESE", ja: "東南東", en: "ESE" },
  { value: "SE", ja: "南東", en: "SE" },
  { value: "SSE", ja: "南南東", en: "SSE" },
] as const;

// 축전지 모델 리스트 (향후 QSP 연동)
const BATTERY_MODELS = [
  { value: "q-ready-7.7", label: "Q.READY 7.7kWh" },
  { value: "q-ready-11.5", label: "Q.READY 11.5kWh" },
  { value: "q-ready-15.3", label: "Q.READY 15.3kWh" },
];

export interface SimulationFormState {
  azimuth: string;
  hasBattery: boolean;
  batteryModel: string;
  monthlyElecCost: string;
}

interface SimulationPanelProps {
  lang: Lang;
  formState: SimulationFormState;
  onFormChange: (state: SimulationFormState) => void;
  onGoBack: () => void;
  onSubmit: () => void;
}

/** 나침반 다이어그램 SVG */
function CompassDiagram({ direction, lang }: { direction: string; lang: Lang }) {
  const directionIndex = COMPASS_DIRECTIONS.findIndex((d) => d.value === direction);

  const mainDirs = [
    { value: "N", angle: 0 },
    { value: "E", angle: 90 },
    { value: "S", angle: 180 },
    { value: "W", angle: 270 },
  ];

  const mainLabels: Record<string, Record<string, string>> = {
    N: { ja: "北", en: "N" },
    E: { ja: "東", en: "E" },
    S: { ja: "南", en: "S" },
    W: { ja: "西", en: "W" },
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "8px 0",
      }}
    >
      <svg viewBox="0 0 200 200" width="180" height="180">
        {/* Outer circle */}
        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--border-primary)" strokeWidth="1" />
        <circle cx="100" cy="100" r="70" fill="var(--bg-surface)" stroke="var(--border-primary)" strokeWidth="0.5" />

        {/* Tick marks for 16 directions */}
        {COMPASS_DIRECTIONS.map((dir, i) => {
          const angle = (i * 22.5 - 90) * (Math.PI / 180);
          const x1 = 100 + Math.cos(angle) * 82;
          const y1 = 100 + Math.sin(angle) * 82;
          const x2 = 100 + Math.cos(angle) * 90;
          const y2 = 100 + Math.sin(angle) * 90;
          const isMain = i % 4 === 0;
          return (
            <line
              key={dir.value}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isMain ? "var(--text-secondary)" : "var(--border-primary)"}
              strokeWidth={isMain ? 1.5 : 0.5}
            />
          );
        })}

        {/* Main direction labels */}
        {mainDirs.map((d) => {
          const angle = (d.angle - 90) * (Math.PI / 180);
          const x = 100 + Math.cos(angle) * 96;
          const y = 100 + Math.sin(angle) * 96;
          const isSelected = direction === d.value;
          return (
            <text
              key={d.value}
              x={x} y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={isSelected ? 12 : 10}
              fontWeight={isSelected ? 700 : 400}
              fill={d.value === "S" ? "var(--accent-red)" : (d.value === "N" ? "var(--accent-red)" : "var(--text-secondary)")}
            >
              {mainLabels[d.value][lang]}
            </text>
          );
        })}

        {/* Selected direction indicator */}
        {directionIndex >= 0 && (() => {
          const angle = (directionIndex * 22.5 - 90) * (Math.PI / 180);
          const x = 100 + Math.cos(angle) * 75;
          const y = 100 + Math.sin(angle) * 75;
          return (
            <circle
              cx={x} cy={y} r="5"
              fill="var(--accent-blue)"
            />
          );
        })()}

        {/* Center house icon (simplified) */}
        <rect x="80" y="82" width="40" height="30" rx="2" fill="var(--accent-orange-muted)" stroke="var(--accent-orange)" strokeWidth="0.8" />
        <polygon points="100,72 78,88 122,88" fill="var(--accent-orange-muted)" stroke="var(--accent-orange)" strokeWidth="0.8" />

        {/* Panel indicators on roof */}
        {[0, 1, 2].map((col) => (
          [0, 1].map((row) => (
            <rect
              key={`${col}-${row}`}
              x={87 + col * 10}
              y={76 + row * 6}
              width={8}
              height={5}
              rx="0.5"
              fill="var(--accent-blue)"
              opacity={0.7}
            />
          ))
        ))}
      </svg>
    </div>
  );
}

export default function SimulationPanel({ lang, formState, onFormChange, onGoBack, onSubmit }: SimulationPanelProps) {
  const { azimuth, hasBattery, batteryModel, monthlyElecCost } = formState;

  function update(patch: Partial<SimulationFormState>) {
    onFormChange({ ...formState, ...patch });
  }

  const canSubmit = azimuth !== "" && monthlyElecCost !== "";

  function formatCurrency(value: string): string {
    const num = value.replace(/[^0-9]/g, "");
    if (!num) return "";
    return Number(num).toLocaleString();
  }

  function handleCostChange(value: string) {
    const cleaned = value.replace(/[^0-9]/g, "");
    update({ monthlyElecCost: cleaned });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* 方位設定 */}
        <div style={{ padding: "16px 16px 12px" }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            <Compass size={14} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
            {t("azimuthSetting", lang)}
            <span style={{ color: "var(--accent-red)", marginLeft: 2 }}>*</span>
          </label>

          <div style={{ position: "relative" }}>
            <select
              value={azimuth}
              onChange={(e) => update({ azimuth: e.target.value })}
              style={{
                width: "100%",
                height: 36,
                fontSize: 13,
                appearance: "none",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                color: azimuth ? "var(--text-primary)" : "var(--text-tertiary)",
                padding: "0 32px 0 12px",
              }}
            >
              <option value="">{t("azimuthPlaceholder", lang)}</option>
              {COMPASS_DIRECTIONS.map((dir) => (
                <option key={dir.value} value={dir.value}>
                  {dir[lang]} ({dir.value})
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

          {/* Guide text */}
          <div
            style={{
              marginTop: 8,
              padding: "8px 10px",
              background: "var(--accent-blue-muted)",
              borderRadius: "var(--radius-sm)",
              fontSize: 11,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {t("azimuthGuide", lang)}
          </div>

          {/* Compass Diagram */}
          <CompassDiagram direction={azimuth} lang={lang} />
        </div>

        <div style={{ height: 1, background: "var(--border-primary)" }} />

        {/* 蓄電池設定 */}
        <div style={{ padding: "16px 16px 12px" }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            <Battery size={14} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
            {t("batterySetting", lang)}
          </label>

          {/* Battery description */}
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              lineHeight: 1.6,
              marginBottom: 10,
            }}
          >
            {t("batteryDescription", lang)}
          </div>

          {/* Radio buttons */}
          <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="battery"
                checked={hasBattery}
                onChange={() => update({ hasBattery: true })}
                style={{ accentColor: "var(--accent-blue)", width: 16, height: 16 }}
              />
              {t("batteryYes", lang)}
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="battery"
                checked={!hasBattery}
                onChange={() => update({ hasBattery: false })}
                style={{ accentColor: "var(--accent-blue)", width: 16, height: 16 }}
              />
              {t("batteryNo", lang)}
            </label>
          </div>

          {/* Battery model dropdown (conditional) */}
          {hasBattery && (
            <div style={{ position: "relative" }}>
              <select
                value={batteryModel}
                onChange={(e) => update({ batteryModel: e.target.value })}
                style={{
                  width: "100%",
                  height: 36,
                  fontSize: 13,
                  appearance: "none",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  padding: "0 32px 0 12px",
                }}
              >
                {BATTERY_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
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
          )}
        </div>

        <div style={{ height: 1, background: "var(--border-primary)" }} />

        {/* 月平均電気料金 */}
        <div style={{ padding: "16px 16px 12px" }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            <Banknote size={14} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
            {t("monthlyElecCost", lang)}
            <span style={{ color: "var(--accent-red)", marginLeft: 2 }}>*</span>
          </label>

          <div style={{ position: "relative" }}>
            <input
              type="text"
              inputMode="numeric"
              value={formatCurrency(monthlyElecCost)}
              onChange={(e) => handleCostChange(e.target.value)}
              placeholder={t("monthlyElecCostPlaceholder", lang)}
              style={{
                width: "100%",
                height: 36,
                fontSize: 13,
                paddingRight: 36,
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 13,
                color: "var(--text-tertiary)",
                pointerEvents: "none",
              }}
            >
              {t("currencySuffix", lang)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom buttons (fixed) */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border-primary)",
          display: "flex",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onGoBack}
          style={{
            padding: "10px 20px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-primary)",
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
            fontSize: 13,
            fontWeight: 500,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-surface)";
          }}
        >
          {t("simPrevious", lang)}
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: canSubmit ? "var(--accent-orange)" : "var(--bg-surface)",
            color: canSubmit ? "#fff" : "var(--text-tertiary)",
            fontSize: 13,
            fontWeight: 600,
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.5,
          }}
          onMouseEnter={(e) => {
            if (canSubmit) e.currentTarget.style.background = "var(--accent-orange-hover)";
          }}
          onMouseLeave={(e) => {
            if (canSubmit) e.currentTarget.style.background = "var(--accent-orange)";
          }}
        >
          {t("simViewResults", lang)}
        </button>
      </div>
    </div>
  );
}
