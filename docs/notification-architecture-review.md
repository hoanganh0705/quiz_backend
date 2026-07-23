# Notification Module Architecture Review

**Module:** Notification
**Date:** Thursday Jul 23, 2026
**Reviewer:** Principal Software Architect
**Status:** Pre-Production Review

---

## Executive Summary

**Overall Score: 6.5 / 10**

| Dimension | Score | Assessment |
|-----------|-------|------------|
| Architecture | 7/10 | Solid layering with port/adapter patterns, but scheduler placement violations |
| Product Design | 7.5/10 | Comprehensive notification types, good channel support |
| Business Modeling | 7/10 | Good domain coverage, but missing transactional event integration |
| Domain Modeling | 6.5/10 | Correct separation, but domain event bus lacks transaction coupling |
| API Design | 8/10 | Clean REST endpoints, proper pagination, good error handling |
| Concurrency | 5.5/10 | Critical issues with stub implementations and non-transactional paths |
| Scalability | 7/10 | Good indexing, but WebSocket fan-out lacks Redis integration details |
| Maintainability | 6/10 | Thin test coverage, extensive documentation but incomplete |
| Extensibility | 7.5/10 | Well-structured port interfaces for cross-module integration |
| Business Alignment | 7.5/10 | Matches documented fan-out delivery model effectively |

---

## Major Strengths

1. **Excellent Port Interface Design** — `RankNotificationPort`, `TournamentNotificationPort`, `SOCIAL_NOTIFICATION_PORT`, `ACHIEVEMENT_NOTIFICATION_PORT`, `INSTANCE_NOTIFICATION_PORT` provide clean cross-module integration without circular dependencies.

2. **Comprehensive Notification Types** — 40+ notification types covering achievements, ranks, tournaments, social, discussions, and security events.

3. **Multi-Channel Delivery** — Support for `in_app`, `email`, and `push` channels with user preference filtering and quiet-hours suppression.

4. **Clean Domain Event Bus** — In-process `NotificationDomainEventBus` with typed event interfaces for `sent`, `read`, `unread`, `deleted` events.

5. **WebSocket Real-Time Delivery** — `NotificationGateway` with Socket.IO, JWT auth, user-scoped rooms, and Phase 3 cross-instance fan-out via `server.to(room).emit()`.

6. **User Preference Management** — Full CRUD with Redis caching (5-minute TTL), type-specific toggles, rank improvement thresholds, and quiet hours.

7. **Well-Documented Code** — Extensive inline documentation explaining Phase 5 RFC 7807 migration, Phase 3 WebSocket changes, and design rationale.

8. **Proper Soft Delete Pattern** — `deletedAt` column with partial indexes following ADR-0011.

---

## Major Weaknesses

1. **Stub Implementation in Instance Listener** — `getInstanceHostInfo()` and `getInstancePlayerIds()` always return `null`, making instance notifications non-functional.

2. **Scheduler Placement Violation** — `NotificationSchedulerService` uses `@Cron` in `application/` layer. Per project patterns (see ranking module), scheduling belongs in `infrastructure/scheduler/`.

3. **Hard Delete vs Soft Delete Inconsistency** — `delete()` method in `NotificationRepository` performs hard delete while `softDelete()` exists and `deleteReadNotifications()` uses soft delete.

4. **Missing Transactional Event Integration** — Domain events (`NotificationReadEvent`, `NotificationDeletedEvent`) are emitted after `await tx.commit()` but outside the transaction boundary. Per ADR-0014, events that must survive process restarts need outbox pattern.

5. **Thin Test Coverage** — Only 1 spec file (`notification.errors.spec.ts`) exists for the entire 50-file module. No repository specs, no service specs, no integration tests.

6. **Cache Invalidation Race Condition** — `updatePreferences()` invalidates cache after repository write, not atomically.

7. **No Webhook/Outbox for Reliable Delivery** — Email and push notifications are logged/queued but not persisted with outbox pattern per ADR-0014.

8. **Analytics Endpoint Missing Transactional Guard** — `getAnalytics()` in controller has no `@Transactional()` despite multiple DB queries.

---

## Consistency Analysis

### Project Rules → Documentation → Implementation → Tests

| Area | Status | Finding |
|------|--------|---------|
| Layer Responsibilities | ⚠️ Inconsistency | `NotificationSchedulerService` in `application/` with `@Cron` decorator. Project rules (ADR-0009) state scheduling belongs in `infrastructure/scheduler/`. |
| Soft Delete Pattern | ⚠️ Inconsistency | `delete()` performs hard delete while `softDelete()` exists. All other delete paths use soft delete. |
| Domain Event Architecture | ⚠️ Partial | `NotificationDomainEventBus` is in-process fire-and-forget. ADR-0014 requires outbox for events that must survive process restarts. |
| Transaction Management | ⚠️ Gap | `deleteExpired()` in repository doesn't use `getDb()` transaction context. |
| Error Hierarchy | ✅ Consistent | `BaseDomainException` + `NotificationError` + 2 concrete exceptions with `ProblemCodeMapping` entries. |
| Repository Pattern | ✅ Consistent | `NotificationRepositoryPort` interface with `NotificationRepository` implementation. |
| WebSocket Architecture | ✅ Consistent | `NotificationGateway` with Redis-backed Socket.IO adapter for cross-instance fan-out. |
| RFC 7807 Errors | ✅ Consistent | `NOTIFICATION_NOT_FOUND` (404) and `NOTIFICATION_FORBIDDEN` (403) properly mapped. |
| Pagination | ✅ Consistent | Cursor-based pagination with `createdAt, notificationId` tuple per ADR-0004. |
| Test Coverage | ❌ Missing | Only 1 spec file for 50-file module. |

---

## Product Review

### From a Real User's Perspective

#### What Works Well
- **Unified Inbox** — Users see all notifications in one place regardless of source (achievement, rank, tournament, social)
- **Read/Unread Management** — Full control over marking individual or all notifications as read
- **Preference Control** — Granular toggles for notification types plus channel-level controls
- **Real-Time WebSocket** — Immediate push without polling
- **Quiet Hours** — Respects user sleep/work schedules

#### User Experience Concerns

1. **Deleted Notification Reappears After Refresh** — `delete()` does hard delete while the UI may still show cached data. Race between WebSocket deletion event and UI state.

2. **Analytics Endpoint Accessible to Users** — `GET /notifications/analytics` requires `Permission.NOTIFICATION_ANALYTICS` but has no `@Transactional()`. Multiple DB queries could return inconsistent results.

3. **No Batch Notification Support** — When `InstanceNotificationService.notifyInstanceStarted()` sends to 100 players, each triggers a separate DB insert. No batching optimization.

4. **Stub Instance Notifications** — `notifyPlayerJoined()` calls `getInstanceHostInfo()` which always returns `null`. Host never receives "player joined" notifications.

5. **Missing Notification Count Badge** — No `unreadCount` in list response (documented but removed), requiring separate `/unread-count` call.

---

## Business Workflow Review

### State Machine: Notification Lifecycle

```
[Event Occurs in Another Module]
           ↓
[Notification Listener Adapter] → [NotificationService]
           ↓
[NotificationChannelService.send()] → [Preference Check + Quiet Hours]
           ↓
[NotificationRepository.create()] → [DB Insert + NotificationSentEvent]
           ↓
[NotificationWebSocketListener] → [Socket.IO push to user:{userId} room]
           ↓
[User Marks as Read]
           ↓
[NotificationApplicationService.markAsRead()] → [Repository + NotificationReadEvent]
           ↓
[Socket.IO push 'notification.read']
           ↓
[User Deletes]
           ↓
[Soft Delete (preferred) / Hard Delete (actual)]
```

### Issues Identified

1. **Hard Delete Violates Soft Delete Contract** — `delete()` method performs permanent removal while soft-delete infrastructure exists.

2. **Event Emission Outside Transaction** — `NotificationSentEvent` is emitted after repository insert, not as part of the creating transaction. If the process crashes before emit, notification exists but no WebSocket push occurs.

3. **Listener Failures Silent** — Discussion listener `handleEvent()` catches errors and logs, but doesn't retry. Failed notifications are lost.

4. **No Idempotency for Fan-Out** — When `notifyInstanceStarted()` sends to 100 players, each is a separate transaction. No batch optimization.

---

## Domain Review

### Entities & Value Objects

**Notification Entity**
- `notificationId` (UUIDv7) ✅
- `userId` (FK to users) ✅
- `type` (notificationType enum) ✅
- `title`, `message` (text) ✅
- `metadata` (JSONB) ✅
- `channel` (notificationChannel enum) ✅
- `isRead`, `readAt` ✅
- `expiresAt` (TTL for cleanup) ✅
- `createdAt`, `deletedAt` (temporal) ✅

**NotificationPreferences Entity**
- `preferencesId` (UUIDv7) ✅
- `userId` (unique FK) ✅
- 10 boolean toggles for type categories ✅
- `rankImprovementThreshold` (integer, 1-100) ✅
- `quietHoursStart`, `quietHoursEnd` (HH:MM) ✅
- Temporal fields ✅

### Ports

| Port | Purpose | Implementation |
|------|---------|----------------|
| `NOTIFICATION_REPOSITORY_PORT` | Notification CRUD | `NotificationRepository` |
| `NOTIFICATION_PREFERENCES_REPOSITORY_PORT` | Preferences CRUD | `NotificationPreferencesRepository` |
| `RANK_NOTIFICATION_PORT` | Rank → Notification | `RankNotificationService` |
| `TOURNAMENT_NOTIFICATION_PORT` | Tournament → Notification | `TournamentNotificationService` |
| `INSTANCE_NOTIFICATION_PORT` | Instance → Notification | `InstanceNotificationService` |
| `SOCIAL_NOTIFICATION_PORT` | Social → Notification | `SocialNotificationService` |
| `ACHIEVEMENT_NOTIFICATION_PORT` | Achievement → Notification | `AchievementNotificationService` |
| `NOTIFICATION_CHANNEL_SERVICE` | Channel routing | `NotificationChannelService` |
| `NOTIFICATION_DOMAIN_EVENT_BUS` | In-process events | `NotificationDomainEventBus` |

### Domain Services

- `NotificationService` — Minimal domain logic, delegates to repository
- `RankNotificationService` — Composes rank achievement notifications
- `TournamentNotificationService` — Composes 5 tournament event types
- `InstanceNotificationService` — Composes real-time session notifications
- `SocialNotificationService` — Composes 9 social event types
- `AchievementNotificationService` — Composes badge/streak notifications
- `ReviewNotificationService` — Composes quiz review notifications
- `UserNotificationService` — Composes profile/settings notifications
- `AuthSecurityNotificationService` — Composes 8 security event types

### Aggregates

**NotificationAggregate (implicit)**
- Notification entity + preferences entity
- Business invariants enforced in `NotificationChannelService.shouldSendNotification()`
- Preferences cached in Redis with 5-minute TTL

**Boundary Concerns:**
- Notification preferences belong to user, not notification
- Notifications should cascade on user deletion (enforced by FK `onDelete: 'cascade'`)

---

## API Review

### Endpoints

| Method | Path | Purpose | Issues |
|--------|------|---------|--------|
| GET | `/notifications` | List with cursor pagination | ✅ Correct |
| GET | `/notifications/unread-count` | Badge count | ✅ Correct |
| GET | `/notifications/analytics` | Admin dashboard | ⚠️ Missing `@Transactional()` |
| GET | `/notifications/preferences` | User preferences | ✅ Correct |
| PATCH | `/notifications/preferences` | Update preferences | ✅ Correct |
| GET | `/notifications/:id` | Single notification | ✅ Correct |
| POST | `/notifications/:id/read` | Mark as read | ✅ Correct |
| POST | `/notifications/:id/unread` | Mark as unread | ✅ Correct |
| POST | `/notifications/read-all` | Mark all as read | ⚠️ No idempotency |
| DELETE | `/notifications/read` | Delete read notifications | ⚠️ Soft vs hard delete |
| DELETE | `/notifications/:id` | Delete single | ❌ Hard delete |

### DTO Review

**NotificationResponseDto**
- All fields are product-aligned
- `metadata` as `Record<string, unknown>` is appropriate
- `readAt` and `expiresAt` properly nullable

**GetNotificationsQueryDto**
- `fromDate`, `toDate` query params defined but **never used** in repository
- Repository `findByUser()` ignores date range filters

**UpdatePreferencesDto**
- All 10 boolean toggles, threshold, and quiet hours
- Missing: validation that `quietHoursStart < quietHoursEnd` (timezone handling)

### Implementation Leaks

1. **`delete()` exposes hard delete** — Controller `deleteNotification()` calls repository's hard delete, not soft delete. Should call `softDelete()`.

2. **`fromDate`/`toDate` unused** — Query DTO declares date filters but `NotificationRepository.findByUser()` never applies them.

3. **`deletedCount` response for delete** — `DELETE /notifications/read` returns `{ deletedCount }` but uses soft delete, so "deleted" is misleading.

---

## Concurrency Review

### Race Conditions Identified

1. **`markAllAsRead()` Race Condition**
   ```typescript
   // notification-application.service.ts:191-198
   async markAllAsRead(user: JwtPayload): Promise<void> {
     await this.notificationRepository.markAllAsRead(user.sub);
   ```
   - `@Transactional()` present but doesn't prevent concurrent `markAsRead()` calls
   - Two concurrent requests could double-mark or miss notifications
   - **Fix**: Use optimistic locking with `readAt` or acquire row lock

2. **Cache Invalidation Race**
   ```typescript
   // notification-application.service.ts:259-261
   const result = await this.preferencesRepository.upsertPreferences(user.sub, params);
   await this.channelServiceInstance?.invalidatePreferencesCache(user.sub);
   ```
   - Cache invalidated AFTER write commits
   - If another request reads between commit and invalidation, stale cache persists
   - **Fix**: Invalidate within same transaction using advisory lock or transaction-aware cache

3. **Stub Instance Listener**
   ```typescript
   // instance-notification-listener.adapter.ts:189-206
   private getInstanceHostInfo(instanceId: string): Promise<...> {
     return Promise.resolve(null);  // Always null!
   }
   ```
   - `notifyPlayerJoined()` retrieves host info but always gets null
   - Host never receives player-joined notifications
   - **Required Fix**: Implement actual repository call

4. **WebSocket Event Without Transaction**
   ```typescript
   // notification-channel.service.ts:136-144
   const notification = await this.notificationRepository.create({...});
   const sentEvent: NotificationSentEvent = {...};
   this.eventBus?.emit(sentEvent);  // After insert, outside transaction
   ```
   - If process crashes between insert and emit, notification exists but no WebSocket push
   - Per ADR-0014, events requiring reliability need outbox pattern

5. **Instance Fan-Out Without Transaction**
   ```typescript
   // instance-notification.service.ts:108-121
   await Promise.all(
     params.playerIds.map((userId) =>
       this.channelService.send({...})
     )
   );
   ```
   - 100 players = 100 separate DB inserts
   - No batch optimization
   - Partial failure leaves inconsistent state

---

## Scalability Review

### Strengths

1. **Proper Database Indexing**
   ```
   idx_notifications_user_created (userId, createdAt DESC) WHERE deleted_at IS NULL
   idx_notifications_user_unread (userId, isRead) WHERE deleted_at IS NULL
   idx_notifications_user_type (userId, type) WHERE deleted_at IS NULL
   idx_notifications_expires_at (expiresAt) WHERE expires_at IS NOT NULL
   ```

2. **Redis Cache for Preferences** — 5-minute TTL reduces DB queries

3. **Cursor Pagination** — O(1) offset for large datasets

4. **Soft Delete with Partial Indexes** — Only active records in queries

5. **NotificationGateway Cross-Instance Fan-Out** — Socket.IO adapter handles multi-pod deployment

### Concerns

1. **`getAnalytics()` Full Table Scans** — 6 separate COUNT queries without pagination. At 1M+ notifications, this will degrade.

2. **No Query Result Caching** — Analytics computed fresh every request

3. **Discussion Listener `listThreadSubscribers()` N+1** — `notifyThreadSubscribers()` fetches all subscribers then sends individually

4. **Metadata JSONB Index Missing** — No GIN index on `metadata` for future queries

5. **Unbounded Notification Growth** — `deleteExpired()` runs hourly but no retention policy for non-expiring notifications

---

## Maintainability Review

### Strengths

1. **Consistent File Layout** — Matches project structure (`domain/`, `application/`, `infrastructure/`, `transport/`)

2. **Clear Port Interfaces** — Cross-module integration via Symbol-typed ports

3. **Extensive Inline Documentation** — Phase migration notes, design rationale

4. **Structured Logging** — Event-based logging with correlation IDs

### Concerns

1. **Single Spec File** — Only `notification.errors.spec.ts` exists
   - Missing: repository specs, service specs, controller specs, integration tests
   - Critical paths untested: cursor pagination, soft delete, preference caching

2. **Duplicate Logic in Listeners** — Each listener has identical `onModuleInit/onModuleDestroy` + `subscribe/unsubscribe` pattern
   - Should be extracted to base class or shared utility

3. **`@Cron('0 * * * *')` Implicit Scheduler** — No configuration for cleanup interval, no graceful shutdown handling

4. **NotificationType Enum Drift** — 40+ types, no enforcement that all types map to preferences
   - `social_mention` notification type exists but no `socialMentionEnabled` preference

5. **NotificationChannelService God Class** — Handles caching, preference lookup, type routing, quiet hours, and channel dispatch
   - Should be split into `PreferenceService`, `QuietHoursService`, `ChannelRouter`

---

## Architecture Consistency Review

### vs. Project Architecture

| Aspect | Project Rule | Notification Module | Status |
|--------|--------------|---------------------|--------|
| Layer Order | transport → application → domain → infrastructure | ✅ Follows | ✅ |
| Scheduler Location | `infrastructure/scheduler/` | `application/` | ❌ |
| Repository Port | `domain/ports/<x>-repository.port.ts` | ✅ Correct | ✅ |
| Domain Events | `domain/events/<name>.events.ts` | ✅ Correct | ✅ |
| Soft Delete | `deletedAt` column | ⚠️ `delete()` hard deletes | ⚠️ |
| Transaction Boundary | `@Transactional()` on handlers | ⚠️ Gap in `deleteExpired()` | ⚠️ |
| Event Bus | In-process + outbox for reliability | ⚠️ In-process only | ⚠️ |

### Cross-Module Dependencies

```
Notification Module (fan-out hub)
├── Listens to: DISCUSSION_DOMAIN_EVENT_BUS
├── Listens to: INSTANCE_DOMAIN_EVENT_BUS
├── Listens to: REVIEW_DOMAIN_EVENT_BUS
├── Listens to: USER_DOMAIN_EVENT_BUS
├── Consumed by: Tournament, Ranking, Achievement (via ports)
└── Exports: 9 notification services via ports
```

**Dependency Direction Correct** — Notification module is a leaf node that imports other modules' event buses. No other module imports notification internals.

---

## Missing Product Capabilities

### Required Fix

1. **Stub Instance Notifications** — `getInstanceHostInfo()` and `getInstancePlayerIds()` return null. Host notifications never fire.

2. **Hard Delete → Soft Delete** — `delete()` method should call `softDelete()` for consistency.

3. **Unused Date Filters** — `fromDate`/`toDate` in query DTO never applied to repository query.

4. **Missing `@Transactional()` on Analytics** — 6 COUNT queries need transaction for consistency.

5. **NotificationType-Preference Gap** — `social_mention`, `badge_earned`, `tournament_reminder` types exist but no matching preference flags.

### Product Discussion

1. **Batch Notification API** — Should `notifyInstanceStarted()` accept a batch of player IDs or support bulk insert?

2. **Notification Retention Policy** — Non-expiring notifications accumulate forever. Should there be auto-cleanup after X days?

3. **WebSocket vs. Polling Fallback** — What happens if WebSocket disconnects? Should clients poll `/unread-count`?

4. **Analytics Aggregation Frequency** — `getAnalytics()` computes fresh every request. Should it be cached/materialized hourly?

### Future Product

1. **Notification Templates** — Store templates in DB, parameterize at send time (i18n support)

2. **Delivery Receipt Tracking** — Track when email/push delivered vs. failed

3. **Click-Through Analytics** — Track which notifications led to actions

### YAGNI

1. **`instance_player_disconnected` Notification** — Is this useful? Player already knows they're disconnected.

2. **`all_other_sessions_revoked` Notification** — User initiating revocation likely sees confirmation UI already.

---

## Implementation Plan

### Phase 1: Critical Bug Fixes (Required Before Production)

**Goal:** Fix blocking bugs that prevent correct notification delivery

**Items:**

1. **Fix stub implementations in Instance listener**
   - File: `src/modules/notification/infrastructure/adapters/instance-notification-listener.adapter.ts`
   - Implement `getInstanceHostInfo()` to query actual instance data
   - Implement `getInstancePlayerIds()` to query actual player IDs

2. **Change hard delete to soft delete**
   - File: `src/modules/notification/infrastructure/repositories/notification.repository.ts`
   - Method: `delete()` → call `softDelete()` instead
   - Alternatively: remove `delete()` method entirely if not needed

3. **Add `@Transactional()` to analytics**
   - File: `src/modules/notification/transport/controller/notification.controller.ts`
   - Method: `getAnalytics()`
   - Add `@Transactional()` decorator

4. **Apply date filters in repository**
   - File: `src/modules/notification/infrastructure/repositories/notification.repository.ts`
   - Method: `findByUser()`
   - Apply `fromDate`/`toDate` conditions when provided

**Dependencies:** None (isolated fixes)

**Risks:** Low — targeted changes

**Exit Criteria:** Instance notifications fire, soft delete consistent, analytics consistent

---

### Phase 2: Test Coverage (Required Before Production)

**Goal:** Achieve minimum viable test coverage

**Items:**

1. **Add `NotificationRepository` spec**
   - File: `src/modules/notification/infrastructure/repositories/notification.repository.spec.ts`
   - Test: CRUD operations, soft delete, pagination, cursor decoding

2. **Add `NotificationPreferencesRepository` spec**
   - File: `src/modules/notification/infrastructure/repositories/notification-preferences.repository.spec.ts`
   - Test: Get preferences, upsert with defaults

3. **Add `NotificationService` spec**
   - File: `src/modules/notification/domain/notification.service.spec.ts`
   - Test: Domain logic, null handling

4. **Add `NotificationChannelService` spec**
   - File: `src/modules/notification/infrastructure/adapters/notification-channel.service.spec.ts`
   - Test: Preference filtering, quiet hours logic, type routing

5. **Add `NotificationApplicationService` spec**
   - File: `src/modules/notification/application/notification-application.service.spec.ts`
   - Test: Use case orchestration, error cases

6. **Add listener adapter specs**
   - File: `src/modules/notification/infrastructure/adapters/*.spec.ts`
   - Test: Event handling, error propagation

**Dependencies:** Phase 1 (stub implementations fixed)

**Risks:** Medium — tests may reveal additional bugs

**Exit Criteria:** Core paths covered by unit tests (>80% coverage target)

---

### Phase 3: Architecture Alignment

**Goal:** Align with project architecture conventions

**Items:**

1. **Move scheduler to infrastructure layer**
   - From: `src/modules/notification/application/notification-scheduler.service.ts`
   - To: `src/modules/notification/infrastructure/scheduler/notification-cleanup.scheduler.ts`

2. **Add configuration for cleanup interval**
   - Add to: `src/core/config/` or module config
   - Expose: `NOTIFICATION_CLEANUP_INTERVAL` env var

3. **Update module imports**
   - File: `src/modules/notification/notification.module.ts`
   - Update provider import path

4. **Add graceful shutdown handling**
   - Implement `OnModuleDestroy` if not already present
   - Log cleanup completion

**Dependencies:** Phase 2 (tests pass)

**Risks:** Low — refactoring within module

**Exit Criteria:** Scheduler in correct layer per project patterns

---

### Phase 4: Reliability Enhancement

**Goal:** Improve notification delivery reliability

**Items:**

1. **Implement outbox pattern for critical events**
   - Create: `src/modules/notification/infrastructure/outbox/notification-outbox.adapter.ts`
   - Write: Notification events to `outbox_events` table atomically with notification insert
   - Process: Add cron job to process outbox with retries

2. **Add idempotency keys to fan-out scenarios**
   - Generate: `idempotency_key = hash(notification_type + user_id + event_id)`
   - Store: In notifications table to prevent duplicates

3. **Make cache invalidation transaction-aware**
   - File: `src/modules/notification/application/notification-application.service.ts`
   - Use: Advisory lock or transaction-aware cache invalidation

4. **Add optimistic locking to `markAllAsRead()`**
   - Add: `version` column or use `readAt` for optimistic locking
   - Handle: Concurrent modification errors gracefully

**Dependencies:** Phase 3

**Risks:** Medium — outbox introduces additional infrastructure

**Exit Criteria:** Events survive process restart, no duplicate notifications

---

### Phase 5: Performance Optimization

**Goal:** Optimize for scale

**Items:**

1. **Add GIN index on metadata**
   - File: `src/core/database/schema/notification/schema.ts`
   - Add: `index('idx_notifications_metadata').using('gin', sql`metadata`)`

2. **Add batch optimization for fan-out**
   - File: `src/modules/notification/infrastructure/adapters/notification-channel.service.ts`
   - Implement: Batch insert for multi-user notifications

3. **Cache analytics results**
   - Add: Redis cache with 1-hour TTL for analytics
   - Invalidate: When significant notification activity occurs

4. **Optimize `listThreadSubscribers()` batch query**
   - File: `src/modules/discussion/infrastructure/repositories/discussion.repository.ts`
   - Return: Full subscriber objects in single query

**Dependencies:** Phase 4

**Risks:** Low — query optimization

**Exit Criteria:** Analytics < 500ms at 1M notifications

---

## Dependency Analysis

### Phase Dependencies

```
Phase 1 (Critical Fixes)
    │
    ├── Fix stub implementations
    ├── Fix soft delete
    ├── Add @Transactional()
    └── Apply date filters
            │
            ▼
Phase 2 (Test Coverage)
    │
    ├── Repository specs
    ├── Service specs
    └── Listener specs
            │
            ▼
Phase 3 (Architecture)
    │
    └── Move scheduler to infrastructure/
            │
            ▼
Phase 4 (Reliability)
    │
    ├── Outbox pattern
    ├── Idempotency
    └── Cache transaction-awareness
            │
            ▼
Phase 5 (Performance)
    │
    ├── GIN index
    ├── Batch optimization
    └── Analytics caching
```

### Dependency Graph

```
NOTIFICATION MODULE ARCHITECTURE
================================

┌─────────────────────────────────────────────────────────────────────────┐
│                           TRANSPORT LAYER                               │
├─────────────────────────────────────────────────────────────────────────┤
│  NotificationController    │  NotificationGateway (WebSocket)           │
│  - GET /notifications      │  - Socket.IO + Redis Adapter               │
│  - PATCH /preferences     │  - JWT auth, user-scoped rooms             │
│  - POST /:id/read         │  - Cross-instance fan-out                  │
│  - DELETE /:id            │                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                               │
├─────────────────────────────────────────────────────────────────────────┤
│  NotificationApplicationService          │  (Scheduler → Phase 3)       │
│  - getNotifications()                    │                             │
│  - markAsRead()                          │                             │
│  - updatePreferences()                    │                             │
│  - getAnalytics() ⚠️ missing @Transactional │                           │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DOMAIN LAYER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  NotificationService                  │  Domain Event Bus                 │
│  - Minimal delegation                 │  - In-process fire-and-forget   │
│                                     │  - ⚠️ needs outbox (Phase 4)    │
│                                                                        
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    NOTIFICATION SERVICES                         │   │
│  ├─────────────────┬─────────────────┬─────────────────────────────┤   │
│  │ Rank            │ Tournament       │ Social                       │   │
│  │ - notifyRank... │ - notifyTournament... │ - notifyFriend...      │   │
│  ├─────────────────┼─────────────────┼─────────────────────────────┤   │
│  │ Achievement     │ Instance ⚠️     │ User                         │   │
│  │ - notifyBadge.. │ - stub impl     │ - notifyProfile...           │   │
│  ├─────────────────┼─────────────────┼─────────────────────────────┤   │
│  │ Review         │ Auth/Security    │                              │   │
│  │ - notifyReview. │ - notifyPassword...                            │   │
│  └─────────────────┴─────────────────┴─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       INFRASTRUCTURE LAYER                             │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐    ┌─────────────────────────────────────┐   │
│  │  NotificationRepo    │    │  NotificationPreferencesRepo          │   │
│  │  ⚠️ delete() hard   │    │  ✅ Correct                           │   │
│  │  ⚠️ date filters    │    │                                      │   │
│  │     not applied      │    │                                      │   │
│  └──────────────────────┘    └─────────────────────────────────────┘   │
│                                                                        
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              NotificationChannelService                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │   │
│  │  │ Preference  │  │  Quiet      │  │    Channel             │ │   │
│  │  │  Service    │  │  Hours      │  │    Dispatcher          │ │   │
│  │  │  (caching)  │  │  (HH:MM)    │  │    (in_app/email/push) │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              LISTENER ADAPTERS (Event Subscribers)                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐ │   │
│  │  │ Discussion  │  │  Instance   │  │   Review    │  │  User  │ │   │
│  │  │  Listener  │  │  Listener ⚠️│  │  Listener  │  │ Listener│ │   │
│  │  │             │  │  (stubs)   │  │            │  │         │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              OUTBOX ADAPTER (Phase 4)                            │   │
│  │  - Transactional event persistence                                │   │
│  │  - Background processor with retries                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

EXTERNAL MODULE DEPENDENCIES
============================

    ┌─────────┐        ┌─────────┐        ┌─────────┐        ┌─────────┐
    │Discuss- │        │Instance │        │  User   │        │  Quiz   │
    │  ion   │        │ Module  │        │ Module  │        │ Module  │
    └────┬────┘        └────┬────┘        └────┬────┘        └────┬────┘
         │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                    DOMAIN EVENT BUSES (Subscribers)               │
    │  DISCUSSION_DOMAIN_EVENT_BUS  │  INSTANCE_DOMAIN_EVENT_BUS          │
    │  USER_DOMAIN_EVENT_BUS       │  REVIEW_DOMAIN_EVENT_BUS            │
    └─────────────────────────────────────────────────────────────────┘
```

## Critical Path

1. **Stub Fixes → Phase 1** — Instance notifications are dead code until `getInstanceHostInfo()`/`getInstancePlayerIds()` are implemented
2. **Soft Delete → Phase 1** — Violates ADR-0011, potential audit trail corruption
3. **Test Coverage → Phase 2** — Cannot ship without minimum test coverage

## Parallel Work

- Phase 1 items 1-4 can be executed in parallel (independent fixes)
- Phase 2 specs can be written in parallel across team members
- Phase 3 (scheduler move) independent after Phase 2

## Deferred Work

1. **Outbox Pattern** — Can defer if in-process events acceptable for non-critical notifications
2. **Batch Optimization** — Only needed at scale (>1000 concurrent users)
3. **Analytics Caching** — Only needed if analytics endpoint shows performance issues
4. **Notification Templates** — YAGNI until i18n required

---

## Final Verdict

| Recommendation | Decision | Rationale |
|----------------|----------|------------|
| Stub implementations in Instance listener | **Reject** | Blocks real-time session notifications |
| Hard delete vs soft delete inconsistency | **Reject** | Violates ADR-0011, corrupts audit trail |
| `@Transactional()` gap on analytics | **Reject** | Data consistency issue |
| Scheduler placement in application/ | **Product Discussion** | Architectural violation but functionally correct |
| Thin test coverage | **Reject** | Cannot ship to production without tests |
| In-process events without outbox | **Product Discussion** | May be acceptable for non-critical notifications |
| Instance fan-out N+1 pattern | **Future Roadmap** | Optimize after profiling |

---

## Immediate Action Items

### Must Fix Before Production

- [ ] Implement `getInstanceHostInfo()` in `InstanceNotificationListener`
- [ ] Implement `getInstancePlayerIds()` in `InstanceNotificationListener`
- [ ] Change `delete()` to `softDelete()` in `NotificationRepository`
- [ ] Add `@Transactional()` to `getAnalytics()` method
- [ ] Apply `fromDate`/`toDate` filters in `findByUser()`
- [ ] Add test coverage for repository, service, and controller layers

### Should Discuss

- [ ] Outbox pattern for `NotificationSentEvent` (reliability vs complexity)
- [ ] Notification retention policy for non-expiring notifications
- [ ] WebSocket fallback strategy when connection drops

### Should Improve (Post-Production)

- [ ] Move scheduler to `infrastructure/scheduler/`
- [ ] Split `NotificationChannelService` into smaller services
- [ ] Add GIN index on `metadata` column
- [ ] Cache analytics results
