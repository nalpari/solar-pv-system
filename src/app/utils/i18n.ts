export type Lang = "ja" | "en";

const translations = {
  // Sidebar Tabs
  tabSolarDesign: { ja: "太陽光設計", en: "Solar Design" },
  tabSimulationInput: { ja: "発電シミュレーション入力", en: "Simulation Input" },

  // AddressSearch
  searchAddress: { ja: "住所検索", en: "Search Address" },
  addressPlaceholder: { ja: "建物の住所を入力...", en: "Enter building address..." },
  searchButton: { ja: "Search", en: "Search" },

  // Building Confirm
  confirmBuilding: { ja: "建物確定", en: "Confirm Building" },
  confirmBuildingGuide: {
    ja: "※検索した住所の屋根がよく見えるように範囲を指定して確定してください。",
    en: "※Please specify the area so the roof of the searched address is clearly visible, then confirm.",
  },

  // Section Headers
  sectionRoofEdit: { ja: "屋根編集", en: "Roof Edit" },
  roofEditStart: { ja: "屋根編集", en: "Edit Roof" },
  roofEditing: { ja: "編集中", en: "Editing" },
  sectionModulePlacement: { ja: "モジュール配置", en: "Module Placement" },
  sectionGapSettings: { ja: "間隔設定", en: "Gap Settings" },

  // Slope Settings
  slopeSettings: { ja: "傾斜設定", en: "Slope Settings" },
  slopeUnit: { ja: "寸", en: " sun" },
  slopePlaceholder: { ja: "傾斜を選択", en: "Select slope" },

  // DrawingToolbar
  clearAll: { ja: "すべてクリア", en: "Clear All Areas" },

  // PanelConfig
  panelConfig: { ja: "パネル設定", en: "Panel Configuration" },
  panelType: { ja: "パネルタイプ", en: "Panel Type" },
  moduleSelect: { ja: "モジュール選択", en: "Module Selection" },
  moduleSelectPlaceholder: { ja: "選択", en: "Select" },
  widthMm: { ja: "幅 (mm)", en: "Width (mm)" },
  heightMm: { ja: "高さ (mm)", en: "Height (mm)" },
  orientation: { ja: "向き", en: "Orientation" },
  portrait: { ja: "縦置き", en: "Portrait" },
  landscape: { ja: "横置き", en: "Landscape" },
  panelGap: { ja: "モジュール上下左右間隔", en: "Module Spacing (All Sides)" },
  edgeMargin: { ja: "外周離隔", en: "Edge Margin" },
  perPanelPrefix: { ja: "パネル1枚あたり ", en: "" },
  perPanelSuffix: { ja: "", en: " per panel" },

  // PanelConfig presets
  preset60Cell: { ja: "標準 60セル", en: "Standard 60-Cell" },
  preset72Cell: { ja: "標準 72セル", en: "Standard 72-Cell" },
  presetLarge: { ja: "大型パネル", en: "Large Format" },
  presetCustom: { ja: "カスタム", en: "Custom" },

  // Action Buttons
  placeModules: { ja: "モジュール配置", en: "Place Modules" },
  deleteSelectedModules: { ja: "選択面モジュール削除", en: "Delete Selected Modules" },
  deleteAllModules: { ja: "モジュール全体削除", en: "Delete All Modules" },

  // Capacity
  installCapacity: { ja: "太陽光モジュール設置容量", en: "Installation Capacity" },
  capacityUnit: { ja: "枚", en: "panels" },

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

  // Bottom CTA
  simulationCalcInput: { ja: "発電シミュレーション計算入力", en: "Power Simulation Input" },

  // Simulation Panel
  azimuthSetting: { ja: "方位設定", en: "Azimuth Setting" },
  azimuthPlaceholder: { ja: "選択", en: "Select" },
  azimuthGuide: {
    ja: "南側を向いている屋根面の中で、モジュールが最も多く設置されている面の方位を選択してください。",
    en: "Please select the azimuth of the roof surface facing south where the most modules are installed.",
  },
  batterySetting: { ja: "蓄電池設定", en: "Battery Setting" },
  batteryDescription: {
    ja: "蓄電池とは？昼間に余った電気を蓄えて、夜や曇りの日でも使用できるバッテリー装置です。",
    en: "What is a battery? A battery device that stores excess daytime electricity for use at night or on cloudy days.",
  },
  batteryYes: { ja: "あり", en: "Yes" },
  batteryNo: { ja: "なし", en: "No" },
  monthlyElecCost: { ja: "月平均電気料金", en: "Monthly Avg. Electricity Cost" },
  monthlyElecCostPlaceholder: { ja: "例: 5,600", en: "e.g. 5,600" },
  simPrevious: { ja: "前へ", en: "Previous" },
  simViewResults: { ja: "発電シミュレーション結果照会", en: "View Simulation Results" },

  // Roof Edit Toolbar
  retSelectMove: { ja: "選択/移動", en: "Select / Move" },
  retSelectMoveGuide: {
    ja: "クリックで選択｜ドラッグで移動｜複数面クリックで重複選択｜空白クリックで解除",
    en: "Click to select | Drag to move | Click multiple surfaces to multi-select | Click empty area to deselect",
  },
  retDrawRoof: { ja: "屋根描画", en: "Draw Roof" },
  retDrawRoofGuide: {
    ja: "屋根の角をクリックして点を打ってください｜3つ以上 → 始点クリックで完成｜戻るボタンで最後の点を削除",
    en: "Click roof corners to place points | 3+ points → click start point to complete | Undo button to delete last point",
  },
  retDrawOpening: { ja: "開口描画", en: "Draw Opening" },
  retDrawOpeningGuide: {
    ja: "除外する領域をクリックして点を打ってください｜3つ以上 → 始点クリックで完成｜戻るボタンで最後の点を削除",
    en: "Click to place points on the area to exclude | 3+ points → click start point to complete | Undo button to delete last point",
  },
  retFlowSetting: { ja: "流れ設定", en: "Flow Setting" },
  retFlowSettingGuide: {
    ja: "屋根の軒先（下辺）を設定してください｜屋根面につき1つのみ設定可能｜モジュールが軒先と平行に配置されます",
    en: "Set the eave (bottom edge) of the roof | Only 1 per roof surface | Modules will be placed parallel to the eave",
  },
  retEditRoof: { ja: "屋根編集", en: "Edit Roof" },
  retEditRoofGuide: {
    ja: "頂点をドラッグして屋根の形状を調整してください｜点をダブルクリックで削除",
    en: "Drag vertices to adjust roof shape | Double-click a point to delete",
  },
  retDeleteSelected: { ja: "選択削除", en: "Delete Selected" },
  retDeleteSelectedGuide: {
    ja: "選択した面または障害物を削除します",
    en: "Delete the selected surface or obstacle",
  },
  retDeleteAll: { ja: "全体削除", en: "Delete All" },
  retDeleteAllGuide: {
    ja: "すべての屋根面と障害物を削除します",
    en: "Delete all roof surfaces and obstacles",
  },
  retUndo: { ja: "元に戻す", en: "Undo" },
  retUndoGuide: {
    ja: "直前の操作を元に戻します",
    en: "Undo the last operation",
  },
  retEndEditing: { ja: "編集終了", en: "End Editing" },

  // North roof warning
  northRoofWarning: {
    ja: "※北側の屋根面には太陽光モジュールの設置を推奨しません。\n※南向きの屋根面を優先して設置することを推奨します。",
    en: "※Installing solar modules on north-facing roof surfaces is not recommended.\n※Priority should be given to south-facing roof surfaces.",
  },

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

  // page.tsx (legacy key kept for compatibility)
  placePanels: { ja: "パネル配置", en: "Place Panels" },
  apiKeyRequired: { ja: "Google Maps APIキーが必要です", en: "Google Maps API Key Required" },
  apiKeyDescription: {
    ja: "インタラクティブマップを有効にするには、環境変数にAPIキーを設定してください。",
    en: "Set your API key as an environment variable to enable the interactive map.",
  },
  currencySuffix: { ja: "円", en: "¥" },

  requiredApis: {
    ja: "必要なAPI: Maps JavaScript, Places, Drawing, Geometry",
    en: "Required APIs: Maps JavaScript, Places, Drawing, Geometry",
  },
} as const;

type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key][lang];
}
