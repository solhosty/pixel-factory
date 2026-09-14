# Native terminal attachment API audit

Date: September 12, 2026  
Codex CLI: `0.153.4`  
Source: TypeScript bindings generated locally with `codex app-server generate-ts --experimental`.

## What an active Codex command exposes

`v2/ThreadItem.ts` defines a `commandExecution` item with `id`, `cwd`, status, aggregate output, and nullable `processId`. The generated `TerminalInteractionNotification` includes `threadId`, `turnId`, `itemId`, `processId`, and `stdin`. `ServerNotification.ts` exposes command output and terminal-interaction notifications for these items.

That is sufficient to associate structured conversation/activity with a provider command record. It is not an attachment protocol: notifications are server-to-client and do not create a client-owned terminal stream.

## Complete request-side terminal surface

The generated `ClientRequest.ts` exposes these terminal/process requests:

- `command/exec`, `command/exec/write`, `command/exec/resize`, and `command/exec/terminate` take a caller-supplied, **connection-scoped** `processId`; `command/exec` creates the process.
- `process/spawn`, `process/writeStdin`, `process/resizePty`, and `process/kill` take a caller-supplied, **connection-scoped** `processHandle`; `process/spawn` creates the process.
- `thread/backgroundTerminals/list` and `thread/backgroundTerminals/terminate` list/terminate tracked background terminals, but do not expose output subscription, input, resize, or an attach operation.
- `thread/shellCommand` is thread-associated but explicitly executes an unsandboxed shell command; it acknowledges immediately and supplies no terminal attachment capability.
- `turn/interrupt` interrupts a turn, not a terminal attachment.

No generated request accepts a Codex `threadId` + `turnId` + command `itemId`/provider `processId` to attach, subscribe, write, resize, or render its actual interactive Codex CLI TUI. `CommandExecutionRequestApprovalResponse` accepts only a permission decision; it is not general terminal input routing.

## Result

The generated API can support a structured command/activity view and separately owned terminal processes. It cannot, on its documented generated surface, prove the product requirement: one actual interactive Codex CLI terminal attached to the same execution as the conversation view.

This is a version-specific negative finding, not a statement that no future Codex release can add the capability. Regenerate the bindings and repeat this audit after every CLI update or when OpenAI publishes an attachment API.
