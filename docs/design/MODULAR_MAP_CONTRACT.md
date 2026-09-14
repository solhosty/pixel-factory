# Modular office-map contract — v2

Status: `approved implementation direction`

## Goal

Build the original top-down company Office from reusable tiles and props while preserving deliberate room composition. The first Studio supports six to eight local employees. Reuse remains required, but procedural room growth and project-owned rooms are no longer the product model.

## Map model

Each curated office layout is a grid. A cell carries independent layers:

```text
ground      floor tile id
structure   wall edge/corner/door tile id, or empty
decoration  rug / small prop id, or empty
fixture     furniture id plus bottom-center anchor and collision footprint
actor       employee or player id, or empty
```

The renderer draws layers in that order, with actors and fixtures sorted by their bottom anchor. A layout has no illustrated outer frame; its edges are normal wall/floor tiles. Reusable parts support future curated layouts without forcing the active Studio to grow procedurally.

## Presentation treatment

`warm`, `cool`, and `editorial` are presentation choices over the identical map model. A treatment may alter palette/material tokens but cannot alter a room's dimensions, exits, collisions, entity placement, or UI information architecture. This keeps visual preference separate from operational state.

## Capacity and occupancy

```text
layoutId: "studio"
workstationCapacity: 8
occupants: local employees only
```

Every local employee, assigned or available, may occupy one persistent workstation. Remote employees remain in operational views and never consume a workstation or render physically. Empty workstations remain part of the composition. Projects change desk content and UI context, not the physical layout.

## First product layout

1. Compose one warm Studio with six to eight workstation models, circulation space, meeting and social zones, storage, plants, rugs, and lighting.
2. Let the player navigate blocked/unblocked cells with keyboard and click controls.
3. Fill and free desks as local employees are created, deactivated, or moved remote without resizing or rearranging the layout.
4. Preserve the same office while project selection changes its task and conversation context.
5. Validate the fully populated layout before designing any larger office.

## Acceptance boundary

The earlier two-room doorway proof remains historical evidence that the renderer can reuse tiles and collisions. It is not the product target. The Studio passes only when six to eight workstations and their occupants remain attractive, readable, walkable, and correctly layered in the served application. If additional desks reduce composition quality, capacity remains capped until a separate larger layout is designed and approved.
