# Milestone execution and handoff

This pack is for building Pixel Harness across separate coding sessions, including sessions using cheaper models. It describes the development workflow; the employees inside the finished product are a separate concept.

## Authority and scope

Current user instructions take precedence. `MILESTONES.md` is the product specification. `DECISIONS.md` records approved choices and unresolved engineering work. Each packet narrows a product milestone into a session-sized checkpoint; it does not remove requirements from the parent milestone. `STATUS.md` records facts, not intentions.

No framework, dependency versions, commands, API schema, or database schema have been selected. Packet 00 must establish the contracts and verified commands before downstream implementation. Do not invent compatibility claims to fill these gaps. Do not generate artwork now: the user explicitly deferred it. Starting a later coding packet alone is not authorization to begin asset generation.

## Sequence

First useful release: **00 → 0A → 1A → 1B → 2A → 2B → 2C → 2D → 3A → 3B → 3C**.

Later capabilities: **4A → 4B → 5A → 5B**. Optional Coder is **6**, after 5B. Office manager is **7**, after 5B; it does not require Coder.

This preserves the existing product milestone numbering. Lettered packets are smaller handoff checkpoints. A parent milestone is complete only when every associated packet is complete. Sequential multiple sessions are in the first release; concurrent sessions, multiple accounts/providers, and Coder remain later. Do not expand that release boundary without a recorded decision.

## Starting a session

1. Read this guide, `STATUS.md`, the requested packet, and the latest handoff for its prerequisites. Read the product specification for the affected behavior. Do not load all previous transcripts.
2. Inspect the actual checkout and any applicable repository instructions. Preserve existing user work. Record branch/revision and dirty paths, or explicitly record that Git is not initialized.
3. Check prerequisite evidence against the checkout. An unverified claim in a handoff is not a passed prerequisite. If evidence is stale, run the smallest relevant check rather than redoing the entire project.
4. Read the approved contracts and exact commands established in packet 00. If required inputs are missing, identify the missing contract before implementing dependent code.
5. Mark the packet in progress. Work only its checklist. Routine implementation choices are yours; ask one focused question for material product/design changes.

## Finishing or stopping a session

Run the packet's meaningful checks and inspect the served UI for UI changes. Record exact commands, exit outcomes, environment, and evidence paths. Use deterministic worker fixtures for failure scenarios, plus the explicitly required real Codex runs. Mock success does not prove native integration. Do not repeatedly spend account usage on redundant smoke tests.

Before ending, write `docs/execution/handoffs/<packet>-<date>-<short-description>.md` using `HANDOFF_TEMPLATE.md`, then update the ledger with its link and next action. Keep screenshots, logs, or clips under `docs/evidence/<packet>/` when suitable for sharing; omit secrets, private source content, and local auth records. Record large evidence outside Git with a usable location if needed. Never mark an unchecked criterion passed.

A packet may span several sessions. If unfinished, keep its remaining checklist and a precise next step; the next session resumes that packet. Do not move to a later packet merely because time or context is short.

Suggested states: `not_started`, `in_progress`, `needs_user_review`, `blocked`, `complete`. `complete` requires all acceptance checks and required approvals. `needs_user_review` means the concrete result is ready for the named approval; it is not failure. Record approval text/date and the artifact version it covers. Code verification and visual acceptance are separate.

No automatic commit, push, PR, merge, or asset generation is authorized by this guide. Follow the user's requested delivery scope. Preserve a reviewable working tree and record its exact state if no commit is made.

## Using cheaper models effectively

Use a cheaper execution model for one bounded packet or checklist item after its inputs and contracts are settled. Give it the packet, latest relevant handoff, exact file pointers, fixture, and check command. Do not ask it to rediscover the architecture or digest the entire conversation.

Packets identify ordinary implementation work and the decisions that merit a more capable review. Start with the user's selected model; these labels are routing advice, not permission to spawn agents or change models automatically. No particular model name or price is assumed.

Escalate with a short written report when a failure repeats after two materially different attempts, a protocol is unsupported, or a contract must change. Include the smallest reproduction, attempted fixes, logs, and one recommendation. A stronger session resolves the narrow uncertainty, records the decision, and hands execution back. Do not let either model silently substitute logs for a real terminal, erase dirty work, bypass approvals, or accept weaker visual quality.

Use focused review at the execution contract (00), visual direction (0A), recovery (2D), delivery (3C), account isolation (4A), and scheduler (5A) boundaries. Review is evidence-based and can happen in the current session or a later user-selected session. It is not a requirement to create extra agents.

## Copyable starting prompt

> Complete execution packet <ID> for Pixel Harness. Read README.md, docs/execution/README.md, docs/execution/STATUS.md, that packet, and its prerequisite handoffs. Confirm the actual checkout matches the handoff. Follow the approved contracts and product scope; do not reopen settled decisions or implement later packets. Run the packet's acceptance checks, record exact evidence, write a handoff using HANDOFF_TEMPLATE.md, and update STATUS.md. If a material decision blocks progress, prepare concrete alternatives and ask one question. Do not generate assets unless I explicitly authorize that phase. Stop at this packet's completion or review boundary.

## Copyable continuation prompt

> Resume packet <ID> from handoff <path>. Verify the recorded checkout and evidence, complete only the remaining checklist, and leave an updated handoff and ledger. Preserve unfinished work. Do not restart the packet from scratch or infer that pending approval has been granted.
