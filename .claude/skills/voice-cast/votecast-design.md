---
name: votecast-design
description: Use this skill to generate well-branded interfaces and assets for VoteCast, either for production or throwaway prototypes/mocks. VoteCast is a community governance platform with a warm-minimal aesthetic (off-white, stone neutrals, clay accent, Instrument Serif + Geist typography). Contains design tokens (tokens.css), visual + content guidelines (DESIGN_SYSTEM.md, VOICE_AND_TONE.md), and a set of preview cards demonstrating components.
user-invocable: true
---

Read `DESIGN_SYSTEM.md` first for the visual foundations and component anatomy, then `VOICE_TONE.md` before writing any copy. `tokens.css` is the source of truth for every color, type size, radius, shadow, and spacing value — consume it instead of redeclaring values.

If creating throwaway visual artifacts (mocks, slides, prototype HTML), copy `tokens.css` and the relevant preview files into the artifact's folder and import them.

If editing the production Svelte app (the codebase the system was extracted from), import `tokens.css` into `src/lib/design-system/tokens.css` and reference tokens directly in component CSS — don't reach for raw hex values or Tailwind color classes.

When the user invokes this skill without context, ask what they're building (which surface — landing, community page, proposal page, settings, marketing site), confirm whether it's a prototype or production change, and proceed as an expert designer.

Three rules that should never be violated:

1. **No emoji in product UI chrome.** They break the calm tone of the brand. (Exception: human-authored content.)
2. **No governance jargon.** "Members," "votes," "proposals," "communities" — never "stakeholders," "quorum," "delegation," "snapshot."
3. **Single accent.** `--vc-accent` is the only brand accent. Don't introduce new ones; use scale, weight, and whitespace for hierarchy.
