# Community Governance Platform — Events, Plugins, and Execution Hooks Specification

# 1. Purpose of This Document

This document defines the **event system, plugin architecture, and execution hook mechanisms** for the Community Governance Platform.

These systems allow the governance engine to remain simple while enabling future extensibility.

The goals are:

- enable integrations
- support automation
- allow modular governance extensions
- avoid modifying core logic for new features

This document is intended for **developers and AI coding agents** implementing extensibility features.

---

# 2. Core Concept

The platform uses an **event‑driven architecture**.

Core system actions emit events. These events can then be handled by:

- plugins
- webhooks
- execution handlers
- integrations

Architecture overview:

```
Core Action
     │
     ▼
 Event Emitted
     │
     ├── Plugins
     ├── Webhooks
     ├── Execution Hooks
     └── External Integrations
```

This ensures the **core governance engine remains minimal and stable**.

---

# 3. Event System

The event system is a central mechanism used throughout the platform.

Events are emitted whenever important actions occur.

Examples include:

- community creation
- proposal creation
- vote casting
- proposal closure

Events must be emitted **after the database transaction completes successfully**.

---

# 4. Event Bus

The system must implement a lightweight internal event bus.

Responsibilities:

- emit events
- register event listeners
- dispatch events to listeners

Example structure:

```
emit(eventName, payload)
```

Example:

```
emit("vote.cast", {
  proposal_id,
  user_id,
  choice_id
})
```

Listeners can subscribe to specific event types.

---

# 5. Core Event Types

The following events must exist in the MVP.

```
community.created
member.joined
proposal.created
proposal.started
vote.cast
proposal.closed
```

Each event must include:

- timestamp
- event name
- payload

Example structure:

```
{
  event: "vote.cast",
  timestamp: "2026-03-10T12:00:00Z",
  data: { ... }
}
```

---

# 6. Event Payload Definitions

## community.created

```
{
  community_id,
  created_by
}
```

---

## member.joined

```
{
  community_id,
  user_id
}
```

---

## proposal.created

```
{
  proposal_id,
  community_id,
  created_by
}
```

---

## vote.cast

```
{
  vote_id,
  proposal_id,
  user_id,
  choice_id
}
```

---

## proposal.closed

```
{
  proposal_id,
  community_id,
  results
}
```

---

# 7. Plugin Architecture

Plugins allow adding new features without modifying core system code.

Examples of future plugins:

- governance analytics
- proposal templates
- notifications
- delegation systems

Plugins subscribe to events and react accordingly.

---

# 8. Plugin Structure

Plugins should live in:

```
/src/lib/server/plugins
```

Each plugin must export an object describing its handlers.

Example structure:

```
export const plugin = {
  name: "examplePlugin",

  handlers: {
    "proposal.created": handleProposalCreated,
    "vote.cast": handleVoteCast
  }
}
```

Handlers receive the event payload.

Example:

```
function handleVoteCast(event) {
  const { proposal_id, user_id } = event.data
}
```

---

# 9. Plugin Responsibilities

Plugins may:

- read system data
- store plugin-specific data
- trigger external APIs
- emit additional events

Plugins **must not modify core governance rules**.

They operate as extensions, not replacements.

---

# 10. Plugin Registration

Plugins should be registered during server initialization.

Example:

```
registerPlugin(examplePlugin)
```

The event system must dispatch events to all registered plugins.

---

# 11. Webhook System

Webhooks allow external systems to receive governance events.

Communities can register webhook endpoints.

When subscribed events occur, the system sends an HTTP POST request.

---

# 12. Webhook Payload

Example payload:

```
{
  event: "vote.cast",
  timestamp: "2026-03-10T12:00:00Z",
  data: {
    proposal_id: "uuid",
    user_id: "uuid",
    choice_id: "uuid"
  }
}
```

---

# 13. Webhook Delivery Rules

The system must implement:

- retry logic
- failure logging
- timeout protection

Suggested configuration:

```
timeout: 5 seconds
retries: 3
```

If delivery fails after retries, the failure should be logged.

---

# 14. Execution Hooks

Execution hooks define actions that run **when a proposal finishes**.

They are configured per proposal.

Execution occurs after vote tallying.

Example lifecycle:

```
proposal closed
↓
results calculated
↓
execution hooks triggered
↓
events emitted
```

---

# 15. Execution Handler Types

The MVP should support at least one execution type.

```
webhook
```

Future execution types may include:

```
external_api
script
reputation_update
token_mint
```

---

# 16. Execution Handler Structure

Execution handlers are stored in the database.

Example configuration:

```
{
  type: "webhook",
  config: {
    url: "https://example.com/action"
  }
}
```

When triggered, the handler performs the configured action.

---

# 17. Execution Flow

Execution process:

```
proposal reaches end_time
↓
server closes proposal
↓
votes tallied
↓
execution handlers loaded
↓
handlers executed
↓
proposal.closed event emitted
```

Execution errors must not break proposal closure.

Failures should be logged.

---

# 18. Offcoin Integration (Future)

The event system allows easy integration with **Offcoin**.

Example use cases:

Voting rewards:

```
vote.cast
→ Offcoin API
→ award XP
```

Governance achievements:

```
proposal.created
→ Offcoin badge
```

This integration should be implemented as a plugin.

---

# 19. Event Logging

All emitted events should be logged.

Log structure:

```
{
  event,
  timestamp,
  payload
}
```

Logs help debugging and governance transparency.

---

# 20. Future Extensions

The event and plugin architecture supports future systems including:

```
reputation engines
analytics dashboards
automation workflows
mobile notifications
```

All such features should integrate through events rather than modifying core governance logic.

---

End of document.
