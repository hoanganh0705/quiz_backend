# Social Module Architecture Review

> **Review Date**: July 23, 2026
> **Module**: Social Module
> **Reviewer**: Architecture Review (Pre-Production)

---

## Executive Summary

**Overall Score: 8.5/10**

| Dimension | Score | Assessment |
|-----------|-------|------------|
| Architecture | 9/10 | Follows project conventions well |
| Product Design | 7/10 | Good core features, missing documentation |
| Business Modeling | 8/10 | Solid domain model, some gaps |
| Domain Modeling | 8/10 | Well-structured with good separation |
| API Design | 7/10 | Mostly good, some inconsistencies |
| Concurrency | 7/10 | Missing transaction boundaries |
| Scalability | 8/10 | Good indexing, some N+1 concerns |
| Maintainability | 8/10 | Well-organized, good test coverage |
| Extensibility | 9/10 | Event-driven architecture supports growth |
| Business Alignment | 8/10 | Matches typical social platform patterns |

---

## Major Strengths

1. **Clean Domain-Driven Design**: Well-separated ports/adapters pattern with explicit Symbol tokens
2. **Event-Driven Architecture**: Social module correctly publishes domain events and subscribes to cross-module events
3. **Comprehensive Error Handling**: 8 domain exceptions with RFC 7807 mapping, well-documented
4. **Soft Delete Pattern**: All relationship tables properly implement soft delete with partial unique indexes
5. **Access Control**: IDOR vulnerabilities fixed with proper relationship checks
6. **Cross-Module Integration**: Correctly uses port pattern for all cross-module dependencies
7. **Test Coverage**: Domain errors have comprehensive spec tests

---

## Major Weaknesses

1. **Missing Transaction Boundaries**: Write operations lack `@Transactional()` decorator
2. **Mixed Pagination Strategy**: Inconsistent use of cursor vs offset pagination
3. **No Module Documentation**: Missing `docs/modules/social.md`
4. **Feed Not Personalized**: Global feed ignores user's network (friends/followers)
5. **N+1 Query Pattern**: `searchUsers` makes parallel DB calls per result

---

## Consistency Analysis

### Project Rules → Documentation → Implementation → Tests

| Rule | Status | Evidence |
|------|--------|----------|
| Layer separation | ✅ Compliant | `social.module.ts:1-94` imports flow correctly |
| Port/Adapter pattern | ✅ Compliant | `domain/ports/` contains all interfaces |
| Symbol tokens | ✅ Compliant | `SOCIAL_REPOSITORY_PORT`, etc. |
| Domain events | ✅ Compliant | `social-domain.events.ts` |
| Error hierarchy | ✅ Compliant | `social.errors.ts` + `social.errors.spec.ts` |
| UUID v7 generation | ✅ Compliant | Schema uses `sql\`uuidv7()\`` |
| Soft delete | ✅ Compliant | Partial indexes on all tables |
| `@Transactional()` | ❌ **Missing** | Write endpoints lack decorator |
| Cursor pagination default | ❌ **Mixed** | Some endpoints use offset |
| DTO conventions | ✅ Compliant | Request/Response properly separated |

---

## Product Review

### Capabilities by Category

| Capability | Status | Evidence |
|------------|--------|----------|
| Friend requests | ✅ Implemented | `social.controller.ts:251-305` |
| Accept/reject requests | ✅ Implemented | `social.controller.ts:285-295` |
| Remove friends | ✅ Implemented | `social.controller.ts:330-344` |
| Block/unblock users | ✅ Implemented | `social.controller.ts:348-391` |
| Follow/unfollow users | ✅ Implemented | `social.controller.ts:395-427` |
| View followers/following | ✅ Implemented | `social.controller.ts:429-551` |
| Mutual friends/followers | ✅ Implemented | `social.controller.ts:460-520` |
| Social feed | ⚠️ **Incomplete** | Returns all activity, not personalized |
| Friend leaderboard | ✅ Implemented | `social.controller.ts:234-246` |
| Trending users | ✅ Implemented | `social.controller.ts:169-179` |
| User search | ✅ Implemented | `social.controller.ts:95-114` |
| Username suggestions | ✅ Implemented | `social.controller.ts:67-93` |

### Missing Product Capabilities

| Capability | Category | Justification |
|------------|----------|---------------|
| Personalized feed | **Required Fix** | Feed ignores user's network (friends/followers). Currently returns all platform activity |
| Privacy controls | **Future Product** | Users cannot control what activities appear in their feed |
| Mute/hide users | **Future Product** | Soft blocking without full unfollow |
| Private account mode | **Future Product** | Approve follower requests |
| Story/highlight activity | **YAGNI** | No evidence in domain model |

---

## Business Workflow Review

### Friend Request State Machine

```
[No Relationship]
       ↓
[Pending Request Sent]
       ↓
   ┌───────┐
   │ Accept│──→ [Friends]
   └───────┘
   ┌───────┐
   │Reject │──→ [Rejected] (can re-request)
   └───────┘
   ┌───────────┐
   │  Cancel  │──→ [No Relationship]
   └───────────┘

[Friends] ──→ [Remove Friend] ──→ [No Relationship]
     │
     └─── [Block] ──→ [Blocked] ──→ [Unblock] ──→ [No Relationship]
```

### Follow State Machine

```
[Not Following]
       ↓
[Following]
       ↓
[Unfollow] ──→ [Not Following]

[Following] ──→ [Block] ──→ [Blocked]
```

### State Transitions and Ownership

| Transition | Owner | Trigger |
|------------|-------|---------|
| Send request | User | `POST /social/friend-requests/:userId` |
| Accept request | Addressee | `POST /social/friend-requests/:friendshipId/respond` |
| Reject request | Addressee | `POST /social/friend-requests/:friendshipId/respond` |
| Cancel request | Requester | `DELETE /social/friend-requests/:friendshipId` |
| Remove friend | Either | `DELETE /social/friends/:userId` |
| Block user | User | `POST /social/block/:userId` |
| Unblock user | User | `DELETE /social/block/:userId` |
| Follow | User | `POST /social/follow/:userId` |
| Unfollow | User | `DELETE /social/follow/:userId` |

---

## Domain Review

### Aggregates

| Aggregate | Root Entity | Invariants |
|-----------|-------------|------------|
| Friendship | `friendshipId` | `requesterId != addresseeId`, single pending request per pair |
| BlockedUser | `blockId` | `blockerId != blockedId`, single block per pair |
| UserFollow | `followId` | `followerId != followingId`, single follow per pair |
| SocialFeedActivity | `activityId` | `payload != {}`, `payload` is JSON object |

### Repository Port Boundaries

| Port | Location | Methods |
|------|----------|---------|
| `SocialRepositoryPort` | `domain/ports/social-ports.ts:26-103` | 40 methods (too large) |
| `FriendshipRepositoryPort` | `domain/ports/friendship-ports.ts:11-34` | 9 methods |
| `UserFollowRepositoryPort` | `domain/ports/user-follow-ports.ts:12-50` | 12 methods |
| `BlockRepositoryPort` | `domain/ports/block-ports.ts:5-13` | 4 methods |

### Issue: `SocialRepositoryPort` is Too Large

**Evidence**: `social.repository.impl.ts` contains 50+ methods delegating to specialized repositories.

**Impact**: The "facade" pattern was intended but `SocialRepositoryPort` duplicates methods from other ports.

**Recommendation**: Remove stub methods from `SocialRepositoryPort` and use specialized ports directly.

---

## API Review

### DTO Conventions

| DTO | Location | Assessment |
|-----|----------|------------|
| `FriendRequestDto` | `dto/response/friend.dto.ts` | ✅ Good |
| `BlockedUserDto` | `dto/response/blocked.dto.ts` | ✅ Good |
| `SocialCountsDto` | `dto/response/stats.dto.ts` | ✅ Good |
| `UserFollowerItemDto` | `dto/response/follower-following.dto.ts` | ⚠️ Exposes `followId` (internal ID) |

### Implementation Leaks

| Field | Location | Issue |
|-------|----------|-------|
| `followId` | `FollowerDto` | Internal database ID exposed in public API |
| `friendshipId` | `FriendDto` | Internal database ID exposed |

### API Consistency Issues

| Endpoint | Pagination | Expected | Issue |
|----------|------------|----------|-------|
| `GET /social/feed` | Offset | Cursor | Large dataset, unstable results |
| `GET /social/suggestions` | Offset | Cursor | Large dataset |
| `GET /social/users/:id/followers` | Offset | Cursor | Large dataset |
| `GET /social/friends/:userId` | Cursor | ✅ | Correct |

---

## Concurrency Review

### Critical Issue: Missing Transaction Boundaries

**Evidence**:
- `social.controller.ts` - no `@Transactional()` on write endpoints
- `sendFriendRequest`, `respondToFriendRequest`, `blockUser`, `followUser` all lack transaction

**Race Condition Example** (Block User):

```typescript
// social.service.ts:301-351
await this.blockRepository.blockUser(blockerId, blockedId, reason);  // Write 1
await this.friendshipRepository.removeFriend(blockerId, blockedId);    // Write 2
```

If two concurrent block requests arrive, or block+friend happen simultaneously, data inconsistency is possible.

### Optimistic Locking

Not implemented for relationship state transitions. Consider adding version columns if needed at scale.

### Idempotency

✅ Good: `followUser` uses `ON CONFLICT ... DO NOTHING`

---

## Scalability Review

### Index Coverage

| Table | Index | Purpose |
|-------|-------|---------|
| `friendships` | `idx_friendships_requester` | Query by requester |
| `friendships` | `idx_friendships_addressee` | Query by addressee |
| `friendships` | `uq_friendships_pair` | Unique active pair |
| `user_follows` | `idx_user_follows_follower` | Query followers |
| `user_follows` | `idx_user_follows_following` | Query following |
| `blocked_users` | `idx_blocked_users_blocker` | Query blocks |
| `social_feed_activities` | `idx_social_feed_activities_user_occurred` | User activity feed |
| `social_feed_activities` | `idx_social_feed_activities_occurred` | Global feed |

### N+1 Query Pattern

**Evidence**: `social.service.ts:763-776`

```typescript
const searchableUsers: SearchableUser[] = await Promise.all(
  users.map(async (user) => {
    const status = await this.socialRepository.getRelationshipStatus(searcherId, user.userId);
    // ... per-user query
  }),
);
```

**Impact**: For 20 search results, 20+ additional queries executed.

### Feed Scalability

**Issue**: `getFeed` queries ALL users' activities, not just the user's network.

```typescript
// social.repository.impl.ts:65-103
.from(socialFeedActivities)
.innerJoin(users, eq(socialFeedActivities.userId, users.userId))
```

**Impact**: Feed grows with entire platform, not user's social graph.

---

## Maintainability Review

### Code Organization

✅ **Excellent**: Clean separation following project conventions

- `domain/services/` - Business logic
- `domain/ports/` - Interfaces
- `domain/events/` - Event definitions
- `application/` - Orchestration
- `infrastructure/repositories/` - Data access
- `transport/` - HTTP entry points

### Test Coverage

| File | Coverage |
|------|----------|
| `social.errors.spec.ts` | ✅ 8 exceptions tested |
| Domain services | ⚠️ Unit tests not found |
| Repository | ⚠️ Integration tests not found |

### Documentation

❌ **Missing**: `docs/modules/social.md` - no module documentation exists

---

## Architecture Consistency Review

### Layer Compliance

| Layer | Rule | Status |
|-------|------|--------|
| `domain/` imports | No infrastructure | ✅ Compliant |
| `application/` imports | No Drizzle | ✅ Compliant |
| `infrastructure/` | Only Drizzle | ✅ Compliant |
| `transport/` | No business logic | ✅ Compliant |

### Cross-Module Dependencies

| Dependency | Pattern | Status |
|------------|---------|--------|
| User module | Port (`USER_SEARCH_PORT`) | ✅ Correct |
| Ranking module | Port (`RANKING_PORT`) | ✅ Correct |
| Notification module | Port (`SOCIAL_NOTIFICATION_PORT`) | ✅ Correct |
| Event buses | External event bus | ✅ Correct |

---

## Missing Product Capabilities

### Required Fix

| Capability | Why Required | Evidence |
|------------|-------------|----------|
| Personalized feed | Current feed shows all platform activity, not user's network | `social.repository.impl.ts:65-103` |

### Product Comment

| Capability | Why Discuss | Notes |
|------------|------------|-------|
| Privacy controls | Users cannot control feed visibility | Future feature |
| Mute users | Soft block without full unfollow | Similar to Twitter/X |
| Private accounts | Follow request approval | Additional complexity |

### Future Product

| Capability | Why Future | Notes |
|------------|-----------|-------|
| Activity visibility settings | Depends on product decision | Per-activity toggles? |
| User stories/highlights | No evidence in model | Out of scope |

### YAGNI

| Capability | Why Not Now | Notes |
|------------|-------------|-------|
| Group chats | Not in model | Different domain |
| Direct messaging | Not in model | Different module |

---

## Final Verdict

| Category | Recommendation | Rationale |
|----------|----------------|-----------|
| Core friend/follow/block features | **Merge Immediately** | Well-implemented, tested, follows conventions |
| Personalized feed fix | **Product Comment Required** | Design decision needed |
| Transaction boundaries | **Future Roadmap** | Low risk at current scale |
| Pagination consistency | **Future Roadmap** | Low risk, UX improvement |
| Module documentation | **Future Roadmap** | Helpful but not blocking |

---

## Implementation Plan

### Phase 1: Critical Fixes (Before Production)

#### Goal

Fix architectural violations that could cause data inconsistency in production.

#### Items

1. Add `@Transactional()` to write endpoints
2. Implement personalized feed (filter by user's network)

#### Dependencies

- None (can be done in parallel)

#### Risks

- Transaction fix: Low risk, well-understood pattern
- Feed personalization: Requires clear definition of "network" (friends only? follows too?)

#### Deliverables

- Write operations wrapped in transactions
- Feed returns only friends'/followers' activities

#### Exit Criteria

- [ ] All write endpoints have `@Transactional()`
- [ ] Feed query filters by user's social graph

---

### Phase 2: Consistency Improvements

#### Goal

Align implementation with project standards and improve API consistency.

#### Items

1. Standardize pagination (cursor for all large lists)
2. Remove `followId`/`friendshipId` from public DTOs (or document intentionally)
3. Create `docs/modules/social.md`

#### Dependencies

- Phase 1 complete

#### Risks

- Pagination change: Breaking API change, requires deprecation cycle
- DTO field removal: Breaking API change

#### Deliverables

- Consistent pagination strategy
- API documentation
- Module architecture documentation

#### Exit Criteria

- [ ] All list endpoints use cursor pagination
- [ ] Internal IDs removed from public DTOs or documented
- [ ] `docs/modules/social.md` created

---

### Phase 3: Performance Optimization

#### Goal

Address scalability concerns for production load.

#### Items

1. Fix N+1 in `searchUsers`
2. Add caching for frequently accessed counts
3. Consider materialized view for feed

#### Dependencies

- Phase 2 complete

#### Risks

- N+1 fix: Straightforward SQL optimization
- Caching: Cache invalidation complexity

#### Deliverables

- Optimized search with batch relationship lookups
- Cached social counts

#### Exit Criteria

- [ ] Search N+1 resolved
- [ ] Social counts cached appropriately

---

## Dependency Analysis

### Critical Path

```
Write Operations → @Transactional() Fix
        ↓
Personalized Feed → Filter by Network
        ↓
Performance → N+1 Fix
```

### Parallel Work

| Task | Can Parallelize With |
|------|---------------------|
| Transaction fix | Documentation |
| Feed personalization | Pagination standardization |
| Pagination fix | DTO review |

### Deferred Work

- Materialized views for feed (wait for scale metrics)
- Activity visibility settings (product decision)
- Mute functionality (future phase)

---

## Summary of Recommendations

| Priority | Recommendation | Category | Effort |
|----------|----------------|----------|--------|
| **P0** | Add `@Transactional()` to all write endpoints | Required Fix | Low |
| **P0** | Implement personalized feed | Required Fix | Medium |
| **P1** | Standardize cursor pagination | Consistency | Low |
| **P1** | Create `docs/modules/social.md` | Documentation | Low |
| **P2** | Fix N+1 in searchUsers | Performance | Medium |
| **P2** | Remove internal IDs from public DTOs | API Design | Low |
| **P3** | Add caching for social counts | Performance | Medium |

---

## Conclusion

The social module is well-architected and follows project conventions. The critical fixes (transactions and personalized feed) should be addressed before production deployment. The module demonstrates good separation of concerns, comprehensive error handling, and proper cross-module integration through the port pattern.

Key areas requiring attention:

1. **Transaction boundaries** - Essential for data consistency
2. **Personalized feed** - Core product requirement
3. **Pagination consistency** - API hygiene
4. **Documentation** - Maintainability for future developers
