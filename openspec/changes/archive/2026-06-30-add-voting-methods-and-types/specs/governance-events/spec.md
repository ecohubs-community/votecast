## ADDED Requirements

> Note: The exact event names and payloads are provisional until Task 3 (event catalog) resolves.

### Requirement: Lifecycle event catalog

The system SHALL emit lifecycle events across a proposal's process, including (at minimum)
deliberation started, voting started, an objection raised, voting closing soon, voting closed, and
an outcome decided. Both notifications and webhook/execution-handler pipelines SHALL be able to
subscribe to these events.

#### Scenario: Voting started emits an event
- **WHEN** a proposal transitions from deliberation to voting
- **THEN** the system SHALL emit a voting-started event that subscribers can react to

#### Scenario: Objection raised emits an event
- **WHEN** a member raises an objection on a consent ballot
- **THEN** the system SHALL emit an objection-raised event

### Requirement: Notifications subscribe to lifecycle events

The system SHALL allow a community to notify members on configured lifecycle events (e.g.
deliberation started, voting started, voting closing soon, results available), subject to the
proposal's visibility policy.

#### Scenario: Members notified when voting opens
- **WHEN** a proposal's voting phase begins and the community has enabled the voting-started notification
- **THEN** eligible members SHALL be notified

#### Scenario: Delivery channel is decoupled from event emission
- **WHEN** a notifiable event occurs and no rich delivery channel (email/push) is configured
- **THEN** the system SHALL still record the notification to its in-app sink so event emission never depends on an external transport

#### Scenario: Hidden tally suppresses result disclosure in notifications
- **WHEN** a proposal closes under a hidden-forever visibility policy
- **THEN** any result notification SHALL NOT disclose the tally to members not permitted to see it

### Requirement: Event-driven side-effect pipelines

The system SHALL allow side-effect actions (webhooks and execution handlers) to be wired to
lifecycle events as an ordered pipeline, reusing the existing webhook and execution-handler
mechanisms. Side-effect plugins SHALL NOT modify core governance rules.

#### Scenario: Outcome triggers an ordered pipeline
- **WHEN** a proposal's outcome is decided and a pipeline is wired to that event
- **THEN** the system SHALL run the pipeline's actions in order (e.g. export the proposal text, then call a follow-up webhook)

### Requirement: External resolver boundary

The system SHALL support delegating a decision to an external resolver hosted by the community via a
published interface, by sending a signed, time-bounded payload of the tally context and reading back
a structured outcome and rationale. The system SHALL NOT execute community-supplied code in-process.

#### Scenario: Delegating an outcome to an external resolver
- **WHEN** a proposal's method delegates to an external resolver and the proposal reaches its tally point
- **THEN** the system SHALL POST the signed tally context to the resolver and apply the returned outcome and rationale

#### Scenario: Data minimization for secret ballots
- **WHEN** the tally context for a secret-ballot proposal is sent to an external resolver
- **THEN** the payload SHALL contain aggregates rather than raw per-member votes unless the community has explicitly opted in to sharing them

#### Scenario: Resolver unreachable
- **WHEN** the external resolver cannot be reached within the timeout
- **THEN** the system SHALL apply the method's defined fallback behavior rather than executing arbitrary code
