## Why

Hands-on testing of the new voting-methods feature surfaced authoring rough edges: the create-proposal
form is bare (no rationale, confusing defaults, plain textareas, a date-picker timeline instead of a
readable one), and proposal **types** can only carry a method — communities can't set/lock the
defaults (choices, timings, visibility) that make a type genuinely "ready to use." This change makes
proposing fast and clear, and makes types real templates.

This builds on the archived/active `add-voting-methods-and-types` change; it does **not** redo the
voting engine — only the authoring UX and the type-defaults layer on top of it.

## What Changes

**Proposal authoring (create + detail):**
- Add an optional **Rationale** field (separate from the Proposal body) — the body is exactly what is
  voted on; rationale is the explanatory "why," revealed on click.
- **Markdown editors** for Proposal and Rationale — minimum: heading, bold, italic, link; ideally
  table, image, horizontal rule; plus a **Preview** toggle.
- Relabel the body field **"Context" → "Proposal."**
- **Defaults:** voting opens **now**, voting closes **+3 days** (or the type's configured voting days).
- A readable **timeline** (creation · deliberation start/end · voting start · voting end) shown as
  plain text, each editable only after clicking **Edit** (not raw date inputs by default).
- Default **choices** = `For` / `Against` / `Abstain` when the type defines none.
- **Phase-aware status** on the detail page: a scheduled (not-yet-open) proposal reads "Scheduled"/
  "Deliberation," not "Draft" (the 1b confusion).
- **Show the voting method/type** on the proposal detail page so voters know how it's decided.

**Ballot-family-aware authoring + display (fix Common Ground):**
- The create form SHALL adapt to the type's ballot family: single-choice/consent collect **choices**;
  **multi-question (Common Ground)** collects **questions**, each with its own positions
  (agree/disagree/abstain) via a dedicated questions control — not flat "choices" (which today
  produces broken multi-question ballots).
- The proposal detail SHALL render per family: a consent/single-choice ballot as today; a Common
  Ground ballot as **per-question positions** (not a single flat choice list).
- **Deliberation-time question contribution** (the original design D10, never built): the type
  configures **who** may add questions (proposer-only / members) and **when** (at creation / during
  deliberation), with a lock; the question set **freezes when voting opens**. The proposal detail
  gains a deliberation-phase UI to add a question when permitted (emits `subquestion.added`).

**Proposal types as templates (defaults + locks):**
- Move type management into a **Settings tab** (not a hard-to-find button).
- **Active/Retired filter**, retired hidden by default; allow **deleting** a retired type with no
  proposals (disabled with a tooltip otherwise — keep history when proposals exist).
- Type-level **defaults, each optionally lockable** (locked = proposer cannot change; unlocked =
  pre-fill only): **choices** (not for multi-question), **deliberation days**, **voting days**,
  **visibility** ("who can see it").

## Capabilities

### New Capabilities
- `proposal-authoring`: the create/edit proposal experience — rationale, markdown editing, readable
  editable timeline, smart defaults, default choices, phase-aware status, showing the method, and
  **ballot-family-aware** ballot input/display (choices vs. Common Ground questions).
- `proposal-type-defaults`: type-level default values and per-field lock flags (choices, deliberation,
  voting days, visibility, **question-contribution who/when**), plus type-management UX (settings
  tab, retired filter, deletion rules).

### Modified Capabilities
<!-- `proposal-types` and `voting-methods` specs live only inside the active change's delta, not yet
     in openspec/specs/, so these are tracked as new capabilities here. -->

## Impact

- **Schema**: `proposal` gains `rationale` (markdown, nullable). `proposal_type_version` gains default
  choices (JSON), default voting seconds, default visibility, lock flags for
  choices/deliberation/voting/visibility, and the **question-contribution** config (who/when + lock).
  Multi-question proposals reuse the existing `ballot_question` + `proposal_choice.questionId` tables.
  Migration required.
- **Services**: `createProposal` applies type defaults + enforces locks, and persists **questions**
  (ballot_question + per-question options) for multi-question ballots; `proposal-type-admin-service`
  accepts defaults/locks + contribution config and a `deleteProposalType` (guarded by "no proposals");
  a guarded `addSubquestion` (deliberation-phase, permission-checked, frozen at voting-open).
- **UI**: create-proposal form (markdown editors, timeline, rationale, defaults, **family-aware
  ballot input**); proposal detail (rationale reveal, phase-aware status, rendered markdown, **shown
  method**, **per-question display**, deliberation add-question control); type settings tab + form
  (defaults/locks, contribution config, retired filter, delete). New markdown editor + renderer +
  a questions-editor component.
- **Dependencies**: a small markdown library (render + minimal toolbar) — evaluate in design.
