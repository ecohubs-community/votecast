# VoteCast Voice & Tone

How VoteCast sounds — in product UI, in marketing copy, in error messages, in emails.

---

## Voice (constant)

VoteCast speaks like a **trusted neighbor who's good at organizing.** Calm, plain-spoken, lightly warm. Treats the reader as capable. Doesn't perform expertise; doesn't perform empathy either.

Three adjectives that should always describe our voice:

| Adjective | What it means |
|---|---|
| **Plain** | One-syllable words when one-syllable words will do. We never write "utilize" when we mean "use." |
| **Warm** | We're a tool for communities, not a corporation. A little humanity goes a long way — but we never crack jokes about real decisions. |
| **Considered** | We pause before we speak. Sentences are short, but not curt. We assume the reader is thinking about something important. |

### Three adjectives we are not:

| Not this | Because |
|---|---|
| **Casual** | We're not a chat app. We're a tool people use to make real decisions together. No "Yo," no "Heyyy," no exclamation salads. |
| **Corporate** | No "stakeholders," no "leverage," no "best-in-class." If a sentence could be on a B2B SaaS landing page, rewrite it. |
| **Technical** | We're not a crypto governance platform. No "quorum," "delegation," "snapshot," "treasury," "voting power" — unless we're literally documenting an API. |

---

## Tone (varies with context)

Voice is constant; tone moves with the moment.

| Context | Tone | Example |
|---|---|---|
| Landing hero | **Reflective** | "Decisions, made together." |
| Empty state | **Encouraging, not chirpy** | "No proposals yet." (Not "Nothing here yet! 🌱 Be the first to start a conversation!") |
| Success after voting | **Quiet acknowledgement** | "Your vote has been recorded." (Not "🎉 You voted! Great job!") |
| Validation error | **Direct + helpful** | "Pick at least two voting options." (Not "Oops! Looks like we need more options 😅") |
| Destructive confirmation | **Serious, but not alarmed** | "Delete this proposal? Members who've voted will keep their record." (Not "Are you sure?? This can't be undone!!!") |
| Marketing CTA | **Inviting, low pressure** | "Get started" / "Open my communities." (Not "Sign up free!" or "Join 10,000+ communities.") |
| Help / docs | **Patient, exact** | "Voting closes at the end time you set. After that, results are visible to everyone who can see the proposal." |

---

## Principles

### 1. Plain words, short sentences

Default to the simplest word that's still accurate.

| Don't write | Write |
|---|---|
| Utilize | Use |
| Initiate a proposal | Open a proposal |
| Cast a ballot | Vote |
| Community members | Members |
| Authentication | Sign in |
| Visibility settings | Who can see this |
| Threshold | Minimum |
| Configure | Set up |

Sentences in body copy: **aim for under 20 words.** If you need a comma three times, you need a period.

### 2. Address the reader as "you"

VoteCast says "you," never "the user." The product is for the person reading.

Refer to ourselves as **"we"** only when we're explaining what the platform does ("We send your invite by email"). Most of the time we don't need to be in the sentence at all.

### 3. Sentence case everywhere

Including headings, buttons, and modal titles.

- ✅ "Create a community"
- ❌ "Create A Community"
- ❌ "Create Community" (acceptable in a tight button, but sentence case wins when there's space)

### 4. No emoji in product UI

Emoji are reserved for **human-authored content** (proposal text, member display names, descriptions). Never in our own system copy. They break the calm.

The single exception: if a community has explicitly named itself with an emoji, we render it as written.

### 5. Avoid governance jargon

We're a tool for human communities. Default to the most-readable term, even if a "more correct" one exists.

| Don't write | Write |
|---|---|
| Quorum threshold | Minimum vote count |
| Delegated voting power | (out of scope for MVP — don't introduce) |
| Token-weighted vote | (out of scope for MVP) |
| Stakeholder | Member |
| Governance forum | Community |
| Voting period | When voting is open |
| Snapshot at block height | (don't expose this) |

If we ever need a power-user term in an API doc, define it on first use.

### 6. Active voice, present tense

- ✅ "Voting closes Friday at 5pm."
- ❌ "Voting will be closed on Friday at 5pm."
- ✅ "Your vote has been recorded." *(passive here is fine — it puts the result first.)*
- ✅ "Three members voted yes."
- ❌ "Yes received three votes."

### 7. Numbers and time

- Numerals for counts: "3 members," not "three members." (Below 10 is otherwise tricky — but in UI we always want numerals.)
- Plural rules apply: "1 vote" / "2 votes," "1 day left" / "2 days left."
- Relative time for recent activity: "2 days ago," "in 4 hours," "just now." Absolute date when older than a week: "May 14, 2026."

### 8. Don't shout, don't whisper

- Don't end sentences with exclamation marks. (Confirmation toasts especially.)
- Don't trail off with ellipses, except when literally indicating progress: "Submitting…"
- Don't use ALL CAPS for emphasis. (Mono labels above section titles are the only uppercase in the product.)

---

## Lexicon

The canonical names for things in the product. Use these everywhere.

| Concept | Canonical | Notes |
|---|---|---|
| The vote-able item | **Proposal** | Never "motion," "issue," "ballot item." A ballot is the *form* you fill out; a proposal is what's being decided. |
| The act of voting | **Vote** (verb), **vote** (noun) | "Submit your vote," "your vote is locked." |
| The choices on a proposal | **Options** | Not "answers," not "candidates." |
| A group of people who govern together | **Community** | Not "DAO," not "org," not "workspace." |
| A person in a community | **Member** | Not "user" in member-facing copy. ("User" is fine in API docs.) |
| The person who created a community | **Admin** | Not "owner," not "moderator." (Plural admins are fine.) |
| The person who wrote a proposal | **Author** | Or "the member who created it." |
| The four states of a proposal | **Draft → Active → Closed**, plus **Upcoming** for scheduled-but-not-started | These are the only four. |
| A way to add someone to a community | **Invite link** | Not "magic link," not "share link." |
| The screen where you vote | **Proposal page** | Not "ballot page," not "voting screen." |
| Verification of community legitimacy | **Verified community** | The opposite is "unverified" — never "free tier" or "limited." |

---

## Microcopy patterns

### Empty states

Three short lines max. Title (sentence case, no period). One sentence of context. One action.

```
No proposals yet.
Start the first one when your community is ready to decide something.
[Create a proposal]
```

### Confirmation after action

Past tense, sentence case, no exclamation. Brief.

- "Your vote has been recorded."
- "Invite link copied."
- "Community created."
- "Proposal closed."

### Errors

Lead with what happened. Then how to fix it. Never blame the reader. Never apologize.

- ✅ "This invite link has expired. Ask an admin for a new one."
- ❌ "Oops! Something went wrong. Please try again."
- ✅ "Pick at least two voting options."
- ❌ "Error: minimum 2 options required."

### Destructive confirmations

Name the consequence. Use the verb in the confirm button.

```
Delete this proposal?
Votes already cast will be kept in the record.
[Cancel]  [Delete proposal]
```

Not: `[Cancel] [OK]`.

### Loading

"Loading…" is fine. "Submitting…" is better when you know what's happening. Never spinners with no text on the primary path.

---

## CTA library

Approved primary CTAs by context:

| Context | CTA |
|---|---|
| Logged-out hero | **Get started** |
| Logged-in hero | **Open my communities** |
| Empty community list | **Create a community** |
| Inside a community | **Create a proposal** |
| Inside a proposal (vote available) | **Submit vote** |
| Inside a proposal (already voted) | (no button — show a quiet "Your vote is locked." line) |
| Invite redemption | **Join [Community Name]** |

---

## Voice anti-patterns (don't ship these)

| Anti-pattern | Example | Why it fails |
|---|---|---|
| Empty enthusiasm | "Welcome aboard! 🎉" | We're a governance tool. Restraint reads as respect. |
| False humility | "Sorry to bother you, but…" | Direct is more respectful. |
| Corporate filler | "We empower communities to…" | Empty promise. We don't empower; we provide a tool. |
| Crypto jargon | "Sign with your wallet to participate in governance." | "Sign in" suffices. Wallet-as-identity is an implementation detail. |
| Self-congratulation | "VoteCast — the simplest governance platform." | Show, don't tell. |
| Future-tense vagueness | "Coming soon!" | Either say *when* or don't say. |
| Cute error messages | "Whoops! That didn't work 😬" | The reader has a real problem. Address it. |

---

## When in doubt

Read the sentence out loud. If it sounds like a corporate landing page, a crypto whitepaper, or an over-friendly chatbot — rewrite it.

If it sounds like a neighbor who's organized a few of these meetings before, you're done.
