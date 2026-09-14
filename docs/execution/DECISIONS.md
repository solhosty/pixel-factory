# Decision register

Confirmed product choices are also described in `../../MILESTONES.md`. Do not ask the user to approve them again.

- **D01 — Product:** independent app; no dependency on research-harness backend. Selective reuse requires fresh inspection and license compatibility.
- **D02 — Distribution:** GitHub clone-and-run, browser frontend and local service, macOS first. Other operating systems are not promised.
- **D03 — Visuals:** original top-down RPG pixel artwork; Stardew Valley reference; entire app must meet user-approved visual and motion quality. Asset creation is explicitly deferred until the user starts that phase.
- **D04 — Organization:** projects contain multiple folders/repos, milestones, and tasks. One project is one room; completion archives the room without deleting code/history.
- **D05 — Staff:** employees persist across assignments; initially one active assignment per employee, multiple sessions per task, sequential first and concurrent later. Employees can change harness/account.
- **D06 — Interaction:** conversation default plus actual CLI terminal for the selected session. No second execution for the second view; raw logs alone do not satisfy this.
- **D07 — Autonomy:** objective clarification and plan approval, UI option approval, material technical decisions, and final review are gates. Other work within the approved objective proceeds automatically, including previously authorized delivery.
- **D08 — Continuity:** closure suspends owned work; reopening resumes eligible work automatically. Explicit stops persist and require resume. Pending approvals and recovery conflicts remain blocked.
- **D09 — Availability:** automatically use eligible configured connections; usage sleep only when all remaining work is quota-blocked across eligible pools. Other failures remain distinct.
- **D10 — Review:** game-style inbox; selective correctable scoped project memory; reproducible demo; project delivery defaults and per-repository outcomes.
- **D11 — Release scope:** Codex first, one account and sequential work through milestone 3. Multiple connections in 4, concurrency in 5, Coder optional in 6, manager in 7.

- **D12 — Coworker navigation and location (September 13, 2026):** all-coworker list is the default, with All/In office/Remote filters. An office-wide task board spans all projects and shows assignments, status, location, and blockers using the same persisted records. Local coworkers appear in office rooms; remote coworkers work through Coder and remain accessible from the list. Both views share employee/session identity.
- **D13 — Machine capacity (September 13, 2026):** limit simultaneous execution by the target system's CPU and memory, counting sessions/processes rather than persistent staff. Packet 2C establishes resource estimates, headroom, admission, and visible pending capacity; 5A adds parallel scheduling using that policy. The user confirmed working Coder integration remains in 6. Each added ready Coder environment unlocks an additional resource-bounded pool of remote worker slots, subject to shared-host limits. Adding an environment does not launch work or create physical office occupants. Recovery moves from 2C to 2D. Numeric resource budgets require implementation evidence.

## Engineering decisions to establish

- **E01 — Packet 00:** supported Codex version/protocol and proof of the two views, input ownership, multi-folder capability, stop/resume. Record sources, versions, probe commands, outcomes, and unsupported behavior. Do not fabricate a solution if the CLI cannot provide the required contract.
- **E02 — Packet 00:** frontend/local-service/persistence stack and boundaries; supported browser; exact install/build/test/run commands; local service authentication and origin checks. Recommend a coherent option with evidence and obtain approval for material architecture decisions before broad implementation.
- **E03 — Packet 0A:** original asset workflow and source formats, visual treatment, motion/performance targets, renderer, and user approval of the playable result. Obtain explicit permission to begin asset creation first.
- **E04 — Packet 3C before public release:** specific license, contributor setup, verified runtime prerequisites. “Open source” does not select a license automatically.
- **E05 — Packet 4A:** second provider selection and verified account isolation/eligibility behavior.

For each resolved E entry, add the selected option, rationale, source/probe evidence, affected contracts, approval if needed, date, and superseded decision if any. Engineering status is initially unresolved for all E entries.

## Packet 00 findings — September 12, 2026

- **E01 — verified native shared-terminal contract:** Codex CLI `0.154.0` app-server's Unix-domain WebSocket listener can be shared by a structured client and the actual TUI invoked as `codex --remote unix://<socket> resume <thread-id> --no-alt-screen`. The final probe recorded one provider thread, native “Resuming session” output, PTY resize, a Tab-queued native follow-up becoming a distinct provider turn, structured interruption of that active turn, and `thread/resume` returning the same thread ID. No active-writer error occurred. This honors the user's September 12 requirement for a genuine attached native terminal without substituting a log or unrelated PTY. The product contract is one service-owned app-server socket and one service-owned native-TUI PTY per terminal lease; browser raw input goes only to that PTY, while browser conversation uses structured durable messages. Evidence: `../evidence/00/remote-native-resume-probe-summary.json`, trace, and `../architecture/CONTRACTS.md`.

  Constraint: the remote app-server and native CLI must use the same installed version. A first probe entered an update modal and accidentally upgraded the local CLI from 0.153.4 to 0.154.0; final evidence was regenerated/re-run on 0.154.0. The app-server protocol is experimental and remains version-pinned.
- **E02 — approved September 12, 2026:** SvelteKit/Vite browser UI; separate TypeScript Node 26 local service; built-in `node:sqlite`; `@xterm/xterm` as a renderer of the service-owned genuine Codex TUI PTY. Node 26 SQLite was locally verified with an in-memory query. The service owns the private Unix socket, fixed native-resume argv, persistence, folder mediation, adapter calls, worker/terminal leases, and localhost auth/origin checks. This establishes no package scaffold or canonical app commands yet. User approved this topology after review of the E01 evidence. See `../architecture/CONTRACTS.md`.
