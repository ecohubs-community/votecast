# Community Governance Platform — Product Overview

# 1. Purpose of This Document

This document defines the **product vision, goals, scope, and guiding principles** of the Community Governance Platform.

It provides high-level context for developers and AI coding agents to understand:

- Why the system exists
- Who it is built for
- What the MVP must include
- What must **not** be implemented yet
- How the system is expected to evolve

This document intentionally focuses on **product-level decisions**, not technical implementation details.  
Technical architecture, database schema, APIs, and UI/UX are defined in separate specification documents.

---

# 2. Product Vision

The goal of this project is to create a **simple, extensible governance platform optimized for real human communities**, both online and physical.

Many existing governance platforms are built primarily for **DAOs and crypto-native organizations**. These systems often introduce unnecessary complexity for real-world communities.

This platform focuses on:

- simplicity
- transparency
- extensibility
- privacy where needed
- accessibility for non-technical users

The system should enable communities to **discuss proposals and make collective decisions** in a clear and trustworthy way.

The platform must remain **minimal and easy to understand**, while its architecture must allow significant future expansion.

---

# 3. Target Users

The platform is designed for **human communities**, not primarily for financial DAOs.

Example user groups include:

### Intentional communities

Examples:

- eco villages
- regenerative communities
- land-based communities
- cooperative housing projects

These communities often require governance tools but are not technically inclined.

---

### Cooperatives and organizations

Examples:

- worker cooperatives
- non-profits
- community networks
- grassroots organizations

These groups require:

- proposal voting
- member governance
- transparent decision making

---

### Online collectives

Examples:

- decentralized online communities
- open-source communities
- creative collectives
- digital guilds

---

### Hybrid communities

Communities that combine **online coordination with real-world activities**.

Examples:

- global networks with local chapters
- communities with physical locations and online members

---

# 4. Core Design Principles

The system should follow several guiding principles.

---

## 4.1 Simplicity

The system must remain **simple for end users**.

Users should be able to:

- join a community
- view proposals
- vote on proposals
- see results

without needing technical knowledge.

Avoid DAO-specific terminology wherever possible.

---

## 4.2 Extensibility

Even though the MVP is minimal, the architecture must support future extensions such as:

- additional voting strategies
- governance plugins
- automation hooks
- external integrations
- reputation systems
- token-based governance

Extensibility must be achieved through:

- modular architecture
- event systems
- plugin interfaces
- strategy systems

---

## 4.3 Privacy

Communities must be able to control the visibility of governance activity.

The MVP supports:

- **public proposals**
- **community-only proposals**

Future versions will support:

- invite-only proposals
- subgroup governance
- role-based access

---

## 4.4 Transparency

Governance decisions should be visible and understandable.

Proposal pages must clearly show:

- proposal description
- voting options
- vote counts
- final outcome

---

## 4.5 API-First Philosophy

The platform should be designed with **strong API support** from the beginning.

Communities should be able to build:

- bots
- dashboards
- automation tools
- external integrations

Examples:

- Discord bots
- community dashboards
- governance analytics tools

---

# 5. MVP Scope

The MVP must remain **intentionally small**.

The goal is to deliver a **fully working governance system with minimal complexity**.

---

## 5.1 MVP Core Features

The MVP must include the following core capabilities.

### Wallet-based login

Users authenticate using a **cryptographic wallet signature**.

This allows:

- decentralized identity
- compatibility with existing governance ecosystems

---

### Communities

Users can create and join communities.

A community contains:

- members
- proposals
- governance activity

Communities have:

- name
- description
- visibility settings

---

### Community Membership

Members can join communities via:

- invite links
- API-based addition

Communities must maintain a list of members.

---

### Proposals

Community members can create proposals.

A proposal includes:

- title
- description (supports markdown)
- **voting options** (user-defined choices, e.g., "Yes" / "No" / "Abstain", or custom options)
- start time
- end time
- visibility (public or community)

Each proposal must have **at least two voting options**. Options are defined by the proposal creator at creation time, both via the UI and the API.

Proposals belong to a specific community.

---

### Voting

Members can vote on proposals.

The MVP includes **one voting strategy only**:

**One person = one vote**

Each member may cast a single vote per proposal.

---

### Results

Proposal pages display voting results including:

- number of votes per option
- total votes
- final outcome after the voting period ends

---

### Visibility Modes

The MVP supports two proposal visibility modes:

**Public**

Anyone can view the proposal and results.

**Community**

Only members of the community can view the proposal.

---

### REST API

The system must expose a **REST API** that allows:

- managing communities
- retrieving proposals
- casting votes
- accessing results

The API will enable integration with external tools.

---

### Event System

The system must emit events for important actions.

Examples:

- proposal created
- vote cast
- proposal closed
- member joined

These events enable future integrations and automation.

---

### Webhooks

Communities may register webhooks to receive governance events.

This allows external automation such as:

- community bots
- dashboards
- analytics tools

---

### Verified Communities

Communities can be **verified** by platform administrators.

**Unverified communities** have the following limits:

- maximum **20 proposals**
- maximum **10 members**
- lower API rate limits

**Verified communities** have:

- unlimited proposals
- unlimited members
- standard API rate limits

This encourages legitimate community usage while preventing platform abuse.

Verification is a manual process performed by platform administrators.

---

### Proposal Lifecycle

Proposals follow an automated lifecycle:

1. **Draft** — proposal is created but voting has not started
2. **Active** — `start_time` has been reached, members can vote
3. **Closed** — `end_time` has been reached, voting is finished, results are final

The system must automatically transition proposals between states based on their `start_time` and `end_time`. This can be implemented via a scheduled job or on-access checks.

---

# 6. Explicit Non-Goals (Not Part of MVP)

The following features must **not be implemented in the MVP**, but the architecture must allow them later.

---

## Advanced voting strategies

Examples:

- token voting
- quadratic voting
- reputation voting
- delegated voting

The MVP includes **only one-person-one-vote**.

---

## Subgroups

Communities will eventually support **subgroups or working groups**, but this is not part of the MVP.

---

## Invite-only proposals

The MVP includes only:

- public proposals
- community proposals

Invite-only proposals will be implemented later.

---

## Governance discussions

Proposal comment threads may be added later.

They are not required for MVP.

---

## Governance delegation

Delegated voting is not part of the MVP.

---

# 7. Long-Term Extensibility Goals

The architecture must support the following future features.

---

## Voting Strategies

The platform must support multiple strategies in the future.

Examples:

- token weighted voting
- quadratic voting
- reputation-based voting
- hybrid systems

Strategies must be modular and replaceable.

---

## Governance Plugins

The system should allow plugins that extend governance functionality.

Examples:

- proposal templates
- delegation systems
- subgroup governance
- voting analytics

---

## Execution Hooks

Proposals may trigger actions when approved.

Examples:

- sending webhook events
- minting tokens
- updating reputation
- triggering automation scripts

---

## External Integrations

The system should allow integration with external platforms.

Example integration:

**Offcoin**

Possible use cases:

- reputation-based voting power
- rewarding participation with XP
- governance achievements
- token-based governance mechanisms

---

## Community SSO

Communities may enable additional authentication providers.

Examples:

- Google
- Discord
- SAML

Wallet login remains the default identity system.

---

# 8. Target User Experience

The system should feel:

- minimal
- clear
- calm
- easy to understand

Users should not feel they are interacting with a complex governance protocol.

Instead it should feel like a **simple community decision platform**.

---

# 9. Success Criteria for the MVP

The MVP is successful if communities can:

1. Create a community
2. Invite members
3. Create proposals
4. Vote on proposals
5. See clear results
6. Access governance data via API

The system should be:

- stable
- understandable
- extensible

---

# 10. Future Vision

Long term, the platform could evolve into a **governance infrastructure layer for communities**.

Potential applications include:

- eco village governance
- cooperative decision systems
- digital community governance
- hybrid online/offline governance networks

The platform should remain **simple for users** while enabling powerful governance capabilities under the hood.

---

End of document.
