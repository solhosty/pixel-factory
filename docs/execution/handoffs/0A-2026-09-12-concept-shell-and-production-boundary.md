# Packet 0A — concept shell and production boundary handoff

Date: September 12, 2026  
Status: in_progress  
Session/model: Codex desktop, GPT-5

## Checkout and running environment

- Repository path, branch, revision: `/Users/hunter/Documents/hunter/pixel-harness`; Git is not initialized.
- This packet added `docs/design/`, concept PNGs, a standalone HTML prototype, and the midpoint visual specification/asset manifest. There is still no production application, dependency scaffold, persistence, or real execution.
- The prototype is served in the user's browser at `http://localhost:4174/` during this review. If it needs to be restarted, run `python3 -m http.server 4174 --directory docs/design/prototype` from the repository root. Do not assume a listener is still active.

## Result

Still-image approval is recorded: `0A-A-v1` is the approved UI/art-direction baseline; `0A-B-v1` and `0A-C-v1` are retained as selectable map-treatment references. The initial hand-built sidebar was rejected as visibly below the concept quality. The current prototype instead renders the full approved concept shell by default, with its decision meeting available only on interaction. This is an honest visual prototype, not a claim that the screenshot is final production UI.

Decision meetings now accept custom feedback and append a simulated proposal revision. A selected supplied option also begins a revision; it never silently approves or forces a choice.

`VISUAL_SPEC.md` establishes a provisional 16 px tile grid, palette, UI language, source/export expectations, accessibility, and motion targets. It now also constrains menu-frame and speech-bubble micro-motion: one short open/settle, no looping or reading-time animation, and an immediate reduced-motion alternative. `ASSET_MANIFEST.md` records the v2 transparent office source sheet and its extracted runtime candidates as in review, not production-ready. `assets/reference/employee-sprite-sheet-exploration-v1.png` is an RGBA pose reference, but it has a dark backdrop and no editable source, so it is not a runtime sprite.

Character direction is now composable rather than a named pre-rendered sprite per employee. `docs/design/assets/CHARACTER_ASSEMBLY.md` defines a stable employee recipe, exact shared walk-strip/anchor requirements, composition order, compatibility validation, and a small vertical-slice-first next pass. The v3/v4 generated character strips remain recorded as rejected because their painted backgrounds make them unsuitable as source layers.

## Acceptance evidence

| Criterion | Status | Evidence |
| --- | --- | --- |
| Still-image direction | pass | User approved A as baseline; `docs/design/APPROVALS.md` |
| User-selectable map treatment intent | pass, concept-only | A/B/C concept references retained; real separated room assets are not built |
| Interactive decision revision | pass, simulated | Browser-verified custom feedback appended `Rowan · proposal v2`; `prototype/script.js` |
| Prototype visual/motion approval | pending | User rejected the earlier hand-built sidebar and requested stronger original top-down RPG quality |
| Reusable asset kit / second room / gallery | in progress | Clean transparent office source sheet plus non-destructive furniture crops; no room or gallery assembled yet |
| Static syntax check | pass | `node --check docs/design/prototype/script.js` |

## Decisions and approvals

User approval: A is the overall UI/art baseline; map look remains user-selectable. User feedback: decision interactions require custom input and back-and-forth, not forced choices; the prototype implements that as simulated revision history. User feedback: live UI must reach the quality of the generated treatment and feel like an original high-quality top-down RPG.

Follow-up approval: the user reviewed `prototype/assets.html` and approved the warm-studio office-kit visual language for the first-room assembly pass. That is explicitly narrower than production acceptance: object anchors, collision/footprint data, grid source, animation, and room composition still need browser validation.

Latest direction: stop iterating whole-room generated images. The user identified a modular, expandable social-office map as the actual benchmark. The original first composition diagnostic and both generated whole-room benchmarks are rejected as implementation references; the v2 image may inform palette/chunkiness only. `docs/design/MODULAR_MAP_CONTRACT.md` now specifies the layer model, doorway exits, and the required warm-office → quiet-workroom expansion proof.

The required two-room proof now exists at `docs/design/prototype/modular-map.html`. It has shared map layers, fixture collision, keyboard movement, and a doorway transition. The user said it “looks okay,” approving this as the functional renderer direction while deferring candidate-art scale, product UI, animation, and polished visual review.

The renderer now also exposes user-selectable warm, cool, and editorial map treatments over the same map data. This proves the approved presentation preference is independent from collision, exits, actor state, and the stable A-style UI framing. Persisting that preference is intentionally deferred to packet 1A's durable domain.

No production renderer, editable source format toolchain, final palette, measured budget, or animation set is approved. `VISUAL_SPEC.md` is a working proposal, not final E03 approval.

## Remaining work

- [ ] Create original, editable modular floor/wall/furniture, character layers, animation clips, and UI frames—not another composed screenshot.
- [ ] Build the room renderer using those source assets; preserve A-style UI across independently selectable map treatments.
- [ ] Add collision, walk/sit/work/approval/sleep state transitions, keyboard focus, and reduced motion.
- [ ] Assemble a second room and component gallery; measure frame/input behavior.
- [ ] Obtain explicit user approval for interaction and motion, then finalize E03 and the asset manifest.

## Next session

Continue packet 0A only. Read `docs/design/APPROVALS.md`, `docs/design/VISUAL_SPEC.md`, `docs/design/ASSET_MANIFEST.md`, this handoff, `docs/execution/packets/0A.md`, and `MILESTONES.md`. Start by defining the editable source asset workflow and first modular asset slice; do not call concept PNGs final or create packet 1A scaffolding. The next user input is only needed for a material visual/interaction approval or a source-tool choice that cannot be made compatibly with the current environment.
