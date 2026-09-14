# Packet 2C — coworker list, office task board, and machine capacity

Date: September 13, 2026
Status: complete
Session/model (if known): Codex

## Checkout and running environment

- Repository: `/Users/hunter/Documents/hunter/pixel-harness`; Git is not initialized.
- The checkout matched the completed 2B handoff: versioned plan approval, scoped guidance, durable follow-ups, Codex-originated inbox requests, and the shared terminal/session implementation were present.
- This packet changes `service/src/{capacity,database,codex,index}.ts`, `service/test/{capacity,domain}.test.ts`, `src/lib/{Coworkers,SidebarCoworkers}.svelte`, `src/routes/+page.svelte`, `package.json`, and the 2C documentation/evidence.
- Acceptance used Node 26.5.0 and Codex CLI 0.154.0 with disposable state at `/private/tmp/pixel-2c-acceptance`.
- The acceptance service was stopped after verification. Use `PIXEL_HARNESS_DATA_DIR=<path> npm run dev` to start another isolated run.

## Result

The office remains the primary canvas. Its right-hand panel now defaults to the all-coworker list with All, In office, and Remote filters. Selecting a coworker replaces that list with the existing conversation and actual-terminal surface; the back action returns to the list. Only locally bound coworkers appear as office sprites. Remote coworkers remain listed with persisted Coder environment bindings and explicit `not connected` state.

The office-wide task board reads the same projects, assignments, sessions, attempts, inbox requests, and environment bindings. It filters by project, coworker/unassigned, and derived status, and opens the corresponding task or persisted session. It shows project, owner, status, execution location, and blocking reason.

Migration `006_environment_capacity_v1` adds execution hosts/environments, employee bindings, capacity slots, and durable capacity waits. Admission uses the documented CPU/memory policy, shared-host occupancy, an optional lower user ceiling, and the existing one-execution ceiling. Reservations occur transactionally before spawn. Stop releases capacity only after the app-server exits; SIGTERM escalates to SIGKILL after two seconds and a missing exit acknowledgement leaves capacity occupied.

## Acceptance evidence

- PASS — `npm test`: 16 tests passed. Deterministic cases cover CPU-limited, memory-limited, missing/stale samples, lower ceilings, simultaneous admission, shared-host accounting, multiple sessions under one employee, retained waits, live-owner release refusal, limit decreases, remote binding, plan blocks, and completed history.
- PASS — `npm run check`: zero Svelte errors and warnings.
- PASS — `npm run check:service`: service and service-test TypeScript passed.
- PASS — `npm run build`: production build passed.
- PASS — served browser: reload opened the office with All coworkers in the right sidebar; In office and Remote filters selected the expected fixtures; remote fixtures did not appear in the office; selecting a row opened the coworker's existing conversation/session in that sidebar.
- PASS — served browser board: Atlas/Beacon, unassigned, planned, working, completed, approval-blocked, capacity-blocked, and disconnected remote fixtures rendered. Project/coworker/status filters and task/session navigation passed. Completion and location state survived reload.
- PASS — capacity UI: local measurement showed its source/freshness/estimates and `0 active + 0 reserved / 1 effective`; a zero ceiling rejected launch and retained the task as `waiting for capacity`; automatic capacity restored the effective slot.
- PASS — bounded real local run: the native Codex TUI returned exactly `FINAL_STOP_GATE_PASSED` without tool or file activity. The board and coworker panel showed the same session ID. Stop confirmed process exit and returned the local host to `0 active + 0 reserved / 1 effective`.
- Evidence: `docs/evidence/2C/acceptance-summary.json` and `docs/architecture/CAPACITY.md`.

## Decisions and approvals

- The user's correction on September 13 places the default coworker list in the existing right sidebar alongside the visible office, rather than in a modal.
- No decision-register entry changed. Existing exact-plan approval and session/provider identity contracts remain intact.
- Coder entries are labeled fixtures. No live Coder capability is claimed.

## Remaining work

- None for packet 2C.

Limitations that remain visible: execution is sequential until 5A; Coder execution remains unavailable until 6; resource admission is an estimate; capacity waits require explicit retry until 2D/5A adds recovery/scheduling.

## Next session

Next packet: 2D, only when explicitly requested.
Read: `MILESTONES.md`, `docs/execution/README.md`, `docs/execution/STATUS.md`, `docs/execution/packets/2D.md`, this handoff, and `docs/architecture/CAPACITY.md`.
First action: confirm migration 006 and the capacity/worker reconciliation tests still pass, then implement shutdown and automatic recovery without weakening process-exit ownership checks.
Smallest starting verification: `npm test && npm run check:service`.
Escalation/question if blocked: none.
