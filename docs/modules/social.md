# Social Module

## Purpose

Manages **user relationships, social discovery, and the unified activity feed** across all modules. The module provides a graph-based view of user connections (friends, follows, blocks) and aggregates cross-module activity into personalized feeds.

## Responsibilities

**Owns**
- Friend request lifecycle (send, accept, decline, cancel)
- User following/follower relationships
- User blocking
- Social suggestions based on mutual connections
- Unified social activity feed (from achievements, attempts, rankings, tournaments)
- Social analytics (follower growth, social counts)

**Does not own**
- User profiles (User module)
- Achievements/badges (Achievement module)
- Rankings (Ranking module)
- Tournament participation (Tournament module)

## Core Concepts

| Concept | Description |
|---|---|
| **Friendship** | Bidirectional connection, established via friend request acceptance. |
| **Follow** | Unidirectional subscription to a user's public activity. |
| **Block** | Prevents all social interactions and hides content. |
| **Friend Request** | Request to become friends (pending → accepted/rejected). |
| **Social Feed** | Aggregated activity from friends and followed users. |
| **Social Suggestion** | Recommended connection based on mutual friends/followers. |

## Business Rules

- **No self-connections**: Users cannot friend, follow, or block themselves.
- **Friendship is bidirectional**: Accepted requests create mutual visibility.
- **Follow is unidirectional**: Users can follow anyone (except blocked users).
- **Block is bidirectional**: Both parties are excluded from each other's feeds and cannot interact.
- **Pending request guard**: Cannot send a duplicate friend request while one is pending.
- **Feed personalization**: Feed only shows activities from friends and followed users.
- **Access control**: Users can only view friends/followers lists of public profiles or mutual connections.

## Relationships

```
SocialModule
├── Friendships (bidirectional)
├── UserFollows (unidirectional)
├── BlockedUsers (bidirectional, excludes from all interactions)
└── SocialFeedActivities (aggregated from other modules)
    ├── AchievementModule → badge.earned, badge.revoked
    ├── AttemptModule → attempt.completed, quiz.milestone
    ├── RankingModule → rank.milestone, peak.rank.achieved
    └── TournamentModule → tournament.joined
```

## Tables

| Table | Description |
|---|---|
| `friendships` | Friend request and accepted friend records. |
| `user_follows` | Follower/following relationships (soft-delete). |
| `blocked_users` | Block records with optional reason (soft-delete). |
| `social_feed_activities` | Cross-module activity records for the feed. |

## Pagination Strategy

All list endpoints use **cursor-based pagination** for stability and efficiency with large datasets:

| Endpoint | Cursor Fields | Ordering |
|---|---|---|
| `GET /social/feed` | `{ occurredAt, activityId }` | `occurredAt DESC, activityId DESC` |
| `GET /social/suggestions` | `{ score, mutualFriends, mutualFollowers, username }` | `score DESC, mutualFriends DESC, mutualFollowers DESC, username ASC` |
| `GET /social/users/:id/followers` | `{ followedAt, followId }` | `followedAt DESC, followId DESC` |
| `GET /social/users/:id/following` | `{ followedAt, followId }` | `followedAt DESC, followId DESC` |
| `GET /social/users/:id/mutual-friends` | `{ username }` | `username ASC` |
| `GET /social/users/:id/mutual-followers` | `{ username }` | `username ASC` |
| `GET /social/friends/:id` | `{ friendSince }` | `friendSince DESC` |

## Permissions

| Action | Permission |
|---|---|
| View own social data | Authenticated user |
| View others' public data | Public |
| View others' friends/followers | Owner or mutual friend |
| Send friend request | Authenticated user |
| Respond to friend request | Authenticated user (addressee only) |
| Block/Unblock user | Authenticated user |
| Follow/Unfollow user | Authenticated user |

## Remove-style endpoint semantics

State-transition DELETE endpoints in this module require the target
relationship to exist. If the resource is absent, the endpoint
throws a 404 `BaseDomainException` so the caller can distinguish
"the action did something" from "the action had nothing to act on".
This is consistent with the sibling endpoints (`DELETE
/friend-requests/:friendshipId` already throws
`FriendRequestNotFoundError`) and with the codebase-wide pattern
used by notification / bookmark / review / achievement removes.

| Endpoint | 404 code | Side-effect notes |
|---|---|---|
| `DELETE /social/friends/:userId` | `SOCIAL_FRIENDSHIP_NOT_FOUND` | `friend_removed` event + cache invalidation only fire on actual removal |
| `DELETE /social/block/:userId` | `SOCIAL_USER_NOT_BLOCKED` | `social.user.unblocked` audit log entry only written on actual unblock |
| `DELETE /social/follow/:userId` | `SOCIAL_FOLLOW_NOT_FOUND` | `user_unfollowed` event only emitted on actual unfollow (preventing false-positive notifications) |

The same rule is applied in the category module for
`DELETE /categories/:id/follow` (`CATEGORY_FOLLOW_NOT_FOUND`).

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **User** | Reads user profiles for display; shares `UserSearchPort` for username search. |
| **Achievement** | Subscribes to `SHARED_ACHIEVEMENT_EVENT_BUS` for `badge.earned` and `badge.revoked` events. |
| **Attempt** | Subscribes to `ATTEMPT_DOMAIN_EVENT_BUS` for `attempt.completed` and `quiz.milestone` events. |
| **Ranking** | Subscribes to `SHARED_RANKING_EVENT_BUS` for `ranking.milestone` and `peak.rank.achieved` events. |
| **Tournament** | Subscribes to `SHARED_TOURNAMENT_EVENT_BUS` for `tournament.joined` events. |
| **Notification** | Emits social events via `SOCIAL_NOTIFICATION_PORT` for friend requests, follows, and blocks. |

## Event Architecture

### Domain Events (In-Process)

| Event | Triggered By | Handled By |
|---|---|---|
| `FriendRequestSentEvent` | `SocialService.sendFriendRequest()` | `SocialNotificationListenerAdapter` |
| `FriendRequestAcceptedEvent` | `SocialService.respondToFriendRequest()` | `SocialNotificationListenerAdapter` |
| `UserFollowedEvent` | `SocialService.followUser()` | `SocialNotificationListenerAdapter` |
| `UserBlockedEvent` | `SocialService.blockUser()` | `SocialNotificationListenerAdapter` |

### Feed Activity Events (Cross-Module)

| Activity Type | Source | Feed Visibility |
|---|---|---|
| `badge.earned` | Achievement Module | Friends & Followers |
| `badge_revoked` | Achievement Module | Friends & Followers |
| `attempt.completed` | Attempt Module | Friends & Followers |
| `quiz.milestone` | Attempt Module | Friends & Followers |
| `rank.milestone` | Ranking Module | Friends & Followers |
| `peak.rank.achieved` | Ranking Module | Friends & Followers |
| `tournament.joined` | Tournament Module | Friends & Followers |

## Invariants

- No self-friendship, self-follow, or self-block.
- Blocked users cannot see each other's content or interact.
- Friend list visibility is restricted to owner and mutual friends.
- Feed activities are only visible from friends and followed users.
- All write operations are wrapped in database transactions.

## API Endpoints

### Social Graph

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/social/relationship/:userId` | Get relationship status with a user |
| `POST` | `/social/friend-requests/:userId` | Send friend request |
| `POST` | `/social/friend-requests/:friendshipId/respond` | Accept or decline a friend request |
| `DELETE` | `/social/friend-requests/:friendshipId` | Cancel an outgoing friend request |
| `GET` | `/social/friend-requests/incoming` | Get incoming friend requests |
| `GET` | `/social/friend-requests/outgoing` | Get outgoing friend requests |
| `ANY` | `/social/friend-request` | **Deprecated.** Stub that always returns `405 Method Not Allowed` (`GLOBAL_METHOD_NOT_ALLOWED`). Migrate to the plural paths above. Retained indefinitely for SDKs that cached the old URL. |
| `DELETE` | `/social/friends/:userId` | Remove a friend |
| `POST` | `/social/block/:userId` | Block a user |
| `DELETE` | `/social/block/:userId` | Unblock a user |
| `POST` | `/social/follow/:userId` | Follow a user |
| `DELETE` | `/social/follow/:userId` | Unfollow a user |

### Social Discovery

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/social/suggestions` | Get suggested users to connect with |
| `GET` | `/social/search/suggestions` | Get username search suggestions |
| `GET` | `/social/users/search` | Search users by username |
| `GET` | `/social/users/trending` | Get trending users |

### Social Data

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/social/feed` | Get personalized social feed |
| `GET` | `/social/users/:id/followers` | Get user's followers |
| `GET` | `/social/users/:id/following` | Get user's following |
| `GET` | `/social/users/:id/friends` | Get user's friends |
| `GET` | `/social/users/:id/mutual-friends` | Get mutual friends with a user |
| `GET` | `/social/users/:id/mutual-followers` | Get mutual followers with a user |
| `GET` | `/social/users/:id/activity` | Get user's public activity |
| `GET` | `/social/blocked` | Get blocked users list |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/social/counts` | Get social counts for current user |
| `GET` | `/social/users/:id/stats` | Get public social stats for a user |
| `GET` | `/social/me/analytics` | Get detailed social analytics for current user |
| `GET` | `/social/friends/leaderboard` | Get leaderboard among friends |

## Future Extension Points

- **Hide activity**: Users can hide specific activities from their feed.
- **Mute users**: Allow muting without blocking (see content but not in feed).
- **Close friends**: A subset of friends with more private sharing.
- **Follower-only content**: User controls which activities appear in followers' feeds.
- **Social graph caching**: Redis cache for frequently accessed social graph data.
