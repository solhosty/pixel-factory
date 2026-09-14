# Packet 2A — Codex onboarding and one execution

Date: September 12, 2026  
Status: acceptance_passed_needs_user_signoff  
Session/model: Codex desktop, GPT-5

## Checkout and running environment

- Repository: `/Users/hunter/Documents/hunter/pixel-harness`; Git remains uninitialized.
- Added `service/src/codex.ts`, migration `003_codex_execution_v1`, live execution routes, native xterm UI, and xterm dependencies. Existing office/data UI was preserved.
- Node 26.5.0, Codex CLI 0.154.0 with ChatGPT login. Disposable acceptance used isolated service data under `/private/tmp`; no user repository was dispatched.

## Result

The local service detects Codex readiness and distinguishes missing CLI/authentication failures. Explicit project-task dispatch validates two selected available folders, stores a Session/Attempt/WorkerLease and immutable event sequence, starts the fixed E01 app-server/native-resume topology, and exposes the same provider session in structured conversation activity and an actual `@xterm/xterm` native TUI. Browser terminal keyboard bytes only target the terminal lease. Stop interrupts/kills the owned terminal and releases the lease; terminal loss is persisted as `terminal_detached` without pretending the provider thread was cancelled.

## Acceptance evidence

- **pass** — `npm run check`, `npm run test` (10 tests), and `npm run build` passed. Deterministic cases now cover readiness/failure classification, duplicate dispatch, orphan reconciliation, and persistence-boundary credential redaction.
- **pass** — real explicit disposable run `att_9d0dbc7e-1e01-4a38-992c-3cec0c3201a8` changed two Git repos: `terminal-a.txt` was `A`, `terminal-b.txt` was `B`.
- **pass** — the persisted native terminal stream contained `Resuming session` and 411 `attempt.terminal_delta` events, proving the actual remote-resume TUI rather than a log substitute.
- **pass** — explicit stop recorded `attempt.stopped`, `lease_state: released`, and `stop_reason: user_stop` while the two changed files remained intact.
- **pass** — a fresh browser-driven run `att_2db84d17-8565-451e-8317-bb3695066e91` created only `acceptance-a.txt` (`A\n`) and `acceptance-b.txt` (`B\n`) in two disposable Git repositories. The native terminal reported both paths while the activity view named the same employee/task execution.
- **pass** — a separate live `sleep 30` attempt `att_2b58cee8-a5ad-409a-bcac-b4916c906265` showed the duplicate-launch guard, then browser Stop produced `lease_state: released`, `stop_reason: user_stop`, and `continuation_state: stopped`.
- **pass** — deterministic fixtures distinguish missing CLI, authentication, model, permission, and usage exhaustion. A final persisted-data scan found zero credential-shaped values.

Redacted concise evidence: `docs/evidence/2A/acceptance-summary.json`.

## Decisions and approvals

No architecture decision changed. The implementation follows E01 fixed native resume and never accepts browser-provided commands, socket paths, provider process IDs, or working directories. Real launch remains an explicit Project action; there is no fallback, parallel worker, 2B gating, or 2C recovery expansion.

## Remaining work

- [ ] User signoff to mark Packet 2A complete.

## Next session

If the user approves this browser acceptance, mark Packet 2A complete and move only on an explicit request to Packet 2B.
