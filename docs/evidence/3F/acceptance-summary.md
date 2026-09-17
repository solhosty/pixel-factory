# Packet 3F acceptance summary

Date: September 16, 2026

## Implemented contract

- Migration `017_conversational_task_threads_v1` persists task-owned objective and lifecycle entries. Decision revisions, approvals, plan changes, and inbox requests remain durable records projected into one task thread.
- A desk begins a task from a plain-language objective with explicitly selected folders and a primary folder. Context is added only from the task thread; it is ordered, removable, persisted, and invalidates an approved plan so the next launch needs fresh approval.
- In-thread decision requests expose recommendation, options, trade-offs, approval, and revision. Approved decisions plainly report that they no longer block the task. Board rows provide owner, state, last meaningful update, and blocking reason and route back to the same task.
- Task-thread polling refreshes board, inbox, and the open thread, so a real coworker request appears without a reload. Desk attention, inbox, board, and an existing assignment all converge on the exact task thread.
- Team agreements are explicit project guidance with `team-agreement:<task-id>` provenance. An ordinary message is not converted to guidance.

## Verification

- `npm run check:service` passed.
- `npm run check` passed with zero errors (seven pre-existing unused-selector warnings in the dense route stylesheet).
- `npm test` passed: 43 tests. The added coverage proves decision revision/approval lifecycle and board recency, plus a restarted database retaining ordered image/text context and its exact pending request.
- `npm run test:office`, `npm run build`, and `git diff --check` passed in the implementation pass.
- An isolated served browser created a desk task with explicit scope, opened scoped **Add context**, saved an ordered file reference and pasted context, reloaded, and confirmed both inputs in the same task thread. It also verified decision revision/approval, plan approval and explicit launch, reduced-motion/keyboard board routing, and that a board row returns to the same thread.
- A real local Codex launch emitted the requested clarification. Its desk attention and inbox route opened the exact message; replying `Use Ready.` resolved the persisted request and delivered the response to the live session. The isolated execution was then manually stopped and its lease released.

User visual approval remains separate from implementation acceptance.
