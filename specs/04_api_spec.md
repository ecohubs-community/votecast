# Community Governance Platform — REST API Specification

# 1. Purpose of This Document

This document defines the **REST API for the Community Governance Platform MVP**.

It specifies:

- API endpoints
- request formats
- response formats
- authentication rules
- error handling
- pagination conventions
- event/webhook interactions

This specification is intended for **developers and AI coding agents** implementing the backend and frontend.

The API is designed to follow these principles:

- **RESTful structure**
- **predictable response schemas**
- **clear authentication requirements**
- **simple integration with frontend and external systems**

---

# 2. Base API Configuration

### Base URL

Example:
https://your-domain.com/api

---

### Content Type

All requests and responses must use:
Content-Type: application/json

---

### Response Structure

All responses must follow this structure.

### Success

```json
{
  “success”: true,
  “data”: { … }
}
```

---

### Error

```json
{
  “success”: false,
  “error”: {
    “code”: “ERROR_CODE”,
    “message”: “Human readable description”
  }
}
```

---

# 3. Authentication

Authentication uses **wallet-based login**.

Authentication flow:

1. client requests nonce
2. wallet signs message
3. signature verified
4. session created

Authenticated endpoints require a **session cookie**.

Header example:

Cookie: session_id=…

Authentication specification is detailed in **06_auth_identity.md**.

---

# 4. Pagination

Endpoints returning lists must support pagination.

### Query Parameters

?limit=20
?cursor=abcdef

---

### Response Example

```json
{
  “success”: true,
  “data”: {
    “items”: [],
    “next_cursor”: “abcdef”
  }
}
```

---

# 5. Users

## GET /api/me

Returns current authenticated user.

### Authentication

Required.

### Response

```json
{
  “success”: true,
  “data”: {
    “id”: “uuid”,
    “wallet_address”: “0x123…”,
    “display_name”: “Alice”,
    “avatar_url”: null
  }
}
```

---

## PATCH /api/me

Update current user profile.

### Authentication

Required.

### Request

```json
{
  “display_name”: “Alice”
}
```

### Response

```json
{
  “success”: true,
  “data”: {
    “id”: “uuid”,
    “display_name”: “Alice”
  }
}
```

---

# 6. Communities

## POST /api/communities

Creates a new community.

### Authentication

Required.

### Request

```json
{
  “name”: “Eco Village Governance”,
  “slug”: “eco-village”,
  “description”: “Governance for our community”,
  “visibility”: “community”
}
```

### Response

```json
{
  “success”: true,
  “data”: {
    “id”: “uuid”,
    “name”: “Eco Village Governance”,
    “slug”: “eco-village”
  }
}
```

---

## GET /api/communities

Returns list of communities (authenticated user's communities).

### Response

```json
{
  “success”: true,
  “data”: {
    “items”: [
      {
        “id”: “uuid”,
        “name”: “Eco Village Governance”,
        “slug”: “eco-village”
      }
    ]
  }
}
```

---

## GET /api/communities/public

Returns public communities for the landing page discovery sections. No authentication required.

### Query Parameters

```
sort=newest       → ordered by created_at descending (default)
sort=most_active  → ordered by total vote count descending
limit=6           → max results (default: 6)
```

### Response

```json
{
  “success”: true,
  “data”: {
    “items”: [
      {
        “id”: “uuid”,
        “name”: “Eco Village Governance”,
        “slug”: “eco-village”,
        “description”: “…”,
        “member_count”: 32,
        “vote_count”: 148,
        “created_at”: “2026-01-01T10:00:00Z”
      }
    ]
  }
}
```

---

## GET /api/communities/:slug

Returns community details.

### Response

```json
{
  “success”: true,
  “data”: {
    “id”: “uuid”,
    “name”: “Eco Village Governance”,
    “slug”: “eco-village”,
    “description”: “…”,
    “visibility”: “community”,
    “verified”: false
  }
}
```

---

# 7. Community Membership

## GET /api/communities/:id/members

Returns community members.

### Authentication

Required for community visibility.

### Response

```json
{
  “success”: true,
  “data”: {
    “items”: [
      {
        “user_id”: “uuid”,
        “role”: “member”
      }
    ]
  }
}
```

---

## POST /api/communities/:id/members

Adds a member.

Used by:

- API integration
- community admins

### Authentication

Admin required.

### Request

```json
{
  “user_id”: “uuid”,
  “role”: “member”
}
```

### Response

```json
{
  “success”: true
}
```

---

# 8. Invite Links

## POST /api/communities/:id/invites

Creates invite link.

### Authentication

Admin required.

### Response

```json
{
  “success”: true,
  “data”: {
    “invite_url”: “https://app/join/abcdef”
  }
}
```

---

## POST /api/join/:token

Join community using invite.

### Authentication

Required.

### Response

```json
{
  “success”: true
}
```

---

# 9. Proposals

## POST /api/proposals

Create a proposal.

### Authentication

Community member required.

### Request

```json
{
  “community_id”: “uuid”,
  “title”: “Install Solar Panels”,
  “body”: “Proposal to install solar panels”,
  “choices”: [“Yes”, “No”],
  “start_time”: “2026-03-01T00:00:00Z”,
  “end_time”: “2026-03-07T00:00:00Z”,
  “visibility”: “community”,
  “strategy_id”: “onePersonOneVote”
}
```

The `choices` array is **required** and must contain at least 2 items. Each choice is a string label. The server creates `proposal_choices` records with sequential `position` values.

### Response

```json
{
  “success”: true,
  “data”: {
    “proposal_id”: “uuid”
  }
}
```

---

## PATCH /api/proposals/:id

Update a proposal.

### Authentication

Required. Must be the proposal creator or a community admin.

### Constraints

Only proposals with status `draft` can be edited. Attempting to update an `active` or `closed` proposal returns an error.

### Request

All fields are optional. Only provided fields are updated.

```json
{
	"title": "Updated Title",
	"body": "Updated description",
	"choices": ["Option A", "Option B", "Option C"],
	"start_time": "2026-03-05T00:00:00Z",
	"end_time": "2026-03-12T00:00:00Z",
	"visibility": "public"
}
```

When `choices` is provided, **all existing choices are replaced** with the new list. Minimum 2 choices required.

### Response

```json
{
	"success": true,
	"data": {
		"id": "uuid",
		"title": "Updated Title",
		"status": "draft"
	}
}
```

### Error (if not draft)

```json
{
	"success": false,
	"error": {
		"code": "PROPOSAL_NOT_EDITABLE",
		"message": "Only draft proposals can be edited"
	}
}
```

---

## GET /api/communities/:id/proposals

Returns proposals for community.

### Query Parameters

status=active|closed

### Response

```json
{
  “success”: true,
  “data”: {
    “items”: [
      {
        “id”: “uuid”,
        “title”: “Install Solar Panels”,
        “status”: “active”,
        “start_time”: “…”,
        “end_time”: “…”
      }
    ]
  }
}
```

---

## GET /api/proposals/:id

Returns full proposal details including voting choices.

### Response

```json
{
  “success”: true,
  “data”: {
    “id”: “uuid”,
    “title”: “Install Solar Panels”,
    “body”: “…”,
    “status”: “active”,
    “choices”: [
      {
        “id”: “uuid”,
        “label”: “Yes”,
        “position”: 0
      },
      {
        “id”: “uuid”,
        “label”: “No”,
        “position”: 1
      }
    ]
  }
}
```

---

# 10. Voting

## POST /api/votes

Cast vote.

### Authentication

Required.

### Request

```json
{
  “proposal_id”: “uuid”,
  “choice_id”: “uuid”,
  “signature”: “wallet_signature”
}
```

### Behavior

Server must:

1. verify proposal is active
2. verify membership
3. verify signature
4. ensure user has not already voted

---

### Response

```json
{
  “success”: true
}
```

---

# 11. Proposal Results

## GET /api/proposals/:id/results

Returns voting results.

### Response

```json
{
  “success”: true,
  “data”: {
    “proposal_id”: “uuid”,
    “total_votes”: 42,
    “results”: [
      {
        “choice_id”: “uuid”,
        “label”: “Yes”,
        “votes”: 30
      },
      {
        “choice_id”: “uuid”,
        “label”: “No”,
        “votes”: 12
      }
    ]
  }
}
```

---

# 12. Webhooks

## POST /api/communities/:id/webhooks

Register webhook.

### Authentication

Admin required.

### Request

```json
{
  “url”: “https://example.com/webhook”,
  “events”: [
    “proposal.created”,
    “vote.cast”,
    “proposal.closed”
  ]
}
```

A `secret` is auto-generated by the server and returned in the response. It is used to sign webhook payloads for verification.

### Response

```json
{
  “success”: true,
  “data”: {
    “id”: “uuid”,
    “secret”: “whsec_…”
  }
}
```

---

## GET /api/communities/:id/webhooks

List community webhooks.

### Response

```json
{
  “success”: true,
  “data”: {
    “items”: [
      {
        “id”: “uuid”,
        “url”: “https://example.com/webhook”,
        “events”: [“proposal.created”, “vote.cast”],
        “active”: true
      }
    ]
  }
}
```

---

# 13. Community Management

## PATCH /api/communities/:id

Update community settings.

### Authentication

Admin required.

### Request

```json
{
	"name": "Updated Name",
	"description": "Updated description",
	"visibility": "public"
}
```

All fields are optional. Only provided fields are updated.

### Response

```json
{
	"success": true,
	"data": {
		"id": "uuid",
		"name": "Updated Name",
		"slug": "eco-village"
	}
}
```

---

## DELETE /api/communities/:id/members/:userId

Remove a member from the community.

### Authentication

Admin required. Admins cannot remove themselves.

### Response

```json
{
	"success": true
}
```

---

## POST /api/communities/:id/leave

Leave a community.

### Authentication

Required. Admins cannot leave if they are the only admin.

### Response

```json
{
	"success": true
}
```

---

# 14. Event Streaming (Future)

Future versions may include:

GET /api/events

This endpoint would allow:

- real-time governance monitoring
- dashboards
- analytics

Not required for MVP.

---

# 14. Error Codes

Common error codes:

```
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
INVALID_REQUEST
ALREADY_VOTED
PROPOSAL_NOT_ACTIVE
PROPOSAL_NOT_EDITABLE
MEMBERSHIP_REQUIRED
COMMUNITY_LIMIT_REACHED
INVALID_CHOICES
```

Example:

```json
{
  “success”: false,
  “error”: {
    “code”: “ALREADY_VOTED”,
    “message”: “User has already voted on this proposal”
  }
}
```

---

# 15. Rate Limiting

Basic rate limiting should apply.

### Standard rate limits (verified communities):

```
60 requests per minute per IP
```

### Reduced rate limits (unverified communities):

```
30 requests per minute per IP
```

Stricter limits for:

- vote casting
- proposal creation

### Verified Community Limits

Unverified communities are subject to:

```
maximum 20 proposals
maximum 10 members
```

Verified communities have no such limits. The API must enforce these limits and return an appropriate error when exceeded.

Error code: `COMMUNITY_LIMIT_REACHED`

---

# 16. Future API Extensions

Future endpoints may include:

/groups
/delegations
/comments
/analytics

The current API design leaves room for these features without breaking existing endpoints.

---

End of document.
