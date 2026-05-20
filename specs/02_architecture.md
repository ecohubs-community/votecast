# Community Governance Platform — System Architecture

# 1. Purpose of This Document

This document defines the **system architecture** of the Community Governance Platform.

It specifies:

- technology stack
- architectural principles
- system modules
- project structure
- extension systems (strategies, plugins, hooks)
- event architecture
- integration architecture

This document is intended for **developers and AI coding agents** implementing the system.

It describes **how the system is organized**, but does not define database schemas or API endpoints (those are defined in separate specs).

---

# 2. High-Level Architecture

The system follows a **modular monolith architecture**.

A modular monolith allows:

- simpler deployment
- easier development
- strong modular boundaries
- later extraction of services if necessary

The system consists of:

```
Frontend (SvelteKit)
│
▼ Backend API (SvelteKit server routes)
│
▼ Core Governance Engine
│
├── Strategies
├── Plugins
├── Events
├── Execution Hooks
└── Integrations
│
▼ Database (SQLite via Drizzle ORM)
```

---

# 3. Technology Stack

The platform uses a **simple and developer-efficient stack**.

### Frontend

Framework:

- **SvelteKit**

Responsibilities:

- UI rendering
- client interactions
- wallet login flow
- API communication

---

### Styling

CSS Framework:

- **Tailwind CSS**

Goals:

- fast UI development
- consistent design system
- minimal CSS maintenance

---

### Backend

Backend is implemented using:

- **SvelteKit server routes**

Responsibilities:

- REST API endpoints
- authentication
- governance logic
- event emission
- plugin execution

---

### ORM

Database access via:

- **Drizzle ORM**

Responsibilities:

- schema definitions
- migrations
- type-safe queries

---

### Database

MVP database:

- **SQLite**

Reasons:

- simple setup
- low operational complexity
- suitable for MVP scale

Future migration target:

- PostgreSQL

Schema design must allow easy migration.

---

### Hosting

The system will be deployed on:

- **VPS with Plesk**

Deployment method:

- Node server
- SQLite database file
- environment configuration via `.env`

---

# 4. Architectural Principles

The system follows several architectural principles.

---

## 4.1 Modular Design

The system must be divided into clearly separated modules.

Modules include:

- auth
- communities
- proposals
- voting
- events
- strategies
- plugins
- executions
- integrations

Each module must:

- have clear responsibilities
- expose explicit interfaces
- avoid hidden dependencies

---

## 4.2 Extensible Governance Engine

The governance engine must support:

- multiple voting strategies
- plugin extensions
- execution hooks
- external integrations

Core logic must remain **strategy-agnostic**.

---

## 4.3 Event-Driven Extensions

The system should emit events for important actions.

Extensions such as:

- plugins
- automation
- webhooks

should respond to events rather than modifying core logic.

---

## 4.4 API-First Architecture

All important actions must be available through the REST API.

The frontend must consume the same APIs that external integrations use.

This ensures:

- consistent behavior
- easier integrations
- clear boundaries

---

# 5. Project Folder Structure

Recommended project structure:

```
/src
  /lib
    /server
      /auth
      /db
      /events
      /strategies
      /plugins
      /executions
      /integrations
      /services
  /routes
  /components
  /stores
  /utils
```

---

## /lib/server

Contains all backend logic.

### auth

Wallet authentication logic.

Includes:

- nonce generation
- signature verification
- session creation

---

### db

Drizzle configuration.

Includes:

- schema definitions
- database connection
- migrations

---

### events

Event system.

Responsibilities:

- emitting events
- event payload structure
- dispatching to plugins and webhooks

---

### strategies

Voting strategies.

Each strategy implements a common interface.

Examples:

- onePersonOneVote
- tokenWeighted
- quadratic
- reputation

Only `onePersonOneVote` is implemented in MVP.

---

### plugins

Plugin system for governance extensions.

Plugins can subscribe to events.

Examples:

- proposalTemplates
- delegation
- analytics

---

### executions

Proposal execution hooks.

Responsible for actions triggered when proposals pass.

Examples:

- webhook execution
- token minting
- reputation updates

---

### integrations

External service integrations.

Examples:

- Offcoin
- analytics platforms
- external identity providers

---

### services

Business logic services.

Examples:

- proposalService
- votingService
- communityService
- memberService

Services coordinate:

- database operations
- events
- strategies

---

# 6. Governance Engine

The governance engine consists of several interacting systems.

```
Proposal Lifecycle
│
▼ Voting Strategy
│
▼ Vote Storage
│
▼ Result Calculation
│
▼ Execution Hooks
│
▼ Events / Webhooks
```

---

# 7. Proposal Lifecycle

A proposal passes through several states.

- draft
- active
- closed

## Lifecycle flow:

```
proposal created (draft)
↓
proposal scheduled (start_time reached → active)
↓
voting opens
↓
votes collected
↓
voting ends (end_time reached → closed)
↓
results calculated
↓
execution hooks triggered
↓
events emitted
```

---

# 8. Voting Strategy System

Voting logic must be modular.

Each proposal references a **strategy ID**.

Example strategies:

- onePersonOneVote
- tokenVoting
- quadraticVoting
- reputationVoting

---

## Strategy Interface

All strategies must implement:

- validateVote(vote)
- calculateVotingPower(user, proposal)
- tallyVotes(votes)

Responsibilities:

### validateVote

Ensures vote is valid.

Example checks:

- user has permission
- proposal is active
- vote format correct

---

### calculateVotingPower

Determines vote weight.

Examples:

- token balance
- reputation score
- quadratic weighting

---

### tallyVotes

Computes final results.

Example outputs:

- vote totals
- winning option
- participation statistics

---

# 9. Plugin System

Plugins extend governance behavior without modifying core code.

Plugins can respond to system events.

Example plugin responsibilities:

- proposal templates
- voting analytics
- notification systems

---

## Plugin Interface

Plugins must expose event handlers.

Example:

- onProposalCreated
- onVoteCast
- onProposalClosed
- onMemberJoined

Plugins may:

- read system state
- store plugin-specific data
- trigger external actions

---

# 10. Event System

The platform uses an internal **event bus**.

Events allow:

- plugins
- automation
- webhooks
- integrations

to react to governance activity.

---

## Core Events

Examples:

- community.created
- member.joined
- proposal.created
- proposal.started
- vote.cast
- proposal.closed

Each event includes a structured payload.

Events must be emitted after the associated action completes.

---

# 11. Webhook System

Communities may register webhook endpoints.

When events occur, the system sends HTTP POST requests to subscribed endpoints.

Example webhook payload:
{
“event”: “vote.cast”,
“timestamp”: “…”,
“data”: {
“proposal_id”: “…”,
“user_id”: “…”,
“choice_id”: “…”
}
}

Webhook delivery must include:

- retry mechanism
- failure logging

---

# 12. Proposal Execution Hooks

Execution hooks trigger actions when proposals finish.

Execution occurs **after vote results are calculated**.

Possible execution types:

- webhook
- external_api_call
- reputation_update
- script_execution

Execution handlers are stored per proposal.

Multiple execution handlers may exist.

---

# 13. Integration Architecture

The system should support external integrations.

Integrations are implemented as modules inside `/integrations`.

Example integrations:

- offcoin
- analytics
- identity providers

---

## Offcoin Integration (Future)

The platform may integrate with:

**Offcoin**

Possible uses:

- reputation-based voting
- participation rewards
- governance achievements
- token-based voting

Integration must remain optional.

The core system must work without it.

---

# 14. Authentication Architecture

Authentication is handled separately from community membership.

User identity:

- wallet-based login
- optional additional identity providers (future)

Authentication responsibilities:

- wallet signature verification
- session management
- user creation

Membership determines **community permissions**.

---

# 15. Access Control

Access control is enforced at service layer.

Examples:

Members can:

- view community proposals
- vote on proposals

Admins can:

- manage community settings
- manage membership

Permission rules will be defined in a separate specification.

---

# 16. Scalability Considerations

Although the MVP targets small communities, architecture should support growth.

Potential scaling strategies:

- migrate SQLite → PostgreSQL
- add caching layer
- extract event system to queue
- horizontal API scaling

The modular design supports gradual scaling.

---

# 17. Logging and Observability

The system must log important governance actions.

Examples:

- proposal creation
- vote casting
- proposal closing
- webhook delivery
- execution hook results

Logs should include:

- timestamp
- user ID
- community ID
- event type

---

# 18. Future Architecture Extensions

The architecture is designed to support future additions such as:

- subgroups
- governance delegation
- proposal discussions
- governance analytics
- mobile clients

All new functionality should integrate through:

- strategies
- plugins
- events
- execution hooks

rather than modifying core logic.

---

End of document.
