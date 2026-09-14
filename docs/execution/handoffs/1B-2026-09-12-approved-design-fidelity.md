# Packet 1B — approved-design fidelity pass

September 12, 2026. In progress; awaiting user visual review. No Packet 2A work.

The user accepted the room broadly but rejected the previous characters and UI, then reaffirmed the exact approved `0A-A-v1` image. This pass implements that design instead of another palette-based interpretation.

## Changed

`src/routes/+page.svelte` now has the vertical icon rail, substantial navy outer frames, portrait-led cream dialogue, moss inset choices and dark lower dock. Selecting a colleague in the room updates the portrait and details in place. Project/task, roster/appearance and mailbox navigation remain live. The lower dock shows actual locally stored task state or folders, or explicitly reports an unconnected terminal. It does not simulate provider output or launch a worker. Icons live in `src/lib/ui/Icon.svelte`; all text is browser-rendered.

`src/lib/office/art.ts` now composes and caches the A-referenced character kit from `character-kit.json`. Source art and exact built-in imagegen prompts are in `docs/design/assets/generated/employee-a-match-v7.md`. The generator returned RGB checkerboards twice; `scripts/export-character-kit.cjs` performs deterministic matte separation and common-scale export. Every pose is a 48 × 64 canvas with feet at (24,61), displayed at 2×. Base, hair, skin, top and trousers are separate PNG layers; saved appearance palettes, glasses and accent are rendered. One body/hair silhouette is currently available; unsupported saved IDs remain preserved and do not imply new art.

`src/lib/office/Office.svelte` preserves both room grids, collisions, fixtures, paths and exits. Environment display is integer 3× on desktop and 2× on narrower screens; characters stay integer 2×. A/B/C affect environment presentation only. Camera panning and the responsive layout keep the scene usable without fractional sprite scaling. No whole-room image is shipped.

Service source, migrations and database model were unchanged. No Codex launch, worker, provider message or real approval dispatch was introduced.

## Evidence

`docs/evidence/1B-design-match/` contains the served screenshots and `browser-checks.json`:

- `desktop.png` is 1536 × 1024, directly compared with the approved A image at the same size. `office-1440.png`, `office-1024.png`, `office-390.png`, and `office-375.png` cover responsive sizes. All measured document widths equal the viewport; all images load.
- `character-grid.png` shows the normalized 24-pose kit. `character-export.json` records every source crop and anchor. `layer-checks.json` confirms all 24 frames have exact, non-overlapping layer recomposition and transparent safety borders; a tight rear-pose margin was fixed by adjusting the shared source scale to 0.275.
- All six frame indices were observed during an actual path. Arrival stopped at frame 0. A blocked step did not move the player. Both the saved reduced-motion control and OS preference suppressed animation. East/west doorway navigation reached the 12-column quiet room and returned.
- Clicking Rowan updated the speaker in place. Roster palette editing, project search, task/history reading, simulated inbox create/open/resolve and reopening the saved cool/motion preferences were exercised in the served UI.
- Mina's two sequential assignments remain in history, with the first released and the second active. No identity or task model was replaced.
- `roster.png`, `projects.png`, `inbox.png`, and `inbox-mobile.png` capture the functional reading surfaces. Cool/editorial screenshots retain the same application framing.
- Five domain tests pass; Svelte check reports zero errors/warnings; production build passes. Adapter-auto still has no configured production host, as before.

The internal comparison now matches A's main character proportions and UI composition. The room still uses the previously accepted modular composition and normalized props, so this is not a pixel-identical rendering of the original illustrated room. The character kit remains a small in-review source family; final work/sit/sleep poses, broader silhouette combinations, measured E03 performance and explicit user approval remain open. Do not treat this pass as Packet 1B completion.

## Runtime and next action

Agent-owned preview: `127.0.0.1:5173` UI, `127.0.0.1:4318` service. Disposable QA state remains `/private/tmp/pixel-visual-rebuild`; no user project data was overwritten. Restart with `PIXEL_HARNESS_DATA_DIR=/private/tmp/pixel-visual-rebuild npm run dev` and open the printed one-launch URL. Tokens are not persisted in the browser.

Review this candidate against the supplied A image; continue 0A/1B from the specific remaining visual/interaction feedback. Keep 2A not started.
