# 3E user-experience and skills acceptance checklist

Source: direct user review, September 14, 2026. This is a completion checklist. Each item stays open until its verification is recorded; passing a typecheck does not check it off.

## 1. One coworker destination

**Done when:** the shell has one labeled Team destination. The Studio contextual panel and a selected desk both resolve to that same employee profile rather than separate roster/coworker views. There is no duplicate left-rail Coworkers/Roster navigation.

**Verify:** desktop and narrow served walkthrough; select an employee from Team, from the Studio panel, and from a populated desk. Each opens the same profile with the same assignment and skills.

## 2. Useful lower dock, never cropped chrome

**Done when:** the lower surface appears only for an active execution or a deliberately opened activity detail; inactive-state debug-like Local log/Folders/Terminal tabs do not occupy the Studio. A visible dock has one clearly named purpose and its full frame/content remains inside the viewport.

**Verify:** screenshot at 1536 × 1024, 1024 × 768, and 375 × 812 with no execution and with a fixture execution; test each remaining tab/control.

## 3. Clear inbox affordance

**Done when:** the decorative three-paper control is replaced by one clearly labeled Inbox button with a pending count. It opens only the inbox and has no unexplained rectangles.

**Verify:** desktop/narrow screenshots and click test with zero and nonzero pending requests.

## 4. Studio-consistent selection controls

**Done when:** all select controls use one Studio field treatment with a readable label, custom visual affordance, focus state, hover state, keyboard behavior, and narrow-layout fit. Native-looking raw selects are absent from the reviewed surfaces.

**Verify:** keyboard and pointer interaction in employee creation/profile, delivery, task composition, coworker location, and board filters at desktop/narrow widths.

## 5. No unexplained status/control glyphs

**Done when:** the signal bars, duplicate X glyphs, and unlabeled runtime counts are removed from the world bar. Project pause/office-stop actions either move to their owning workflow with explicit labels and confirmation or are not rendered when no meaningful action exists.

**Verify:** Studio header has only legible state and controls; every rendered control has a label, tooltip, and an observable result.

## 6. Desks identify their coworkers

**Done when:** selecting an occupied desk opens the profile of the coworker assigned there. An unoccupied desk is visually furniture, not a project shortcut.

**Verify:** populate multiple local seats; click every occupied desk and assert identity/assignment; click empty desks and confirm no navigation.

## 7. No dead click targets

**Done when:** decorative room props, empty desks, and inactive diagnostic controls are not buttons. Every focusable/clickable element performs its stated action.

**Verify:** keyboard tab audit and pointer audit of Studio fixtures, chrome, and lower dock.

## 8. Optional employee and workplace skills

**Done when:** positions create no implicit skills. An employee may start with no skills, select optional workplace skills, author a personal skill, or import a GitHub `SKILL.md` source. Workplace skills are a separately managed reusable library. An imported source is previewed, URL-validated, size-bounded, and stored with provenance; it contributes instructions only and never grants tools, accounts, filesystem access, or execution permissions.

**Verify:** create employees with and without skills; add/remove a workplace skill; import a safe GitHub `SKILL.md` fixture; reject invalid/non-`SKILL.md` URLs; launch a fixture task and assert the exact enabled employee + workplace skill snapshot is used once.

## 9. Cat interaction

**Done when:** the cat is an explicit, labeled interaction rather than decoration: Pet triggers a visible purr/bob response; Feed triggers a distinct, time-bounded happy response. Reduced motion preserves feedback without looping animation. Neither action fabricates project/task state.

**Verify:** click/keyboard activation, response reset, reduced-motion behavior, and no task/session mutation.

## Completion rule

Each numbered item requires its listed served-browser verification, type/build checks, and an evidence record. Visual acceptance remains yours after that evidence is presented.
