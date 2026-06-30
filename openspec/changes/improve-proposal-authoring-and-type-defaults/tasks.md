## 1. Schema & migration

- [x] 1.1 Added `proposal.rationale` (text, nullable, markdown)
- [x] 1.2 Extended `proposal_type_version`: `defaultChoicesJson` (nullable), `votingSeconds` (default 3d), `defaultVisibility` (enum, default 'community'/'public'), locks `lockChoices`/`lockDeliberation`/`lockVoting`/`lockVisibility`, and contribution config `questionContributors` ('proposer'|'members') + `questionContributionPhase` ('creation'|'deliberation') + `lockQuestionContribution`
- [x] 1.3 Generated migration 0005 (additive ALTERs; defaults back-fill existing rows); applied to local.db. Originally: Generate migration; back-fill existing versions (votingSeconds=3d, locks=false, defaultChoices=null, contributors='proposer'/creation); apply to local.db

## 2. Markdown editor + renderer

- [x] 2.1 marked + sanitize-html (server-side render path; tables hand-rolling deemed too fragile). Single `renderMarkdown` in `$lib/server/markdown`
- [x] 2.2 `Markdown.svelte` renders server-sanitized HTML (only ever fed `renderMarkdown` output)
- [x] 2.3 `MarkdownEditor.svelte` — textarea + toolbar (H/B/I/Link/Table/Img/HR) + Preview toggle (POSTs to `/api/markdown`); svelte-autofixer clean
- [x] 2.4 `markdown.test.ts` (7) — strips scripts/handlers/javascript: URLs, hardens links, renders tables/images

## 3. Type defaults & locks (backend)

- [x] 3.1 `proposal-type-admin-service`: `create`/`addTypeVersion` accept a `TypeDefaultsInput` (default choices, voting days, default visibility, locks, question-contribution config), persisted via a shared `buildVersionValues` helper; validates no default choices for multi-question and ≥2 (or none)
- [x] 3.2 `deleteProposalType` — admin-only; allowed only when retired AND no proposal references any version across the type; else `INVALID_REQUEST`
- [x] 3.3 `listProposalTypes` summary surfaces defaults + locks (`TypeVersionDefaults` mixed into `ProposalTypeSummary`); added `getTypeVersionDefaults` for the create path
- [x] 3.4 `createProposal` applies type defaults (pre-fill) and **enforces locks server-side**: locked choices/visibility re-asserted from the type, locked voting window forces `end = start + votingSeconds`; client overrides of locked fields ignored
- [x] 3.5 Tests (proposal-type-admin-service.test.ts, +9 → 14): default persistence + summary surfacing, default-choices-vs-multi-question + single-choice guards, delete-guard (not-retired / has-proposals / clean-delete / non-admin), lock enforcement + unlocked-pre-fill override. Full suite 202 green

## 4. Create-proposal UX

- [x] 4.1 Body label "Context" → "Proposal"; both body and the optional Rationale (reveal-on-click `+ Add rationale`) use `MarkdownEditor`. Rationale plumbed end-to-end: `CreateProposalInput.rationale` → `proposal.rationale`; server action reads/echoes it
- [x] 4.2 Defaults: voting opens now, closes = start + the type's `votingSeconds` (3d default); choices seed from `selectedType.defaultChoices` → For/Against/Abstain fallback
- [x] 4.3 Readable edit-on-click timeline (Created now · Deliberation window from type · Voting opens · Voting closes); each voting segment shows formatted text + Edit, swaps to `datetime-local`, hidden input keeps it submitting. Edit hidden + "set by method" tag on locked segments
- [x] 4.4 Lock-aware form: locked visibility → read-only value + hidden input; locked choices → read-only list + hidden inputs; locked voting → no Edit. Multi-question types hide the choice editor (questions configured post-create). Server still re-asserts every lock (Group 3)
- [x] 4.5 svelte-autofixer clean (writable `$derived` for type-seeded fields; `untrack` for the sticky rationale-reveal). check + lint clean; 202 tests green

## 5. Proposal detail UX

- [x] 5.1 Body + optional rationale rendered as sanitized markdown via `Markdown`. Load renders both server-side (`renderMarkdown` → `bodyHtml`/`rationaleHtml`); rationale is a reveal-on-click disclosure under the body
- [x] 5.2 Phase-aware `StatusBadge` (phase → Draft/Deliberation/Voting open/Objection window/Closed) via `$lib/utils/phase`; migrated ProposalCard + community page + proposal-detail display/voting/results derives off `status` onto `phase`. (Remaining `status` readers before the column can drop: listProposals filter + lifecycle writes + update/execution draft-guards.)
- [x] 5.3 Method summary shown above the dated flow diagram (`{ballotLabel} · {ruleLabel}`); label maps extracted to shared `$lib/utils/method-labels` and reused by `MethodFlow` so wording never drifts
- [x] 5.4 svelte-autofixer clean (MethodFlow + proposal detail); check + lint clean; 202 tests green

## 5b. Common Ground questions (ballot-family-aware)

- [ ] 5b.1 Create-proposal: branch ballot input by family — `QuestionsEditor` for multi-question (questions + per-question positions), choices otherwise; persist to `ballot_question` + `proposal_choice.questionId`
- [ ] 5b.2 Proposal detail: render multi-question ballots per question (positions per question), and the voting UI accordingly
- [ ] 5b.3 `addSubquestion` service — guarded by ballot family, contribution who/when config, and frozen-at-voting-open; emits `subquestion.added`
- [ ] 5b.4 Detail page: "Add a question" control shown only during the contribution window for permitted users
- [ ] 5b.5 Tests: family-aware persistence, contribution permission/phase/freeze enforcement

## 6. Type settings UX

- [ ] 6.1 Move type management into a Settings **tab** (not a button)
- [ ] 6.2 Active/Retired filter; retired hidden by default
- [ ] 6.3 Type form: default choices (hidden for multi-question), deliberation days, voting days, visibility — each with a lock checkbox; for multi-question, the question-contribution who/when config (+ lock)
- [ ] 6.4 Delete button: enabled only for retired + no-proposals; disabled with tooltip otherwise
- [ ] 6.5 svelte-autofixer clean

## 7. Verification

- [ ] 7.1 End-to-end: create a type with locked voting window + default choices → create a proposal → verify locks enforced, defaults applied, timeline + markdown render
- [ ] 7.2 Verify a not-yet-open proposal shows a phase-aware status (not "Draft") and no premature outcome
- [ ] 7.3 Full suite + svelte-check + eslint green
