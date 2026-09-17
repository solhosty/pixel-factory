# Pixel Harness

A local, open-source pixel office for coding projects. Persistent employees run tasks through users' harness connections, ask for decisions, and demonstrate verified work.

**Current state: Packets 00–3D are implemented; 3E is in progress.** The browser UI and local Node service persist projects, staff, task folder scopes, approved plans and guidance, versioned decision meetings and task gates, execution capacity, recovery state, employee skill snapshots, rich inputs, reproducible demo evidence, and delivery records. Browser-first; local execution service; macOS first; Codex first. Confirmed PR delivery uses the authenticated GitHub CLI and an `origin` remote; merging and release publishing are not implemented or authorized.

- [Product specification](MILESTONES.md): confirmed behavior and visual quality requirements.
- [Execution guide](docs/execution/README.md): how to complete a bounded milestone and hand off to another session.
- [Progress ledger](docs/execution/STATUS.md): current work and evidence.
- [Decision register](docs/execution/DECISIONS.md): settled choices and engineering questions.

## Install and run

Prerequisites: macOS, Node 26 or newer, npm, and Codex CLI for real Codex execution. Pull-request delivery additionally needs an authenticated GitHub CLI (`gh`) and an `origin` remote. Use a current Chromium-based browser (Chrome was used during development). Windows and Linux are not yet supported or validated.

Run `npm install`, then `npm run dev`. The service prints a one-launch browser URL containing its ephemeral token in the URL fragment; open that exact URL. Data is stored locally under `.pixel-harness/` by default and is ignored by Git. Credentials remain in Codex’s supported credential store; Pixel Harness does not persist provider tokens, cookies, keys, or local source contents as evidence.

For contributors, `npm install` runs the required SvelteKit sync step. Then run `npm run check:service`, `npm test`, `npm run check`, `npm run test:office`, and `npm run build`. The test suite uses temporary local fixture folders only. Runtime art provenance and review status are recorded in [the asset manifest](docs/design/ASSET_MANIFEST.md). Pixel Harness is available under the [MIT License](LICENSE).
# pixel-harness
