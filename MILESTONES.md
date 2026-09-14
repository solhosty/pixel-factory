# Pixel Harness — project brief and milestones

Status: implementation planning baseline, September 12, 2026. Product choices below are confirmed; architecture still requires the engineering experiments listed in the execution pack. No implementation or artwork has been produced.

For milestone-by-milestone work across separate sessions, start with [the execution guide](docs/execution/README.md), [packet ledger](docs/execution/STATUS.md), and [decision register](docs/execution/DECISIONS.md). Lettered packets divide the milestones below into bounded checkpoints with acceptance checks and durable handoffs. Do not treat this document as a prompt to implement every milestone in one session.

Confirmed distribution: browser-first, with a local execution service, shared through a GitHub repository for users to clone and run themselves. macOS is the first supported OS. Provide documented prerequisites and a single startup command after installation. The specific open-source license still needs selection; Windows and Linux support remain uncommitted until validated.

Confirmed visual direction: top-down RPG pixel art, with Stardew Valley as a reference for warmth and visual character. Create original artwork. Pixel density, proportions, palette, and interface treatment will be explored within this direction during the deferred visual-design phase.

Confirmed: this is an independent application. Research-harness is a reference for execution concepts and potential selective code reuse, not a required backend.

Confirmed: a project supports multiple local folders and repositories from the first useful release, such as separate frontend and backend repositories represented in the same company office.

Confirmed: visual design, animation, and interaction feel are core product requirements. High-quality reusable assets and components are foundational deliverables, with dedicated time in the first milestones.

Confirmed: create original assets for this project. Asset creation is deferred until the later visual-design phase; current work is planning only. Do not generate artwork during this planning phase.

Confirmed: Codex is the first supported harness. Initial onboarding, real task execution, follow-up delivery, pause/resume, and review flows must work with Codex before adding another provider.

Confirmed: clicking an employee offers both a polished conversation view (default) and the actual CLI terminal. Both belong to the same task execution; opening the terminal must not launch a competing employee process. The integration must prove how structured conversation events and the terminal share execution ownership. A raw log viewer does not satisfy the actual-terminal requirement.

Confirmed visual ambition: the app should be stunning in motion and in everyday use. User approval of its visual quality is a release requirement, including onboarding, conversations, terminal framing, decisions, and demos as well as the office itself. Limit initial content breadth before compromising this standard.

## Product

A local, open-source workspace for managing coding projects through a small pixel-art company office. Projects organize objectives, folders, tasks, and decisions without owning separate physical rooms. The user enters the office, assigns tasks to employees, answers questions, and reviews completed work in a sit-down demo.

The office should make real work easier to understand: what is moving, what needs a decision, what is waiting for usage, and what has been verified. Movement, distinct predefined characters, and office interactions should be enjoyable, with direct navigation available when the user just wants to get something done. Use Gather-like spatial navigation and Stardew-like warmth as references, with original art and identity.

“Local” means the app and its records live on the user's machine, without a required hosted control service. Connected harnesses still contact their providers. Optional Coder execution would run code remotely and must be clearly labeled.

### Coworker views and execution location

The default coworker view is a list of all coworkers across projects, including available staff. Offer All, In office, and Remote filters. Provide an office-wide task board spanning every project, showing task, project, assigned coworker or unassigned state, status, execution location, and blocking reason. Filter by project, coworker, and status, and open the same task/session records from the board. This follows research-harness as a product reference without requiring its backend.

The office is an alternate spatial view: local coworkers, including available staff, occupy the company office; remote coworkers work through Coder and appear in the list without being physically present in the office or consuming a workstation. Projects determine the work shown at desks, in conversations, and through filters rather than selecting a different room. Both views open the same employee, assignment, and session records. Execution location and connection health must be visible; a remote label alone does not prove a working Coder integration.

## Art, animation, and interaction foundation

Build a coherent kit that can produce many rooms, employees, and interactions without redrawing or reimplementing each one. Establish and approve its visual direction through concrete options and an interactive sample before expanding the office.

- **Art direction:** define pixel scale, perspective, proportions, palette, lighting, outlines, typography, and supported zoom behavior. Characters, furniture, rooms, and interface panels should look like they belong together.
- **Environment kit:** modular floors, walls, doors, corners, desks, seating, meeting furniture, and props. Define placement anchors, collision footprints, draw order, and interaction points so assets work together in actual scenes.
- **Character kit:** a roster of distinct predefined character families with consistent pivots and complete directional frames. Validate every identity while walking, sitting, working, and sleeping. Initial users customize employee names, not character parts.
- **Animation kit:** reusable idle, walk, turn, sit, work, request-attention, sleep/wake, and meeting transitions. Specify timing, interruptibility, and how animations respond to execution state. Decorative movement must not imply task progress that has not occurred.
- **Interface kit:** consistent panels, buttons, focus/hover/pressed states, dialogue, option comparisons, status indicators, and demo controls. Keep code and longer conversations comfortably readable alongside the pixel world.
- **Asset pipeline:** retain editable source files and reproducible exports, with stable asset identifiers and documented dimensions, anchors, layers, and animation clips. Track source, license, attribution, and redistribution rights for every external asset so contributors can build and share the repository.
- **Component and animation gallery:** a development scene for inspecting every building block, character combination, state, and transition without running an AI task. Use it to catch inconsistent scale, seams, clipping, and broken animation combinations.

Review motion in a running prototype, not screenshots alone. Check input response, movement around furniture, camera behavior, room transitions, and opening/closing conversations. Select a representative scene and target hardware in milestone 0; measure frame pacing and input response against an agreed budget. Validate crisp rendering at supported display scales, keyboard operation, and reduced motion. Reduce initial content breadth if needed to preserve this quality bar.

Treat composition, character personality, material detail, and motion timing as one art direction. Use restrained ambient movement and purposeful interaction feedback. Review the complete transition from walking through a room to opening an employee's conversation, switching to the terminal, comparing options, and attending a demo. Dense content needs deliberate typography, spacing, and focus behavior; the terminal retains readable monospace text within the shared visual framing. Beautiful empty scenes alone do not pass: inspect populated rooms, long transcripts, waiting states, errors, and smaller windows. Each milestone's visual review must preserve the approved direction.

## Proposed working model

- **Office:** the company-wide physical workspace. Its first curated Studio layout supports six to eight local employees with persistent workstations and intentional empty desks. It does not resize or rearrange for ordinary roster changes. Growth beyond that capacity uses another deliberately composed and visually approved layout, not procedural room appendage.
- **Project:** an organizational container with an objective, milestones, tasks, and office-visible work context. It links to local folders rather than being identical to a folder. Marking it done archives the project while retaining its history; reopening restores it without creating or removing a physical room.
- **Local folder:** a user-selected directory, with its own saved path and availability status. Users can choose existing folders or create folders at chosen locations, then attach multiple folders/repositories to one project. A project can begin with planning before folders are attached. Each executable task selects its relevant folders and a primary working directory; an employee can work across the selected repositories when its harness supports that configuration.
- **User character:** an editable avatar used to navigate and interact.
- **Employee:** a persistent member of staff with a stable identity, name, position, unique predefined character identity, skill configuration, execution location, and assignment history. Positions may repeat. Initial character setup is name-only; one active employee owns each complete character identity. Employees remain available after completing tasks and can take new assignments across projects. Their task sessions are separate records; persistent identity does not require one endless native harness session or automatically carry private task context into unrelated projects. Initially, an employee works on one active assignment at a time.
- **Position and skills:** an employee has one built-in position—Designer, Frontend Engineer, Backend Engineer, Fullstack Engineer, Security Engineer, Project Manager, or Marketing—which contributes default skills. Customers may enable built-in skills and add or author reusable employee skills. A session snapshots the resolved position defaults, employee skills, project guidance, and task instructions. Skills never grant permissions, accounts, tools, environments, or folder scope by implication.
- **Task:** an objective with acceptance criteria, conversation, decisions, changes, and evidence. It survives process failures and harness changes.
- **Session / attempt:** a session groups working context; an attempt is an individual harness execution. Retrying must not erase earlier work or pretend a new process has the old native context.
- **Multiple sessions per assignment:** one employee can own several sessions for the same task, sequentially or concurrently when supported. Sessions can have explicit purposes such as implementation, investigation, or review, and can use different eligible harnesses/accounts. They remain visible beneath the employee with separate transcripts, state, working scope, and verification. Additional sessions do not require additional staff characters. The employee retains responsibility for combining their results into the task's final demo.
- **Harness connection:** a provider/CLI plus an authenticated account profile and its capabilities. Multiple employees may share an account's usage limit; an employee is not an account.
- **Execution environment:** the local workspace, an isolated task checkout, or a configured Coder environment.
- **Decision request:** a task- or project-level proposal with options, tradeoffs, a recommendation, feedback history, and explicit approval of a particular version. Dependent work waits for approval; independent work can continue. Project decisions remain available to every employee working on affected tasks.
- **Verification / demo:** checks tied to the actual delivered revision and a reviewable demonstration. A completion message alone is not acceptance.

Suggested visible employee states: ready, working, needs an answer, needs permission, asleep due to usage, interrupted, demo ready, and accepted. Show the actual reason alongside the animation. Unknown usage must stay unknown; only display reset times supported by provider evidence.

Employees can switch harnesses and accounts while retaining their identity and task history. Usage exhaustion on one connection triggers automatic fallback among the user's configured, eligible connections. An employee is asleep due to usage only when all eligible connections have confirmed exhausted usage. Authentication failures, missing capabilities, capacity queues, unknown availability, and manual stops have distinct states. Never label these as exhausted usage. Eligibility reflects task capabilities and the user's enabled connection pool; do not silently enable another account or service.

For a multi-session employee, derive the displayed status from its sessions: show active work and pending requests together, such as “2 working · 1 needs approval.” A single blocked or exhausted session does not put an otherwise active employee to sleep. Show usage sleep only when all unfinished sessions are usage-blocked with their eligible pools exhausted. Clicking the employee opens a session selector within the conversation/terminal views, plus an assignment overview; both views target the selected session. Scope approvals to the affected work. Stop employee stops all its sessions, while a session-level stop affects only that session.

## Confirmed planning, review, and continuity behavior

### Objective intake and planning

Users can start with a project objective. An employee asks focused clarifying questions, then proposes milestones, tasks, dependencies, acceptance criteria, and assignments for approval. Feedback revises the proposal until approved. Planning does not automatically authorize implementation. Material scope changes return for approval; routine execution within the approved plan proceeds without repeating questions already answered.

Confirmed autonomy policy: everything else within the approved objective proceeds automatically, including implementation, tests, routine fixes, setup within the configured environment, and bounded collaboration. Preserve the agreed objective, UI, material technical decision, and final review gates. Carry out the selected delivery action without redundant approval when it is already authorized. Actual harness or operating-system permission requests remain visible and must be handled through supported mechanisms; the app does not bypass them. Missing information that blocks correct execution still prompts a focused clarification.

### Delivery after a demo

Each project stores its default delivery outcome: retain reviewed local changes, create a commit/branch, create a PR, or merge approved changes when supported. Tasks inherit that policy; any explicit task override is visible during planning and review. Confirm any changed destination at review. Demo acceptance, delivery success, and project completion are separate recorded states. Present repository, branch, and destination clearly before delivery; do not interpret accepting a demo as blanket authorization to publish or merge.

For multi-repository work, retain per-repository delivery results and PR links. A partial success remains partial, with a retry for unfinished delivery that does not duplicate successful PRs or commits. Non-Git folders can finish with local changes without requiring Git setup.

### Stop and resume

The intended default is to stop employee execution when the office is closed, saving enough state to resume after reopening. Preserve code, task progress, queued messages, approvals, native session identifiers where supported, and a concise continuation record. Resume checks the workspace for changes before dispatch and never duplicates an existing worker. Persisted context supports continuation; it does not guarantee restoration of a live process or identical native context.

Provide explicit Stop employee, Pause project, and Close office controls. A browser implementation must define last-client disconnect handling and a short reconnection grace period so refreshes do not become shutdowns; do not rely on browser unload events alone. On reopening, automatically resume eligible work suspended by office closure after workspace and worker-ownership checks. An explicit user stop or pause persists across reopen and requires an explicit Resume; automatic resume never overrides pending approvals, permission requests, exhausted usage, or recovery conflicts. Graceful shutdown stops owned harness and preview processes; abrupt shutdown recovers from durable records. Remote worker shutdown requires acknowledgement, and an unreachable remote worker stays visibly unconfirmed rather than being reported stopped. Stopping task processes does not necessarily stop Coder infrastructure costs.

### Attention inbox

Use an office mailbox or noticeboard as the visual entry point, with a persistent indicator and keyboard shortcut accessible from every room. Its entries cover clarification, approval, permission, demo invitations, and recoverable failures. Each shows project, employee, requested action, and what it blocks; open the relevant conversation or meeting directly. Group repeated updates to the same request and retain resolved history. The pixel presentation must keep longer questions and technical options readable.

### Selective shared project memory

Share approved decisions, project conventions, setup instructions, and verification recipes as small records with scope, source, version, and status. Keep employee working notes separate from authoritative project guidance. Select relevant records by task and repository instead of copying every transcript into every session; show which guidance was supplied. Do not share credentials or automatically spread context between unrelated projects.

Users can inspect, correct, retire, or supersede records. Corrections identify affected pending tasks, and later sessions receive the current version. Conflicting guidance triggers clarification rather than silent replacement. Begin with explicit records and simple scoped retrieval; choose more complex memory infrastructure only when observed needs justify it.

### Execution controls

Provide task, project, and office-wide pause controls from the first real execution milestone. Establish CPU/memory-based admission limits per execution machine/environment in packet 2C, reserving headroom and counting active/reserved sessions rather than saved employees. Show the effective limit and waiting-for-capacity state; keep excess assignments pending. Use conservative documented estimates and handle missing/stale resource data explicitly. Parallel execution in milestone 5 must reuse these limits along with stricter account/project ceilings, with visible account sharing and queued capacity. Bound assistance by delegation depth, number of helper tasks, and retry limits; reaching a limit requests user direction. Never imply exact token or spending totals when a harness cannot report them.

### Reproducible demonstrations

Save a demo recipe containing the selected repository revisions or workspace fingerprints, setup/start commands, fixture requirements, relevant environment variable names (not secret values), service dependencies, readiness checks, and verification steps. Track preview process ownership and ports so multiple demos do not collide. Launch against the reviewed code and link screenshots/recordings to that state. Mark stale evidence after changes, expose setup failures, and clean up owned demo processes when finished or paused.

## Milestone 0 — settle the product and execution contract

Build an independent browser application with a local execution service and its own data model and execution interfaces, starting with Codex on macOS. Validate a session integration that supports both the app-rendered conversation and actual CLI terminal for the same execution. Prototype ownership, input routing, and event capture before committing to the adapter architecture. This is an engineering validation task, not an implementation choice the user must answer. Surface any demonstrated limitation with concrete alternatives.

Define project/task completion and implement the confirmed persistent-staff model and autonomy policy. Sketch the room → employee → decision → demo flow before selecting the rendering or desktop stack.

**Exit evidence:** agreed scope and one annotated interaction flow, with unsupported or experimental integrations explicitly named.

## Milestone 0A — approve the visual kit and playable room

After the user explicitly starts the deferred visual phase, present still pictures of distinct treatments within the confirmed top-down RPG direction using the same small office scene, character, and conversation panel so they are meaningfully comparable. Iterate on feedback until a specific picture direction is approved. Then build an interactive prototype and obtain separate approval of movement and interaction feel. Keep the approved images, runnable prototype, feedback, and versioned approval record available to every implementation session. Build a playable room from the first reusable assets: walk in, approach an employee, open a conversation, sit for a meeting, and return to work. Include working, waiting-for-approval, and asleep states using labeled simulated task events.

Deliver the initial environment, character, animation, and interface kits with editable sources and the development gallery. Choose the rendering approach based on this prototype's requirements and measured behavior. Do not scale up room content before proving the components compose cleanly.

**Exit evidence:** user approval of the interactive visual direction; a populated six-to-eight-workstation Studio assembled from the reusable kit; multiple distinct character identities sharing the animation contract; working state transitions with no snapping or clipping; and measured performance on the agreed target. Capture a short walkthrough for review, alongside the runnable prototype.

## Milestone 1 — a usable office with persisted projects

Create projects; walk or click through the company office; inspect each project's tasks and milestones from desks, conversations, filters, and direct navigation. Provide a searchable project list, keyboard access to core actions, and reduced-motion behavior. Archive and reopen completed projects without deleting code or history or changing the physical office.

Maintain a persistent staff roster. Assign an existing employee or add a new one, retain appearance and assignment history after task completion, and return unassigned employees to an available state. Archiving a project preserves its task records and releases its staff for new assignments. Verify that one employee can finish a task and start another without losing identity or leaking the previous project's task context.

Provide a local folder picker and saved-folder list alongside the project list. Show the full selected path and let the user attach a folder to a project or create a project around it. Selecting a folder does not move or copy its contents. Handle missing, moved, and inaccessible folders with a relink flow. Unlinking a folder or archiving a project must not delete files. Show the effective working folder before dispatch, including when execution uses a derived task worktree.

Let users name each attached folder by role, such as frontend, backend, or shared library. A task selects one or more attached folders rather than implicitly operating on every folder in the project. Preserve repository identities, branches, changes, and verification separately while presenting their combined progress through the same company office.

Use labeled simulated employees for this milestone. Build on the approved kit from milestone 0A. New states and interactions enter the shared gallery before being reused across rooms. Keep visual and motion review in each subsequent milestone's acceptance criteria.

**Exit evidence:** create two projects, attach separate frontend and backend folders to one project, select both for a task, switch project context from the same office, archive/reopen a project, and reload with state intact. Relink a moved folder without losing task history. Show this flow in the running UI.

Include the mailbox/noticeboard and pending-request interactions in the persisted office shell, using simulated entries until real execution is available.

## Milestone 2 — onboarding and one real employee

Guide a fresh user through detecting/installing Codex, native authentication, checking readiness, selecting a workspace, and running an explicit small verification task. Distinguish missing CLI, missing authentication, unavailable model, permission failure, and exhausted usage.

Start one real task from a room. Clicking its employee opens the supported session view with live output, tool activity, working location, and errors. Support cancellation and additional context with visible queued/delivered status. Preserve task records and code on interruption; do not display an interrupted process as still working after restart.

Validate the harness's support for the selected folder set before dispatch. Make unsupported multi-folder execution actionable instead of silently omitting a repository. Demonstrate a task changing two selected repositories, retaining per-repository diffs and running their relevant checks. Folder selection describes intended execution scope; any enforced filesystem boundary depends on the harness and environment.

**Exit evidence:** a fresh setup runs an actual code edit, receives a follow-up, and retains its transcript and changes across an app restart. Exercise failure states as well as the successful path.

Implement objective clarification and plan approval before dispatch, the attention inbox's real events, explicit project guidance records, and pause/resume controls here. Verify that unapproved plans do not dispatch, closing the office stops owned workers, and reopening resumes preserved work without duplicates. Exercise both graceful shutdown and interrupted recovery.

### Packet 2C — coworker list, office task board, and machine capacity

Make the all-coworker list the default view, add the office-wide task board, distinguish remote Coder coworkers from coworkers physically shown in the office, and establish CPU/memory-based capacity admission per execution environment. Limit simultaneous work, not persistent staff records. Preserve the sequential execution ceiling for the first release; parallel execution remains in milestone 5 and live Coder integration in milestone 6.

**Exit evidence:** list/office navigation targets the same employee sessions; location filters and disconnected remote fixtures remain legible; capacity fixtures prove resource limits and atomic reservations, and a real local execution passes admission. See [packet 2C](docs/execution/packets/2C.md).

### Packet 2D — shutdown, ownership, and automatic recovery

The former packet 2C is now 2D, following the coworker/capacity changes. Its shutdown and recovery requirements remain intact; resume must pass capacity admission after ownership reconciliation. See [packet 2D](docs/execution/packets/2D.md).

## Milestone 3 — decisions, verification, and the demo meeting

Let an employee raise a structured design or technical question and resume with the user's answer. Show project milestones and task acceptance criteria. Run configured checks and retain their command, result, and code revision or workspace fingerprint.

For UI tasks, the employee presents concrete visual options before committing to a design direction. The user can compare previews, select an option, request changes, and review revised options until explicitly approving a version. Approval authorizes implementation of that direction; the implemented UI still returns for a demo and feedback. Reopen approval when feedback materially changes the approved direction. Do not require approval again for routine implementation details already covered by it.

For longer projects, use the same proposal → feedback → revision → approval loop for material technical decisions. Present alternatives with consequences, assumptions, and a recommendation; a spike or prototype can supply evidence where needed. Save approved decisions at project scope, link affected tasks, and carry them into new employee sessions. A changed decision must identify affected work and supersede the previous version explicitly.

Both loops use the meeting interaction. Employees arrive with reviewable options, not just an open-ended question. Waiting for approval is a distinct state that survives reload and session handoff. Silence or elapsed time is never approval.

Before final verification and delivery, establish the employee and office system. Offer seven repeatable built-in positions with curated default skills and customer-selected or customer-authored employee skills. Snapshot the resolved skill set for every session without expanding its permissions. Replace editable appearance recipes with a roster of complete predefined character identities, each assignable to only one active employee; initial setup customizes only the employee name.

Use one company-wide office rather than project-owned rooms. The first Studio is a deliberately composed six-to-eight-workstation layout. Local employees, including available staff, occupy desks; remote employees remain in operational views and consume no physical capacity. Remove the adjoining Quiet workroom from the product flow. Do not procedurally append generic rooms, resize the Studio for ordinary roster changes, or trade composition quality for hypothetical scale. A larger office is a separately designed, versioned, and visually approved layout.

Make assigning work an employee-centered action. Clicking an employee in the Office or coworker sidebar opens the same employee record and can start one shared task composer with that employee preselected. The composer accepts text, images, files, selected project folders, tagged project/employee/task context, and task-specific instructions while keeping planning, saved assignment, and execution authorization distinct. Persist every input before dispatch and pass it explicitly into the resulting session; entering through an employee must not create a separate task model or bypass the one-active-assignment rule. Do not derive the default roster or desk count from the number of available positions: positions are choices, and the starter Office must retain comfortable spacing, readable workstations, broad circulation, intentional empty desks, and a coherent mix of front-, side-, and rear-facing workstations.

An employee invites the user to a review meeting when work is ready. The meeting opens a focused presentation of the goal, changes, demonstration, checks, and known gaps. Start with screenshots and/or a runnable preview for UI work; use relevant command output or an API demonstration for other work. Add recording later if it improves the review.

The user accepts the work or requests changes from the meeting. New changes make older verification/demo evidence visibly stale. Failed checks or missing demonstrations cannot silently become verified completion.

**Exit evidence:** compare UI options, request a revision, approve the revised direction, and review the implemented result. Separately revise and approve a project-level technical proposal and show another task honoring it. Reload while approval is pending and confirm dependent work remains paused. Finish through fresh verification and an accepted demo, then update milestone progress.

Also prove the demo recipe launches the reviewed revisions, a corrected project decision reaches the affected employee, and the selected delivery outcome succeeds. Cover local-only completion and PR creation, including a recoverable partial delivery across repositories. Delivery requires repository/authentication setup and isolated branch handling appropriate to the selected outcome; parallel scheduling can remain deferred.

**First useful release:** milestones 0–3, including the visual foundation in 0A. One supported harness, one account, and sequential real work are enough to prove the central experience. It must already feel like an office, including the review meeting, with the approved art and animation quality present throughout.

## Milestone 4 — multiple harnesses, accounts, and usage states

Add the second harness through an explicit adapter contract. Onboard separately named account profiles, keep authentication in provider-supported credential locations, and prove account isolation before enabling concurrent use. Do not assume a separate Git checkout isolates credentials.

Map confirmed quota exhaustion to account availability and automatically switch to another eligible connection while preserving employee identity and working state. Only put the employee asleep due to usage when the entire eligible pool is confirmed exhausted. Record which account and harness ran each attempt. Resume eligible usage-blocked work when availability returns while the office is open; preserve manual stops and approval gates, and prevent duplicate dispatch.

A cross-harness handoff carries the task objective, decisions, relevant conversation, code state, and verification. It must not claim to transfer native private reasoning or an identical native session.

**Exit evidence:** two supported harnesses and two isolated account profiles; a controlled quota failure triggers automatic fallback without losing edits, messages, or employee identity. Exhaust the full eligible pool to demonstrate sleep, then restore availability to demonstrate resumption. Verify that an authentication failure is not shown as usage sleep and a manual stop survives reopening.

## Milestone 5 — parallel employees and collaboration

Run independent tasks in isolated workspaces with explicit capacity limits. Keep each task attached to its recorded workspace through retries. Show dependencies and integration status through the company office and project views.

Enable parallel sessions within an employee's assignment using the same scheduler as parallel employees. Count active sessions/processes against capacity, not just visible characters. Give concurrent writers isolated checkouts or explicit exclusive ownership; sessions must not silently write to the same checkout. A review session uses an identified revision or snapshot. Preserve per-session ownership and continuation records through shutdown and automatic resume, then integrate and verify the combined result before the employee's demo. Sequential multiple-session history belongs in the initial data model; concurrent execution arrives in this milestone.

For multi-repository tasks, retain a separate checkout and base revision for each selected repository. Coordinate ownership across overlapping task folder sets. Report integration and verification per repository and for the combined result; a partial integration must remain visible.

Start collaboration with explicit help requests: one employee asks another for a review or bounded subtask, receives a recorded result, and retains ownership of the main task. Define write ownership and integration order. Prevent two employees from silently editing the same checkout and prevent unbounded delegation loops.

**Exit evidence:** two employees complete independent changes concurrently; one requests help; integrate the changes and verify their combined behavior. Demonstrate a conflict or dependency without losing work.

Exercise project/office pause while multiple employees run, capacity queueing, shared-account visibility, and a helper/retry limit that stops further delegation and asks for direction.

Also demonstrate one employee with two concurrent sessions, session switching in both views, one session awaiting approval while another progresses, and stop/resume without duplicate workers. Verify isolated writes and an integrated final result.

## Milestone 6 — optional Coder execution

Coder is desired, but is not currently a first-useful-release requirement. Keep execution interfaces compatible with a later remote adapter; finish the local experience first. Moving Coder earlier is a scope decision, not an implied commitment.

Add Coder onboarding, repository access checks, environment setup, account binding, capacity checks, and remote task workspaces. Adding a ready Coder environment makes a new pool of remote coworker execution slots available, bounded by that environment’s usable CPU and memory. Users can add or assign remote coworkers to that environment without adding physical office occupants. Coworker identities persist independently of slot availability; adding an environment does not automatically launch tasks. Apply shared-host ceilings when environments share underlying resources rather than multiplying the same capacity. Connect this pool to the 2C coworker list and office-wide task board: show environment, assigned coworkers, active/available slots, pending capacity, and connection health. Unready or disconnected environments supply no new dispatch capacity; retain their coworkers and tasks with truthful unavailable or unconfirmed execution state. Preserve remote workspace identity, transcript, and review evidence through disconnects and retries.

**Exit evidence:** parallel remote tasks produce reviewable changes and demos; interrupt and reconnect without duplicate execution or discarded work. Local-only users need no Coder setup.

## Milestone 7 — office manager and broader release polish

An optional office manager uses recorded task outcomes to suggest concrete workflow improvements: repeated setup fixes, missing checks, useful skills, or better task boundaries. Each suggestion explains its evidence and offers a reviewable change. Suggestions do not silently install skills or change permissions.

Expand the established asset kits, customization, room interactions, and recorded demos based on use. Core visual quality is already required by earlier milestones. Publish contributor setup, architecture notes, a license, asset attribution, and an honest support matrix. Basic installation instructions and secret exclusions belong in the repository from its first shared version; this milestone broadens release quality.

**Exit evidence:** another person installs the app from its documentation, completes the first-project flow, and can inspect or decline a manager suggestion.

## Research-harness inspiration and reuse boundary

Reviewed locally: `README.md`, `DOMAIN.md`, `harness_rotation/sessions.py`, and adapter entry points in `harness_rotation/adapters.py` from the sibling research-harness project. This is a source review, not a fresh execution audit.

Useful patterns include durable tasks with multiple attempts, explicit harness adapters, preserved workspace identity, follow-up delivery records, normalized execution events, and review gates. Its session service already constructs handoff and workspace-integrity records.

Its README explicitly distinguishes native sessions from the app's conversation view, documents interrupted runs on shutdown, and lists automatic quota wake-ups and parallel execution as limitations. Verify current implementation and tests before reusing those areas. Any selected code reuse must fit this application's independent interfaces and have its license checked.

## Decisions to resolve one at a time

1. Original asset production workflow, editable source formats, and animation tooling, to resolve when the visual-design phase begins.
2. Specific open-source license and verified runtime prerequisites for the clone-and-run release.

No dates yet: engineering validation of the native session UI contract affects the work. The execution pack provides bounded task checklists now; packet 00 supplies verified code paths, commands, and interface contracts before downstream execution. Refine those details without silently expanding scope or relaxing acceptance criteria.
