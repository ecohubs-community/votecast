# Community Governance Platform — Authentication & Identity Specification

# 1. Purpose

This document defines the authentication and identity architecture for the Community Governance Platform.

The goals are:

- secure user authentication
- wallet-native identity
- optional community SSO integration
- compatibility with external reputation/token systems

The system must remain **simple in the MVP** while allowing **future identity extensions**.

---

# 2. Identity Model

The platform uses a **wallet-first identity model**.

A user is primarily identified by:

```
wallet_address
```

This matches the governance patterns used in systems such as Snapshot-style voting.

However, the platform must allow optional additional identity layers.

Supported identity sources:

```
wallet (primary)
SSO (optional per community)
API-created users
```

---

# 3. User Entity

Users represent a global identity across communities.

Database representation:

```
users
```

Fields:

```
id
wallet_address
display_name
avatar_url
created_at
```

Rules:

- wallet_address must be unique
- display_name is optional
- avatar_url is optional

Users may join multiple communities.

---

# 4. Wallet Authentication

Wallet authentication uses a **Sign-In With Ethereum style flow**.

Authentication steps:

```
1. user connects wallet
2. server generates nonce
3. user signs nonce
4. server verifies signature
5. session is created
```

Supported wallets may include:

```
MetaMask
WalletConnect
Phantom (future)
```

MVP requirement:

At least one EVM-compatible wallet login must work.

---

# 5. Nonce Generation

Nonce prevents replay attacks.

Nonce properties:

```
random
single-use
short expiration
```

Example nonce structure:

```
login:1234567890
```

The nonce must be stored temporarily in the database or cache.

---

# 6. Signature Verification

The server verifies the signed message.

Verification confirms:

```
message
signature
wallet address
```

If valid:

- user account is created or loaded
- session token is issued

---

# 7. Session Management

Sessions maintain authenticated state.

Recommended implementation:

```
httpOnly cookies
secure flag
sameSite=lax
```

Session table structure:

```
sessions
```

Fields:

```
id
user_id
session_token
expires_at
created_at
```

Session expiration recommendation:

```
7 days
```

---

# 8. Community Membership

Users become members of communities.

Membership is stored in:

```
community_members
```

Fields:

```
id
community_id
user_id
role
joined_at
```

Roles include:

```
member
admin
```

Future roles may include:

```
moderator
facilitator
observer
```

---

# 9. Joining Communities

Users can join communities via:

```
invite link
API
admin invitation
```

Invite link flow:

```
user opens invite link
↓
authenticates wallet
↓
membership created
```

---

# 10. Community SSO (Optional)

Some communities may require **alternative authentication methods**.

Examples:

```
Google SSO
GitHub SSO
custom OAuth provider
```

This must be **optional and configurable per community**.

Architecture:

```
community
→ auth_provider
```

If enabled:

Users must authenticate using the configured provider.

---

# 11. SSO Data Model

SSO identities should be stored in:

```
external_identities
```

Fields:

```
id
user_id
provider
provider_user_id
created_at
```

Example:

```
provider = "google"
provider_user_id = "123456"
```

---

# 12. API-Based User Creation

Communities may manage members externally.

The platform must support:

```
API member creation
```

Example use case:

```
community CRM
→ creates members via API
```

API-created members may optionally attach wallets later.

---

# 13. Permissions Model

Permissions are role-based.

Basic permission rules:

```
member
→ vote
→ view proposals
→ create proposals

admin
→ all member permissions
→ manage members
→ configure community
→ manage webhooks
→ create/manage invite links
```

Note: Proposal creation is allowed for all community members by default. Communities may restrict proposal creation to admins in the future via community settings.

Permissions must be checked server-side.

---

# 14. Future: Reputation Integration

The identity system should allow linking to reputation systems.

Examples:

```
Offcoin XP
community karma
participation scores
```

Reputation systems must integrate via:

```
plugins
external APIs
```

---

# 15. Security Requirements

Authentication must follow security best practices.

Requirements:

```
nonce verification
signature validation
secure cookies
CSRF protection
rate limiting
```

Sensitive endpoints must enforce authentication.

---

# 16. Privacy Considerations

Communities may choose different privacy models.

Supported visibility modes:

```
public
community
```

Future support:

```
invite_only
subgroups
```

User identity exposure must respect these rules.

---

# 17. Future Identity Extensions

The identity architecture must remain extensible.

Possible future features:

```
decentralized identity (DID)
ENS name support
reputation-based voting
cross-community identity
```

The current design must not block these extensions.

---

End of document.
