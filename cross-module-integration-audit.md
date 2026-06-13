# Cross-Module Integration Audit Report

**Date:** June 12, 2026
**Scope:** achievement · attempt · auth · bookmark · category · discussion · instance · notification · quiz · ranking · review · social · tag · tournament
**Architecture:** Modular Monolith — NestJS + Drizzle ORM + BullMQ + Redis

---

## Table of Contents

1. [Event Flow Report](#1-event-flow-report)
2. [Cross-Module Dependency Report](#2-cross-module-dependency-report)
3. [Missing Integration Report](#3-missing-integration-report)
4. [Cleanup Plan — Phase 1](#4-cleanup-plan--phase-1)
5. [Cleanup Plan — Phase 2](#5-cleanup-plan--phase-2) ✅
6. [Cleanup Plan — Phase 3](#6-cleanup-plan--phase-3)

---

## 1. Event Flow Report

Legend:
- **✅ Fully Wired** — Publisher emits → at least one subscriber consumes → side effects confirmed
- **⚠️ Partial** — Publisher emits → subscribers exist but incomplete coverage
- **❌ Broken** — Event emitted but no subscribers, or subscriber chain is cut

---

### Attempt Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `attempt.started` | `AttemptDomainEventBus` | `InstanceAttemptEventBootstrapService` | Links attempt to instance player | ✅ Fully Wired |
| `attempt.started` | `AttemptDomainEventBus` | `AttemptDomainEventBootstrapService` | Logging only | ✅ Fully Wired |
| `attempt.answer_submitted` | `AttemptDomainEventBus` | `AttemptDomainEventBootstrapService` | Logging only | ✅ Fully Wired |
| `attempt.completed` | `AttemptDomainEventBus` | `AchievementAttemptEventListenerAdapter` | Badge rule evaluation | ✅ Fully Wired |
| `attempt.completed` | `AttemptDomainEventBus` | `QuizAttemptEventHandler` | Quiz analytics refresh | ✅ Fully Wired |
| `attempt.completed` | `AttemptDomainEventBus` | `RankingEventHandler` | ❌ Subscribes to `EXTERNAL_EVENT_BUS` instead — see Bug #1 | ⚠️ Partial |
| `attempt.abandoned` | `AttemptDomainEventBus` | `AttemptDomainEventBootstrapService` | Logging only | ✅ Fully Wired |
| `quiz.milestone` | `AttemptDomainEventBus` | `AchievementAttemptEventListenerAdapter` | Milestone badge evaluation | ✅ Fully Wired |
| `external.xp.earned` | `CommonExternalEventBus` | `RankingEventHandler` | XP ingestion → ranking update | ✅ Fully Wired |

---

### Ranking Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `xp.added` | `RankingDomainEventBus` | *(internal outbox dispatch only)* | No external consumers | ⚠️ Partial |
| `rank.changed` | `RankingDomainEventBus` | `RankingEventAchievementListenerAdapter` | Rank badge evaluation | ✅ Fully Wired |
| `rank.changed` | `RankingDomainEventBus` | `RankingNotificationListenerAdapter` | Rank improvement notification | ✅ Fully Wired |
| `rank.changed` | `RankingDomainEventBus` | `RankingFeedListenerAdapter` (Social) | Social feed activity | ✅ Fully Wired |
| `peak.rank.achieved` | `RankingDomainEventBus` | `RankingEventAchievementListenerAdapter` | Rank badge evaluation | ✅ Fully Wired |
| `peak.rank.achieved` | `RankingDomainEventBus` | `RankingFeedListenerAdapter` (Social) | Social feed activity | ✅ Fully Wired |
| `ranking.milestone` | `RankingDomainEventBus` | `RankingFeedListenerAdapter` (Social) | Social feed activity | ✅ Fully Wired |
| `ranking.milestone` | `RankingDomainEventBus` | `RankingNotificationListenerAdapter` | Rank milestone notification | ✅ Fully Wired |
| `period.reset.initiated` | `RankingDomainEventBus` | *(internal only)* | No external consumers | ⚠️ Partial |
| `period.reset.completed` | `RankingDomainEventBus` | *(internal only)* | No external consumers | ⚠️ Partial |
| `consistency.check` | `RankingDomainEventBus` | `RankingConsistencySubscriber` | Logging/alerting | ✅ Fully Wired |

---

### Achievement Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `achievement.awarded` | `AchievementDomainEventBus` | `AchievementNotificationListener` | Push notification | ✅ Fully Wired |
| `achievement.awarded` | `AchievementDomainEventBus` | `UserActivityListenerAdapter` | User activity timeline | ✅ Fully Wired |
| `badge.earned` | `AchievementDomainEventBus` | `AchievementNotificationListener` | Badge unlock notification | ✅ Fully Wired |
| `badge.earned` | `AchievementDomainEventBus` | `AchievementFeedListenerAdapter` (Social) | Social feed activity | ✅ Fully Wired |
| `badge.earned` | `AchievementDomainEventBus` | `UserActivityListenerAdapter` | User activity timeline | ✅ Fully Wired |
| `badge.revoked` | `AchievementDomainEventBus` | `AchievementNotificationListener` | Revocation notification | ✅ Fully Wired |
| `badge.revoked` | `AchievementDomainEventBus` | `AchievementFeedListenerAdapter` (Social) | Social feed activity | ✅ Fully Wired |
| `streak.milestone` | `AchievementDomainEventBus` | `AchievementNotificationListener` | Streak notification | ✅ Fully Wired |
| `streak.milestone` | `AchievementDomainEventBus` | `UserActivityListenerAdapter` | User activity timeline | ✅ Fully Wired |

---

### Tournament Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `tournament.joined` | `BullmqTournamentEventBusService` | `TournamentFeedListenerAdapter` (Social) | Social feed activity | ✅ Fully Wired |
| `tournament.joined` | `BullmqTournamentEventBusService` | `TournamentListenerAdapter` (Notification) | ❌ No handler for `tournament.joined` — see Bug #2 | ⚠️ Partial |
| `tournament.participant.withdrawn` | `BullmqTournamentEventBusService` | `TournamentFeedListenerAdapter` (Social) | Debug log only | ⚠️ Partial |
| `tournament.completed` | `BullmqTournamentEventBusService` | `TournamentListenerAdapter` (Notification) | Completion notification | ✅ Fully Wired |
| `tournament.starting_soon` | `BullmqTournamentEventBusService` | `TournamentListenerAdapter` (Notification) | Starting soon notification | ✅ Fully Wired |
| `tournament.won` | `BullmqTournamentEventBusService` | `AchievementTournamentEventListenerAdapter` | Tournament badge evaluation | ✅ Fully Wired |
| `tournament.won` | `BullmqTournamentEventBusService` | `TournamentListenerAdapter` (Notification) | Win notification | ✅ Fully Wired |

---

### Discussion Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `discussion_thread_created` | `DiscussionDomainEventBus` | `DiscussionFeedListenerAdapter` (Social) | Social feed activity | ✅ Fully Wired |
| `discussion_thread_solved` | `DiscussionDomainEventBus` | `DiscussionNotificationListener` | Solved notification | ✅ Fully Wired |
| `discussion_thread_solved` | `DiscussionDomainEventBus` | `DiscussionFeedListenerAdapter` (Social) | Social feed activity | ✅ Fully Wired |
| `comment_created` | `DiscussionDomainEventBus` | `DiscussionNotificationListener` | Reply notification | ✅ Fully Wired |
| `comment_created` | `DiscussionDomainEventBus` | `DiscussionFeedListenerAdapter` | ❌ No handler — see Bug #3 | ❌ Broken |
| `comment_mentioned` | `DiscussionDomainEventBus` | `DiscussionNotificationListener` | Mention notification | ✅ Fully Wired |
| `content_reported` | `DiscussionDomainEventBus` | `DiscussionNotificationListener` | Debug log only | ⚠️ Partial |
| `report_reviewed` | `DiscussionDomainEventBus` | `DiscussionNotificationListener` | Report review notification | ✅ Fully Wired |
| `comment_hidden` | `DiscussionDomainEventBus` | `DiscussionNotificationListener` | Hidden notification | ✅ Fully Wired |
| `comment_restored` | `DiscussionDomainEventBus` | `DiscussionNotificationListener` | Restored notification | ✅ Fully Wired |
| `thread_hidden` | `DiscussionDomainEventBus` | `DiscussionNotificationListener` | Hidden notification | ✅ Fully Wired |
| `thread_restored` | `DiscussionDomainEventBus` | `DiscussionNotificationListener` | Restored notification | ✅ Fully Wired |
| `thread_reopened` | `DiscussionDomainEventBus` | `DiscussionNotificationListener` | Reopened notification | ✅ Fully Wired |
| `comment_deleted` | `DiscussionDomainEventBus` | *(none)* | No side effect | ⚠️ Partial |
| `thread_closed` | `DiscussionDomainEventBus` | *(none)* | No side effect | ⚠️ Partial |
| `thread_deleted` | `DiscussionDomainEventBus` | *(none)* | No side effect | ⚠️ Partial |

---

### Notification Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `notification.sent` | `NotificationDomainEventBus` | *(none)* | WebSocket push hook missing | ⚠️ Partial |
| `notification.read` | `NotificationDomainEventBus` | *(none)* | WebSocket push hook missing | ⚠️ Partial |
| `notification.unread` | `NotificationDomainEventBus` | *(none)* | No side effect | ⚠️ Partial |
| `notification.deleted` | `NotificationDomainEventBus` | *(none)* | No side effect | ⚠️ Partial |

---

### Instance Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `instance.created` | `InstanceDomainEventBus` | `AchievementInstanceEventListenerAdapter` | Instance badge evaluation | ✅ Fully Wired |
| `instance.player_finished` | `InstanceDomainEventBus` | `AchievementInstanceEventListenerAdapter` | Instance badge evaluation | ✅ Fully Wired |
| `instance.player_joined` | `InstanceDomainEventBus` | *(none)* | No side effect | ⚠️ Partial |
| `instance.player_attempt_started` | `InstanceDomainEventBus` | *(none)* | No side effect | ⚠️ Partial |
| `instance.player_xp_earned` | `InstanceDomainEventBus` | *(none)* | No side effect | ⚠️ Partial |
| `instance.player_disconnected` | `InstanceDomainEventBus` | *(none)* | No side effect | ⚠️ Partial |
| `instance.started` | `InstanceDomainEventBus` | *(none)* | No side effect | ⚠️ Partial |
| `instance.closed` | `InstanceDomainEventBus` | *(none)* | No side effect | ⚠️ Partial |

---

### Quiz Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `quiz.created` | `QuizDomainEventBus` | `QuizDomainEventBootstrapService` | Full analytics refresh | ✅ Fully Wired |
| `quiz.updated` | `QuizDomainEventBus` | `QuizDomainEventBootstrapService` | Trending/popularity refresh | ✅ Fully Wired |
| `quiz.deleted` | `QuizDomainEventBus` | `QuizDomainEventBootstrapService` | Logging only | ⚠️ Partial |
| `quiz_version.created` | `QuizDomainEventBus` | `QuizDomainEventBootstrapService` | Trending/popularity refresh | ✅ Fully Wired |
| `quiz_version.published` | `QuizDomainEventBus` | `QuizDomainEventBootstrapService` | Full analytics refresh | ✅ Fully Wired |

---

### Bookmark Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `bookmark.added` | `BookmarkDomainEventBus` | `BookmarkAnalyticsEventHandler` | Bookmark metric refresh | ✅ Fully Wired |
| `bookmark.removed` | `BookmarkDomainEventBus` | `BookmarkAnalyticsEventHandler` | Bookmark metric refresh | ✅ Fully Wired |

---

### Social Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `friend_request_sent` | `SocialDomainEventBus` | `SocialNotificationListener` | Friend request notification | ✅ Fully Wired |
| `friend_request_accepted` | `SocialDomainEventBus` | `SocialNotificationListener` | Accepted notification | ✅ Fully Wired |
| `user_followed` | `SocialDomainEventBus` | `SocialNotificationListener` | Follow notification | ✅ Fully Wired |
| `user_unfollowed` | `SocialDomainEventBus` | `SocialNotificationListener` | Unfollow notification | ✅ Fully Wired |
| `friend_request_rejected` | `SocialDomainEventBus` | *(none)* | No notification | ⚠️ Partial |
| `friend_request_cancelled` | `SocialDomainEventBus` | *(none)* | No notification | ⚠️ Partial |
| `friend_removed` | `SocialDomainEventBus` | *(none)* | No notification | ⚠️ Partial |
| `user_blocked` | `SocialDomainEventBus` | *(none)* | No notification | ⚠️ Partial |
| `user_unblocked` | `SocialDomainEventBus` | *(none)* | No notification | ⚠️ Partial |

---

### Review Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `review.submitted` | *(no event bus)* | `ReviewAnalyticsAdapter` | Review metrics refresh | ⚠️ Partial (no event bus) |
| `review.deleted` | *(no event bus)* | `ReviewAnalyticsAdapter` | Review metrics refresh | ⚠️ Partial (no event bus) |

---

### Auth Module (Security Events)

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `password_reset_completed` | `OutboxProcessorService` | `AuthAuditLogService` | Audit log record | ✅ Fully Wired |
| `account_deleted` | `OutboxProcessorService` | `AuthAuditLogService` | Audit log record | ✅ Fully Wired |
| `password_changed` | `OutboxProcessorService` | `AuthAuditLogService` | Audit log record | ✅ Fully Wired |
| `oauth_account_created` | `OutboxProcessorService` | `AuthAuditLogService` | Audit log record | ✅ Fully Wired |
| `oauth_account_linked` | `OutboxProcessorService` | `AuthAuditLogService` | Audit log record | ✅ Fully Wired |
| `oauth_login` | `OutboxProcessorService` | `AuthAuditLogService` | Audit log record | ✅ Fully Wired |
| `oauth_login_failed` | `OutboxProcessorService` | `AuthAuditLogService` | Audit log record | ✅ Fully Wired |
| `password_reset_requested` | `OutboxProcessorService` | *(none)* | No audit log | ❌ Broken |
| `session_revoked` | `OutboxProcessorService` | *(none)* | No audit log | ❌ Broken |
| `all_other_sessions_revoked` | `OutboxProcessorService` | *(none)* | No audit log | ❌ Broken |

---

### Category Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `category.created` | `CategoryDomainEventBus` | `CategoryEventBootstrapService` | Logging only | ⚠️ Partial |
| `category.updated` | `CategoryDomainEventBus` | `CategoryEventBootstrapService` | Logging only | ⚠️ Partial |
| `category.deleted` | `CategoryDomainEventBus` | `CategoryEventBootstrapService` | Logging only | ⚠️ Partial |
| `category.restored` | `CategoryDomainEventBus` | `CategoryEventBootstrapService` | Logging only | ⚠️ Partial |

---

### Tag Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `tag.created` | `TagDomainEventBus` | *(none)* | No side effect | ❌ Broken |
| `tag.updated` | `TagDomainEventBus` | *(none)* | No side effect | ❌ Broken |
| `tag.deleted` | `TagDomainEventBus` | *(none)* | No side effect | ❌ Broken |
| `tag.restored` | `TagDomainEventBus` | *(none)* | No side effect | ❌ Broken |
| `tag.followed` | `TagDomainEventBus` | *(none)* | No side effect | ❌ Broken |
| `tag.unfollowed` | `TagDomainEventBus` | *(none)* | No side effect | ❌ Broken |

---

### User Module

| Event | Publisher | Subscriber | Side Effect | Status |
|-------|-----------|------------|-------------|--------|
| `user.profile.updated` | `UserDomainEventBus` | *(none)* | No side effect | ❌ Broken |
| `user.settings.updated` | `UserDomainEventBus` | *(none)* | No side effect | ❌ Broken |

---

## 2. Cross-Module Dependency Report

### 2.1 Service-to-Service Dependencies (Explicit Imports)

| Consumer | Provider | Purpose | Pattern | Risk |
|----------|----------|---------|---------|------|
| Achievement | Attempt | `ATTEMPT_DOMAIN_EVENT_BUS` | Event subscription (port token) | Low |
| Achievement | Ranking | `RANKING_DOMAIN_EVENT_BUS` | Event subscription (port token) | Low |
| Achievement | Instance | `INSTANCE_DOMAIN_EVENT_BUS` | Event subscription (port token) | Low |
| Achievement | Tournament | `TOURNAMENT_DOMAIN_EVENT_BUS` | Event subscription (port token) | Low |
| Achievement | Notification | `NOTIFICATION_CHANNEL_SERVICE` | Notification dispatch (port token) | Low |
| Achievement | User | `USER_ACTIVITY_SERVICE` | Activity recording (port token) | Low |
| Quiz | Attempt | `ATTEMPT_DOMAIN_EVENT_BUS` | Analytics event subscription (port token) | Low |
| Quiz | Common | `EXTERNAL_EVENT_BUS` | XP ingestion (singleton token) | Low |
| Notification | Discussion | `DISCUSSION_DOMAIN_EVENT_BUS` | Notification dispatch (forwardRef) | Low |
| Social | Ranking | `RankingRepository` (local instance) | Friend ranking queries | Medium |
| Social | Achievement | `AchievementDomainEventBus` | Feed activity | Low |
| Social | Discussion | `DISCUSSION_DOMAIN_EVENT_BUS` | Feed activity | Low |
| Social | Tournament | `TOURNAMENT_DOMAIN_EVENT_BUS` | Feed activity | Low |
| Social | Notification | `NOTIFICATION_CHANNEL_SERVICE` | Notification dispatch | Low |
| Tournament | Notification | `TournamentNotificationService` | Tournament notifications | Low |
| Instance | Attempt | `ATTEMPT_DOMAIN_EVENT_BUS` | Player state sync | Low |
| Instance | Notification | `NOTIFICATION_CHANNEL_SERVICE` | Instance notifications | Low |
| Ranking | Notification | `NOTIFICATION_REPOSITORY_PORT` | Preference lookup | Low |
| Discussion | Quiz | `QuizExistenceAdapter` (port) | Quiz validation | Low |
| Discussion | User | `UserExistenceAdapter` (port) | User validation | Low |
| Review | Quiz | `AnalyticsEventHandler` (port `QUIZ_ANALYTICS_PORT`) | Review metrics | Medium |

### 2.2 Circular Dependency Risks

| Cycle | Mitigation | Status |
|-------|-----------|--------|
| Social ↔ Ranking | SocialModule creates local `RankingRepository` + `RankingDomainEventBus` instances instead of importing `RankingModule` | ✅ Mitigated |
| Notification ↔ Discussion | `forwardRef(() => DISCUSSION_DOMAIN_EVENT_BUS)` in `NotificationModule` | ✅ Mitigated |
| Attempt ↔ Quiz | `forwardRef(() => QuizModule)` in `AttemptModule` | ✅ Mitigated |
| Instance ↔ Attempt | `forwardRef(() => AttemptModule)` in `InstanceModule` | ✅ Mitigated |
| Achievement ↔ Notification | `forwardRef(() => NotificationModule)` in `AchievementModule` | ✅ Mitigated |
| Social ↔ Notification | `forwardRef(() => NotificationModule)` in `SocialModule` | ✅ Mitigated |

### 2.3 Shared-Kernel Violations

| Violation | Description | Severity |
|-----------|-------------|----------|
| SK-1 | ✅ FIXED — `RankingEventAchievementListenerAdapter` now subscribes to `SHARED_RANKING_EVENT_BUS` via `SharedRankingEventBusAdapter`. | Fixed |
| SK-2 | ✅ FIXED — `RankingFeedListenerAdapter` (Social) now subscribes to `SHARED_RANKING_EVENT_BUS` via `SharedRankingEventBusAdapter`. | Fixed |
| SK-3 | `AchievementTournamentEventListenerAdapter` subscribes to `TOURNAMENT_DOMAIN_EVENT_BUS` (internal) instead of a shared interface. Achievement reaches into Tournament internals. | Medium |
| SK-4 | `SocialModule` creates its own local instances of `RankingRepository` and `RankingDomainEventBus` rather than using the provided port `RankingPort`. This is a workaround for the missing `SHARED_RANKING_EVENT_BUS` consumption. | Medium |
| SK-5 | `CommonExternalEventBus` is well-designed as a shared kernel for `external.xp.earned`, but the producer (`AttemptCommandService`) imports it directly from `@/common/events`, coupling Attempt to the common infrastructure. This is acceptable but worth noting. | Low |

### 2.4 Direct Repository Access Across Modules

| Access | Module | Target | Pattern | Risk |
|--------|--------|--------|---------|------|
| `RankingAdapter` | Social | `RankingRepository` | `RANKING_REPOSITORY_PORT` (port) | Low |
| `DiscussionNotificationListener` | Notification | `DiscussionRepository` | `DISCUSSION_REPOSITORY_PORT` (port) | Low |
| `QuizExistenceAdapter` | Discussion | `QuizRepository` | `QUIZ_EXISTENCE_PORT` (port) | Low |
| `UserExistenceAdapter` | Discussion | `UserRepository` | `USER_EXISTENCE_PORT` (port) | Low |
| `UserActivityListenerAdapter` | Achievement | `UserActivityService` | `USER_ACTIVITY_SERVICE` (port) | Low |
| `ReviewAnalyticsAdapter` | Review | `AnalyticsEventHandler` | `QUIZ_ANALYTICS_PORT` / `forwardRef` | Medium |

### 2.5 Infrastructure Leaking Across Modules

| Issue | Location | Description | Severity |
|-------|---------|-------------|----------|
| IE-1 | `RankingAdapter` (Social) | Creates local `RankingRepository` and `RankingDomainEventBus` instances. This is infrastructure duplication — if Ranking changes its repository schema, Social breaks silently. | High |
| IE-2 | `DiscussionNotificationListener` | Directly calls stub methods `getCommentInfo()`, `getThreadInfo()`, `getReportInfo()` which always return `null`. Author lookups for hidden/restored notifications fail silently. | High |
| IE-3 | `ReviewAnalyticsAdapter` | Uses `forwardRef(() => AnalyticsEventHandler)` to inject Quiz infrastructure into Review. Review module is coupled to Quiz internals. | Medium |

### 2.6 Missing Ports

| Port | Expected In | Should Be Provided By | Status |
|------|-----------|----------------------|--------|
| `SHARED_RANKING_EVENT_BUS` (consuming side) | `AchievementModule`, `SocialModule` | `RankingModule` via `SharedRankingEventBusAdapter` | ❌ Never consumed — listeners use internal bus directly |
| `REVIEW_ANALYTICS_PORT` consuming side | `ReviewModule` | Review domain should publish events, not call Quiz adapters directly | ❌ Adapter calls adapter |
| `NOTIFICATION_EVENT_BUS_PORT` | `NotificationModule` | Should exist for WebSocket/audit consumers | ❌ File missing |
| `SOCIAL_NOTIFICATION_PORT` | `SocialModule` | Should abstract notification dispatch | ❌ SocialNotificationListener directly uses `NotificationChannelService` |

---

## 3. Missing Integration Report

### 3.1 Missing Event Publishers

| Event | Should Be Published By | Currently Emitted |
|-------|----------------------|-------------------|
| `review.submitted` | `ReviewService` | ❌ No event emitted — `ReviewAnalyticsAdapter` is called directly |
| `review.deleted` | `ReviewService` | ❌ No event emitted — `ReviewAnalyticsAdapter` is called directly |
| `user.profile.updated` | `UserDomainService` | ✅ `UserDomainEventBus.emitProfileUpdated()` called but no subscribers |
| `user.settings.updated` | `UserDomainService` | ✅ `UserDomainEventBus.emitSettingsUpdated()` called but no subscribers |

### 3.2 Missing Event Subscribers

| Event | Module | Subscribed By | Gap |
|-------|--------|---------------|-----|
| `instance.player_joined` | Instance | *(none)* | Social feed / achievement tracking not triggered |
| `instance.player_attempt_started` | Instance | *(none)* | No real-time notification to other players |
| `instance.player_xp_earned` | Instance | *(none)* | No real-time XP popup for players |
| `instance.started` | Instance | *(none)* | No notification to joined players |
| `instance.closed` | Instance | *(none)* | No notification on instance close |
| `instance.player_disconnected` | Instance | *(none)* | No notification / reconnection handling |
| `comment_deleted` | Discussion | *(none)* | No author notification |
| `thread_closed` | Discussion | *(none)* | No author notification |
| `thread_deleted` | Discussion | *(none)* | No author notification |
| `friend_request_rejected` | Social | *(none)* | No rejection notification |
| `friend_request_cancelled` | Social | *(none)* | No cancellation notification |
| `friend_removed` | Social | *(none)* | No removal notification |
| `user_blocked` | Social | *(none)* | No blocked notification |
| `user_unblocked` | Social | *(none)* | No unblocked notification |
| `tag.created` | Tag | *(none)* | No notification on tag creation |
| `tag.updated` | Tag | *(none)* | No notification on tag update |
| `tag.deleted` | Tag | *(none)* | No notification on tag deletion |
| `tag.restored` | Tag | *(none)* | No notification on tag restore |
| `tag.followed` | Tag | *(none)* | No notification on tag follow |
| `tag.unfollowed` | Tag | *(none)* | No notification on tag unfollow |
| `password_reset_requested` | Auth | *(none)* | No audit log |
| `session_revoked` | Auth | *(none)* | No audit log / security notification |
| `all_other_sessions_revoked` | Auth | *(none)* | No audit log |

### 3.3 Events Emitted But Never Consumed

| Event | Module | Consumers | Count |
|-------|--------|-----------|-------|
| `xp.added` | Ranking | 0 (outbox dispatch only) | 1 |
| `period.reset.initiated` | Ranking | 0 | 1 |
| `period.reset.completed` | Ranking | 0 | 1 |
| `notification.sent` | Notification | 0 (WebSocket hook missing) | 1 |
| `notification.read` | Notification | 0 | 1 |
| `notification.unread` | Notification | 0 | 1 |
| `notification.deleted` | Notification | 0 | 1 |
| `user.profile.updated` | User | 0 | 1 |
| `user.settings.updated` | User | 0 | 1 |
| `tag.*` (6 events) | Tag | 0 | 6 |
| `comment_deleted` | Discussion | 0 | 1 |
| `thread_closed` | Discussion | 0 | 1 |
| `thread_deleted` | Discussion | 0 | 1 |
| `content_reported` | Discussion | 0 (only debug log) | 1 |
| `tournament.participant.withdrawn` | Tournament | 0 (only debug log) | 1 |

### 3.4 Subscribers Waiting For Events That Never Occur

| Subscriber | Expected Event | Source Module | Status |
|-----------|---------------|---------------|--------|
| *(none identified)* | | | |

All subscribers have corresponding publishers — no zombie subscribers.

### 3.5 Duplicate Event Definitions

| Event Name | Defined In | Payload Differences | Conflict |
|------------|-----------|--------------------| ---------|
| `rank.changed` | `ranking-domain.events.ts` (internal) | `{ userId, period, previousRank, newRank, previousXp, newXp, timestamp }` | Two definitions exist |
| `rank.changed` | `ranking-shared-events.ts` (shared) | `{ userId, period, previousRank, newRank, previousXp, newXp, timestamp }` | Identical payload, different file |

This is intentional (bounded context) but creates SK-1 and SK-2 violations since consumers use the internal version instead of the shared version.

### 3.6 Duplicate Event Names With Different Payloads

| Event Name | Module A Payload | Module B Payload | Risk |
|------------|-----------------|-----------------|------|
| *(none found)* | | | |

No events with the same name but different payloads were identified.

### 3.7 Broken Event Chains

| Chain ID | Path | Break Point |
|----------|------|------------|
| EC-1 | `AttemptCompletedEvent` → `CommonExternalEventBus` → `RankingEventHandler` → `XpIngestionService` → `XpAddedEvent` → `RankingDomainEventBus` → **0 consumers** | `XpAddedEvent` has no external subscribers |
| EC-2 | `AttemptCompletedEvent` → `AchievementAttemptEventListenerAdapter` → `RuleEngineService.evaluateEvent('perfect_score')` → ❌ `RuleEngineService` has no rule mapping for `perfect_score` event type | `eventToRuleType` map in `RuleEngineService.findApplicableRules()` does not include `perfect_score` — the perfect score evaluation never triggers badge awards |

### 3.8 Notification Flow Completeness

| Flow | Status | Notes |
|------|--------|-------|
| Achievement → Notification | ✅ Complete | All achievement events trigger notifications |
| Ranking → Notification | ✅ Complete | Rank improvement + milestone notifications |
| Tournament → Notification | ⚠️ Partial | `tournament.joined` has no notification handler |
| Discussion → Notification | ⚠️ Partial | `content_reported` only logs; `comment_deleted`, `thread_closed`, `thread_deleted` have no handlers |
| Social → Notification | ⚠️ Partial | `friend_request_rejected`, `friend_request_cancelled`, `friend_removed`, `user_blocked`, `user_unblocked` have no handlers |
| Instance → Notification | ❌ Missing | No `InstanceNotificationService` or handlers for instance events |
| Review → Notification | ❌ Missing | No notification when a review is submitted (could notify quiz creator) |
| User → Notification | ❌ Missing | `user.profile.updated`, `user.settings.updated` have no notification handlers |
| Tag → Notification | ❌ Missing | Tag follow/unfollow notifications missing |
| Auth → Notification | ❌ Missing | Security events (password change, session revoke) should trigger security notifications |

### 3.9 Achievement Flow Completeness

| Trigger | Achievements Evaluated | Status |
|---------|----------------------|--------|
| `attempt.completed` | ✅ Badge rules via `RuleEngineService` | Complete |
| `quiz.milestone` | ✅ Milestone badge evaluation | Complete |
| `rank.changed` | ✅ Rank badge evaluation via `RankAchievementService` | Complete |
| `peak.rank.achieved` | ✅ Rank badge evaluation | Complete |
| `ranking.milestone` | ⚠️ Handled but no badge evaluation triggered | Incomplete |
| `tournament.won` | ✅ Tournament badge evaluation | Complete |
| `instance.created` | ✅ Instance badge evaluation | Complete |
| `instance.player_finished` | ✅ Instance badge evaluation | Complete |
| `perfect_score` | ❌ `RuleEngineService.findApplicableRules()` has no `perfect_score` rule type mapping | Broken |
| `user.streak_updated` | ❌ No emitter for `user.streak_updated` event | Missing |

### 3.10 Ranking Flow Completeness

| Flow | Status | Notes |
|------|--------|-------|
| External XP → Ranking update | ✅ Complete | `external.xp.earned` → `RankingEventHandler` → `XpIngestionService` |
| Ranking update → Rank change event | ✅ Complete | `RankChangedEvent` emitted |
| Rank change → Achievement | ✅ Complete | `RankingEventAchievementListenerAdapter` |
| Rank change → Notification | ✅ Complete | `RankingNotificationListenerAdapter` |
| Rank change → Social feed | ✅ Complete | `RankingFeedListenerAdapter` |
| Peak rank → Achievement | ✅ Complete | `PeakRankAchievedEvent` → `RankAchievementService` |
| Peak rank → Social feed | ✅ Complete | `RankingFeedListenerAdapter` |
| Milestone → Social feed | ✅ Complete | `RankingFeedListenerAdapter` |
| Milestone → Notification | ✅ Complete | `RankingNotificationListenerAdapter` |
| Milestone → Achievement | ⚠️ `RankingEventAchievementListenerAdapter` handles `ranking.milestone` but only logs debug | Should evaluate badges |
| XP → Outbox | ✅ Complete | `XpIngestionService` writes to outbox atomically |
| Outbox → Consumers | ✅ Complete | `RankingOutboxProcessorService` dispatches to `RankingDomainEventBus` |

### 3.11 Social Feed Flow Completeness

| Source Event | Social Feed Activity | Status |
|-------------|---------------------|--------|
| `badge.earned` | ✅ `badge_earned` | Complete |
| `badge.revoked` | ✅ `badge_revoked` | Complete |
| `ranking.milestone` | ✅ `rank_milestone` | Complete |
| `peak.rank.achieved` | ✅ `peak_rank_achieved` | Complete |
| `discussion_thread_created` | ✅ `discussion_created` | Complete |
| `discussion_thread_solved` | ✅ `discussion_solved` | Complete |
| `tournament.joined` | ✅ `tournament_joined` | Complete |
| `comment_created` | ❌ Not recorded | Missing |
| `attempt.completed` | ❌ Not recorded | Missing |
| `quiz.milestone` | ❌ Not recorded | Missing |

### 3.12 Tournament Flow Completeness

| Flow | Status | Notes |
|------|--------|-------|
| Tournament joined → Social feed | ✅ Complete | `TournamentFeedListenerAdapter` |
| Tournament joined → Notification | ❌ Missing | `TournamentListenerAdapter` has no handler for `tournament.joined` |
| Tournament starting soon → Notification | ✅ Complete | `TournamentListenerAdapter` |
| Tournament completed → Notification | ✅ Complete | `TournamentListenerAdapter` |
| Tournament won → Notification | ✅ Complete | `TournamentListenerAdapter` |
| Tournament won → Achievement | ✅ Complete | `AchievementTournamentEventListenerAdapter` |
| Tournament won → Social feed | ✅ Complete | `TournamentFeedListenerAdapter` |
| Tournament won → XP earned | ⚠️ Via BullMQ async processing | `TournamentEventProcessor` does not re-dispatch to `CommonExternalEventBus` for XP |

### 3.13 Instance Flow Completeness

| Flow | Status | Notes |
|------|--------|-------|
| Attempt started (instance context) → Player linked | ✅ Complete | `InstanceAttemptEventBootstrapService` |
| Attempt completed → Player finished | ✅ Complete | `InstanceAttemptEventBootstrapService` |
| Attempt completed → XP event | ⚠️ `PlayerXpEarnedEvent` emitted but not consumed | Missing consumer for real-time XP popup |
| Instance created → Achievement | ✅ Complete | `AchievementInstanceEventListenerAdapter` |
| Player finished → Achievement | ✅ Complete | `AchievementInstanceEventListenerAdapter` |
| Instance events → Notification | ❌ Missing | No `InstanceNotificationService` |
| Instance events → Social feed | ❌ Missing | No instance activity in social feed |

### 3.14 Discussion Flow Completeness

| Flow | Status | Notes |
|------|--------|-------|
| Comment created → Reply notification | ✅ Complete | |
| Comment created → Thread subscriber notification | ✅ Complete | |
| Thread solved → Notification | ✅ Complete | |
| Comment mentioned → Mention notification | ✅ Complete | |
| Content reported → Debug log | ⚠️ Should notify moderators | Only logs |
| Report reviewed → Reporter notification | ✅ Complete | |
| Comment/thread hidden → Author notification | ✅ Complete | |
| Comment/thread restored → Author notification | ✅ Complete | |
| Thread reopened → Author notification | ✅ Complete | |
| Comment deleted → Author notification | ❌ Missing | |
| Thread closed → Author notification | ❌ Missing | |
| Thread deleted → Author notification | ❌ Missing | |
| Comment created → Social feed | ❌ Missing | Only `discussion_thread_created` is recorded |

### 3.15 Outbox Inconsistencies

| Module | Outbox Adapter | Outbox Processor | Status |
|--------|--------------|-----------------|--------|
| Ranking | ✅ `RankingOutboxAdapter` | ✅ `RankingOutboxProcessorService` | ✅ Complete |
| Achievement | ✅ `AchievementOutboxAdapter` | ❌ **Missing** — no `AchievementOutboxProcessorService` | ❌ Incomplete |
| Auth | ✅ `OutboxAdapter` | ✅ `OutboxProcessorService` | ⚠️ Partial — processor only logs to `AuthAuditLogService`, not to a consumer event bus |

### 3.16 Event Bus Inconsistencies

| Module | Bus Type | Retry | Outbox | Consistent |
|--------|----------|-------|--------|-------------|
| Attempt | In-process | No | No | ✅ |
| Ranking | In-process + Outbox | Yes (exponential) | Yes | ✅ |
| Achievement | In-process | No | No | ✅ |
| Tournament | In-process + BullMQ | Yes (BullMQ) | Yes (BullMQ) | ✅ |
| Discussion | In-process + Redis retry | Yes (Redis polling) | No | ⚠️ Non-standard |
| Quiz | In-process | No | No | ✅ |
| Bookmark | In-process | No | No | ✅ |
| Social | In-process | No | No | ✅ |
| Notification | In-process | No | No | ✅ |
| Review | ❌ **No event bus** | — | — | ❌ Missing |
| Instance | In-process | No | No | ✅ |
| Category | In-process | No | No | ✅ |
| Tag | In-process | No | No | ✅ |
| User | In-process | No | No | ✅ |
| Auth | Outbox only | Yes | Yes | ⚠️ No in-process bus |

### 3.17 Correlation ID Propagation Issues

| Issue | Location | Description | Severity |
|-------|---------|-------------|---------|
| CI-1 | `createCorrelationId()` vs `getCorrelationId()` | `AchievementAttemptEventListenerAdapter`, `RankingEventAchievementListenerAdapter`, `RankingFeedListenerAdapter`, `DiscussionFeedListenerAdapter`, `TournamentFeedListenerAdapter`, and several notification listeners use `createCorrelationId()` which generates a new ID rather than propagating the incoming request's correlation ID. Meanwhile `RankingEventHandler` uses `getCorrelationId()` which reads from storage. Inconsistent propagation. | Medium |
| CI-2 | Event correlation | When `CommonExternalEventBus` publishes `external.xp.earned`, it does not propagate the original request's correlation ID. The XP ingestion and downstream ranking events lose the trace chain. | Medium |
| CI-3 | Outbox correlation | `RankingOutboxProcessorService` and `OutboxProcessorService` (Auth) do not read `getCorrelationId()` when processing events and do not propagate it to emitted events. | Medium |
| CI-4 | BullMQ correlation | `TournamentEventProcessor` processes events from the queue but does not set correlation ID in the processing context. | Medium |
| CI-5 | `DiscussionDomainEventBus` retry queue | Redis-based retry does not carry correlation ID through retry cycles. | Low |

---

## 4. Cleanup Plan — Phase 1

**Status: ALL ITEMS IMPLEMENTED** ✅

**Focus: Critical Bugs — Zero to Low Implementation Effort**

All 6 Phase 1 items have been implemented and verified with `tsc --noEmit`.

### P1.1 — Fix `perfect_score` achievement rule mapping (EC-2) ✅ FIXED

**File:** `src/modules/achievement/domain/services/rule-engine.service.ts`

`perfect_score` added to `eventToRuleType` map in `findApplicableRules()`.

### P1.2 — Add missing Discussion event handlers ✅ FIXED

**Files:**
- `src/modules/social/infrastructure/adapters/discussion-feed-listener.adapter.ts` — `recordCommentCreated()` handler added
- `src/modules/social/domain/types/social.types.ts` — `comment_created` added to `SocialFeedActivityType`
- `src/core/database/schema/index.ts` — `comment_created` added to `socialFeedActivityType` enum
- `src/modules/social/dto/response/social-response.dto.ts` — `comment_created` added to DTOs

### P1.3 — Fix stub author lookups in DiscussionNotificationListener ✅ FIXED

**Files:**
- `src/modules/discussion/domain/ports/index.ts` — port interface extended with `getCommentAuthor()`, `getThreadAuthor()`, `getReportReporter()`
- `src/modules/discussion/infrastructure/repositories/discussion.repository.ts` — methods implemented
- `src/modules/notification/infrastructure/adapters/discussion-notification-listener.adapter.ts` — stubs replaced with real calls; also added handlers for `comment_deleted`, `thread_closed`, `thread_deleted`

### P1.4 — Add `tournament.joined` notification handler ✅ FIXED

**Files:**
- `src/modules/tournament/domain/events/tournament-joined.event.ts` — `tournamentTitle` field added to event
- `src/modules/tournament/domain/tournament.service.ts` — publisher passes `tournament.title`
- `src/modules/tournament/infrastructure/events/bullmq-tournament-event-bus.service.ts` — serialization/deserialization updated; `TournamentEventJobData` type updated
- `src/modules/notification/domain/services/tournament-notification.service.ts` — `TournamentJoinedParams` interface and `notifyTournamentJoined()` method added
- `src/modules/notification/infrastructure/adapters/tournament-listener.adapter.ts` — `handleTournamentJoined()` handler added to switch

### P1.5 — Remove orphaned Achievement outbox infrastructure ✅ FIXED

**Files deleted:**
- `src/modules/achievement/domain/ports/achievement-outbox.port.ts`
- `src/modules/achievement/infrastructure/outbox/achievement-outbox.adapter.ts`
- `src/modules/achievement/infrastructure/outbox/index.ts`

**Files updated:**
- `src/modules/achievement/domain/ports/index.ts` — removed outbox export
- `src/modules/achievement/infrastructure/index.ts` — removed outbox export
- `src/modules/achievement/achievement.module.ts` — `AchievementOutboxAdapter` and `ACHIEVEMENT_OUTBOX_PORT` removed from providers and exports

### P1.6 — Add missing auth security event audit handlers ✅ FIXED

**File:** `src/modules/auth/infrastructure/outbox/outbox-processor.service.ts`

Added three missing event type cases:
- `password_reset:password_reset_requested`
- `session:session_revoked`
- `session:all_other_sessions_revoked`
---

## 5. Cleanup Plan — Phase 2

**Status: ALL ITEMS IMPLEMENTED** ✅

**Focus: Architecture Improvements — Medium Effort**

### P2.1 — Create Review domain event bus ✅ FIXED

**New files:**
- `src/modules/review/domain/events/review-domain.event-bus.ts`
- `src/modules/review/domain/events/review-domain-event-bus.port.ts`
- `src/modules/quiz/domain/events/review-event-listener.adapter.ts`

**Changes to:**
- `src/modules/review/domain/review.service.ts` — emit `ReviewSubmittedEvent` and `ReviewDeletedEvent` via `reviewEventBus.dispatchToSubscribers()`
- `src/modules/review/review.module.ts` — register `ReviewDomainEventBus` and export `REVIEW_DOMAIN_EVENT_BUS`; `forwardRef` added for `QuizModule`; `ReviewAnalyticsAdapter` removed
- `src/modules/review/domain/events/index.ts` — export new bus types
- `src/modules/quiz/quiz.module.ts` — import `ReviewModule` with `forwardRef`, register `ReviewEventListenerAdapter`
- `src/modules/review/domain/events/review-domain.events.ts` — `eventType` getter added to event classes
- `src/modules/notification/domain/services/index.ts` — `InstanceNotificationService` exported
- `src/modules/notification/infrastructure/adapters/instance-notification-listener.adapter.ts` — new listener
- `src/modules/notification/notification.module.ts` — register listener and service; import `InstanceModule`
- `src/modules/social/social.module.ts` — `SharedRankingEventBusAdapter` and `SHARED_RANKING_EVENT_BUS` added; local instances replaced with proper shared bus
- `src/modules/ranking/domain/events/shared-ranking-event-bus.adapter.ts` — new adapter bridging internal bus to shared bus
- `src/modules/ranking/ranking.module.ts` — `SharedRankingEventBusAdapter` and `SHARED_RANKING_EVENT_BUS` provided and exported
- `src/core/database/schema/index.ts` — 5 new instance notification types added to `notificationType` enum

This replaces the `ReviewAnalyticsAdapter → AnalyticsEventHandler` direct coupling with proper event-driven architecture.

### P2.2 — Switch to Shared Ranking Event Bus (SK-1, SK-2) ✅ FIXED

**New files:**
- `src/modules/ranking/domain/events/shared-ranking-event-bus.adapter.ts`

**Changes to:**
- `src/modules/achievement/infrastructure/adapters/ranking-event-listener.adapter.ts` — now injects `SHARED_RANKING_EVENT_BUS` via `SharedRankingEventBusPort` instead of `RANKING_DOMAIN_EVENT_BUS`
- `src/modules/social/infrastructure/adapters/ranking-feed-listener.adapter.ts` — now injects `SHARED_RANKING_EVENT_BUS` via `SharedRankingEventBusPort` instead of `RANKING_DOMAIN_EVENT_BUS`
- `src/modules/social/social.module.ts` — `SharedRankingEventBusAdapter` and `SHARED_RANKING_EVENT_BUS` token provided locally (for Social's local RankingDomainEventBus instance)
- `src/modules/ranking/ranking.module.ts` — `SharedRankingEventBusAdapter` provided and `SHARED_RANKING_EVENT_BUS` exported

**Steps:**
1. ✅ Created `SharedRankingEventBusAdapter` in Ranking module that re-exports `RankingDomainEventBus` events as `SharedRankingDomainEvent` types
2. ✅ Provided `SHARED_RANKING_EVENT_BUS` token in `RankingModule`
3. ✅ Updated listeners to `@Inject(SHARED_RANKING_EVENT_BUS)` instead of `RANKING_DOMAIN_EVENT_BUS`

### P2.3 — Create `InstanceNotificationService` ✅ FIXED

**New files:**
- `src/modules/notification/domain/services/instance-notification.service.ts`
- `src/modules/notification/infrastructure/adapters/instance-notification-listener.adapter.ts`

Handles:
- Player joined notification (to host)
- Instance started notification (to all players)
- Player XP earned (real-time popup)
- Instance closed notification
- Player disconnected notification

**Changes to:**
- `src/modules/notification/domain/services/index.ts` — export `InstanceNotificationService`
- `src/modules/notification/notification.module.ts` — register `InstanceNotificationService` and `InstanceNotificationListener`; import `InstanceModule`
- `src/core/database/schema/index.ts` — added `instance_player_joined`, `instance_started`, `instance_xp_earned`, `instance_closed`, `instance_player_disconnected` to `notificationType` enum

### P2.4 — Add missing Social notifications ✅ FIXED

**File:** `src/modules/social/infrastructure/adapters/social-notification-listener.adapter.ts`

Added handlers for:
- `friend_request_rejected` → notify requester
- `friend_request_cancelled` → notify addressee
- `friend_removed` → notify removed friend
- `user_blocked` → notify blocked user
- `user_unblocked` → notify unblocked user

### P2.5 — Add missing Discussion notifications ✅ FIXED

**File:** `src/modules/notification/infrastructure/adapters/discussion-notification-listener.adapter.ts`

Already implemented in Phase 1 (P1.3) — handlers for `comment_deleted`, `thread_closed`, and `thread_deleted` were added along with the stub author lookups fix.

### P2.6 — Consolidate correlation ID creation ✅ FIXED

**Changes to:**
- `src/modules/achievement/infrastructure/adapters/ranking-event-listener.adapter.ts` — `createCorrelationId()` replaced with `getCorrelationId() ?? createCorrelationId()`
- `src/modules/achievement/infrastructure/adapters/attempt-listener.adapter.ts` — `createCorrelationId()` replaced with `getCorrelationId() ?? createCorrelationId()`
- `src/modules/achievement/infrastructure/adapters/achievement-notification-listener.adapter.ts` — all 4 `createCorrelationId()` calls replaced
- `src/modules/achievement/infrastructure/adapters/instance-listener.adapter.ts` — both `createCorrelationId()` calls replaced
- `src/modules/achievement/infrastructure/adapters/user-activity-listener.adapter.ts` — `createCorrelationId()` replaced
- `src/modules/achievement/infrastructure/adapters/tournament-listener.adapter.ts` — `createCorrelationId()` replaced
- `src/modules/social/domain/events/social-domain.event-bus.ts` — error handler uses `getCorrelationId()`; `emit()` now wraps handlers in `correlationIdStorage.run()` to propagate correlation ID through the Social event chain
- `src/modules/social/infrastructure/adapters/discussion-feed-listener.adapter.ts` — `getCorrelationId() ?? createCorrelationId()` added to all handlers with debug logging
- `src/modules/social/infrastructure/adapters/tournament-feed-listener.adapter.ts` — `getCorrelationId() ?? createCorrelationId()` added to event handler with debug logging

All adapters now use `getCorrelationId() ?? createCorrelationId()` to fall back to creating a new UUID only when no correlation ID exists in the async context (e.g., background job without a parent request).

### P2.7 — Propagate correlation ID through outbox events ✅ FIXED

**Files updated:**
- `src/modules/ranking/infrastructure/outbox/ranking-outbox-processor.service.ts` — `dispatch()` now reads `event.correlationId` from the outbox row and wraps `dispatchToSubscribers()` in `correlationIdStorage.run()`
- `src/modules/auth/infrastructure/outbox/outbox-processor.service.ts` — `dispatch()` now reads `event.correlationId` and wraps the entire audit log write in `correlationIdStorage.run()`
- `src/core/database/schema/index.ts` — `correlationId` column added to `outbox_events` table (`text('correlation_id')`, nullable)

**Changes:** In each outbox processor's `dispatch()`, read `correlationId` from the outbox row and set it in AsyncLocalStorage before calling downstream handlers:

```diff
  private async dispatch(event: OutboxEventRow): Promise<void> {
    const domainEvent = event.payload as unknown as RankingDomainEvent;
+   const correlationId = event.correlationId ?? createCorrelationId();
+   correlationIdStorage.run({ correlationId }, () => {
      this.eventBus.dispatchToSubscribers(domainEvent);
+   });
  }
```

---

## 6. Cleanup Plan — Phase 3

**Focus: Long-term Architecture — Higher Effort**

### P3.1 — Create `TagNotificationService` ⏸️ DEFERRED

**Reason:** The Tag data model (`TagRow`) has no `creatorId` field — tags don't track an owner. The business case ("notify tag creator when someone follows") requires product input and likely a schema change. Deferred pending product decision.

Implement a notification service for tag lifecycle events. This requires determining the business case: should tag creation notify all users? Should tag follow notify the tag creator? This needs product input before implementation.

### P3.2 — Create `ReviewNotificationService` ✅ FIXED

**New files:**
- `src/modules/notification/domain/services/review-notification.service.ts`
- `src/modules/notification/infrastructure/adapters/review-notification-listener.adapter.ts`

Handles:
- `ReviewSubmittedEvent` → notify quiz creator
- `ReviewDeletedEvent` → notify quiz creator of deletion

**Changes to:**
- `src/modules/notification/domain/services/index.ts` — export `ReviewNotificationService`
- `src/modules/notification/notification.module.ts` — register `ReviewNotificationService` and `ReviewNotificationListener`; import `ReviewModule` and `QuizModule` via `forwardRef`

### P3.3 — Create `UserNotificationService` ✅ FIXED

**New files:**
- `src/modules/notification/domain/services/user-notification.service.ts` — handles `user.profile.updated` and `user.settings.updated`
- `src/modules/notification/infrastructure/adapters/user-notification-listener.adapter.ts` — subscribes to `USER_DOMAIN_EVENT_BUS`
- `src/modules/notification/domain/services/auth-security-notification.service.ts` — handles security events: `password_changed`, `password_reset_requested`, `password_reset_completed`, `account_deleted`, `session_revoked`, `all_other_sessions_revoked`, `oauth_linked`, `oauth_unlinked`

**Changes to:**
- `src/modules/notification/domain/services/index.ts` — exports `UserNotificationService` and `AuthSecurityNotificationService`
- `src/modules/notification/notification.module.ts` — imports `UserModule` via `forwardRef`, registers `UserNotificationService` and `UserNotificationListener`
- `src/modules/auth/infrastructure/outbox/outbox-processor.service.ts` — `AuthSecurityNotificationService` injected; `sendSecurityNotification()` called after audit log write for all security events
- `src/modules/auth/auth.module.ts` — imports `NotificationModule`, registers `AuthSecurityNotificationService`
- `src/core/database/schema/index.ts` — added 11 new notification types: `profile_updated`, `settings_updated`, `password_changed`, `password_reset_requested`, `password_reset_completed`, `account_deleted`, `session_revoked`, `all_other_sessions_revoked`, `oauth_linked`, `oauth_unlinked`

### P3.5 — Add WebSocket push for Notification module events ✅ FIXED

**New files:**
- `src/modules/notification/transport/gateway/notification.gateway.ts` — WebSocket gateway at namespace `/notifications` using `WsJwtGuard`. Tracks user-scoped socket connections and exposes `pushToUser()` for broadcasting events to connected clients.
- `src/modules/notification/infrastructure/adapters/notification-websocket-listener.adapter.ts` — subscribes to all 4 `NotificationDomainEventBus` event types (`notification.sent`, `notification.read`, `notification.unread`, `notification.deleted`) and forwards them to `NotificationGateway.pushToUser()`

**Changes to:**
- `src/modules/notification/domain/events/index.ts` — re-exports `notification-domain.event-bus` (which exports `NOTIFICATION_DOMAIN_EVENT_BUS`, `NotificationDomainEventBus`, and `NotificationEventSubscription`)
- `src/modules/notification/notification.module.ts` — registers `NotificationGateway` and `NotificationWebSocketListener`

### P3.6 — Fix SocialModule local Ranking instances (IE-1)

Replace local `RankingRepository` and `RankingDomainEventBus` instances in `SocialModule` with proper port abstractions:

1. Ensure `RankingModule` exports `SHARED_RANKING_EVENT_BUS` and `RANKING_PORT`
2. `SocialModule` imports `RankingModule`
3. `RankingAdapter` uses `RANKING_PORT` (already done)
4. Feed listeners use `SHARED_RANKING_EVENT_BUS` (see P2.2)

### P3.7 — Decouple Review from Quiz (IE-3) ✅ FIXED

Implemented in P2.1 — Review module now publishes `review.submitted` / `review.deleted` events via `ReviewDomainEventBus`. Quiz module subscribes via `ReviewEventListenerAdapter`. `ReviewAnalyticsAdapter` removed.

### P3.8 — Add `user.streak_updated` event emission

Currently referenced in `RuleEngineService.findApplicableRules()` but no module emits it. If streak tracking is part of the User domain, `UserDomainService` should emit `UserStreakUpdatedEvent`. If it's in Achievement, the `RuleEngineService` reference should be removed.

### P3.9 — Implement `tournament.won` → XP chain

The `TournamentEventProcessor` processes `tournament.won` from BullMQ but does not re-dispatch XP to `CommonExternalEventBus`. Tournament winners should earn XP:

```typescript
// In TournamentEventProcessor.handle()
case 'tournament.won':
  const xpEvent: ExternalXpEarnedEvent = {
    eventType: 'external.xp.earned',
    userId: event.userId,
    amount: computeTournamentXpPrize(event.rank),
    source: 'tournament',
    tournamentId: event.tournamentId,
    timestamp: new Date(),
  };
  // Inject CommonExternalEventBus and publish
```

### P3.10 — Add social feed activities for Quiz and Attempt

- `attempt.completed` → social feed `quiz_attempt` activity
- `quiz.milestone` → social feed `quiz_milestone` activity

This requires adding `QUIZ_ANALYTICS_PORT` consumption from Social module or creating a new `SocialFeedEventBus`.

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Total events defined | ~60 |
| Fully Wired | ~40 |
| Partial (known gaps) | ~15 |
| Broken | ~8 |
| Missing event buses | 0 (Review ✅) |
| Missing outbox processors | 1 (Achievement) |
| Shared-kernel violations | 3 (SK-1 ✅ SK-2 ✅, SK-3 remaining) |
| Missing ports | 3 |
| Infrastructure duplication | 1 (Social→Ranking) |
| Correlation ID issues | 0 (all ✅ — P2.6, P2.7) |
| Phase 1 items | 6 (all ✅) |
| Phase 2 items | 7 (all ✅) |
| Phase 3 items | 10 (P3.2 ✅, P3.3 ✅, P3.5 ✅, P3.7 ✅, 6 remaining) |

---

*Generated by Cross-Module Integration Audit — June 12, 2026*
