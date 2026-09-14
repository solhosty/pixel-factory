# Pixel Harness contracts — packet 00

Status: **E01 verified on Codex CLI 0.154.0; E02 approved September 12, 2026.**

These contracts are the minimum downstream boundary. They are deliberately independent of a framework; no application exists yet. `v1` means the first implementation must persist and validate these fields, not that an API is already live.

## Execution integration boundary (E01)

**Verified protocol surface (Codex CLI 0.154.0, September 12, 2026):** generated app-server schemas expose durable `threadId` and `turnId`, structured thread-item and completion notifications, `thread/resume`, `turn/interrupt`, runtime workspace roots, and connection-owned PTY methods. The generated `TerminalInteractionNotification` includes `threadId`, `turnId`, `itemId`, and `processId`.

**Verified native-terminal topology:** Pixel Harness must own one long-lived local Codex app-server listener on a project-private Unix socket, connect as its structured protocol client, and spawn the actual CLI TUI as `codex --remote unix://<absolute-socket-path> resume <provider-thread-id> --no-alt-screen` in a service-owned PTY. The terminal renderer only transports that real TUI's bytes; it does not imitate or replace it. The redacted live probe proves the real TUI displayed “Resuming session,” shared one provider `threadId` with the structured client, accepted a PTY resize, queued a TUI follow-up, created a second provider turn visible to the structured client, and was followed by structured interruption plus `thread/resume` of the same thread. See [remote-native-resume-probe-summary.json](../evidence/00/remote-native-resume-probe-summary.json).

**Input/ownership rules:** exactly one WorkerLease owns the app-server client and the terminal PTY. The terminal is the sole raw-keyboard target while visible; browser conversation sends durable adapter messages and never writes arbitrary bytes to the terminal. During an active TUI turn, terminal text must be submitted with the TUI's queue control (recorded as Tab in the probe), which creates the next provider turn after the current one completes. Browser UI must show that queued state and cannot claim immediate delivery. Resize targets only the service-owned native-TUI PTY. A terminal loss records `terminal_detached`; it does not cancel the provider thread. Reattaching starts a new fixed-argv `codex --remote … resume` PTY for the same provider thread after the old terminal lease is gone.

**Safety limits:** the Unix socket is local-only, mode `0600`, outside browser reach, and is owned by the service. The browser never supplies the app-server socket path, native CLI arguments, a provider process ID, or a shell command. `process/spawn` is probe-only; production uses the service's fixed native-resume invocation, never a browser-controlled process request. App-server APIs remain experimental and version-pinned; regenerate schema evidence after every CLI update.

The older generated-API audit remains relevant: an agent command item `processId` is observable but has no direct client attach/write/resize request. See [native-terminal-api-audit.md](../evidence/00/native-terminal-api-audit.md). The verified remote-resume topology—not attachment to that command process—is the supported path. Unsupported alternatives still require an explicit decision: structured events plus an unrelated PTY, an external terminal with no shared app-server endpoint, or a terminal-like event renderer.

## Durable model (`v1`)

Employee identity is never a provider session or process ID.

| Record | Stable identifier | Required relationship |
| --- | --- | --- |
| Project | `project_id` | owns folders, milestones, tasks, decisions |
| LocalFolder | `folder_id` | belongs to a project; stores user-approved canonical path and availability |
| Employee | `employee_id` | persistent staff member; owns assignment history |
| Task | `task_id` | belongs to project; selects one or more folder IDs |
| Session | `session_id` | belongs to task and employee; holds purpose and continuation state |
| Attempt | `attempt_id` | belongs to session; one harness connection and recorded workspace set |
| HarnessConnection | `connection_id` | provider/configuration capability record, never copied credentials |
| WorkerLease | `lease_id` | belongs to attempt; exclusive execution ownership and heartbeat |
| DecisionRequest | `decision_id` | task or project scoped, immutable version history |
| Verification | `verification_id` | task/attempt/revision-or-workspace fingerprint evidence |

An attempt records the native provider identifiers only as opaque values: `provider_thread_id`, `provider_turn_id`, `provider_item_id`, `provider_process_id`. They are nullable and must never be used as the employee identity.

## Events, messages, approvals, and stops (`v1`)

Persist a versioned immutable event envelope:

```json
{
  "version": 1,
  "event_id": "evt_…",
  "sequence": 42,
  "at": "2026-09-12T18:00:00.000Z",
  "task_id": "task_…",
  "session_id": "ses_…",
  "attempt_id": "att_…",
  "kind": "attempt.output_delta",
  "payload": {},
  "source": { "adapter": "codex-app-server", "provider_event_id": null }
}
```

`sequence` is monotonically increasing per attempt; duplicate `(adapter, provider_event_id)` values are ignored when present. Unknown versions or kinds are retained and shown as unsupported rather than discarded.

A follow-up message is a durable record with `message_id`, `session_id`, content, `queued_at`, `delivered_at`, `delivery_attempt_id`, and `state` (`queued`, `delivering`, `delivered`, `failed`, `cancelled`). Only the current `WorkerLease` may transition it to `delivering`; recovery returns an unacknowledged message to `queued`. A UI send must never write directly to a terminal stream.

A decision has immutable `version`, options, tradeoffs, recommendation, `status` (`draft`, `pending`, `approved`, `superseded`, `rejected`), and the approving user/time. Dependent work dispatches only against the exact approved version.

Stop reasons are explicit: `user_stop`, `project_pause`, `office_close`, `approval_wait`, `permission_wait`, `usage_exhausted`, `authentication_failed`, `capability_missing`, `worker_lost`, `recovery_conflict`, and `adapter_error`. Only `office_close` is eligible for automatic resume, and then only after the prior lease is absent, workspace state is checked, and no approval/permission/recovery gate is active.

## Local service security contract (`v1`)

- Bind only to loopback (`127.0.0.1` and, if supported, `::1`); reject non-loopback hosts and forwarded-host headers.
- Generate a per-launch, high-entropy local service token. Deliver it only through the locally launched browser URL or an OS-owned launch channel; never store it in the browser profile, project database, logs, or query history.
- Require that token on every state-changing request, plus a strict `Origin` allowlist for the launched local UI origin. Reject missing, `null`, or foreign origins. Read-only endpoints still enforce same-origin or token authentication.
- The browser may request a task action, never an arbitrary shell command. The service maps it to a persisted task, current attempt, and adapter capability; it sends structured provider input or a narrowly validated byte stream to the service-owned native-TUI PTY under the current terminal lease. It never targets a provider command `processId` directly.
- Folder selection is an explicit user-mediated operation. Persist canonical path, folder ID, availability, and selected task scope. Resolve symlinks before dispatch; reject paths outside the approved selected roots and never accept a browser-supplied working directory as authority.
- Credentials remain in the provider-supported Codex credential store. Pixel Harness stores only connection metadata and readiness/capability results, never tokens, cookies, access keys, or copied config files.

## API and persistence contracts (`v1`)

Future local HTTP APIs use `/api/v1` and return errors only as:

```json
{ "error": { "code": "WORKER_LEASE_CONFLICT", "message": "…", "details": {}, "request_id": "req_…" } }
```

Every schema change is an ordered, transactional migration with identifier, checksum, applied time, and reversible/forward-only classification. A failed migration prevents service startup and preserves the prior database. No destructive automatic migration is allowed.

Fixtures are adapters, not successful mocks: deterministic scripted worker fixtures must emit output, permission, queued-message, interruption, duplicate-event, and recovery scenarios using the same event contract. They support UI and recovery tests; they never substitute for a required live Codex probe.

## E02 implementation decision — approved

Use a browser UI built with SvelteKit/Vite and a separate local TypeScript service on Node 26 using SQLite through the built-in `node:sqlite` API. Use `@xterm/xterm` only as the browser renderer for the service-owned real Codex TUI PTY; it is not an alternate execution or terminal emulator contract. The service owns the app-server socket, persistence, auth/origin checks, folder mediation, worker leases, terminal lease, and adapters; the UI is an untrusted local client. This is the smallest split that preserves the browser-first/local-service boundary without committing to desktop packaging or a native SQLite dependency.

No package, dependency version, generated app, or start command has been selected or verified. Packet 1A may create scaffolding only when the user explicitly starts that packet; it must establish and verify canonical commands then.
