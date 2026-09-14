# Character assembly — draft v1

Status: `approved direction; assets not yet generated`

Pixel Harness should not need a bespoke illustration for every employee. An employee is assembled from original compatible sprite layers at render time, then cached as a regular sprite strip for that session.

## The recipe

Every employee stores a stable, editable appearance recipe:

```text
body:        base-01
skin:        umber-02
hair:        short-auburn-03
top:         cardigan-navy-01
bottom:      trousers-charcoal-01
accent:      moss-01
accessory:   glasses-round-01
```

The recipe is selected deterministically from the employee ID only as a default. The user can edit it; a name must never silently imply a face, gender, ethnicity, or role. The saved recipe, not a generated image, is the durable identity.

## Source-layer contract

- Every layer has the same `6 columns × 4 rows` strip: six walk frames for down, left, right, then up.
- Each cell uses one fixed source canvas and the exact same feet/bottom-center anchor. The first production candidate is `48 × 64` source pixels per cell (displayed only at integer scale), subject to final grid QA.
- Draw order: body/base → lower clothing → top clothing → head/face → hair or hat → accessory → optional held item. Layers may intentionally opt out of a direction/frame, but must still preserve the cell slot.
- All layers use indexed colors or named palette slots (`skin`, `hair`, `fabric`, `accent`) where possible. Palette substitutions can provide variety without multiplying source art.
- A compatibility table prevents impossible combinations (for example, a full hat may replace the hair layer rather than overlap it).
- Build-time validation must reject a layer with an opaque canvas background, a different grid, a shifted foot anchor, clipped limbs, or a different frame count.

## Scale without generic clones

A modest authored kit yields variety while retaining art direction: 6 base silhouettes × 8 hair/hat options × 8 tops × 5 palette accents × 4 accessories creates more than 7,000 valid appearances before compatibility rules. That is enough for an unconstrained roster without claiming every combination is equally distinct; new parts can be added later without changing existing employee recipes.

## Animation and motion

The assembled strip animates as one sprite: walk is six frames at 100 ms; idle selects a short, low-motion loop. A character never re-rolls during a session. Menu and speech-bubble micro-motion are separate UI behavior, not character animation.

## Next asset pass

Create a tiny complete vertical slice first: one base body, two hair layers, two tops, one accessory, and four facing/walk directions. Verify a compose → cache → walk loop on a checkerboard background before producing the wider kit.

## Rebuild candidate, September 12

The first integrated candidate is original code-authored SVG layering in `src/lib/office/art.ts`, using 24 × 32 logical pixels rendered at integer 2× rather than promoting an unvalidated generated sheet. It composes skin, hair, shirt, accent and optional glasses from the persisted recipe and caches complete poses. Four directions each expose six walk frames; idle is deliberately static. Body and trousers currently have one silhouette. Existing recipe values remain stored unchanged even when this tiny kit has no distinct art for them.

This is a documented provisional source-size deviation from the proposed 48 × 64 sheet, not final E03 approval. `scripts/validate-office.ts` emits the complete transparent directional grid. The generated v5 sheet is not used as a composable source.
