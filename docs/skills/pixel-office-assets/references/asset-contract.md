# Asset and workstation contract

## Visual baseline

Original warm studio: walnut furniture, honey wood floor, cream plaster, charcoal/navy UI frames, cream dialogue surfaces, muted moss choices, amber local illumination. Dense readable 16-bit pixels, fixed three-quarter top-down camera, no isometric camera rotation. Large round heads, compact bodies, restrained expressions. Reference image text is illustrative; the implementation uses real, readable content.

## Current source and render sizes

Inspect `src/lib/office/sprites.ts` for measured source boxes and palette decoding and `Sprite.svelte` for atlas selection. These files are authoritative for the current implementation; do not copy stale coordinates from this guide.

- Character render canvases: 48 × 80 logical pixels; portrait crop 48 × 50. Render at nearest-neighbor scale.
- Standing/walking actor footprint: approximately one floor cell; visual body about 1.5 cells wide and 2.65 high, anchored by the feet.
- Chairs are persistent workstation fixtures. Seated/sleeping actor art excludes the chair; render a separate directional chair behind or in front of the body as appropriate. A chair remains when its coworker stands or walks away. Visual body about 1.65 cells wide and 2.7 high. Preserve actual head scale across states; do not stretch arbitrary crop ratios to meet these numbers.
- Walk timing: six source frames per facing; current runtime uses 130 ms per coworker frame. Align every crop to a consistent foot anchor and verify the loop in motion. Source grids are not presumed uniform.
- Scene map: normal floor/structure/decor/fixture/actor/light layers. The current 20 × 21 room and 12 × 10 adjoining proof are provisional; Packet 3B replaces them with one curated six-to-eight-workstation Studio. Responsive display scaling must not change collisions or geometry.
- Furniture: use measured source crop aspect ratios. Scene placements may have deliberate perspective compression, but never stretch a side-facing tall desk into a front-facing wide desk.

## Metadata to preserve for each family

Keep source path, source width/height, crop boxes, logical render size, facing convention, state/frame order, foot or bottom-center anchor, collision footprint, palette slots, and generation prompt. Add optional socket anchors for keyboard/hands, chair/hips, and lamp emission when required by the scene.

Facings are south=0, west=1, east=2, north=3. Keep this identical for input, sprites, and metadata. Walk frames and idle frames must share their orientation and identity; every predefined character must remain consistent across walking, seated, sleeping, and portraits.

## Scene mechanics

Collision footprints describe occupied floor area, not the full raster bounds or a lamp's empty upper space. Feet determine character depth; furniture bottom anchors determine normal depth, with explicit workstation layering where a seated body overlaps the desk. Never let a decorative lamp or plant leaf block an otherwise clear route.

Room activity is visual presentation, separate from actual task status. A sleeping pose must not mark execution asleep or completed. Do not fabricate task progress from animation. Follow-up, terminal, and project controls remain attached to real application state.

## Review failures to catch

- Character faces away from its keyboard, sits on a desktop, floats beside a chair, or has two chairs.
- Actor position teleports when a work/rest mode changes instead of returning through a valid route.
- Sprite head or feet jump between animation frames; identity or palette changes by state.
- Static sprite art or a status bubble is used as a substitute for a required animation.
- Whole-texture borders repeat through the floor; tile origin restarts produce bands.
- Shadows float away from contact points, window light ignores its source, or glow washes out all detail.
- Paths cut through furniture or room walls, exits are unreachable, or the player disappears behind a foreground layer at the wrong depth.
