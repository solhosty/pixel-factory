# Packet 1B visual rebuild — candidate v1

Date: September 12, 2026
Status: in progress; internal browser review performed, user visual approval pending. **Do not begin 2A.**

The earlier 1B handoff's completion claim is superseded by the user's rejection and this continuation. No production asset or motion approval is inferred.

## Result and boundaries

Replaced the CSS-placeholder/unsliced-sheet office with a separate modular renderer in `src/lib/office/Office.svelte`. It builds 24 × 16 and 12 × 10 rooms from repeated floor/wall/door layers, rug decorations, reusable props, and depth-ordered people. Generated room concepts are reference-only. Added collision-aware click paths instead of teleport-plus-animation. Four facing directions use six 100 ms poses while traveling; idle is static. The persisted and OS reduced-motion preferences both suppress movement transitions and frame cycling. Mobile keeps integer 2× rendering and a horizontally panning camera.

`src/lib/office/art.ts` contains original integer-coordinate SVG floor/wall/window/monitor and layered character art. Character skin, hair silhouette/color, shirt, accent and glasses use the actual saved recipe and a bounded cache. Body/trousers currently have one art silhouette; unknown saved IDs are not discarded. The provisional character canvas is 24 × 32 logical pixels at 2×, deviating from the proposed 48 × 64 production candidate. This is a deliberately small in-review kit, not final E03 or a claim of thousands of finished combinations.

The warm desk, plant, bookcase, chair, rug and noticeboard candidates were normalized non-destructively into `static/assets/office-normalized/`. `scripts/normalize-office.cjs` records alpha threshold, exact crops, footprint, transparent border, bottom anchor and source paths. It requires Sharp (`PIXEL_SHARP_PATH` can point to the bundled module). Source assets remain unchanged. The page uses responsive CSS navy framing and cream reading surfaces, conventional system text, and no stretched panel or navigation bitmap.

Project, roster, task, appearance and inbox API/model storage are unchanged. Fixed linked inbox task navigation to select its owning project. Added O/P/R/I shortcuts outside form fields and Escape to return to office. No launch, worker, Codex, send, real decision or approval dispatch was added. Development preview remains an unpackaged local shell.

## Verification

Evidence directory: `docs/evidence/1B-visual-rebuild/`.

- `browser-checks.json`: six distinct frames observed across a moving path; idle frame 0 after arrival; both app and OS reduced motion stayed at frame 0 with no moving state; entered the quiet room and returned; no page errors.
- Actual served UI: created Atlas studio and four colleagues; attached the existing repo folder; Mina completed “Review the warm office shell” then took “Verify the same colleague takes a second task.” Edited saved recipes through the roster. Created/opened/resolved a labeled simulated request. Reopened the launch URL and retained four employees, the cool treatment and reduced motion. Screenshots include `projects.png`, `roster.png`, and `inbox.png`.
- `desktop.png`: populated warm room at 1440 × 900. `office-375.png`, `office-390.png`, `office-1024.png`, and `inbox-mobile.png` capture responsive checks. Document widths match viewport widths; the map itself intentionally pans rather than shrinking.
- `cool.png`, `editorial.png`, and `warm.png`: presentation variants over identical geometry; cream/navy application UI remains stable.
- `alpha-checks.json` confirms binary alpha and transparent 16 px borders on all six normalized exports; `tile-repeat.png` was visually inspected as 4 × 4 repeated floor/wall patches with no gaps.
- `walk-filmstrip.png`, `character-grid.svg`: visual pose evidence; `scripts/validate-office.ts` verifies 24 cell canvases, distinct directional poses, and recipe substitutions.
- Five existing domain tests passed via `node --import tsx --test service/test/domain.test.ts`; `npm run check` and `npm run build` passed. Adapter-auto still reports no production host, as before.

Compared the served captures against `0A-A-v1`. The rebuilt scene reads as warm wood, plants, desks and people with stable navy/cream chrome. Panel stretching, awkward typography, unreadable placeholder actors, and after-the-fact walking have been removed. It remains simpler and more regular than the richly detailed approved still. It does not yet match A's full environmental density, character illustration detail, work/sit poses, or conversation/terminal composition. Those are explicit remaining art/interaction work; this handoff does not represent visual acceptance or Packet 1B completion. No real terminal is fabricated in this shell.

## Run and next action

Agent-owned preview: UI `127.0.0.1:5173`, service `127.0.0.1:4318`, test data `/private/tmp/pixel-visual-rebuild`. Restart using `PIXEL_HARNESS_DATA_DIR=/private/tmp/pixel-visual-rebuild npm run dev`, then use the printed one-launch URL. No user data was replaced. The launch token is not persisted; reopening the printed URL is needed after refresh.

Next: review this candidate against A as a whole. Continue 0A/1B visual work for remaining density, richer character art, supported work/sit states, and final interaction/performance acceptance. Do not proceed to 2A, claim E03 finalized, or reuse the earlier completed status.
