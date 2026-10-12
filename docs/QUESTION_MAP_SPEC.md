# Question Map Specification

## Purpose
The question map makes the quantity and spread of questions visible. It is an interactive visualisation generated from question data, not an exported or pre-rendered image.

## Visual model
- Central question: largest, most visually prominent node.
- Satellite questions: placed on one or more orbital rings around the centre.
- Thin orbit lines provide structure; optional connectors may link the central question to satellites.
- Colour variation is decorative, derived from the stable question id, and must not imply unsupported semantic categories. Do not store colour.

## Placement
- Calculate node positions from the question count, node sizes and available viewport.
- Use a deterministic layout for a given set of questions and viewport so the map remains stable.
- Add small, seeded variation if needed to avoid a mechanical appearance; do not use fresh randomness on every render.
- Consider node radius in placement calculations.
- Reserve space around the central node and maintain a minimum gap between nodes.
- Recalculate appropriately on viewport-size changes.
- Do not allow nodes to render beyond the visible SVG bounds without a usable pan/zoom strategy.

## Text
- Use SVG text or `foreignObject` only if browser support and accessibility are handled appropriately.
- Prefer word-aware wrapping.
- Measure or estimate text dimensions before finalising node size.
- Limit visible label lines where necessary, but preserve full text in an accessible selected-node detail.
- Do not reduce text until it becomes unreadable just to fit 100 nodes.

## Dense maps
At high counts, prioritise legibility over showing every label simultaneously. The MVP may use smaller nodes, additional rings and a simple scale-to-fit strategy. If 100 labels cannot be legibly displayed at once, make this limitation explicit and ensure all questions remain accessible via the existing list/review UI. Do not invent a clustering feature unless requested.

## Interaction
- Selecting a node highlights it.
- The full question text remains available.
- New nodes enter with restrained motion.
- The map should not steal focus from the text input during question entry.
- Reduced-motion mode uses minimal or no transitions.

## Acceptance checks
Try 1, 10, 25 and 100 satellites; long labels; portrait and landscape layouts; desktop and mobile widths; and reduced-motion settings.
