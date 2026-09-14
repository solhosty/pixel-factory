# Packet 2D — shutdown, ownership, and automatic recovery

Date: September 13, 2026
Status: complete

## Result

Migration 007 persists project pause state, workspace fingerprints, owner tokens, office clients/runtime, and continuation records. The service owns a 10-second final-client grace timer, safely suspends the local app-server, reconciles command identity before treating a PID as its worker, reapplies 2C capacity, and resumes a new attempt under the original Pixel session and Codex thread. Manual session/employee/office stops and project pause persist and block automatic resume. Workspace drift becomes a reviewable recovery conflict.

The 2C right-sidebar coworker list remains beside the office. Recovery controls are exposed without moving it: Close office, Stop all, Pause/Resume project, Stop employee, and Stop session.

## Acceptance evidence

- `npm test`: 21/21 passed, including refresh/two tabs, expiry, closure resume, changed workspace, manual persistence, capacity recounting, and unrelated PID reuse.
- `npm run check:service`, `npm run check`, and `npm run build`: passed.
- Served browser: office rendered with the preserved sidebar layout and new office controls.
- Bounded real Codex recovery: source attempt `att_39b0297c-e6b7-49fb-be23-94be0c8693a3` resumed as `att_aaebfc90-c3f7-4db9-ba83-abb0f7deedce`, preserving session `ses_b0cc0de0-5a24-4526-b381-755dcb6b498a` and thread `01a09d6d-0fd2-7901-a9d7-2f7b0e73c527`; native TUI attached. Manual stop confirmed lease release and `0 active + 0 reserved`.
- The real run exposed and fixed a Codex writer-lock drain race: state is no longer marked resumed before native attachment.

Evidence: `docs/evidence/2D/acceptance-summary.json`. Contract: `docs/architecture/RECOVERY.md`.

## Next session

Packet 3A only on explicit request. Preserve exact plan approval, session/thread identity, native shared terminal, sequential capacity, recovery blocks, and the right-sidebar coworker UX. Do not start parallel execution, live Coder work, or 3A in this packet.
