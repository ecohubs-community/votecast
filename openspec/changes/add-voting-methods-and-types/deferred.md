# Deferred / Future Considerations

Ideas surfaced while exploring voting methods & types that are intentionally **out of scope**
for this change. Captured here so they are not lost. None of these block the in-scope work;
each should be revisited as its own change.

## 1. Structured deliberation phase (likely a paid feature)

The method's `deliberation` phase is, in this change, only a **timed delay** before voting opens.
A future change can grow it into a real discussion surface:

- Threaded comments / Q&A on the proposal during deliberation.
- Proposal **amendments** (proposer edits in response to feedback, with history).
- Sensemaking / clustering of comments (overlaps with pol.is data model).
- Community-level toggle: a community decides whether deliberation is "just a timer" or
  "a timer + discussion surface."
- Candidate for a **paid tier** — it is additive and gated cleanly.

The decomposition in this change leaves the hole for it: the deliberation phase already exists
as a first-class timed phase, so adding a UI later does not require re-architecting.

## 2. Admin activity log (audit log)

Axis-6 visibility policy ("votes hidden forever") and type **versioning** both imply that some
information must still be recorded for accountability even when it is not publicly shown.

A future change should add a per-community **admin log** capturing, among other things:

- Type/method **version changes** (who changed a method, when, old → new snapshot).
- Side-effect **wiring changes** (webhook URL retargeted, notification toggled).
- Sensitive lifecycle events for hidden-tally proposals (objection raised, early stop triggered)
  that admins/facilitators can see even when members cannot.
- Failed/retried webhook & execution-handler runs.

This is distinct from the public proposal results — it is an admin-only accountability surface.

## 3. Event-wiring scope vs. versioning (decision to finalize later)

Open boundary noted during exploration: the **decision-intrinsic** process (phases, stop
conditions, visibility) is frozen into a `TypeVersion`. But generic **side-effect wiring**
(notification subscriptions, webhooks like "export to git") feels like community-level
infrastructure that admins want to retarget *without* forking type history.

Working assumption for this change: side-effect wiring is **community-level subscriptions that
filter by type**, not versioned per type. Revisit if real usage shows wiring needs to be
version-pinned.

## 4. In-app custom decision logic (beyond external resolver)

This change deliberately stops at the **external resolver webhook** (community hosts code, we
POST a signed payload and read back `{ outcome, rationale }`). We do **not** run user-supplied
repo code in-process.

A possible future middle tier: a **sandboxed expression** (e.g. for a threshold formula only),
evaluated in a restricted environment — never a full program. Only pursue if the external
resolver proves too heavyweight for common cases.

## 5b. Rich notification delivery channels

This change only **emits** lifecycle events and records notifications to a minimal in-app sink —
there is no email/push/Discord transport today. A future change should add real delivery channels
(email first, then push/Discord), per-member preferences, digesting, and retry/backoff. The event
catalog (Task 3) is designed so adding channels later requires no changes to event emission.

## 5c. Real pol.is opinion-clustering

This change scopes pol.is to **multiple sub-questions** (a fixed multi-part ballot, tallied per
aspect). A future change can add true opinion-clustering as a separate Method Module: participant-
submitted statements, an agree/disagree/pass vote matrix, PCA + k-means clustering, a live opinion-
group/consensus visualization, and statement moderation. It is sensemaking (no pass/fail outcome),
so it interacts differently with the decision-rule axis — likely feeding a later decision rather
than producing one.

## 5d. Distinct facilitator / moderator / observer roles

This change maps facilitator powers onto `admin`. [06_auth_identity.md](../../../specs/06_auth_identity.md)
lists `moderator`, `facilitator`, `observer` as future roles. A later change can introduce a real
facilitator role (can see/judge objections under hidden tallies without full admin rights) and an
observer role (can watch but not vote).

## 5. Cross-axis validity rules (grows over time)

Method axes are not fully independent. Known constraints to encode and extend:

- `visibility = hidden-forever` conflicts with member-visible early-stop conditions
  (a facilitator must still see objections to trigger an early stop).
- Live tally visibility may be incompatible with certain anonymity guarantees.

Maintain this as a living set of validation rules as more methods are added.
