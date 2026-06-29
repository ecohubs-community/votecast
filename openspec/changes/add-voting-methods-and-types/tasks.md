## 1. Gate: Method Module contract pressure-test

- [x] 1.1 Draft the Method Module interface (`ballotSchema`, `validateVote`, `tallyVotes`, ballot/results UI contract) → `src/lib/server/voting/contracts.ts`
- [x] 1.2 Run the interface on paper against async-window consensus (silence = consent, reasoned paramount objection, 2-week window)
- [x] 1.3 Run it against Common Ground as `multi-question` (per-aspect tally; clustering confirmed deferred per D10)
- [x] 1.4 Run it against sociocracy with a 2/3 fallback (decision-rule escalation)
- [x] 1.5 Run it against a result-SET method (ranked/IRV or multi-winner) to confirm the tally output shape from D9 holds
- [x] 1.6 GATE: update design.md (D2 split + D9 outcome states/knobs) and `specs/voting-methods` to match the proven interface before any module is built

## 2. Gate: Data model sketch

- [x] 2.1 Model Type → TypeVersion (immutable, whole-method JSON snapshot) → method config (D12)
- [x] 2.2 Model proposal version pinning (`typeVersionId`) + ad-hoc override snapshot, and `vote_selection` ballot storage (D11/D12)
- [x] 2.3 Decide the freeze boundary: TypeVersion freezes the method; side-effect wiring is community-level by `typeId` (resolves `deferred.md` §3)
- [x] 2.4 Plan the `strategyId` → method-composition migration + preset/default back-fill + status→phase/outcome mapping (D12)
- [x] 2.5 GATE: updated design.md (D12) and proposal Impact to match the agreed model (`specs/proposal-types` already covers versioning/override/retire)

## 3. Gate: Event catalog

- [x] 3.1 Enumerate lifecycle events with envelope/payloads (D13)
- [x] 3.2 Define how notifications and webhook/execution-handler pipelines subscribe — one dispatcher, both are subscribers (D13)
- [x] 3.3 Define the external-resolver call contract (signed HMAC payload, ~10s timeout, fallback rule when unreachable, secret-ballot data minimization) (D13)
- [x] 3.4 GATE: updated design.md (D13); `specs/governance-events` already covers the catalog/subscription/resolver requirements

> Gates 1–3 must close (and their artifact updates land) before any task below begins.

## 4. Schema & migration

> **First build step = 4.1, and it is gated on Gate 1.** Ballot storage must be generalized before
> any module is built, because the column shape (rank/score/credits, question grouping) is decided by
> the Method Module contract. Do not start 4.1 until Gate 1 (tasks 1.x) has closed. (Design D11.)

- [x] 4.1 **(first build step, gated on Gate 1)** Generalized ballot storage per D11: added `ballot_question` + `vote_selection`, extended `proposal_choice` with `questionId`; `vote` is now the envelope (kept legacy `choice_id` nullable for the transition); `uniqueIndex(proposalId, userId)` retained
- [x] 4.2 Added `proposal_type` + `proposal_type_version` tables (method is a JSON snapshot, not a table — D12) to `governance.schema.ts`
- [~] 4.3 Phase + outcome **columns** added to `proposals` (legacy `status` kept for transition). The status→phase/outcome **data back-fill** stages with group 6 (needs phase logic) — pending
- [ ] 4.4 Seed 1–3 preset types per community (and at community-creation time) — stages with group 5 (needs module ids for the default method snapshot)
- [ ] 4.5 Back-fill existing communities/proposals to a default type version; pin every proposal's `typeVersionId` — stages with 4.4
- [~] 4.6 Migration `0002` **APPLIED to local.db** (baselined drizzle's migration journal first — DB was built via `push`, so `0000`/`0001` weren't recorded; data preserved: 5 votes / 4 proposals intact). Still TODO in 4.6: remove legacy `proposal.strategyId`/`status` and `vote.choice_id`/`metadata_json` AFTER dispatch (group 5) + back-fill verify

## 5. Method Module registry & first modules

- [x] 5.1 Implemented the registry (`registry.ts`) for ballot modules + decision rules and the split contract from Gate 1
- [x] 5.2 Replaced the `onePersonOneVote`-only guard in `proposal-service.ts` with registry-validated method binding; dispatch (`dispatch.ts`: `validateSubmission`/`tallyBallots` + `DEFAULT_METHOD`)
- [x] 5.3 Core modules: single-choice ballot + simple/absolute/super-majority rules; consent ballot + consensus / consensus-minus-1 / consent rules incl. the 2/3-fallback adaptation
- [x] 5.4 Eligibility (`eligibility.ts`: all-members + trained concrete; token/reputation typed stubs) and weight (`weight.ts`: 1p1v concrete; rest stubbed). NOTE: enforcement in the live vote path wires in group 6
- [x] 5.5 `multi-question` (Common Ground) module: per-question tally + frozen-question validation. NOTE: the who/when contribution config is enforced in group 6 (process), schema already supports it
- [x] 5.6 Stand-aside (non-blocking) in the consent rule; per-method vote mutability in `validateSubmission`
- [x] 5.7 Tally returns a result-set with per-entry outcomes; explicit outcome states (passed/failed/blocked/tie/quorum-not-met/indeterminate/recorded) resolved
- [x] 5.8 `validateMethodBinding`: rejects unknown module/rule, family mismatch, unsupported knobs, unsupported fallback, and the hidden-forever vs. early-stop contradiction
- [x] 5.9 Unit tests: `voting.test.ts` (18, the four Gate-1 hard cases + binding validation) + `results.test.ts` (14, result-correctness: weighted outcomes, absolute/super-majority boundaries, silence=consent, quorum forms, result-set integrity, pass-ignored). The hardening pass **found and fixed a real bug**: `tallyBallots` wasn't threading `binding.config` into the tally context, so quorum/absence knobs were silently dropped. Full suite green.

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
