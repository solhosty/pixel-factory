# Modular office-map contract — v1

Status: `approved implementation direction`

## Goal

Build original, expandable top-down office maps from reusable tiles and props. The reference is a modular social-office experience: rooms can grow, connect, and change without drawing a new bespoke backdrop. This defines functionality, not copied third-party art.

## Map model

Each room is a rectangular grid. A cell carries independent layers:

```text
ground      floor tile id
structure   wall edge/corner/door tile id, or empty
decoration  rug / small prop id, or empty
fixture     furniture id plus bottom-center anchor and collision footprint
actor       employee or player id, or empty
```

The renderer draws layers in that order, with actors and fixtures sorted by their bottom anchor. A map has no illustrated outer frame; its edges are normal wall/floor tiles and can be expanded or connected.

## Presentation treatment

`warm`, `cool`, and `editorial` are presentation choices over the identical map model. A treatment may alter palette/material tokens but cannot alter a room's dimensions, exits, collisions, entity placement, or UI information architecture. This keeps visual preference separate from operational state.

## Room connection

```text
roomId: "warm-office"
grid: { width: 24, height: 16 }
exits: [
  { edge: "east", at: 7, width: 2, target: "quiet-workroom", targetEdge: "west", targetAt: 7 }
]
```

An exit is a normal doorway strip. Crossing it changes room/camera context while preserving actor position, focus, and the user's chosen map treatment. No transition relies on a special full-room image.

## First vertical slice

1. Render a `24 × 16` warm-office map with repeated floor, perimeter wall/door variants, and one desk, chair, bookcase, plant, and rug.
2. Let the player navigate blocked/unblocked cells with keyboard controls.
3. Render an adjoining `12 × 10` quiet-workroom using the same floor, wall, and prop assets.
4. Cross one doorway in both directions without a visual seam or duplicate actor.
5. Only then add richer furniture, employees, meetings, UI overlays, and alternate map treatments.

## Acceptance boundary

The first proof is not judged by screenshot polish alone. It passes when the same art parts work in two room sizes and survive a doorway transition; it fails if new bespoke boundary illustration is required for the second room.
