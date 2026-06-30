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

- [x] 5b.1 Create-proposal branches ballot input by family: a questions editor for multi-question (each question stored with Agree/Disagree/Abstain position-choices), the choices editor otherwise. Persisted to `ballot_question` + `proposal_choice.questionId` via `insertQuestion`; `createProposal` resolves the family and validates ≥1 question. Tally bridged in `tallyProposal` (`buildMqTallyInputs` maps choices→`{questionId, position}` so the existing module/rule run)
- [x] 5b.2 Proposal detail renders multi-question per question (`MultiQuestionBallot`): per-question position voting via `castMultiQuestionVote` (one `vote_selection` per question), the voter's own answers, and per-question agree/disagree result entries when revealed
- [x] 5b.3 `addSubquestion` service — guards ballot family, contribution who/when config, freeze-at-voting-open, and proposer-vs-members permission; emits `subquestion.added`. Non-throwing `canAddSubquestion` drives the UI
- [x] 5b.4 Detail page shows an "Add a question" control only when `canAddSubquestion` (multi-question, deliberation phase, permitted user); `?/addQuestion` action wired
- [x] 5b.5 Tests (`multi-question.integration.test.ts`, 9): family-aware persistence, ≥1-question guard, end-to-end per-question tally, mismatched-selection rejection, and the addSubquestion permission/phase/freeze/creation-only guards. Full suite 216 green

## 6. Type settings UX

- [x] 6.1 Type management moved into a Settings **"Proposal types" tab** (`ProposalTypesPanel`); standalone `/types` route deleted, header button removed. Settings load/actions absorb create/retire/delete
- [x] 6.2 Active/Retired filter ("Show retired" toggle); retired hidden by default
- [x] 6.3 Type form: default choices (hidden for multi-question) + voting days + deliberation days + default visibility, each with a lock checkbox; multi-question swaps in the question-contribution who/when config (+ lock). Parsed into `TypeDefaultsInput` and passed to `createProposalType`
- [x] 6.4 Delete button enabled only for retired + no-proposals, else disabled with an explanatory tooltip; gate sourced from new `getTypeIdsWithProposals` (tested) and re-enforced server-side by `deleteProposalType`
- [x] 6.5 svelte-autofixer clean (panel + settings); check + lint clean; 207 tests green

## 7. Verification

- [x] 7.1 End-to-end test (`verification.integration.test.ts`): a locked-voting + default-choices type → a proposal whose client overrides are ignored (choices re-asserted, `end = start + votingSeconds`) and whose markdown body renders sanitized (heading demoted, link hardened). Timeline render verified in the create UI (writable `$derived` reseed)
- [x] 7.2 End-to-end test: a not-yet-open proposal resolves to a `draft`/`deliberation` phase (never legacy "active") and exposes **no** outcome before voting — even to an admin (`getProposalOutcome.revealed === false`). UI maps phase → label via `StatusBadge`/`$lib/utils/phase`
- [x] 7.3 Full suite **218 green**, svelte-check 0 errors, `eslint src` exit 0
