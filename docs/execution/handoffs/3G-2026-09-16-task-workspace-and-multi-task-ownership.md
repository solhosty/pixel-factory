# Packet 3G — task workspace and multi-task ownership

## Delivered

Employees now expose plural `active_assignments`; the newest assignment remains a compatibility alias. A task owns its workspace, conversation, folder scope, input context, and eventual session lease. Capacity remains one local writer: another task records a durable queue state instead of being rejected because its employee is already assigned.

The Task board is a four-lane operational index. Each card routes to its task workspace, which retains the styled conversation and exposes the existing Session terminal view without launching another execution. Tasks can be cancelled and reopened while preserving assignment history.

## Evidence

See [acceptance summary](../../evidence/3G/acceptance-summary.md). The served isolated fixture used one employee and two task records, then verified the visible lanes, exact selected workspace, Inbox decision routing, and persisted reduced-motion control. Automated verification passed 44 tests, both type checks, production build, and diff check.

## Next action

Begin 4A only on explicit request. Preserve one task-owned conversation/session scope and the single local writer until 5A; no second provider, account, or concurrent workspace is authorized by 3G.
