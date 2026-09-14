# Studio v3 implementation review

Reviewed in the served local application on September 13, 2026. This records implementation evidence, not user visual approval.

## Implemented

- Modular furniture and character sources in `static/assets/studio-v3`, with measured crops and runtime palette decoding.
- North-facing horizontal workstations, east- and west-facing side workstations, with persistent separate chairs. Seat direction and furniture are paired in workstation metadata.
- Four-direction, six-frame walking; four-direction seated and sleeping poses. Simple three-stage talking and sleeping bubbles.
- Contact shadows, lamp pools, aligned window illumination, room-edge shade, and a seamless floor.
- Chair return paths require reachable floor routes. Changing a moving coworker to sit or rest preserves their current position until they return. Reduced motion permits returning to the chair without animation.
- Study doorway moved clear of the plant; office return uses the clear aisle. Door transitions clear held input and face the entry direction.
- Compact map camera retains the player in view after resizing. Phone mailbox footprint reduced.
- `/studio` provides sixteen pose/facing previews, walk-frame stepping, and palette comparison without changing staff records.
- Reusable skill source: `docs/skills/pixel-office-assets`, installed as `pixel-office-assets`.

## Observed browser evidence

At 1536 × 1024, walked the player through the upper workstation aisle, across the room to the study door, around the west workstation, through the center and lower aisles, around the coat stand and coffee station, and around the study desk. Entered and returned from the study successfully after fixing held-input carryover. These were actual keyboard movements with arrival checks against rendered player coordinates.

North-facing Acceptance Runner and east-facing Hunter returned to their respective chair sockets after walking. Wilson left the west-facing chair and returned to sleep. All four office chairs remained rendered while coworkers walked. Hunter's reduced-motion return also completed. Sleep bubble phases 1, 2, and 3 were observed; talking phases were visible during the walkthrough.

All sixteen directional state previews rendered in `/studio`; stepped through the six walking frames in each facing. Reviewed the dark skin, ink hair, cream clothing palette across the states, then corrected magenta fringes and skin recoloring that affected shoes/clothing.

Inspected warm, cool, and editorial treatments. Reduced-motion keyboard navigation remained usable. At 390 × 844 the page width remained 390 pixels; verified map camera placement, compact mailbox, and the collapsible coworker panel.

## Checks

- `npm run check`: zero errors and warnings.
- `npm run test:office`: four navigation tests passed.
- `npm run build`: completed successfully, including the studio route.

## Remaining review boundaries

The reference remains the visual target; this pass is not a claim of an exact match or final art approval. Two complete hairstyle silhouettes are now implemented: bob and short ink crop. Accessory/body recipe fields are not a complete modular asset system yet. Automated route tests cover pathfinding, not every rendered overlap or future furniture arrangement. Full live task execution was not repeated during this art and navigation pass.

## Subsequent composition and movement pass

Added the reference's stepped lower room outline with matching floor exclusions, moved lower fixtures inside that footprint, and darkened the floor beneath the window light. Walked the entrance around its plant; cut-away floor is excluded by navigation. Dialogue history now shows completed work instead of repeating the current assignment. Speech tails and spacing were revised; at 1536 × 1024 the rendered dialogue viewport and content both measured 463 pixels, with all three options visible.

People now reserve their next step. Coworkers plan around occupied positions, pause on an idle frame when obstructed, and replan. The player retains a click destination while waiting for a occupied step. Patrol starts are staggered. Six navigation tests pass, including foot clearance and the stepped room boundary. Multi-person movement still needs extended live observation; these unit checks alone do not establish every collision scenario.

## Short ink crop family

Added separate body, walking and sleeping atlases selected by `crop-ink-01`. Source art was edited with built-in imagegen while preserving sprite positions, body poses and foot anchors. The studio was browser-reviewed at 1536 × 1024 with the crop selected: all sixteen pose/facing combinations rendered with separate persistent chairs. The auburn and brown bob options retain the original family. Prompt details are recorded in the asset provenance file.

## Visible full-room circuit

After integrating the second character family, showed the live browser and walked the player through the upper aisles, into the study, around all sides of its desk, and back to the office. Continued through the east aisle, past the cat and coffee area, around the entrance rug, through the lower aisle, and around both sides of the west desk, finishing at the center. Every commanded step was checked against rendered arrival coordinates. The narrow visible browser needed its coworker panel collapsed to leave the room unobstructed. The short-haired coworker returned to the east-facing chair and then changed to the matching sleep pose.

Eight office tests now cover both complete hairstyle source sets and all furniture crops as well as navigation. This verifies file availability and crop bounds; visual review remains necessary for new art.

## Sprite renderer and pet-bed collision

Sprite render requests now compare the resolved atlas, crop and visible palette before drawing; unchanged poses no longer redraw on every actor tick. The ink family bypasses the old copper-hair recoloring so its facial shading is preserved. Added the pet bed's explicit floor collision after observing a coworker cross it. In the live room, walked the open front aisle to (18,16), attempted to step into the bed, and verified the player remained at y=16. Eight office tests, type check, and production build pass after these changes.

## Final reference implementation audit

The live room now uses the approved composition's vertical navy rail, cream portrait dialogue with moss response and three options, dark terminal dock, stepped lower entrance, warm walnut materials, sunset window, book storage, plants, lamps, rugs and pet bed. Directional desk/seat pairs, persistent chairs, both complete character families, six-frame walks, four-direction sleep poses, animated talking/sleep bubbles, source-aligned window crossbar shadows, contact shade and lamp pools are implemented and reviewed. The reusable skill, source atlases, provenance and character studio are present in the project. Both rooms were walked in the visible browser; responsive, reduced-motion and alternate-treatment checks are recorded above.

The last lighting pass increased visible board grain and added window crossbar shadows. Checked the cool treatment and restored warm. Final type check and build passed. The implementation is ready for user art review; this does not record user approval or claim a pixel-identical raster reproduction of the concept.
