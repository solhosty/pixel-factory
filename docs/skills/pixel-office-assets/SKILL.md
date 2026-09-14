---
name: pixel-office-assets
description: Create and integrate Pixel Harness coworker sprites, furniture, room materials, lighting, and pixel UI assets in the approved warm studio style. Use for this project's asset generation, animation, sizing, placement, or visual quality work.
---

# Pixel Office Assets

Use the approved warm studio reference as the visual baseline, and the live modular room as the delivery surface. A successful isolated sprite is not a successful room asset.

## Locate the project and reference

The project is normally `/Users/hunter/Documents/hunter/pixel-harness`. Verify that location before using it. Read `docs/design/APPROVALS.md`, inspect `docs/design/concepts/0A-treatment-a-warm-studio-v1.png`, and inspect the current `src/lib/office/` renderer. Later user feedback overrides archived implementation decisions; previous handoffs are not visual approval.

Read [the asset contract](references/asset-contract.md) before generating or changing a sprite family. Use the imagegen skill for raster generation and image edits. Use code-native drawing for existing vector UI and procedural materials. Save final source atlases in the project, with generation prompts and provenance. Do not replace a functioning live room with a concept screenshot.

## Preserve the current roster

When the app already has employee characters, treat those exact characters as the identity source of truth. Before prompting image generation, inspect the served roster and persisted employee records, map every employee to the source atlas, crop boxes, palette, and existing states, and record which states are actually missing. Use each employee's current rendered sprites as identity-preserving image references for any extension. A room-level style reference alone is insufficient.

Do not invent replacement coworkers, generate unrelated roster concepts, or change an employee's face, hair silhouette, skin tone, clothing, accessories, proportions, or palette while filling missing states. Generate one employee family at a time, inspect the first candidate against that employee in the live app, and stop before producing additional families if identity does not match. Never batch speculative character identities. Do not integrate or retain a candidate merely because it fits the general office style.

## Build an asset family

Determine which existing family the asset must match. Inspect its actual raster output, not just its prompt. Keep the same head/body ratio, logical pixel scale, outline weight, perspective, material detail, and light direction. For a coworker, deliver the whole required state set with consistent identity and palette: four directional standing poses, six-frame walks in four directions, four seated directions, and four sleeping directions. A cropped standing sprite is not a seated pose. Do not mark a family complete if frames change head size, foot anchor, clothing, or facing.

Specify source-cell dimensions and padding in generation prompts, but measure the returned atlas: generators may ignore the grid or requested dimensions. Store explicit measured crop boxes. Transparent alpha must be real; a painted checkerboard is not transparency. The current renderer supports flat magenta keyed sources as an alternative. Inspect the key on both dark wood and pale cream for fringes and holes.

## Integrate before judging

Model a workstation as furniture orientation + monitor/keyboard orientation + seat anchor + coworker facing + collision footprint + draw order. These values belong together. A visible monitor front with keyboard beneath it normally puts the worker on the lower edge, facing north. Chairs belong to the workstation and persist when a coworker leaves. An east-facing coworker sits left of the desk, with keyboard on the left and screen facing left. Do not independently choose a visually appealing character pose that contradicts the workstation.

Place and light the asset in the actual room. Preserve clear walking lanes. Use separate contact shadows, directional window light, lamp pools, and room-edge shade. Baked light within a sprite does not replace scene lighting. Avoid broad bright overlays that wash out pixel detail.

## Verify the complete result

Use the local `/studio` character review page to inspect all four facings in standing, walking, seated, and sleeping states. Pause and step through all six walk frames, then inspect the loop in motion. Palette controls preview every state together without changing staff records. The bob family supports auburn/brown palettes. The short ink crop selects separate body, walk, and sleep atlases; inspect all three when adding another hairstyle.

Compare the served application to the approved image at 1536 × 1024. Walk the player around every workstation, along all room edges, and through narrow passages in the company-wide Studio. Check overlap and depth while crossing in front of and behind furniture. Exercise each coworker's walk, sit, and rest states and return-to-seat transition; test every direction and the wrap from last animation frame to first. Verify every predefined identity remains consistent across states.

Check the narrow layout, all supported room treatments, and reduced motion. Reduced motion freezes animation but preserves navigation and access to controls. Run relevant type/build checks and meaningful route/atlas validation. Record what was actually observed and keep unverified or visibly inconsistent states open. Never describe a pass as approved, production quality, or matching the reference merely because it compiles.
