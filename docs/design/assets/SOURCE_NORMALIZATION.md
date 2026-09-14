# Room-source normalization — first-room gate

Status: `required before another composition review`

The first room assembly diagnostic failed because source pieces were made as attractive isolated images, not a coherent tile-native environment. Do not compose a second HTML room from those crops until this gate passes.

The later generated benchmark also failed as an implementation reference: its sidewalls and bespoke enclosing frame only work in a one-off picture. The production target is a modular, expandable top-down office map. Do not iterate generated whole-room screenshots further before a real tile renderer can demonstrate chunk extension.

## Fixed first-room contract

- Camera: top-down three-quarter, with front edges facing down-screen. No frontal furniture or side-view character in this room family.
- Environment unit: `16 × 16` logical source pixels; exports may be authored at a higher integer multiple but must reduce exactly to this grid without blur.
- Furniture measures: desk `4 × 3` tiles, chair `2 × 2`, bookcase `2 × 2`, floor lamp `1 × 2`, large plant `2 × 2`, meeting table `5 × 4`, loveseat `3 × 2`.
- Every object has a 1-tile transparent safety border, a bottom-center tile anchor, and a contact shadow drawn on the floor plane—not a photo-like drop shadow.
- Lights, wood grain, wall trim, and props share the approved warm-studio palette. No asset may introduce an independent global vignette or lighting direction.
- Floors and walls must be tested as repeated `4 × 4` patches before room use. A single large decorative texture is not a tile.
- Room boundaries use tile edge/corner/door variants. No forced perspective sidewalls, framed cutaway border, or pre-rendered room silhouette is allowed.
- Minimum expansion proof: the same source parts build one warm office chunk and one adjoining smaller workroom through a doorway, with no new bespoke perimeter artwork.

## First redraw set

Only redraw and validate these parts before expanding variety: one floor tile, one cream wall/baseboard tile, one window-wall tile, one desk, one chair, one bookcase, one plant, and one rug. Place them in an `8 × 6` tile test cell with a single character anchor marker; evaluate at 2×, 3×, and 4× integer scale.

## Promotion criteria

A candidate may enter the room renderer only after it passes: source-grid inspection, alpha/checkerboard inspection, repeated-seam test, scale test beside every other core part, anchor/draw-order test, and a browser screenshot review. The approved office-kit gallery remains the material and palette reference; it is not an automatic source export.
