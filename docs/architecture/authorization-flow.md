# Authorization Flow

This document describes how the application makes authorization decisions: authentication, role-based access control, permission enforcement, and resource ownership checks.

## Authorization Layers

The application has three authorization layers that compose together:

```
Layer 1 — Authentication   (JwtGuard)
Layer 2 — RBAC + Permissions (PermissionsGuard)
Layer 3 — Resource Ownership (Domain Policy)
```

Layer 1 establishes identity. Layer 2 establishes role. Layer 3 establishes the specific resource right.

## Layer 1 — Authentication (JwtGuard)

See `docs/architecture/authentication-flow.md` for the full token flow. `JwtGuard` is the single authentication guard — it attaches `JwtPayload` to `request.user` for every non-`@Public()` request.

## Layer 2 — RBAC and Permissions

### Role Model

```
UserRole: 'admin' | 'moderator' | 'user'
```

Three roles exist. No additional custom roles are modeled.

### Permission Model

```
Permission: string (enum of known values)
ROLE_PERMISSIONS: Map<UserRole, Set<Permission>>
```

Each role maps to a set of permissions:

| Permission | admin | moderator | user |
|---|---|---|---|
| `QUIZ_CREATE` | ✓ | | ✓ |
| `QUIZ_EDIT_OWN` | ✓ | | ✓ |
| `QUIZ_EDIT_ANY` | ✓ | | |
| `QUIZ_DELETE_OWN` | ✓ | | ✓ |
| `QUIZ_DELETE_ANY` | ✓ | | |
| `QUIZ_VERSION_*_OWN` | ✓ | | ✓ |
| `QUIZ_VERSION_*_ANY` | ✓ | | |
| `QUIZ_VERSION_PUBLISH_ANY` | ✓ | ✓ | |
| `QUIZ_VERIFY` | ✓ | ✓ | |
| `TAG_MANAGE` | ✓ | | |
| `CATEGORY_MANAGE` | ✓ | | |
| `DISCUSSION_MODERATE` | ✓ | ✓ | |
| `TOURNAMENT_CREATE` | ✓ | | |
| `TOURNAMENT_REGISTER` | ✓ | | ✓ |
| `TOURNAMENT_ATTEMPT` | ✓ | | ✓ |
| `REVIEW_MODERATE` | ✓ | ✓ | |
| `ACHIEVEMENT_REVOKE` | ✓ | | |
| `ACHIEVEMENT_ADMIN` | ✓ | | |
| `RANKING_ADMIN` | ✓ | | |
| `NOTIFICATION_ANALYTICS` | ✓ | | |
| `USER_GRANT_ROLE` | ✓ | | |
| `SESSION_REVOKE` | ✓ | | |
| `SESSION_REVOKE_ALL` | ✓ | | |

Evidence: `src/common/authorization/permissions.ts:44-108`.

### Permissions Guard — Flow

```
PermissionsGuard.canActivate(context)
    │
    ├── permissions = Reflector.get(PERMISSIONS_KEY, context.getHandler())
    │       └── Reads @Permissions(...) from the handler
    │       └── if none on handler: reads from controller class
    │
    ├── if !permissions: return true  ← no @Permissions() → pass
    │
    ├── user = request.user as JwtPayload
    │       └── JwtGuard guarantees this exists
    │
    ├── rolePermissions = ROLE_PERMISSIONS.get(user.role)
    │       └── Returns Set<Permission> for the user's role
    │
    ├── hasRequiredPermission = permissions.every(p => rolePermissions.has(p))
    │       └── ALL required permissions must be present
    │
    └── if hasRequiredPermission: return true
        else: throw ForbiddenException
```

### Permission Declaration

```
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('quizzes')
export class QuizController {
  @Post()
  @Permissions('QUIZ_CREATE')
  async create() { … }     ← requires QUIZ_CREATE

  @Patch(':id')
  @Permissions('QUIZ_EDIT_OWN', 'QUIZ_EDIT_ANY')
  async update() { … }     ← requires QUIZ_EDIT_OWN OR QUIZ_EDIT_ANY
}
```

`PermissionsGuard` checks `permissions.every(...)` — meaning **all** listed permissions must be present. To express OR semantics (e.g., OWN OR ANY), controllers declare multiple permissions and the domain policy handles the distinction.

## Layer 3 — Resource Ownership

`PermissionsGuard` establishes whether a user has the *capability*. Domain policy establishes whether the user has the *right over this specific resource*.

```
Example:
PermissionsGuard allows QUIZ_EDIT_ANY → controller proceeds
Domain policy QuizPolicy.assertCanEdit(userId, quiz) → checks quiz.creatorId === userId
```

### Policy Pattern

Domain policy classes are the authoritative ownership gate. They are called from application services, not controllers.

| Module | Policy | File |
|---|---|---|
| Quiz | `QuizPolicy` | `src/modules/quiz/domain/policies/quiz.policy.ts` |
| Quiz | `QuizVersionPolicy` | `src/modules/quiz/domain/policies/quiz-version.policy.ts` |
| Discussion | `DiscussionAuthorizationPolicy` | `src/modules/discussion/domain/policies/discussion-authorization.policy.ts` |
| Bookmark | (implicit in domain service) | `src/modules/bookmark/domain/bookmark-command.service.ts` |

### Ownership Check Pattern

```typescript
// src/modules/quiz/domain/policies/quiz.policy.ts
assertCanEdit(userId: string, quiz: QuizRow): void {
  if (quiz.creatorId !== userId && !this.hasPermission(userId, 'QUIZ_EDIT_ANY')) {
    throw new QuizForbiddenError(...);
  }
}
```

The policy checks both ownership (`creatorId === userId`) and override permission (`QUIZ_EDIT_ANY`). An admin with `QUIZ_EDIT_ANY` can edit any quiz; a regular user with `QUIZ_EDIT_OWN` can edit only their own.

### Module-Level Policy Summary

| Module | Ownership model | Override permission |
|---|---|---|
| Quiz | `creatorId === userId` | `QUIZ_EDIT_ANY`, `QUIZ_DELETE_ANY`, `QUIZ_VERSION_*_ANY` |
| Quiz Version | Inherits quiz ownership | `QUIZ_VERSION_EDIT_ANY`, `QUIZ_VERSION_PUBLISH_ANY` |
| Category | No ownership model (admin only) | `CATEGORY_MANAGE` |
| Tag | No ownership model (admin only) | `TAG_MANAGE` |
| Discussion | `authorId === userId` | `DISCUSSION_MODERATE` |
| Bookmark Collection | `ownerId === userId` | None |
| Review | `authorId === userId` | `REVIEW_MODERATE` |
| Attempt | `userId === actorId` | None |
| Tournament | No ownership (any authenticated user) | `TOURNAMENT_CREATE` |
| Auth | No policy (auth is implicit in JwtGuard) | N/A |
| User | Self-only for own profile | None |

### Self-Authorship Rule

Some actions have an additional constraint: a user cannot act on their own resource in certain ways:

```
Self-vote prohibited:  Discussion (vote on own thread/comment → SelfVoteError)
Self-report prohibited:  Discussion (report own content → SelfReportError)
Self-follow prohibited:  Not enforced (users can follow their own quiz's tags)
```

## Cross-Module Authorization

When a module operates on behalf of a user on another module's resources, the authorization model extends:

```
Tag module: user follows a tag
  → Tag module: no ownership check (tags are public)
  → Auth module: user must have valid JWT

Discussion module: user posts on a quiz's thread
  → Discussion module: user must have valid JWT
  → Quiz module: Discussion validates quiz existence (not authorization)

Attempt module: user starts an attempt
  → Attempt module: user must have valid JWT
  → Attempt module: one active attempt per (userId, quizVersionId) — enforces not concurrent
```

Cross-module authorization is **not** enforced via transitive role checks. Each module independently validates the caller's identity (via `@CurrentUser()`) but does not re-check the caller's permissions against the target module's RBAC table.

## The `@Public()` Opt-Out

`@Public()` is the only mechanism for making a route unauthenticated. It is applied per-route or per-controller. When present on a controller class, all routes in that controller are public unless overridden with `@Permissions()` on a specific method.

Public endpoints still pass through `ThrottlerGuard` (rate limiting) and `ResponseFormatInterceptor` / `CorrelationInterceptor`.

## Audit Requirements

Security-sensitive write operations must emit an audit record via `AuditLogService`. The authorization decision is made by the policy; the audit record is written by the application service after the policy passes.

Evidence: `src/modules/discussion/infrastructure/audit/discussion-moderator-audit.service.ts` records all moderator actions with 365-day retention.

## Needs Clarification

- The `USER_GRANT_ROLE` permission is referenced in the matrix but its exact enforcement point is not traced (whether it is a controller-level guard or a domain service call).