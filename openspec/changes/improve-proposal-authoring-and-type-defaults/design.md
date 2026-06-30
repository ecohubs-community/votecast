## Context

Follows `add-voting-methods-and-types` (method/type/phase engine already shipped). Proposals pin a
`proposal_type_version` whose `methodSnapshotJson` holds the method; types currently carry only the
method + deliberation seconds. This change adds an **authoring UX** and a **type-defaults/locks**
layer. No change to the tally engine or phase model.

## Goals / Non-Goals

**Goals:** fast, clear proposal authoring (rationale, markdown, readable timeline, smart defaults);
types as real templates (default + lockable choices/timings/visibility); discoverable, manageable
type settings (tab, retired filter, deletion).

**Non-Goals:** changing voting methods/tally/phase logic; rich collaborative editing; a full WYSIWYG
suite; per-proposal method-axis "advanced override" UI (tracked in the prior change).

## Decisions

### D1 — Markdown: store raw, render sanitized; minimal toolbar over a textarea
Store raw markdown in the DB. Render with a small lib (e.g. `marked`) + sanitizer (e.g. DOMPurify) —
**must sanitize** (proposals are user content shown to others). The editor is a plain `<textarea>`
with a toolbar that inserts markdown tokens (bold/italic/heading/link; table/image/hr as plus) and a
**Preview** toggle that renders the same pipeline. Keep it a small reusable `MarkdownEditor` +
`Markdown` (render) component. **Alternative considered:** a full rich-text/WYSIWYG editor → rejected
as overkill and a large dependency; markdown round-trips cleanly and is diff-friendly for versioned
proposals.

### D2 — Rationale is a separate nullable column, not part of the body
`proposal.body` stays "the thing voted on"; add `proposal.rationale` (markdown, nullable). The detail
page reveals rationale on click. Keeps the ballot text unambiguous (a real community concern).

### D3 — Timeline is derived + read-only by default, edit-on-click
The create form shows a computed timeline (creation = now · deliberation window from the type ·
voting start · voting end) as text. Each segment switches to a `datetime-local`/number input only when
**Edit** is clicked, and only if the corresponding type field is **unlocked**. Voting start defaults
to now (or after deliberation); voting end = start + type voting-days (default 3). **Alternative:**
always-on date inputs (current) → rejected; noisy and the source of the "opens in 4h" confusion.

### D4 — Type defaults + per-field locks live on the type *version* (immutable, D4 of prior change)
Extend `proposal_type_version` with: `defaultChoicesJson` (nullable), `votingSeconds` (default 3d),
`defaultVisibility`, and lock booleans `lockChoices` / `lockDeliberation` / `lockVoting` /
`lockVisibility`. Locked field ⇒ the proposer cannot change it (the form disables it and the server
re-asserts). Unlocked ⇒ pre-fill only. Because versions are immutable, editing defaults creates a new
version (consistent with the prior change). **Server is authoritative:** `createProposal` ignores
attempts to override a locked field rather than trusting the client.

### D5 — Type deletion vs. retire
Keep retire/restore. Add **hard delete** allowed only when the type is retired **and** has zero
proposals across all its versions (preserve history otherwise). UI disables the delete button with a
tooltip explaining why when proposals exist. **Alternative:** always allow delete → rejected; would
orphan/whittle the audit trail of decided proposals.

### D6 — Phase-aware status label
The detail-page badge maps from `phase` (not legacy `status`): draft→"Draft", deliberation→
"Deliberation", voting→"Voting open", objection-window→"Objection window", finalized→"Closed".
Resolves the "Draft while it says opens in 4h" confusion (1b). Pure display; no data change.

### D7 — Ballot input/display is family-aware (fixes Common Ground)
The create form and detail page branch on the type's **tally family**. `count`/`consent` collect and
render **choices** (as today). `multiQuestion` collects **questions**, each with its own positions
(default agree/disagree/abstain), via a questions-editor, and persists them to the existing
`ballot_question` (+ `proposal_choice.questionId`) tables — so `tallyProposal`'s multi-question path
actually has data. Detail renders per-question position tallies, not a flat choice list. **Alternative
considered:** keep one flat "choices" control for all families → rejected; it silently produces
unusable multi-question ballots (the reported bug).

### D8 — Question contribution: config on the type, enforced by phase, frozen at voting-open
Implements the original change's D10 (designed, never built). The type version carries
`questionContributors` (`proposer` | `members`) and `questionContributionPhase` (`creation` |
`deliberation`) with a lock. A new `addSubquestion(proposalId, userId, …)` service enforces: the
proposal's ballot is multi-question, the phase is the configured contribution phase (and not past
voting-open — the set **freezes** when voting opens), and the user is permitted (proposer, or any
member when `members`). It emits `subquestion.added`. The detail page shows an "Add a question"
control only during the contribution window for permitted users. **Why freeze at voting-open:** a
question added mid-voting would get uneven exposure (the late-statement problem).

### D9 — Show the resolved method on the detail page
The detail load resolves the proposal's method (via the pinned version / `resolveMethodContext`) and
the page shows a compact summary (type name + ballot · rule, e.g. "Constitutional — consent · consensus").
Read-only; no data change.

## Risks / Trade-offs

- **Markdown XSS** → MUST sanitize rendered HTML (DOMPurify or equivalent); never `{@html}` raw output.
- **Locked-field bypass** → server re-validates/ignores locked overrides; never trust the form alone.
- **Default-choices vs multi-question** → default choices are meaningless for multi-question ballots;
  the type form hides/ignores them for that family.
- **Migration of existing type versions** → back-fill new columns with sane defaults (voting 3d,
  visibility on-close, no locks, no default choices) so existing types keep working.
- **Bundle size** of the markdown lib → pick a small one; lazy-load the editor toolbar if needed.

## Migration Plan

Add the `proposal.rationale` column and the `proposal_type_version` default/lock columns; back-fill
existing versions (votingSeconds = 3d, defaultVisibility = on-close, locks = false, defaultChoices =
null). New migration; additive, no destructive change.

## Open Questions

- Which markdown lib (marked + DOMPurify vs. a combined micro-lib)? Decide at apply time by bundle size.
- Should "voting days" replace the explicit end-time entirely, or coexist as a default the proposer can
  still override with an absolute end? (Lean: type sets days; proposer edits absolute end when unlocked.)
- Phase-aware status: reuse `StatusBadge` (extend its enum) or a new `PhaseBadge`?
