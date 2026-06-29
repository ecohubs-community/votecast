## Why

Today a proposal carries a single `strategyId` that only ever equals `onePersonOneVote`, and that
field conflates several independent concerns. Real communities govern with very different methods —
consensus, consensus-minus-one, sociocracy/consent (optionally with a 2/3 or absolute-majority
fallback), simple/super-majority voting, and pol.is-style sensemaking — and they want the *process*
around a vote (deliberation time, when it stops, what is visible, who is notified) to mirror their
own culture. We need to support many methods with the simplest possible configuration for users:
working presets out of the box, adjustable where needed.

## What Changes

- **BREAKING (internal):** Split the single `strategyId` concept into orthogonal **method axes** so
  methods become a *composition* rather than a monolith:
  1. **Eligibility** — who may vote (all members, trained-only/quiz, token holders, reputation ≥ N).
  2. **Ballot** — what a vote looks like (single-choice, approval, ranked, score, **consent**, **pol.is**).
  3. **Weight** — vote weighting (1p1v, token, quadratic, reputation) — the old `strategyId`'s real job.
  4. **Decision rule** — how/when an outcome is reached (simple/absolute/super-majority, consensus,
     consensus-minus-N, consent/no-paramount-objection, with optional **fallback escalation**).
  5. **Process** — phases & timing (deliberation → voting → optional async objection window),
     **transition/stop conditions** (stop on Nth objection vs. run timer out), and **event wiring**.
  6. **Visibility** — *two sub-axes:* when the tally is revealed (live / on-close / hidden-forever)
     **and** voter-identity exposure (open ballot — who voted how is visible — vs. secret ballot).
- **Expand the proposal lifecycle** beyond today's `draft → active → closed`: methods need explicit
  phase states (deliberation, voting, objection-window) **and** explicit outcome states (passed,
  failed, blocked, tie, quorum-not-met, indeterminate) so the consensus example's "passed pending
  absent consent" is representable.
- Define **vote mutability** (may a member change or retract a vote while a phase is open?) and a
  **facilitator** capability (today only `member`/`admin` exist; "facilitator" is a *future* role in
  [06_auth_identity.md](../../../specs/06_auth_identity.md)) — for now map facilitator powers to
  `admin`, since stop-on-objection and hidden-tally methods require a human who can see objections.
- Introduce a **Method Module registry** (first-party, curated): each module supplies a ballot
  schema, `validateVote`, `tallyVotes`, and ballot/results UI. pol.is and consent are modules here,
  **not** event-plugins (they change core governance rules).
- Introduce **Proposal Types** — per-community, user-maintainable named bundles (1–3 presets seeded
  at community creation) that bind a Method + a deliberation time. Proposers pick a Type; everything
  is pre-filled and works immediately, with an "Advanced" override per proposal.
- Add **Type versioning**: editing a Type's method creates a new immutable `TypeVersion` that
  snapshots the *whole method*; every proposal pins the exact version it was created under, so
  in-flight and historical proposals are never mutated.
- Add a **lifecycle event catalog** (deliberation.started, voting.started, objection.raised,
  voting.closing-soon, voting.closed, outcome.decided, …) that both **notifications** and
  **webhook/execution-handler pipelines** subscribe to (reuses the existing `webhook` and
  `executionHandler` tables; e.g. export proposal text to a git repo by outcome, then call a
  second hook).
- Add an **external resolver** boundary: for fully custom decision logic, the community hosts code
  matching a published interface; we POST a signed payload and read back `{ outcome, rationale }`.
  We never execute user-supplied code in-process.

**Scope boundaries (to keep this shippable):** this change **emits** lifecycle events and records
notifications/results to a minimal in-app sink — building rich delivery channels (email, push,
Discord) is a separate dependency, since no delivery transport exists today. Eligibility ships with
**all-members** and **trained/quiz** providers; token/reputation eligibility and weighting land as
*interfaces with one concrete implementation*, the rest stubbed. The pol.is ballot is scoped to
**multiple sub-questions** in this change; real opinion-clustering is a later module (decided in
Task 1.3).

Out of scope (captured in `deferred.md`): structured deliberation discussion UI, admin/audit log,
in-app sandboxed custom logic, rich notification delivery channels, real pol.is opinion-clustering,
finalizing event-wiring-vs-versioning boundary.

## Capabilities

### New Capabilities
- `voting-methods`: The method-axis model and the Method Module registry/contract (eligibility,
  ballot, weight, decision rule, process, visibility) and how a proposal is evaluated against it.
- `proposal-types`: Per-community, versioned proposal types that bundle a method + deliberation
  time; preset seeding, editing, and version pinning of proposals.
- `governance-events`: The lifecycle event catalog and the wiring of notifications + webhook /
  execution-handler pipelines (including the external resolver boundary) to those events.

### Modified Capabilities
<!-- No archived capability specs exist yet (openspec/specs/ is empty), so these are tracked as new. -->

## Impact

- **Schema** (`src/lib/server/db/governance.schema.ts`): replace `proposal.strategyId` with a
  method composition; new tables for proposal types, type versions, and method config; ballot
  storage that varies by module (votes already carry `metadataJson`); expand `proposal.status`
  (currently `draft/active/closed`) into phase + outcome states.
- **Services** (`src/lib/server/services/proposal-service.ts`): the hard-coded
  `onePersonOneVote`-only guard is replaced by method-module dispatch (validate/tally).
- **Plugins/events** (`src/lib/server/plugins/`, `specs/05_events_plugins_hooks.md`): event catalog
  + subscriber wiring; existing `voting-analytics.ts` is the model for safe event-plugins.
- **API** (`specs/04_api_spec.md`): proposal create/read carry a type + version instead of a bare
  `strategy_id`; results shape varies by method module.
- **UI**: ballot & results components per method module; type management + (read-only) process flow
  visualization; "Advanced" override on proposal creation.
- **Migration**: existing proposals/back-fill to a default "simple majority" (or equivalent) type
  version so historical data stays valid.
