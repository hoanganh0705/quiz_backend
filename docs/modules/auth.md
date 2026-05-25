# Auth Module — API Documentation

> **Base URL**: `/api/v1/auth`
> **Generated from source**: `src/modules/auth/`

---

## Module Overview

| Aspect | Detail |
|---|---|
| **Purpose** | User authentication, session management, email verification |
| **Business responsibility** | Register → verify email → login → token refresh → logout lifecycle |
| **Transport** | HTTP REST (no WebSocket events) |
| **Global prefix** | `/api/v1` (set in `main.ts`) |
| **Controller prefix** | `/auth` |

### Security Summary

- All endpoints use **`@Public()`** decorator except `POST /logout-all`, which requires a valid **Bearer access token**.
- Refresh tokens are transported exclusively via **httpOnly cookies** — never in request/response bodies.
- Access tokens are short-lived JWTs sent in JSON response bodies and must be stored client-side (memory recommended).
- Global `JwtGuard` is applied at the app level; `@Public()` bypasses it.
- Rate limiting: global `ThrottlerGuard` + per-endpoint `@Throttle()` overrides + Redis-backed auth-specific rate limits.

---

## API Endpoints

---

### POST `/api/v1/auth/register`

#### Description

Registers a new user account. Always returns a generic success message regardless of whether the email/username already exists (prevents user enumeration). Sends a verification email asynchronously.

#### Authentication

**None** — `@Public()` route.

#### Authorization

None.

#### Rate Limiting

- `@Throttle`: 5 requests per 60 seconds (per IP, via global ThrottlerGuard).

#### Request Body

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "MyP@ssw0rd!"
}
```

#### Validation Rules

| Field | Type | Rules |
|---|---|---|
| `username` | `string` | Required. 3–50 chars. Pattern: `/^[a-zA-Z0-9._-]+$/` (letters, numbers, periods, underscores, hyphens only). |
| `email` | `string` | Required. Valid email format. Max 255 chars. |
| `password` | `string` | Required. 6–100 chars. Must contain ≥1 uppercase letter, ≥1 number, ≥1 special character. Pattern: `/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/` |

#### Response — `200 OK`

```json
{
  "data": {
    "message": "If your registration can be completed, a verification email will be sent."
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

#### Error Responses

| Status | When |
|---|---|
| `400 Bad Request` | Validation failure (missing/invalid fields) |
| `429 Too Many Requests` | Throttle limit exceeded |

#### Internal Flow

1. Normalize email (trim + lowercase) and username (trim + lowercase).
2. Check if user with same email exists:
   - If exists and **unverified**: re-send verification email (fire-and-forget), return generic message.
   - If exists and **verified**: return same generic message (no enumeration leak).
3. Ensure email + username are both available (conflict → return generic message).
4. Hash password with bcrypt (cost factor 12).
5. Create user record in database.
6. Generate 64-char hex verification token, hash with SHA-256, persist token + expiry.
7. Enqueue verification email (fire-and-forget).
8. Return generic success message.

#### Notes For Frontend Developers

- **The response message is intentionally generic.** Do not try to infer success/failure from the message text.
- After registration, redirect user to a "check your email" page.
- Username is normalized to lowercase server-side.
- Extra fields in the request body will cause a `400` error (`forbidNonWhitelisted: true`).

---

### POST `/api/v1/auth/verify-email`

#### Description

Verifies a user's email address using the token sent via email. Returns a generic message regardless of whether the token was valid (prevents information leakage).

#### Authentication

**None** — `@Public()` route.

#### Authorization

None.

#### Rate Limiting

- `@Throttle`: 10 requests per 60 seconds.

#### Request Body

```json
{
  "token": "a1b2c3d4e5f6...64_hex_chars"
}
```

#### Validation Rules

| Field | Type | Rules |
|---|---|---|
| `token` | `string` | Required. 32–512 chars. |

#### Response — `200 OK`

```json
{
  "data": {
    "message": "Verification processed. If valid, your email is now verified."
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

#### Error Responses

| Status | When |
|---|---|
| `400 Bad Request` | Validation failure |
| `429 Too Many Requests` | Throttle limit exceeded |

#### Internal Flow

1. SHA-256 hash the raw token.
2. Look up a user whose stored token hash matches and has not expired.
3. If found, mark user as verified and clear the verification token.
4. Return generic success message regardless.

#### Notes For Frontend Developers

- Extract the token from the verification link query param (e.g., `?token=abc123...`) and send it in the request body.
- After success, redirect user to the login page.
- Token TTL is configurable server-side (default: 30 minutes).

---

### POST `/api/v1/auth/resend-verification-email`

#### Description

Re-sends the email verification email. Returns a generic message regardless of whether the email exists or is already verified.

#### Authentication

**None** — `@Public()` route.

#### Authorization

None.

#### Rate Limiting

- `@Throttle`: 5 requests per 60 seconds.

#### Request Body

```json
{
  "email": "john@example.com"
}
```

#### Validation Rules

| Field | Type | Rules |
|---|---|---|
| `email` | `string` | Required. Valid email format. Max 255 chars. |

#### Response — `200 OK`

```json
{
  "data": {
    "message": "If this email exists and is not verified, a verification email has been sent."
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

#### Error Responses

| Status | When |
|---|---|
| `400 Bad Request` | Validation failure |
| `429 Too Many Requests` | Throttle limit exceeded |

#### Internal Flow

1. Normalize email (trim + lowercase).
2. Look up user. If not found or already verified → return generic message.
3. Generate new verification token, hash it, persist, enqueue email.
4. Return generic message.

#### Notes For Frontend Developers

- Show a "resend" button on the verification pending page.
- Safe to call multiple times — each call generates a new token, invalidating the previous one.

---

### POST `/api/v1/auth/login`

#### Description

Authenticates a user with email and password. Returns user info + access token in the response body and sets a refresh token as an httpOnly cookie.

#### Authentication

**None** — `@Public()` route.

#### Authorization

None.

#### Rate Limiting

- Global ThrottlerGuard (application-wide IP throttling).
- Auth-specific Redis rate limits:
  - **Per IP**: 10 requests/minute.
  - **Per user**: 8 requests/minute (applied after user lookup).

#### Request Body

```json
{
  "email": "john@example.com",
  "password": "MyP@ssw0rd!"
}
```

#### Validation Rules

| Field | Type | Rules |
|---|---|---|
| `email` | `string` | Required. Valid email format. |
| `password` | `string` | Required. 6–100 chars. |

#### Response — `200 OK`

```json
{
  "data": {
    "userId": "clxyz1234567890",
    "username": "john_doe",
    "email": "john@example.com",
    "token": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

#### Set-Cookie Header (Automatic)

```
Set-Cookie: refreshToken=eyJhbGciOiJI...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<configured_ms>
```

> [!IMPORTANT]
> The refresh token is **never** included in the JSON response body. It is only set as an httpOnly cookie. Frontend code cannot and should not read it directly.

#### Error Responses

| Status | Message | When |
|---|---|---|
| `401 Unauthorized` | `"Invalid email or password"` | Wrong email, wrong password, or unverified email |
| `429 Too Many Requests` | `"Too many requests. Please try again later."` | Auth-specific rate limit exceeded |
| `400 Bad Request` | Validation errors | Invalid request body |

#### Internal Flow

1. Enforce IP-based rate limit.
2. Normalize email (trim + lowercase).
3. Look up user by email.
4. If not found → perform dummy bcrypt comparison (timing attack mitigation) → throw `401`.
5. Enforce user-based rate limit.
6. If email not verified → dummy bcrypt → enqueue verification email (cooldown: 10 min, fire-and-forget) → throw `401`.
7. Compare password with stored bcrypt hash.
8. If mismatch → throw `401`.
9. Issue access token + refresh token (JWT pair).
10. Create session record (with IP, device browser, device OS, device type).
11. Session limit enforcement: if user exceeds max active sessions (default: 5), oldest sessions are evicted.
12. Set refresh token cookie via interceptor.
13. Return user info + access token.

#### Notes For Frontend Developers

- **Store the access token in memory** (not localStorage). It is short-lived.
- The refresh token cookie is set automatically — ensure `credentials: 'include'` (fetch) or `withCredentials: true` (axios) is set on all auth-related requests.
- The same `401` error is returned for all failure reasons (wrong email, wrong password, unverified) to prevent user enumeration.
- If the user hasn't verified their email, a verification email may be silently re-sent (max once per 10 minutes).

---

### POST `/api/v1/auth/refresh-token`

#### Description

Exchanges a valid refresh token (from cookie) for a new access token and a rotated refresh token. Implements **refresh token rotation** with **reuse detection**.

#### Authentication

**None** — `@Public()` route. Authentication is performed via the refresh token cookie.

#### Authorization

None.

#### Rate Limiting

- Auth-specific Redis rate limits:
  - **Per IP**: 30 requests/minute.
  - **Per user**: 20 requests/minute.

#### Request Body

None.

#### Required Cookie

| Cookie | Required | Description |
|---|---|---|
| `refreshToken` | **Yes** | httpOnly cookie containing the JWT refresh token |

#### Response — `200 OK`

```json
{
  "data": {
    "token": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

#### Set-Cookie Header (Automatic)

A new `refreshToken` cookie is set with the rotated token.

#### Error Responses

| Status | Message | When |
|---|---|---|
| `401 Unauthorized` | `"Refresh token cookie is missing"` | No refresh token cookie present |
| `401 Unauthorized` | `"Invalid or expired refresh token"` | JWT verification failed |
| `401 Unauthorized` | `"Refresh token reuse detected. All sessions have been revoked"` | Token reuse attack detected |
| `401 Unauthorized` | `"Session context mismatch"` | Device fingerprint mismatch (strict mode) |
| `401 Unauthorized` | `"User not found"` | User was deleted/deactivated |
| `429 Too Many Requests` | `"Too many requests. Please try again later."` | Rate limit exceeded |

#### Internal Flow

1. Extract refresh token from cookie (required — 401 if missing).
2. Verify JWT signature, issuer, audience, and expiry.
3. Enforce rate limits (IP + user).
4. Resolve session by JTI. If not found:
   - Look up latest active session. If within grace window (default: 10s) and same device context → allow (handles concurrent tab refresh).
   - Otherwise → **revoke ALL user sessions** + throw 401 (reuse detection).
5. Verify refresh token hash matches stored session hash.
   - Mismatch + within grace window → allow (first occurrence only; second triggers full revocation).
   - Mismatch + outside grace window → **revoke ALL** + throw 401.
6. Evaluate session binding (IP change, device mismatch):
   - IP-only change → log warning, allow (mobile network/NAT tolerance).
   - Device mismatch in strict mode → reject with 401.
7. Look up current user identity.
8. Issue new token pair (access + refresh).
9. Rotate session record (new JTI, new hash, updated device info).
10. Set new refresh token cookie.

> [!WARNING]
> **Token reuse detection** is a critical security feature. If a refresh token is replayed after it has been rotated (i.e., a stolen token is used), **all of that user's sessions are immediately revoked**. The user will need to log in again on all devices.

#### Notes For Frontend Developers

- Call this endpoint before the access token expires. A good pattern is to refresh when the token has < 1 minute remaining.
- **Do NOT** call this endpoint concurrently from multiple tabs. Use a mutex/lock or `BroadcastChannel` to coordinate. Concurrent refreshes may trigger reuse detection and force a full logout.
- There is a short grace window (~10 seconds) that tolerates a single duplicate refresh (e.g., from a race condition), but a second duplicate within the window will revoke everything.
- Always include `credentials: 'include'` so the cookie is sent.

---

### POST `/api/v1/auth/logout`

#### Description

Logs out the current session by revoking the refresh token and clearing the cookie. Intentionally public to allow cookie cleanup even with an expired access token.

#### Authentication

**None** — `@Public()` (intentionally, to allow clearing cookies with expired access tokens).

#### Authorization

None.

#### Request Body

None.

#### Required Cookie

| Cookie | Required | Description |
|---|---|---|
| `refreshToken` | No | httpOnly cookie. If present, the session is revoked server-side. |

#### Response — `200 OK`

```json
{
  "data": {
    "message": "Logged out successfully"
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

#### Set-Cookie Header (Automatic)

```
Set-Cookie: refreshToken=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0
```

The refresh token cookie is **always cleared** regardless of whether server-side revocation succeeded.

#### Internal Flow

1. Extract refresh token from cookie (optional).
2. If present:
   - Try to verify the JWT. If valid → revoke session by JTI.
   - If JWT verification fails → fallback: hash the raw token and revoke by hash.
3. Clear the refresh token cookie via `Set-Cookie`.
4. Return success message.

#### Notes For Frontend Developers

- Call this endpoint on user logout, then clear the access token from memory.
- Safe to call even if the user's access token has expired.
- Safe to call without a refresh token cookie — it will still return 200 and attempt to clear the cookie.

---

### POST `/api/v1/auth/logout-all`

#### Description

Revokes **all active sessions** for the authenticated user. The user will be logged out from every device/browser.

#### Authentication

**Required** — Bearer access token in `Authorization` header.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Authorization

Any authenticated user (no role restriction).

#### Request Body

None.

#### Response — `200 OK`

```json
{
  "data": {
    "message": "Logged out from all sessions successfully"
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

#### Set-Cookie Header (Automatic)

The refresh token cookie is cleared on the current request.

#### Error Responses

| Status | Message | When |
|---|---|---|
| `401 Unauthorized` | `"Authorization header is missing"` | No auth header |
| `401 Unauthorized` | `"Invalid authorization header format"` | Not `Bearer <token>` |
| `401 Unauthorized` | `"Invalid or expired access token"` | Token verification failed |

#### Internal Flow

1. `JwtGuard` validates the access token → extracts `userId` from `sub` claim.
2. Revoke all active sessions for that user in the database.
3. Clear refresh token cookie on the current request.
4. Return success message.

#### Notes For Frontend Developers

- Use this for a "sign out everywhere" feature.
- After calling this, all other tabs/devices will fail on their next refresh-token call and should redirect to login.
- The current client should also clear its in-memory access token.

---

## Response Format Convention

All successful responses are wrapped by the global `ResponseFormatInterceptor`:

```typescript
{
  data: T | null,
  meta: {
    timestamp: string,  // ISO 8601
    pagination?: {...}  // only for paginated endpoints (not applicable to auth)
  }
}
```

- Temporal fields (keys matching `/(time|timestamp|date|at)$/i`) are automatically normalized to ISO 8601 strings.
- Paginated responses use `{ items, pagination }` → transformed to `{ data: items, meta: { pagination } }`.

---

## Error Format Convention

All errors are handled by the `GlobalExceptionFilter` and follow this structure:

```json
{
  "data": {
    "statusCode": 401,
    "message": "Invalid email or password",
    "error": "Unauthorized",
    "requestId": "req-abc123",
    "path": "/api/v1/auth/login",
    "method": "POST"
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

> [!NOTE]
> Auth domain errors are first caught by `AuthDomainExceptionFilter`, which maps domain errors to HTTP status codes. These are then handled by the global filter for consistent formatting.

### Auth-Specific Error Mapping

| Domain Error | HTTP Status | Default Message |
|---|---|---|
| `InvalidCredentialsError` | `401` | `"Invalid email or password"` |
| `InvalidRefreshTokenError` | `401` | `"Invalid or expired refresh token"` |
| `TokenReuseDetectedError` | `401` | `"Refresh token reuse detected. All sessions have been revoked"` |
| `SessionContextMismatchError` | `401` | `"Session context mismatch"` |
| `UserNotFoundError` | `401` | `"User not found"` |
| `RateLimitExceededError` | `429` | `"Too many requests. Please try again later."` |

### Validation Error Format (`400 Bad Request`)

When request body validation fails:

```json
{
  "data": {
    "statusCode": 400,
    "message": [
      "username can only contain letters, numbers, periods, underscores, and hyphens.",
      "password must contain at least 1 uppercase letter, 1 number, and 1 special character",
      "email must be an email"
    ],
    "error": "Bad Request",
    "requestId": "req-abc123",
    "path": "/api/v1/auth/register",
    "method": "POST"
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

> [!TIP]
> The `message` field is a **string array** for validation errors. Check `Array.isArray(data.message)` to handle both single-message and multi-message errors.

---

## Cookie / Token Behavior

### Access Token

| Property | Value |
|---|---|
| Transport | JSON response body (`data.token.accessToken`) |
| Type | JWT (signed with HMAC) |
| Lifetime | Configurable (env: `ACCESS_TOKEN_EXPIRES_IN`) |
| Storage | **In-memory only** (recommended) |
| Usage | `Authorization: Bearer <token>` header |

#### Access Token JWT Payload

```json
{
  "sub": "user-uuid-here",
  "role": "user",
  "iss": "configured-issuer",
  "aud": "configured-audience",
  "exp": 1716649200,
  "iat": 1716648300
}
```

| Claim | Type | Description |
|---|---|---|
| `sub` | `string` | User ID |
| `role` | `"admin" \| "moderator" \| "user"` | User role |
| `iss` | `string` | Token issuer |
| `aud` | `string` | Token audience |
| `exp` | `number` | Expiration timestamp (Unix seconds) |
| `iat` | `number` | Issued-at timestamp (Unix seconds) |

### Refresh Token

| Property | Value |
|---|---|
| Transport | httpOnly cookie named `refreshToken` |
| Type | JWT (signed with separate secret) |
| Lifetime | Configurable (env: `REFRESH_TOKEN_EXPIRES_IN`) |
| Cookie flags | `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/` |
| Storage | Managed by browser cookie jar |
| Rotation | **Yes** — new token issued on every refresh |
| Reuse detection | **Yes** — replayed tokens revoke all sessions |

### Session Limits

| Config | Default | Description |
|---|---|---|
| Max active sessions per user | `5` | Oldest session evicted when limit exceeded |
| Refresh reuse grace window | `10 seconds` | Tolerance for concurrent refresh race conditions |
| Session binding strict mode | `false` | When `true`, device fingerprint mismatch rejects refresh |

---

## Frontend Integration Notes

### CORS Configuration

Ensure your frontend origin is listed in the backend's `CORS_ORIGINS` environment variable. Credentials (cookies) require explicit origin allowlisting in production.

### Axios / Fetch Setup

```typescript
// Axios
const api = axios.create({
  baseURL: 'https://your-api.com/api/v1',
  withCredentials: true,  // REQUIRED for cookie transport
});

// Fetch
fetch('https://your-api.com/api/v1/auth/login', {
  method: 'POST',
  credentials: 'include',  // REQUIRED for cookie transport
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
```

### Recommended Token Refresh Strategy

```
1. On login success → store accessToken in memory (e.g., Zustand/React state).
2. Before each API call → check if accessToken is about to expire (decode exp claim).
3. If expiring soon → call POST /auth/refresh-token FIRST.
4. Use a mutex to prevent concurrent refresh calls across tabs.
5. On 401 from refresh → redirect to login.
```

### Handling Multi-Tab Scenarios

```typescript
// Use BroadcastChannel to coordinate token refresh across tabs
const channel = new BroadcastChannel('auth');

channel.onmessage = (event) => {
  if (event.data.type === 'TOKEN_REFRESHED') {
    // Another tab refreshed — update local access token
    setAccessToken(event.data.accessToken);
  }
  if (event.data.type === 'LOGGED_OUT') {
    // Another tab logged out — redirect to login
    redirectToLogin();
  }
};
```

### Request Validation

- `whitelist: true` → extra fields are **silently stripped**.
- `forbidNonWhitelisted: true` → extra fields cause a **400 error**.
- `transform: true` → type coercion is applied (e.g., string → number).

> [!CAUTION]
> Sending unexpected fields in the request body will result in a `400 Bad Request` error. Ensure your request payloads match the documented schema exactly.

---

## TypeScript Interfaces

```typescript
// ============================================================
// REQUEST TYPES
// ============================================================

interface RegisterRequest {
  /** 3–50 chars. Alphanumeric + periods, underscores, hyphens. */
  username: string;
  /** Valid email format. Max 255 chars. */
  email: string;
  /** 6–100 chars. Must contain ≥1 uppercase, ≥1 number, ≥1 special char. */
  password: string;
}

interface LoginRequest {
  /** Valid email format. */
  email: string;
  /** 6–100 chars. */
  password: string;
}

interface VerifyEmailRequest {
  /** 32–512 chars. Hex token from verification email link. */
  token: string;
}

interface ResendVerificationRequest {
  /** Valid email format. Max 255 chars. */
  email: string;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

/** Standard API envelope for all responses. */
interface ApiResponse<T> {
  data: T | null;
  meta: {
    timestamp: string;
    pagination?: PaginationMeta;
  };
}

interface PaginationMeta {
  [key: string]: unknown;
}

/** Standard API error envelope. */
interface ApiErrorResponse {
  data: {
    statusCode: number;
    message: string | string[];
    error: string;
    requestId?: string;
    path: string;
    method: string;
  };
  meta: {
    timestamp: string;
  };
}

// --- Auth-specific response payloads ---

interface TokenPayload {
  accessToken: string;
}

interface LoginResponse {
  userId: string;
  username: string;
  email: string;
  token: TokenPayload;
}

interface RefreshTokenResponse {
  token: TokenPayload;
}

interface LogoutResponse {
  message: string;
}

interface RegisterResponse {
  message: string;
}

interface VerifyEmailResponse {
  message: string;
}

// ============================================================
// ACCESS TOKEN JWT CLAIMS (decoded)
// ============================================================

type UserRole = 'admin' | 'moderator' | 'user';

interface AccessTokenPayload {
  /** User ID */
  sub: string;
  /** User role */
  role: UserRole;
  /** Issuer */
  iss: string;
  /** Audience */
  aud: string;
  /** Expiration (Unix seconds) */
  exp: number;
  /** Issued at (Unix seconds) */
  iat: number;
}

// ============================================================
// UTILITY: Type-safe response wrappers
// ============================================================

type LoginApiResponse = ApiResponse<LoginResponse>;
type RefreshTokenApiResponse = ApiResponse<RefreshTokenResponse>;
type LogoutApiResponse = ApiResponse<LogoutResponse>;
type RegisterApiResponse = ApiResponse<RegisterResponse>;
type VerifyEmailApiResponse = ApiResponse<VerifyEmailResponse>;
```

---

## Endpoint Quick Reference

| Method | Path | Auth | Body | Cookie | Description |
|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | ❌ | `RegisterRequest` | — | Create account |
| `POST` | `/api/v1/auth/verify-email` | ❌ | `VerifyEmailRequest` | — | Verify email |
| `POST` | `/api/v1/auth/resend-verification-email` | ❌ | `ResendVerificationRequest` | — | Resend verification |
| `POST` | `/api/v1/auth/login` | ❌ | `LoginRequest` | **Sets** `refreshToken` | Log in |
| `POST` | `/api/v1/auth/refresh-token` | ❌ | — | **Reads** `refreshToken` | Rotate tokens |
| `POST` | `/api/v1/auth/logout` | ❌ | — | **Clears** `refreshToken` | Log out |
| `POST` | `/api/v1/auth/logout-all` | ✅ Bearer | — | **Clears** `refreshToken` | Log out everywhere |
