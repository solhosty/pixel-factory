# Shutdown and recovery contract

Packet 2D keeps execution local and sequential. Browser clients heartbeat once per second. A client is stale after the configured grace period (10 seconds by default); refresh may overlap old and new client identities, and any remaining tab keeps the office open. `pagehide` is only an optimization. The service heartbeat expiry is authoritative.

Office closure stops only the in-memory `CodexExecution` owner after creating a continuation record. The record preserves the Pixel session id, source attempt, Codex thread id, selected workspace set, baseline workspace fingerprint, reason, and summary. Reopening creates a new attempt beneath the same session and calls Codex `thread/resume`. It re-runs the packet 2C admission transaction first and marks the continuation resumed only after the native app-server and TUI attach.

Automatic resume applies only to `eligible` closure/restart continuations. Manual session/employee/office stops cancel matching continuations. Project pause is durable. Pending inbox requests, archived/paused projects, changed workspace fingerprints, unavailable capacity, and failed recovery attaches remain blocked or eligible for bounded retry; none are reported as resumed early.

Ownership invariants:

- one local attempt owns the sequential capacity slot;
- capacity is released only after the owned app-server exits or reconciliation proves its recorded PID is not a Codex app-server;
- a numeric PID alone is never enough to signal or retain a worker, so an unrelated reused PID receives no signal;
- a missing heartbeat closes browser ownership, not process ownership;
- each recovery is a new attempt under the original Pixel session and Codex thread;
- workspace changes become `workspace_changed` review state rather than an automatic launch.

Deterministic reproduction: `npm test`. Real local reproduction: start with `PIXEL_HARNESS_CLIENT_GRACE_MS=3000 PIXEL_HARNESS_DATA_DIR=<disposable> npm run dev`, launch one approved two-folder task, close the final browser client, wait for suspension, then reopen. Confirm a new attempt id, the same session/thread ids, one occupied slot, and finally `0 active + 0 reserved` after Stop session.
