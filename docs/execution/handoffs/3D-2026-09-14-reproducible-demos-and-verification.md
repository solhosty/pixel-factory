# Packet 3D — reproducible demos and verification

Date: September 14, 2026
Status: complete

## Result

Migration `012_demo_verification_v1` stores one demo recipe per task and an immutable stream of demo evidence. Recipes retain setup, start/readiness and cleanup commands, only their declared ports, and known gaps. Each evidence record captures every selected folder's Git revision when available and its workspace fingerprint, plus exact check commands/results and a preview note.

`GET/PUT /api/v1/tasks/:taskId/demo`, `POST /api/v1/tasks/:taskId/demo/evidence`, and `POST /api/v1/tasks/:taskId/demo/evidence/:evidenceId/accept` provide the lifecycle. The `D` shortcut opens the sit-down review surface. A fingerprint or recipe change makes fresh/accepted evidence stale before it can be accepted; failed checks and invalid ports are rejected. This packet deliberately does not publish a PR or mark a project delivered.

## Acceptance evidence

- `npm run check:service`: pass.
- `npm test`: 35 passing tests, including fresh → accepted → stale evidence after a fixture workspace change, invalid-port rejection, and failed-check rejection.
- `npm run check`, `npm run test:office`, `npm run build`, and `git diff --check`: pass.
- Served browser: the existing locally-owned Studio preview at `http://127.0.0.1:5173/` rendered the office and coworker/task surfaces; its Sit-down Demo surface was opened with `D`.
- Live recipe: an isolated service on 4320 retained a disposable two-repository task. Its `python3 -m http.server 5181 --directory repo-a` preview passed its curl readiness check. Fresh evidence was accepted, a repo-b edit visibly staled it, fresh re-review evidence was accepted, and a second server attempt failed with `EADDRINUSE` while the original owned preview continued serving. Only the two temporary owned processes were stopped afterward.

## Known limitations

- This records a reproducible recipe and review evidence; it does not execute arbitrary setup/start shell commands from the browser. That keeps the service from turning a persisted task record into an arbitrary command runner. The saved recipe is the runnable handoff for 3E.
- User visual approval remains separate from implementation acceptance.

## Next session

Begin 3E only on explicit request. Read `docs/execution/packets/3E.md`, this handoff, and `docs/evidence/3D/acceptance-summary.json`; first verify one saved recipe against its intended repositories.
