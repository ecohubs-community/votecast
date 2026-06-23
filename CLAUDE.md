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

## Voice and Tone

Please read and understand the voice and tone of the voicecast brand when creating new content: 
/design_files/VOICE_TONE.md

## OpenSpec

This project uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for spec-driven development. Before implementing a non-trivial change (new feature, breaking refactor, schema/API change), draft an OpenSpec change first so the spec, design, and tasks are agreed before code is written.

**Folders**
- `/specs/` — the original product specs (01–09). Treat these as authoritative product context — don't edit them as part of a change.
- `/openspec/specs/` — living capability specs that OpenSpec maintains. Updated when a change is archived.
- `/openspec/changes/` — in-flight change proposals (proposal.md, design.md, tasks.md, delta specs).

**Workflow (slash commands, exposed by `.claude/commands/opsx/`)**
- `/opsx:explore` — think through a problem before committing to a change.
- `/opsx:propose <name-or-description>` — scaffold a change with all artifacts.
- `/opsx:apply` — implement the tasks from a change.
- `/opsx:sync` — fold delta specs into the main `openspec/specs/`.
- `/opsx:archive <name>` — finalize a completed change.

**CLI**: invoke via `pnpm dlx @fission-ai/openspec@latest <command>` (e.g. `list`, `view`, `validate`).