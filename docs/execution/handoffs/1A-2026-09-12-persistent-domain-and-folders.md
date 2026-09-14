# Packet 1A — persistent domain and local folders

Date: September 12, 2026  
Status: complete  
Session/model: Codex desktop, GPT-5

## Checkout and running environment

- Repository path, branch, revision (or no Git initialized): `/Users/hunter/Documents/hunter/pixel-harness`; Git remains uninitialized.
- Dirty/pre-existing paths and this session's changes: preserved all documentation/design assets. Added the Node/SvelteKit scaffold, lockfile, `.gitignore`, local service, database/domain tests, and this handoff. `.pixel-harness/` is ignored; browser smoke-test data was isolated at `/private/tmp/pixel-harness-1a-browser`.
- Runtime/tool versions and prerequisite setup: Node `v26.5.0`, npm `11.17.0`; `npm install` installed the declared development dependencies. The service uses Node's built-in `node:sqlite` only.
- Running services, ports, ownership, and stop/restart commands: `npm run dev` starts service `127.0.0.1:4318` and UI `127.0.0.1:5173`. The service prints an ephemeral launch URL with a fragment token. The temporary browser-test processes are agent-owned and can be stopped with their owning terminal/session; no user service was changed.

## Result

`service/src/index.ts` is the loopback-only, strict-origin/token local HTTP service. It owns `service/src/database.ts` (ordered transactional `001_domain_v1` migration) and `service/src/folders.ts` (canonical filesystem mediation). It persists projects, delivery settings, local folders and availability, employees, tasks, assignments, sessions, and attempts. Project archive/reopen only changes database state. Canonical aliases deduplicate; parent/child overlap within a project is rejected; the same canonical folder cannot attach to another project. Relinking retains `folder_id`, task links, and project identity.

`src/routes/+page.svelte` is the functional Packet 1A setup UI: empty-project creation, archive/reopen, staff creation/editing, folder browsing/creation/attachment, unavailable relinking, and task folder subset/primary-folder selection. It intentionally contains no office navigation, fixtures, workers, native Codex invocation, or planning/execution controls.

## Acceptance evidence

| Criterion | Status | Exact check and outcome |
| --- | --- | --- |
| Ordered durable migration, two selected repositories, task assignment, archive/reopen, reload, source preservation, staff edit | pass | `npm run test` executes `service/test/domain.test.ts`; the first test creates two folders, selects both with one primary, persists/reopens SQLite, edits staff after reload, archives/reopens, and verifies `kept.txt` content survives. |
| Alias/overlap and moved-folder relink | pass | Same test command; second test attaches a canonical folder twice (same `folder_id`), rejects a nested attachment, moves it, marks unavailable, and relinks without changing `folder_id`. |
| Missing/invalid local path behavior | pass | Same test command; third test rejects missing selections and traversal-like creation names, then creates a direct child safely. |
| Cross-project task isolation | pass | Same test command; fourth test rejects using project Two's folder for a project One task. |
| Type/UI build | pass | `npm run check` completed with 0 errors/warnings; `npm run build` completed successfully. |
| Served empty-state/project creation | pass | `PIXEL_HARNESS_DATA_DIR=/private/tmp/pixel-harness-1a-browser PIXEL_HARNESS_TOKEN=packet-1a-browser npm run dev`, then opening `http://127.0.0.1:5173/#token=packet-1a-browser` displayed the setup UI and created an empty project through the service. This was an isolated temporary database, not a fixture. |

Final combined local check: `npm run test && npm run check && npm run build` passed: 4 tests, 0 Svelte diagnostics, successful production build.

## Decisions and approvals

Decision register IDs changed: none. E02 is implemented as approved; no contracts were widened.

User approval, date, and exact artifact version: E02 approval recorded September 12, 2026 in the Packet 00 handoff. No visual/art approval was requested or inferred.

Contract/API/data migration changes and downstream impact: Migration `001_domain_v1` creates required 1A records. It has a checksum recorded in `schema_migrations`; a changed historical migration prevents startup. The service returns v1 error envelopes and does not expose provider/session execution paths.

## Remaining work

- [ ] Packet 1B may connect approved map/roster/inbox components to this persisted model; do not add real worker or approval dispatch there.

Known failures and attempted fixes: browser validation initially showed native form navigation because handlers did not call `preventDefault`; corrected before the final served pass. The sandbox blocks tsx's temporary IPC socket, so `npm run test` needs a capable local runtime; it passed outside the restricted sandbox.

Limitations that must remain visible: the app is a development split, not a packaged production launcher; `adapter-auto` reports no detected production host during build. The token must be supplied through the one-launch fragment URL; refresh after the fragment is stripped requires opening the printed URL again. Folder browsing is service-mediated but is not an OS native picker. No fixtures ship and no attached source file is ever deleted.

## Next session

Next packet or continuation: packet 1A is complete; begin 1B only on explicit user direction.

Read these specific files: `docs/execution/packets/1B.md`, this handoff, `docs/architecture/CONTRACTS.md`, `docs/design/VISUAL_SPEC.md`, `service/src/database.ts`, and `src/routes/+page.svelte`.

First command/action: `npm install && npm run dev`, then open the exact ephemeral URL printed by the local service.

Smallest verification to establish the starting state: `npm run test && npm run check`.

Escalation/question if blocked: any change to durable identity, migration semantics, service auth/origin policy, or folder overlap behavior affects later packets and needs a contract review.
