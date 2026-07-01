## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, devtools-json, drizzle, better-auth, mcp

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Project Specs

Read and understand the project specs in the "specs" root folder:

- /specs/01_product_overview.md
- /specs/02_architecture.md
- /specs/03_database_schema.md
- /specs/04_api_spec.md
- /specs/05_events_plugins_hooks.md
- /specs/06_auth_identity.md
- /specs/07_ui_ux_design.md
- /specs/08_dev_rules_conventions.md
- /specs/09_build_instructions_for_ai_agents.md

## Design System

For frontend work please read and understand the design system: 
/design_files/DESIGN_SYSTEM.md

## Styling: Tailwind-first, no ad-hoc CSS

Style with Tailwind utility classes in markup — NOT by adding plain CSS rules. Do NOT add new selector-based rules to `src/routes/layout.css` or reach for a scoped `<style>` block as a shortcut instead of utilities. `layout.css` is only for `@import 'tailwindcss'`, the `@theme` token mapping, and the few shared design-system primitives that already live there (form controls, `avatar`, `brand`, `nav-link`, etc.) — do not grow it with page- or component-specific classes.

When markup would repeat the same utility strings, extract a Svelte component (see `Button`, `Alert`, `Tabs`/`Tab`, `VoteCard`, `MemberRow`, `Page`/`PageHead`/`PageTitle`/`PageSub`/`Breadcrumb` in `src/lib/components/`) rather than adding a CSS class. Reference design tokens via the `@theme` utilities (`bg-accent`, `text-ink`) or arbitrary token refs (`rounded-[var(--vc-radius-xl)]`) — never hard-code hex/oklch values that duplicate a token, and never guess a value where a token exists.


## Voice and Tone

Please read and understand the voice and tone of the voicecast brand when creating new content: 
/design_files/VOICE_TONE.md