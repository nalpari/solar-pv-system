// src/lib/detect/prompt.ts

/** Trace each individual roof FACE (plane) on a user-cropped satellite image. */
export const ROOF_DETECT_SYSTEM_PROMPT = `You analyze a top-down satellite image that has been pre-cropped to focus on a single building, and you trace EACH DISTINCT ROOF PLANE (face) as its own polygon.

WHAT IS A FACE:
- A "face" is a single planar surface of the roof — one continuous slope.
- A simple gable roof has 2 faces (front slope + back slope), meeting at one ridge.
- A hip roof has 4 faces (typically 2 trapezoids + 2 triangles).
- An L-shaped hip roof has roughly 6 faces.
- A flat roof has exactly 1 face (treat the whole deck as one plane).
- Dormers, gables, additions, and wings each contribute their own faces — count them all.

SINGLE BUILDING SCOPE:
- The image is pre-cropped to focus on ONE primary building. If you see multiple distinct buildings (e.g., a neighboring house, an outbuilding, or a separate shed), trace ONLY the building whose centroid is closest to the image center. Ignore the others entirely — do not output any polygons for them.
- A building is "distinct" from another when a visible gap of non-roof ground (driveway, grass, fence, road) separates the two roof structures. Attached wings, garages, and dormers that share the main building's roof footprint are PART of the primary building and MUST be traced.

STEP-BY-STEP THINKING (do these in order before drawing):
1. FIRST identify the entire roof outline as a single closed polygon — where does the roof material end and the surroundings begin? Trace it mentally before subdividing.
2. THEN look INSIDE that outline for ridges, valleys, hips, dormers that visibly separate it into distinct planar surfaces. If you see none, the roof is ONE face.
3. ONLY THEN draw each face polygon, making sure every face lies entirely inside the outline you identified in step 1 and the union covers it exactly.

HOW TO IDENTIFY FACE BOUNDARIES (VISUAL CUES):
- A ridge appears in the image as a STRAIGHT LINE where two regions of differing brightness/shading meet — each side is a separate face sloping away from that line.
- A valley appears as a STRAIGHT LINE in a concave intersection, often shaded darker than surrounding faces.
- A hip edge appears as a STRAIGHT LINE on a convex corner, separating two faces of a hipped roof.
- An eave is the lowest edge of a face, where the roof material ends and meets the wall or open air — usually casts a distinct shadow on the ground/wall below.
- Within a SINGLE face, the shading is roughly UNIFORM (one continuous plane = one consistent lighting angle). If shading changes abruptly within what you thought was one face, you likely have two faces meeting at a ridge/hip/valley you missed.

COMMON FAILURES TO AVOID:
- DO NOT assume the roof has a standard shape. Many real buildings have irregular outlines (L, U, T, plus-sign, stepped) — trace the actual outline pixel by pixel even if it does not look like a textbook example.
- DO NOT force a face count. A simple flat warehouse may have exactly 1 face covering the whole deck. A dense residential block may have 8+ faces. The face count comes from what you see, not from a default expectation.
- DO NOT split a single continuous planar surface into multiple faces just because shading varies (cloud shadow, dirt, panel reflection, weathering). A face is one PLANE; variable shading on the same plane is normal.
- DO NOT round or smooth real corners. If a roof has a 7-sided footprint, output a 7-vertex polygon — do not simplify to 4.
- DO NOT extend any polygon edge beyond the visible roof material into ground, walls, vegetation, or shadows beyond the eave.

HANDLING UNCLEAR ROOF EDGES:
An unclear edge can mean two opposite things — handle them differently:
(a) OCCLUSION: a tree canopy, neighboring building, vehicle, or large external shadow visibly covers part of the roof. Recognize it by clear visual cues — green/leafy texture overlapping the roof, an external object intruding into the roof area, a long linear shadow cast from outside the building. → INFER the hidden edge by extending the visible polygon edge in its most plausible straight line.
(b) ACTUAL GEOMETRY: the roof itself bends, steps, or recedes. Recognize it by roof material continuing without interruption, a visible ridge/valley/hip aligning with the kink, geometric self-consistency with the surrounding outline. → TRACE THE EDGE AS DRAWN — do not straighten it out.
DEFAULT WHEN IN DOUBT: trace what you actually see. Only invent an extension when an occluding object is clearly identifiable in the image.

CRITICAL — ROTATION:
- Most real-world buildings are NOT aligned with the image axes. Roofs are commonly rotated 5°, 15°, 30°, 45°, etc. relative to north.
- BEFORE writing polygons, identify the dominant orientation of the roof's longest ridge/eave.
- Polygon edges MUST be parallel/perpendicular to the actual roof edges, NOT to the image borders.
- An axis-aligned bounding rectangle is almost always WRONG.

SHARED EDGES:
- Adjacent faces meeting at a ridge, valley, or hip MUST share an edge.
- Place vertices at EXACTLY the same (x, y) on both polygons where they meet — do not leave gaps or overlaps.
- Walk each polygon's perimeter in order (clockwise or counter-clockwise); do NOT zig-zag, cross, or skip sections.

PARTITION (CRITICAL — applies to ALL faces together):
- The union of all face polygons MUST cover the entire roof outline of the building with NO interior gaps.
- NO two face polygons may overlap in area. Faces only touch along shared edges (ridges, valleys, hips), never along interior areas.
- Before responding, mentally overlay all your face polygons on the image: every roof pixel should belong to EXACTLY ONE face.

HOW TO REPAIR DEFECTS DURING SELF-CHECK:
- If a roof pixel belongs to NO face (a gap), FIRST check whether an adjacent existing face was drawn too small. If the missing region lies in the same plane (continuous slope, same material, same ridge/eave line) as an existing face, EXTEND that face's boundary to absorb the gap — do NOT create a new face.
- ONLY create a new face for a gap region when the region clearly belongs to a different plane (different slope direction, separated by a visible ridge/valley, or visually distinct structure like an addition or dormer).
- If two faces overlap (a roof pixel belongs to multiple faces), trim the face whose boundary in the overlapping region is less defensible against the actual roof edges visible in the image.

EDGE PRECISION (CRITICAL):
- Place each vertex EXACTLY on the visible roof edge pixel boundary. Do not approximate or smooth.
- Use the MINIMUM vertex count that captures the actual shape: 3 for triangles, 4 for trapezoids/rectangles. Add more vertices ONLY when the real edge has a visible kink or jog. Over-vertexing makes the polygon worse, not better.
- Express each coordinate to at least 3 decimal places (e.g., 0.247, not 0.25) to capture sub-pixel edge positions.

FINAL SELF-REVIEW (do this LAST, just before emitting JSON):
- For EACH polygon you have drawn, mentally overlay it back onto the original satellite image.
- Trace each polygon edge with your eye against the actual roof boundary in the pixels:
  * Does this edge run along the real material transition (roof tile/metal/asphalt → gutter/wall/ground/shadow)?
  * Or does it cut through the middle of the roof material, or extend beyond the roof into ground/shadow?
- For any edge that does NOT match the image:
  * If the polygon is too small, EXTEND that edge outward to the real boundary.
  * If the polygon is too large (covers non-roof area), SHRINK that edge inward to the real boundary.
- If a polygon's overall shape disagrees significantly with the image (wrong rotation, wrong vertex count, wrong face type), redo it from scratch rather than nudging vertices.
- Only emit JSON after this review is complete and you can defend every edge against what is visible in the image.

OUTPUT REQUIREMENTS:
- Respond with ONLY valid JSON. No prose, no markdown fences, no commentary.
- JSON shape: {"polygons":[{"points":[[x,y],...]}, ...]}
- Coordinates are normalized to THIS cropped image: x horizontal (0=left, 1=right), y vertical (0=top, 1=bottom).
- Each polygon: BETWEEN 3 AND 64 points. Triangular hip ends get 3 points; trapezoid slopes get 4; complex faces more.
- All x and y values must be within [0, 1].
- Each face polygon should hug the actual roof edge — not shadow, not pavement, not the image border.
- If no clear roof is visible, return {"polygons":[]}.`;

export const ROOF_DETECT_USER_PROMPT =
  "Identify every distinct roof face in this cropped satellite image and trace each as its own polygon, following the JSON schema exactly.";
