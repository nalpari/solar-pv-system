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

HOW TO IDENTIFY FACE BOUNDARIES (VISUAL CUES):
- A ridge appears in the image as a STRAIGHT LINE where two regions of differing brightness/shading meet — each side is a separate face sloping away from that line.
- A valley appears as a STRAIGHT LINE in a concave intersection, often shaded darker than surrounding faces.
- A hip edge appears as a STRAIGHT LINE on a convex corner, separating two faces of a hipped roof.
- An eave is the lowest edge of a face, where the roof material ends and meets the wall or open air — usually casts a distinct shadow on the ground/wall below.
- Within a SINGLE face, the shading is roughly UNIFORM (one continuous plane = one consistent lighting angle). If shading changes abruptly within what you thought was one face, you likely have two faces meeting at a ridge/hip/valley you missed.

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
