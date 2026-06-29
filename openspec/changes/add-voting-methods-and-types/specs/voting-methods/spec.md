## ADDED Requirements

> Note: Requirements touching the Method Module contract and ballot storage are **provisional**
> until Task 1 (Method Module contract pressure-test) resolves; that gate may revise this spec.

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

### Requirement: Method Module registry and contract

The system SHALL provide a first-party Method Module registry. Each module SHALL supply a ballot
schema, a `validateVote` operation, a `tallyVotes` operation, and ballot and results UI. Modules
that change the ballot model, tally, or results UI SHALL be Method Modules and SHALL NOT be modeled
as event-plugins.

#### Scenario: Module validates a vote
- **WHEN** a vote is cast against a proposal whose method uses a given module
- **THEN** the module's `validateVote` SHALL determine whether the vote is accepted or rejected with a reason

#### Scenario: Module tallies an outcome
- **WHEN** a proposal reaches a tally point
- **THEN** the module's `tallyVotes` SHALL compute the outcome and participation statistics for that method

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

The tally SHALL resolve a proposal to exactly one outcome state from: passed, failed, blocked,
tie, quorum-not-met, and indeterminate. The system SHALL NOT collapse these into a single "closed"
result, because different outcomes drive different notifications and pipelines.

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
