## ADDED Requirements

### Requirement: Separate rationale from the proposal body
A proposal SHALL support an optional rationale distinct from its body. The body is the exact text put
to a vote; the rationale is explanatory context. Both SHALL accept markdown.

#### Scenario: Authoring a rationale
- **WHEN** a proposer fills in the Proposal body and an optional Rationale
- **THEN** both are saved, and the detail page shows the body with the rationale revealed on demand

#### Scenario: Rationale is optional
- **WHEN** a proposer submits a proposal without a rationale
- **THEN** the proposal is created and no rationale section is shown

### Requirement: Markdown editing and safe rendering
The Proposal and Rationale fields SHALL provide a markdown editor (at minimum: heading, bold, italic,
link) with a preview, and rendered markdown SHALL be sanitized before display.

#### Scenario: Formatting with the toolbar
- **WHEN** a proposer applies bold/italic/heading/link via the editor toolbar and toggles Preview
- **THEN** the preview renders the formatted markdown

#### Scenario: Rendered markdown is sanitized
- **WHEN** a proposal body containing a script or event-handler attribute is rendered
- **THEN** the dangerous markup is stripped and not executed

### Requirement: Smart authoring defaults
Proposal creation SHALL default voting to open now and close after the type's voting days (3 days when
unspecified), and SHALL default the choices to `For` / `Against` / `Abstain` when the type defines no
default choices.

#### Scenario: Default timings
- **WHEN** a proposer opens the create form for a type with no custom voting window
- **THEN** voting-opens defaults to now and voting-closes defaults to three days later

#### Scenario: Default choices
- **WHEN** a proposer creates a single-choice proposal under a type with no default choices
- **THEN** the choices pre-fill to For / Against / Abstain (editable unless locked)

### Requirement: Readable, edit-on-click timeline
The create form SHALL present the proposal timeline (creation, deliberation start/end, voting start,
voting end) as plain readable text, switching a segment to an input only when the proposer chooses to
edit it and the corresponding type field is not locked.

#### Scenario: Viewing then editing the timeline
- **WHEN** the create form loads
- **THEN** the timeline reads as text; clicking Edit on an unlocked segment reveals an input for it

#### Scenario: Locked segment is not editable
- **WHEN** a type locks the voting window and the proposer views the timeline
- **THEN** the voting segment shows no Edit affordance and cannot be changed

### Requirement: Phase-aware status label
The proposal detail page SHALL label status from the lifecycle phase, not the legacy status, so a
not-yet-open proposal does not read "Draft."

#### Scenario: Scheduled proposal
- **WHEN** a proposal's voting has not started but it is published with a future start
- **THEN** the status reads "Deliberation" or "Scheduled", not "Draft"
