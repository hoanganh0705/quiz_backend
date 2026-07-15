# ADR-0012: Authentication Model — JWT Access + Refresh Token Rotation

## Status

Accepted

## Context

The system needs a secure authentication mechanism that supports both browser-based clients (cookies) and programmatic clients (Bearer tokens), handles session revocation, detects token reuse attacks, and provides a smooth OAuth integration path for social login.

## Decision

**Access token:** A short-lived (15-minute) JWT signed with RS256 (asymmetric). Contains `{ sub: userId, email, roles, permissions }`. Used as a Bearer token in the `Authorization` header or as a cookie (`access_token`).

**Refresh token:** A long-lived (7-day) opaque token stored in the database (`refresh_tokens` table). HttpOnly cookie (`httpOnly: true, secure: true, sameSite: 'strict'`). Single-use: rotation on every refresh — the old token is invalidated immediately upon use.

**Token reuse detection:** If a refresh token is used more than once (same `tokenId` submitted twice), the entire token family is revoked. This covers both accidental double-submit and token theft.

**Google OAuth:** OAuth 2.0 flow via `googleAuth()` endpoint. Google ID tokens are verified with Google's public keys. The result is either an account link (existing email) or new account creation.

**Logout:** Deletes the refresh token from the database. The access token remains valid until expiry (15 minutes). Clients should discard the access token on logout.

**Password change:** Issues a new refresh token and invalidates all existing refresh tokens for the user. This prevents continued sessions on stolen old tokens.

**JwtGuard:** `JwtGuard` extracts the access token from `Authorization: Bearer` header or `access_token` cookie. Validates signature, expiry, and active user. Rejects expired tokens. `PermissionsGuard` runs after `JwtGuard` and checks RBAC/permission claims.

## Consequences

**Advantages**
- Asymmetric (RS256) JWT signing means the server does not need to store the signing key to verify tokens; only the public key is needed.
- Refresh token rotation limits the damage from a stolen token: at most one 15-minute window is exposed.
- Token reuse detection catches both accidental and malicious reuse.
- HttpOnly cookies prevent XSS from stealing access tokens.
- `PermissionsGuard` can check permissions from the JWT payload without a database call.

**Trade-offs**
- Revoking a user's access requires waiting for the 15-minute token expiry. There is no active invalidation mechanism for access tokens.
- Refresh tokens stored in the database mean every token refresh requires a database write.
- RS256 key rotation requires manual process (new key pair, update env vars, restart all instances).
- The 7-day refresh token lifetime means a stolen cookie grants up to 7 days of access if not detected.

## Evidence

- `src/modules/auth/transport/strategies/jwt.strategy.ts` — RS256 JWT validation via `@nestjs/jwt`.
- `src/modules/auth/transport/strategies/refresh-token.strategy.ts` — refresh token cookie extraction.
- `src/modules/auth/domain/services/auth.service.ts` — `login`, `refreshTokens`, `logout`, `googleAuth`.
- `src/modules/auth/domain/services/token.service.ts` — `generateAccessToken`, `generateRefreshToken`, `rotateRefreshToken`.
- `src/modules/auth/infrastructure/repositories/refresh-token.repository.ts` — `revokeByUserId`, `revokeByTokenId`, `findByTokenId`, `revokeTokenFamily`.
- `src/modules/auth/domain/services/token-reuse-detector.service.ts` — `markUsedAndRevokeFamily`.
- `src/modules/auth/domain/services/google.service.ts` — Google OAuth token verification.
- `src/modules/auth/domain/errors/auth-domain.errors.ts` — `AUTH_TOKEN_REUSE_DETECTED`.
- `src/common/guards/jwt.guard.ts` — `JwtGuard` with cookie and header extraction.
- `src/modules/auth/infrastructure/repositories/user.repository.ts` — `softDeleteAccount` revokes all sessions atomically.
- `docs/architecture/authentication-flow.md` — complete token lifecycle diagram.
- `docs/PROJECT_CONSTITUTION.md` §3.4 (Choices already made) — JWT + refresh token pattern listed as a locked decision.
