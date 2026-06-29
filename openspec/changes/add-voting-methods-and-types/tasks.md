## 1. Gate: Method Module contract pressure-test

- [ ] 1.1 Draft the Method Module interface (`ballotSchema`, `validateVote`, `tallyVotes`, ballot/results UI contract)
- [ ] 1.2 Run the interface on paper against async-window consensus (silence = consent, reasoned paramount objection, 2-week window)
- [ ] 1.3 Run it against Common Ground as `multi-question` (per-aspect tally; clustering confirmed deferred per D10)
- [ ] 1.4 Run it against sociocracy with a 2/3 fallback (decision-rule escalation)
- [ ] 1.5 Run it against a result-SET method (ranked/IRV or multi-winner) to confirm the tally output shape from D9 holds
- [ ] 1.6 GATE: update design.md (D1/D2/D9), the proposal, and `specs/voting-methods` to match the proven interface before any module is built

## 2. Gate: Data model sketch

- [ ] 2.1 Model Type → TypeVersion (immutable, whole-method snapshot) → method config (6 axes + deliberation time)
- [ ] 2.2 Model proposal version pinning (`typeVersionId`) and module-varying ballot storage (build on `vote.metadataJson`)
- [ ] 2.3 Decide the freeze boundary: what a TypeVersion captures vs. community-level side-effect wiring (resolve `deferred.md` §3)
- [ ] 2.4 Plan the `strategyId` → method-composition migration + preset/default back-fill
- [ ] 2.5 GATE: update design.md (D4, Impact/schema), the proposal Impact, and `specs/proposal-types` to match the agreed model

## 3. Gate: Event catalog

- [ ] 3.1 Enumerate lifecycle events (deliberation.started, voting.started, objection.raised, voting.closing-soon, voting.closed, outcome.decided, …) with payloads
- [ ] 3.2 Define how notifications and webhook/execution-handler pipelines subscribe (build on `webhook` + `executionHandler` tables)
- [ ] 3.3 Define the external-resolver call contract (signed payload, timeout, fallback when unreachable)
- [ ] 3.4 GATE: update design.md (D3), the proposal, and `specs/governance-events` to match the catalog

> Gates 1–3 must close (and their artifact updates land) before any task below begins.

## 4. Schema & migration

> **First build step = 4.1, and it is gated on Gate 1.** Ballot storage must be generalized before
> any module is built, because the column shape (rank/score/credits, question grouping) is decided by
> the Method Module contract. Do not start 4.1 until Gate 1 (tasks 1.x) has closed. (Design D11.)

- [ ] 4.1 **(first build step, gated on Gate 1)** Generalize ballot storage per D11: add `ballot_question` + `vote_selection`, extend `proposal_choice` with `questionId`; migrate each existing single-choice vote to one `vote_selection` row; keep `uniqueIndex(proposalId, userId)` as the one-ballot-per-voter guard
- [ ] 4.2 Add proposal-type, type-version, and method-config tables to `governance.schema.ts`
- [ ] 4.3 Replace `proposal.status` (`draft/active/closed`) with phase states (deliberation/voting/objection-window/finalized) + outcome states (passed/failed/blocked/tie/quorum-not-met/indeterminate); migrate existing rows
- [ ] 4.4 Seed 1–3 preset types per community (and at community-creation time)
- [ ] 4.5 Back-fill existing communities/proposals to a default type version; pin every proposal's `typeVersionId`
- [ ] 4.6 Generate and run the Drizzle migration; remove `proposal.strategyId` after dispatch + back-fill verify

## 5. Method Module registry & first modules

- [ ] 5.1 Implement the Method Module registry and the contract from Gate 1
- [ ] 5.2 Replace the `onePersonOneVote`-only guard in `proposal-service.ts` with module dispatch (validate/tally)
- [ ] 5.3 Implement core modules: single-choice (simple/absolute/super-majority), consent (consensus / consensus-minus-N / fallback)
- [ ] 5.4 Implement eligibility gates (all-members, trained/quiz) and weight axes wiring (1p1v first)
- [ ] 5.5 Implement the `multi-question` (Common Ground) module: per-aspect tally + configurable sub-question contribution (who/when), question-set frozen at voting-open
- [ ] 5.6 Implement stand-aside (non-blocking) and per-method vote mutability (change/retract while phase open)
- [ ] 5.7 Model the tally as a result-set (single-winner / pass-fail / per-sub-question) and resolve explicit outcome states (tie / quorum-not-met / blocked / indeterminate)
- [ ] 5.8 Enforce "methods declare honored knobs": reject unsupported or contradictory config combinations
- [ ] 5.9 Unit-test each module's `validateVote`/`tallyVotes` against its hard case (incl. each outcome state)

## 6. Process, events & side-effects

- [ ] 6.1 Implement process phases & timing (deliberation → voting → optional async objection window)
- [ ] 6.2 Implement transition/stop conditions (stop on Nth objection / threshold / quorum / never) and the visibility axis (live / on-close / hidden-forever)
- [ ] 6.3 Emit the Gate-3 lifecycle events from process transitions
- [ ] 6.4 Enforce voter-identity visibility (open vs. secret ballot) at the read/query layer, distinct from tally-reveal timing
- [ ] 6.5 Build a minimal in-app notification sink and wire notifications to events (respecting visibility policy); rich delivery channels deferred
- [ ] 6.6 Wire webhook/execution-handler pipelines (ordered) and the external-resolver boundary with fallback + secret-ballot data-minimization
- [ ] 6.7 Map facilitator powers to `admin` for objection-handling under hidden/early-stop methods
- [ ] 6.8 Enforce cross-axis validity rules (e.g. hidden-forever vs. member-visible early stop)

## 7. UI

- [ ] 7.1 Type management UI (create/edit/retire, view versions) for community admins
- [ ] 7.2 Read-only process flow diagram rendering the configured method (form-authored, not a node editor)
- [ ] 7.3 Proposal creation: pick a Type (pre-filled) + "Advanced" per-proposal override
- [ ] 7.4 Per-module ballot components and results components
- [ ] 7.5 Unified "Extensions" surface presenting method modules + event-plugins

## 8. Verification

- [ ] 8.1 End-to-end: run the attached real-community consensus method through create → deliberate → vote → async objection → finalize
- [ ] 8.2 Verify migration: existing proposals still tally correctly under their back-filled type version
- [ ] 8.3 Confirm `deferred.md` items are still out of scope and recorded; open follow-up changes where warranted
