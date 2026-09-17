# Packet 3G acceptance summary

September 16, 2026.

- Service fixture: one employee owns two active tasks with different folder scopes and independent thread records. Starting the first reserves the sole local slot; starting the second persists `waiting for capacity` without creating another writer. Cancellation, reopening, and restored assignment history are covered in `service/test/conversations.test.ts`.
- Task board: a served isolated profile at `127.0.0.1:5197` visibly rendered To do, In progress, Done, and Cancelled lanes. Both fixture cards showed owner, blocking reason, recency, and session state; opening the second card showed only its own task workspace, context, plan gate, and Session control.
- Inbox and accessibility: a pending technical decision in the cross-task Inbox opened the exact second-task workspace, where its linked decision, recommendation, options, and approval gate were visible. The persisted Reduce motion control was enabled in the served app. The narrow-layout regression locks the single-column panel/thread rules and horizontally scrollable board lanes at their mobile breakpoints. Existing 3F routing tests continue to cover clarification-to-task routing.
- Verification: 45 service tests, `npm run check:service`, `npm run check`, `npm run build`, and `git diff --check` passed. Existing 3F routing tests continue to cover exact inbox/decision-to-task routing and 2D/3C/3A/3E contracts.

User visual approval remains separate from implementation acceptance.
