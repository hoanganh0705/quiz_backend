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

---

### MEDIUM

**Missing security headers**

- **Modules:** All
- **File:** `src/main.ts`
- **Impact:** `helmet()` is called but `contentSecurityPolicy: false` when Swagger is enabled. This means no security headers are set in development/staging environments where Swagger is enabled. Missing headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`.
- **Fix:** Set explicit security headers regardless of Swagger state. Use `contentSecurityPolicy: false` only for the Swagger-specific CSP directive, not all headers.

---

### LOW

**`WsJwtGuard` — undefined audience silently skipped**

- **Modules:** `auth`
- **File:** `src/common/guards/ws-jwt.guard.ts`, line 29
- **Impact:** If `JWT_ACCESS_TOKEN_AUDIENCE` env var is undefined, `verifyAsync` receives `undefined` and skips audience validation. A token issued for a different audience could be accepted.
- **Fix:** Throw at startup if `JWT_ACCESS_TOKEN_AUDIENCE` is not set, or validate audience explicitly before calling `verifyAsync`.

---

## 17. Privilege Escalation Paths

### LOW

**No privilege escalation paths found.**

## The codebase has no path for a regular user to elevate to moderator or admin. The `QuizPolicy`, `AttemptCommandService`, and `AttemptQueryService` all enforce ownership and role checks. JWT payload validation (`isUserRole`) prevents tampering. The only concern is the IDOR in social `getFriendsOfUser` (Section 15, HIGH) which is a data access issue, not an elevation issue.

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

**No health check for Redis**

- **Modules:** `core`
- **File:** `src/modules/health/health.controller.ts`
- **Impact:** Health check only pings the database. Redis failure (outbox processor connection, BullMQ queue, cache) is not detected. A Redis outage would silently break rate limiting, caching, and email queuing.
- **Fix:** Add Redis ping to the health check. Return degraded status if Redis is down but DB is up.

---

### INFO

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

---

## 23. Reconciliation Jobs

### INFO

**Quiz stats reconciliation — no scheduled job**

- **Modules:** `quiz`, `attempt`
- **Impact:** `quiz_stats.avg_score_percent` can drift from the true average due to the race condition in Section 1. There is no scheduled job to recompute and correct this drift.
- **Fix:** Add a nightly reconciliation job: for each quiz, `SELECT AVG(score_percent) FROM quiz_attempts WHERE quiz_id = X AND status = 'completed'` and update `quiz_stats.avg_score_percent` if delta > 0.01.

---

**XP mismatch reconciliation — manual only**

- **Modules:** `ranking`
- **File:** `src/modules/ranking/infrastructure/repositories/ranking.repository.ts`, lines 987–1057 (`findXpMismatches`)
- **Impact:** `findXpMismatches` is a diagnostic query that exists but is not scheduled. XP drift (from failed transactions, rounding errors, or bugs) accumulates silently.
  Fix:
  Run `findXpMismatches` daily and alert on any detected mismatch.
  Provide an administrative reconciliation workflow to investigate and repair affected users.
  Avoid automatic correction to prevent masking underlying data consistency bugs.

---

**Rank history reconciliation — no scheduled job**

- **Modules:** `ranking`
- **Impact:** `rank_history` is only populated on period resets and recalculations. If a recalculation is interrupted (see Section 1), some users have missing history entries with no scheduled correction.
- **Fix:** Add a weekly reconciliation job that detects users with no history entry for the current week and backfills from `user_ranking` snapshot.

---

## 24. Operational Tooling

### INFO

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

### INFO

**Seed command has no `--dry-run` mode**

- **Modules:** `core`
- **File:** `src/commands/seed/`
- **Impact:** Running seeds in staging or production (even accidentally) modifies data with no preview. The command checks `NODE_ENV !== 'production'` but staging uses `NODE_ENV = 'staging'` which passes the check.
- **Fix:** Add `--dry-run` flag that prints what would be inserted. Rename the `ALLOW_PROD_SEED` env check to `ALLOW_SEED` and require explicit opt-in for non-dev environments.
