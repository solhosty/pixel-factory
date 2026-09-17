# Packet 3E — delivery rehearsal start

Date: September 14, 2026

## Implemented slice

Migration `013_delivery_rehearsal_v1` persists project delivery defaults, explicit per-task delivery overrides, per-folder outcomes, and a project release state. A task requires accepted current demo evidence before a delivery attempt can begin. A retry reuses the unfinished attempt and preserves any successful repository outcome, preventing duplicate recording. Project states are distinct: active, delivered, done, then archived; archive rejects projects that have not passed the explicit completion step.

The project surface exposes defaults, task overrides, per-repository delivery outcomes, retry, and the completion/archive boundary. An explicit confirmation can now perform scoped local, isolated-branch, or GitHub pull-request delivery only after a clean captured baseline; pre-existing dirty work is rejected and preserved. PR delivery requires `origin` plus authenticated `gh`, pushes the isolated branch, and reuses an existing PR on retry. Merge and publishing remain unsupported.

## Verification

- `npm run check:service` passed.
- `npm run check` passed with zero errors or warnings.
- `npm test` passed: 37 tests, including partial multi-repo retry and completion lifecycle coverage.
- `npm run build` and `git diff --check` passed.
- An isolated preview on ports 5185/4335 opened the Projects delivery surface and persisted a Branch / commit default with its prerequisites. The temporary preview was stopped afterward.
- An isolated service on port 4336 delivered a two-repository disposable fixture: both repositories started with a committed clean baseline, changed after the delivery attempt was prepared, moved to the same `pixel-harness/<task-id>` branch, and received a `Pixel Harness:` commit. Both persisted outcomes were `delivered`.
- A second two-repository fixture began with uncommitted `preexisting.txt` files. Delivery recorded failed outcomes explaining that pre-existing dirty work was preserved; neither repository changed branch or committed the files.
- A local PR-adapter fixture used a disposable bare remote and injected `gh`: a simulated provider failure after push left one isolated-branch commit, then retry found a provider PR URL with no duplicate commit or PR creation.
- A fresh copy excluding Git metadata, `node_modules`, generated SvelteKit output, and local Pixel state completed `npm ci`, both typechecks, 37 service tests, eight office tests, and the production build. The initial clean-install check exposed a missing SvelteKit sync step; `prepare: svelte-kit sync` now fixes that setup requirement.
- Authorized remote proof: the documentation-only branch `pixel-harness/3e-pr-rehearsal-20260914` was pushed to `solhosty/get-a-job` and created [PR #1](https://github.com/solhosty/get-a-job/pull/1). It is open with a clean merge state and was intentionally not merged.

## Original remaining work

All items below were completed on September 15, 2026: MIT license selection, fresh profile rehearsal, saved-recipe demo evidence, authenticated PR runner rehearsal, and recorded visual approval. Merge remains a separately explicit authorization.

## Final rehearsal and closure

On September 15, 2026, an isolated fresh state performed the complete release lifecycle. Real authenticated Codex created `PIXEL_HARNESS_CORRECTED_REHEARSAL.md` in a fresh authorized clone with exactly `Corrected live delivery rehearsal\n`. Delivery used the clean pre-execution baseline, pushed `pixel-harness/e2546fc0-e4aa-4e1f-93e4-f3aab51ed86a`, and created [PR #2](https://github.com/solhosty/get-a-job/pull/2). A second selected local repository was unchanged and persisted as a successful no-op rather than a failure. The project then moved through done, archive, and reopen, ending active with release state `done`. Migration 016 and its real-Git regression test address the baseline issue found during the first live run. Packet 3E is complete; do not merge the PR without separate authorization.
