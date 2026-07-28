# Social Module Production-Readiness Audit Report

**Audit Date:** July 28, 2026
**Module:** Social (`src/modules/social`)
**Status:** Production-Ready with Minor Issues

---

## Executive Summary

The social module is well-designed and production-ready. The codebase demonstrates solid architectural practices including clean separation of concerns, proper error handling with RFC 7807 compliance, rate limiting, IDOR protection, comprehensive domain events, and consistent error code naming.

**Overall Severity Assessment:**
- Critical: 0
- High: 0
- Medium: 1
- Low: 7
- **Total Findings:** 8

---

## Finding 1: Duplicate Activity Type in Feed DTO

**Category:** Redundancy / Bug
**Severity:** Medium
**Priority:** P2

### Location

`src/modules/social/dto/response/feed.dto.ts`, lines 4-20

### Current Behavior

```typescript
const SOCIAL_FEED_ACTIVITY_TYPES = [
  'badge_earned',
  'badge_revoked',
  'rank_milestone',
  'peak_rank_achieved',
  'tournament_joined',
  'tournament_completed',
  'tournament_won',
  'comment_created',
  'comment_created',  // DUPLICATE
  'comment_created',  // DUPLICATE
  'quiz_completed',
  'quiz_milestone',
  'instance_created',
  'instance_joined',
  'instance_completed',
] as const;
```

### Problem

- `comment_created` appears three consecutive times
- This is copy-paste redundancy indicating manual maintenance rather than sourcing from the canonical type definition
- The runtime constant could diverge from `SocialFeedActivityType` in `social.types.ts` (lines 143-156)

### Recommendation

Source the constant from the type definition instead of maintaining a separate hardcoded array:

```typescript
import type { SocialFeedActivityType } from '../../domain/types/social.types';

// Remove the runtime constant entirely
// Use the type directly in the decorator:
type SocialFeedActivityTypes = SocialFeedActivityType[];
```

### Implementation Phase

**Phase 1**

---

## Finding 2: Cursor Pagination Metadata Inconsistency

**Category:** Request & Response Consistency
**Severity:** Low
**Priority:** P3

### Location

`src/modules/social/transport/presenters/social.presenter.ts`

### Current Behavior

Three different response envelope styles are used:

1. `ApiResponse.page()` for `getFriends`, `getFriendsOfUser`, `getFollowers`, `getFollowing`
2. `wrapCursorPaginatedDto()` for `getSuggestions`, `getFeed`, `getUserActivity`, `getFollowersOfUser`, `getMutualFriends`, `getMutualFollowers`, `getFollowingOfUser`
3. `ApiResponse.ok()` for single-resource endpoints

### Problem

Frontend developers must handle multiple pagination metadata shapes depending on which endpoint is called, even though all use cursor-based pagination.

### Recommendation

Consolidate to a single pagination helper. The `wrapCursorPaginatedDto` already provides the correct `{ data, meta: { timestamp, pagination } }` structure. Consider:

1. Updating `ApiResponse.page()` to include `meta.timestamp` for consistency, OR
2. Standardizing all cursor-paginated endpoints on `wrapCursorPaginatedDto`

### Implementation Phase

**Phase 2**

---

## Finding 3: Deprecated Stub Without Deprecation Header

**Category:** REST API Design
**Severity:** Low
**Priority:** P3

### Location

`src/modules/social/transport/controller/social.controller.ts`, lines 307-331

### Current Behavior

```typescript
@All('friend-request')
@ApiOperation({
  summary: 'Deprecated singular friend-request path (always returns 405)',
  ...
})
deprecatedFriendRequestPath(): never {
  throw new HttpException({...}, HttpStatus.METHOD_NOT_ALLOWED);
}
```

### Problem

The stub correctly returns 405 and mentions "Deprecated" in the summary, but lacks an `@ApiDeprecated()` decorator or `deprecated: true` in the OpenAPI schema.

### Recommendation

Add the `@ApiDeprecated()` decorator:

```typescript
@All('friend-request')
@ApiDeprecated('Use POST /friend-requests/:userId instead')
@ApiOperation({
  summary: 'Deprecated singular friend-request path (always returns 405)',
  ...
})
deprecatedFriendRequestPath(): never {
  ...
}
```

### Implementation Phase

**Phase 2**

---

## Finding 4: Missing `displayName` in Mutual DTOs

**Category:** Request & Response Consistency
**Severity:** Low
**Priority:** P3

### Location

`src/modules/social/dto/response/mutual.dto.ts`

### Current Behavior

```typescript
export class MutualFriendItemDto {
  userId!: string;
  username!: string;
  avatarUrl!: string | null;
  // displayName is missing
}

export class MutualFollowerItemDto {
  userId!: string;
  username!: string;
  avatarUrl!: string | null;
  // displayName is missing
}
```

### Problem

Other similar DTOs (`UserFollowerItemDto`, `UserFollowingItemDto`, `SearchableUserDto`) include `displayName` as an optional field. The mutual DTOs omit it, creating an inconsistent response shape.

### Recommendation

Add `displayName` to both `MutualFriendItemDto` and `MutualFollowerItemDto`:

```typescript
@ApiPropertyOptional({
  description: 'Display name',
  example: 'Mike',
  nullable: true,
})
displayName!: string | null;
```

Also update the repository queries in `friendship.repository.ts` and `user-follow.repository.ts` to include `displayName` in the SELECT.

### Implementation Phase

**Phase 2**

---

## Finding 5: Friend Request Cancellation Soft-Delete Behavior

**Category:** Business Semantics
**Severity:** Low
**Priority:** Informational

### Location

`src/modules/social/infrastructure/repositories/friendship.repository.ts`, lines 191-205

### Current Behavior

`removeFriend()` soft-deletes the friendship record by setting `deletedAt`. However, `cancelFriendRequest()` calls this same method to remove pending friend requests.

### Observation

- Cancelled friend requests are soft-deleted (persisted with `deletedAt` timestamp)
- Rejected friend requests have `status = 'rejected'` (not soft-deleted)
- Both approaches are defensible but different

### Recommendation

Document this design choice. No code change required unless inconsistency is deemed problematic.

### Implementation Phase

**Documentation Only** (No code change)

---

## Finding 6: Idempotent Follow Without Distinct Response

**Category:** Business Semantics
**Severity:** Low
**Priority:** P3

### Location

`src/modules/social/domain/services/social.service.ts`, lines 454-481

### Current Behavior

```typescript
try {
  const follow = await this.userFollowRepository.followUser(followerId, followingId);
  // ... event emission
} catch (error) {
  if (isPostgresUniqueViolation(error)) {
    return;  // Silently ignores duplicate follow
  }
  throw error;
}
```

### Problem

Re-following a user returns 204 even if already following. Clients cannot distinguish between "now following" and "was already following."

### Recommendation

1. Document this idempotent behavior in the API contract
2. Consider whether returning 200 with a flag (`alreadyFollowing: true`) would improve client experience
3. Ensure consistency with other idempotent operations (e.g., block/unblock)

### Implementation Phase

**Phase 2** (if response enhancement desired) or **Documentation Only** (if current behavior is acceptable)

---

## Finding 7: Public Endpoint Access Controls (Positive Finding)

**Category:** Security
**Severity:** Informational

### Observation

The following endpoints are correctly marked as `@Public()`:
- `GET /social/search/suggestions`
- `GET /social/users/trending`
- `GET /social/users/:userId/stats`

No security issues identified. The module correctly distinguishes between public and authenticated endpoints.

### Recommendation

No action required.

---

## Finding 8: Potential N+1 in Friend Leaderboard

**Category:** Maintainability / Performance
**Severity:** Low
**Priority:** P3

### Location

`src/modules/social/domain/services/social.service.ts`, lines 874-981

### Current Behavior

```typescript
async getFriendLeaderboard(...) {
  // Fetches up to 1000 friends regardless of requested limit
  const friends = await this.socialRepository.getFriends(userId, 1000, null);
  // Then filters and limits
  const entries = friends.map(...).filter((e) => e.xp > 0);
  const limitedEntries = entries.slice(0, limit);
}
```

### Problem

Always fetches up to 1000 friends even if `limit=10` is requested. Inefficient for users with many friends.

### Recommendation

1. Pass the `limit` parameter to `getFriends()` to control the initial fetch
2. Consider if filtering by `xp > 0` should happen in the database query instead of in-memory

### Implementation Phase

**Phase 3** (Performance optimization)

---

## Implementation Phases

### Phase 1 (Critical - Address Before Production)

| # | Finding | Effort | Risk |
|---|---------|--------|------|
| 1 | Duplicate activity type in Feed DTO | Low | None |

**Phase 1 Actions:**
1. Remove the redundant `SOCIAL_FEED_ACTIVITY_TYPES` constant from `feed.dto.ts`
2. Source the enum directly from `SocialFeedActivityType` in `social.types.ts`
3. Verify no other code depends on the removed constant

---

### Phase 2 (Polish - Address in Sprint)

| # | Finding | Effort | Risk |
|---|---------|--------|------|
| 2 | Pagination metadata inconsistency | Medium | Low |
| 3 | Missing @ApiDeprecated() on stub | Low | None |
| 4 | Missing displayName in mutual DTOs | Low | None |
| 6 | Idempotent follow documentation | Low | None |

**Phase 2 Actions:**

1. **Pagination Consistency**
   - Audit `ApiResponse.page()` vs `wrapCursorPaginatedDto()` implementations
   - Choose one canonical format
   - Update all presenter methods to use the chosen format
   - Update Swagger decorators if needed

2. **Deprecated Stub**
   - Add `@ApiDeprecated('Use POST /friend-requests/:userId instead')` to the `@All('friend-request')` handler

3. **Mutual DTOs**
   - Add `displayName` field to `MutualFriendItemDto` and `MutualFollowerItemDto`
   - Update repository queries in `friendship.repository.ts` and `user-follow.repository.ts` to JOIN `user_profiles` and SELECT `display_name`

4. **Follow Documentation**
   - Add API contract note that `POST /social/follow/:userId` is idempotent
   - Update Swagger description if needed

---

### Phase 3 (Optimization - Address in Future Sprint)

| # | Finding | Effort | Risk |
|---|---------|--------|------|
| 8 | Friend leaderboard fetch efficiency | Medium | Low |

**Phase 3 Actions:**
1. Modify `getFriendLeaderboard` to accept a limit for the initial `getFriends()` call
2. Consider moving the `xp > 0` filter to the database query
3. Add integration tests for users with large friend lists

---

### Documentation Only

| # | Finding |
|---|---------|
| 5 | Friend request cancellation soft-delete behavior |
| 7 | Public endpoint access controls (positive finding) |

---

## Estimated Effort

| Phase | Finding Count | Estimated Effort |
|-------|---------------|------------------|
| Phase 1 | 1 | 1-2 hours |
| Phase 2 | 4 | 4-6 hours |
| Phase 3 | 1 | 2-3 hours |
| **Total** | **6** | **7-11 hours** |

---

## Recommendations Summary

1. **Deploy with Phase 1 fixes** - The duplicate activity type is the only issue that could cause runtime confusion.

2. **Phase 2 improves API consistency** - Frontend developers will benefit from predictable response shapes and complete user profiles in mutual DTOs.

3. **Phase 3 is optional** - The leaderboard optimization is a nice-to-have unless performance issues are observed in production.

4. **Consider the module production-ready** - With Phase 1 fixes, the module is suitable for production deployment. The remaining findings are polish items.

---

## Appendix: Error Codes Reference

The social module correctly uses the `SOCIAL_*` prefix for all error codes:

| Code | Error Class | HTTP Status |
|------|-------------|-------------|
| `SOCIAL_FRIEND_REQUEST_NOT_FOUND` | `FriendRequestNotFoundError` | 404 |
| `SOCIAL_FRIEND_REQUEST_FORBIDDEN` | `FriendRequestForbiddenError` | 403 |
| `SOCIAL_FRIEND_LIST_FORBIDDEN` | `FriendListForbiddenError` | 403 |
| `SOCIAL_SELF_FRIEND_REQUEST` | `SelfFriendRequestError` | 400 |
| `SOCIAL_ALREADY_FRIENDS` | `AlreadyFriendsError` | 409 |
| `SOCIAL_BLOCKED_USER` | `BlockedUserError` | 403 |
| `SOCIAL_USER_BLOCKED` | `UserBlockedError` | 403 |
| `SOCIAL_PENDING_REQUEST_EXISTS` | `PendingRequestExistsError` | 409 |
| `SOCIAL_FRIENDSHIP_NOT_FOUND` | `FriendshipNotFoundError` | 404 |
| `SOCIAL_USER_NOT_BLOCKED` | `UserNotBlockedError` | 404 |
| `SOCIAL_FOLLOW_NOT_FOUND` | `FollowNotFoundError` | 404 |

Error codes follow a consistent naming convention and use appropriate HTTP status codes.

---

*Audit completed by AI assistant on July 28, 2026*
