# Graph Report - /Users/devgrr/dev/interplug/solar-pv-system  (2026-05-07)

## Corpus Check
- Corpus is ~29,412 words - fits in a single context window. You may not need a graph.

## Summary
- 278 nodes · 330 edges · 34 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Architecture & Workflow Docs|Architecture & Workflow Docs]]
- [[_COMMUNITY_Canvas Polygon Editor Logic|Canvas Polygon Editor Logic]]
- [[_COMMUNITY_Map, Search & i18n Components|Map, Search & i18n Components]]
- [[_COMMUNITY_High-Level Architecture Map|High-Level Architecture Map]]
- [[_COMMUNITY_Panel Placement Geometry|Panel Placement Geometry]]
- [[_COMMUNITY_CropPopup Editor|CropPopup Editor]]
- [[_COMMUNITY_Page Orchestration Handlers|Page Orchestration Handlers]]
- [[_COMMUNITY_Tech Stack & Tooling|Tech Stack & Tooling]]
- [[_COMMUNITY_MapView Pointer Handlers|MapView Pointer Handlers]]
- [[_COMMUNITY_Polygon UX Design Docs|Polygon UX Design Docs]]
- [[_COMMUNITY_Graphify Integration|Graphify Integration]]
- [[_COMMUNITY_Context Management Concepts|Context Management Concepts]]
- [[_COMMUNITY_Simulation Panel|Simulation Panel]]
- [[_COMMUNITY_PostCSS Doc|PostCSS Doc]]
- [[_COMMUNITY_ESLint Doc|ESLint Doc]]
- [[_COMMUNITY_handlePlaceSelect|handlePlaceSelect]]
- [[_COMMUNITY_handleCropClose|handleCropClose]]
- [[_COMMUNITY_handleDeleteAllPanels|handleDeleteAllPanels]]
- [[_COMMUNITY_switchToSimulation|switchToSimulation]]
- [[_COMMUNITY_undoLastPoint|undoLastPoint]]
- [[_COMMUNITY_App Init Sequence|App Init Sequence]]
- [[_COMMUNITY_i18n Toggle Sequence|i18n Toggle Sequence]]
- [[_COMMUNITY_Area Calc Sequence|Area Calc Sequence]]
- [[_COMMUNITY_Hanwha Japan Logo|Hanwha Japan Logo]]
- [[_COMMUNITY_Hanwha Japan Brand|Hanwha Japan Brand]]
- [[_COMMUNITY_File Icon Asset|File Icon Asset]]
- [[_COMMUNITY_Map Marker Asset|Map Marker Asset]]
- [[_COMMUNITY_Vercel Logo Asset|Vercel Logo Asset]]
- [[_COMMUNITY_Next.js Logo Asset|Next.js Logo Asset]]
- [[_COMMUNITY_Roof Slope Diagram|Roof Slope Diagram]]
- [[_COMMUNITY_Roof Slope Categories|Roof Slope Categories]]
- [[_COMMUNITY_Compass  Azimuth Indicator|Compass / Azimuth Indicator]]
- [[_COMMUNITY_Globe Icon Asset|Globe Icon Asset]]
- [[_COMMUNITY_Window Icon Asset|Window Icon Asset]]

## God Nodes (most connected - your core abstractions)
1. `Home (root page component)` - 21 edges
2. `CropPopup component` - 19 edges
3. `Solar PV Planner` - 15 edges
4. `t (translation function)` - 12 edges
5. `Home Page (src/app/page.tsx)` - 12 edges
6. `notifyParent` - 10 edges
7. `notifyParent()` - 9 edges
8. `placePanels (latlng/mm)` - 9 edges
9. `placePanelsOnCanvas (pixel/mm)` - 8 edges
10. `System Overview (SPA)` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Eave Parallel Layout` --semantically_similar_to--> `Grid Placement Strategy`  [INFERRED] [semantically similar]
  README.md → docs/architecture.md
- `Solar PV Rooftop Layout Planner Architecture` --semantically_similar_to--> `Solar PV Code Map Playground (HTML)`  [INFERRED] [semantically similar]
  CLAUDE.md → docs/codemap-playground.html
- `Three Panel Placement Functions` --conceptually_related_to--> `Panel Placement Calculation Flow`  [INFERRED]
  AGENTS.md → docs/architecture.md
- `Home Page (src/app/page.tsx)` --conceptually_related_to--> `Rule: components.md`  [INFERRED]
  docs/codemap-playground.html → CLAUDE.md
- `placePanels() (utils/panelPlacement.ts)` --conceptually_related_to--> `Rule: utils.md`  [INFERRED]
  docs/codemap-playground.html → CLAUDE.md

## Hyperedges (group relationships)
- **Left sidebar UI components** — header_header, addresssearch_addresssearch, panelconfig_panelconfig, resultspanel_resultspanel, simulationpanel_simulationpanel [EXTRACTED 0.90]
- **Crop selection -> capture -> roof edit flow** — mapview_cropoverlay, mapview_handleconfirm, page_handlecropcomplete, croppopup_croppopup, roofedittoolbar_roofedittoolbar [INFERRED 0.85]
- **Panel placement pipeline (cm UI -> mm internal -> grid placement)** — page_handleplacepanels, panelplacement_placepanelsoncanvascm, panelplacement_placepanelsoncanvas, panelplacement_insetpolygon, panelplacement_ispointinpolygon, panelplacement_rotate [EXTRACTED 0.95]
- **Panel Placement Algorithm Pipeline** — architecture_coordinate_conversion, architecture_polygon_inset_algorithm, architecture_grid_placement_strategy [EXTRACTED 1.00]
- **Crop & Polygon Editor Workflow** — plan_canvas_polygon_editor, plan_pixel_to_latlng_conversion, readme_building_crop [EXTRACTED 1.00]
- **Polygon UX Improvement Suite** — plan_undo_feature, plan_polygon_selection_tooltip, plan_vertex_editing [EXTRACTED 1.00]
- **Home page orchestrates UI components via props/callbacks** — codemap_node_home_page, codemap_node_address_search, codemap_node_drawing_toolbar, codemap_node_panel_config, codemap_node_results_panel, codemap_node_map_view [EXTRACTED 1.00]
- **MapView composes internal map overlays** — codemap_node_map_view, codemap_node_center_updater, codemap_node_drawing_overlay, codemap_node_panel_overlay, codemap_node_map_controls [EXTRACTED 1.00]
- **Panel placement geometry pipeline** — codemap_node_place_panels, codemap_node_inset_polygon, codemap_node_point_in_polygon, codemap_node_coord_transform [EXTRACTED 1.00]

## Communities

### Community 0 - "Architecture & Workflow Docs"
Cohesion: 0.06
Nodes (37): AGENTS.md AI Agent Guide, No Test Framework, Three Panel Placement Functions, Props-Down / Callbacks-Up Pattern, App Workflow, Address Search Flow, Component Tree, Coordinate Conversion (lat/lng <-> meters) (+29 more)

### Community 1 - "Canvas Polygon Editor Logic"
Cohesion: 0.11
Nodes (22): computeMetersPerPixel(), convertAreas(), convertToPixelPolygons(), distanceToSegment(), finalizeVertexDrag(), findLongestEdgeIndex(), findNearestSnapVertex(), getCanvasCoords() (+14 more)

### Community 2 - "Map, Search & i18n Components"
Cohesion: 0.09
Nodes (30): AddressSearch component, handleSelect (place getDetails), searchPlaces (Places autocomplete), Header component, Lang type (ja|en), t (translation function), translations table, RootLayout (+22 more)

### Community 3 - "High-Level Architecture Map"
Cohesion: 0.09
Nodes (26): Solar PV Rooftop Layout Planner Architecture, Rule: components.md, Rule: docker.md, Rule: styles.md, Rule: utils.md, Connection Types (data-flow/callback/api-call/import), Layer Taxonomy (framework/page/ui/map/logic/types/external), AddressSearch Component (+18 more)

### Community 4 - "Panel Placement Geometry"
Cohesion: 0.1
Nodes (26): AreaEntry interface, convertAreas, pixelToLatLng, handleConfirm (crop confirm), handleCropComplete, handlePlacePanels, ensureCCW, insetPolygon (+18 more)

### Community 5 - "CropPopup Editor"
Cohesion: 0.12
Nodes (23): computeMetersPerPixel, convertToPixelPolygons, CropPopup component, distanceToSegment, finalizeVertexDrag, findLongestEdgeIndex, findNearestSnapVertex, handleDeletePolygon (+15 more)

### Community 6 - "Page Orchestration Handlers"
Cohesion: 0.16
Nodes (12): handlePlacePanels(), t(), ensureCCW(), insetPolygon(), lineIntersection(), metersPerLng(), placePanels(), placePanelsOnCanvas() (+4 more)

### Community 7 - "Tech Stack & Tooling"
Cohesion: 0.17
Nodes (12): AGENTS.md Common Guide, Claude Code Guidance Document, Google Maps via @vis.gl/react-google-maps, graphify Knowledge Graph Integration, html2canvas Map Tile Capture, Path Alias @/* -> ./src/*, pnpm Commands (dev/build/start/lint), React Compiler (reactCompiler: true) (+4 more)

### Community 8 - "MapView Pointer Handlers"
Cohesion: 0.27
Nodes (4): getCursorForTarget(), handlePointerDown(), handlePointerMove(), hitTest()

### Community 9 - "Polygon UX Design Docs"
Cohesion: 0.25
Nodes (9): Canvas-Based Polygon Editor, Pixel to Lat/Lng Conversion, Polygon Selection Tooltip, Polygon UX Improvements Design, Polygon UX Improvements Plan, Roof Crop Design Document, Roof Crop & Polygon Editor Plan, Drawing Undo Feature (+1 more)

### Community 10 - "Graphify Integration"
Cohesion: 0.33
Nodes (6): graphify-out gitignore Policy, Graphify Setup Overview, Project Always-On Integration, Graphify Query Commands, Global Claude Code Skill Registration, uv Tool Installation

### Community 12 - "Context Management Concepts"
Cohesion: 0.4
Nodes (5): CockroachDB Case Study, Context Management Concept, Front Matter Conditional Loading, McDonald's Manual Analogy, Trigger.dev Case Study

### Community 13 - "Simulation Panel"
Cohesion: 0.67
Nodes (2): handleCostChange(), update()

### Community 23 - "PostCSS Doc"
Cohesion: 1.0
Nodes (1): PostCSS config (Tailwind v4)

### Community 24 - "ESLint Doc"
Cohesion: 1.0
Nodes (1): ESLint flat config

### Community 25 - "handlePlaceSelect"
Cohesion: 1.0
Nodes (1): handlePlaceSelect

### Community 26 - "handleCropClose"
Cohesion: 1.0
Nodes (1): handleCropClose

### Community 27 - "handleDeleteAllPanels"
Cohesion: 1.0
Nodes (1): handleDeleteAllPanels

### Community 28 - "switchToSimulation"
Cohesion: 1.0
Nodes (1): switchToSimulation

### Community 29 - "undoLastPoint"
Cohesion: 1.0
Nodes (1): undoLastPoint

### Community 30 - "App Init Sequence"
Cohesion: 1.0
Nodes (1): App Initialization Sequence

### Community 31 - "i18n Toggle Sequence"
Cohesion: 1.0
Nodes (1): i18n Language Toggle Sequence

### Community 32 - "Area Calc Sequence"
Cohesion: 1.0
Nodes (1): Area Calculation Sequence

### Community 33 - "Hanwha Japan Logo"
Cohesion: 1.0
Nodes (1): Hanwha Japan Logo

### Community 34 - "Hanwha Japan Brand"
Cohesion: 1.0
Nodes (1): Hanwha Japan (Brand Entity)

### Community 35 - "File Icon Asset"
Cohesion: 1.0
Nodes (1): File Icon

### Community 36 - "Map Marker Asset"
Cohesion: 1.0
Nodes (1): Map Point Marker

### Community 37 - "Vercel Logo Asset"
Cohesion: 1.0
Nodes (1): Vercel Logo

### Community 38 - "Next.js Logo Asset"
Cohesion: 1.0
Nodes (1): Next.js Logo

### Community 39 - "Roof Slope Diagram"
Cohesion: 1.0
Nodes (1): Roof Slope Diagram (Sun Units)

### Community 40 - "Roof Slope Categories"
Cohesion: 1.0
Nodes (1): Roof Slope Categories: 6寸 / 3寸 / 4寸

### Community 41 - "Compass / Azimuth Indicator"
Cohesion: 1.0
Nodes (1): Compass / Azimuth Indicator

### Community 42 - "Globe Icon Asset"
Cohesion: 1.0
Nodes (1): Globe Icon

### Community 43 - "Window Icon Asset"
Cohesion: 1.0
Nodes (1): Window Icon

## Knowledge Gaps
- **102 isolated node(s):** `PostCSS config (Tailwind v4)`, `ESLint flat config`, `Next.js config (standalone, reactCompiler)`, `SectionHeader (sub-component)`, `handlePlaceSelect` (+97 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Simulation Panel`** (4 nodes): `formatCurrency()`, `handleCostChange()`, `update()`, `SimulationPanel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Doc`** (1 nodes): `PostCSS config (Tailwind v4)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ESLint Doc`** (1 nodes): `ESLint flat config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `handlePlaceSelect`** (1 nodes): `handlePlaceSelect`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `handleCropClose`** (1 nodes): `handleCropClose`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `handleDeleteAllPanels`** (1 nodes): `handleDeleteAllPanels`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `switchToSimulation`** (1 nodes): `switchToSimulation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `undoLastPoint`** (1 nodes): `undoLastPoint`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Init Sequence`** (1 nodes): `App Initialization Sequence`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `i18n Toggle Sequence`** (1 nodes): `i18n Language Toggle Sequence`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Area Calc Sequence`** (1 nodes): `Area Calculation Sequence`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hanwha Japan Logo`** (1 nodes): `Hanwha Japan Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hanwha Japan Brand`** (1 nodes): `Hanwha Japan (Brand Entity)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Icon Asset`** (1 nodes): `File Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Map Marker Asset`** (1 nodes): `Map Point Marker`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vercel Logo Asset`** (1 nodes): `Vercel Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Logo Asset`** (1 nodes): `Next.js Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Roof Slope Diagram`** (1 nodes): `Roof Slope Diagram (Sun Units)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Roof Slope Categories`** (1 nodes): `Roof Slope Categories: 6寸 / 3寸 / 4寸`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Compass / Azimuth Indicator`** (1 nodes): `Compass / Azimuth Indicator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Globe Icon Asset`** (1 nodes): `Globe Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Window Icon Asset`** (1 nodes): `Window Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CropPopup component` connect `CropPopup Editor` to `Map, Search & i18n Components`, `Panel Placement Geometry`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `Home (root page component)` connect `Map, Search & i18n Components` to `Panel Placement Geometry`, `CropPopup Editor`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Home (root page component)` (e.g. with `RootLayout` and `MapView component`) actually correct?**
  _`Home (root page component)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `CropPopup component` (e.g. with `Home (root page component)` and `handleDeleteAll`) actually correct?**
  _`CropPopup component` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PostCSS config (Tailwind v4)`, `ESLint flat config`, `Next.js config (standalone, reactCompiler)` to the rest of the system?**
  _102 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Architecture & Workflow Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Canvas Polygon Editor Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._