export type Lang = "ja" | "en";

const translations = {
  // Sidebar Tabs
  tabSolarDesign: { ja: "太陽光設計", en: "Solar Design" },
  tabSimulationInput: { ja: "発電シミュレーション入力", en: "Simulation Input" },

  // AddressSearch
  searchAddress: { ja: "住所検索", en: "Search Address" },
  addressPlaceholder: { ja: "建物の住所を入力...", en: "Enter building address..." },
  searchButton: { ja: "検索", en: "Search" },

  // Building Confirm
  confirmBuilding: { ja: "建物確定", en: "Confirm Building" },
  confirmBuildingGuide: {
    ja: "※検索した住所の屋根がよく見えるように範囲を指定して確定してください。",
    en: "※Please specify the area so the roof of the searched address is clearly visible, then confirm.",
  },

  // Section Headers
  sectionRoofEdit: { ja: "屋根編集", en: "Roof Edit" },
  sectionModulePlacement: { ja: "モジュール配置", en: "Module Placement" },
  sectionGapSettings: { ja: "間隔設定", en: "Gap Settings" },

  // Slope Settings
  slopeSettings: { ja: "傾斜設定", en: "Slope Settings" },
  slopeUnit: { ja: "寸", en: " sun" },
  slopeLabel1: { ja: "緩やかな屋根（約1寸）", en: "Gentle roof (~1寸)" },
  slopeLabel3: { ja: "やや緩やかな屋根（約3寸）", en: "Slightly gentle roof (~3寸)" },
  slopeLabel4: { ja: "標準屋根（約4寸）", en: "Standard roof (~4寸)" },
  slopeLabel6: { ja: "やや急な屋根（約6寸）", en: "Slightly steep roof (~6寸)" },
  slopeLabel8: { ja: "急な屋根（約8寸）", en: "Steep roof (~8寸)" },
  slopePlaceholder: { ja: "傾斜を選択", en: "Select slope" },

  // PanelConfig
  panelConfig: { ja: "パネル設定", en: "Panel Configuration" },
  panelType: { ja: "パネルタイプ", en: "Panel Type" },
  moduleSelect: { ja: "モジュール選択", en: "Module Selection" },
  moduleSelectPlaceholder: { ja: "太陽電池モジュール選択", en: "Select solar module" },
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
  modulePlacementDone: { ja: "モジュール配置完了", en: "Module Placement Done" },
  moduleEditReturn: { ja: "モジュール編集に戻る", en: "Return to Module Editing" },
  backToModuleEdit: { ja: "モジュール編集に戻る", en: "Back to Module Edit" },

  // PV logo + new Lnb section titles
  pvLogoAlt: { ja: "Hanwha Japan PV Simulation", en: "Hanwha Japan PV Simulation" },
  sectionRoofSlope: { ja: "屋根面傾斜", en: "Roof Slope" },
  selectPlaceholder: { ja: "選択", en: "Select" },
  tabSolarDesignShort: { ja: "ソーラーデザイン", en: "Solar Design" },
  tabSimulationShort: { ja: "発電シミュレーション", en: "Simulation" },
  buildingConfirmHint: {
    ja: "※太陽光モジュールを設置する屋根がよく見えるように 範囲を調整して確定します.",
    en: "※Adjust the area so the roof for solar module installation is clearly visible, then confirm.",
  },

  // Lnb design tab — module placement actions
  btnAlignedPlacement: { ja: "整列配置", en: "Aligned Layout" },
  btnStaggeredPlacement: { ja: "千鳥配置", en: "Staggered Layout" },
  btnDeleteModule: { ja: "モジュールの削除", en: "Delete Modules" },
  hintNorthRoofNotRecommended: {
    ja: "※北面への設置は日射量が少なく、発電量や経済効果が低下しやすいです. また、反射光により近隣とのトラブルにつながる可能性があるため、原則として推奨しておりません.",
    en: "※Installing on north-facing roofs is not recommended — sunlight is limited, lowering power output and economic benefit. Reflected light can also cause neighbor disputes.",
  },
  hintMixedPanelsNotSupported: {
    ja: "※本ツールは複数種類のパネルの混合配置には対応いたしません. あらかじめご了承ください.",
    en: "※This tool does not support mixing multiple panel types. Please note.",
  },

  // Lnb sim tab — azimuth guide split into two lines (pv-pub layout)
  azimuthGuideLine1: {
    ja: "モジュールを載せる屋根の方位を選択してください.",
    en: "Please select the azimuth of the roof where the modules will be mounted.",
  },
  azimuthGuideLine2: {
    ja: "複数の屋根面にモジュールを設置する場合、最も広い屋根面の方位を選択してください.",
    en: "When installing on multiple roof surfaces, choose the azimuth of the largest surface.",
  },
  batteryShort: { ja: "蓄電池", en: "Battery" },
  batteryUnitDescription: {
    ja: "※太陽光で作った電気を保存しておき 必要なとき 使用するバッテリーユニットです.",
    en: "※A battery unit that stores electricity generated by the solar panels for use when needed.",
  },

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
  retDrawRoof: { ja: "屋根作成", en: "Create Roof" },
  retDrawRoofGuide: {
    ja: "屋根の角をクリックして点を打ってください｜3つ以上 → 始点クリックで完成｜戻るボタンで最後の点を削除",
    en: "Click roof corners to place points | 3+ points → click start point to complete | Undo button to delete last point",
  },
  retDrawOpening: { ja: "障害物の作成", en: "Create Obstacle" },
  retDrawOpeningGuide: {
    ja: "除外する領域をクリックして点を打ってください｜3つ以上 → 始点クリックで完成｜戻るボタンで最後の点を削除",
    en: "Click to place points on the area to exclude | 3+ points → click start point to complete | Undo button to delete last point",
  },
  retFlowSetting: { ja: "フロー設定", en: "Flow Setting" },
  retFlowSettingGuide: {
    ja: "屋根の軒先（下辺）を設定してください｜屋根面につき1つのみ設定可能｜モジュールが軒先と平行に配置されます",
    en: "Set the eave (bottom edge) of the roof | Only 1 per roof surface | Modules will be placed parallel to the eave",
  },
  retEditRoof: { ja: "屋根の編集", en: "Edit Roof" },
  retEditRoofGuide: {
    ja: "頂点をドラッグして屋根の形状を調整してください｜点をダブルクリックで削除",
    en: "Drag vertices to adjust roof shape | Double-click a point to delete",
  },
  retDeleteSelected: { ja: "屋根面選択を削除", en: "Delete Selected Roof" },
  retDeleteSelectedGuide: {
    ja: "選択した面または障害物を削除します",
    en: "Delete the selected surface or obstacle",
  },
  retDeleteAll: { ja: "屋根面全体削除", en: "Delete All Roofs" },
  retDeleteAllGuide: {
    ja: "すべての屋根面と障害物を削除します",
    en: "Delete all roof surfaces and obstacles",
  },
  retUndo: { ja: "戻る", en: "Back" },
  retUndoGuide: {
    ja: "直前の操作を元に戻します",
    en: "Undo the last operation",
  },
  retComplete: { ja: "作成完了", en: "Complete" },
  retCompleteGuide: {
    ja: "編集を終え、選択/移動モードに戻ります",
    en: "Finish editing and return to select/move mode",
  },

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
  cropAreaSelectGuide: { ja: "確定する屋根の範囲を指定してください", en: "Specify the area of the roof to confirm" },
  cropAreaCancel: { ja: "キャンセル", en: "Cancel" },

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

  // Polygon edit
  undoLastPoint: { ja: "元に戻す", en: "Undo" },

  // page.tsx (legacy key kept for compatibility)
  placePanels: { ja: "パネル配置", en: "Place Panels" },
  apiKeyRequired: { ja: "Google Maps APIキーが必要です", en: "Google Maps API Key Required" },
  apiKeyDescription: {
    ja: "インタラクティブマップを有効にするには、環境変数にAPIキーを設定してください。",
    en: "Set your API key as an environment variable to enable the interactive map.",
  },
  currencySuffix: { ja: "円", en: "¥" },

  panelPlacementFailed: {
    ja: "モジュール配置に失敗しました。設置面積や設定を確認してください。",
    en: "Module placement failed. Please check the installation area and settings.",
  },

  requiredApis: {
    ja: "必要なAPI: Maps JavaScript, Places, Geometry",
    en: "Required APIs: Maps JavaScript, Places, Geometry",
  },

  // AI Roof Detection — 수동 트리거 (Phase 7)
  aiDetectStart: {
    ja: "AI 分析開始",
    en: "Start AI Analysis",
  },
  aiDetectInProgress: {
    ja: "AI 分析中",
    en: "AI Analyzing...",
  },
  aiDetectCancel: {
    ja: "AI 分析キャンセル",
    en: "Cancel AI Analysis",
  },
  aiDetectConfirmReanalyze: {
    ja: "AI 分析を再実行しますか? 作成された屋根面情報がすべて初期化されます。",
    en: "Re-run AI analysis? All created roof faces will be reset.",
  },
  aiDetectFailedAlert: {
    ja: "AI 分析に失敗しました。しばらく後でもう一度お試しください。",
    en: "AI analysis failed. Please try again later.",
  },
} as const;

type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key][lang];
}
