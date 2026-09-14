# Packet 00 validation plan

Status: **E01 passed; E02 approved September 12, 2026.**

## Recorded environment

- macOS 26.5.2 (25F84), Node 26.5.0, npm 11.17.0, Bun 1.3.14, SQLite 3.51.0.
- Codex CLI `0.154.0`; `codex login status` reported ChatGPT authentication without revealing credentials.
- Checkout: `/Users/hunter/Documents/hunter/pixel-harness`; Git is not initialized and contained documentation only at start.

## Reproducible protocol inventory

Run from the repository root:

```sh
codex --version
codex app-server --help
codex app-server generate-json-schema --experimental --out /private/tmp/pixel-harness-schema
codex app-server generate-ts --experimental --out /private/tmp/pixel-harness-ts
rg -n -i 'thread/start|turn/start|turn/interrupt|command/exec|terminalInteraction|runtimeWorkspaceRoots' /private/tmp/pixel-harness-ts
```

Expected evidence: CLI version and generated protocol types. On the recorded CLI, `ClientRequest.ts` includes `thread/start`, `turn/start`, `turn/interrupt`, and `command/exec` methods; `ServerNotification.ts` includes structured item/turn events and terminal-interaction notifications. Generated code is version-specific and must be regenerated on every Codex upgrade.

## Live probe and outcome

The dependency-free probe is [app-server-probe.mjs](../evidence/00/app-server-probe.mjs). It creates only two disposable folders under `/private/tmp`, attempts a PTY input/resize/termination cycle, then attempts one two-folder app-server thread plus a sequential follow-up.

```sh
node docs/evidence/00/app-server-probe.mjs docs/evidence/00 /private/tmp/pixel-harness-probe-a /private/tmp/pixel-harness-probe-b
```

The final normal-local-runtime run passed: one app-server thread (`01a096fa-0931-7f22-9605-88084702dd3a`) completed two sequential turns, wrote `A` and `B` to the two selected disposable folders, and returned `FOLLOW-UP RECEIVED` from the second turn. The same run proved the independent app-server PTY accepts input and a resize request; it was then terminated. The final redacted result is [app-server-probe-summary.json](../evidence/00/app-server-probe-summary.json), and its protocol trace (including earlier framing/runtime failures) is [app-server-probe.jsonl](../evidence/00/app-server-probe.jsonl).

The probe does **not** prove that this PTY is an actual attached interactive Codex CLI terminal. That specific limitation is resolved by the separate shared-endpoint native-TUI probe below.

`codex app-server daemon version` also failed because the app-server control socket did not exist. No daemon was started or stopped.

## Shared-endpoint native-TUI probe

The dependency-free [remote-native-resume-probe.mjs](../evidence/00/remote-native-resume-probe.mjs) speaks the app-server's Unix-domain WebSocket endpoint directly. It uses a disposable workspace, starts one app-server turn, spawns the real native CLI with its fixed remote-resume command, resizes the real TUI PTY, queues a native follow-up with Tab, observes its distinct provider turn, interrupts that turn through the structured client, and resumes the same thread.

```sh
codex app-server --listen unix:///absolute/path/to/pixel-harness-e01.sock
node docs/evidence/00/remote-native-resume-probe.mjs docs/evidence/00 pixel-harness-e01.sock /private/tmp/pixel-harness-remote-native-resume
```

Final result: [remote-native-resume-probe-summary.json](../evidence/00/remote-native-resume-probe-summary.json) records one thread `01a09714-3891-79c2-b335-be3feaaf0a56`; both the initial and follow-up turns have separate IDs; the follow-up command was active when `turn/interrupt` completed with `interrupted`; and `thread/resume` returned the same thread ID. Its redacted protocol/PTY trace is [remote-native-resume-probe.jsonl](../evidence/00/remote-native-resume-probe.jsonl). The trace shows the native UI's “Resuming session” text and “Queued follow-up inputs” acknowledgement, with no “active writer” error.

The first run reached a CLI update dialog; a keystroke selected its update option and upgraded the local CLI from 0.153.4 to 0.154.0. This is recorded as an unintended probe side effect. The final result above was rerun against a fresh 0.154.0 app-server and regenerated 0.154.0 schema output at `/private/tmp/pixel-harness-schema-0154.cn0x1x`.

## Acceptance matrix

Use a normal local runtime that can initialize the user's Codex state; do not copy credentials into the project. Preserve a redacted JSONL trace and exact CLI version.

| Criterion | Pass evidence |
| --- | --- |
| Native shared execution | **passed:** the real `codex --remote … resume` TUI joined the same app-server thread as the structured client without an active-writer error |
| Input ownership | **passed at provider boundary:** only the TUI PTY accepted raw bytes; its active-turn Tab queue acknowledgement led to a second observed provider turn. Pixel's durable lease/UI record is a later implementation obligation. |
| Terminal behavior | **passed:** native TUI output, resize, queued follow-up, structured interruption of the active follow-up turn, and same-thread `thread/resume` |
| Two folders | **passed:** files changed in both selected folders, content verified, and both roots recorded on one app-server thread |
| Sequential session | **passed:** second turn on the same thread and preserved first-turn history; separate Pixel Harness session/attempt persistence remains unimplemented |
| Interrupted recovery | **partial pass:** provider interruption and same-thread `thread/resume` passed. Pixel service restart/no-duplicate lease cannot run before that service exists and is an E02/1A implementation acceptance test. |
| Permissions/auth | missing authentication and denied permission are visibly distinct from quota/worker failure; no secret appears in evidence |

The app-server PTY test is auxiliary evidence. [The generated-API audit](../evidence/00/native-terminal-api-audit.md) records the request-side command-process attachment gap; remote native resume is the verified alternative relationship.

## E02 runtime check

The following was run successfully in this packet; it verifies only that Node 26 can use its built-in SQLite module, not the proposed application architecture:

```sh
node --version
node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; const db = new DatabaseSync(":memory:"); console.log(db.prepare("select 1 as ok").get().ok)'
npm --version
```

Recorded result: the SQLite command printed `1`.

After scaffold approval, packet 1A must add and verify the actual install, build, test, and single-start commands. They do not exist in packet 00.
