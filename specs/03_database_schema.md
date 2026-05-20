# Community Governance Platform — Database Schema Specification

# 1. Purpose of This Document

This document defines the **complete database schema for the MVP** of the Community Governance Platform.

It specifies:

- all database tables
- field definitions
- relationships
- constraints
- indexes
- future extension considerations

The schema is designed to:

- support the MVP feature set
- allow future expansion without major restructuring
- work efficiently with **Drizzle ORM**
- run on **SQLite** during the MVP phase
- allow later migration to **PostgreSQL**

This document is intended for **developers and AI coding agents implementing the database layer**.

---

# 2. Database Design Principles

## 2.1 Minimal Core Schema

The schema focuses on a **small set of core tables**:

- users
- communities
- membership
- proposals
- voting

Additional systems (plugins, strategies, execution hooks) are supported via **extension tables**.

---

## 2.2 Extensibility

Several fields allow extensibility:

- `strategy_id` on proposals
- `metadata_json` on votes
- execution hook tables
- webhook tables

This allows new governance models without changing the core schema.

---

## 2.3 Compatibility with SQLite and PostgreSQL

The schema must avoid SQLite limitations that would prevent migration.

Guidelines:

- use simple data types
- avoid SQLite-specific behavior
- use ISO timestamps
- avoid complex JSON indexing

---

## 2.4 UUID-Based IDs

All primary identifiers must use **UUID strings**.

Benefits:

- globally unique
- safe for distributed systems
- easier external integrations

---

# 3. Table Overview

The MVP database includes the following tables:

- users
- user_identities
- communities
- community_members
- invites
- proposals
- proposal_choices
- votes
- webhooks
- execution_handlers

---

# 4. Users

Stores user identities.

Authentication is primarily **wallet-based**.

### Table: users

| Field          | Type              | Description             |
| -------------- | ----------------- | ----------------------- |
| id             | uuid (string)     | Primary key             |
| wallet_address | string            | Ethereum wallet address |
| display_name   | string (nullable) | Optional display name   |
| avatar_url     | string (nullable) | Optional avatar URL     |
| created_at     | timestamp         | Account creation time   |

### Constraints

- wallet_address must be unique
- wallet_address stored lowercase

### Indexes

- UNIQUE(wallet_address)

---

# 5. User Identities (Future SSO)

Allows optional authentication providers such as Google or Discord.

Not required for MVP functionality but included for extensibility.

### Table: user_identities

| Field            | Type      | Description         |
| ---------------- | --------- | ------------------- |
| id               | uuid      | Primary key         |
| user_id          | uuid      | References users.id |
| provider         | string    | identity provider   |
| provider_user_id | string    | external user ID    |
| created_at       | timestamp | creation time       |

### Constraints

- FOREIGN KEY user_id → users.id

### Indexes

- INDEX(user_id)
- INDEX(provider, provider_user_id)

---

# 6. Communities

Represents a governance space.

### Table: communities

| Field       | Type      | Description                                                       |
| ----------- | --------- | ----------------------------------------------------------------- |
| id          | uuid      | Primary key                                                       |
| name        | string    | Community name                                                    |
| slug        | string    | URL-friendly identifier                                           |
| description | text      | Community description                                             |
| visibility  | string    | public or community                                               |
| verified    | boolean   | Whether community is verified by platform admins (default: false) |
| created_by  | uuid      | creator user ID                                                   |
| created_at  | timestamp | creation time                                                     |
| updated_at  | timestamp | last update time                                                  |

### Constraints

- FOREIGN KEY created_by → users.id

### Indexes

- UNIQUE(slug)
- INDEX(created_by)

---

# 7. Community Members

Represents membership within a community.

### Table: community_members

| Field        | Type      | Description            |
| ------------ | --------- | ---------------------- |
| id           | uuid      | Primary key            |
| community_id | uuid      | references communities |
| user_id      | uuid      | references users       |
| role         | string    | admin or member        |
| joined_at    | timestamp | join time              |

### Constraints

- FOREIGN KEY community_id → communities.id
- FOREIGN KEY user_id → users.id

### Indexes

- UNIQUE(community_id, user_id)
- INDEX(user_id)
- INDEX(community_id)

---

# 8. Invites

Allows users to join communities via invite links.

### Table: invites

| Field        | Type               | Description                               |
| ------------ | ------------------ | ----------------------------------------- |
| id           | uuid               | Primary key                               |
| community_id | uuid               | referenced community                      |
| created_by   | uuid               | user who created the invite               |
| token        | string             | invite token                              |
| max_uses     | integer (nullable) | Maximum number of uses (null = unlimited) |
| uses         | integer            | Current number of uses (default: 0)       |
| expires_at   | timestamp          | expiration time                           |
| created_at   | timestamp          | creation time                             |

### Constraints

- FOREIGN KEY community_id → communities.id
- FOREIGN KEY created_by → users.id

### Indexes

- UNIQUE(token)
- INDEX(community_id)

---

# 9. Proposals

Represents governance proposals.

### Table: proposals

| Field        | Type      | Description                |
| ------------ | --------- | -------------------------- |
| id           | uuid      | Primary key                |
| community_id | uuid      | owning community           |
| title        | string    | proposal title             |
| body         | text      | proposal description       |
| created_by   | uuid      | creator user ID            |
| strategy_id  | string    | voting strategy identifier |
| visibility   | string    | public or community        |
| status       | string    | draft, active, closed      |
| start_time   | timestamp | voting start               |
| end_time     | timestamp | voting end                 |
| created_at   | timestamp | creation time              |
| updated_at   | timestamp | last update time           |

### Constraints

- FOREIGN KEY community_id → communities.id
- FOREIGN KEY created_by → users.id

### Indexes

- INDEX(community_id)
- INDEX(status)
- INDEX(start_time)
- INDEX(end_time)

---

# 10. Proposal Choices

Stores voting options.

### Table: proposal_choices

| Field       | Type    | Description         |
| ----------- | ------- | ------------------- |
| id          | uuid    | Primary key         |
| proposal_id | uuid    | referenced proposal |
| label       | string  | option label        |
| position    | integer | ordering index      |

### Constraints

- FOREIGN KEY proposal_id → proposals.id

### Indexes

- INDEX(proposal_id)

---

# 11. Votes

Stores votes cast by users.

### Table: votes

| Field         | Type      | Description         |
| ------------- | --------- | ------------------- |
| id            | uuid      | Primary key         |
| proposal_id   | uuid      | referenced proposal |
| user_id       | uuid      | voter               |
| choice_id     | uuid      | selected choice     |
| voting_power  | integer   | vote weight         |
| metadata_json | json/text | strategy metadata   |
| signature     | text      | wallet signature    |
| created_at    | timestamp | vote time           |

### Constraints

- FOREIGN KEY proposal_id → proposals.id
- FOREIGN KEY user_id → users.id
- FOREIGN KEY choice_id → proposal_choices.id

### Indexes

- UNIQUE(proposal_id, user_id)
- INDEX(proposal_id)
- INDEX(user_id)

This ensures one vote per user per proposal.

---

# 12. Webhooks

Allows communities to subscribe to governance events.

### Table: webhooks

| Field        | Type      | Description                                      |
| ------------ | --------- | ------------------------------------------------ |
| id           | uuid      | Primary key                                      |
| community_id | uuid      | referenced community                             |
| url          | string    | webhook endpoint                                 |
| secret       | string    | shared secret for webhook signature verification |
| events       | text/json | subscribed events                                |
| active       | boolean   | Whether the webhook is active (default: true)    |
| created_at   | timestamp | creation time                                    |

### Constraints

- FOREIGN KEY community_id → communities.id

### Indexes

- INDEX(community_id)

---

# 13. Execution Handlers

Defines actions triggered when proposals complete.

### Table: execution_handlers

| Field       | Type      | Description           |
| ----------- | --------- | --------------------- |
| id          | uuid      | Primary key           |
| proposal_id | uuid      | referenced proposal   |
| type        | string    | handler type          |
| config_json | json/text | handler configuration |
| created_at  | timestamp | creation time         |

### Constraints

- FOREIGN KEY proposal_id → proposals.id

### Indexes

- INDEX(proposal_id)

---

# 14. Relationships Overview

users
└── community_members
└── communities

communities
├── proposals
├── invites
└── webhooks

proposals
├── proposal_choices
├── votes
└── execution_handlers

---

# 15. Example Data Objects

## Example Community

```json
{
  “id”: “uuid”,
  “name”: “Eco Village Governance”,
  “slug”: “eco-village”,
  “visibility”: “community”,
  “verified”: false,
  “created_at”: “2026-01-01T10:00:00Z”
}
```

---

## Example Proposal

```json
{
  “title”: “Install Solar Panels”,
  “body”: “Proposal to install solar panels on the community center roof.”,
  “strategy_id”: “onePersonOneVote”,
  “choices”: [“Yes”, “No”, “Abstain”],
  “start_time”: “2026-02-01T00:00:00Z”,
  “end_time”: “2026-02-07T00:00:00Z”
}
```

---

## Example Vote

```json
{
  “proposal_id”: “uuid”,
  “user_id”: “uuid”,
  “choice_id”: “uuid”,
  “voting_power”: 1
}
```

---

# 16. Future Schema Extensions

The schema allows future additions such as:

### Subgroups

- groups
- group_members

### Governance Delegation

- delegations

### Proposal Discussions

- proposal_comments

### Reputation Systems

- reputation_scores

### Analytics

- proposal_statistics

These features can be added without breaking the core schema.

---

# 17. Migration Strategy

The database will initially run on **SQLite**.

Future migration path:

SQLite → PostgreSQL

Migration steps:

1. Export schema
2. Convert to PostgreSQL types
3. Run Drizzle migrations
4. Move production data

The schema is intentionally designed to make this migration straightforward.

---

End of document.
