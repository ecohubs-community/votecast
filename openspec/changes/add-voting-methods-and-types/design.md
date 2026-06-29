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
  simple/absolute/super-majority, and Common Ground sensemaking under one model.
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
  2 ballot        single │ approval │ ranked │ score │ consent │ multi-question (Common Ground)
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
  BallotModule  (shape + validateVote + aggregate)            subscribe to lifecycle events
  DecisionRule  (CanonicalTally → ResultSet, + fallback)      notifications, webhooks, git export,
  + Ballot/Results UI components                              analytics, external-resolver call
  e.g. single-choice, consent, ranked, multi-question         → MUST NOT change governance rules
  → CHANGES core governance rules
```

Common Ground (multi-question) and consent change the ballot model + tally + UI, which is a *core governance rule* — the
spec forbids plugins from touching those ([05_events_plugins_hooks.md:247](../../../specs/05_events_plugins_hooks.md)).
So they are **Method Modules**, not event-plugins. The existing plugin system
(`voting-analytics.ts`) is the right home for the *process side-effects* only. The UI may present
both registries under one unified "Extensions" surface so it *feels* like installing plugins, while
the architecture keeps two registries with different trust/capability profiles.
**Alternative considered:** make Common Ground a plugin by letting plugins register ballots+UI → rejected;
blurs the "no core changes" rule and re-opens the untrusted-code security problem.

**Gate-1 refinement — a method module is itself two contracts.** Pressure-testing "sociocracy with a
2/3 fallback" showed a single `tallyVotes` was doing two of D1's axes at once (ballot *and* decision
rule), which would have killed composability. So Registry A's method modules split into:

```
BallotModule   id · tallyFamily · validateVote(submission,ctx) · aggregate(ballots,ctx) → CanonicalTally
DecisionRule   id · accepts(family) · resolve(CanonicalTally, ctx, fallback?) → ResultSet
   CanonicalTally is a tagged-union bridge (count │ multiQuestion │ scored │ ranked │ consent);
   a rule declares the family it accepts, so incompatible ballot×rule pairings fail at compile time.
A METHOD binds { ballotModuleId, decisionRuleId, fallbackRuleId?, config }.
```

Now "sociocracy + 2/3 fallback" = `consent` ballot + `consensus` rule with a `super-majority`
fallback — a config, not new code; ranked/IRV and multi-winner/STV drop in the same way. The engine
(not the module) still owns eligibility, weight, phase transitions, and visibility (D1 axes 1/3/5/6);
modules see only resolved facts. Contract lives in `src/lib/server/voting/contracts.ts`.

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

**Per-proposal "Advanced" override:** when a proposer overrides axes for a single proposal, the
effective method differs from the type version. We do **not** fork the type. Instead the proposal
stores its own **ad-hoc method snapshot**, and still records the originating `typeVersionId` as
provenance. So a proposal's effective method = its override snapshot if present, else its pinned type
version. (A community MAY disable overrides on a type to enforce its method.)
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

### D9 — A method/config catalog the axes must express (built-now is a small subset)

The whole point of D1 is that adding a method should be a *configuration*, not new code. So the
design commits to a **catalog** the model must be able to express, while only a small subset ships
in this change. If a listed method can't be expressed by the axes, the axis model is wrong — these
double as Gate-1 pressure-test cases.

```
DECISION RULES / TALLIES (ballot in parens)
  built now ▶ simple majority · absolute majority · super-majority(N%) · consensus ·
              consensus-minus-N · consent(no paramount objection, w/ optional fallback) ·
              multi-question / Common Ground (per-aspect tally)
  expressible, later ▶ ranked / instant-runoff(IRV) · STAR(score-then-runoff) · Condorcet ·
              Borda · approval · score/range · cumulative · single-transferable-vote(STV) ·
              proportional/multi-winner · double-majority (e.g. members AND households) ·
              rough consensus · conviction voting (weight accrues over time) · sortition (by lot)

CONFIG KNOBS (cross-cutting; each method declares which it honors)
  built now ▶ quorum(count|%) · pass threshold(%) · deliberation time · voting window ·
              vote mutability · secret/open ballot · tally-reveal timing · stop-on-Nth-objection ·
              sub-question contribution (who/when, frozen at voting-open — D10)
  expressible, later ▶ abstain handling (counts toward quorum/denominator?) ·
              tie-break policy (fail|random|extend|chair-casting-vote) ·
              early closure (when outcome is mathematically settled) · auto-extension if no quorum ·
              sponsorship/seconding threshold (N co-sponsors before a proposal reaches the ballot) ·
              eligibility snapshot timing (at create | voting-open) · minimum membership tenure ·
              min/max selections (approval) · write-in options · re-proposal cooldown · admin/council veto
```

Result shape is modeled as a **result-set**, not a single winner, so multi-winner/proportional and
ranked methods fit later without reshaping storage. **Alternative considered:** model only what
ships now → rejected; we'd bake single-winner assumptions into the schema and pay to undo them.

**Gate-1 additions to outcome states & knobs.** The cases extended the outcome set with
`provisional` (passed a phase but an async objection window is still open — the consensus bylaw) and
`recorded` (informational ballots with no single pass/fail — multi-question/sensemaking, where each
`ResultEntry` carries the meaning). They also added the `absenceMeaning` knob (silence = consent vs.
ignored), which the consensus bylaw needs and which is why `TallyContext` carries `eligibleVoterCount`.
`ResultEntry` resolves an outcome **per entry** so multi-question proposals report a status per
sub-question.

### D10 — "Common Ground" name, neutral code ids, and the no-pol.is-dependency verdict

The pol.is software is **AGPL-3.0** and a multi-language stack (JS/Python/TS/**Clojure** math engine);
its only embedding story is an **iframe to their hosted service** (their UI, their data) — there is
no clean headless API to drive our own UI. Therefore:

- We will **not** take a pol.is runtime dependency. The sensemaking/clustering capability is
  **reimplemented as our own code** from the published method (PCA → k-means with silhouette-chosen
  k → representative statements via comparative z-scores) on standard ML libraries. Methods aren't
  copyrightable; only their code is, and we write fresh code → no AGPL entanglement.
- User-facing brand name: **Common Ground**. **Code identifiers stay neutral and decoupled** from
  the brand: `multi-question` (ships now), `sensemaking`/`opinion-map` (clustering, later). Never
  `polis` anywhere.
- **Sub-question contribution** (the `multi-question` module): configurable `contributors`
  (`proposer` | `members`) × `contributionPhase` (`creation` | `deliberation`), default
  `proposer`/`creation`. **The ballot question-set freezes when voting opens** — member
  contributions are only accepted during deliberation, which keeps every question tallied on equal
  exposure (and gives the deliberation phase a concrete job).

**Alternative considered:** self-host the full pol.is stack and build our UI on it → rejected; AGPL
ambiguity + Clojure/Postgres ops + a backend not designed to be headless. Optional research-only
spike: run self-hosted pol.is once as a reference oracle to validate our reimplementation.

### D11 — Generalize ballot storage to multiple selections (first build step, gated on the contract)

Today `vote` holds a single `choiceId` (notNull) under `uniqueIndex(proposalId, userId)` — one choice
per voter. That assumption is broken by something **in scope now**: the `multi-question` (Common
Ground) module has a voter answer N sub-questions, and the later ranked/approval/score/cumulative
family all need several selections (with a rank/score/credit) per voter. So this is not a future
concern — it is load-bearing for this change.

Feasibility of the catalog against today's schema (the honest split):

```
CONFIG KNOBS                          ✅ mostly free — live in the versioned method-config JSON, or
  quorum, threshold, tie-break,          are queryable from existing rows; no schema change
  abstain, early-close, auto-extend,
  tenure, cooldown                     ⚠️ sponsorship threshold / eligibility snapshot need a small
                                          additive table + a pre-voting lifecycle state
BALLOTS needing many selections        ❌ NOT supported today — single choiceId + unique index
  approval, ranked/IRV, STAR, Borda,      blocks them; multi-question (in scope) hits this now
  Condorcet, score, cumulative
BIGGER FEATURES                        ➕ additive (new tables), not blocked — except conviction
  delegation, multi-winner/STV,           voting, which breaks the notNull start/end-time model
  sortition, conviction voting
```

Provisional shape (exact columns are decided by Gate 1 — that is why the migration follows the
contract, not precedes it):

```
ballot_question   id, proposalId, prompt, position     (null/implicit for single-question ballots)
proposal_choice   + questionId                         (a choice belongs to a question)
vote_selection    NEW — id, proposalId, userId, questionId?, choiceId, rank?, score?, credits?, position
vote              stays the per-(proposal,user) ENVELOPE: votingPower, secrecy, signature, timestamps;
                  drop the single choiceId; keep uniqueIndex(proposalId,userId) = "one ballot per voter"
```

**Sequencing:** pin the Method Module contract (Gate 1) → land this migration as the **first build
step**, immediately exercised by the consent + multi-question modules → then everything else.
**Alternatives considered:** (a) build the migration cold before Gate 1 → rejected; column shape is
contract-dependent and would re-migrate. (b) ship it as a standalone precursor change → workable for
incremental merges, but it has no consumer to verify against, so we keep it as task group 4 here.
**Migration:** existing single-choice votes map to one `vote_selection` row each; the back-fill in
the migration plan above runs in the same step.

### D12 — Concrete data model (Gate 2)

Concretizes D4 + D11. The **method itself is JSON** (a snapshot), not normalized tables — there is no
separate "method-config" table; the snapshot holds the binding + all axis config.

```
proposal_type            id · communityId · name · description · overridesAllowed(bool) · retiredAt? · createdAt
proposal_type_version    id · typeId · version(int) · methodSnapshotJson · deliberationSeconds · createdBy · createdAt
                         └ IMMUTABLE. methodSnapshotJson = { ballotModuleId, decisionRuleId, fallbackRuleId?,
                           eligibility, weight, process, visibility, knobs }  (freezes the whole method — D4)

proposal   (modified)    + typeVersionId(FK) · + methodOverrideJson?(ad-hoc snapshot, D4) ·
                         phase(enum: draft|deliberation|voting|objection-window|finalized) ·
                         outcome(enum?: passed|failed|blocked|tie|quorum-not-met|indeterminate|provisional|recorded) ·
                         − strategyId (dropped after back-fill) · − status (replaced by phase+outcome)

ballot_question          id · proposalId · prompt · position          (implicit single question when absent)
proposal_choice (mod)    + questionId(FK?, null → the implicit question)
vote (modified)          ENVELOPE only: id · proposalId · userId · votingPower · secret(bool) · signature? ·
                         createdAt · updatedAt   (− choiceId)   uniqueIndex(proposalId,userId) = one ballot/voter
vote_selection (NEW)     id · proposalId · userId · questionId? · choiceId? ·
                         rank? · score? · credits? · consentPosition?(consent|stand-aside|object) · reason?
                         └ one row per selection: approval = many; ranked = ranks; multi-question = one/question
```

**Freeze boundary (2.3, resolves deferred §3):** `methodSnapshotJson` freezes the whole method;
side-effect *wiring* (webhook/notification subscriptions) is community-level and references `typeId`
(not a version), so retargeting a webhook does not fork history.

**Migration (2.4):** add tables → seed presets per community → create a default type + v1 snapshot
capturing today's `onePersonOneVote` + simple-majority → pin every proposal's `typeVersionId` →
migrate each existing `vote.choiceId` to one `vote_selection` row → map status (`draft`→draft,
`active`→voting, `closed`→finalized; historical `closed` outcome recomputed by simple majority, else
`recorded`) → drop `strategyId`/`status` once dispatch + back-fill verify.

### D13 — Lifecycle event catalog, subscription model & resolver contract (Gate 3)

Concretizes D3. One dispatcher emits a flat event stream; notifications and side-effect pipelines are
both just subscribers, reusing the existing `webhook` (events column) and `executionHandler` tables.

```
EVENT CATALOG (envelope: { event, proposalId, communityId, typeVersionId, phase, at, data })
  proposal.created · deliberation.started · subquestion.added · voting.started(ballot frozen) ·
  vote.cast · vote.changed · objection.raised · stop-condition.met · voting.closing-soon(lead time) ·
  voting.closed · objection-window.started · objection-window.closed · outcome.decided · proposal.finalized

SUBSCRIBERS
  notifications   community-level subscription { event, audience: members|eligible|admins }, filtered
                  by typeId; writes to the minimal in-app sink (D-risk); respects visibility policy
  pipelines       ordered executionHandlers + webhooks bound to an event (e.g. voting.closed →
                  export proposal text to git by outcome → call follow-up webhook)

EXTERNAL RESOLVER (D5) — a decision rule that delegates
  request   POST { proposalId, tally, config, nonce, issuedAt }   header: HMAC-sign(community secret)
            secret ballots send AGGREGATES only unless opted in (data minimization)
  response  { outcome: OutcomeState, rationale?, entries? }   timeout ~10s, retry w/ backoff
  on fail   apply the method's defined fallback rule; if none → outcome = indeterminate (never run code)
```

Events are emitted by the engine at phase transitions and vote actions, so a subscriber never reaches
into governance logic — it only reacts (preserves the D2 "plugins must not change core rules" rule).

## Risks / Trade-offs

- **Interface churn** → Tasks 1–3 are explicit gates that may rewrite the schema/specs; we accept a
  slower start to avoid baking in the wrong contract. (Mitigation: pressure-test before building.)
- **Migration of existing proposals** → back-fill every existing proposal to a seeded default type
  version ("simple majority" equivalent) so historical rows stay valid; the `strategyId` split is
  internal-breaking only. (Mitigation: one-shot migration + default seeding.)
- **Cross-axis invalid combinations** → a method config could be internally contradictory (e.g.
  hidden-forever + member-visible early stop). (Mitigation: a validity-rules layer, grown over time;
  see `deferred.md` §5.)
- **Common Ground scope creep** → real opinion-clustering is a meaningfully larger build than
  "multiple sub-questions." (Mitigation: this change ships only `multi-question`; clustering is a
  later module — D10.)
- **Delegation / multi-winner change core assumptions** → liquid democracy lets one identity hold
  many votes, and proportional elections return a *set* of winners, not a pass/fail. (Mitigation:
  the tally result is modeled as a result-set from the start (D9); the delegation/multi-winner
  *modules* are deferred but the data shapes do not preclude them.)
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
   interface and run it (on paper) against three hard cases: async-window consensus, Common Ground
   sensemaking, sociocracy-with-2/3-fallback. *Outcome must update D1/D2 and the `voting-methods`
   spec before any module is built.*
2. **Data model sketch** — Type → TypeVersion → method config, proposal version pinning, and
   module-varying ballot storage. *Outcome must update D4, the Impact/schema section, and the specs.*
3. **Event catalog** — enumerate lifecycle events that notifications **and** the webhook/handler
   pipeline hang off. *Outcome must update D3 and the `governance-events` spec.*

Only after these gates resolve do the build tasks (modules, types UI, event wiring, migration)
proceed.

## Open Questions

- ~~Is Common Ground "real clustering" or "multiple sub-questions"?~~ **Decided (D10):** ships as
  `multi-question`; clustering deferred to its own module. (Confirmed in Task 1.)
- Exact boundary of what a `TypeVersion` freezes vs. community-level wiring (D4 / `deferred.md` §3).
- Default fallback behavior when an external resolver is unreachable.
- Minimum facilitator-visibility needed to support early-stop under `hidden-forever`.
- Exact outcome-state set and their transitions (esp. tie-break policy and quorum interaction).
- Whether vote mutability is a per-method setting or a global rule.
- How a retired type behaves (block new proposals, keep existing version-pinned proposals running).
- Minimum-viable notification sink for this change (in-app inbox vs. log-only) before real channels.
