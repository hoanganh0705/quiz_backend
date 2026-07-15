# Security Standard

> Project-specific rules for authentication, authorization, secrets, cookies, rate limiting, and audit.
> General OAuth/JWT semantics are framework knowledge; only conventions used in this codebase are documented.

## Purpose

Defines how requests are authenticated and authorized, how secrets are handled, how cookies are scoped, how rate limiting is configured, and how security-sensitive operations are audited.

## Scope

Applies to `src/common/authorization/`, `src/common/guards/`, `src/common/decorators/`, `src/common/utils/cookie-*.ts`, `src/commands/` operational tooling, the global `JwtGuard`, `PermissionsGuard`, `ThrottlerGuard`, and any sensitive write path. Out of scope: wire-format details (see `api.md`), validation details (see `validation.md`), OpenAPI mechanics (see `swagger.md`).

## Source of Truth

- `src/main.ts` — Helmet, CORS, global `ValidationPipe`.
- `src/app.module.ts:76-86` — global `ThrottlerGuard`, `JwtGuard`, `PermissionsGuard` wiring.
- `src/common/guards/jwt.guard.ts` — global JWT authentication.
- `src/common/authorization/guards/permissions.guard.ts` — role/permission check.
- `src/common/authorization/permissions.ts` — `Permission` enum, `ROLE_PERMISSIONS` map.
- `src/common/authorization/decorators/permissions.decorator.ts` — `@Permissions()`.
- `src/common/decorators/public.decorator.ts` — `@Public()` opt-out.
- `src/common/decorators/current-user.decorator.ts` — typed `JwtPayload` accessor.
- `src/common/audit/audit-log.service.ts` — cross-domain audit record.
- `src/core/config/env.validation.ts` — runtime env validation.
- `src/commands/outbox.ts` — production safety pattern (`ALLOW_PROD_OUTBOX_OPERATIONS`).

## Rules

### Authentication

- The application MUST be authenticated by default. `@Public()` (`src/common/decorators/public.decorator.ts`) is the only opt-out — applied per route, never globally.
- Authentication MUST use the global `JwtGuard` (`src/common/guards/jwt.guard.ts`). Adding a second guard for the same purpose is prohibited.
- The JWT payload MUST be a `JwtPayload` shape from `src/common/types/`; controllers MUST receive it via the `@CurrentUser()` decorator (`src/common/decorators/current-user.decorator.ts`). MUST NOT parse `req.user` directly in controllers.
- A new authentication mechanism (OAuth, mTLS, API key) MUST be a nested guard that runs after `JwtGuard` and MUST NOT replace it. The decision belongs in the constitution.

### Authorization (RBAC and Permissions)

- Authorization MUST use role-based access control enriched with `Permission`s. The mapping from `UserRole` → `Permission[]` lives in `ROLE_PERMISSIONS` (`src/common/authorization/permissions.ts`); new roles MUST extend the enum and the map.
- Permission checks MUST use `@Permissions(...)` (`src/common/authorization/decorators/permissions.decorator.ts`); application code MUST NOT inspect `user.roles.includes(...)` directly.
- `@Permissions()` MUST be the last guard before the handler — declaration order on the method matters because `PermissionsGuard` reads metadata set by the decorator. Reference class: `UserTagController` (`@Permissions('USER_READ_OWN')` precedes `@Get()`).
- Endpoint-level admin actions MUST receive the same role-based check as a co-located route; MUST NOT rely on `req.url` checks.
- Public mutations (`POST /tags/:id/follow`) MUST still be authenticated unless they are explicitly `@Public()`. A "@Public" annotation MUST be paired with a non-mutating verb in this codebase (see `tag.controller.ts`).

### Cookies

- Cookies MUST be `HttpOnly` and `Secure`. The names MUST live in `src/common/utils/cookie-names.ts`. Cookie parameters MUST be set via a server-side helper that enforces the same attributes for refresh tokens and any future sensitive cookie.
- Cookie parameters MUST be documented in OpenAPI via the `injectCookieParams` plugin (`src/common/swagger/cookie-params.plugin.ts`); MISSING cookie parameters in OpenAPI will break the contract test (`openapi-schemas.spec.ts`).
- MUST NOT store secrets or PII in non-HttpOnly cookies.
- Client-side access from JS to sensitive cookie state is forbidden in this project — no `document.cookie` reads for security-critical data.

### Secrets and configuration

- All environment variables MUST be parsed and validated by `validateEnv` in `src/core/config/env.validation.ts`. Adding a new env var without registering it in this module is forbidden. The validator MUST fail fast on startup if values are missing or malformed.
- Secrets MUST be loaded from the environment, never from a file on disk in production. Local `.env` files MUST be `.gitignored`.
- Logging MUST NEVER emit secret or token values. The global `PinoLogger` is configured with redaction — any new logger MUST extend the same redaction rules.

### Rate limiting

- Rate limiting MUST be done via the global `ThrottlerGuard` (`src/app.module.ts:76-86`). Per-route customization MUST use `@Throttle({ default: { limit, ttl } })`.
- Login, signup, and password-reset endpoints MUST be throttled with the `auth` bucket (configured in `app.module.ts`); MUST NOT rely on default global limits.
- The throttler MUST use Redis as the storage backend so limits are consistent across replicas (`src/core/redis/redis.module.ts`). In-memory rate limits MUST NOT be added.

### HTTP hardening

- The application MUST serve behind Helmet (`src/main.ts`). Adding a new header MUST be additive; removing Helmet defaults is forbidden.
- CORS MUST be configured in `src/main.ts` with an explicit allowlist. Wildcards are forbidden in production-grade environments (env-driven allowlist).
- All requests MUST carry `X-Correlation-Id` via `CorrelationInterceptor`. Endpoints MUST NOT trust the inbound header blindly when log integrity matters; `CorrelationInterceptor` MUST either honor or override it consistently.
- `Content-Security-Policy`, `Strict-Transport-Security`, and `X-Frame-Options` come from Helmet defaults and MUST stay on.

### Input hardening

- Controllers MUST use the global `ValidationPipe` (`src/main.ts:53-58`). The full configuration (whitelist, forbidNonWhitelisted, transform, transformOptions.enableImplicitConversion) lives in `validation.md`; this standard references that as the canonical owner. The pipe config MUST NOT be relaxed per-controller.
- Request DTOs MUST declare an `enum`, `pattern`, `min/max`, or equivalent constraint for every field that accepts string or numeric input. See `validation.md`.
- Path parameters MUST be validated by `ParseUUIDPipe` or `ParseUUIDOrSlugPipe`; raw `@Param('id')` without a pipe is forbidden.
- Outbound HTTP calls are out of scope but, when added, MUST route through a hardened client (timeouts, retry policy, certificate pinning if needed).

### Audit

- Security-sensitive operations MUST emit an audit row via `AuditLogService` (`src/common/audit/audit-log.service.ts`). Examples: password changes, account deletion, ban/revoke, session revocation, admin role changes, badge revocation, moderator report status changes, social block/unblock.
- Audit rows MUST include `domain` and `action` discriminators in addition to the existing `eventType` so cross-domain reporting works.
- Audit retention MUST use the default (`DEFAULT_AUDIT_RETENTION_DAYS = 90`) unless a domain requires longer (e.g. moderation uses 365 days). The retention MUST be explicit in the call.
- Expired audit rows MUST be purged by the existing `purgeExpired` path; application write paths MUST NOT assume audit rows remain reachable forever.

### Production safety for operational tooling

- CLI commands that mutate production MUST refuse to run unless the `ALLOW_PROD_<COMMAND>_OPERATIONS=true` env flag is set. Reference: `src/commands/outbox.ts`.
- Admin and operator endpoints MUST scope their data by `actorId` and audit actor/subject with both ids.

### Threat-specific rules

- Role escalation MUST not be possible by self-assignment. The only path to grant roles is through a privileged endpoint bound to a permission guarded server-side (e.g. `USER_GRANT_ROLE`).
- A user MUST NOT be able to read another user's `JwtPayload` from the request. Token content is server-side only; controllers MUST NOT log the entire `JwtPayload`.
- A user MUST NOT be able to enumerate other users' resources by ID. List endpoints MUST filter by the actor at the repository level, not after page slicing.

## Examples

### Authentication + permission gate

```typescript
// src/modules/tag/transport/controllers/user-tag.controller.ts
@UseGuards(JwtGuard)
@Controller('users/me/followed-tags')
@ApiTags('UserTag')
export class UserTagController {
  @Get()
  @Permissions('USER_READ_OWN')
  @ApiOperation({ summary: 'List tags followed by the current user' })
  list(@CurrentUser() user: JwtPayload) { … }
}
```

### Audit record

```typescript
await this.auditService.record({
  eventType: 'badge_revoked',
  domain: 'achievement',
  action: 'badge.revoked',
  actorId,
  subjectUserId,
  metadata: { badgeId },
  retentionDays: 365,
});
```

### Login rate limiting

```typescript
// src/modules/auth/transport/controllers/auth.controller.ts
@Post('login')
@Throttle({ auth: { limit: 5, ttl: 60_000 } })
async login(@Body() dto: LoginDto) { … }
```

## Non-goals

- General guidance on JWT (alg, key management) — configured centrally in `core/config/`.
- Generic SOC2 / ISO 27001 control lists.
- Telemetry client setup.
- Documenting schema-level authorization, since PostgreSQL RLS is not enabled.

## Future considerations

- If account takeover detection (IP/device fingerprinting) is added, the rules belong in this document under a new "Threat detection" section.
- If a second identity provider is integrated (OIDC), the new identity MUST flow through the same `JwtGuard`; the `JwtPayload` shape grows accordingly, and this standard MUST be updated in the same PR.