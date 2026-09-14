# Packet 00 — execution contracts handoff

Date: September 12, 2026  
Status: complete  
Session/model: Codex desktop, GPT-5

## Checkout and running environment

- Repository path, branch, revision (or no Git initialized): `/Users/hunter/Documents/hunter/pixel-harness`; Git is not initialized.
- Dirty/pre-existing paths and this session's changes: checkout contained only planning documents. This session added `docs/architecture/`, `docs/evidence/00/`, and this handoff, and updated `docs/execution/DECISIONS.md` and `STATUS.md`. No application, dependencies, artwork, or later-packet code was added.
- Runtime/tool versions and prerequisite setup: macOS 26.5.2; Node 26.5.0; npm 11.17.0; Bun 1.3.14; SQLite 3.51.0; Codex CLI 0.154.0; `codex login status` reported ChatGPT authentication. `node:sqlite` passed an in-memory `select 1` query. The first native-TUI probe encountered its update dialog and a test keystroke selected its update option, upgrading the local CLI from 0.153.4 to 0.154.0. This unintended side effect is recorded; the final evidence was restarted against a fresh 0.154.0 listener.
- Running services, ports, ownership, and stop/restart commands: one temporary project-local app-server listener may still exist at `pixel-harness-e01.sock`; it is probe-owned and must be stopped/removed before implementation. It is not an application service.

## Result

`docs/architecture/CONTRACTS.md` records the downstream durable-model, event, message, approval, stop, migration, fixture, credential, workspace, localhost authentication, origin, and terminal-routing contracts.

The native two-view requirement is now proven: a shared long-lived Unix-socket app-server endpoint served both the structured protocol client and the actual CLI TUI started as `codex --remote unix://<socket> resume <thread-id> --no-alt-screen`. The TUI emitted “Resuming session,” accepted a resize and a Tab-queued native follow-up; the structured client observed that follow-up as a distinct provider turn, interrupted it, and resumed the same thread. This is the only allowed first-release topology. A raw log, unrelated PTY, or command-process attach remains invalid.

E02 is approved: SvelteKit/Vite UI (not Vue), separate Node 26 TypeScript local service, built-in `node:sqlite`, and `@xterm/xterm` only as a renderer for the service-owned genuine TUI PTY. No package scaffold or canonical application commands exist.

## Acceptance evidence

| Criterion | Status | Evidence |
| --- | --- | --- |
| Installed Codex version/protocol inventory | pass | `codex --version` returned 0.154.0; regenerated JSON schema under `/private/tmp/pixel-harness-schema-0154.cn0x1x` exposed `thread/start`, `thread/resume`, `turn/start`, `turn/interrupt`, workspace roots, output events, and PTY methods. |
| Native conversation plus actual terminal on one execution | pass | `remote-native-resume-probe-summary.json` shows the genuine remote-resume TUI and structured client sharing one provider thread, with `outputContainsResuming: true` and `outputContainsActiveWriter: false`. |
| PTY output/input/resize/cancellation | partial pass | PTY emitted `READY`, accepted `packet-00-input`, accepted a 24x80 to 40x100 resize, then was terminated. It is not the required native terminal. |
| Two selected folders changed by a live task | pass | App-server thread `01a096fa-0931-7f22-9605-88084702dd3a` created `packet-00-a.txt` with `A` and `packet-00-b.txt` with `B`. |
| Follow-up and sequential session | pass at provider boundary | Native TUI Tab queue acknowledgement created a distinct second provider turn, observed by the structured client; the earlier probe separately completed sequential turns on one thread. Pixel Harness session/attempt records do not yet exist. |
| Interrupted recovery and permissions/auth behavior | partial pass | Structured interruption completed with `interrupted`, then `thread/resume` returned the same provider thread. Pixel service restart/no-duplicate lease and permission UI are later implementation acceptance tests. |
| Local persistence runtime candidate | pass | `node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; const db = new DatabaseSync(":memory:"); console.log(db.prepare("select 1 as ok").get().ok)'` printed `1`. |

The final successful result is `docs/evidence/00/app-server-probe-summary.json`; `app-server-probe.jsonl` is the redacted trace and retains earlier framing/runtime failures. The final success does not upgrade any native-terminal or recovery row.

## Decisions and approvals

Decision register IDs changed: E01 is verified; E02 is approved in `DECISIONS.md`.

User approvals: September 12, 2026 — retain the requirement for an actual attached native Codex CLI terminal and keep packet 00 blocked until it is proven; that requirement is now met without weakening it. The user also approved E02: SvelteKit (not Vue), Vite, a Node 26 local service, `node:sqlite`, and `@xterm/xterm` rendering the genuine native TUI.

Contract/API/data migration changes and downstream impact: new planning-only contracts in `../../architecture/CONTRACTS.md`; packets 1A through 3C must use its identity, lease, event, queue, approval, stop, and security rules once E01/E02 are approved.

## Remaining work

- [x] Demonstrate one native execution attached to both structured conversation and an actual interactive CLI terminal.
- [x] Obtain a user decision on E02 before scaffolding an app or asserting install/build/test/run commands.

Known failures and attempted fixes: restricted app-server startup could not initialize its SQLite state; `Content-Length` framing was rejected because this app-server expects newline-delimited JSON; PTY output is base64 encoded; and the first attempted history mode was invalid (`save-all`; accepted values include `paginated`). The native listener uses a Unix-domain WebSocket upgrade, not newline-delimited stdio. On an active TUI turn, Enter only leaves text in the composer; Tab queues the follow-up. The first native probe's update dialog selected an unintended local CLI update; restart/revalidation on 0.154.0 passed. Do not treat the earlier failures as a provider protocol limitation.

Limitations that must remain visible: app-server APIs are experimental and generated schemas are CLI-version-specific. The proven relation depends on one shared service-owned endpoint and fixed native-resume invocation; it is not command-process attachment. Terminal lease/persistence/restart behavior remains unimplemented.

## Next session

Next packet or continuation: packet 00 is complete. A separate task may begin only with the user's next explicit packet request. Do not start 0A or 1A in this task.

Read these specific files: `README.md`, `docs/execution/README.md`, `docs/execution/STATUS.md`, `docs/execution/DECISIONS.md`, `docs/execution/packets/00.md`, `docs/architecture/CONTRACTS.md`, `docs/architecture/VALIDATION.md`, and this handoff.

First command/action: read this handoff, `STATUS.md`, `DECISIONS.md`, `CONTRACTS.md`, and `VALIDATION.md`; await the user's explicit next-packet direction before creating a scaffold.

Smallest verification to establish the starting state: `codex --version`, `codex login status`, inspect `remote-native-resume-probe-summary.json`, and regenerate app-server bindings if the CLI version differs.

Escalation/question if blocked: no approval is pending. Ask only if a later packet requires a new material decision.
