# proposal-types Specification

## Purpose

Per-community, user-maintainable proposal **types** that bundle a voting method and an optional
deliberation time. Types are immutably versioned (editing a method forks a new version), proposals
pin the exact version they were created under, and retiring a type preserves in-flight proposals.
Preset types are seeded at community creation so proposing works immediately.

## Requirements

### Requirement: Per-community proposal types

The system SHALL allow each community to maintain its own set of proposal types, where a type binds
a voting method and an optional deliberation time. Communities SHALL be able to create, edit, and
retire types.

#### Scenario: Creating a type
- **WHEN** a community admin creates a type named "Operational" bound to a two-thirds-majority method with a one-day deliberation time
- **THEN** the type SHALL be available for proposers in that community and not in other communities

### Requirement: Preset types seeded at community creation

The system SHALL seed between one and three preset proposal types when a community is created so
that proposing works immediately without configuration.

#### Scenario: New community has usable types
- **WHEN** a new community is created
- **THEN** at least one ready-to-use proposal type SHALL exist for it without any admin setup

### Requirement: Immutable type versioning

Editing a type's method SHALL create a new immutable type version that snapshots the whole method
(all axes plus the deliberation time). Existing type versions SHALL NOT be mutated.

#### Scenario: Editing a method creates a new version
- **WHEN** an admin changes the decision rule of an existing type
- **THEN** the system SHALL create a new version capturing the full updated method and SHALL leave prior versions unchanged

### Requirement: Proposals pin a type version

Every proposal SHALL be created against a specific type version, and the proposal SHALL continue to
be evaluated under that pinned version regardless of later edits to the type.

#### Scenario: In-flight proposal unaffected by type edits
- **WHEN** a proposal is created under type version v1 and the type is later edited to v2
- **THEN** the proposal SHALL continue to use v1's method for eligibility, balloting, and tally

#### Scenario: Proposer selects a type
- **WHEN** a proposer creates a proposal and selects a type
- **THEN** the method and deliberation time SHALL be pre-filled from the type's current version, with an advanced override available per proposal

#### Scenario: Advanced override stores an ad-hoc snapshot, not a new type version
- **WHEN** a proposer overrides method axes for a single proposal
- **THEN** the proposal SHALL store its own method snapshot and SHALL still record the originating type version as provenance, without creating a new version of the shared type

#### Scenario: Override disabled by the type
- **WHEN** a community has disabled overrides on a type and a proposer attempts to override an axis
- **THEN** the system SHALL reject the override and use the pinned type version's method

### Requirement: Retiring a type preserves in-flight proposals

Retiring a type SHALL prevent new proposals from being created under it while leaving existing
proposals to run and finalize under their pinned versions.

#### Scenario: Retired type still resolves pinned proposals
- **WHEN** a type is retired while a proposal pinned to one of its versions is still active
- **THEN** that proposal SHALL continue and finalize normally, and no new proposal SHALL be creatable under the retired type
