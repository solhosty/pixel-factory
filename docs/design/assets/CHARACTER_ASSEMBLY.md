# Character identity contract — v2

Status: `supersedes editable assembly for initial release; assets incomplete`

Pixel Harness initially ships a curated roster of complete predefined character families. The user selects an unused identity and names the employee. Position, skills, execution location, and project assignment never determine appearance.

## Identity and uniqueness

Every employee stores one stable character identity:

```text
character_id: studio-character-01
```

One active employee may own a character identity at a time. Used identities are unavailable in the creation picker. Deactivating an employee releases the identity for future use while retained history continues to reference it. The initial release exposes no skin, hair, clothing, accessory, or palette editing.

## Character-family contract

- Every layer has the same `6 columns × 4 rows` strip: six walk frames for down, left, right, then up.
- Each cell uses one fixed source canvas and the exact same feet/bottom-center anchor. The first production candidate is `48 × 64` source pixels per cell (displayed only at integer scale), subject to final grid QA.
- Every identity includes standing, four-direction six-frame walking, four seated directions, four sleeping directions, and a portrait.
- Build-time validation must reject a family with an opaque canvas background, a shifted foot anchor, clipped limbs, an incomplete state, or inconsistent identity across frames.

## Distinct roster

The first asset pass targets at least six genuinely distinct identities, not recolors of one silhouette. More character families expand the maximum active roster without changing existing employee records. Position choices may repeat across these identities.

## Animation and motion

The assembled strip animates as one sprite: walk is six frames at 100 ms; idle selects a short, low-motion loop. A character never re-rolls during a session. Menu and speech-bubble micro-motion are separate UI behavior, not character animation.

## Next asset pass

Create a tiny complete vertical slice first: one base body, two hair layers, two tops, one accessory, and four facing/walk directions. Verify a compose → cache → walk loop on a checkerboard background before producing the wider kit.

## Rebuild candidate, September 12

The first integrated candidate is original code-authored SVG layering in `src/lib/office/art.ts`, using 24 × 32 logical pixels rendered at integer 2× rather than promoting an unvalidated generated sheet. It composes skin, hair, shirt, accent and optional glasses from the persisted recipe and caches complete poses. Four directions each expose six walk frames; idle is deliberately static. Body and trousers currently have one silhouette. Existing recipe values remain stored unchanged even when this tiny kit has no distinct art for them.

This is a documented provisional source-size deviation from the proposed 48 × 64 sheet, not final E03 approval. `scripts/validate-office.ts` emits the complete transparent directional grid. The generated v5 sheet is not used as a composable source.
