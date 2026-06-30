# voting-methods Specification

## Purpose

Defines how a proposal is decided: a voting method is a composition of independent axes (eligibility,
ballot, weight, decision rule, process, visibility), realised by a first-party registry of **ballot
modules** (validate + aggregate to a canonical tally) and **decision rules** (canonical tally →
result-set, with optional fallback escalation). Covers the supported decision rules, eligibility,
consent ballots, outcome states, vote mutability, visibility sub-axes, multi-question (Common Ground)
ballots, the result-set output shape, and per-method honored configuration knobs.

## Requirements

### Requirement: A voting method is composed of independent axes

The system SHALL model a voting method as a composition of independent axes — eligibility, ballot,
weight, decision rule, process, and visibility — rather than a single named method. Each axis SHALL
be configurable independently of the others, subject to documented cross-axis validity rules.

#### Scenario: Composing a method from axes
- **WHEN** a method is defined with eligibility=all-members, ballot=consent, weight=1p1v, decisionRule=consensus, and visibility=on-close
- **THEN** the system SHALL accept it as a valid method without requiring a predefined named method

#### Scenario: Mixing axes that named methods would not share
- **WHEN** a method is defined with ballot=consent and weight=reputation
- **THEN** the system SHALL accept the combination so long as it violates no cross-axis validity rule

### Requirement: Method Module registry — split ballot module and decision rule

The system SHALL provide a first-party Method Module registry composed of two contracts: a
**ballot module** (which validates a vote submission and aggregates ballots into a canonical tally)
and a **decision rule** (which resolves a canonical tally into a result-set, optionally delegating to
a fallback rule). A method SHALL bind one ballot module to one decision rule, and the decision rule's
accepted tally family MUST match the ballot module's tally family. Both contracts change core
governance rules and SHALL NOT be modeled as event-plugins.

#### Scenario: Ballot module validates and aggregates
- **WHEN** a vote is cast against a proposal whose method uses a given ballot module
- **THEN** the ballot module SHALL accept or reject the submission with a reason, and SHALL aggregate accepted ballots into a canonical tally

#### Scenario: Decision rule resolves an outcome
- **WHEN** a proposal reaches a tally point
- **THEN** the bound decision rule SHALL resolve the canonical tally into a result-set with participation statistics

#### Scenario: Fallback escalation is composition, not new code
- **WHEN** a method binds a consent ballot to a consensus rule with a super-majority fallback and the consensus rule is blocked
- **THEN** the decision rule SHALL evaluate the fallback rule against the same canonical tally without requiring a bespoke method implementation

#### Scenario: Incompatible binding rejected
- **WHEN** a method binds a ballot module to a decision rule whose accepted tally family differs from the ballot module's tally family
- **THEN** the system SHALL reject the binding

### Requirement: Decision rules support consensus, majority, and fallback escalation

The system SHALL support decision rules including simple majority, absolute majority, configurable
super-majority (e.g. two-thirds), consensus, consensus-minus-N, and consent (no paramount
objection). A decision rule SHALL optionally declare a fallback rule to escalate to when the primary
rule is blocked.

#### Scenario: Consensus blocked by a reasoned objection
- **WHEN** a consent/consensus proposal receives a paramount objection that the rule treats as blocking
- **THEN** the proposal SHALL NOT pass under the primary rule

#### Scenario: Escalation to a fallback rule
- **WHEN** a consensus rule with a two-thirds fallback is blocked
- **THEN** the system SHALL evaluate the outcome under the two-thirds fallback rule

### Requirement: Eligibility gating

The system SHALL restrict who may cast a counted vote based on the method's eligibility axis,
including an option that limits voting power to members who have completed a required training/quiz
gate.

#### Scenario: Trained-only eligibility
- **WHEN** a method requires the trained eligibility gate and an untrained member attempts to vote
- **THEN** the member's vote SHALL NOT be counted toward the outcome

### Requirement: Consent ballots carry reasoned objections and stand-asides

When the ballot axis is consent, the system SHALL allow an objection to carry a structured
justification, and the decision rule SHALL be able to distinguish a paramount (blocking) objection
from a non-blocking one. A consent ballot SHALL also support a **stand-aside** position (the member
does not consent but does not block), which the tally SHALL count as non-blocking.

#### Scenario: Objection with justification
- **WHEN** a member objects on a consent ballot and provides a justification
- **THEN** the objection and its justification SHALL be recorded and made available to the tally and to a facilitator

#### Scenario: Stand-aside does not block
- **WHEN** a member stands aside on a consent ballot
- **THEN** the proposal SHALL NOT be treated as blocked solely because of that stand-aside

### Requirement: Explicit outcome states

The tally SHALL resolve a proposal to exactly one top-level outcome state from: passed, failed,
blocked, tie, quorum-not-met, indeterminate, provisional, and recorded. The system SHALL NOT
collapse these into a single "closed" result, because different outcomes drive different
notifications and pipelines. For multi-outcome ballots the top-level outcome MAY be `recorded` while
each result entry resolves its own outcome.

#### Scenario: Quorum not met
- **WHEN** a proposal closes and the method's quorum requirement is not satisfied
- **THEN** the outcome SHALL be `quorum-not-met` and SHALL NOT be reported as `passed` or `failed`

#### Scenario: Blocked by a sustained objection
- **WHEN** a consensus/consent proposal closes with an unresolved paramount objection
- **THEN** the outcome SHALL be `blocked`

#### Scenario: Provisional outcome pending an objection window
- **WHEN** a proposal passes its voting phase but the method defines an async objection window
- **THEN** the outcome SHALL remain provisional and SHALL finalize to `passed` only if the window expires with no blocking objection

### Requirement: Vote mutability bounded by phase

A method SHALL declare whether a member may change or retract a vote while the relevant phase is
open. When mutable, the recorded vote SHALL be the member's last vote at phase close; when not, the
first vote SHALL stand and later attempts SHALL be rejected.

#### Scenario: Changing a vote while voting is open
- **WHEN** a method allows mutability and a member recasts a vote before the voting phase closes
- **THEN** the later vote SHALL replace the earlier one in the tally

#### Scenario: Vote attempt after phase close
- **WHEN** a member attempts to cast or change a vote after the relevant phase has closed
- **THEN** the attempt SHALL be rejected and the tally SHALL be unaffected

### Requirement: Visibility has tally-timing and voter-identity sub-axes

The system SHALL treat tally-reveal timing (live / on-close / hidden-forever) and voter-identity
exposure (open ballot vs. secret ballot) as independent settings. Secret-ballot identity SHALL be
stored server-side for eligibility and mutability but SHALL NOT be exposed to other members.

#### Scenario: Secret ballot hides identity but allows on-close tally
- **WHEN** a method is configured secret-ballot with on-close tally
- **THEN** members SHALL see the aggregate result after close but SHALL NOT see how any individual voted

#### Scenario: Hidden-forever tally
- **WHEN** a method is configured hidden-forever
- **THEN** the aggregate tally SHALL NOT be revealed to members at any point, while remaining available to a facilitator as required to run the method

### Requirement: Multi-question (Common Ground) ballots with configurable contribution

The `multi-question` ballot SHALL present several sub-questions, each tallied independently. The
method SHALL configure who may contribute sub-questions (proposer, or members) and in which phase
(at creation, or during deliberation). The sub-question set SHALL be frozen when the voting phase
opens, so that every counted question received equal exposure.

#### Scenario: Member contributes a sub-question during deliberation
- **WHEN** a method allows member contribution during deliberation and a member adds a sub-question before voting opens
- **THEN** the sub-question SHALL be included in the ballot for all voters

#### Scenario: Contribution rejected after voting opens
- **WHEN** a member attempts to add a sub-question after the voting phase has opened
- **THEN** the system SHALL reject it and the ballot question-set SHALL remain unchanged

#### Scenario: Each sub-question tallied independently
- **WHEN** a multi-question proposal closes
- **THEN** the result SHALL report a per-sub-question tally rather than a single combined winner

### Requirement: Tally produces a result-set, not a single winner

A module's tally output SHALL be modeled as a result-set so that single-winner, pass/fail,
per-sub-question, and (in future) multi-winner/proportional outcomes are all representable without
changing the storage shape.

#### Scenario: Single-winner result
- **WHEN** a single-choice proposal closes
- **THEN** the result-set SHALL contain the one winning choice and its supporting statistics

#### Scenario: Multi-outcome result
- **WHEN** a multi-question proposal closes
- **THEN** the result-set SHALL contain one entry per sub-question

### Requirement: Methods declare honored configuration knobs

Each method SHALL declare which configuration knobs it honors (e.g. quorum, pass threshold,
deliberation time, voting window, vote mutability, ballot secrecy, tally-reveal timing,
stop conditions). The system SHALL reject a proposal configured with a knob the chosen method does
not honor, or with an internally contradictory combination.

#### Scenario: Unsupported knob rejected
- **WHEN** a method that does not support quorum is configured with a quorum requirement
- **THEN** the system SHALL reject the configuration with an explanatory error

#### Scenario: Quorum honored
- **WHEN** a method that supports quorum is configured with a 50% quorum and participation is below 50% at close
- **THEN** the outcome SHALL be `quorum-not-met`
