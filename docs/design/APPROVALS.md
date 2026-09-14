# Visual approvals

## Packet 0A — still-image direction

Status: `approved_still_direction`

The deferred visual phase was explicitly started on September 12, 2026. These are original, comparable concept stills for the same populated office, employee interaction, conversation panel, inbox, and terminal context. They establish direction only; they are not reusable production assets, and none is approved yet.

| Version | Treatment | Review focus | Artifact |
| --- | --- | --- | --- |
| `0A-A-v1` | Warm studio | Rich material detail, honey wood and late-afternoon light; most intimate but also the densest. | [PNG](concepts/0A-treatment-a-warm-studio-v1.png) |
| `0A-B-v1` | Cool workroom | Crisp modular layout, restrained palette, and the clearest operational UI hierarchy. | [PNG](concepts/0A-treatment-b-cool-workroom-v1.png) |
| `0A-C-v1` | Editorial room | Graphic outlines, cream conversation panel, and warmer collaborative meeting space. | [PNG](concepts/0A-treatment-c-editorial-room-v1.png) |

### Approved direction

September 12, 2026 — the user approved `0A-A-v1` as the overall UI and art-direction baseline: warm, detailed, intimate, and visually strongest for the product. This does **not** select one permanent office map treatment. `0A-A-v1`, `0A-B-v1`, and `0A-C-v1` remain intentionally selectable room-map looks so a user can choose the presentation that fits their project. The prototype must pair the approved A-style interface with each map treatment and preserve that choice as user-controlled presentation, not an execution-state distinction.

Still-image approval does not approve prototype movement, interaction, motion, or final reusable assets.

## Packet 0A — office-kit asset language

Status: `approved visual language; implementation validation pending`

Artifact: [asset review gallery](prototype/assets.html), backed by [the transparent office-kit source](assets/generated/office-kit-transparent-grid-v2.png) and its non-destructive [runtime candidate crops](assets/runtime/office/).

September 12, 2026 — the user reviewed the gallery and said, “i like that.” This approves the warm-studio furniture/architecture asset language for the first room assembly pass. It does not approve individual collision footprints, anchors, source-cell grid, animation, or a full rendered room; those remain in review and must be exercised before E03 can be finalized.

### Assembly review

Status: `rejected as composition reference`

The first [room assembly proof](prototype/room-kit.html) was reviewed immediately afterward. User feedback: “looks a bit off.” That assessment is correct: individually appealing assets do not yet share a controlled source scale, top-down perspective, lighting/shadow convention, or room-grid contract. The HTML composition is therefore not a visual reference for the product and must not be expanded into a renderer unchanged. Keep it only as a diagnostic artifact.

### Composition benchmark

Status: `in review`

Artifact: [warm-studio benchmark](prototype/room-benchmark.html), sourced from [the benchmark PNG](concepts/0A-warm-studio-room-benchmark-v1.png). It was created after the diagnostic review to establish the missing spatial qualities: continuous floor plane, asymmetric but legible zones, clear circulation, wall-aligned furniture, and shared warm lighting. It is a composition reference only—not a replacement for a runtime room or a license to ship a raster screenshot.

### Pixel-art correction

Status: `in review`

The first composition benchmark was correctly called out as too “real” and too close to a miniature interior render. [V2](prototype/room-benchmark-v2.html) corrected pixels, texture, and silhouette, but user feedback identified a deeper issue: its sidewalls and one-off outer frame still make it a bespoke illustration, not an expandable office. V1 and V2 are both rejected as room-implementation benchmarks. Retain V2 only as a narrow palette/chunkiness reference.

### Modular-map direction

Status: `approved implementation benchmark`

September 12, 2026 — the user directed the project toward a modular, expandable social-office map model, citing Gather as the relevant benchmark. This approves the functional spatial direction: tile-native rooms, reusable floor/wall/door/prop layers, ordinary map boundaries, and room-to-room expansion. It explicitly ends further whole-room generative style iteration until a real modular renderer can be reviewed. The final art remains original and follows the approved warm-studio palette and more readable 16-bit pixel treatment.

### Modular renderer proof

Status: `approved functional direction; visual polish deferred`

Artifact: [two-room modular map proof](prototype/modular-map.html).

September 12, 2026 — the user reviewed the real tile renderer and said it “looks okay.” This approves the modular implementation direction: shared map parts, collision, keyboard movement, and an adjoining-room doorway transition. It does not approve candidate asset scale, the full product UI, final animation, or visual polish. Those can improve independently without reopening the room-model decision.

## Packet 0A — interactive prototype

Status: `needs_user_review`

Artifact: [standalone prototype](prototype/index.html). It intentionally uses simulated task data and keeps the approved A-style interface while allowing the user to switch among the A/B/C office-map treatments. It supports keyboard movement (arrow keys/WASD), employee interaction, conversation/terminal switching, inbox, a simulated decision meeting, and a reduced-motion switch.

September 12, 2026 feedback: the earlier live sidebar did not meet the approved still's quality bar because it was a generic hand-built panel beside a concept screenshot. The prototype now crops each concept to the room treatment and uses an original top-down-RPG UI language for the live surface: framed dialogue, portrait-led conversation, a terminal dock, chunky controls, and tile-scale status affordances. This is not a reproduction of Stardew Valley or Pokemon UI. The meeting supports custom feedback and revision history; selecting a proposed option begins a revision, not an implicit approval.

Static verification: `node --check docs/design/prototype/script.js` passed on September 12, 2026. Browser walkthrough is pending user review because the isolated validation browser could not retain a project-local HTTP listener; no browser-interaction claim is recorded.

Required approval: interaction/motion feedback on this artifact. The selectable map treatment is a presentation preference and must not imply task state or change the approved A UI foundation.

## September 12 — return to the approved A design

The user reviewed the first 1B visual rebuild and said the room “looks ok,” but “characters don't match. and neither does ui.” They then reattached `0A-A-v1` and directed: “rather than re-inventing something we should stick with the orgiinal agreed upon design.” Their following “okay do that” authorizes implementation of that existing design, not a new art direction.

The follow-up candidate restores the vertical icon rail, substantial navy frames, portrait-led cream dialogue, moss choice surfaces and dark lower dock, using a new character sheet explicitly referenced to A. It remains a live modular implementation. No concept screenshot is used as runtime UI or a whole-room bitmap. Review evidence: `docs/evidence/1B-design-match/`. This records implementation progress only; the follow-up candidate has not yet received user visual approval.
