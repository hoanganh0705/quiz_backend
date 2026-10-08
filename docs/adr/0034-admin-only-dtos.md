# ADR-0034 — Admin-Only DTOs and Privileged Fields

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-09-26 |

## Context

The quiz and taxonomy controllers expose mutation endpoints that
accept "privileged" booleans (`isFeatured`, `isHidden`,
`isPinned`, …) — fields that change visibility, ranking, or
moderation state and that should only be settable by an operator
holding the matching admin permission.

Two anti-patterns were observed before this ADR:

- The privileged booleans lived on the **same** DTO as the
  user-facing fields. A user-owned `PATCH /quizzes/:id` therefore
  accepted `isFeatured: true` in the body and applied it.
- The controller-level `@Permissions(...)` guard ran **before**
  the DTO validation, but the service layer did not re-check the
  invariant. A future controller that forgot the guard would
  silently allow the privileged field.

The Phase 8 audit confirmed both gaps.

## Decision

Privileged booleans live in their own DTO and their own route:

- **Admin DTO separation.** Every controller that accepts
  privileged fields exposes a `*-admin-request.dto.ts`. The
  user-facing DTO MUST NOT contain a privileged field. The
  Drizzle schema, the Swagger metadata, and the request DTO
  together describe two parallel write surfaces.
- **Controller-level role guard.** Each admin route is decorated
  with `@Permissions(<matching admin permission>)`. The guard
  runs before body validation, so an unauthorized caller
  receives 403 even before the DTO is parsed.
- **Service-layer invariant.** The application service re-checks
  the permission inside the use case, even though the controller
  already gated it. A controller that drops the guard fails fast
  at the service-layer boundary; an audit log line identifies
  the caller.

## Consequences

### Positive

- The user-facing DTO is the documented contract for ordinary
  users; the privileged DTO is the documented contract for
  operators. The two cannot drift because the privileged
  fields are absent from the user-facing DTO file.
- A forgotten `@Permissions` guard is detected in tests because
  the service-layer invariant asserts the permission and emits
  an audit event.
- The OpenAPI spec cleanly shows two parallel write surfaces per
  resource, which simplifies client documentation.

### Negative

- Controllers carry two mutation routes for the same aggregate.
  The duplication is small (typically one extra `@Patch`)
  but adds noise to the routing table.
- Tests for admin endpoints must set up the operator
  permission, which adds setup overhead. The overhead is
  centralized in a `withAdminAuth()` test helper.

## Evidence

- `src/modules/quiz/dto/request/admin-update-quiz.dto.ts`.
- `src/modules/quiz/dto/request/update-quiz.dto.ts`.
- `src/modules/quiz/transport/controller/quiz-admin.controller.ts`.
- `src/modules/quiz/transport/controller/quiz.controller.ts`.
- `src/modules/quiz/application/quiz.application.service.ts`
  (privileged-field rejection for non-admin callers).
- `src/modules/taxonomy/transport/controller/taxonomy-admin.controller.ts`.
- `docs/standards/migration.md` § "Admin-only DTO and privileged fields".

## References

- ADR-0013 (Authorization Model — Three-Layer RBAC + Permissions).
- ADR-0015 (API Documentation — Code-First OpenAPI with Decorators).
- `docs/audit/phase8-security-trust-boundary-audit.md`.
- `docs/audit/phase9-security-remediation-plan.md` § P3.6, § P4.5.
