# Packet 1B to 2A transition

Date: September 12, 2026
Status: usable for continuing development; visual polish deferred, not final visual acceptance.

## User decision

After the responsive correction the user said the result looked a little better but was not visually satisfying, and proposed getting the rest working. They then proposed another session for 2A and approved the handoff with “ok.” This authorizes starting Packet 2A in a separate task. It supersedes older handoff instructions to hold 2A until visual polish is finished. Do not mark 0A or every 1B visual criterion complete.

## Checkout and environment

/Users/hunter/Documents/hunter/pixel-harness; Git is not initialized. Preserve all current files. Node 26, SvelteKit/Vite, Node SQLite local service. The existing visual-review preview uses ports 4318 and 5173 with disposable data at /private/tmp/pixel-visual-rebuild. Inspect processes and package scripts before reusing or restarting; do not assume production state or overwrite data. The preview is simulated and has never launched a worker.

## Current result and evidence

Persistent projects, folders, staff recipes, assignments, and simulated inbox flows are implemented. Office room remains modular; full-room reference screenshots are not production backgrounds. Walking uses continuous animation, anchored sprite heads and camera tracking. Panels preserve room state; settings and sheets support dismissal/focus. Viewport shell fits desktop and mobile; coworker panel collapses and defaults closed on narrow screens.

Latest check/build both passed, Svelte 0 errors/warnings. Served responsive checks passed seven sizes from 1440x900 to 390x844 and 667x375 across warm/cool/editorial, with collapse/reopen and Projects access. See docs/evidence/1B-responsive/checks.json and screenshots; motion evidence is docs/evidence/1B-motion-panels/. Earlier persistence/domain evidence remains in prerequisite handoffs; verify current starting state rather than assuming all acceptance is fresh.

## Deferred visual work

Approved target remains docs/design/concepts/0A-treatment-a-warm-studio-v1.png. User is not satisfied with overall fidelity. Room richness/composition, character kit variety and work/sit states, icons and overall UI finish remain reviewable polish. Do not redesign or generate assets in 2A. Fix usability regressions as needed. Current sprites share one body/hair silhouette with recipe tinting; don't claim a complete kit.

## Next task: Packet 2A only

Read README.md, docs/execution/README.md, docs/execution/STATUS.md, docs/execution/packets/2A.md, docs/architecture/CONTRACTS.md, packet-00 and 1A handoffs, and latest 1B handoffs. Inspect service/src/database.ts, service/src/index.ts, src/routes/+page.svelte and package scripts. Start with minimal prerequisite checks.

Implement Codex detection/onboarding/readiness, one owned execution with saved events and identities, real native terminal plus conversation views sharing one session with input ownership, cancel/exit reconciliation, and prelaunch multi-folder failures. Follow E01 native-terminal contract; logs are not a terminal replacement. Real dispatch must require explicit UI action; no automatic launch. Use disposable folders for acceptance. No automatic fallback, parallel workers, 2B planning, or 2C recovery expansion. Record real vs fixture evidence honestly, redact secrets, and stop at 2A completion/review boundary with updated handoff and ledger.
