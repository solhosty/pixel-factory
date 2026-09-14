# 2B — planning, guidance, and messages

Completed September 13, 2026.

## Delivered

- Plans are versioned per project. A material proposal supersedes the target task's pending or approved plan; launch requires the exact current approved `plan_id`.
- The local browser exposes project and task guidance with content, provenance, scope, correction/supersession, retirement, and the active records visible under every task that would receive them.
- Launch appends only project or task-applicable guidance and provenance to the Codex prompt. Unrelated projects are excluded.
- Browser follow-ups use the service-owned Codex app-server connection, persist `queued`/`delivering`/`delivered`/`failed`, and never write raw bytes to the terminal.
- A Codex agent can emit `[PIXEL_REQUEST] kind | summary | blocking reason` in its completed agent message. The adapter creates a durable, session-linked `source=codex` inbox request from that actual provider event; the user response is sent back as a durable follow-up when the session is attached.

## Acceptance evidence

Served on isolated loopback ports with the real Codex CLI:

1. The browser created a two-folder `research-harness` dummy task, proposed its plan, visibly rejected launch before approval, approved version 1, and launched it afterward.
2. The real session created `browser-2b-proof.txt` containing exactly `browser-verified`; the browser follow-up became a persisted delivered message.
3. The browser added project and task guidance with provenance. The next launched session received both applicable records, while the other task displayed only project guidance.
4. A live Codex session, instructed not to modify files while awaiting a choice, emitted a completed agent response containing `[PIXEL_REQUEST] clarification | Choose alpha or beta | …`. The served inbox displayed it as a pending `codex` request tied to Wilson and the dummy task.
5. Reload retained plans, guidance, and resolved/pending inbox state. The browser token remains in the launch fragment so a reload retains local-service authentication for that browser session.

`npm test` passed 12 tests; `npm run check` and `npm run build` passed.

## Scope boundary

This packet does not add autonomous task expansion, vector memory, recovery policy, or the decision-meeting UI reserved for 3A. The compact marker convention is a bounded adapter protocol, not free-form semantic inference.

## Next action

2C is the next packet only when explicitly requested.
