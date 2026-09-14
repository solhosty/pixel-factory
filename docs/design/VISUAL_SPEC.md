# Pixel Harness visual specification — draft 0A

Status: `provisional — interaction review pending`

## Direction

The approved baseline is `0A-A-v1`: a warm, populated top-down coding office with deep navy framing, cream conversation surfaces, walnut furniture, moss accents, and small terracotta notifications. The map treatment may be selected by the user; the application UI stays on the approved A baseline. This is original top-down RPG work, not a reproduction of an existing game's art or interface.

The room benchmark is now **modular, expandable, grid-native office space**, rather than a one-off dollhouse illustration. The user named Gather as the relevant product benchmark for modularity and expansion; use that as a functional/reference constraint only, not as art to copy. A room must be placeable and extendable by tile chunks without bespoke sidewalls, a painted outer frame, or a composition that only works at one viewport.

## Production rules

- Logical tile: `16 × 16` source pixels. A room uses a `2 × 2` tile meter; furniture declares its tile footprint and interaction anchor.
- Map structure: every room is a rectangular tilemap with independent floor, wall-edge, doorway, and prop layers. Walls are ordinary reusable edge/corner/door tiles; never generate a perspective “sidewall” or an enclosing illustrated room border.
- Expansion: rooms join on a tile boundary through a doorway/transition strip and may extend in any cardinal direction. Art must remain valid when a floor region or wall segment repeats beyond the original room size.
- Map treatments: warm, cool, and editorial are user-controlled presentation preferences applied to the same map data. They must not change task state, collision, exits, actor identity, or the shared A-style UI chrome. The prototype may hold this preference in memory; durable storage belongs to the later persistence packet.
- Display: integer 2×, 3×, or 4× scaling only; `image-rendering: pixelated`; no fractional camera scale.
- Perspective: top-down three-quarter view. Floor and furniture anchors use the tile's bottom center; character feet define the draw-order anchor.
- Palette: ink navy `#111827`, cream `#f4ebdb`, walnut `#7a4b35`, honey `#d9865e`, moss `#587d61`, muted indigo `#52627b`. Highlights and shadows must remain limited rather than airbrushed.
- UI: stacked hard-edge frames; a small portrait precedes dialogue; terminal is a dark, docked surface with readable monospace text. Dense content must use normal text rendering, not rasterized glyphs.
- Source: generate separate RGBA sprite-sheet candidates for character, environment, and UI kits; keep prompt/provenance and a manifest entry beside each. Slice only grid-checked cells into runtime exports. Character creation uses composable sprite layers rather than a pre-made named sprite per employee; see `assets/CHARACTER_ASSEMBLY.md`. Use browser-editor cleanup only when a selected cell needs a targeted correction. Concept stills remain references only and never ship as runtime UI.
- Room assembly gate: an asset is not eligible for room composition merely because it looks good in isolation. Before placement, it must declare a common source scale, perspective class, bottom-center anchor, shadow policy, tile footprint, and draw-order band. The first assembly proof failed this gate and is diagnostic-only. A second failed benchmark also showed that a cohesive generated illustration is not a substitute for a modular map; use it only to identify palette/material qualities, never as a map implementation plan.

## Motion and accessibility

- Character walk: four directions, 6 frames at 100 ms per frame; idle uses 2–4 frames at 450 ms cadence.
- Interaction: move focus within one 16 px tile of an anchor; confirm opens dialogue/meeting without starting a second execution.
- Panels: 140–180 ms open/close, translate no more than 8 logical px; reduced motion replaces movement with an immediate state change. Menu frames should use one brief scale/settle from the triggering anchor, then remain still.
- Conversation: a newly opened speech bubble may use a 120–160 ms two-step pop (96% → 102% → 100%) and its tail may make one matching 2 px settle. Do not loop, bounce, typewriter-render dense text, or animate a bubble that the user is reading.
- Notification accents: only the unread marker or the active menu cursor may pulse, at most once every 1.8 s and under 8% opacity change. State changes must remain understandable with all motion disabled.
- Keyboard: arrows/WASD navigate; Enter/E confirms; Escape closes the topmost transient panel; all hotspots have visible focus.
- Initial target: 60 fps on Apple Silicon macOS at 1440 × 900; input response under 100 ms for local interactions. These are targets, not measured results.

## Required review evidence

Before this specification becomes approved: demonstrate integer-scale rendering, reduced motion, a long conversation, terminal typography, three map treatments with one stable A-style UI, furniture collisions, one sit/stand transition, and a second room using the same parts.

## Integrated rebuild candidate v1 — September 12

Runtime scene tiles are 16 × 16 source pixels at 2×, including on mobile. The mobile map pans inside its viewport and follows the player; it never shrinks to fractional scale. The integrated character is a provisional 24 × 32 code-authored layered SVG at 2×. Walking uses six 100 ms poses and 180 ms tile movement; idle remains still. Both the persisted motion preference and OS reduced-motion media query disable walk pose changes and position transitions. Candidate UI frames use browser CSS and normal system text, with no decorative image stretched behind panels. These implementation details do not finalize E03 or grant visual/interaction approval.

## A fidelity pass, September 12

The user rejected the previous character/UI interpretation and reaffirmed A verbatim. Current runtime uses A-referenced 48 × 64 character layers at 2×, with four directions and six walk frames, replacing the small code-authored silhouette. The room uses integer 3× tile/prop scale on desktop at ≥1100 px and 2× below, with camera panning over unchanged room data. Character canvas remains integer 2× in both. Room treatments affect environment layers, not employee appearance or shared UI chrome.

The application now follows A's vertical icon rail, navy outer frames, portrait-led cream dialogue, moss inset choices and dark lower dock. Colleague selection updates that dialogue in place. The terminal tab is explicitly unconnected; local activity is labeled simulated. Narrow screens reflow the rail to the top and stack the same panel design. Long dialogue scrolls inside its reading surface on desktop and expands on mobile. Final user visual/motion approval and E03 remain pending.

## Walking and panel correction — September 12

Movement now uses a single animation-frame loop with 240 ms tile travel and six 100 ms pose frames. The camera tracks the drawing position through a viewport margin. Held keys do not restart the gait; key release finishes the current step. Directional heads are stable across the normalized frames. Portraits use a square bust view rather than CSS cropping an oversized full-body image. Menus preserve the mounted office, use brief enter/exit transitions, anchor settings to their opener, contain keyboard focus and restore it on dismissal. Reduced motion suppresses animation for both movement and surfaces. See the walking/panel handoff and served recordings for this in-review correction.
