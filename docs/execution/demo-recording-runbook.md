# Pixel Harness demo recording runbook

This runbook distinguishes the resettable fixture from the separate live-native-terminal proof. A saved session is not a claim that Codex is currently running.

## Reset

From this checkout, run `npm run demo:fixture`. It recreates `.pixel-harness-demo` and prints the fixture identifiers. Start the service and UI with `PIXEL_HARNESS_DATA_DIR=.pixel-harness-demo npm run dev`; use the token printed by the service. Do not reuse a personal profile or alter the SQLite file by hand.

## Observed product-faithful sequence

1. Open the populated Studio and select Mina Park. The dialogue identifies two active assignments.
2. Open **Clarify the release review**. Show its explicit two-folder scope, saved task context, approved plan, and the linked pending decision.
3. Open **Session**. The dock must say **Saved session history** and **no live terminal is attached**. This is a reviewable historical record, not current Codex activity.
4. Open the task board. Show Mina owning both tasks and **Prepare the decision recap** waiting for the sequential local slot.
5. Open Inbox, select the release-review request, and return to its exact task workspace. Do not represent an Inbox acknowledgement as a decision approval.
6. Return to the Studio. The room and ownership state should remain consistent with the task views.

## Required live-native-terminal proof

The saved-session shot above establishes only historical context. `npm run demo:rehearse:live` is the authorized live proof: it performs the same browser rehearsal, then approves the fixture decision, launches one real, constrained Codex turn whose prompt says not to inspect or modify files, verifies an attached provider-backed terminal, captures `rehearsal-live-native-terminal.png`, and stops the session cleanly. This branch is evidence of a real terminal only; it is not part of the resettable queued-decision recording sequence. The September 16 rehearsal completed this proof and its terminal capture visibly contains the constrained response.

## Recording rules

Use cuts only between the listed product states. Do not type fake terminal output, imply the saved session is active, dismiss an error/failure state, or show unapproved mock execution. Stop the run if the fixture is missing either task, the queued task is not visibly waiting for capacity, Inbox does not route to the release-review task, or a narrow layout clips the task workspace. In the separate live proof, stop if the terminal is detached, lacks a provider thread, or the constrained prompt produces file activity.

Before recording, repeat the reset and walkthrough once. The fixed task IDs (`task-demo-release-review`, `task-demo-decision-recap`) and saved session ID (`session-demo-release-review`), plus the two-task / queued-state / decision-routing relationships, must match the prior pass.
