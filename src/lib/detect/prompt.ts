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

WHEN TO RETURN EMPTY (NO HALLUCINATION):
- If the image shows no buildings — only ground, water, vegetation, parking lots, roads, or open fields — return {"polygons":[]} and nothing else.
- If a building is visible but the roof itself is fully obscured (heavy tree canopy, dense cloud, image artifact), return {"polygons":[]} rather than guessing where the edges might be.
- Returning an empty result is the CORRECT response when there is no defensible roof to trace. Do not invent polygons to "be helpful".

OUTPUT REQUIREMENTS:
- Respond with ONLY valid JSON. No prose, no markdown fences, no commentary.
- JSON shape: {"polygons":[{"points":[[x,y],...],"confidence":0.0-1.0}, ...]}
- Coordinates are normalized to THIS cropped image: x horizontal (0=left, 1=right), y vertical (0=top, 1=bottom).
- Each polygon: BETWEEN 3 AND 64 points. Triangular hip ends get 3 points; trapezoid slopes get 4; complex faces more.
- All x and y values must be within [0, 1].
- Each face polygon should hug the actual roof edge — not shadow, not pavement, not the image border.
- "confidence": YOUR HONEST self-assessment (0.0-1.0) of how accurately THIS specific face polygon traces the real roof. Use this scale:
    * 0.9+ — Roof clearly visible, edges sharp, polygon traces visible material transitions precisely.
    * 0.7~0.9 — Mostly clear, minor ambiguity (slight shading variation, small occlusion).
    * 0.5~0.7 — Significant uncertainty (heavy shadow, partial occlusion, blurry image).
    * <0.5 — Major doubt about edges, OR the image does not clearly show a roof (e.g. the crop fell on road/field/parking lot — you traced something but you are NOT confident it is actually a roof face).
  Be ESPECIALLY HONEST about low confidence: if you suspect the image is not really a building roof, report low confidence rather than fabricating plausible polygons.
- If no clear roof is visible at all, return {"polygons":[]}.`;

export const ROOF_DETECT_USER_PROMPT =
  "Identify every distinct roof face in this cropped satellite image and trace each as its own polygon, following the JSON schema exactly.";

/**
 * [SAM PoC] 외부 segmentation 모델(SAM)이 추출한 건물 마스크를 두 번째 이미지로 동봉할 때
 * 시스템 프롬프트 끝에 추가하는 블록. SAM 호출 실패 시(마스크 없을 때) 첨부하지 않는다.
 *
 * 설계 (LLM 처리 특성 반영):
 * - 중간 신뢰도: 맹신(오류 전파)도 무시(정보 낭비)도 아닌 참고 가중치
 * - 자기 추론 우선: 원본이 권위, 모델 자신의 외곽 판단이 최종 결정 → 마스크는 교차검증용
 * - 마스크 범위 명시: 마스크에는 중앙 건물 외 옆건물·차량·그림자도 섞여 있음을 경고
 * - 저신뢰 재활용: 외곽이 틀려도 장애물·그림자·면분리 단서로는 약하게 활용
 */
export const EXTERNAL_HINT_BLOCK = `EXTERNAL HINT (a MEDIUM-confidence auxiliary reference):
The second image is a building mask from a separate segmentation model (SAM). It is auxiliary — NOT ground truth. The first image is always the authoritative source, and YOUR OWN visual analysis of it is the final decision.

WHAT THE MASK CONTAINS:
- The mask was produced from the full captured image, so it may include regions that are NOT the central building — a neighboring building, a shed, a vehicle, a tree, or a shadow area.
- ONLY the mask region overlapping the CENTRAL building (closest to image center) is relevant. A neighboring building's mask is NOT part of the central roof, and a mask edge that follows a shadow is NOT a roof edge.

HOW TO USE IT (treat as MEDIUM confidence — neither trust blindly nor ignore):
- Compare the mask against the central-building roof outline YOU identify from the first image (per the steps above).
- Where the mask AGREES with your outline, treat it as confirmation — you may nudge your vertices toward the mask edge for sub-pixel precision.
- Where the mask DISAGREES, keep your own outline as primary — but treat the disagreement as a "look again" signal, not proof either way.
- Even where the mask's outline is imperfect, its shape may weakly hint at sub-features to double-check: a possible obstacle, a shadow boundary, or a face-splitting edge. Use such hints ONLY as weak clues to re-examine the first image, never as decisions on their own.
- DO NOT mention the mask in your response. Only output face polygons as usual.`;
