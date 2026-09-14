# A-matched character source and export

September 12, 2026. Built-in `image_gen` mode; no CLI fallback.

Reference: `docs/design/concepts/0A-treatment-a-warm-studio-v1.png`. The user reaffirmed this exact design and rejected a new visual interpretation.

Generated sources: `employee-a-match-v6.png`, then the cleanup attempt `employee-a-match-v7.png` in this directory. Both outputs contained an opaque painted checkerboard (RGB, no alpha), despite the transparency request. Neither is shipped directly.

Runtime exports: `static/assets/characters/a-v1/`, built by `scripts/export-character-kit.cjs`. The source matte is separated deterministically, and each pose is normalized at the same 0.275 source-pixel ratio onto a 48 × 64 canvas, foot anchor (24,61). The five mutually exclusive source layers are base details, hair, skin, overshirt and trousers. `src/lib/office/character-kit.json` embeds their PNG data for synchronous cached recipe composition. Tint filters preserve the source shading. Glasses and a small accent pin are editable native pixel layers. This small kit has one body and hair silhouette with palette variants; it does not claim multiple finished hair silhouettes.

The exports remain in review. `docs/evidence/1B-design-match/character-export.json` records crop bounds; `character-grid.png` is the visually inspected directional grid. No original generated source was overwritten.

## Generation prompt (v6)

Use case: stylized-concept. Asset type: production character sprite sheet for the attached approved original RPG office design. The image is a STYLE REFERENCE ONLY. Create ONLY a reusable transparent sprite sheet, not a room or UI mockup. Match the reference's copper-haired person's proportions and detailed chunky pixel-art: large rounded tousled head about 45 percent of total height, expressive dark eyes, small adult body, moss overshirt over cream shirt, dark trousers, brown boots. Strong readable human silhouette, detailed clustered pixel shading, dark walnut outlines, warm highlights. NOT stick figures or simple geometric blocks. Exactly 6 columns by 4 rows of one consistent full-body character walking, each cell 256px wide and 256px high on a 1536 by 1024 canvas. Row 1 faces down toward viewer, row 2 walks left, row 3 walks right, row 4 faces up away. Columns form six distinct walk-cycle poses with alternating arms and legs, including neutral standing in column 1. Each cell has identical character scale, horizontal center and foot anchor; generous entirely transparent margins. Hair, skin, overshirt, trousers each use distinct hue families so reusable color-mask layers can be separated. All 24 figures fully separate, complete bodies and shoes, no overlap, no labels, no grid lines, no ground, no shadow, no background color, no painted checkerboard. Real transparent RGBA background. Faithfully match the attached illustration's character art language.

## Cleanup prompt (v7)

Use case: background-extraction. Edit target: this exact 24-frame character sprite sheet. Remove ONLY the painted gray/white checkerboard background and every white scribble in the empty space. Output a genuinely transparent RGBA PNG with actual alpha zero outside the figures. Preserve all 24 character figures, their pixel art, face shapes, colors, positions, exact scale, four row directions, and six columns unchanged. Do not redraw any characters. No checkerboard pixels, no backdrop, no shadows, no texture behind figures. Keep the 1536x1024 canvas.
