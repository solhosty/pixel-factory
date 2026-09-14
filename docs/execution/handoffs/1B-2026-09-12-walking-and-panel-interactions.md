# 1B — walking, sprite framing and panel interactions

September 12, 2026. Continued in progress. Addresses the user's two reported issues only; no Packet 2A work.

## Corrections

- Replaced independent tile timeouts, CSS sliding and key-repeat restarts with one requestAnimationFrame movement loop. A step takes 240 ms; poses advance every 100 ms for the whole movement, including across tile boundaries. Key release finishes the current step and settles to idle. Retargeting a click finishes the current segment before following the new path. Collision and room exits retain the existing grids.
- The camera follows the interpolated drawing position through a bounded area of the viewport, instead of snapping to the destination tile ahead of the sprite. Rendered positions are rounded to pixels. Reduced motion shows immediate click relocation and unanimated keyboard steps at the normal input cadence.
- Stabilized the generated head/face across each direction's six frames using its idle head, avoiding face and haircut changes during a walk. Original generated source files remain untouched. Added scrollable headroom for the north wall so the full sprite stays visible. Replaced the oversized CSS portrait crop with a dedicated square head-and-shoulders SVG view.
- Kept the office mounted behind project/roster/inbox sheets. Opening them pauses navigation rather than destroying the component and losing the player's room and position. A partly completed step resumes to its endpoint after dismissal; queued travel is cleared.
- Sheets enter with a restrained 8 px/160 ms transition and fade out briefly. Settings is positioned beside its triggering control and clamped inside the screen. Escape, close controls and outside click dismiss the appropriate surface. Focus enters the sheet, stays inside for Tab traversal, and returns to its opener. Speaker and dock swaps get a short fade without scaling text. Both the persisted and OS reduced-motion preferences suppress these transitions.

## Checks

`docs/evidence/1B-motion-panels/`:

- `final-checks.json`: assertions passed for continuous held-key movement, fractional drawing positions between tiles, stable position after closing a panel, panel focus containment, reduced-motion keyboard travel, zero reduced-motion sheet animations and no mobile document overflow.
- `checks.json`: longer walkthrough includes Escape/outside dismissal, focus return to Projects, idle stability and north-wall traversal. Its first reduced-motion key observation preceded settling the media-query event; the final regression specifically waits for that event and asserts the step occurs.
- `walking-and-panels.webm`: final served recording. `motion-review.png` is a sampled sequence from the initial recording reviewed for travel/camera continuity and panel behavior. `office-final.png`, `north-wall.png`, `projects.png`, `settings.png`, `mobile-final.png` cover framing and layout.
- All 24 sprite canvases pass the layer recomposition/border checks. Svelte check and production build pass. The existing domain/API source is unchanged.

Implementation: `src/lib/office/Office.svelte`, `src/lib/office/art.ts`, `scripts/export-character-kit.cjs`, generated character layer exports and `src/routes/+page.svelte`.

Preview remains agent-owned on 5173/4318 with disposable `/private/tmp/pixel-visual-rebuild` state. Open the service's printed one-launch URL. No saved domain IDs, migrations, workers, dispatch, or source folders changed. Packet 1B remains in progress; wait for the user's next specific observations.
