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
  editable timeline, smart defaults, default choices, and phase-aware status.
- `proposal-type-defaults`: type-level default values and per-field lock flags (choices, deliberation,
  voting days, visibility), plus type-management UX (settings tab, retired filter, deletion rules).

### Modified Capabilities
<!-- `proposal-types` and `voting-methods` specs live only inside the active change's delta, not yet
     in openspec/specs/, so these are tracked as new capabilities here. -->

## Impact

- **Schema**: `proposal` gains `rationale` (markdown, nullable). `proposal_type_version` gains default
  choices (JSON), default voting seconds, and lock flags for choices/deliberation/voting/visibility
  (plus a default visibility). Migration required.
- **Services**: `createProposal` applies type defaults + enforces locks; `proposal-type-admin-service`
  accepts the new defaults/locks and a `deleteProposalType` (guarded by "no proposals"); `listProposalTypes`
  surfaces defaults for pre-fill.
- **UI**: create-proposal form (markdown editors, timeline, rationale, defaults); proposal detail
  (rationale reveal, phase-aware status, rendered markdown); type settings tab + form (defaults/locks,
  retired filter, delete). New lightweight markdown editor + renderer components.
- **Dependencies**: a small markdown library (render + minimal toolbar) — evaluate in design.
