## Context

LumiVote governs real human communities (eco-villages, cooperatives, collectives), each with its
own decision culture. The current model has a single `proposal.strategyId` that only allows
`onePersonOneVote` ([proposal-service.ts:227](../../../src/lib/server/services/proposal-service.ts)),
collapsing several independent concerns into one field. Exploration (see the attached real-community
consensus bylaw and the conversation that produced this change) showed that a "voting method" is
really a **composition** of orthogonal axes, and that communities want the surrounding **process**
to be configurable and culture-specific.

The architecture spec already anticipates modular voting ([02_architecture.md:412](../../../specs/02_architecture.md))
and a plugin/event system ([05_events_plugins_hooks.md](../../../specs/05_events_plugins_hooks.md)),
and the schema already carries useful seams: `vote.metadataJson`, the `webhook` table (with an
`events` column), and the `executionHandler` table. This change builds on those seams.

> **This design is provisional.** Tasks 1–3 (Method Module contract, data model, event catalog) are
> *gates*: their outcomes are expected to revise this document, the proposal, and the specs before
> the rest of the work proceeds. See "Sequencing & gates" below.

## Goals / Non-Goals

**Goals:**
- Decompose a voting method into independent, individually-configurable axes.
- Ship working **presets** so a community gets sensible methods with zero configuration, adjustable
  where needed (progressive disclosure).
- Support consensus, consensus-minus-N, consent/sociocracy (with majority fallback),
  simple/absolute/super-majority, and pol.is sensemaking under one model.
- Per-community **Proposal Types** that bundle a method + deliberation time, with **immutable
  versioning** so proposals pin the exact method they were created under.
- Reuse the event/plugin system for **process side-effects** (notifications, webhooks, git export)
  and provide an **external resolver** boundary for custom decision logic without running
  user-supplied code in-process.

**Non-Goals (this change):**
- Structured deliberation discussion UI / amendments (deferred — see `deferred.md`).
- Admin/audit log for visibility-policy and versioning actions (deferred).
- In-app sandboxed custom logic beyond the external-resolver webhook (deferred).
- Running community-supplied repository code inside our process (explicitly rejected).
- Third-party event-plugins from untrusted sources (registry is first-party/curated here).

## Decisions

### D1 — A method is a composition of 6 orthogonal axes (not a monolithic enum)

```
METHOD = eligibility · ballot · weight · decisionRule · process · visibility
  1 eligibility   all-members │ trained(quiz) │ token-holders │ reputation≥N
  2 ballot        single │ approval │ ranked │ score │ consent │ polis
  3 weight        1p1v │ token │ quadratic │ reputation        (= today's strategyId)
  4 decisionRule  simple/absolute/super-majority │ consensus │ consensus-minus-N │
                  consent(no-paramount-objection) │ + optional fallback escalation
  5 process       phases&timing · transition/stop conditions · event wiring
  6 visibility    live │ on-close │ hidden-forever
```

Rationale: combinations like "sociocracy but with 2/3 fallback" or "consensus with reputation
weighting" stop being new methods and become axis settings — a small set of testable pieces covers a
combinatorial space of named methods. **Alternative considered:** a flat `method` enum per named
method → rejected; explodes combinatorially and duplicates logic.

### D2 — Two distinct extension registries (the "plugin" word was overloaded)

```
Registry A: METHOD MODULES (core, first-party, versioned)   Registry B: EVENT PLUGINS (safe)
  ballotSchema + validateVote + tallyVotes                    subscribe to lifecycle events
  + BallotComponent + ResultsComponent                        notifications, webhooks, git export,
  e.g. single-choice, consent, ranked, polis                  analytics, external-resolver call
  → CHANGES core governance rules                             → MUST NOT change governance rules
```

pol.is and consent change the ballot model + tally + UI, which is a *core governance rule* — the
spec forbids plugins from touching those ([05_events_plugins_hooks.md:247](../../../specs/05_events_plugins_hooks.md)).
So they are **Method Modules**, not event-plugins. The existing plugin system
(`voting-analytics.ts`) is the right home for the *process side-effects* only. The UI may present
both registries under one unified "Extensions" surface so it *feels* like installing plugins, while
the architecture keeps two registries with different trust/capability profiles.
**Alternative considered:** make pol.is a plugin by letting plugins register ballots+UI → rejected;
blurs the "no core changes" rule and re-opens the untrusted-code security problem.

### D3 — Process decomposes into phases, stop conditions, visibility, and event wiring

```
[deliberation Xd] → [voting Yd] → [optional async objection-window Zd] → finalize
   stop conditions: on 1st / Nth objection │ threshold reached early │ quorum met │ never (timer)
   visibility (axis 6): live │ on-close │ hidden-forever
   event wiring: each transition fires lifecycle events → notifications + webhook/handler pipelines
```

The git example (export proposal text to a repo folder by outcome, then call a second hook) is an
**ordered pipeline of outcome actions** bound to `voting.closed` / `outcome.decided`, modeled with
the existing `executionHandler` + `webhook` tables. Cross-axis constraint to enforce: a
member-visible early-stop is incompatible with `hidden-forever` unless a facilitator can still see
objections.

### D4 — Proposal Types are per-community and immutably versioned

```
ProposalType "Constitutional" (community-scoped)
   ├ v1 {full method snapshot + deliberation time}  ← proposals A,B pin here (frozen)
   ├ v2 {full method snapshot + deliberation time}  ← proposal C
   └ v3 …                              editing the method = new version; old proposals unchanged
```

A `TypeVersion` freezes the **whole method** (all 6 axes + deliberation time). Every proposal stores
its `typeVersionId`. 1–3 presets are seeded at community creation so proposing works immediately.
**Decision to finalize later (D-open):** generic side-effect *wiring* (webhook URLs, notification
toggles) is modeled as community-level subscriptions that filter by type, **not** versioned — so an
admin can retarget a webhook without forking type history. See `deferred.md` §3.

### D5 — External resolver instead of in-process custom code

For fully custom decision logic, the community hosts code matching a published interface; we POST a
signed, timed payload of the tally context and read back `{ outcome, rationale }`. **Alternatives:**
running their repo in-process (rejected — sandboxing/secrets/DoS/trust on a multi-tenant host) and a
sandboxed in-app expression (deferred — only if the resolver proves too heavy).

### D6 — Process flow is form-authored, diagram-visualized (no free-form node editor yet)

Render the configured process **as** a read-only flow diagram for comprehension, but author it via
toggle-able phase blocks in a form. A free-form drag-the-nodes graph editor is deferred — most
communities map to 2–3 phase templates; revisit only if real usage demands it.

### D7 — Explicit lifecycle phase states + outcome states (the current 3-state enum is insufficient)

`proposal.status` today is `draft / active / closed`, which cannot express a multi-phase method or a
nuanced result. Split into two concerns:

```
PHASE state (where in the process):  draft → deliberation → voting → objection-window → finalized
OUTCOME state (the result):          passed │ failed │ blocked │ tie │ quorum-not-met │ indeterminate
```

`blocked` (a sustained paramount objection), `tie`, `quorum-not-met`, and `indeterminate` are
first-class results, not "closed with no winner" — they drive different notifications and pipelines.
The consensus example's "passed, pending absent consent" = phase `objection-window` + a provisional
outcome that finalizes to `passed` if the window expires with no blocking objection.
**Alternative considered:** keep one flat status enum → rejected; conflates "where" with "what
result," and can't represent a provisional/pending outcome.

### D8 — Roles, facilitator capability, and vote mutability

Today only `member` / `admin` exist; `facilitator` is a *future* role
([06_auth_identity.md](../../../specs/06_auth_identity.md)). Several methods structurally need a human
who can see and act on objections even under a hidden tally (stop-on-objection, paramount-objection
judgement). For this change, **facilitator powers map to `admin`**; a distinct role is deferred.

**Vote mutability** is a per-method setting: a member MAY change or retract a vote while the relevant
phase is open, and the recorded vote is the last one at phase close. The existing one-vote-per-user
unique index supports this as an upsert. Secret-ballot methods still store identity server-side (for
mutability + eligibility) but never expose it; that is the **voter-identity** sub-axis of visibility
(D-vis), distinct from *when the tally is revealed*.

### D-vis — Visibility is two independent sub-axes

`tally-reveal timing` (live / on-close / hidden-forever) is **orthogonal** to `voter-identity`
exposure (open ballot vs. secret ballot). Consensus is typically open (you see who objects); a
sensitive vote may be secret with an on-close tally. Both are stored, enforced at the read/query
layer, and frozen into the TypeVersion.

## Risks / Trade-offs

- **Interface churn** → Tasks 1–3 are explicit gates that may rewrite the schema/specs; we accept a
  slower start to avoid baking in the wrong contract. (Mitigation: pressure-test before building.)
- **Migration of existing proposals** → back-fill every existing proposal to a seeded default type
  version ("simple majority" equivalent) so historical rows stay valid; the `strategyId` split is
  internal-breaking only. (Mitigation: one-shot migration + default seeding.)
- **Cross-axis invalid combinations** → a method config could be internally contradictory (e.g.
  hidden-forever + member-visible early stop). (Mitigation: a validity-rules layer, grown over time;
  see `deferred.md` §5.)
- **pol.is scope creep** → real opinion-clustering is a meaningfully larger build than "multiple
  sub-questions." (Mitigation: Task 1 must decide pol.is's true data model before committing UI.)
- **External resolver reliability/security** → network calls in the decision path. (Mitigation:
  signed payloads, timeouts, retries, and a defined fallback when the resolver is unreachable.)
- **Versioning storage growth** → frozen snapshots per edit. (Mitigation: acceptable; snapshots are
  small JSON; prune only if it ever matters.)
- **No notification delivery exists today** → the change assumes members can be told things, but
  there is no email/push/in-app transport. (Mitigation: this change only *emits events* and writes to
  a minimal in-app/log sink; real delivery channels are a separate dependency — see `deferred.md`.)
- **External resolver leaks vote data** → sending tally context off-platform is a privacy exposure,
  especially for secret ballots. (Mitigation: data-minimization in the payload — send aggregates, not
  raw per-member votes, unless the community explicitly opts in; sign + scope the payload.)
- **Concurrent vote upserts / late votes** → a vote landing exactly at phase close or a mutable vote
  racing a tally. (Mitigation: votes are bounded by phase state checked transactionally; the tally
  reads a consistent snapshot at the close transition.)

## Migration Plan

1. Add new tables (types, type versions, method config) alongside the existing schema.
2. Seed 1–3 preset types per existing community; back-fill a default type version capturing today's
   `onePersonOneVote` + simple-majority behavior.
3. Point every existing proposal at the back-filled default `typeVersionId`.
4. Replace the `onePersonOneVote`-only guard with method-module dispatch.
5. Remove `proposal.strategyId` once dispatch + back-fill are verified.
   Rollback: keep `strategyId` populated through steps 1–4; only drop it in step 5 behind a verified
   migration.

## Sequencing & gates (drives tasks.md)

The first three tasks are **gates**. Each may revise this design, the proposal, and the specs before
downstream work starts:

1. **Method Module contract pressure-test** — write the `validateVote` / `tallyVotes` / ballot-schema
   interface and run it (on paper) against three hard cases: async-window consensus, pol.is
   sensemaking, sociocracy-with-2/3-fallback. *Outcome must update D1/D2 and the `voting-methods`
   spec before any module is built.*
2. **Data model sketch** — Type → TypeVersion → method config, proposal version pinning, and
   module-varying ballot storage. *Outcome must update D4, the Impact/schema section, and the specs.*
3. **Event catalog** — enumerate lifecycle events that notifications **and** the webhook/handler
   pipeline hang off. *Outcome must update D3 and the `governance-events` spec.*

Only after these gates resolve do the build tasks (modules, types UI, event wiring, migration)
proceed.

## Open Questions

- Is pol.is "real clustering/sensemaking" or "multiple sub-questions on one proposal"? (Decided in
  Task 1.)
- Exact boundary of what a `TypeVersion` freezes vs. community-level wiring (D4 / `deferred.md` §3).
- Default fallback behavior when an external resolver is unreachable.
- Minimum facilitator-visibility needed to support early-stop under `hidden-forever`.
- Exact outcome-state set and their transitions (esp. tie-break policy and quorum interaction).
- Whether vote mutability is a per-method setting or a global rule.
- How a retired type behaves (block new proposals, keep existing version-pinned proposals running).
- Minimum-viable notification sink for this change (in-app inbox vs. log-only) before real channels.
