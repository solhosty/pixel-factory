# Packet 00 evidence

- `app-server-probe.mjs` is the dependency-free disposable app-server probe.
- `app-server-probe.jsonl` contains redacted traces from framing/runtime failures and the final successful app-server run.
- `app-server-probe-summary.json` records the final successful two-folder/thread/PTTY result. It still does not prove native Codex TUI attachment.
- `native-terminal-api-audit.md` records the generated request/notification audit showing why active command `processId` exposure is not a terminal-attachment API.
- `remote-native-resume-probe.mjs` is the final disposable shared-endpoint probe. It resumes the genuine Codex CLI TUI through one long-lived app-server Unix socket, exercises resize and a TUI-queued follow-up, interrupts the observed follow-up turn, then resumes the same provider thread.
- `remote-native-resume-probe.jsonl` and `remote-native-resume-probe-summary.json` are the final redacted 0.154.0 evidence. The native UI is present in output (`Resuming session`); the follow-up is acknowledged by the native UI and appears as a distinct provider turn; no active-writer error occurred.

The first attempt at the native probe reached a Codex update dialog, and a test keystroke selected its update option. It upgraded the local CLI from 0.153.4 to 0.154.0. The final probe was restarted against the new version; the update side effect is retained in the validation record and handoff.

No secrets, credentials, or project source were captured. Opaque disposable provider thread/turn/item IDs remain in the protocol trace solely to establish that both views used the same execution.
