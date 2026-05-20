# VoteCast Design System

A warm-minimal design language for community governance. Quiet, transparent, and approachable — built for real human communities, not crypto-native power users.

This folder is the single source of truth for VoteCast visuals. When you change how something looks, change it **here first** and update the consuming code.

---

## Index

| File | Purpose |
|---|---|
| `tokens.css` | All design tokens (color, type, spacing, radii, shadows, motion) as CSS custom properties. Import once at the top of your global stylesheet. |
| `README.md` | This file — visual foundations, principles, component anatomy. |
| `VOICE_AND_TONE.md` | How VoteCast sounds. Copywriting principles, lexicon, do/don'ts. |
| `preview/` | Small HTML cards used for the Design System tab. Look here for live specimens. |
| `SKILL.md` | Cross-compatible skill manifest (for Claude Code etc.) |

---

## Brand position

VoteCast is **community governance, simplified**. It is for:

- intentional communities (eco-villages, cohousing, cooperatives)
- worker co-ops and small non-profits
- online collectives and digital guilds
- hybrid groups with both online and physical members

The product is **not** a DAO dashboard. It must never feel like a crypto wallet, an admin console, or a corporate enterprise tool.

Three words to keep in mind:

> **Calm. Considered. Collective.**

---

## Principles

1. **Clarity over cleverness.** A first-time voter, on their phone, in a hurry, should still get it.
2. **Quiet UI, loud content.** Chrome recedes. The proposal, the options, and the result are the things that should be loud.
3. **Generous whitespace.** Air is a feature. We'd rather scroll than crowd.
4. **Plain language.** No "stakeholders," no "quorum thresholds," no "delegated voting power." If a member of a community garden can't read it, rewrite it.
5. **One thing per moment.** The hero asks one question. The proposal page has one decision. The ballot has one tap.

---

## Visual Foundations

### Color

Warm, low-saturation neutrals (off-white paper feel) anchor the system. A single brand **accent** (clay terracotta by default) carries all interactive intent — primary actions, the active state, the selected radio.

**Surfaces**
- `--vc-bg` `#faf8f4` — page background. Warm. Never pure white.
- `--vc-bg-2` `#f3efe6` — sunken / tinted (sidebars, inactive tabs)
- `--vc-surface` `#ffffff` — cards, raised surfaces

**Text**
- `--vc-ink` `#1a1612` — headings, primary text. Never pure black.
- `--vc-ink-2` `#4a4338` — body copy
- `--vc-muted` `#8a8174` — metadata, captions

**Accent (clay)**
- `--vc-accent` `oklch(0.62 0.11 45)` — the brand accent. Used for: live status, the selected ballot option, the call-to-action button, the activity bar.
- `--vc-accent-soft` 8% tint — subtle highlights (background of selected radio, pulse dot ring)

**Semantic**
- `--vc-success` sage green — completed votes, approved
- `--vc-warning` amber — quorum risk, expiring soon
- `--vc-danger` muted brick — destructive actions only
- `--vc-info` muted blue — neutral info, public-visibility badge

> **Rule:** Outside of the accent and semantic palette, color is never decorative. If you find yourself picking a color "to make it pop," that's the wrong instinct — use weight, scale, or whitespace instead.

### Typography

A pairing of one serif display face and one geometric sans:

- **Display — Instrument Serif.** Used for hero headlines, page H1/H2, card titles. Set in Regular, with the italic variant for emphasis (the *"together"* in `Decisions, made together`).
- **Body — Geist.** Used for everything else. Set at 15px base, 1.55 line-height.
- **Mono — JetBrains Mono.** Reserved for: tags, kicker labels above section titles, IDs (proposal numbers), metadata strips. Always uppercase, tracked +0.04em.

The serif is the **emotional register** — warm, considered, written-by-hand. The sans is the **functional register** — quiet, legible, neutral. Mono signals **structure** (a tag, an ID, a system label).

**Hierarchy**
- `--vc-text-hero` — hero display (clamp 48–88px)
- `--vc-text-3xl` — page H1 (clamp 32–52px)
- `--vc-text-2xl` — section H2 (clamp 28–40px)
- `--vc-text-xl`  — card titles, dialog titles (26px)
- `--vc-text-lg`  — list item titles (22px)
- `--vc-text-md`  — lede / pull paragraphs (17px)
- `--vc-text-base` — body (15px)
- `--vc-text-sm`  — secondary copy, badges (13px)
- `--vc-text-xs`  — mono labels, captions (12px)

### Spacing & layout

Strict 4px base scale. Sections breathe with `--vc-space-11` (clamp 72–140px) for vertical rhythm. Container is 1180px max; horizontal padding scales with viewport via `--vc-pad-x`.

Three sizes only for radii in practice:
- **12px** — interactive list items, ballot options
- **16px** — cards
- **999px** — buttons, badges, avatars (always fully rounded)

The two extremes (`--vc-radius-sm` 6px, `--vc-radius-2xl` 18px) are escape hatches.

### Borders, shadows, depth

- **Borders** carry the heavy lifting. A 1px `--vc-line` hairline is the default container. Hover steps it to `--vc-line-2`.
- **Shadows** are barely-there and warm. `--vc-shadow-md` is the maximum for an interactive hover; `--vc-shadow-lg` is reserved for the hero ballot and modals. Never blue-tinted shadows.
- **No glass / no blur** on regular surfaces. Backdrop-blur only on the sticky nav (and only ~10px).

### Iconography

VoteCast prefers **typographic and structural cues** over icons. The product is text-first; most "icons" are actually:

- A circle (radio button, status pulse dot, avatar)
- A bar (vote percentage, activity)
- A mono tag (`Proposal · 014`)

When a glyph is truly needed, use **Lucide** (CDN: `https://unpkg.com/lucide@latest`) at 1.5px stroke. Match the type weight. Never mix icon libraries.

**No emoji in product UI.** They break the calm. Reserve emoji for human-authored content (proposal descriptions, member display names) — not for system chrome.

### Imagery

The product is largely image-free by design. When a community needs visual identity, we use a **monogram thumbnail** (first two letters of the community name, set in Instrument Serif on a warm tinted square). Community uploads are deferred to v2.

If a marketing surface needs imagery, prefer:
- Photography over illustration
- Real communities over stock
- Natural light, warm temperature
- Documentary framing — not staged

Never use stock business photography, "diverse hands on a table," or AI-generated faces.

### Motion

Motion is functional, not decorative.

- Default transition: `var(--vc-duration-fast)` (120ms) with `var(--vc-ease)`
- Settle animations (a vote committing, a result bar filling): `var(--vc-duration-slow)` (320ms) with `var(--vc-ease-out)`
- The live-status pulse is 1.8s, even rhythm
- No bounce, no overshoot, no spring physics
- Reduce-motion: every animation must respect `prefers-reduced-motion`

### Hover & press states

- **Hover** on a card: border darkens (`--vc-line` → `--vc-line-2`), 2px upward translate, the soft `--vc-shadow-md` appears.
- **Hover** on a button: background shifts warmer (primary → ink mixed with 12% accent; accent → `--vc-accent-strong`).
- **Press** on a button: `translateY(1px)` — that's it. No scale, no glow.
- **Focus**: 2px solid `--vc-accent` outline at 2px offset. Visible, not aggressive.

### Layout rules

- Single column on mobile, two-column hero from 1020px+, three-column card grid from 900px+.
- Section padding (`--vc-space-11`) defines vertical rhythm. **Resist** the urge to put a divider between every section — whitespace is the divider.
- The sticky nav is the only fixed UI. No floating action buttons, no sticky CTAs.

---

## Components (anatomy summary)

These are the standardized building blocks. See `preview/` for live specimens.

### Button

Three variants:
- **Primary** — ink fill, used for the single most important action on the page.
- **Accent** — clay fill, used for *commit* actions (Submit vote, Get started, Create community).
- **Ghost** — transparent with a border, used for secondary actions.

Size: default `10px / 18px`, large `14px / 24px`. Always fully rounded.

### Badge

Status pill, 11px font, fully rounded. Variants for the four proposal lifecycle states (draft, active, closed, upcoming). The `active` variant has a pulsing accent dot.

### Card

White surface, 16px radius, 1px line border, 24px internal padding. Hover lifts 2px and reveals the soft warm shadow.

The **community card** has a 44px monogram thumbnail, display-face title, two-line description clamp, and a mono metadata foot.

### Ballot option

The most important component in the product. A 12px-radius button-styled list item:
- Idle: 1px line border, transparent fill
- Hover: line-2 border
- Selected: accent border, 8% accent fill, filled radio dot

When results are visible, a horizontal accent bar fills behind the option in proportion to the vote share. The bar animates in over 500ms with `--vc-ease-out`.

### Eyebrow

Small mono uppercase label above a section title. Always paired with a display-face H2 below.

### Avatar

Fully rounded square (the radius is 999px so any size becomes a circle). Ink background, off-white text, two-character initials.

---

## Implementation guide for the Svelte app

1. Copy `tokens.css` into `src/lib/design-system/tokens.css`.
2. Import it at the top of `src/routes/layout.css`:

   ```css
   @import 'tailwindcss';
   @import '../lib/design-system/tokens.css';
   ```

3. Refactor inline Tailwind class soups against tokens. Examples:
   - `bg-blue-600` → `background: var(--vc-accent)` (or a `.vc-btn--accent` class)
   - `text-gray-900` → `color: var(--vc-ink)`
   - `text-gray-600` → `color: var(--vc-ink-2)`
   - `border-gray-200` → `border-color: var(--vc-line)`
   - `rounded-md` → `border-radius: var(--vc-radius-md)`

4. Migrate fonts: load Instrument Serif + Geist via the `@import` in `tokens.css`, or self-host them via `src/lib/assets/fonts/`.
5. Build Svelte components (`Button.svelte`, `Badge.svelte`, `Card.svelte`, `BallotOption.svelte`) that internalize the design rather than re-deriving it at call sites.

---

## Caveats / open questions

- **Fonts via Google CDN.** Self-hosting is recommended for production. Drop WOFF2 files into `assets/fonts/` and update the `@font-face` block.
- **Dark mode** is not specified yet. The warm palette translates well to a charcoal mode but needs token work — flag if/when it's needed.
- **The clay accent is the default.** Sage / indigo / ink are exposed in the prototype Tweaks panel but haven't been adopted as official alternates. Talk to design before shipping a non-clay surface.
