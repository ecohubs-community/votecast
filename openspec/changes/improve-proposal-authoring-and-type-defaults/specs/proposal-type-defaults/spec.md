## ADDED Requirements

### Requirement: Type-level defaults with optional per-field locks
A proposal type version SHALL carry default values for choices, deliberation days, voting days, and
visibility, and each SHALL have an independent lock flag. An unlocked default pre-fills the create
form; a locked default SHALL be enforced server-side and not overridable by the proposer.

#### Scenario: Unlocked default pre-fills
- **WHEN** a type sets visibility default "members" unlocked and a proposer creates a proposal under it
- **THEN** visibility pre-fills to members and the proposer may change it

#### Scenario: Locked default is enforced
- **WHEN** a type locks the voting window to 7 days and a proposer submits a different window
- **THEN** the server applies the type's 7-day window and ignores the proposer's override

#### Scenario: Default choices not offered for multi-question
- **WHEN** a type uses the multi-question ballot
- **THEN** the type form does not collect default choices

### Requirement: Editing type defaults creates a new version
Changing a type's defaults or locks SHALL create a new immutable type version; existing proposals keep
the version they were created under.

#### Scenario: Changing a default forks a version
- **WHEN** an admin changes a type's default voting days
- **THEN** a new version is created and proposals already pinned to the old version are unaffected

### Requirement: Configurable question contribution for Common Ground
A multi-question type SHALL configure who may add questions (proposer-only or members) and when (at
creation or during deliberation), with a lock. Adding a question SHALL be permitted only in the
configured phase and only before voting opens; the question set SHALL freeze when voting opens.

#### Scenario: Members add questions during deliberation
- **WHEN** a type allows member contribution during deliberation and a member adds a question while the proposal is in deliberation
- **THEN** the question is added to the ballot and a subquestion-added event is emitted

#### Scenario: Contribution rejected after voting opens
- **WHEN** a member attempts to add a question once voting has opened
- **THEN** the system rejects it and the question set is unchanged

#### Scenario: Contribution rejected for an unpermitted user or phase
- **WHEN** a type restricts contribution to the proposer, and a non-proposer member attempts to add a question
- **THEN** the system rejects it

### Requirement: Type management in settings with a retired filter
Proposal types SHALL be managed from a Settings tab, with a filter for active vs. retired types and
retired types hidden by default.

#### Scenario: Retired hidden by default
- **WHEN** an admin opens the types tab
- **THEN** only active types are shown until the retired filter is selected

### Requirement: Deleting a retired type without proposals
The system SHALL allow permanently deleting a type only when it is retired and has no proposals across
any of its versions; otherwise deletion SHALL be disabled with an explanation.

#### Scenario: Delete an unused retired type
- **WHEN** an admin deletes a retired type that has never been used by a proposal
- **THEN** the type and its versions are removed

#### Scenario: Deletion blocked when proposals exist
- **WHEN** a retired type still has proposals pinned to one of its versions
- **THEN** deletion is rejected (and the UI explains why) so history is preserved
