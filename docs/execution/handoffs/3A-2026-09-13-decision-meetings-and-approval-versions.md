# Packet 3A — decision meetings and approval versions

Date: September 13, 2026
Status: complete
Session/model: Codex

## Checkout and running environment

- Worktree: `/Users/hunter/.codex/worktrees/0786/pixel-harness`; detached HEAD `4e9f082aa2f303fc0452b60fd7755421f1e74510`.
- Packet 2D was present as the documented uncommitted baseline. Its modified and new paths were preserved. Packet 3A changes are migration and service methods in `service/src/database.ts`, routes in `service/src/index.ts`, meeting UI in `src/routes/+page.svelte`, deterministic coverage in `service/test/decisions.test.ts`, and this handoff/evidence.
- Node `v26.5.0`, npm `11.17.0`, Codex CLI `0.154.0`. `npm install` restored the checkout dependencies without changing the lockfile.
- Served acceptance used the disposable data directory `/private/tmp/pixel-harness-3a-acceptance`, service `127.0.0.1:4318`, and UI `127.0.0.1:5173`. Stop the session with Ctrl-C in the owning terminal.

## Result

Migration `008_decision_meetings_v1` adds stable decision meetings, immutable numbered versions, UI/technical kinds, alternatives and tradeoffs, preview tones, recommendations, feedback, affected tasks, explicit gated tasks, approval identity/time, and inbox links. The service rejects stale approvals, prevents acknowledgement/resolve routes from bypassing approval, exposes pending gates to the board, and allows unrelated authorized tasks to continue.

Approving the current technical or UI version records exact provenance as `decision:<decision-id>:v<version>` in active project guidance. A subsequent material revision supersedes the approved version, retires its guidance on the next approval, creates a new inbox item, and reopens only the current version's task gates. Nothing approves automatically.

The project meeting surface follows the existing approved A-style chrome: cream meeting paper inside the navy shell, moss approval treatment, clear immutable version labels, compact comparison previews, feedback/revision controls, history, and the office remaining behind the panel. It creates no new product art. The right-sidebar coworker UX and terminal dock remain unchanged.

## Acceptance evidence

- Pass — `npm test`: 24/24. New tests cover UI version revision, stale approval, non-approval inbox routes, technical guidance, independent task admission, material-change regating, and persistence without timeout approval. Existing 2C capacity and 2D recovery tests pass.
- Pass — `npm run check:service`.
- Pass — `npm run check`: 0 errors and 0 warnings.
- Pass — `npm run build`.
- Pass — `git diff --check`.
- Pass — served browser flow: created UI meeting v1 with two previews; confirmed the linked task gate and inbox item; reloaded; revised from feedback to v2; approved exactly v2; confirmed zero pending meetings, the task returned to its independent plan gate, and project guidance showed v2 provenance. The flow exposed and fixed the async form-reset defect.
- Evidence: `docs/evidence/3A/acceptance-summary.json`.

## Decisions and approvals

- No confirmed product decision was reopened and no decision-register entry changed.
- Data/API contract: decision meetings are stable records; versions are immutable; approval requires the exact current pending version; task gates are explicit lists; approved content becomes project guidance; revisions supersede rather than mutate.
- This packet implements the product decision interface. It does not alter the repository's separate 0A visual approval record.

## Remaining work

- None in packet 3A.
- The compact previews are presentation swatches and labels, not generated product art or a reusable 0A asset approval.
- Full demo capture/verification belongs to 3B; delivery rehearsal belongs to 3C.

## Next session

- Next packet: 3B only on explicit request.
- Read `MILESTONES.md`, `docs/execution/README.md`, `docs/execution/STATUS.md`, `docs/execution/packets/3B.md`, this handoff, and the 2D handoff/recovery contract.
- First action: confirm migration 008 and the 24-test baseline in the actual checkout.
- Smallest verification: run `npm test`, then exercise one approved meeting's exact-version/provenance state through the served UI before adding demo records.
- Preserve plan approval, decision gates, Pixel session/Codex thread identity, the genuine native terminal, sequential capacity, recovery blocks, and the right-sidebar office layout. Do not start 3C, concurrency, or live Coder work.

