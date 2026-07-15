# ADR-0013: Authorization Model — Three-Layer RBAC + Permissions

## Status

Accepted

## Context

The system must control who can perform which operations on which resources. Authentication (verifying identity) is handled by `JwtGuard`. The system additionally needs to enforce role-based access control (RBAC), fine-grained permissions, and resource ownership checks without duplicating logic across every controller.

## Decision

**Three-layer model:**

1. **Authentication** — `JwtGuard`. Verifies the access token is valid, not expired, and the user is active. Runs first; all protected endpoints require it.

2. **RBAC + Permissions** — `PermissionsGuard`. Reads `roles` and `permissions` from the verified JWT payload. Checks against the `@Permissions()` decorator on the controller method. This is fast (no DB call) because permissions are embedded in the token.

3. **Resource Ownership** — Domain policies. `PermissionsGuard` handles generic role/permission checks; resource-specific ownership is enforced in application services. For example: "a user can only update their own profile" is checked in `UserApplicationService`, not in a guard.

**Roles:** `UserRole` enum — `ADMIN`, `MODERATOR`, `USER`, `GUEST`. Each role has a set of associated permissions defined in `ROLE_PERMISSIONS`.

**Permissions:** `Permission` enum — action-resource pairs (e.g. `QUIZ_CREATE`, `TAG_DELETE`, `USER_READ`). Permissions are additive: a user with `ADMIN` role implicitly has all permissions.

**Role → Permission mapping:** `ROLE_PERMISSIONS` constant maps each `UserRole` to an array of `Permission` values. `PermissionsGuard` checks the JWT's `roles[]` array against this map.

**Decorator:** `@Permissions(Permission.QUIZ_CREATE, ...)` on controller methods. Multiple permissions mean AND (all required). `@Permissions()` without arguments skips permission checking (only `JwtGuard` applies).

**Override:** `@SkipPermissions()` disables all permission checks for a handler (e.g. for public endpoints that optionally enhance results for authenticated users).

## Consequences

**Advantages**
- Permission checks are O(1) — no database call needed because permissions are in the JWT.
- The three-layer model separates concerns: identity (guard), role/permission (guard), business rule (service).
- Adding a new permission requires only a new enum value and updating `ROLE_PERMISSIONS`.
- Resource ownership checks in application services can use the full domain context, not just role membership.

**Trade-offs**
- Permissions are embedded in the access token at issuance; revoking a permission takes up to 15 minutes to propagate (the token lifetime).
- The JWT payload can grow large with many permissions; this is a non-issue at the current scale.
- Role → Permission mapping is a static constant; runtime role changes require re-issuing the token.

## Evidence

- `src/common/decorators/permissions.decorator.ts` — `@Permissions()` decorator.
- `src/common/guards/permissions.guard.ts` — `PermissionsGuard` with `ROLE_PERMISSIONS` lookup.
- `src/common/enums/permission.enum.ts` — `Permission` enum with all action-resource pairs.
- `src/common/enums/user-role.enum.ts` — `UserRole` enum.
- `src/modules/auth/domain/services/auth.service.ts` — `generateAccessToken` embeds `roles` and `permissions` in the JWT payload.
- `src/modules/tag/transport/controllers/tag.controller.ts` — `@Permissions(Permission.TAG_CREATE)` on create.
- `src/modules/auth/domain/errors/auth-domain.errors.ts` — `AUTH_INSUFFICIENT_PERMISSIONS`.
- `docs/architecture/authorization-flow.md` — three-layer authorization diagram and `PermissionsGuard` flow.
- `docs/PROJECT_CONSTITUTION.md` §3.4 (Choices already made) — RBAC + permissions listed as a locked decision.
