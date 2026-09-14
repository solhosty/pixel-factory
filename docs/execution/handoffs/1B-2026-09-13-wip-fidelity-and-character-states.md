# Packet 1B — WIP fidelity and character states

September 13, 2026. The v1 office was corrected against the approved
`0A-A-v1` composition after the user identified the earlier room art and
single-pose coworkers as prototype quality.

## Changed

- The runtime now uses the approved higher-detail warm office asset family from
  `static/assets/office-v2/` rather than the flat normalized placeholders.
- The map separates a cream architectural back wall from the walnut floor and
  adds the WIP's denser workstation, rug, storage, plant, lamp, coat, and lounge
  zoning while retaining the modular tile map and adjoining-room contract.
- Coworkers have explicit `seated`, `standing`, and `walking` actor modes.
  Walking is driven by the office animation loop with route coordinates,
  directional changes, six-frame gait animation, loop pauses, and draw-order
  updates. It is not a CSS translation.
- The loaded three-person room visibly starts with one seated coworker, one
  walking coworker, and one standing coworker. Their back, side, and dynamic
  route facings are distinct. Reduced motion converts moving coworkers to a
  stationary standing pose at frame zero.

## Verification

- Served browser at 1536 × 1024: document dimensions matched the viewport,
  every image reported a non-zero natural size, and actor observations at two
  times showed changing coordinates, directions, and frames.
- Served browser at 390 × 844: no document overflow, no broken images, the map
  remained internally pannable, and the coworker overlay stayed inside
  `[8, 70, 382, 836]`.
- Warm, cool, and editorial treatments each rendered with no broken images and
  no document overflow; the saved treatment was restored to warm.
- Reduced motion was toggled in the served UI and moving coworkers changed to
  `standing`, frame `0`; the saved preference was restored off.
- `npm run check`: zero errors and zero warnings.
- `npm run test`: 11 passing tests.
- `npm run build`: passed. Adapter-auto still has no selected deployment
  adapter, as before.

## Asset-generation note

A built-in image-generation attempt requested a transparent 4 × 2 atlas of the
approved avatar in four standing and four seated directions. Both attempts
returned raster backgrounds rather than genuine alpha and were rejected. They
were not copied into the application. The shipped character states remain based
on the existing composable, palette-aware directional kit.
