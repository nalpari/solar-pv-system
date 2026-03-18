export type Lang = "ja" | "en";

const translations = {
  // AddressSearch
  searchAddress: { ja: "住所検索", en: "Search Address" },
  addressPlaceholder: { ja: "建物の住所を入力...", en: "Enter building address..." },

  // DrawingToolbar
  drawingTools: { ja: "描画ツール", en: "Drawing Tools" },
  selectMove: { ja: "選択 / 移動", en: "Select / Move" },
  installationArea: { ja: "設置エリア", en: "Installation Area" },
  exclusionZone: { ja: "除外ゾーン", en: "Exclusion Zone" },
  clearAll: { ja: "すべてクリア", en: "Clear All Areas" },

  // PanelConfig
  panelConfig: { ja: "パネル設定", en: "Panel Configuration" },
  panelType: { ja: "パネルタイプ", en: "Panel Type" },
  widthMm: { ja: "幅 (mm)", en: "Width (mm)" },
  heightMm: { ja: "高さ (mm)", en: "Height (mm)" },
  orientation: { ja: "向き", en: "Orientation" },
  portrait: { ja: "縦置き", en: "Portrait" },
  landscape: { ja: "横置き", en: "Landscape" },
  panelGap: { ja: "パネル間隔", en: "Panel Gap" },
  edgeMargin: { ja: "端部マージン", en: "Edge Margin" },
  perPanel: { ja: "パネル1枚あたり", en: "per panel" },

  // PanelConfig presets
  preset60Cell: { ja: "標準 60セル", en: "Standard 60-Cell" },
  preset72Cell: { ja: "標準 72セル", en: "Standard 72-Cell" },
  presetLarge: { ja: "大型パネル", en: "Large Format" },
  presetCustom: { ja: "カスタム", en: "Custom" },

  // ResultsPanel
  layoutResults: { ja: "レイアウト結果", en: "Layout Results" },
  totalPanels: { ja: "総パネル数", en: "Total Panels" },
  panelCoverage: { ja: "パネル面積", en: "Panel Coverage" },
  coverageRate: { ja: "カバー率", en: "Coverage Rate" },
  drawPrompt: {
    ja: "地図上に設置エリアを描画すると、パネルレイアウトの結果が表示されます。",
    en: "Draw an installation area on the map to see panel layout results.",
  },
  installArea: { ja: "設置面積", en: "Install Area" },
  exclusionZoneResult: { ja: "除外ゾーン", en: "Exclusion Zone" },
  netAvailable: { ja: "有効面積", en: "Net Available" },
  estimatePower: { ja: "発電量を見積もる", en: "Estimate Power Generation" },
  powerComingSoon: { ja: "発電量の見積もり — 近日公開", en: "Power estimation — coming soon" },

  // MapView
  zoomIn: { ja: "拡大", en: "Zoom in" },
  zoomOut: { ja: "縮小", en: "Zoom out" },
  toggleSatellite: { ja: "衛星写真切替", en: "Toggle satellite view" },
  recenterMap: { ja: "地図を中央に戻す", en: "Recenter map" },
  drawInstall: { ja: "クリックして設置エリアを描画", en: "Click to draw installation area" },
  drawExclude: { ja: "クリックして除外ゾーンを描画", en: "Click to draw exclusion zone" },

  // page.tsx
  placePanels: { ja: "パネル配置", en: "Place Panels" },
  apiKeyRequired: { ja: "Google Maps APIキーが必要です", en: "Google Maps API Key Required" },
  apiKeyDescription: {
    ja: "インタラクティブマップを有効にするには、環境変数にAPIキーを設定してください。",
    en: "Set your API key as an environment variable to enable the interactive map.",
  },
  requiredApis: {
    ja: "必要なAPI: Maps JavaScript, Places, Drawing, Geometry",
    en: "Required APIs: Maps JavaScript, Places, Drawing, Geometry",
  },
} as const;

type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key][lang];
}
