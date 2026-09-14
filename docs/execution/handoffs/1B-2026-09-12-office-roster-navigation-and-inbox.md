# Packet 1B — office, roster, navigation, and inbox shell

Date: September 12, 2026  
Status: complete  
Session/model: Codex desktop, GPT-5

## Checkout and running environment

- Repository path, branch, revision: /Users/hunter/Documents/hunter/pixel-harness; Git remains uninitialized.
- Dirty/pre-existing paths and this session's changes: preserved the existing Packet 00/0A/1A work. Changed service/src/database.ts, service/src/index.ts, service/test/domain.test.ts, src/routes/+page.svelte, README.md, and the execution ledger; added this handoff. The browser run used only /private/tmp/pixel-harness-1b-browser.
- Runtime/tool versions and prerequisite setup: Node v26.5.0, npm 11.17.0; existing dependencies from npm install were used.
- Running services, ports, ownership, and stop/restart commands: an agent-started development service/UI used 127.0.0.1:4318 and 127.0.0.1:5173 with PIXEL_HARNESS_DATA_DIR=/private/tmp/pixel-harness-1b-browser PIXEL_HARNESS_TOKEN=packet-1b-browser npm run dev. It is disposable test state, not user data.

## Result

service/src/database.ts adds forward-only 002_office_shell_v1. It stores the local map treatment/reduced-motion preference, a stable editable appearance recipe per employee, and explicitly simulated inbox records. completeTask ends the active assignment; project archive also ends active assignments so an archived project cannot silently strand staff. A busy employee cannot receive a second simultaneous assignment; assignment history remains attached to the employee.

service/src/index.ts exposes only local shell APIs: office preferences, appearance recipe update, task completion, and simulated inbox create/list/resolve. They do not spawn a process, invoke Codex, send a provider message, or dispatch an approval.

src/routes/+page.svelte is the Packet 1B route/component pointer. It renders an original CSS-built, tile-native 24 × 16 project office and a shared-parts 12 × 10 quiet workroom, with wall/door/fixture/actor layers, collision, click movement, arrows/WASD, and direct nav shortcuts. The same map data receives warm/cool/editorial token treatments. It retains 1A project/folder/task creation, adds project search, roster availability/history, editable composable recipes, task completion/release, and a mailbox with detail, linked task navigation, and resolved history.

No provisional generated office or employee assets were promoted as production assets. The renderer uses approved modular structure and A-style palette/component direction only; final asset-kit and motion review remain 0A work.

## Acceptance evidence

| Criterion | Status | Exact check and outcome |
| --- | --- | --- |
| Type/UI build | pass | npm run check reported 0 Svelte errors and 0 warnings; npm run build passed. |
| Existing persistence plus 1B regression | pass | npm run test in a capable local runtime passed 5 tests. The new office test persists editorial/reduced motion, saves an appearance recipe, rejects a second active assignment, completes the first task, assigns the same employee to a second task, resolves a simulated inbox request, and verifies state after reopening SQLite. |
| Populated served office and roster | pass | Opened the isolated one-launch browser URL; created Atlas, attached the local Pixel Harness folder, created Mina, edited and saved Mina's hair recipe, then created an assigned task. |
| Sequential employee identity/history | pass | In the actual served UI, “Prepare office walkthrough” was assigned to Mina, marked complete, and Mina immediately reappeared as assignable. “Follow up walkthrough” was then assigned to the same Mina identity. The task list showed the first complete and the second planned/assigned. |
| Inbox shell and long readable detail | pass | Created an Add simulated request entry, opened its details (including its explicit simulated/no-worker boundary and linked task), resolved it, and saw pending return to 0 with resolved history retained. Newly created default details use the longer technical-copy reading surface. |
| Walking/click/nav and doorway transition | pass | Clicked a clear map tile, focused the map, then used ArrowDown/ArrowRight through the east doorway. The served UI announced “Entered Quiet workroom.” Project, roster, and inbox navigation were also exercised through visible controls. |
| Treatment/reduced motion/reload persistence | pass | Selected Cool and enabled Reduced motion. Reloading the one-launch URL showed the saved checkbox on and a rendered main.treatment-cool.reduce-motion class, while Atlas and its two tasks remained present. |
| Responsive layout | pass | Browser measurements at 375 × 812, 1024 × 768, and 1440 × 900 had documentElement.scrollWidth equal to innerWidth. At 375 the map measured 336 px wide within its scrollable frame. Visual screenshots were inspected at desktop and phone sizes. |

## Decisions and approvals

Decision register IDs changed: none.

User approval, date, and exact artifact version: the A UI/art baseline and the modular expandable map direction are the existing September 12 0A approvals. No final asset-kit, animation, or product-wide interaction approval was inferred from this implementation.

Contract/API/data migration changes and downstream impact: ordered migration 002_office_shell_v1 adds only Packet 1B local-shell records. It preserves employee/task identities from 1A. The appearance recipe is separate from a name and provider/process IDs. Inbox sources are constrained to simulated; later real adapter/DecisionRequest integration must use the durable contract rather than silently reclassifying these records.

## Remaining work

- [ ] Packet 0A still owns final reusable art assets, animation, gallery, performance/motion review, and E03 approval; do not call CSS placeholder shapes or provisional source candidates approved assets.
- [ ] Packet 2A must add real Codex onboarding/execution only through the E01 native-terminal/lease contract; do not turn the Packet 1B task or inbox controls into a fake launch path.

Known failures and attempted fixes: the first served pass exposed an early Svelte router replaceState error and an optimistic project object without loaded tasks; both were fixed before final browser validation by using native history replacement and loading the created project before selection. The restricted sandbox blocks tsx's temporary IPC socket, so tests/dev need a capable local runtime; the capable runs are recorded above.

Limitations that must remain visible: the development split remains un-packaged; Vite's adapter-auto build reports no production-host adapter. The current one-launch fragment must be opened again after a page reload, because it is intentionally not stored in the browser. Folder browsing is service-mediated rather than a native picker. No folder/source data is deleted. Inbox entries and task completion are labeled simulated local state, not real worker progress.

## Next session

Next packet or continuation: packet 1B is complete. Begin 2A only on explicit user direction.

Read these specific files: docs/execution/packets/2A.md, this handoff, docs/architecture/CONTRACTS.md, docs/execution/handoffs/00-2026-09-12-execution-contracts.md, service/src/database.ts, service/src/index.ts, and src/routes/+page.svelte.

First command/action: npm run test && npm run check, then start an isolated npm run dev browser run using the printed one-launch URL.

Smallest verification to establish the starting state: npm run test (in a capable local runtime) plus the served office URL; check that no action exposes a Codex launch/send/approval route.

Escalation/question if blocked: any change to native terminal ownership, provider identifiers, worker leases, real messages, decisions, or launch arguments crosses the Packet 00 contract and needs explicit review.
