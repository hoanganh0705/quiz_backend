## 4. Event Duplication Risks

### HIGH

**In-process domain event buses — no sequence numbers**

- **Modules:** `attempt`, `quiz`, `discussion`, `ranking`, `achievement`, `social`, `notification`
- **Files:** All `*domain.event-bus.ts` files
- **Impact:** Events are dispatched synchronously in-process. In a multi-instance deployment, each instance has its own in-memory bus — events published in instance A never reach handlers in instance B. The outbox processors compensate for cross-instance delivery, but the in-process buses provide no ordering or deduplication guarantees. The same event type can be emitted multiple times within a single request if a handler re-throws and a middleware re-triggers.
- **Fix:** Implement sequence numbers per aggregate. Subscribers should track the last processed sequence and skip duplicates. Alternatively, use a message broker (Kafka/RabbitMQ) with consumer group semantics instead of in-memory buses.

---

## 5. Event Loss Risks

### HIGH

**In-process bus events — lost on crash before outbox**

- **Modules:** `notification`, `social`, `discussion`, `review`
- **Files:** Domain event bus implementations
- **Impact:** Events are emitted synchronously and directly to handlers (e.g., notification creation, social feed recording). These events are **not** written to the outbox table. If the application crashes after the DB commit for the triggering operation but before the event handler completes (e.g., notification is created, app crashes, notification never sent), the event is permanently lost.
- **Affected handlers:** `UserNotificationListener` (user events), `ReviewEventListener` (review events), `NotificationDomainEventHandler` (notification events), `SocialFeedListener` (social events), `AchievementEventHandler` (achievement events), `RankingEventHandler` (ranking events), `NotificationAchievementListener` (achievement notifications).
- **Fix:** All event handlers that produce side effects must write to the outbox table inside the same transaction as the triggering operation. The in-process bus should only handle read-heavy, non-critical enrichment.

## 6. Outbox Coverage

### CRITICAL

**Incomplete outbox coverage — only 3 of 5 domains covered**

- **Modules:** `auth`, `ranking`, `achievement` — ✅ have outbox
- **Modules:** `notification`, `social`, `discussion`, `review` — ❌ NO outbox
- **Impact:** See Section 5 (Event Loss Risks). Events from these domains are lost on crash. Additionally, in multi-instance deployments, instance A cannot notify users connected to instance B.
- **Fix:** Implement outbox processors for `notification`, `social`, `discussion`, and `review` domains. Each should write to `outbox_events` with `aggregateType` identifying the source domain.

---

### HIGH

**Auth outbox — infinite retry, no DLQ**

- **Modules:** `auth`
- **File:** `src/modules/auth/infrastructure/outbox/outbox-processor.service.ts`, lines 150–167
- **Impact:** When `attemptCount >= maxOutboxRetries`, the processor logs an error and continues. The event stays in the outbox with `processedAt = null`, `failedAt = null`. Every 30 seconds, the cron re-selects it, re-throws, and re-schedules. This creates an infinite retry loop for poisoned events.
- **Fix:** After exhausting retries, set `failedAt = nowIso` and `dlqReason = 'exhausted_retries:...'`. Add a separate DLQ monitoring job that alerts when `failedAt IS NOT NULL AND dlqReason IS NOT NULL` rows exist.

---

### MEDIUM

**Outbox processors — no distributed lock**

- **Modules:** `auth`, `ranking`, `achievement`
- **Impact:** All three outbox processors run on every instance at the same cron interval. In a 3-instance deployment, each instance processes the same batch of 100 events every minute, causing duplicate processing attempts. The idempotency check handles duplicates, but this wastes resources and increases lock contention on the outbox rows.
- **Fix:** Use `SELECT ... FOR UPDATE SKIP LOCKED` or `pg_advisory_xact_lock` in the outbox query to ensure only one instance processes each batch.

---

## 7. Retry Coverage

### MEDIUM

**HTTP external calls — no retry library**

- **Modules:** `email`
- **File:** `src/modules/email/email.processor.ts`, line 154
- **Impact:** The email send call uses `resend.emails.send()`. If it throws a transient error (timeout, 503, connection reset), BullMQ retries the entire job. However, BullMQ's retry does not distinguish between permanent and transient failures — a 400 Bad Request will be retried 5 times, wasting queue capacity.
- **Fix:** Add a `shouldRetry` function that only retries on 5xx errors and network errors, not 4xx.

---

**Social feed recording — no retry**

- **Modules:** `social`
- **File:** `src/modules/social/infrastructure/listeners/social-feed.listener.ts`
- **Impact:** If `SocialFeedListener` fails to record a feed activity, the event is caught, logged, and swallowed. The activity is permanently lost.
- **Fix:** Write to the outbox table inside the same transaction as the triggering domain operation.

---

## 8. Dead-Letter Candidates

### MEDIUM

**DLQ rows — no monitoring or alerting**

- **Modules:** `ranking`, `achievement`
- **Impact:** DLQ rows (`failed_at IS NOT NULL` in `outbox_events`) accumulate silently. There is no scheduled job, no alerting rule, and no manual inspection tooling to review them. Poisoned messages sit in the table indefinitely.
- **Fix:** Add `SELECT COUNT(*) FROM outbox_events WHERE failed_at IS NOT NULL` to the health check endpoint. Add a Prometheus gauge. Add a PagerDuty alert threshold (e.g., > 10 DLQ rows = P2).

---

## 9. Cache Consistency

## 10. Referential Integrity

### MEDIUM

**No FK constraints visible in schema**

- **Modules:** All
- **File:** `src/core/database/schema/`, migration files
- **Impact:** The schema files define columns referencing other tables (e.g., `quiz_attempts.quiz_version_id → quiz_versions.quiz_version_id`) but the actual constraint definitions (`REFERENCES ... ON DELETE ...`) are not visible in the schema TypeScript files. It is unclear whether the migrations include `FOREIGN KEY` constraints or rely solely on application-level validation.
- **Fix:** Verify that all migrations include `FOREIGN KEY` constraints with appropriate `ON DELETE` behavior (typically `RESTRICT` or `SET NULL`). Add a CI check that validates FK coverage against a reference model.

---

### LOW

**Soft delete FK gaps**

- **Modules:** `quiz`, `discussion`, `review`
- **Impact:** `quizzes`, `discussion_threads`, `discussion_comments`, `quiz_reviews` all use `deleted_at IS NULL` soft deletes. If a parent entity is soft-deleted, orphaned child records remain in the DB. For example, soft-deleting a quiz leaves `quiz_attempts`, `quiz_answer_options`, and `discussion_threads` referencing it. These orphans are filtered in queries but remain in the table.
- **Fix:** Add `ON DELETE SET NULL` or `ON DELETE CASCADE` FK constraints in migrations, or implement hard deletes for the corresponding children.

---

## 11. Data Corruption Risks

### MEDIUM

**Notification payload — unbounded JSONB**

- **Modules:** `notification`
- **File:** `src/core/database/schema/notifications.ts`
- **Impact:** `payload JSONB NOT NULL DEFAULT '{}'` has no size constraint. A malicious or buggy event producer could write a multi-MB JSON payload, bloating the table and causing query performance degradation.
- **Fix:** Add a `CHECK (octet_length(payload) <= 32768)` (32KB) constraint.

---

## 12. Distributed Consistency Risks

### MEDIUM

**Session revocation — single instance invalidation**

- **Modules:** `auth`
- **File:** `src/modules/auth/domain/services/auth-session.service.ts`
- **Impact:** Session revocation invalidates the session in the database, but does not actively push invalidation to other instances. Users connected to a different instance may still use the revoked session until their next DB check.
- **Fix:** Use Redis pub/sub to broadcast session invalidation events. Instances subscribe and evict the session from their in-memory cache on receipt.

---

## 14. N+1 Query Risks

**Social `getFriendLeaderboard` — N+1 on friend IDs**

- **Modules:** `social`
- **File:** `src/modules/social/domain/services/social.service.ts`, lines 620–640
- **Impact:** `getFriendLeaderboard` calls `ranking.getRankingsForUsers(friendIds, period)` and `ranking.getRankTrendsForUsers(friendIds, ...)`. The ranking port implementation may make N separate queries for N friend IDs instead of a single batched query.
- **Fix:** Verify the ranking port implementation uses a single `WHERE user_id IN (...)` query.

---

## 15. Security Vulnerabilities

### CRITICAL

**`InstanceController` — no authentication on any endpoint**

- **Modules:** `instance`
- **File:** `src/modules/instance/transport/controller/instance.controller.ts`, lines 37–242
- **Impact:** Every HTTP route in the controller lacks `@ApiAuth()`, `@ApiBearerAuth()`, `@RequireAuth()`, or `@UseGuards(JwtGuard)`. While the `JwtGuard` is globally registered, the controller does not declare any auth decorators. The `InstanceGateway` WebSocket has `@UseGuards(WsJwtGuard)`, but the HTTP API does not. Unauthenticated users can join, start, and close live quiz instances.
- **Fix:** Add `@ApiBearerAuth()` and `@RequireAuth()` at class level. Add `@Permissions(Permission.INSTANCE_HOST_ONLY)` to `startInstance` and `closeInstance`.

---

### HIGH

**Social `getFriendsOfUser` — IDOR**

- **Modules:** `social`
- **File:** `src/modules/social/transport/controller/social.controller.ts`, lines 285–292
- **Impact:** `{ ...user, sub: targetUserId }` substitutes the authenticated user's identity with the URL parameter. Any authenticated user can read any other user's friend list.
- **Fix:** Do not substitute `user.sub`. The service should check relationship status and privacy settings before returning the target's friends.

---

### MEDIUM

**Missing security headers**

- **Modules:** All
- **File:** `src/main.ts`
- **Impact:** `helmet()` is called but `contentSecurityPolicy: false` when Swagger is enabled. This means no security headers are set in development/staging environments where Swagger is enabled. Missing headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`.
- **Fix:** Set explicit security headers regardless of Swagger state. Use `contentSecurityPolicy: false` only for the Swagger-specific CSP directive, not all headers.

---

**Notification analytics — platform-wide data exposure**

- **Modules:** `notification`
- **File:** `src/modules/notification/transport/controller/notification.controller.ts`, line 94
- **Impact:** `GET /notifications/analytics` returns aggregate statistics for **all users** on the platform (total notifications, by type, by channel, last 24h, last 7d). Only admins with `@Roles('admin')` can access it, but the data covers the entire user base — a privacy concern.
- **Fix:** Scope analytics to the requesting admin's own notification data, or add explicit `@Permissions(Permission.NOTIFICATION_ANALYTICS_VIEW)` with a data minimization check.

---

### LOW

**`WsJwtGuard` — undefined audience silently skipped**

- **Modules:** `auth`
- **File:** `src/common/guards/ws-jwt.guard.ts`, line 29
- **Impact:** If `JWT_ACCESS_TOKEN_AUDIENCE` env var is undefined, `verifyAsync` receives `undefined` and skips audience validation. A token issued for a different audience could be accepted.
- **Fix:** Throw at startup if `JWT_ACCESS_TOKEN_AUDIENCE` is not set, or validate audience explicitly before calling `verifyAsync`.

---

## 16. Authorization Gaps

### MEDIUM

**Review moderation — admin-only status change**

- **Modules:** `review`
- **File:** `src/modules/review/infrastructure/controllers/admin-review.controller.ts`, line 107
- **Impact:** `updateReportStatus` uses `@Roles('admin')`. Moderators cannot act on review reports — they must escalate to admins.
- **Fix:** Add `@Permissions(Permission.REVIEW_MODERATE)` with role `'moderator'` or `'admin'` in `ROLE_PERMISSIONS`.

---

**Badge revocation — admin-only**

- **Modules:** `achievement`
- **File:** `src/modules/achievement/transport/controller/achievement.controller.ts`, line 90
- **Impact:** Same as review moderation — no moderator role. Minor, as badge revocation is a sensitive operation.
- **Fix:** Add `@Permissions(Permission.BADGE_REVOKE)` with `moderator` and `admin` roles.

---

## 17. Privilege Escalation Paths

### LOW

**No privilege escalation paths found.**

The codebase has no path for a regular user to elevate to moderator or admin. The `QuizPolicy`, `AttemptCommandService`, and `AttemptQueryService` all enforce ownership and role checks. JWT payload validation (`isUserRole`) prevents tampering. The only concern is the IDOR in social `getFriendsOfUser` (Section 15, HIGH) which is a data access issue, not an elevation issue.

---

## 18. Audit Logging Coverage

### MEDIUM

**Auth-only audit log — major gaps**

- **Modules:** `auth`
- **File:** `src/modules/auth/infrastructure/audit/auth-audit-log.service.ts`
- **Impact:** `AuthAuditLogService` only records auth events (login, logout, registration, password reset). The following sensitive operations are **not** audited:
  - User profile changes (email, username, display name)
  - Password changes (not via reset flow)
  - Account deletion (database operation audited via outbox, but not the audit log service)
  - Badge revocation (`AchievementController.revokeUserBadge`)
  - Review moderation actions (`AdminReviewController.updateReportStatus`)
  - Social block/unblock actions
  - Quiz deletion

- **Fix:** Extend `AuthAuditLogService` to accept generic event types, or create an `AuditLogService` that covers all sensitive operations across domains.

---

### LOW

**Audit log purge — no retention policy enforcement**

- **Modules:** `auth`
- **File:** `src/modules/auth/infrastructure/outbox/outbox-processor.service.ts`, line 232
- **Impact:** `purgeExpiredAuditLogs` runs daily at 3 AM, but there is no verification that old logs are actually deleted. If `purgeExpired()` has a bug, logs accumulate forever.
- **Fix:** Add a row count assertion in the purge job. Alert if deleted count is 0 when expected > 0.

---

## 19. Monitoring Gaps

### HIGH

**No Prometheus metrics endpoint**

- **Modules:** All
- **Impact:** No `/metrics` endpoint exists. Observability relies entirely on structured JSON logs. In production, this makes it impossible to:
  - Measure request latency percentiles (p50, p95, p99)
  - Track error rates per endpoint
  - Monitor queue depth, outbox lag, DLQ size
  - Set SLO alerts without custom log parsing
- **Fix:** Add `@willsoto/nestjs-prometheus` or raw `/metrics` endpoint exporting:
  - `http_requests_total` (method, path, status)
  - `http_request_duration_seconds` (histogram)
  - `outbox_events_pending` (gauge per aggregate type)
  - `outbox_events_dlq` (gauge per aggregate type)
  - `quiz_attempts_total` (counter)
  - `active_instances_total` (gauge)

---

**No outbox lag monitoring**

- **Modules:** `auth`, `ranking`, `achievement`
- **Impact:** No metric tracks how far behind each outbox processor is (oldest unprocessed `created_at` vs. now). If the outbox processor crashes, operators have no way to measure backlog without querying the database directly.
- **Fix:** Add a metric `outbox_oldest_pending_seconds{aggregate_type}` that computes `NOW() - MIN(created_at) WHERE processed_at IS NULL`.

---

### MEDIUM

**No health check for Redis**

- **Modules:** `core`
- **File:** `src/modules/health/health.controller.ts`
- **Impact:** Health check only pings the database. Redis failure (outbox processor connection, BullMQ queue, cache) is not detected. A Redis outage would silently break rate limiting, caching, and email queuing.
- **Fix:** Add Redis ping to the health check. Return degraded status if Redis is down but DB is up.

---

**No SLO/SLA definitions**

- **Modules:** All
- **Impact:** No latency SLO (e.g., p99 < 500ms for quiz submission), availability SLO (99.9%), or error rate SLO (error budget policy). Without these, there is no objective measure of production health.
- **Fix:** Define SLOs in a ` slo.yaml` file. Create Grafana dashboards and alerting rules for each SLO.

---

## 20. Alerting Gaps

### CRITICAL

**No alerting configuration**

- **Modules:** All
- **Impact:** Zero alert rules are configured. The following critical conditions have no automated alert:
  - Outbox DLQ rows > 0
  - Outbox lag > 5 minutes
  - DB connection pool exhaustion
  - Redis connection failure
  - High error rate (> 1% 5xx in 5 minutes)
  - Auth outbox infinite retry loop
  - Queue depth > 10,000 (email queue backup)
  - CPU > 80% for > 5 minutes
  - Memory > 85%
  - Disk > 90%
- **Fix:** Configure alerts in Alertmanager / PagerDuty for the above conditions. Map to severity: DLQ rows = P2, auth infinite retry = P1, DB/Radis down = P1.

---

### HIGH

**No on-call runbook**

- **Impact:** When an alert fires, engineers have no documented steps to diagnose and remediate. Common scenarios (outbox lag, DLQ buildup, Redis failure) require ad-hoc debugging.
- **Fix:** Create runbooks for each alert: steps to reproduce, common causes, mitigation scripts, escalation path.

---

## 21. Correlation ID Propagation

### LOW

**Correlation ID propagated in outbox processors, but not in BullMQ**

- **Modules:** `email`
- **File:** `src/modules/email/email.processor.ts`
- **Impact:** BullMQ jobs do not carry `correlationId` in their job data. If an email job fails, there is no way to trace it back to the originating HTTP request without correlating timestamps.
- **Fix:** Add `correlationId` to all BullMQ job data. Set `job.id = correlationId` when adding to queue.

---

### LOW

**Correlation ID not propagated to WebSocket handlers**

- **Modules:** `instance`, `notification`
- **Files:** `instance.gateway.ts`, `notification.gateway.ts`
- **Impact:** WebSocket messages do not carry or log correlation IDs. Tracing a WebSocket event back to the originating HTTP request (e.g., answer submission) is difficult.
- **Fix:** Include `correlationId` in the WebSocket message payload and log it on receipt.

---

## 22. Recovery Paths

### MEDIUM

**No circuit breaker for email provider**

- **Modules:** `email`
- **File:** `src/modules/email/email.processor.ts`
- **Impact:** If Resend API experiences sustained downtime, BullMQ will retry all failed jobs with exponential backoff. After 5 attempts (default), jobs are moved to the failed queue. No circuit breaker opens to stop flooding the failing service.
- **Fix:** Implement a circuit breaker (e.g., `opossum` library) with half-open state after 30 seconds. Open after 5 consecutive failures. Log circuit state transitions.

---

**No recovery path for stuck outbox events**

- **Modules:** `auth`, `ranking`, `achievement`
- **Impact:** An event in the outbox that is permanently failing (e.g., notification email address is permanently invalid) will eventually reach DLQ (ranking/achievement) or spin forever (auth). There is no manual intervention tooling to inspect, retry, or discard DLQ events.
- **Fix:** Add a CLI command `npm run outbox:inspect -- --event-id=X` and `npm run outbox:retry -- --event-id=X` for operational recovery. Add a degraded-mode flag to bypass failing handlers.

---

## 23. Reconciliation Jobs

### MEDIUM

**Quiz stats reconciliation — no scheduled job**

- **Modules:** `quiz`, `attempt`
- **Impact:** `quiz_stats.avg_score_percent` can drift from the true average due to the race condition in Section 1. There is no scheduled job to recompute and correct this drift.
- **Fix:** Add a nightly reconciliation job: for each quiz, `SELECT AVG(score_percent) FROM quiz_attempts WHERE quiz_id = X AND status = 'completed'` and update `quiz_stats.avg_score_percent` if delta > 0.01.

---

**XP mismatch reconciliation — manual only**

- **Modules:** `ranking`
- **File:** `src/modules/ranking/infrastructure/repositories/ranking.repository.ts`, lines 987–1057 (`findXpMismatches`)
- **Impact:** `findXpMismatches` is a diagnostic query that exists but is not scheduled. XP drift (from failed transactions, rounding errors, or bugs) accumulates silently.
- **Fix:** Schedule `findXpMismatches` to run daily. Auto-correct mismatches where `ABS(delta) < 1 XP`. Flag mismatches > 1 XP for manual review.

---

**Rank history reconciliation — no scheduled job**

- **Modules:** `ranking`
- **Impact:** `rank_history` is only populated on period resets and recalculations. If a recalculation is interrupted (see Section 1), some users have missing history entries with no scheduled correction.
- **Fix:** Add a weekly reconciliation job that detects users with no history entry for the current week and backfills from `user_ranking` snapshot.

---

## 24. Operational Tooling

### HIGH

**No CLI tool for operational tasks**

- **Impact:** The following operations require raw SQL queries against the database:
  - Inspect DLQ events
  - Retry a specific outbox event
  - Force a period reset for a user
  - Manually award/revoke a badge
  - Purge a specific user's sessions
  - Recompute quiz stats
  - Trigger leaderboard cache invalidation
- **Fix:** Add NestJS CLI commands in `src/commands/`:
  - `quiz:stats:reconcile [--quiz-id=X]`
  - `ranking:outbox:inspect [--aggregate-type=X]`
  - `ranking:outbox:retry --event-id=X`
  - `ranking:xp:reconcile [--user-id=X]`
  - `achievement:grant --user-id=X --badge-slug=Y`
  - `achievement:revoke --user-id=X --badge-slug=Y`
  - `session:revoke-all --user-id=X`
  - `cache:invalidate --pattern=X`

---

**No database migration rollback testing**

- **Modules:** `core`
- **File:** `src/core/database/migrations/`
- **Impact:** Migrations are tested only in the local development environment. Production migration failures (data type conflicts, constraint violations, lock timeouts on large tables) are not rehearsed.
- **Fix:** Add a staging environment that runs migrations automatically before each deployment. Use `drizzle-kit check` in CI. Test rollback of each migration on a production-sized dataset clone.

---

### MEDIUM

**Seed command has no `--dry-run` mode**

- **Modules:** `core`
- **File:** `src/commands/seed/`
- **Impact:** Running seeds in staging or production (even accidentally) modifies data with no preview. The command checks `NODE_ENV !== 'production'` but staging uses `NODE_ENV = 'staging'` which passes the check.
- **Fix:** Add `--dry-run` flag that prints what would be inserted. Rename the `ALLOW_PROD_SEED` env check to `ALLOW_SEED` and require explicit opt-in for non-dev environments.

---

## 25. Failure Scenarios

### CRITICAL

**Scenario: Quiz attempt completes → stats average drifts → dashboard shows wrong scores**

- **Root cause:** Race condition in `completeAttemptAndSideEffects` (Section 1, CRITICAL)
- **Detection:** Daily reconciliation job (missing — Section 23)
- **Mitigation:** Fix race condition with atomic SQL (Section 1 fix)
- **Recovery:** Run `quiz:stats:reconcile` CLI command

---

**Scenario: User earns badge → event emitted in-process → handler on wrong instance never fires → user never notified**

- **Root cause:** In-process event bus (Section 5, HIGH) + multi-instance deployment
- **Detection:** User complaint, no metric
- **Mitigation:** Achievement events need outbox coverage (Section 6 fix)
- **Recovery:** Manual badge award confirmation via `achievement:grant` CLI

---

**Scenario: Email verification token consumed → partial send → BullMQ retries → user receives duplicate verification email**

- **Root cause:** No idempotency in email processor (Section 3, CRITICAL)
- **Detection:** User complaint
- **Mitigation:** Add idempotency table (Section 3 fix)
- **Recovery:** Manually verify email in DB

---

**Scenario: Outbox processor crashes at row 500/1000 → badge evaluation continues on restart → badge awarded twice**

- **Root cause:** No cursor/watermark in deferred evaluation (Section 5, MEDIUM)
- **Detection:** Spike in duplicate badge awards (no alerting — Section 20)
- **Mitigation:** Add cursor table (Section 5 fix)
- **Recovery:** `achievement:revoke` CLI for affected users

---

**Scenario: Redis goes down → rate limiting stops → credential stuffing attack → accounts compromised**

- **Root cause:** No Redis health check + no Redis circuit breaker
- **Detection:** Spike in failed login attempts (no alerting — Section 20)
- **Mitigation:** Add Redis health check to `/health` endpoint. Add Redis circuit breaker in `RedisService`.
- **Recovery:** Restore Redis. Revoke compromised sessions via `session:revoke-all` CLI.

---

**Scenario: Admin changes user's email → no audit log → GDPR data subject request cannot be fulfilled**

- **Root cause:** Missing audit log for profile changes (Section 18, MEDIUM)
- **Detection:** Manual audit
- **Mitigation:** Add profile change audit log (Section 18 fix)

---

**Scenario: DLQ rows accumulate → auth outbox spins forever → disk fills → database goes down**

- **Root cause:** Auth outbox infinite retry (Section 6, HIGH) + no disk monitoring alerting (Section 20, CRITICAL)
- **Detection:** PagerDuty alert (missing — Section 20)
- **Mitigation:** Fix auth outbox DLQ handling (Section 6 fix)
- **Recovery:** `ranking:outbox:inspect` CLI → manually discard or fix events

---

**Scenario: Tournament with 50,000 participants → `finalizeTournament` OOM crash → tournament left in `ongoing` state forever**

- **Root cause:** Full table load in `finalizeTournament` (Section 1, HIGH)
- **Detection:** Tournament never transitions to `finished`
- **Mitigation:** Fix `finalizeTournament` to use batched SQL updates (Section 1 fix)
- **Recovery:** Manual tournament finalization via DB update + `tournament:finalize` CLI

---

# Classification Summary

## CRITICAL Risks

| #   | Finding                                                             | Modules                                  | Production Impact                               |
| --- | ------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| C1  | Quiz stats average race condition                                   | attempt, quiz                            | Corrupted average score data on popular quizzes |
| C2  | Missing transactions in 5 domains — events lost on crash            | notification, social, discussion, review | Silent data loss in multi-instance deployments  |
| C3  | Auth outbox infinite retry loop                                     | auth                                     | Poisoned events spin forever, disk pressure     |
| C4  | InstanceController has zero authentication                          | instance                                 | Unauthenticated users can disrupt live games    |
| C5  | Email processor has no idempotency                                  | email                                    | Duplicate verification emails, token double-use |
| C6  | Leaderboard cache is in-process Map — inconsistent across instances | ranking                                  | Different leaderboard rankings per instance     |

## HIGH Risks

| #   | Finding                                               | Modules                                                              | Production Impact                                              |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| H1  | Social getFriendsOfUser IDOR                          | social                                                               | Any user can read any user's friend list                       |
| H2  | Rank history duplicate risk on interrupted reset      | ranking                                                              | Duplicate or missing rank history entries                      |
| H3  | In-process event buses don't work cross-instance      | attempt, quiz, discussion, notification, social, review, achievement | Events emitted on one instance never reach handlers on another |
| H4  | Tournament finalize OOM on large tournaments          | tournament                                                           | Service crash on large tournaments, stuck in `ongoing` state   |
| H5  | No Prometheus metrics endpoint                        | all                                                                  | No observability of latency, error rates, queue depth          |
| H6  | DLQ rows accumulate with no alerting                  | ranking, achievement                                                 | Poisoned events silently accumulate                            |
| H7  | No alerting configuration whatsoever                  | all                                                                  | No automated detection of production incidents                 |
| H8  | Missing dirty-user index on user_ranking              | ranking                                                              | Full table scan on every rank recalculation                    |
| H9  | No operational CLI tooling                            | all                                                                  | Database modifications require raw SQL                         |
| H10 | Missing session revocation cross-instance propagation | auth                                                                 | Revoked sessions may remain valid on other instances           |
| H11 | No circuit breaker for email provider                 | email                                                                | Sustained API failures flood queue with retries                |
| H12 | Auth outbox has no DLQ state — events never die       | auth                                                                 | Permanent retry loop for exhausted events                      |

## MEDIUM Risks

| #   | Finding                                                                  | Modules                    | Production Impact                                               |
| --- | ------------------------------------------------------------------------ | -------------------------- | --------------------------------------------------------------- |
| M1  | Auth outbox, ranking outbox run on every instance — duplicate processing | auth, ranking, achievement | Wasted CPU, lock contention on outbox rows                      |
| M2  | Social blockUser/followUser lack unique constraints                      | social                     | Duplicate rows, race conditions                                 |
| M3  | Notification payload has no size constraint                              | notification               | Unbounded JSONB could bloat table                               |
| M4  | Missing Redis health check                                               | core                       | Redis failure not detected by health endpoint                   |
| M5  | Missing SLO definitions                                                  | all                        | No objective measure of production health                       |
| M6  | Notification analytics exposes platform-wide data                        | notification               | Admin can view aggregate notification data for all users        |
| M7  | Discussion trending cache invalidation missing                           | discussion                 | Stale trending data up to 2x TTL                                |
| M8  | Review moderation and badge revocation moderator-only gap                | review, achievement        | No moderator role for review/report actions                     |
| M9  | No quiz stats reconciliation scheduled job                               | quiz                       | Stats average drifts over time, no correction                   |
| M10 | XP mismatch reconciliation manual only                                   | ranking                    | XP drift accumulates silently                                   |
| M11 | HTTP email calls retry on 4xx errors                                     | email                      | Wasted queue capacity on permanent failures                     |
| M12 | Social feed recording has no retry                                       | social                     | Feed activity permanently lost on handler failure               |
| M13 | Audit log only covers auth events                                        | auth                       | Profile changes, badge revocations, review moderation untracked |
| M14 | Missing indexes: friendships, user_follows, tournament_participants      | social, tournament         | Slow social queries and participant counting                    |
| M15 | N+1 in discussion thread enrichment                                      | discussion                 | Extra query per thread when author not pre-loaded               |
| M16 | N+1 in social getFriendLeaderboard                                       | social                     | Multiple queries for friend rankings instead of batched         |
| M17 | Correlation ID missing from BullMQ job data                              | email                      | Email failures cannot be traced to originating request          |
| M18 | Seed command `--dry-run` missing                                         | core                       | Seeds can run in staging without preview                        |

## LOW Risks

| #   | Finding                                                      | Modules | Production Impact                                      |
| --- | ------------------------------------------------------------ | ------- | ------------------------------------------------------ |
| L1  | WsJwtGuard skips audience validation if env var undefined    | auth    | Tokens from other audiences may be accepted            |
| L2  | Audit log purge has no retention verification                | auth    | Silent accumulation if purge is broken                 |
| L3  | No Sentry/error tracker integration                          | all     | No automatic error aggregation and grouping            |
| L4  | No distributed tracing (Jaeger/Zipkin)                       | all     | No end-to-end request traces across services           |
| L5  | Prometheus endpoint only exists via log-based metrics design | all     | Metrics must be scraped from logs, not native counters |

---

# Pre-Production Checklist

## Must-Fix Before Launch

- [ ] **C4:** Add `@RequireAuth()` + `@ApiBearerAuth()` to `InstanceController`
- [ ] **C1:** Fix quiz stats average with atomic SQL UPDATE
- [ ] **C3:** Implement DLQ state for auth outbox (set `failed_at` on exhaustion)
- [ ] **C5:** Add idempotency table for email verification tokens
- [ ] **C6:** Replace in-process leaderboard cache with Redis
- [ ] **H5:** Add `/metrics` Prometheus endpoint
- [ ] **H7:** Configure alerting rules (PagerDuty/Alertmanager)
- [ ] **H9:** Implement operational CLI commands
- [ ] **H1:** Fix social `getFriendsOfUser` IDOR
- [ ] **H8:** Add `(is_dirty, updated_at)` index on `user_ranking`

## Must-Do Before Launch

- [ ] Configure Prometheus scraping and Grafana dashboards
- [ ] Configure PagerDuty alerting for P1/P2 alerts
- [ ] Run load test with 10,000+ concurrent users
- [ ] Test migration on production-sized dataset clone
- [ ] Define and publish SLOs (availability, latency p99, error rate)
- [ ] Create on-call runbooks for each P1/P2 alert
- [ ] Verify all env vars are in secrets manager (not `.env`)
- [ ] Verify `NODE_ENV=production` in all non-dev deployments
- [ ] Test multi-instance deployment (3 instances minimum)
- [ ] Verify Redis Sentinel or Cluster for HA

## Should-Fix Before Launch

- [ ] **M11:** Add retry filter to only retry 5xx, not 4xx
- [ ] **M7:** Add cache invalidation on discussion votes/comments
- [ ] **M9:** Add nightly quiz stats reconciliation job
- [ ] **M10:** Schedule XP mismatch reconciliation daily
- [ ] **M1:** Use `FOR UPDATE SKIP LOCKED` in outbox queries
- [ ] **M4:** Add Redis ping to health check
- [ ] **M2:** Add unique constraints for social relationships
- [ ] **M16:** Batch-load ranking data for friend leaderboard
- [ ] **L2:** Add row count check in audit log purge job

---

# Cleanup Plan

## Immediate (This Sprint)

1. Fix C4 (InstanceController auth), C1 (quiz stats race), C3 (auth DLQ), C5 (email idempotency), C6 (leaderboard cache)
2. Add Prometheus metrics endpoint (H5)
3. Configure PagerDuty alerts (H7)
4. Implement operational CLI (H9)

## Short-Term (Next Sprint)

1. Implement outbox for notification, social, discussion, review domains (H2, C2)
2. Add missing indexes (H8, M14)
3. Fix N+1 patterns (M15, M16)
4. Add Redis health check to `/health` (M4)
5. Add quiz stats and XP reconciliation jobs (M9, M10)

## Medium-Term (Next Quarter)

1. Replace in-process event buses with Kafka/RabbitMQ
2. Add circuit breakers for all external integrations
3. Define and publish SLOs with Grafana dashboards
4. Implement distributed tracing (Jaeger)
5. Add Sentry for error aggregation
6. Load test at 10x expected traffic
7. Add on-call runbooks for all P1/P2 alerts
