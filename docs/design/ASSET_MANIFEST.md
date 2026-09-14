# Asset manifest — draft 0A

Status: `production candidates in review; no production-ready kit yet`

| ID | Role | Source | Export | State |
| --- | --- | --- | --- | --- |
| `concept.office.warm.v1` | Approved A visual reference | `concepts/0A-treatment-a-warm-studio-v1.png` | PNG | reference only |
| `concept.office.cool.v1` | User-selectable map reference | `concepts/0A-treatment-b-cool-workroom-v1.png` | PNG | reference only |
| `concept.office.editorial.v1` | User-selectable map reference | `concepts/0A-treatment-c-editorial-room-v1.png` | PNG | reference only |
| `prototype.ui.decision.v1` | Simulated revision conversation | `prototype/` HTML/CSS/JS | browser | in review |
| `reference.employee.sheet.v1` | Character pose and animation reference | `assets/reference/employee-sprite-sheet-exploration-v1.png` | RGBA PNG | reference only; dark backdrop and no editable source |
| `generated.employee.walk.v2` | Four-direction employee walk-sheet candidate | `assets/generated/employee-walk-sheet-v2.png` | RGBA PNG | generated candidate; grid/anchor and alpha QA pending |
| `generated.employee.walk.transparent.v3` | 24-frame employee walk-sheet attempt | `assets/generated/employee-walk-transparent-grid-v3.png` | RGBA PNG | rejected as runtime source: generator retained an opaque painted background |
| `generated.employee.walk.alpha.v4` | Background-extraction attempt on v3 | `assets/generated/employee-walk-alpha-v4.png` | RGBA PNG | rejected as runtime source: extraction did not remove the opaque background |
| `character.assembly.v1` | Scalable composable employee-sprite contract | `assets/CHARACTER_ASSEMBLY.md` | specification | approved direction; source layers not yet generated |
| `generated.office.kit.v1` | Modular office tile/furniture candidate | `assets/generated/office-kit-sheet-v1.png` | RGBA PNG | generated candidate; cell slicing and collision metadata pending |
| `generated.office.kit.transparent.v2` | Separated office architecture/furniture source sheet | `assets/generated/office-kit-transparent-grid-v2.png` | RGBA PNG | candidate; transparent separation inspected, grid and anchor QA pending |
| `generated.ui.kit.v1` | RPG-style UI-frame/component candidate | `assets/generated/ui-kit-sheet-v1.png` | RGBA PNG | generated candidate; components need slicing and responsive text treatment |
| `generated.warm.tiles.v1` | Warm-studio floor/wall source tile sheet | `assets/generated/warm-studio-tilesheet-v1.png` | PNG | candidate; repeat seams and formal source grid need validation |
| `runtime.tiles.candidates.v1` | Extracted warm floor/wall candidates | `assets/runtime/tiles/` | PNGs | non-destructive crops from `generated.warm.tiles.v1`; repeat-seam QA pending |
| `prototype.room.assembly.v1` | Component-scale diagnostic | `prototype/room-kit.html` | browser | rejected as a composition reference: perspective/scale/anchor conventions are not normalized |
| `source.normalization.v1` | First-room source gate | `assets/SOURCE_NORMALIZATION.md` | specification | required before the next room composition review |
| `generated.normalized.core.v1` | First-room normalized core source sheet | `assets/generated/normalized-room-core-v1.png` | RGBA PNG | in review; shared camera/material candidate, grid and seam validation in progress |
| `runtime.normalized.core.v1` | Extracted normalized floor/wall/furniture core | `assets/runtime/normalized-core/` | RGBA PNGs | non-destructive crops from `generated.normalized.core.v1`; used only by normalized grid test |
| `prototype.normalized.room.v1` | 8 × 6 source-grid diagnostic | `prototype/normalized-room.html` | browser | in review; visible QA grid/anchors are diagnostic-only |
| `concept.office.benchmark.v1` | Cohesive warm-studio room composition benchmark | `concepts/0A-warm-studio-room-benchmark-v1.png` | PNG | rejected as room implementation reference: overly realistic and bespoke |
| `prototype.room.benchmark.v1` | Direct benchmark review surface | `prototype/room-benchmark.html` | browser | rejected reference review surface |
| `concept.office.pixel-benchmark.v2` | Game-map warm-studio composition benchmark | `concepts/0A-warm-studio-pixel-benchmark-v2.png` | PNG | palette/chunkiness reference only; rejected as room implementation reference because of bespoke sidewalls/frame |
| `prototype.room.pixel-benchmark.v2` | V2 direct benchmark review surface | `prototype/room-benchmark-v2.html` | browser | rejected reference review surface |
| `direction.modular-map.v1` | Original expandable office-map direction | `assets/SOURCE_NORMALIZATION.md` | specification | superseded as product model; retained as renderer evidence |
| `contract.modular-map.v2` | Company-wide curated Studio, tile layers, and occupancy | `MODULAR_MAP_CONTRACT.md` | specification | approved product direction; six-to-eight-workstation implementation pending |
| `prototype.modular-map.v1` | Two-room tile renderer proof | `prototype/modular-map.html` | browser | historical functional evidence only; adjoining-room product flow is superseded |
| `runtime.office.candidates.v2` | Extracted furniture/architecture candidates | `assets/runtime/office/` | RGBA PNGs + `manifest.json` | non-destructive crops from `generated.office.kit.transparent.v2`; provisional collision, anchor, and tile-footprint metadata recorded, browser validation pending |
| `generated.office.kit.transparent.v3` | Warm-studio modular furniture/architecture source sheet | `assets/generated/office-kit-transparent-grid-v3.png` | RGBA PNG | generated September 12 after 1B visual rejection; alpha inspected; source-grid, repeat seam, and anchor QA pending |
| `generated.employee.walk.transparent.v5` | Human four-direction walk-sheet candidate | `assets/generated/employee-walk-transparent-grid-v5.png` | RGBA PNG | generated September 12 after 1B visual rejection; alpha inspected; source-grid and composable-layer QA pending |
| `generated.ui.kit.transparent.v2` | A-style frame/component source sheet | `assets/generated/ui-kit-transparent-grid-v2.png` | RGBA PNG | generated September 12 after 1B visual rejection; alpha inspected; responsive text and nine-slice/component QA pending |

The concept PNGs are generated visual references. Generated sprite sheets and runtime crops are separate asset candidates, not finished runtime assets: each must be checked for transparent alpha, grid alignment, anchors, clipping, animation consistency, and provenance before use. The v2 office source is separated on a transparent canvas, but it is not yet a fixed cell grid. The v3/v4 employee attempts visibly retain their painted background, despite their RGBA encoding, and are recorded as rejected rather than silently promoted. Editable cleanup is only needed for cells that fail that review; the browser editor is no longer the primary asset-production path.

## September 12 — 1B visual rebuild candidate v1

The current runtime uses `src/lib/office/Office.svelte` and `src/lib/office/art.ts`. It no longer stretches `panel-frame-v1.png` or slices `employee-sheet-v5.png`. Existing generated sources remain untouched and in review.

- `runtime.office.normalized.rebuild-v1`: `static/assets/office-normalized/` contains non-destructive, nearest-neighbor exports of the existing desk, chair, bookcase, plant, rug, and corkboard candidates. Fixed 16 px source tile footprints, binary alpha, 16 px transparent safety border, bottom-center placement, and 2× display. Exact input paths, crop bounds, canvases, and anchors are in `docs/evidence/1B-visual-rebuild/asset-normalization.json`. These exports are **in review**, not user-approved art. The supplied static crops are the immediate provenance; no new generated source is claimed.
- `runtime.office.tiles.rebuild-v1`: original, editable, integer-coordinate SVG floor/wall/window/monitor sources in `art.ts`. Floor and wall are 16 × 16 source tiles, repeated at 32 × 32 CSS pixels. No whole-room raster is shipped.
- `runtime.character.rebuild-v1`: original code-authored layered SVG character, 24 × 32 logical pixels, rendered at 2×. Four facings × six frames at 100 ms during a move. Skin, hair, shirt, accent, and glasses come from the saved recipe, with a bounded composition cache. The initial body and trousers have one silhouette; arbitrary saved body/bottom strings do not create new art. Character grid evidence and the source validator are included. This is an in-review small kit, not the full proposed 48 × 64 source-sheet production kit.
- `runtime.ui.rebuild-v1`: responsive browser-rendered navy/cream surfaces in `+page.svelte`; system sans-serif typography. Frames do not use stretched bitmap art.

QA and source-scale deviations are detailed in `docs/execution/handoffs/1B-2026-09-12-visual-rebuild.md`. E03 and interaction approval remain open.

## A fidelity pass — September 12

- `generated.character.a-match.v6` and `.v7`: `assets/generated/employee-a-match-v6.png` and `employee-a-match-v7.png`. Built-in imagegen with approved A as the reference. Both generated RGB checkerboard mattes; not alpha-ready runtime sources. Prompts and provenance: `assets/generated/employee-a-match-v7.md`.
- `runtime.character.a-match.v1`: `static/assets/characters/a-v1/`, normalized 48 × 64 PNG canvases, six columns × four directions, common foot anchor (24,61), binary alpha and separate base/hair/skin/top/bottom layers. Indexed by `src/lib/office/character-kit.json`, composed and cached by `art.ts`, rendered at integer 2×. Skin/hair/top palettes, glasses and accent use the saved recipe. Body and hair silhouette remain one source kit. In review.
- `runtime.ui.a-match.v1`: live CSS frames in `src/routes/+page.svelte` and original integer-grid rail/dock icons in `src/lib/ui/Icon.svelte`. Responsive navy outer frames, cream dialogue, moss choices, portrait and lower local-log/folder/unconnected-terminal dock. No generated UI image is stretched or shipped as a panel.

This supersedes the prior small code-authored character as the active runtime candidate. All older files remain for provenance; no approval or E03 completion is implied.
