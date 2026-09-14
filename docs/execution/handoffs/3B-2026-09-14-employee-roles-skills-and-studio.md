# Packet 3B handoff — employee roles, skills, and Studio

Status: complete.

## Implemented

- Seven repeatable positions with curated default skill bundles, including Security Engineer with Threat modeling and Security verification.
- Built-in and authored employee skills, explicitly separated from permissions and capabilities.
- Launch-time resolution of position defaults, employee skills, guidance, and task instructions into an immutable session snapshot.
- Predefined character ownership with duplicate-active-owner rejection and name-only appearance setup.
- One company-wide eight-desk Studio; the Quiet workroom and doorway transition are removed. Local occupancy remains independent of the single-worker execution ceiling.
- Six complete character families. Identities 03–06 were generated one family at a time from the exact current production atlases; each has body/seated, four-direction six-frame walk, sleep, and portrait states.
- The six complete identities bound the initial active roster while the eight-desk Studio retains intentional vacancies. Unfinished identity IDs are rejected rather than rendered through another character's fallback recipe.
- The `pixel-office-assets` skill now requires current-roster inspection and one-family-at-a-time approval before generation.

## Evidence

- `npm test`: 28/28 passing.
- `npm run check:service`: passed.
- `npm run check`: 0 errors and 0 warnings.
- `npm run test:office`: 8/8 passing.
- `npm run build`: passed.
- Served-browser review: empty eight-desk Studio, a three-person Studio with identities 01–03, and `/studio` state/step review for identities 04–06.

## Final browser acceptance

- The served app ran on the required `5173` port. Six employees with repeated and distinct positions filled six of eight desks without duplicate identities.
- Moving Casey to a saved Remote Studio location changed the map to five occupied desks and one remote coworker while preserving Casey in both coworker directories.
- Warm, cool, editorial, reduced-motion, narrow `390 × 844`, and wide `1536 × 1024` layouts were checked. Keyboard Studio movement and atlas route/collision tests passed.
- The wide visual review exposed colliding world-bar controls; that was corrected to compact accessible icon controls and rechecked.
- `/studio` was used to select all six identities and step all six walking frames with standing, seated, sleeping, and portrait state grids visible.

This is implementation acceptance. User visual approval remains a separate product decision, not a claim implied by the automated or browser evidence.

## Final main acceptance

The current main specification's seventh Security Engineer position is added through forward-only migration `010_security_engineer_position_v1`, preserving the checksum and upgrade path for databases that already applied migration 009. The isolated served app exposed all seven positions in the employee form; creating Morgan as a Security Engineer succeeded, and the profile showed the exact Threat modeling and Security verification defaults plus the capability-separation note. A completion audit then found that the service accepted unfinished identities 07–08 and rendered them with identity 01's recipe. The service now exposes and assigns only the six complete families, rejects unfinished IDs, and keeps roster capacity independent from the Studio's eight desks. Automated and isolated served-browser regressions passed after the correction. Packet 3B is complete. Packet 3C is next only on explicit request.
