## 1. Schema & migration

- [ ] 1.1 Add `proposal.rationale` (text, nullable, markdown)
- [ ] 1.2 Extend `proposal_type_version`: `defaultChoicesJson` (nullable), `votingSeconds` (default 3d), `defaultVisibility` (enum, default 'community'/'public'), and locks `lockChoices`/`lockDeliberation`/`lockVoting`/`lockVisibility` (bool default false)
- [ ] 1.3 Generate migration; back-fill existing versions (votingSeconds=3d, locks=false, defaultChoices=null); apply to local.db

## 2. Markdown editor + renderer

- [ ] 2.1 Pick a small markdown lib + sanitizer (design D1); add dependency
- [ ] 2.2 `Markdown.svelte` — render sanitized markdown (no raw `{@html}`)
- [ ] 2.3 `MarkdownEditor.svelte` — textarea + toolbar (heading/bold/italic/link; table/image/hr as plus) + Preview toggle; svelte-autofixer clean
- [ ] 2.4 Unit-test the sanitizer strips scripts/handlers

## 3. Type defaults & locks (backend)

- [ ] 3.1 `proposal-type-admin-service`: accept defaults + locks on create/addTypeVersion; validate (no default choices for multi-question)
- [ ] 3.2 `deleteProposalType` — allowed only when retired AND zero proposals across all versions; else error
- [ ] 3.3 `listProposalTypes` summary surfaces defaults + locks for pre-fill/enforcement
- [ ] 3.4 `createProposal` applies type defaults and **enforces locks server-side** (ignore locked overrides)
- [ ] 3.5 Tests: lock enforcement, default application, delete-guard, default-choices-vs-multi-question

## 4. Create-proposal UX

- [ ] 4.1 Relabel "Context" → "Proposal"; add optional Rationale (reveal on click); both use `MarkdownEditor`
- [ ] 4.2 Defaults: voting opens now, closes +type voting days (3 default); default choices For/Against/Abstain when unset
- [ ] 4.3 Readable edit-on-click timeline (creation · deliberation · voting start · voting end); hide Edit on locked segments
- [ ] 4.4 Disable/hide inputs for locked type fields; pass rationale + resolved timings to `createProposal`
- [ ] 4.5 svelte-autofixer clean

## 5. Proposal detail UX

- [ ] 5.1 Render body + rationale (reveal-on-click) via `Markdown`
- [ ] 5.2 Phase-aware status label (phase → Draft/Deliberation/Voting open/Objection window/Closed) — extend `StatusBadge` or add `PhaseBadge`
- [ ] 5.3 svelte-autofixer clean

## 6. Type settings UX

- [ ] 6.1 Move type management into a Settings **tab** (not a button)
- [ ] 6.2 Active/Retired filter; retired hidden by default
- [ ] 6.3 Type form: default choices (hidden for multi-question), deliberation days, voting days, visibility — each with a lock checkbox
- [ ] 6.4 Delete button: enabled only for retired + no-proposals; disabled with tooltip otherwise
- [ ] 6.5 svelte-autofixer clean

## 7. Verification

- [ ] 7.1 End-to-end: create a type with locked voting window + default choices → create a proposal → verify locks enforced, defaults applied, timeline + markdown render
- [ ] 7.2 Verify a not-yet-open proposal shows a phase-aware status (not "Draft") and no premature outcome
- [ ] 7.3 Full suite + svelte-check + eslint green
