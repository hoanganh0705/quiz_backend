# Auth Module

## Purpose

Owns **identity proofing, credential lifecycle, and session lifecycle**. It registers users, authenticates them, manages JWT access tokens and refresh token rotation, supports password reset and account deletion, and enforces login-rate limits.

## Responsibilities

**Owns**
- User registration with email verification
- Email/password authentication and JWT issuance
- Refresh token rotation (cookie-based)
- Password reset (time-limited token via email)
- Password change with current-password confirmation and reuse history
- Account deletion (password-confirmed, soft-delete of user + revocation of all sessions)
- Multi-session management (list, revoke one, revoke all others)
- Google OAuth (login, account linking, auto-link verified accounts)
- Session-rate limiting per IP and per identity
- Cross-instance session revocation via Redis pub/sub
- Security audit log entries for sensitive operations

**Does not own**
- User profile, badges, XP, rankings (those belong to the **User module**)
- Quiz creation, attempt tracking, bookmarks, reviews (those belong to the respective modules)
- Email delivery (delegates to the **Email module**)
- Notifications (delegates to the **Notification module**)

## Core Concepts

| Concept | Description |
|---|---|
| **User** | An identity record (`email`, `username`, `passwordHash`, `isVerified`). Soft-deleted. |
| **Session** | A refresh-token record anchored to a device (`userId`, `jti`, `lastUsedAt`, `revokedAt`). |
| **Email Verification Token** | One-time SHA-256-hashed token on the `users` table. TTL-enforced. |
| **Password Reset Token** | Stored on `password_reset_tokens`. One-time, TTL-enforced. |
| **Password History** | Tracks the last N hashes to prevent reuse. |
| **OAuth Account** | Links a platform identity (Google) to a user. |
| **Refresh Token** | JWT with unique `jti`. Stored as SHA-256 hash in `user_sessions`. |
| **Access Token** | Short-lived JWT with `sub`, `role`, and optional `sessionId`. |

## Business Rules

- **Email uniqueness**: each active user has a unique lowercase email address.
- **Username uniqueness**: each active user has a unique lowercase username.
- **Email verification required before auth flows**: `isVerified` starts `false`, becomes `true` after token consumed.
- **Refresh token rotation**: every refresh issues a new JWT with a new `jti`. The DB hash is updated atomically.
- **Token reuse detection**: a second refresh within the grace window (same device context) revokes **all** sessions for that user. Outside the grace window, reuse revokes **all** sessions.
- **Max active sessions**: configurable per-user limit; on new login, oldest sessions are LRU-revoked.
- **Password policy**: bcrypt rounds = 12; min 6 chars registration; min 8 chars reset/change; complexity enforced by DTO.
- **Password reuse**: last 5 hashes checked on change/reset.
- **Login rate limit**: 10 attempts per minute per IP; 8 per minute per user identity.
- **Refresh rate limit**: 30 per minute per IP; 20 per minute per user.
- **Multi-session**: users may have multiple active sessions across devices.
- **OAuth link rule**: an unverified email account cannot be auto-linked to an OAuth identity.

## Relationships

```
User
├── owns → Sessions
├── owns → Password Reset Tokens
├── owns → Password History
├── owns → OAuth Accounts
├── has → Email Verification Token
└── deleted by → Account Deletion (soft-delete + session revocation)
```

## Lifecycle

### User

```
Registered (isVerified = false)
    ↓ verifyEmail()
Verified (isVerified = true)
    ↓ deleteAccount()
Soft-deleted (deletedAt = now, password cleared)
```

### Session

```
Active (revokedAt = null, expiresAt > now)
    ↓ revoke / logout / password change / account deletion / max-session LRU
Revoked (revokedAt = now)
    ↓ (never resurrected)
```

### Email Verification Token

```
Issued (stored as hash, expiresAt = now + TTL)
    ↓ consume via verifyEmail()
Consumed (hash cleared, isVerified = true)
```

### Password Reset Token

```
Issued (inserted, old ones atomically revoked)
    ↓ consume via resetPassword()
Consumed (isActive = false, usedAt = now, password updated)
```

### OAuth Account

```
Created (on first OAuth login with new provider identity)
    ↓ optionally link to existing verified account
Linked (to an existing user)
```

## Permissions

The auth module does not use the `@Permissions` RBAC guard. All auth decisions are binary: **valid JWT** (Bearer or cookie) or **not**.

The `JwtPayload` carries `sub` (userId) and `role`. Service-layer ownership checks use `userId === currentUserId`.

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Email** | Calls `EmailProvider` to send verification and password-reset emails. |
| **Notification** | Calls `AuthSecurityNotificationService` after outbox dispatch to send password-changed, session-revoked, account-deleted notifications. |
| **User** | Reads `UserMeRow` from the user repository (for `GET /me` and the `JwtPayload` construction). |

## Invariants

- A session's `userId` always refers to an active user (`deletedAt IS NULL`).
- A refresh token's `jti` is unique across all sessions.
- Token reuse outside the grace window always results in total-session revocation.
- Soft-deleted users cannot authenticate.
- Email verification tokens are consumed exactly once.
- Password reset tokens are consumed exactly once; new request atomically revokes prior tokens.

## Future Extension Points

- **Additional OAuth providers**: flow through the same `JwtGuard`; `JwtPayload` shape grows accordingly.
- **Multi-factor authentication**: the existing `SessionContextMismatchError` provides a slot for MFA token validation.
- **Account lockout**: not implemented; the existing rate-limit bucket pattern could absorb an `AccountLockedError` code.
- **Delegated account recovery**: the outbox event structure already supports a `guardian_recovery_requested` event type (declared in `OutboxProcessorService` line 237); the consumer side is not yet implemented.