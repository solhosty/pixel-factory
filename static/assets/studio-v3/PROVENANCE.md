# Studio v3 sources

Generated with the built-in imagegen tool, September 13, 2026. The art direction is a warm, top-down pixel studio with walnut, amber, moss, and charcoal materials. These are reusable asset atlases; no full-room concept raster is rendered as the application.

## Prompt set

1. Furniture: nine isolated game assets, three columns/three rows; exact reference chunky detailed 16-bit pixels, walnut wood, amber lamps, fixed oblique top-down perspective. Row one: triple-pane sunset city window with plants, packed bookcase with trailing plants, noticeboard above low cabinet. Row two: programmer desk with two monitors/keyboard/books/mug/black warm lamp, writing desk with laptop/papers/mug/warm lamp, coffee cabinet with coffee machine/cups/plants. Row three: tall green plant in aged gray pot, moss-green ochre-diamond woven rug, coat stand/umbrella and sleeping calico cat bed. No people, labels, UI, or floor. Output actual transparency.
2. Background correction: preserve every asset and its position; replace the incorrectly painted transparency checkerboard with flat solid #ff00ff magenta, including gaps beneath desks and between leaves. No checkerboard or other backdrop. The application decodes the chroma key at render time.
3. Seated character: same reference auburn bob-haired coworker, large round head/tiny body, moss cardigan, cream shirt, dark trousers and tan shoes. Three columns/two rows: seated south/west/east; seated north/standing south/standing north. Bent knees, horizontal thighs, feet down and hands at keyboard height; a dark office chair belongs to each seated pose. No desks, floor, UI, labels. Flat #ff00ff backdrop.
4. Walking: exact same character, six columns/four rows, south/west/east/north rows; six consecutive walk frames with alternating contact, passing and neutral positions, alternating arm swings. Same head scale, clothing, local centers and feet anchors. Complete isolated bodies, flat #ff00ff backdrop. Inspect measured crop boxes because the returned columns were not uniform.
5. Sleeping: same character, two columns/two rows: asleep facing west, asleep facing east, front-facing seated doze with head on hand, north-facing slumped sleep. Include chair, no desks or floor; closed eyes and genuinely slumped body, no baked Z symbols, flat #ff00ff background.
6. Side desks: two isolated workstation variants rotated in the room plan. Left cell permits coworker on left facing east, keyboard at left and monitor at right facing left. Right cell permits coworker on right facing west, keyboard at right and monitor at left facing right. Same detailed walnut, articulated amber lamp, books, mug and plant; complete legs; no people, chairs, floor, or labels. Flat #ff00ff background.
7. Chair removal: edit only the two chairs baked into the original horizontal desks. Replace chairs with flat #ff00ff, preserve legs and all other objects, positions and canvas dimensions. Final runtime furniture source is `furniture-atlas-v2.png`.

8. Body separation: remove the chairs from seated and sleeping character atlases while preserving body poses, positions, dimensions, and magenta background. Runtime uses `character-body.png` and `sleep-body.png`; original chair-bearing sources remain for provenance.
9. Persistent chairs: four isolated empty office chairs in south, west, east, north orientations, matching dark upholstery and metal caster bases. No people, desks, floor, labels, or baked shadows. Runtime source `chairs.png` has actual alpha.

## Runtime contract

Measured source crops and palette mapping: `src/lib/office/sprites.ts`. Sprite selection: `Sprite.svelte`. Floor is a native seamless SVG pattern, not a reprocessed reference image. Character sources are retained unchanged; the renderer decodes key/palette while drawing to logical-pixel canvases. The original furniture source remains available beside v2.

## Decor atlas

`decor-atlas.png` generated with built-in imagegen: six isolated warm 16-bit pixel office props on a 1536 × 1024 atlas, pendant lamp, aged round clock, framed night-city painting, narrow filing cabinet, low bookcase with archive box, and wall shelf with trailing plants. Fixed RPG perspective, walnut/amber/moss/charcoal palette; no people, floor or room background. A second built-in edit replaced the incorrect dark backdrop and external glow with solid #ff00ff while preserving asset positions, shapes and colors. Original outputs remain in the Codex generated-images directory. Measured crops are in `sprites.ts`; lowShelf is available but not placed in the room.

## Short ink character family

Built-in imagegen edits produced `character-body-ink.png`, `walk-atlas-ink.png`, and `sleep-body-ink.png`. Each respective original atlas was the edit target. Prompt: change only every hairstyle to one short ink-black textured crop with a subtle side part, exposed ears and clean nape; preserve expressions, poses, hands, foot positions, clothing colors, head scale, sprite centers, exact canvas dimensions and layout. Replace removed hair with pure magenta; no chairs, accessories, labels, shadows or new poses. The existing measured crop coordinates are reused. `crop-ink-01` selects this complete family in portraits, office states, roster and studio.
