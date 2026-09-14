# Pixel Harness

A local, open-source pixel office for coding projects. Persistent employees run tasks through users' harness connections, ask for decisions, and demonstrate verified work.

**Current state: Packet 2A is ready for review.** The browser UI and local Node service persist projects, staff appearance recipes, task folder scopes, and one explicitly launched Codex session with a service-owned native terminal. Planning/approval gating, fallback, parallel work, and recovery remain later packets. Browser-first; local execution service; macOS first; Codex first.

- [Product specification](MILESTONES.md): confirmed behavior and visual quality requirements.
- [Execution guide](docs/execution/README.md): how to complete a bounded milestone and hand off to another session.
- [Progress ledger](docs/execution/STATUS.md): current work and evidence.
- [Decision register](docs/execution/DECISIONS.md): settled choices and engineering questions.

Run `npm install`, then `npm run dev`. The service prints a one-launch browser URL containing its ephemeral token in the URL fragment; open that exact URL. Data is stored locally under `.pixel-harness/` by default and is ignored by Git. Asset creation remains deferred until the user explicitly starts that phase.
# pixel-harness
