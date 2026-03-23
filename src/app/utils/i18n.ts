export type Lang = "ja" | "en";

const translations = {
  // AddressSearch
  searchAddress: { ja: "住所検索", en: "Search Address" },
  addressPlaceholder: { ja: "建物の住所を入力...", en: "Enter building address..." },

  // DrawingToolbar
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
  perPanelPrefix: { ja: "パネル1枚あたり ", en: "" },
  perPanelSuffix: { ja: "", en: " per panel" },

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

  // CropToolbar
  cropTools: { ja: "屋根選択", en: "Roof Selection" },
  cropMode: { ja: "範囲選択", en: "Select Area" },
  cropModeActive: { ja: "地図上でドラッグして範囲を選択", en: "Drag on map to select area" },
  cropConfirmArea: { ja: "確定", en: "Confirm" },

  // CropPopup
  cropEditor: { ja: "屋根エディタ", en: "Roof Editor" },
  cropInstallArea: { ja: "設置エリア", en: "Installation Area" },
  cropExcludeZone: { ja: "除外ゾーン", en: "Exclusion Zone" },
  cropConfirm: { ja: "確定", en: "Confirm" },
  cropCancel: { ja: "キャンセル", en: "Cancel" },
  cropSelectMove: { ja: "選択 / 移動", en: "Select / Move" },
  cropDrawPrompt: {
    ja: "範囲を選択すると屋根エディタが表示されます。",
    en: "Select an area on the map to open the roof editor.",
  },

  // CropPopup save
  cropSave: { ja: "保存", en: "Save" },

  // Polygon edit
  polygonMove: { ja: "移動", en: "Move" },
  polygonDelete: { ja: "削除", en: "Delete" },
  polygonEditVertices: { ja: "頂点編集", en: "Edit Vertices" },
  undoLastPoint: { ja: "元に戻す", en: "Undo" },

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
