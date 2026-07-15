# Authentication Flow

This document describes how the application authenticates users: JWT access tokens, refresh token rotation, and Google OAuth. For the authorization model, see `docs/architecture/authorization-flow.md`.

## Authentication Methods

The application supports three authentication methods:

| Method | Trigger | Token storage |
|---|---|---|
| JWT Access Token | All non-`@Public()` requests | `Authorization: Bearer <token>` header |
| Refresh Token | `POST /auth/refresh-token` | `HttpOnly` cookie `refresh_token` |
| Google OAuth | `POST /auth/oauth/google` | `Authorization: Bearer <token>` (after flow) |

## JWT Token Architecture

```
Access Token (short-lived)
  sub:     userId
  role:    UserRole ('admin' | 'moderator' | 'user')
  sessionId: sessionId (optional)
  iss:     JWT_ISSUER
  aud:     JWT_AUDIENCE
  exp:     now + ACCESS_TOKEN_TTL
  iat:     now

Refresh Token (long-lived, rotates)
  jti:     unique per rotation
  sub:     userId
  iss:     JWT_ISSUER
  aud:     JWT_AUDIENCE
  exp:     now + REFRESH_TOKEN_TTL
  iat:     now
  → Stored as SHA-256 hash in user_sessions table
  → Revoked atomically on use (old jti replaced by new jti)
```

## Token Issuance Flows

### Password Login

```
POST /api/v1/auth/login
Body: { email, password }
    │
    ▼
AuthLoginService.login(email, password, requestContext)
    │
    ├── validateCredentials(email, password)
    │       └── UserRepository.findByEmail(email)
    │               └── throws InvalidCredentialsError if missing/wrong
    │
    ├── createSessionWithActiveLimit(userId, requestContext)
    │       └── pg_advisory_xact_lock(hashtext(userId))
    │       └── LRU-evict oldest sessions if maxActiveSessions exceeded
    │       └── INSERT INTO user_sessions (sessionId, userId, refreshTokenHash, ...)
    │
    ├── issueTokens(session)
    │       ├── AccessToken: JwtService.sign({ sub, role, sessionId, ... })
    │       └── RefreshToken: JwtService.sign({ sub, jti, ... })
    │
    └── set-cookie: refresh_token=<jwt>; HttpOnly; Secure; SameSite=Strict
    │
    ▼
{ accessToken, user }
Cookie: refresh_token=<jwt>
```

### OAuth Login

```
POST /api/v1/auth/oauth/google
Body: { idToken }  ← Google ID token from the OAuth client
    │
    ▼
GoogleOAuthAdapter.verifyIdToken(idToken)
    │
    ├── GoogleOAuthIdentityResolver.resolve(email, googleUserId)
    │       │
    │       ├── findOAuthAccount(provider, googleUserId)
    │       │       └── OAuthAccountRepository.findByProviderAndProviderUserId()
    │       │
    │       ├── if found:
    │       │       ├── user = findUserByOAuthAccount(googleUserId)
    │       │       └── emit OAuthLoginEvent (outbox)
    │       │
    │       └── if not found:
    │               ├── findUserByEmail(email)
    │               │       ├── if found AND user.isVerified:
    │               │       │       └── linkOAuthAccountToExistingUser()  ← auto-link
    │               │       ├── if found AND !user.isVerified:
    │               │       │       └── throw OAuthAccountLinkingRequiredError  ← must verify first
    │               │       └── if not found:
    │               │               └── createOAuthUserWithLink(email, googleUserId)
    │               │                       └── create new user (isVerified=true), insert OAuthAccount
    │               │                       └── emit OAuthAccountCreatedEvent (outbox)
    │
    └── if auto-link or new user:
            createSessionWithActiveLimit(...)
            issueTokens(...)
```

### Token Refresh

```
POST /api/v1/auth/refresh-token
Cookie: refresh_token=<jwt>
    │
    ▼
AuthRefreshService.refreshToken(requestContext)
    │
    ├── readCookie('refresh_token')
    ├── JwtService.verify(refreshToken)
    │
    ├── session = findSessionByJti(jti)
    │       └── WHERE revokedAt IS NULL AND expiresAt > now
    │       └── pg_advisory_xact_lock(hashtext(sessionId))  ← serializes concurrent refreshes
    │
    ├── detect token reuse:
    │       ├── within grace window (same device, same request window)?
    │       │       └── allow: rotate silently
    │       └── outside grace window on second attempt?
    │               └── revoke ALL user sessions
    │               └── throw TokenReuseDetectedError
    │
    ├── rotateSession(sessionId, newJti)
    │       └── UPDATE user_sessions SET jti=$new, lastUsedAt=now WHERE jti=$old
    │
    ├── issueTokens(newSession)
    │       └── new access token + new refresh token
    │
    └── set-cookie: refresh_token=<newJwt>; HttpOnly; ...
    │
    ▼
{ accessToken, user }
```

### Token Reuse Attack Detection

```
Scenario: attacker steals a refresh token and uses it.

First request (legitimate or attacker):
  - Token is valid → session rotated → new jti stored
  - If within grace window of last use: allowed

Second request (attacker with old token, after rotation):
  - Token jti no longer matches current DB jti
  - outside grace window → ALL sessions revoked for user
  - TokenReuseDetectedError → 401
```

## JWT Guard — Request Authentication

```
JwtGuard.canActivate(context)
    │
    ├── isPublic = Reflector.get(IS_PUBLIC_KEY, context.getHandler())
    │       └── Reads @Public() metadata from handler or controller
    │       └── if true: return true immediately
    │
    ├── token = extractBearerToken(request)
    │       └── if missing: throw UnauthorizedException
    │
    ├── payload = JwtService.verifyAsync(token)
    │       └── if invalid: throw UnauthorizedException
    │
    ├── request.user = payload
    │       └── attaches JwtPayload to request for @CurrentUser()
    │
    └── return true
```

## OAuth Token Verification

```
GoogleOAuthAdapter.verifyIdToken(idToken)
    │
    ├── Google token verification endpoint (Google's public keys)
    ├── Validates: iss, aud, exp, email_verified
    └── Returns: { email, sub: googleUserId, email_verified }
```

## Cookie Configuration

| Setting | Value | Evidence |
|---|---|---|
| `httpOnly` | `true` | `src/modules/auth/infrastructure/tokens/cookie-config.ts` |
| `secure` | `true` | `src/modules/auth/infrastructure/tokens/cookie-config.ts` |
| `sameSite` | `'strict'` | `src/modules/auth/infrastructure/tokens/cookie-config.ts` |
| `path` | `'/'` | `src/modules/auth/infrastructure/tokens/cookie-config.ts` |
| `maxAge` | `sessionsConfig.refreshTokenCookieMaxAgeMs` | Config-driven |

## Session Lifecycle

```
Session created (INSERT user_sessions)
    │
    ├── valid: revokedAt IS NULL AND expiresAt > now
    │
    ▼ [logout — single]
Session.revokedAt = now
    │
    ▼ [logout-all — all other]
Sessions WHERE userId = X AND sessionId ≠ current: revokedAt = now
    │
    ▼ [password change]
Sessions WHERE userId = X AND sessionId ≠ current: revokedAt = now
    │
    ▼ [account deletion]
Sessions WHERE userId = X: revokedAt = now
    │
    ▼ [max sessions exceeded]
LRU eviction: oldest by lastUsedAt → revokedAt = now
    │
    ▼ [token reuse detected]
Sessions WHERE userId = X: revokedAt = now
```

## Logout

```
DELETE /api/v1/auth/logout
Cookie: refresh_token=<jwt>
    │
    ▼
SessionManagementService.revokeSession(sessionId, userId)
    │
    ├── verify session belongs to user (ownership check)
    └── UPDATE user_sessions SET revokedAt = now WHERE sessionId = X

DELETE /api/v1/auth/logout-all
    │
    ▼
SessionManagementService.revokeAllOtherSessions(currentSessionId, userId)
    │
    └── UPDATE user_sessions SET revokedAt = now
        WHERE userId = X AND sessionId ≠ currentSessionId
```

## Password Change

```
POST /api/v1/auth/change-password
Body: { currentPassword, newPassword }
    │
    ▼
ChangePasswordService.changePasswordAndRevokeOtherSessions(userId, currentPassword, newPassword)
    │
    ├── validate currentPassword against stored hash
    ├── check newPassword against password history (last 5)
    ├── archive old hash: INSERT INTO password_history (...)
    ├── UPDATE users SET passwordHash = newHash, passwordChangedAt = now
    ├── UPDATE user_sessions SET revokedAt = now WHERE userId = X AND sessionId ≠ current
    ├── INSERT INTO outbox_events (eventType: 'password_changed')
    └── AuditLogService.record(eventType: 'password_changed')
```

## Needs Clarification

- The `bufferLogs: true` option in `NestFactory.create()` collects boot logs in a buffer. The mechanism for flushing this buffer to the logger after the app is ready is not traced.
- The Google OAuth ID token verification uses Google endpoints directly; whether token caching or Google API key rate limits are a concern is not documented.
- The session expiry is stored as `expiresAt` but the session cleanup mechanism (the `auth-session-cleanup.service.ts`) is referenced but its cron schedule is not traced.