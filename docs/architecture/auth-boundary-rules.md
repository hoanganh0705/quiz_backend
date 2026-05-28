# Auth Boundary Rules

These rules define ownership for the Auth module to keep boundaries explicit and prevent accidental coupling.

## Scope

Auth owns authentication and session lifecycle policies:
- Credential verification and account verification flows
- Token issuance, rotation, and reuse detection
- Session creation, rotation, and revocation
- Auth-specific rate limiting and abuse protection
- Email verification token issuance

## What Belongs in Auth

Keep these concerns inside the Auth module:
- Login, registration, verification, refresh, logout use cases
- Session binding rules and security policy evaluation
- Auth-specific cache keys and counters
- Auth token adapters and crypto adapters
- Auth request context extraction and cookie effects (HTTP transport only)

## What Does Not Belong in Auth

Push these concerns to other modules or shared layers:
- User profile management, preferences, or non-auth identity data
- General email delivery logic (Auth only queues verification intents)
- Global rate limiting or API gateway throttling
- Auditing, analytics, or event tracking (emit events, do not implement)
- Device fingerprinting beyond what is required for session binding
- Cross-module security utilities that are not auth-specific

## Ports and Adapters Rules

- Domain and application layers depend only on ports.
- Infrastructure implements ports and can depend on external libraries.
- Transport layer translates HTTP DTOs to application commands.
- Domain must not depend on transport DTOs or HTTP context types.

## Data Ownership

- Auth owns session records and refresh token state.
- User module owns user profile data; Auth may read via ports only.
- Shared identifiers must be passed by value, not by shared ORM entities.

## When to Split a Concern Out of Auth

Split when a concern is used by at least one other module and is not auth-specific:
- Move to common or a dedicated module.
- Keep a thin auth adapter that depends on the shared service.

## Dependency Direction (Allowed)

- Transport -> Application -> Domain -> Ports -> Infrastructure
- Auth module -> shared core infrastructure (DB, Redis, logger)

## Dependency Direction (Not Allowed)

- Domain -> Transport
- Domain -> Infrastructure
- Auth -> other feature modules (except via ports)

## Practical Examples

- OK: Auth uses EmailModule via port to enqueue verification emails.
- OK: Auth uses Redis via cache port for rate limiting.
- Not OK: User module calls Auth repository directly.
- Not OK: Auth returns HTTP DTOs from domain or application.
