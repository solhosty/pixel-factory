# Pixel Harness

A local, open-source pixel office for coding projects. Persistent employees run tasks through users' harness connections, ask for decisions, and demonstrate verified work.

**Current state: Packet 3A is complete; Packet 3B is in progress in its dedicated task.** The browser UI and local Node service persist projects, staff, task folder scopes, approved plans and guidance, versioned decision meetings and task gates, execution capacity, recovery state, and explicitly launched Codex sessions with a service-owned native terminal. The current appearance-recipe and adjoining-room implementations are scheduled for replacement in Packet 3B by unique predefined characters and one company-wide Studio. Browser-first; local execution service; macOS first; Codex first.

- [Product specification](MILESTONES.md): confirmed behavior and visual quality requirements.
- [Execution guide](docs/execution/README.md): how to complete a bounded milestone and hand off to another session.
- [Progress ledger](docs/execution/STATUS.md): current work and evidence.
- [Decision register](docs/execution/DECISIONS.md): settled choices and engineering questions.

Run `npm install`, then `npm run dev`. The service prints a one-launch browser URL containing its ephemeral token in the URL fragment; open that exact URL. Data is stored locally under `.pixel-harness/` by default and is ignored by Git. Asset creation remains deferred until the user explicitly starts that phase.
# pixel-harness
