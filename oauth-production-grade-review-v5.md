# OAuth Integration — Production-Grade Architecture Plan

> **Status:** Final architecture for implementation

This document defines the production OAuth architecture for the auth module. All decisions below are final and intended to be implemented as written.

---

## 1. Core Architecture Decisions

### 1.1 Provider validation

OAuth providers are modeled as an application concern, not a database concern.

**Final rule:** "Provider validation is enforced exclusively by the `OAuthProvider` type and application-layer validation. Database-level provider constraints are intentionally omitted."

This keeps provider onboarding future-proof. Adding a new provider must not require a database `CHECK` constraint change.

### 1.2 OAuth account ownership model

`oauth_accounts` stores only the durable provider link:

- `oauthAccountId`
- `userId`
- `provider`
- `providerUserId`
- `createdAt`

`users.email` remains the only persisted source of truth for email.

`oauth_accounts.email` is intentionally omitted from:

- database schema
- Drizzle schema
- repository DTOs
- repository return types
- event payloads
- diagrams
- examples

### 1.3 Provider authentication contract

The domain must not assume every provider authenticates with a single token string.

The provider port therefore uses a future-proof authentication payload:

```typescript
export type OAuthAuthenticationPayload = {
  code?: string;
  idToken?: string;
  accessToken?: string;
};
```

This supports:

- Google ID token flows
- GitHub authorization-code exchange flows
- Microsoft access-token-based flows
- future signed-assertion flows

### 1.4 Username allocation

Username generation is deterministic and reproducible. Uniqueness is guaranteed by database retries and unique constraints, not randomness.

Candidate order is:

1. `john`
2. `john_<userId4>`
3. `john_<userId8>`
4. `user_<userId8>`

There is no `Math.random()` anywhere in the username path.

### 1.5 User ID generation

`OAuthAccountRepository` generates the new `userId` before any inserts occur.

That same `preGeneratedUserId` must be used for:

- deterministic username candidate generation
- `users.userId`
- `oauth_accounts.userId`

The architecture must never rely on `defaultRandom()` for OAuth user creation.

### 1.6 Failed-login audit policy

Invalid provider credentials must not create unbounded durable outbox rows.

Final policy:

- `InvalidOAuthTokenError` -> log + metrics only, no outbox event
- `UserNotFoundError` -> durable outbox event allowed
- `RateLimitExceededError` -> durable outbox event allowed
- `TokenReuseDetectedError` -> durable outbox event allowed

This prevents outbox flooding from invalid token spam while preserving durable audit trails for meaningful security events.

---

## 2. Canonical Types and Ports

### 2.1 OAuth provider types

```typescript
export type OAuthProvider = 'google' | 'github' | 'apple' | 'microsoft';

export type OAuthAuthenticationPayload = {
  code?: string;
  idToken?: string;
  accessToken?: string;
};

export type OAuthUserInfo = {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
};
```

### 2.2 OAuth provider port

```typescript
export interface OAuthProviderPort {
  readonly provider: OAuthProvider;

  authenticate(payload: OAuthAuthenticationPayload): Promise<OAuthUserInfo>;
}

export const OAUTH_PROVIDER_PORT = Symbol('OAUTH_PROVIDER_PORT');
```

Contract rules:

- Implementations validate signature, audience, issuer, expiry, and provider-specific claims
- Implementations return normalized `OAuthUserInfo`
- Implementations throw `InvalidOAuthTokenError` for any validation failure
- Provider tokens must never be persisted, logged, or forwarded after authentication completes

### 2.3 OAuth account record

```typescript
export type OAuthAccountRecord = {
  oauthAccountId: string;
  userId: string;
  provider: OAuthProvider;
  providerUserId: string;
  createdAt: string;
};
```

### 2.4 OAuth account repository port

```typescript
export interface OAuthAccountRepositoryPort {
  findByProviderAndProviderUserId(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthAccountRecord | null>;

  findByUserIdAndProvider(
    userId: string,
    provider: OAuthProvider,
  ): Promise<OAuthAccountRecord | null>;

  createOAuthUserWithLink(params: {
    provider: OAuthProvider;
    providerUserId: string;
    email: string;
  }): Promise<{
    userId: string;
    username: string;
    email: string;
    role: string;
    oauthAccountId: string;
  }>;

  linkOAuthAccountToExistingUser(params: {
    userId: string;
    provider: OAuthProvider;
    providerUserId: string;
  }): Promise<OAuthAccountRecord>;
}
```

Repository rules:

- repository-owned methods own the `db.transaction()` boundary
- the repository generates `preGeneratedUserId` for new OAuth users
- the repository derives deterministic username candidates from that ID
- the repository inserts `userId: preGeneratedUserId` explicitly
- the repository inserts `oauth_accounts.userId = preGeneratedUserId` explicitly
- outbox events are written inside the same transaction as data writes
- linking is invoked only for existing users whose `isVerified === true`
- unverified existing users are rejected in the domain service before any repository write occurs

### 2.5 User repository additions

```typescript
findActiveIdentityByEmail(email: string): Promise<{
  userId: string;
  username: string;
  email: string;
  isVerified: boolean;
  role: AuthIdentity['role'];
} | null>;
```

`createOAuthUser()` on `UserRepositoryPort` is intentionally removed. OAuth user creation is cross-table work and belongs only in `OAuthAccountRepository`.

---

## 3. Database Design

````

There is no `oauth_accounts_provider_check` constraint.

### 3.2 Drizzle schema

```typescript
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    oauthAccountId: uuid('oauth_account_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_oauth_accounts_provider_provider_user_id').using(
      'btree',
      table.provider.asc().nullsLast().op('text_ops'),
      table.providerUserId.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('uq_oauth_accounts_user_id_provider').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.provider.asc().nullsLast().op('text_ops'),
    ),
    index('idx_oauth_accounts_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'oauth_accounts_user_id_fkey',
    }).onDelete('cascade'),
  ],
);
````

No Drizzle `check(...)` constraint is defined for provider values.

---

## 4. Domain Constants and Errors

### 4.1 Password sentinel

```typescript
export const OAUTH_NO_PASSWORD_SENTINEL = '__OAUTH_NO_PASSWORD__';
```

### 4.2 Domain errors

```typescript
export class InvalidOAuthTokenError extends AuthDomainError {
  constructor(message = 'Invalid or expired OAuth credentials') {
    super(message);
  }
}

export class OAuthAccountAlreadyExistsError extends AuthDomainError {
  constructor() {
    super('OAuth account link already exists');
  }
}

export class OAuthAccountLinkingRequiredError extends AuthDomainError {
  constructor() {
    super(
      'Account linking requires explicit confirmation because the existing account is not verified.',
    );
  }
}
```

### 4.3 HTTP Error Mapping

- `InvalidOAuthTokenError` -> `401 Unauthorized`
- `OAuthAccountLinkingRequiredError` -> `409 Conflict`
- `RateLimitExceededError` -> `429 Too Many Requests`
- `TokenReuseDetectedError` -> `401 Unauthorized`
- `UserNotFoundError` -> `404 Not Found`

`OAuthAccountLinkingRequiredError` is exposed as HTTP `409 Conflict` because an account already exists but cannot be automatically linked.

---

## 5. Google Adapter Design

Google remains one adapter implementation of the generic port.

```typescript
@Injectable()
export class GoogleOAuthAdapter implements OAuthProviderPort {
  readonly provider: OAuthProvider = 'google';

  async authenticate(payload: OAuthAuthenticationPayload): Promise<OAuthUserInfo> {
    if (!payload.idToken) {
      throw new InvalidOAuthTokenError('Google authentication requires an idToken');
    }

    // verify Google ID token, validate issuer/audience/expiry/signature,
    // then return normalized OAuthUserInfo
  }
}
```

Google-specific rules:

- `payload.idToken` is required
- `payload.code` and `payload.accessToken` are ignored by this adapter
- issuer must be Google-approved
- audience must match `GOOGLE_CLIENT_ID`
- expired, malformed, or tampered tokens throw `InvalidOAuthTokenError`
- the verified token is discarded immediately after claim extraction

The domain no longer assumes a Google-only ID-token workflow. Google is simply one provider-specific implementation of `authenticate(payload)`.

---

## 6. Repository Workflow

### 6.1 Concurrency and atomicity

`OAuthAccountRepository` owns all multi-write OAuth operations.

Atomic methods:

- `createOAuthUserWithLink()`
- `linkOAuthAccountToExistingUser()`

Concurrency correctness is guaranteed through database uniqueness constraints and transaction isolation. `OAuthAccountRepository` must not use database locking primitives for OAuth concurrency control. Concurrent requests are resolved by `UNIQUE` constraints and duplicate-key conflict handling.

Explicit rules:

- No database locking primitives are used.
- No concurrency-control keys are generated.
- No explicit locking occurs.
- Duplicate provider links are prevented solely by unique constraints.
- `UNIQUE(provider, provider_user_id)` prevents duplicate provider identities.
- `UNIQUE(user_id, provider)` prevents duplicate links for the same provider on one user.
- Duplicate-key conflicts must be handled via SQLSTATE `23505` handling inside repository transaction boundaries.

### 6.2 New-user creation path

Implementation rules:

1. Generate `preGeneratedUserId` inside the repository before insert.
2. Derive username candidates from `email` + `preGeneratedUserId`.
3. Insert the user with `userId: preGeneratedUserId`.
4. Insert the OAuth link with `userId: preGeneratedUserId`.
5. Write `oauth_account_created` inside the same transaction.

Canonical insertion shape:

```typescript
const preGeneratedUserId = randomUUID();
const usernameCandidates = deriveUsernameCandidates(email, preGeneratedUserId);

const [user] = await tx
  .insert(users)
  .values({
    userId: preGeneratedUserId,
    email,
    username: selectedUsername,
    passwordHash: OAUTH_NO_PASSWORD_SENTINEL,
    isVerified: true,
  })
  .returning();

const [oauthAccount] = await tx
  .insert(oauthAccounts)
  .values({
    userId: preGeneratedUserId,
    provider,
    providerUserId,
  })
  .returning();
```

The repository must not rely on `defaultRandom()` to populate `users.userId` in this path.

### 6.3 Existing-user linking path

Canonical behavior:

- auto-link only when the existing user is already verified
- reject the flow when an existing user is present and `isVerified === false`
- create no OAuth link and modify no user state when explicit confirmation is required
- write `oauth_account_linked` only for verified existing users that are actually linked

Canonical insert shape:

```typescript
await tx.insert(oauthAccounts).values({
  userId: params.userId,
  provider: params.provider,
  providerUserId: params.providerUserId,
});
```

No email is stored in `oauth_accounts`.

If `findActiveIdentityByEmail(claims.email)` returns an existing user whose `isVerified === false`, the domain service must throw `OAuthAccountLinkingRequiredError` immediately. In that branch:

- no repository write method is called
- no OAuth account row is created
- no OAuth account row is linked
- no user verification state is changed
- no outbox event is emitted for linking

---

## 7. Deterministic Username Utility

### 7.1 Utility contract

```typescript
export function deriveUsernameCandidates(email: string, preGeneratedUserId: string): string[] {
  const local = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);

  const base = local || 'user';
  const compactUserId = preGeneratedUserId.replace(/-/g, '');

  return [
    base,
    `${base}_${compactUserId.slice(0, 4)}`,
    `${base}_${compactUserId.slice(0, 8)}`,
    `user_${compactUserId.slice(0, 8)}`,
  ];
}
```

There is no randomness in this utility.

### 7.2 Retry strategy

Uniqueness is enforced only by the database unique constraint on `users.username`.

Canonical retry behavior:

```typescript
for (const candidate of usernameCandidates) {
  await tx.execute(sql`SAVEPOINT username_attempt`);
  try {
    await tx.insert(users).values({
      userId: preGeneratedUserId,
      username: candidate,
      // ...
    });
    await tx.execute(sql`RELEASE SAVEPOINT username_attempt`);
    break;
  } catch (err: any) {
    if (err?.code !== '23505') throw err;
    await tx.execute(sql`ROLLBACK TO SAVEPOINT username_attempt`);
    await tx.execute(sql`RELEASE SAVEPOINT username_attempt`);
  }
}
```

The utility is deterministic; the repository provides uniqueness via retry-on-conflict.

---

## 8. Login Flow

### 8.1 Service name

The domain service is `OAuthLoginService`.

### 8.2 End-to-end sequence

```text
1. securityService.enforceLoginRateLimit(context)

2. claims = oauthProvider.authenticate(authenticationPayload)

3. record = oauthAccountRepository.findByProviderAndProviderUserId(
     provider,
     claims.providerUserId,
   )

4. If record exists:
     load active user by record.userId
     continue to session creation

5. If record does not exist:
     existingUser = userRepository.findActiveIdentityByEmail(claims.email)

6. If existingUser exists AND existingUser.isVerified === false:
     throw OAuthAccountLinkingRequiredError

7. If existingUser exists AND existingUser.isVerified === true:
     oauthAccountRepository.linkOAuthAccountToExistingUser({
       userId: existingUser.userId,
       provider,
       providerUserId: claims.providerUserId,
     })

8. If existingUser does not exist:
     oauthAccountRepository.createOAuthUserWithLink({
       provider,
       providerUserId: claims.providerUserId,
       email: claims.email,
     })

9. securityService.enforceLoginRateLimit(context, userId)

10. sessionService.createSession(...)

11. after session commit, schedule oauth_login outbox event

12. return LoginResult
```

`oauth_login` is scheduled only after session creation has committed. Login success must never depend on outbox availability. If `oauth_login` cannot be written because the outbox is temporarily unavailable, the login still succeeds and the failure is handled as an observability concern.

The controller example must pass structured authentication input, not a raw token string assumption:

```typescript
await this.oauthLoginService.login({
  provider: 'google',
  authentication: { idToken: dto.idToken },
  context: session,
});
```

The application service must preserve that provider-agnostic shape.

---

## 9. Outbox Event Registry

### 9.1 Durable OAuth events

| Event                   | Written by                                                | Transaction                        | Payload                                          |
| ----------------------- | --------------------------------------------------------- | ---------------------------------- | ------------------------------------------------ |
| `oauth_account_created` | `OAuthAccountRepository.createOAuthUserWithLink()`        | user creation tx                   | `{ userId, provider, providerUserId, username }` |
| `oauth_account_linked`  | `OAuthAccountRepository.linkOAuthAccountToExistingUser()` | link tx                            | `{ userId, provider, providerUserId }`           |
| `oauth_login`           | `OAuthLoginService` after successful session commit       | post-commit, eventually consistent | `{ userId, provider }`                           |
| `oauth_login_failed`    | `OAuthLoginService`                                       | standalone outbox tx               | `{ provider, reason, userId? }`                  |

`oauth_account_linked` is emitted only when an already verified existing account is linked. If an existing account is found with `isVerified === false`, the login flow throws `OAuthAccountLinkingRequiredError` before any link is created and no linking event is written.

`oauth_login` is an observability and audit event only. It is scheduled after session creation has committed. Session creation succeeds even if the outbox is temporarily unavailable. Failure to write `oauth_login` must not roll back login. `oauth_login` is eventually consistent.

### 9.2 Failed-login emission rules

`oauth_login_failed` is emitted only for:

- `UserNotFoundError`
- `RateLimitExceededError`
- `TokenReuseDetectedError`

`InvalidOAuthTokenError` does not emit a durable event.

Instead:

- increment security metrics
- write structured logs
- return the error

This is the mandatory protection against outbox flooding.

---

## 10. Security and Observability

### 10.1 Token handling invariant

Provider tokens are never persisted.

After `OAuthProviderPort.authenticate()` returns:

- the original provider credential is out of scope
- only normalized `OAuthUserInfo` remains
- downstream layers must not store provider tokens in any table, cache, or log

### 10.2 Invalid credential handling

For `InvalidOAuthTokenError`:

- log provider name, request context, and sanitized failure reason
- increment metrics counters
- do not write outbox rows

Recommended metrics:

- `oauth_invalid_token_total{provider=...}`
- `oauth_authentication_failed_total{provider=...,reason=...}`

### 10.3 Durable security events

Durable audit events remain required for:

- deleted-or-missing linked users
- login rate-limit violations
- refresh-token reuse / token reuse detection

Those are lower-volume, meaningful security signals and are appropriate for the outbox.

---

## 11. DTO and Transport Shape

Google controller DTO remains:

```typescript
export class GoogleLoginDto {
  @IsString()
  @MinLength(1)
  idToken!: string;
}
```

But the application-layer call becomes:

```typescript
async googleLogin(
  idToken: string,
  session: SessionRequestContext,
): Promise<{ response: LoginResponseDto; refreshToken: string; sessionId: string }> {
  const result = await this.oauthLoginService.login({
    provider: 'google',
    authentication: { idToken },
    context: session,
  });

  return {
    response: this.authResponseMapper.toLoginResponse(result),
    refreshToken: result.refreshToken,
    sessionId: result.sessionId,
  };
}
```

This preserves the current controller UX while keeping the domain contract provider-agnostic.

---

## 12. Architecture Diagram

```text
AuthController
  -> AuthApplicationService.googleLogin()
  -> OAuthLoginService.login({ provider: 'google', authentication: { idToken }, context })
  -> OAuthProviderPort.authenticate(payload)
     -> GoogleOAuthAdapter.authenticate({ idToken })
  -> OAuthAccountRepository.findByProviderAndProviderUserId()
  -> UserRepository.findActiveIdentityByEmail() [if needed]
  -> if existing user is unverified: throw OAuthAccountLinkingRequiredError
  -> OAuthAccountRepository.linkOAuthAccountToExistingUser() [verified existing user only]
     -> INSERT oauth_accounts(userId, provider, providerUserId, createdAt)
     -> outbox.scheduleEvent(..., tx)
  -> OAuthAccountRepository.createOAuthUserWithLink() [new user]
     -> preGeneratedUserId = randomUUID()
     -> deriveUsernameCandidates(email, preGeneratedUserId)
     -> INSERT users(userId: preGeneratedUserId, ...)
     -> INSERT oauth_accounts(userId: preGeneratedUserId, provider, providerUserId, createdAt)
     -> outbox.scheduleEvent(..., tx)
  -> SessionService.createSession(...)
  -> after session commit: schedule oauth_login
```

---

## 13. Test Requirements

### 13.1 Schema tests

- `oauth_accounts` has no email column
- `oauth_accounts` has no provider `CHECK` constraint
- `(provider, providerUserId)` remains unique
- `(userId, provider)` remains unique

### 13.2 Provider-port tests

- `authenticate({ idToken })` succeeds for valid Google credentials
- `authenticate({})` throws for Google because `idToken` is required
- future adapters can authenticate from `code` or `accessToken` without changing the interface

### 13.3 Username tests

- same email + same `preGeneratedUserId` always yields the same candidates
- output order is exactly `base`, `base_<id4>`, `base_<id8>`, `user_<id8>`
- no randomness appears in generated candidates

### 13.4 Repository tests

- repository generates `preGeneratedUserId` before insert
- inserted `users.userId` matches the generated ID
- inserted `oauth_accounts.userId` matches the same generated ID
- username candidates are derived from that same ID
- no `defaultRandom()` path is used for OAuth user creation
- `linkOAuthAccountToExistingUser()` is used only for verified existing users

### 13.5 Safe-linking tests

- verified existing user -> OAuth account is linked successfully
- unverified existing user -> `OAuthAccountLinkingRequiredError` is thrown
- unverified existing user -> no OAuth account row is created
- unverified existing user -> no OAuth account row is linked
- unverified existing user -> no user verification state is changed
- unverified existing user -> no linking outbox event is written

### 13.6 Failed-login event tests

- `InvalidOAuthTokenError` -> metrics/logs only, no outbox event
- `UserNotFoundError` -> `oauth_login_failed` durable event written
- `RateLimitExceededError` -> `oauth_login_failed` durable event written
- `TokenReuseDetectedError` -> `oauth_login_failed` durable event written

### 13.7 Login success event tests

- successful session creation commits even if `oauth_login` cannot be written
- failure to write `oauth_login` does not roll back login
- `oauth_login` is scheduled only after session commit

---

## 14. Implementation Checklist

1. Remove `oauth_accounts_provider_check` from migration design and documentation.
2. Remove Drizzle `check(...)` provider validation from schema examples.
3. Remove `oauth_accounts.email` from schema, repository types, examples, and events.
4. Replace `verifyToken(token: string)` with `authenticate(payload: OAuthAuthenticationPayload)`.
5. Update controller, application service, and sequence examples to pass structured authentication payloads.
6. Remove `Math.random()` from username generation.
7. Make username candidates deterministic and derived from `preGeneratedUserId`.
8. Move `preGeneratedUserId` generation into `OAuthAccountRepository`.
9. Show explicit `userId: preGeneratedUserId` inserts in repository examples.
10. Prevent durable failed-login events for `InvalidOAuthTokenError`.
11. Update observability and security sections to use metrics/logging for invalid tokens.
12. Keep durable failed-login events only for `UserNotFoundError`, `RateLimitExceededError`, and `TokenReuseDetectedError`.
13. Allow automatic account linking only for existing users whose `isVerified === true`.
14. Throw `OAuthAccountLinkingRequiredError` for unverified existing users before any write occurs.

---

## 15. Final Summary

This architecture is provider-agnostic, deterministic, and safe for implementation.

Its key invariants are:

- provider validity is enforced in the application layer, not via database `CHECK` constraints
- `oauth_accounts` stores only provider-link identity, never duplicated email
- provider authentication accepts a structured payload, not a token-only assumption
- username generation is deterministic and reproducible
- the repository generates and reuses one `preGeneratedUserId` across candidate generation and both inserts
- invalid OAuth tokens are observable through logs and metrics without creating outbox-flooding risk
- automatic linking is allowed only for existing verified users
- existing unverified users must go through explicit future confirmation and are rejected from auto-linking
