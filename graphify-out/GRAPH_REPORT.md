# Graph Report - .  (2026-04-30)

## Corpus Check
- Corpus is ~29,396 words - fits in a single context window. You may not need a graph.

## Summary
- 244 nodes · 292 edges · 32 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Address Search & i18n Shell|Address Search & i18n Shell]]
- [[_COMMUNITY_Pixel Geometry Helpers|Pixel Geometry Helpers]]
- [[_COMMUNITY_Crop & Panel Placement Pipeline|Crop & Panel Placement Pipeline]]
- [[_COMMUNITY_CropPopup Editor Internals|CropPopup Editor Internals]]
- [[_COMMUNITY_Project Architecture Doc|Project Architecture Doc]]
- [[_COMMUNITY_page.tsx State Handlers|page.tsx State Handlers]]
- [[_COMMUNITY_AI Agent Conventions|AI Agent Conventions]]
- [[_COMMUNITY_Feature Set Documentation|Feature Set Documentation]]
- [[_COMMUNITY_Map Pointer  Drag Interactions|Map Pointer / Drag Interactions]]
- [[_COMMUNITY_Polygon Editor Plans|Polygon Editor Plans]]
- [[_COMMUNITY_PanelConfig Module|PanelConfig Module]]
- [[_COMMUNITY_SimulationPanel Module|SimulationPanel Module]]
- [[_COMMUNITY_Hanwha Brand Asset|Hanwha Brand Asset]]
- [[_COMMUNITY_Place Select Handler|Place Select Handler]]
- [[_COMMUNITY_Crop Close Handler|Crop Close Handler]]
- [[_COMMUNITY_Delete All Panels Handler|Delete All Panels Handler]]
- [[_COMMUNITY_Simulation Tab Switch|Simulation Tab Switch]]
- [[_COMMUNITY_Undo Last Point|Undo Last Point]]
- [[_COMMUNITY_ESLint Flat Config Detail|ESLint Flat Config Detail]]
- [[_COMMUNITY_PostCSS Tailwind v4 Config|PostCSS Tailwind v4 Config]]
- [[_COMMUNITY_App Initialization Sequence|App Initialization Sequence]]
- [[_COMMUNITY_i18n Toggle Sequence|i18n Toggle Sequence]]
- [[_COMMUNITY_Area Calculation Sequence|Area Calculation Sequence]]
- [[_COMMUNITY_File Icon Asset|File Icon Asset]]
- [[_COMMUNITY_Map Point Marker Asset|Map Point Marker Asset]]
- [[_COMMUNITY_Vercel Logo Asset|Vercel Logo Asset]]
- [[_COMMUNITY_Next.js Logo Asset|Next.js Logo Asset]]
- [[_COMMUNITY_Roof Slope Diagram|Roof Slope Diagram]]
- [[_COMMUNITY_Roof Slope Categories|Roof Slope Categories]]
- [[_COMMUNITY_Compass Azimuth Asset|Compass Azimuth Asset]]
- [[_COMMUNITY_Globe Icon Asset|Globe Icon Asset]]
- [[_COMMUNITY_Window Icon Asset|Window Icon Asset]]

## God Nodes (most connected - your core abstractions)
1. `Home (root page component)` - 21 edges
2. `CropPopup component` - 19 edges
3. `Solar PV Planner` - 16 edges
4. `t (translation function)` - 12 edges
5. `notifyParent` - 10 edges
6. `notifyParent()` - 9 edges
7. `placePanels (latlng/mm)` - 9 edges
8. `placePanelsOnCanvas (pixel/mm)` - 8 edges
9. `System Overview (SPA)` - 8 edges
10. `handlePointerDown()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Eave Parallel Layout` --semantically_similar_to--> `Grid Placement Strategy`  [INFERRED] [semantically similar]
  README.md → docs/architecture.md
- `Three Panel Placement Functions` --conceptually_related_to--> `Panel Placement Calculation Flow`  [INFERRED]
  AGENTS.md → docs/architecture.md
- `Graphify Knowledge Graph Integration` --conceptually_related_to--> `Graphify Setup Overview`  [INFERRED]
  CLAUDE.md → docs/graphify-setup.md
- `findLongestEdgeIndex` --semantically_similar_to--> `placePanelsOnCanvas (pixel/mm)`  [INFERRED] [semantically similar]
  src/app/components/CropPopup.tsx → src/app/utils/panelPlacement.ts
- `Next.js config (standalone, reactCompiler)` --conceptually_related_to--> `RootLayout`  [INFERRED]
  next.config.ts → src/app/layout.tsx

## Hyperedges (group relationships)
- **Panel placement pipeline (cm UI -> mm internal -> grid placement)** — page_handleplacepanels, panelplacement_placepanelsoncanvascm, panelplacement_placepanelsoncanvas, panelplacement_insetpolygon, panelplacement_ispointinpolygon, panelplacement_rotate [EXTRACTED 0.95]
- **Left sidebar UI components** — header_header, addresssearch_addresssearch, panelconfig_panelconfig, resultspanel_resultspanel, simulationpanel_simulationpanel [EXTRACTED 0.90]
- **Crop selection -> capture -> roof edit flow** — mapview_cropoverlay, mapview_handleconfirm, page_handlecropcomplete, croppopup_croppopup, roofedittoolbar_roofedittoolbar [INFERRED 0.85]
- **Panel Placement Algorithm Pipeline** — architecture_coordinate_conversion, architecture_polygon_inset_algorithm, architecture_grid_placement_strategy [EXTRACTED 1.00]
- **Crop & Polygon Editor Workflow** — plan_canvas_polygon_editor, plan_pixel_to_latlng_conversion, readme_building_crop [EXTRACTED 1.00]
- **Polygon UX Improvement Suite** — plan_undo_feature, plan_polygon_selection_tooltip, plan_vertex_editing [EXTRACTED 1.00]

## Communities

### Community 0 - "Address Search & i18n Shell"
Cohesion: 0.1
Nodes (29): AddressSearch component, handleSelect (place getDetails), searchPlaces (Places autocomplete), Header component, Lang type (ja|en), t (translation function), translations table, RootLayout (+21 more)

### Community 1 - "Pixel Geometry Helpers"
Cohesion: 0.13
Nodes (20): computeMetersPerPixel(), convertAreas(), convertToPixelPolygons(), distanceToSegment(), finalizeVertexDrag(), findLongestEdgeIndex(), findNearestSnapVertex(), getCanvasCoords() (+12 more)

### Community 2 - "Crop & Panel Placement Pipeline"
Cohesion: 0.1
Nodes (26): AreaEntry interface, convertAreas, pixelToLatLng, handleConfirm (crop confirm), handleCropComplete, handlePlacePanels, ensureCCW, insetPolygon (+18 more)

### Community 3 - "CropPopup Editor Internals"
Cohesion: 0.12
Nodes (24): computeMetersPerPixel, convertToPixelPolygons, CropPopup component, distanceToSegment, finalizeVertexDrag, findLongestEdgeIndex, findNearestSnapVertex, handleDeletePolygon (+16 more)

### Community 4 - "Project Architecture Doc"
Cohesion: 0.1
Nodes (22): AGENTS.md AI Agent Guide, No Test Framework, Three Panel Placement Functions, Props-Down / Callbacks-Up Pattern, App Workflow, Address Search Flow, Component Tree, Coordinate Conversion (lat/lng <-> meters) (+14 more)

### Community 5 - "page.tsx State Handlers"
Cohesion: 0.16
Nodes (12): handlePlacePanels(), t(), ensureCCW(), insetPolygon(), lineIntersection(), metersPerLng(), placePanels(), placePanelsOnCanvas() (+4 more)

### Community 6 - "AI Agent Conventions"
Cohesion: 0.12
Nodes (17): Commit Message Convention, Conditional .claude/rules/ Loading, Graphify Knowledge Graph Integration, Korean Response Rule, CLAUDE.md Project Instructions, Post-Task Lint/Type/Build Checks, CockroachDB Case Study, Context Management Concept (+9 more)

### Community 7 - "Feature Set Documentation"
Cohesion: 0.13
Nodes (15): Address Search Feature, Auto Module Placement, Building Crop Feature, Japanese/English i18n Toggle, Image Save (PNG Export), Module Preset Selection, Module Preset Table, Placement Constants (GAP_CM, MARGIN_CM) (+7 more)

### Community 8 - "Map Pointer / Drag Interactions"
Cohesion: 0.27
Nodes (4): getCursorForTarget(), handlePointerDown(), handlePointerMove(), hitTest()

### Community 9 - "Polygon Editor Plans"
Cohesion: 0.25
Nodes (9): Canvas-Based Polygon Editor, Pixel to Lat/Lng Conversion, Polygon Selection Tooltip, Polygon UX Improvements Design, Polygon UX Improvements Plan, Roof Crop Design Document, Roof Crop & Polygon Editor Plan, Drawing Undo Feature (+1 more)

### Community 11 - "PanelConfig Module"
Cohesion: 0.5
Nodes (2): t(), getPresetSizes()

### Community 12 - "SimulationPanel Module"
Cohesion: 0.67
Nodes (2): handleCostChange(), update()

### Community 16 - "Hanwha Brand Asset"
Cohesion: 1.0
Nodes (2): Hanwha Japan (Brand Entity), Hanwha Japan Logo

### Community 23 - "Place Select Handler"
Cohesion: 1.0
Nodes (1): handlePlaceSelect

### Community 24 - "Crop Close Handler"
Cohesion: 1.0
Nodes (1): handleCropClose

### Community 25 - "Delete All Panels Handler"
Cohesion: 1.0
Nodes (1): handleDeleteAllPanels

### Community 26 - "Simulation Tab Switch"
Cohesion: 1.0
Nodes (1): switchToSimulation

### Community 27 - "Undo Last Point"
Cohesion: 1.0
Nodes (1): undoLastPoint

### Community 28 - "ESLint Flat Config Detail"
Cohesion: 1.0
Nodes (1): ESLint flat config

### Community 29 - "PostCSS Tailwind v4 Config"
Cohesion: 1.0
Nodes (1): PostCSS config (Tailwind v4)

### Community 30 - "App Initialization Sequence"
Cohesion: 1.0
Nodes (1): App Initialization Sequence

### Community 31 - "i18n Toggle Sequence"
Cohesion: 1.0
Nodes (1): i18n Language Toggle Sequence

### Community 32 - "Area Calculation Sequence"
Cohesion: 1.0
Nodes (1): Area Calculation Sequence

### Community 33 - "File Icon Asset"
Cohesion: 1.0
Nodes (1): File Icon

### Community 34 - "Map Point Marker Asset"
Cohesion: 1.0
Nodes (1): Map Point Marker

### Community 35 - "Vercel Logo Asset"
Cohesion: 1.0
Nodes (1): Vercel Logo

### Community 36 - "Next.js Logo Asset"
Cohesion: 1.0
Nodes (1): Next.js Logo

### Community 37 - "Roof Slope Diagram"
Cohesion: 1.0
Nodes (1): Roof Slope Diagram (Sun Units)

### Community 38 - "Roof Slope Categories"
Cohesion: 1.0
Nodes (1): Roof Slope Categories: 6寸 / 3寸 / 4寸

### Community 39 - "Compass Azimuth Asset"
Cohesion: 1.0
Nodes (1): Compass / Azimuth Indicator

### Community 40 - "Globe Icon Asset"
Cohesion: 1.0
Nodes (1): Globe Icon

### Community 41 - "Window Icon Asset"
Cohesion: 1.0
Nodes (1): Window Icon

## Knowledge Gaps
- **87 isolated node(s):** `SectionHeader (sub-component)`, `handlePlaceSelect`, `handleCropComplete`, `handleAreasChange`, `handlePixelAreasChange` (+82 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `PanelConfig Module`** (4 nodes): `t()`, `getPresetSizes()`, `handlePresetChange()`, `PanelConfig.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SimulationPanel Module`** (4 nodes): `formatCurrency()`, `handleCostChange()`, `update()`, `SimulationPanel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hanwha Brand Asset`** (2 nodes): `Hanwha Japan (Brand Entity)`, `Hanwha Japan Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Place Select Handler`** (1 nodes): `handlePlaceSelect`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Crop Close Handler`** (1 nodes): `handleCropClose`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Delete All Panels Handler`** (1 nodes): `handleDeleteAllPanels`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Simulation Tab Switch`** (1 nodes): `switchToSimulation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Undo Last Point`** (1 nodes): `undoLastPoint`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ESLint Flat Config Detail`** (1 nodes): `ESLint flat config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Tailwind v4 Config`** (1 nodes): `PostCSS config (Tailwind v4)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Initialization Sequence`** (1 nodes): `App Initialization Sequence`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `i18n Toggle Sequence`** (1 nodes): `i18n Language Toggle Sequence`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Area Calculation Sequence`** (1 nodes): `Area Calculation Sequence`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Icon Asset`** (1 nodes): `File Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Map Point Marker Asset`** (1 nodes): `Map Point Marker`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vercel Logo Asset`** (1 nodes): `Vercel Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Logo Asset`** (1 nodes): `Next.js Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Roof Slope Diagram`** (1 nodes): `Roof Slope Diagram (Sun Units)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Roof Slope Categories`** (1 nodes): `Roof Slope Categories: 6寸 / 3寸 / 4寸`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Compass Azimuth Asset`** (1 nodes): `Compass / Azimuth Indicator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Globe Icon Asset`** (1 nodes): `Globe Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Window Icon Asset`** (1 nodes): `Window Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CropPopup component` connect `CropPopup Editor Internals` to `Address Search & i18n Shell`, `Crop & Panel Placement Pipeline`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `Home (root page component)` connect `Address Search & i18n Shell` to `Crop & Panel Placement Pipeline`, `CropPopup Editor Internals`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `Solar PV Planner` connect `Feature Set Documentation` to `Project Architecture Doc`, `AI Agent Conventions`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Home (root page component)` (e.g. with `MapView component` and `CropPopup component`) actually correct?**
  _`Home (root page component)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `CropPopup component` (e.g. with `Home (root page component)` and `handleDeleteAll`) actually correct?**
  _`CropPopup component` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `notifyParent` (e.g. with `handleAreasChange` and `handlePixelAreasChange`) actually correct?**
  _`notifyParent` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `SectionHeader (sub-component)`, `handlePlaceSelect`, `handleCropComplete` to the rest of the system?**
  _87 weakly-connected nodes found - possible documentation gaps or missing edges._