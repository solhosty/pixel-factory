# Packet 3C handoff — employee assignment and rich task composition

Status: complete.

## Implemented

- Forward-only migration `011_rich_task_composition_v1` adds durable task briefs, task-specific instructions, and ordered rich inputs with stable IDs, provenance, MIME metadata, reference identity, and availability state.
- One canonical composer serves direct project creation, available-employee assignment from both Studio and coworker sidebar, existing assignment review, and office-wide board entry.
- The composer supports browser-selected images, pasted text, local text/image references, explicit project folders, and tagged project/employee/task context. Every item is visible and removable before saving; unavailable references remain recoverable instead of silently disappearing.
- Assignment changes close the old assignment, preserve its history, and atomically enforce one active assignment per employee. Busy employees are omitted from choices and rejected by the service.
- Launch refreshes referenced-file availability, rejects missing and unsupported inputs visibly, preserves exact task-folder scope, and snapshots rich inputs alongside 3B position, skill, and guidance context. Images are delivered as Codex `localImage` turn inputs; text files and tagged context are explicit text inputs rather than base64 prompt content.
- Plan approval, saved assignment, and explicit dispatch remain separate. Creating or editing a draft never launches Codex.
- The eight-desk Studio retains broad circulation and intentional vacancies. Its workstation set uses the approved furniture atlas only, with a front-facing station and side- and rear-facing stations; every chair is anchored to a workstation.

## Evidence

- `npm test`: 33/33 passing, including focused rich-task ordering, snapshot, atomicity, and invalidation tests.
- `npm run check:service`: passed.
- `npm run check`: 0 errors and 0 warnings.
- `npm run test:office`: 8/8 passing.
- `npm run build`: passed.
- Served acceptance persisted an image, text file, pasted text, project tag, and two folders in exact order across reload.
- Reassignment from Mina to Rae propagated through employee, board, task, and history views.
- Reduced-motion keyboard access and the composer were checked at `390 x 844`; the six-person Studio was reviewed at `1536 x 1024` with front, side, and rear facings visible.
- An isolated genuine Codex 0.154.0 launch occurred only after plan v1 approval. Its ordered turn inputs included one `localImage`, a text-file payload, and project/employee/task snapshots; Codex replied `ORCHID-731 is the non-image attachment proof. Blue.` The session completed and its capacity was released.

## Boundaries and next action

Rich inputs do not grant permissions, tools, accounts, or filesystem access beyond selected task folders. Image payloads are held in a private runtime file only for the launch, while references retain visible unavailable state instead of disappearing. This is implementation acceptance, not user visual approval.

Begin Packet 3D only on explicit request. Reuse the persisted rich-task fixture and employee-originated walkthrough established here.
