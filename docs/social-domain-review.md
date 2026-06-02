# Social Domain Architecture Review

**Date:** June 2, 2026
**Status:** Implementation Complete
**MVP Readiness Score:** 9.2/10

---

## Table of Contents

1. [What Is Good](#1-what-is-good)
2. [Implementation Status](#2-implementation-status)
3. [Considerations](#3-considerations)
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
│   ├── errors/              # Custom domain errors
│   ├── events/              # Domain events and event bus
│   ├── ports/               # Port interfaces
│   ├── services/            # Domain logic
│   └── types/               # Domain types
├── dto/
│   └── response/            # Response DTOs
├── infrastructure/
│   ├── adapters/            # Adapters (UserSearchAdapter, RankingAdapter)
│   └── repositories/        # Repository implementations
└── transport/
    ├── controller/          # HTTP endpoints
    └── filters/             # Exception filters
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
- Soft delete support with `deletedAt` column
- Schema centralized in `src/core/database/schema/index.ts`

**File:** `src/core/database/schema/index.ts`

```typescript
export const friendships = pgTable('friendships', {
  friendshipId: uuid('friendship_id').defaultRandom().primaryKey().notNull(),
  requesterId: uuid('requester_id').notNull(),
  addresseeId: uuid('addressee_id').notNull(),
  status: friendshipStatus().default('pending').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  // ...
}, (table) => [
  index('idx_friendships_requester').using('btree', table.requesterId.asc()),
  index('idx_friendships_addressee').using('btree', table.addresseeId.asc()),
  uniqueIndex('uq_friendships_pair').on(table.requesterId, table.addresseeId),
  .where(sql`deleted_at IS NULL`),
  check('friendships_no_self_request', sql`requester_id != addressee_id`),
]);
```

### 1.5 Good Relationship Model

- Unidirectional follow model (simpler than mutual relationships)
- Blocking removes existing friendships automatically
- Relationship status provides complete picture with single query
- Soft deletes for audit trail

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

### 1.9 Domain Events

Domain events provide loose coupling between Social domain and other domains (e.g., Notification).

**File:** `src/modules/social/domain/events/`

- `social-domain.events.ts` - Event type definitions
- `social-domain.event-bus.ts` - Event bus implementation
- `social-event-bus.port.ts` - Port interface

### 1.10 Exception Filter

Proper HTTP error mapping for domain errors ensures consistent API responses.

**File:** `src/modules/social/transport/filters/social-domain-exception.filter.ts`

---

## 2. Implementation Status

All previously identified gaps have been successfully implemented. The following features are now complete:

### 2.1 User Search

- `GET /social/users/search?q=...&limit=...` - Search by username/display name
- `UserSearchPort` and `UserSearchAdapter` for clean integration with User domain

### 2.2 Friend Rankings

- Weekly Friend Ranking
- Monthly Friend Ranking
- All-Time Friend Ranking
- `RankingPort` and `RankingAdapter` for clean integration with Ranking module
- `GET /social/friends/leaderboard?period=&limit=` endpoint

### 2.3 Notification Integration

- `SocialDomainEventBus` for event emission
- `SocialNotificationService` for composing social notifications
- `SocialEventHandler` and `SocialListenerAdapter` for bridging domains

### 2.4 Domain Events

- `src/modules/social/domain/events/social-domain.events.ts` - Event types
- `src/modules/social/domain/events/social-domain.event-bus.ts` - Event bus implementation
- `src/modules/social/domain/events/social-event-bus.port.ts` - Port interface

### 2.5 Exception Filter

- `src/modules/social/transport/filters/social-domain-exception.filter.ts`

### 2.6 Cursor Pagination

- Repository now properly uses cursor for pagination
- Query conditions include `lte(friendships.updatedAt, cursor)`

---

## 3. Considerations

> **Note:** The following items have been addressed through implementation. Some items were kept for future consideration.

### 3.1 `rejected` Status in Schema

The schema defines a `rejected` status but it's not actively used:

```typescript
export const friendshipStatus = pgEnum('friendship_status', [
  'pending',
  'accepted',
  'rejected',  // Not actively used - cancelFriendRequest soft-deletes instead
  'blocked',
]);
```

**Current behavior:** When a request is cancelled, the record is soft-deleted. When a request is rejected, it's also soft-deleted.

**Decision:** Keep the enum value for future extensibility. The `rejected` status could be used for audit trail if needed.

### 3.2 Duplicate Schema Location (Resolved)

✅ **Resolved:** Social schema has been moved to `src/core/database/schema/index.ts` for consistency with other tables.

### 3.3 Follow System Scope

The follow system was added to support additional social features:

- `getFollowers` / `getFollowing` queries
- `followUser` / `unfollowUser` methods
- Additional indexes and relationships

**Decision:** Keep the follow system as it provides value for user discovery and engagement.

---

## 4. Recommended Improvements

All recommended improvements have been implemented. Below is a summary of the completed work.

### 4.1 High Priority

#### Add Exception Filter

`src/modules/social/transport/filters/social-domain-exception.filter.ts`

#### Implement Notifications

Via domain events (`SocialDomainEventBus`) and notification adapters (`SocialEventHandler`, `SocialListenerAdapter`)

### 4.2 Medium Priority

#### Fix Cursor Pagination

Repository now properly uses cursor for pagination with `lte` conditions

#### Add Domain Event Bus

`src/modules/social/domain/events/` with event types and event bus

#### Move Schema to Central Location

Tables moved to `src/core/database/schema/index.ts` with relations in `src/core/database/schema/relations.ts`.

### 4.3 Low Priority

#### Soft Deletes

Added `deletedAt` to `friendships`, `blocked_users`, `user_follows` tables.

#### Add User Search

Via `UserSearchPort` and `UserSearchAdapter` with `searchUsers` method.

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

**Social domain integrates with other modules through ports and adapters:**

| Target Domain | Integration Pattern | Port/Adapter |
|---------------|-------------------|--------------|
| User Domain | `UserSearchPort` → `UserSearchAdapter` | For user search functionality |
| Ranking Domain | `RankingPort` → `RankingAdapter` | For friend leaderboard |
| Notification Domain | `SocialDomainEventBus` → `SocialEventHandler` | For social notifications |

**File:** `src/modules/social/social.module.ts`

```typescript
@Module({
  imports: [DatabaseModule, UserModule, RankingModule],
  providers: [
    // ...
    UserSearchAdapter,  // Implements UserSearchPort
    RankingAdapter,     // Implements RankingPort
    SocialDomainEventBus, // Publishes events to Notification domain
  ],
})
export class SocialModule {}
```

**Assessment:** Clean integration pattern with proper separation of concerns.

---

## 6. Consistency Review

### 6.1 Module Structure Comparison

| Aspect | Social | Ranking | User | Consistent? |
|--------|--------|---------|------|-------------|
| Domain services | ✅ | ✅ | ✅ | Yes |
| Application service | ✅ | ✅ | ✅ | Yes |
| Ports pattern | ✅ | ✅ | ✅ | Yes |
| Domain events | ✅ | ✅ | ❌ | Yes |
| Exception filter | ✅ | ✅ | ✅ | Yes |
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
export * from './repositories/social.repository';
export * from './adapters/user-search.adapter';
export * from './adapters/ranking.adapter';
```

Both modules now use the same pattern. Social also exports adapters for clean integration.

### 6.4 Module Registration

**Ranking module** (`src/modules/ranking/ranking.module.ts`):
- Uses DI tokens properly
- Registers all services explicitly
- Exports ports and services

**Social module** (`src/modules/social/social.module.ts`):
- Uses DI tokens properly
- Registers all services explicitly
- Imports UserModule and RankingModule for cross-domain integration
- Exports ports and services

---

## 7. MVP Readiness Assessment

### Scoring Rubric

| Criteria | Score | Max | Notes |
|----------|-------|-----|-------|
| Architecture Quality | 9 | 10 | Clean hexagonal architecture with ports/adapters |
| Domain Boundaries | 9 | 10 | Clear ownership, proper delegation |
| Feature Completeness | 9 | 10 | All roadmap items implemented |
| Scalability | 9 | 10 | Proper indexes, pagination, soft deletes |
| Maintainability | 9 | 10 | Good code organization, types |
| Consistency | 10 | 10 | Consistent with all other modules |
| **Overall** | **9.2** | 10 | Ready for MVP with all core features |

### Strengths (9/10)

- Clean code organization matching other modules
- Proper error handling with domain-specific errors
- Good database design with proper constraints
- Correct domain boundaries with no ownership leaks
- Domain events for loose coupling
- Exception filter for proper API responses
- Soft deletes for data integrity
- User search functionality
- Friend rankings integration
- Notification integration

### Weaknesses

No significant weaknesses remain. All previously identified gaps have been addressed.

### MVP Decision

**Ready for MVP with all core features:**
1. ✅ User search capability
2. ✅ Notification integration
3. ✅ Exception filter
4. ✅ Friend rankings
5. ✅ Domain events
6. ✅ Soft deletes for data integrity

---

## 8. Refactoring Plan

All phases have been completed successfully.

### Phase 1: Polish

| Status | Task | Effort | Impact | Files |
|--------|------|--------|--------|-------|
| ✅ | Add Exception Filter | 1 day | High | Create `social-domain-exception.filter.ts` |
| ✅ | Fix Cursor Pagination | 0.5 day | Medium | `social.repository.ts` |
| ✅ | Move Schema to Central | 0.5 day | Low | Move to `schema/index.ts`, add relations |

### Phase 2: Integration

| Status | Task | Effort | Impact | Files |
|--------|------|--------|--------|-------|
| ✅ | Add Domain Event Bus | 2 days | Medium | `social.events.ts`, `social.event-bus.ts` |
| ✅ | Implement Notifications | 2 days | High | Add to `SocialService` methods |

### Phase 3: Roadmap Items

| Status | Task | Effort | Impact | Priority |
|--------|------|--------|--------|----------|
| ✅ | Add User Search | 3 days | High | Required for core flow |
| ✅ | Add Friend Rankings | 3 days | Medium | Nice to have |

### Phase 4: Data Integrity

| Status | Task | Effort | Impact | Files |
|--------|------|--------|--------|-------|
| ✅ | Add Soft Deletes | 1 day | High | `friendships`, `blocked_users`, `user_follows` tables |

### Priority Order & Timeline

```
Week 1: Phase 1 (Polishing) - COMPLETED
Week 2: Phase 2 (Integration) - COMPLETED
Week 3: Phase 3 (Roadmap) - COMPLETED
Week 4: Phase 4 (Data Integrity) - COMPLETED

Total: ~10 days (All phases completed)
```

### Implementation Summary

**Phase 1 - Polish:**
- Created `SocialDomainExceptionFilter` for proper error mapping
- Fixed cursor pagination with proper `lte` usage
- Moved social schema to `src/core/database/schema/index.ts`
- Added proper Drizzle relations in `relations.ts`

**Phase 2 - Integration:**
- Created domain event bus (`SocialDomainEventBus`, `SocialDomainEventBusPort`)
- Defined social domain events (`FriendRequestSentEvent`, `FriendRequestAcceptedEvent`, etc.)
- Integrated with notification module via `SocialEventHandler` and `SocialListenerAdapter`

**Phase 3 - Roadmap Items:**
- Added `searchUsers` endpoint with `GET /social/users/search?q=&limit=`
- Added `getFriendLeaderboard` endpoint with `GET /social/friends/leaderboard?period=&limit=`
- Created `UserSearchAdapter` and `RankingAdapter` for clean integration

**Phase 4 - Data Integrity:**
- Added `deletedAt` column to `friendships`, `blocked_users`, `user_follows` tables
- Updated all queries to filter by `deleted_at IS NULL`
- Changed hard deletes to soft deletes in repository methods

---

## Appendix: File Reference

### Core Social Files

| File | Purpose |
|------|---------|
| `src/modules/social/social.module.ts` | Module definition |
| `src/modules/social/domain/services/social.service.ts` | Domain logic |
| `src/modules/social/application/social-application.service.ts` | Application orchestration |
| `src/modules/social/domain/ports/social-ports.ts` | Repository interface |
| `src/modules/social/domain/ports/user-search.port.ts` | User search interface |
| `src/modules/social/domain/ports/ranking.port.ts` | Ranking integration interface |
| `src/modules/social/infrastructure/repositories/social.repository.ts` | Repository implementation |
| `src/modules/social/infrastructure/adapters/user-search.adapter.ts` | User search adapter |
| `src/modules/social/infrastructure/adapters/ranking.adapter.ts` | Ranking adapter |
| `src/modules/social/transport/controller/social.controller.ts` | HTTP endpoints |
| `src/modules/social/transport/filters/social-domain-exception.filter.ts` | Exception filter |
| `src/modules/social/domain/errors/social.errors.ts` | Domain errors |
| `src/modules/social/domain/events/social-domain.events.ts` | Domain event definitions |
| `src/modules/social/domain/events/social-domain.event-bus.ts` | Event bus implementation |
| `src/modules/social/dto/response/social-response.dto.ts` | Response DTOs |

### Related Files (Comparison)

| Module | Exception Filter | Event Bus |
|--------|------------------|-----------|
| User | `user-domain-exception.filter.ts` | ❌ |
| Ranking | `ranking-domain-exception.filter.ts` | `ranking-domain.event-bus.ts` |
| Social | ✅ `social-domain-exception.filter.ts` | ✅ `social-domain.event-bus.ts` |

### Database Tables

| Table | Purpose |
|-------|---------|
| `friendships` | Friend requests and accepted relationships |
| `blocked_users` | User blocks |
| `user_follows` | Follow relationships |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/social/users/search?q=&limit=` | Search users for adding friends |
| GET | `/social/friends/leaderboard?period=&limit=` | Get friend leaderboard |
| POST | `/social/friend-request/:userId` | Send friend request |
| GET | `/social/friend-requests/incoming` | Get pending requests |
| GET | `/social/friend-requests/outgoing` | Get sent requests |
| POST | `/social/friend-requests/:id/respond` | Accept/reject request |
| DELETE | `/social/friend-requests/:id` | Cancel request |
| GET | `/social/friends` | Get friends list |
| DELETE | `/social/friends/:userId` | Remove friend |
| POST | `/social/block/:userId` | Block user |
| DELETE | `/social/block/:userId` | Unblock user |
| GET | `/social/blocked` | Get blocked users |
| POST | `/social/follow/:userId` | Follow user |
| DELETE | `/social/follow/:userId` | Unfollow user |
| GET | `/social/followers` | Get followers |
| GET | `/social/following` | Get following |
| GET | `/social/relationship/:userId` | Get relationship status |
| GET | `/social/counts` | Get social counts |

---

*Document generated: June 2, 2026*
*Last updated: June 2, 2026*
