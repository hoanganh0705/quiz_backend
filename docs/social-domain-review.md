# Social Domain Architecture Review

**Date:** June 2, 2026
**Status:** Review Complete
**MVP Readiness Score:** 7.5/10

---

## Table of Contents

1. [What Is Good](#1-what-is-good)
2. [What Is Missing](#2-what-is-missing)
3. [What Is Unnecessary](#3-what-is-unnecessary)
4. [Recommended Improvements](#4-recommended-improvements)
5. [Domain Boundary Review](#5-domain-boundary-review)
6. [Consistency Review](#6-consistency-review)
7. [MVP Readiness Assessment](#7-mvp-readiness-assessment)
8. [Refactoring Plan](#8-refactoring-plan)

---

## 1. What Is Good

### 1.1 Clean Module Structure

The Social Domain follows the established hexagonal architecture pattern used by other modules in the codebase:

```
src/modules/social/
├── application/              # Application service (thin layer)
├── domain/
│   ├── errors/            # Custom domain errors
│   ├── ports/             # Port interfaces
│   ├── services/          # Domain logic
│   └── types/             # Domain types
├── dto/response/          # Response DTOs
├── infrastructure/
│   ├── repositories/      # Repository implementations
│   └── social.schema.ts   # Database tables
└── transport/
    └── controller/        # HTTP endpoints
```

### 1.2 Proper Port/Adapter Pattern

The `SocialRepositoryPort` interface properly abstracts the data layer, allowing for easy testing and future implementation changes.

**File:** `src/modules/social/domain/ports/social-ports.ts`

```typescript
export interface SocialRepositoryPort {
  createFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship>;
  respondToFriendRequest(params: RespondToFriendRequestParams, requesterId: string): Promise<void>;
  getFriends(userId: string, limit: number, cursor?: string | null): Promise<Friend[]>;
  // ... other methods
}
```

### 1.3 Comprehensive Error Handling

Custom domain errors with clear semantics provide better developer experience and more specific error handling.

**File:** `src/modules/social/domain/errors/social.errors.ts`

```typescript
export class AlreadyFriendsError extends SocialError {
  constructor() {
    super('You are already friends with this user');
    this.name = 'AlreadyFriendsError';
  }
}

export class PendingRequestExistsError extends SocialError {
  constructor() {
    super('A friend request is already pending');
    this.name = 'PendingRequestExistsError';
  }
}
```

### 1.4 Solid Database Schema Design

- Proper indexes on `requesterId`, `addresseeId`, `status`
- Unique constraints preventing duplicate relationships
- Self-reference checks via PostgreSQL constraints

**File:** `src/modules/social/infrastructure/social.schema.ts`

```typescript
export const friendships = pgTable('friendships', {
  friendshipId: uuid('friendship_id').defaultRandom().primaryKey().notNull(),
  requesterId: uuid('requester_id').notNull(),
  addresseeId: uuid('addressee_id').notNull(),
  status: friendshipStatus().default('pending').notNull(),
  // ...
}, (table) => [
  index('idx_friendships_requester').using('btree', table.requesterId.asc()),
  index('idx_friendships_addressee').using('btree', table.addresseeId.asc()),
  uniqueIndex('uq_friendships_pair').on(table.requesterId, table.addresseeId),
  check('friendships_no_self_request', sql`requester_id != addressee_id`),
]);
```

### 1.5 Good Relationship Model

- Unidirectional follow model (simpler than mutual relationships)
- Blocking removes existing friendships automatically
- Relationship status provides complete picture with single query

**File:** `src/modules/social/domain/services/social.service.ts`

```typescript
async blockUser(blockerId: string, blockedId: string, reason?: string): Promise<void> {
  // ...
  await this.socialRepository.blockUser(blockerId, blockedId, reason);
  await this.socialRepository.removeFriend(blockerId, blockedId); // Automatically removes friendship
}
```

### 1.6 Pagination Implementation

Cursor-based pagination in the application service provides efficient data fetching.

**File:** `src/modules/social/application/social-application.service.ts`

```typescript
async getFriends(
  user: JwtPayload,
  limit: number,
  cursor?: string | null,
): Promise<{ items: Friend[]; hasNextPage: boolean }> {
  const items = await this.socialService.getFriends(user.sub, limit + 1, cursor);
  const hasNextPage = items.length > limit;
  const result = hasNextPage ? items.slice(0, limit) : items;
  return { items: result, hasNextPage };
}
```

### 1.7 Dual-layer Architecture

The separation between `SocialService` (domain logic) and `SocialApplicationService` (orchestration) follows clean architecture principles.

### 1.8 Good Testability

The port pattern with dependency injection makes the domain service highly testable.

---

## 2. What Is Missing

### 2.1 User Search (Roadmap Item)

The roadmap specifies "User Search" as part of the core flow:

```
Find User → Friend Request → Accept → Relationship
```

**Expected but missing:**
- `GET /social/users/search?q=...` - Search by username/display name
- Integration with User domain for user lookup

### 2.2 Friend Rankings Integration (Roadmap Item)

"Friend Rankings" is listed in the roadmap but no integration exists:

- Weekly Friend Ranking
- Monthly Friend Ranking
- All-Time Friend Ranking

This requires integration with the Ranking module's `LeaderboardService` or a dedicated friend-leaderboard query.

### 2.3 Notification Integration

The notification schema already defines social notification types, but the Social domain doesn't trigger them:

**File:** `src/modules/notification/infrastructure/notification.schema.ts`

```typescript
export const notificationType = pgEnum('notification_type', [
  // ...
  'friend_request',
  'friend_accepted',
  // ...
]);
```

**Missing triggers in Social:**
- Friend request sent → no notification
- Friend request accepted → no notification
- Friend removed → no notification
- User blocked → no notification

### 2.4 Domain Events

Other modules have event buses for loose coupling, but Social only logs to Pino logger.

**Ranking module has:**
- `src/modules/ranking/domain/events/ranking-domain.event-bus.ts`
- `src/modules/ranking/domain/events/ranking.event-handler.ts`

**Social is missing:**
- Domain event types
- Event emission
- Event bus port

### 2.5 Exception Filter

Missing HTTP error mapping for domain errors.

**User module has:**
**File:** `src/modules/user/transport/filters/user-domain-exception.filter.ts`

```typescript
@Catch(UserDomainError)
export class UserDomainExceptionFilter implements ExceptionFilter {
  catch(exception: UserDomainError, host: ArgumentsHost): void {
    // Maps domain errors to HTTP responses
  }
}
```

**Social is missing:** `SocialDomainExceptionFilter`

### 2.6 Cursor Pagination (Partially Implemented)

The repository has a cursor parameter but doesn't use it:

**File:** `src/modules/social/infrastructure/repositories/social.repository.ts`

```typescript
async getFriends(userId: string, limit: number, cursor?: string | null): Promise<Friend[]> {
  // cursor parameter is defined but never used in the query!
  .limit(limit + 1);
}
```

---

## 3. What Is Unnecessary

### 3.1 `rejected` Status in Schema

The schema defines a `rejected` status but it's never used:

**File:** `src/modules/social/infrastructure/social.schema.ts`

```typescript
export const friendshipStatus = pgEnum('friendship_status', [
  'pending',
  'accepted',
  'rejected',  // Never used - cancelFriendRequest deletes the record instead
  'blocked',
]);
```

**Options:**
1. Remove the `rejected` status (simplifies the model)
2. Actually use it for audit trail when a request is declined

### 3.2 Duplicate Schema Location

Social schema is in the module directory while other tables are in the central schema:

```
Social:   src/modules/social/infrastructure/social.schema.ts  # Has friendships, blockedUsers, userFollows
Others:   src/core/database/schema/index.ts                   # Has users, badges, etc.
```

**Recommendation:** Move social tables to `src/core/database/schema/index.ts` for consistency with other tables.

### 3.3 Follow System Scope Creep

The original roadmap specifies:
- Friend Requests → Accept → Relationship

The follow system (`user_follows` table) wasn't in the original scope. While functional, it adds:
- `getFollowers` / `getFollowing` queries
- `followUser` / `unfollowUser` methods
- Additional indexes and relationships

Consider if this is essential for MVP or can be deferred.

---

## 4. Recommended Improvements

### 4.1 High Priority

#### Add Exception Filter

Create `SocialDomainExceptionFilter` to map domain errors to proper HTTP status codes.

**Proposed Location:** `src/modules/social/transport/filters/social-domain-exception.filter.ts`

```typescript
@Catch(SocialError)
export class SocialDomainExceptionFilter implements ExceptionFilter {
  catch(exception: SocialError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof FriendRequestNotFoundError) {
      return response.status(404).json({ message: exception.message });
    }
    if (exception instanceof FriendRequestForbiddenError) {
      return response.status(403).json({ message: exception.message });
    }
    if (exception instanceof AlreadyFriendsError) {
      return response.status(409).json({ message: exception.message });
    }
    if (exception instanceof BlockedUserError || exception instanceof UserBlockedError) {
      return response.status(403).json({ message: exception.message });
    }
    if (exception instanceof SelfFriendRequestError) {
      return response.status(400).json({ message: exception.message });
    }
    // Default: Internal Server Error
    return response.status(500).json({ message: 'Internal server error' });
  }
}
```

#### Implement Notifications

Add notification triggers to SocialService methods.

```typescript
// After sendFriendRequest succeeds
await this.notificationChannelService.send({
  userId: addresseeId,
  type: 'friend_request',
  title: 'New Friend Request',
  body: `${requesterUsername} sent you a friend request`,
  metadata: { friendshipId, requesterId },
});

// After respondToFriendRequest with accept=true
await this.notificationChannelService.send({
  userId: friendship.requesterId,
  type: 'friend_accepted',
  title: 'Friend Request Accepted',
  body: `${userUsername} accepted your friend request`,
  metadata: { friendshipId },
});
```

### 4.2 Medium Priority

#### Fix Cursor Pagination

Implement actual cursor-based pagination in the repository.

```typescript
async getFriends(
  userId: string,
  limit: number,
  cursor?: string | null
): Promise<Friend[]> {
  // Build cursor condition if provided
  let cursorCondition;
  if (cursor) {
    cursorCondition = lt(friendships.updatedAt, cursor);
  }

  const rows = await this.db
    .select({...})
    .from(friendships)
    // ... joins
    .where(and(condition, cursorCondition))
    .orderBy(desc(friendships.updatedAt))
    .limit(limit + 1);

  return rows;
}
```

#### Add Domain Event Bus (Optional)

Create minimal event types for loose coupling:

```typescript
// src/modules/social/domain/events/social.events.ts
export type SocialDomainEvent =
  | { type: 'FriendRequestSent'; payload: { friendshipId: string; requesterId: string; addresseeId: string } }
  | { type: 'FriendRequestAccepted'; payload: { friendshipId: string; requesterId: string; addresseeId: string } }
  | { type: 'FriendRequestRejected'; payload: { friendshipId: string; requesterId: string; addresseeId: string } }
  | { type: 'FriendRemoved'; payload: { userId: string; friendId: string } }
  | { type: 'UserBlocked'; payload: { blockerId: string; blockedId: string } }
  | { type: 'UserUnblocked'; payload: { blockerId: string; blockedId: string } };
```

#### Move Schema to Central Location

Move tables to `src/core/database/schema/index.ts` and add relations to `src/core/database/schema/relations.ts`.

### 4.3 Low Priority

#### Soft Deletes

For audit/history purposes, add `deletedAt` to social tables.

#### Add User Search

If roadmap requires user discovery:

```typescript
// In SocialRepositoryPort
searchUsers(query: string, limit: number, excludeUserId?: string): Promise<UserSearchResult[]>;
```

---

## 5. Domain Boundary Review

### 5.1 Clear Ownership Matrix

| Concern | Owner | Assessment |
|---------|-------|------------|
| User identity (auth) | User Domain | ✅ Correct |
| User profiles (display) | Profile Domain | ✅ Correct |
| XP/Rankings | Ranking Domain | ✅ Correct |
| Badges/Achievements | Achievement Domain | ✅ Correct |
| Notifications | Notification Domain | ✅ Correct |
| Social Relationships | Social Domain | ✅ Correct |

### 5.2 Social Domain Responsibilities

**Should own:**
- Friend request lifecycle (send, cancel, accept, reject)
- Friendship management (list, remove)
- User blocking (block, unblock, list blocked)
- Follow relationships (follow, unfollow, list)
- Social counts (friend count, follower count)
- Relationship queries (status between two users)

**Should NOT own:**
- User data creation/management (User domain)
- User authentication (Auth domain)
- Profile display data (Profile domain)
- Rankings calculation (Ranking domain)
- Notification delivery (Notification domain)

### 5.3 Cross-Domain Integration

**Current approach:** Social queries `users` and `userProfiles` tables directly.

**File:** `src/modules/social/infrastructure/repositories/social.repository.ts`

```typescript
import { friendships, blockedUsers, userFollows, users, userProfiles } from '@/core/database/schema';
```

**Assessment:** This is acceptable for read-only operations. If more abstraction is desired, create User query ports, but this adds complexity without significant benefit for MVP.

---

## 6. Consistency Review

### 6.1 Module Structure Comparison

| Aspect | Social | Ranking | User | Consistent? |
|--------|--------|---------|------|-------------|
| Domain services | ✅ | ✅ | ✅ | Yes |
| Application service | ✅ | ✅ | ✅ | Yes |
| Ports pattern | ✅ | ✅ | ✅ | Yes |
| Domain events | ❌ | ✅ | ❌ | No |
| Exception filter | ❌ | ✅ | ✅ | No |
| Domain errors | ✅ | ✅ | ✅ | Yes |

### 6.2 Naming Conventions

| Element | Social | Ranking | Consistent? |
|---------|--------|---------|-------------|
| Service class | `SocialService` | `LeaderboardService` | ✅ |
| Repository | `SocialRepository` | `RankingRepository` | ✅ |
| Domain errors | `*Error` suffix | `*Error` suffix | ✅ |
| DTOs | `*Dto` suffix | `*Dto` suffix | ✅ |
| Port symbols | `*_PORT` constant | `*_PORT` constant | ✅ |

### 6.3 Port/Implementation Pattern

**Ranking module:**
```typescript
// src/modules/ranking/infrastructure/index.ts
export * from './repositories/ranking.repository';  // Exports implementation
```

**Social module:**
```typescript
// src/modules/social/infrastructure/index.ts
export * from './social.schema';  // Exports schema (different approach)
```

Both approaches work. Consider unifying by having Social export its repository instead of schema.

### 6.4 Module Registration

**Ranking module** (`src/modules/ranking/ranking.module.ts`):
- Uses DI tokens properly
- Registers all services explicitly
- Exports ports and services

**Social module** (`src/modules/social/social.module.ts`):
- Similar pattern
- Missing some registrations (exception filter)

---

## 7. MVP Readiness Assessment

### Scoring Rubric

| Criteria | Score | Max | Notes |
|----------|-------|-----|-------|
| Architecture Quality | 8 | 10 | Clean hexagonal architecture |
| Domain Boundaries | 9 | 10 | Clear ownership, proper delegation |
| Feature Completeness | 5 | 10 | Missing user search, friend rankings, notifications |
| Scalability | 8 | 10 | Proper indexes, pagination |
| Maintainability | 8 | 10 | Good code organization, types |
| Consistency | 7 | 10 | Mostly consistent, missing events/filter |
| **Overall** | **7.5** | 10 | Solid foundation, gaps in roadmap items |

### Strengths (8-9/10)

- Clean code organization matching other modules
- Proper error handling with domain-specific errors
- Good database design with proper constraints
- Correct domain boundaries with no ownership leaks

### Weaknesses (5-6/10)

- Missing user search functionality (roadmap item)
- No friend rankings integration (roadmap item)
- No notification triggers despite schema support
- Missing domain events (inconsistency with Ranking)
- No exception filter (inconsistency with User/Ranking)

### MVP Decision

**Not ready for MVP without:**
1. User search capability
2. Notification integration
3. Exception filter (for proper API responses)

**Nice to have before launch:**
1. Friend rankings
2. Domain events

---

## 8. Refactoring Plan

### Phase 1: Polish (Low Effort, High Impact)

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Add Exception Filter | 1 day | High | Create `social-domain-exception.filter.ts` |
| Fix Cursor Pagination | 0.5 day | Medium | `social.repository.ts` |
| Move Schema to Central | 0.5 day | Low | Move to `schema/index.ts`, add relations |

### Phase 2: Integration (Medium Effort)

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Add Domain Event Bus | 2 days | Medium | `social.events.ts`, `social.event-bus.ts` |
| Implement Notifications | 2 days | High | Add to `SocialService` methods |

### Phase 3: Roadmap Items (Higher Effort)

| Task | Effort | Impact | Priority |
|------|--------|--------|----------|
| Add User Search | 3 days | High | Required for core flow |
| Add Friend Rankings | 3 days | Medium | Nice to have |

### Priority Order & Timeline

```
Week 1: Phase 1 (Polishing)
  - Day 1: Exception Filter
  - Day 2: Cursor Fix + Schema Move

Week 2: Phase 2 (Integration)
  - Day 3-4: Domain Events
  - Day 5: Notifications

Week 3: Phase 3 (Roadmap)
  - Day 6-8: User Search
  - Day 9-10: Friend Rankings (if time permits)

Total: ~10 days
```

### Immediate Action Items

1. **Today:** Create `SocialDomainExceptionFilter`
2. **This week:** Fix cursor pagination
3. **Next week:** Add notification triggers
4. **Before MVP:** Implement user search

---

## Appendix: File Reference

### Core Social Files

| File | Purpose |
|------|---------|
| `src/modules/social/social.module.ts` | Module definition |
| `src/modules/social/domain/services/social.service.ts` | Domain logic |
| `src/modules/social/application/social-application.service.ts` | Application orchestration |
| `src/modules/social/domain/ports/social-ports.ts` | Repository interface |
| `src/modules/social/infrastructure/repositories/social.repository.ts` | Repository implementation |
| `src/modules/social/infrastructure/social.schema.ts` | Database tables |
| `src/modules/social/transport/controller/social.controller.ts` | HTTP endpoints |
| `src/modules/social/domain/errors/social.errors.ts` | Domain errors |
| `src/modules/social/dto/response/social-response.dto.ts` | Response DTOs |

### Related Files (Comparison)

| Module | Exception Filter | Event Bus |
|--------|------------------|-----------|
| User | `user-domain-exception.filter.ts` | ❌ |
| Ranking | `ranking-domain-exception.filter.ts` | `ranking-domain.event-bus.ts` |
| Social | ❌ Missing | ❌ Missing |

### Database Tables

| Table | Purpose |
|-------|---------|
| `friendships` | Friend requests and accepted relationships |
| `blocked_users` | User blocks |
| `user_follows` | Follow relationships |

---

*Document generated: June 2, 2026*
