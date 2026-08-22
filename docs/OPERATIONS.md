# OPERATIONS.md

> Audience: on-call engineers, SREs, and anyone running the Quiz backend
> in production. For local development and first-run setup, see
> `docs/runbooks/local-bootstrap.md`.

This document is the operations manual for the Quiz backend. It assumes
the application is containerised and deployed to a managed environment
(AWS ECS Fargate, GCP Cloud Run, Kubernetes, …). The principles here
are environment-agnostic; the concrete examples use Docker Compose and
Kubernetes snippets.

---

## 1. Quick Reference

| Concern | Where to look |
| --- | --- |
| **Health check endpoint** | `GET /api/v1/health` (Kubernetes `/healthz` ready probe) |
| **Liveness** | `GET /api/v1/health/live` |
| **Metrics (Prometheus)** | `GET /api/v1/metrics` |
| **OpenAPI / Swagger** | `GET /api/v1/docs` (disabled in production by default) |
| **Logs** | stdout JSON; shipped to your log aggregator via your platform's log driver |
| **Container image** | `ghcr.io/<org>/quiz-backend:<sha>` |
| **Main config file** | `.env` (validated at boot by `validateEnv()`) |

If something is on fire, jump to **§6 Incident Response** below.

---

## 2. Architecture at a Glance

```
                    ┌──────────────────────────┐
   users ──► HTTPS ─┤   Cloudflare/F5/GCP LB   │
                    └──────────────┬───────────┘
                                   │
                    ┌──────────────▼───────────┐
                    │  NestJS Application Pod  │
                    │  (3 replicas, HPA: 3-12) │
                    │                          │
                    │   ┌─ Postgres Adapter ─┐ │
                    │   ├─ Redis Adapter ────┤ │
                    │   ├─ Cloudinary Adapter┤ │
                    │   ├─ BullMQ Worker ────┤ │
                    │   └─ Outbox Processor ─┤ │
                    └─┬───────┬──────┬──────┬─┘
                      │       │      │      │
                      ▼       ▼      ▼      ▼
                  Postgres  Redis  Cloud.  Resend
                  (RDS)     (ElastiCache) (SMTP)
```

Three logical layers (the application pod has all three inside one
container for simplicity):

1. **HTTP layer.** Controllers, request validators, rate limiters.
2. **Worker layer.** BullMQ consumes the email-queue and runs the
   outbox processor; emits domain events to in-process subscribers.
3. **Storage / cache layer.** Postgres (single primary, optional
   read-replica), Redis (sessions, cache, rate-limit counters,
   stampede locks), Cloudinary (uploads).

See [`quiz_backend/docs/architecture/overview.md`](architecture/overview.md)
for the module map.

---

## 3. Environment Variables

All variables are validated at startup by `validateEnv()`. Missing or
malformed values cause the app to **fail to boot** with a descriptive
error. The source of truth is
`quiz_backend/src/core/config/env.validation.ts`.

The variables are grouped below by purpose.

### 3.1 Required (no default)

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection URL. `postgres://` or `postgresql://`. | `postgres://app:<pw>@quizdb.cluster.amazonaws.com:5432/quizdb` |
| `REDIS_URL` | Redis connection URL. `redis://` or `rediss://`. | `redis://quizredis.cache.amazonaws.com:6379` |
| `JWT_ACCESS_TOKEN_SECRET` | HMAC secret for access JWTs (≥256 bits). | (use `openssl rand -base64 32`) |
| `JWT_REFRESH_TOKEN_SECRET` | HMAC secret for refresh JWTs — **must differ** from above. | (use `openssl rand -base64 32`) |
| `RESEND_API_KEY` | API key for the email provider. | `re_xyz` |
| `CLOUDINARY_API_KEY` | Cloudinary API key (server-only). | (from Cloudinary console) |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (server-only). | (from Cloudinary console) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name. | `myorg-prod` |

### 3.2 Required (with defaults)

| Variable | Description | Default |
| --- | --- | --- |
| `NODE_ENV` | Runtime environment | `development` (set to `production` for prod) |
| `PORT` | HTTP port | `3000` (we use `8080`) |
| `ACCESS_TOKEN_EXPIRES_IN` | Access token TTL | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token TTL | `7d` |
| `REFRESH_TOKEN_COOKIE_MAX_AGE_MS` | Refresh cookie max-age | `604800000` (7d) |
| `MAX_ACTIVE_SESSIONS_PER_USER` | Per-user session cap | `5` |
| `REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS` | Reuse-detection window | `10` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `TRUST_PROXY` | Trust `X-Forwarded-*` from LB | `false` (set `true` behind a proxy) |
| `APP_NAME`, `APP_VERSION`, `APP_URL`, `APP_DESCRIPTION` | OpenAPI metadata | — |

### 3.3 Redis circuit breaker (Phase 2)

| Variable | Description | Default |
| --- | --- | --- |
| `REDIS_CIRCUIT_FAILURE_THRESHOLD` | Failures before the circuit opens | `5` |
| `REDIS_CIRCUIT_RESET_TIMEOUT_MS` | How long the circuit stays open | `30000` (30 s) |

The circuit is **fail-open**: when open, the API keeps serving
requests; cache reads degrade to direct fetches, rate-limits loosen.
See ADR-0023 and §6.4 below.

### 3.4 Postgres pool (Phase 1)

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_POOL_MAX` | Max connections per pod | `10` |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | Idle connection timeout | `30000` |
| `DATABASE_POOL_CONNECTION_TIMEOUT_MS` | Connect timeout | `10000` |
| `DATABASE_POOL_STATEMENT_TIMEOUT_MS` | Per-statement timeout | `30000` |

Set `DATABASE_POOL_MAX=5` when running behind PgBouncer (the default
10 is tuned for direct Postgres).

### 3.5 Email queue (BullMQ)

| Variable | Description | Default |
| --- | --- | --- |
| `EMAIL_QUEUE_CONCURRENCY` | BullMQ worker concurrency | `5` |
| `EMAIL_SEND_TIMEOUT_MS` | Resend HTTP call timeout | `5000` |

---

## 4. Deployment

### 4.1 Container image

The `Dockerfile` is multi-stage: build stage compiles TypeScript with
`pnpm`, runtime stage copies the compiled output and runs as a
non-root user. The final image is ~250 MB.

```bash
docker build -t quiz-backend:<git-sha> .
docker push ghcr.io/<org>/quiz-backend:<git-sha>
```

### 4.2 Recommended production shape

| Component | Sizing | Notes |
| --- | --- | --- |
| Application pods | 3 replicas minimum, HPA 3-12 | 1 vCPU / 1 GB RAM each is sufficient for ~100 rps sustained |
| Postgres | RDS `db.r6g.large` or equivalent | 8 vCPU / 16 GB RAM, 100 GB SSD, 7-day PITR |
| Redis | ElastiCache `cache.r6g.large` | 2 vCPU / 13 GB RAM, single-AZ is fine (sessions are sticky); multi-AZ if you need HA |
| Cloudinary | Free tier suffices up to ~25 GB | Pre-paid plans for higher volume |
| SMTP (Resend) | Pay-as-you-go | 100 emails/day free |

### 4.3 First-boot checklist

When deploying a new environment:

1. **Generate JWT secrets.** `openssl rand -base64 32` for each of
   `JWT_ACCESS_TOKEN_SECRET` and `JWT_REFRESH_TOKEN_SECRET`. Store in
   the secret manager (AWS Secrets Manager, GCP Secret Manager, …).
2. **Create the database.** `CREATE DATABASE quizdb;` then run
   `pnpm db:migrate` from a temporary pod. After migration, delete the
   temporary pod.
3. **Seed the foundation.** `pnpm db:seed:foundation` loads roles,
   permissions, and base taxonomy. **Idempotent** — safe to re-run.
4. **Verify email sending.** Trigger a `forgot-password` for a test
   account from the deployed backend and confirm the email arrives.
5. **Smoke probe.** Run `scripts/smoke.sh` against the deployed URL
   (`SMOKE_BASE_URL=https://quiz.example.com bash scripts/smoke.sh`).
6. **Confirm metrics.** `curl -s https://quiz.example.com/api/v1/metrics | grep http_request_duration_seconds_count`
   should return a non-zero count.

### 4.4 Blue/green and rollbacks

The container image is immutable. Every release is a new image with a
new tag; the orchestrator swaps traffic atomically.

**Rollback procedure:**

```bash
# Find the previous revision
kubectl rollout history deploy/quiz-backend -n quiz
# Roll back
kubectl rollout undo deploy/quiz-backend -n quiz
# Watch
kubectl rollout status deploy/quiz-backend -n quiz
```

State is in Postgres and Redis; both retain data across rollbacks.
Migrations are forward-only — a rollback that requires a migration
reverse is **not supported**. If you ship a destructive migration,
plan the rollback before merge.

---

## 5. Scaling

### 5.1 Horizontal pod autoscaling

Scale on a CPU target of `60%` *or* an RPS target of `100 rps/pod`,
whichever fires first. The `/metrics` endpoint exposes the
`http_request_duration_seconds` histogram so your HPA can use
Prometheus adapter if you need latency-aware scaling.

```yaml
# HPA snippet (Kubernetes)
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
```

Recommended pod ceiling: **12 replicas**. Above that, investigate a
hot-row problem before scaling out (see ADR-0020).

### 5.2 Postgres

The connection pool is **per pod**, so total connections =
`replicas × DATABASE_POOL_MAX`. With `DATABASE_POOL_MAX=10` and
12 replicas, that's 120 connections. RDS `db.r6g.large` defaults to
`max_connections=673`; plenty of headroom.

When the connection budget tightens:

1. Lower `DATABASE_POOL_MAX` per pod and route through PgBouncer in
   transaction mode.
2. Move read-heavy endpoints to the read-replica pool (ADR + work
   item in Phase 7).

### 5.3 Redis

Redis is single-threaded; one ElastiCache node can sustain ~100 k
ops/sec. The Quiz backend's Redis usage is dominated by the
read-through cache and rate-limit counters.

If Redis CPU is consistently above 60%, **scale up** the node rather
than out — Redis does not benefit from clustering for our workload.

### 5.4 BullMQ workers

The email worker runs inside the application pod (one process per
pod). For high email volume, split the worker into its own deployment:

```yaml
# worker deployment
containers:
  - name: worker
    image: ghcr.io/<org>/quiz-backend:<sha>
    command: ["node", "dist/main-worker.js"]
    envFrom: [...same as API...]
```

This isolates the email queue's CPU and memory from HTTP latency.

### 5.5 What **not** to autoscale

- **Outbox listener.** One per cluster. The 30-second fallback poll
  protects against a missing listener.
- **Cron-scheduled jobs** (`@nestjs/schedule`). One per cluster.
  Multiple replicas duplicate work; rely on at-least-once consumers.

---

## 6. Incident Response

The on-call engineer's job is to **detect, mitigate, and post-mortem**.
The application is designed so user-facing 5xx is the last resort.

### 6.1 On-call triage checklist

Within the first 5 minutes of a Sev-2+ page:

1. **Check the dashboard.** Grafana board for Quiz-backend shows
   request rate, latency percentiles, error rate, and Redis circuit
   state. Most incidents have a one-line root cause.
2. **Check the health endpoint.**
   `curl -s https://quiz.example.com/api/v1/health | jq .`
   Returns dependency statuses; the failing dependency is named.
3. **Check logs for the request ID.** Most error responses include an
   `X-Request-Id` header; copy it and grep the log aggregator.
4. **Look at the error filter output.** `trace_id` correlates logs
   across the request lifecycle; paste into the search.
5. **Decide: fix forward or roll back.** If the cause is known and
   the fix is small, ship it. Otherwise, roll back (see §4.4).

### 6.2 Common incidents and responses

#### API is returning 503 from `/health`

`/health` returns 503 if any of Postgres, Redis, Cloudinary, or the
email queue is unhealthy. Inspect `health.dependencies.<name>.status`:

```json
{
  "status": "down",
  "dependencies": {
    "postgres": { "status": "down", "message": "connection refused" },
    "redis":    { "status": "up" },
    "storage":  { "status": "up" }
  }
}
```

The dependency name tells you where to look.

#### Latency spikes (p99 > 800 ms)

| Suspect | Quick check |
| --- | --- |
| Postgres | `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 seconds';` to find long-running queries. |
| Redis | Look for `redis_circuit_state{state="open"} > 0`. |
| Hot-row lock | Look for `instance_optimistic_lock_conflicts_total` counter (a high rate means a lot of retries — usually a quiz room stuck). |
| Outbox lag | `bullmq_queue_depth > 100` or `outbox_lag_seconds > 5` mean downstream is behind. |
| Cold start | Newer autoscaling events + first-request latency column. |

#### Refreshing tokens returns 401 en masse

Almost always the **JWT secret has rotated** without invalidating
sessions, OR the **refresh token DB** has been wiped. Check
`auth_audit_logs` for `event_type = 'refresh_token_reuse_detected'`,
which means an attacker is replaying a stolen token.

#### Email queue is backing up

`bullmq_queue_depth > 100` is the symptom. Look for:

- Resend rate-limit (free tier = 100/day; check `EMAIL_SEND_TIMEOUT_MS`).
- A poison message (retry exhausted). Inspect `/api/v1/health` → `emailQueue.failed`.
- BullMQ worker is not running (replica crash). Restart pod.

#### Redis circuit breaker is open

The state gauge `redis_circuit_state{state="open"}` confirms. In this
state the application continues to serve requests; cache reads
degenerate to direct fetches (extra Postgres load) and rate-limits
loosen. The breaker re-tries every `REDIS_CIRCUIT_RESET_TIMEOUT_MS`.

To shorten the recovery time, restart Redis (failure is usually
transient — full Redis state is in-memory so verify ElastiCache
metrics before forcing failover).

### 6.3 Database disaster recovery

- **Point-in-time recovery.** RDS PITR is configured to 7 days. To
  restore to a specific timestamp:
  1. `aws rds restore-db-instance-to-point-in-time …`
  2. Update the secret for `DATABASE_URL`.
  3. Trigger a rolling restart of the application pods.
- **Migration accident.** Migrations are forward-only. If a migration
  is destructive and must be reversed, write a *compensating*
  migration in the next sprint. Do not edit migration history.

### 6.4 Severity ladder

| Severity | Definition | On-call response | Customer communication |
| --- | --- | --- | --- |
| Sev-1 | Service unreachable or all requests erroring | Page, wake the team | Status page within 15 min |
| Sev-2 | Partial outage (one region, one feature) | Page within 30 min | Status page within 1 h |
| Sev-3 | Degraded performance, single endpoint slow | Email/ticket | No communication |
| Sev-4 | Cosmetic / minor bug | Next business day | None |

---

## 7. Observability

### 7.1 Logs

Structured JSON via Pino. Every request emits an `http_access` log
with `traceId`, `requestId`, `userId` (if authenticated), and the
canonical timing. Cross-reference log lines via `traceId`.

### 7.2 Metrics

`GET /api/v1/metrics` exposes the following (Prometheus format):

| Metric | Type | Use |
| --- | --- | --- |
| `http_request_duration_seconds` | histogram | p50/p95/p99 latency |
| `http_requests_total` | counter | Request rate by status |
| `db_query_duration_seconds` | histogram | Postgres slow-query alerting |
| `redis_circuit_state` | gauge | Redis breaker health |
| `bullmq_queue_depth` | gauge | Email worker backlog |
| `outbox_lag_seconds` | gauge | Time from event commit to dispatch |
| `tracing_active_spans` | gauge | In-flight span count |

### 7.3 Tracing

Custom OpenTelemetry-compatible tracing. The `/metrics` endpoint
includes a `tracing_active_spans` gauge; alerting on that number
prevents memory bloat from span leaks.

For W3C `traceparent` propagation through the cluster, pass the
header from the load balancer (`X-Forwarded-For` is not enough —
the `traceparent` header is propagated by the LB anyway).

### 7.4 Alerting guide

Suggested alert rules (PromQL):

```promql
# Latency p99 > 1s for 5 min
histogram_quantile(0.99, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m]))) > 1

# Error rate > 1% for 5 min
sum(rate(http_requests_total{status=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m])) > 0.01

# Redis circuit open for > 1 min
redis_circuit_state{state="open"} == 1

# Outbox lag > 30 s (means LISTEN/NOTIFY is broken AND fallback poll is behind)
outbox_lag_seconds > 30

# Email queue depth > 100 for 10 min
bullmq_queue_depth > 100
```

---

## 8. On-call Rotation Hints

- **Two-person rotation.** Primary and secondary. Secondary is paged
  if primary doesn't ack within 5 minutes.
- **Shift length.** One week (Monday 09:00 → Monday 09:00 UTC). Long
  enough to learn the codebase, short enough to keep current.
- **Hand-off doc.** The primary writes a hand-off note in the
  `#ops-handoff` channel by Sunday 18:00: any open incidents, recent
  changes, abnormal behaviour observed.
- **Escalation.** Tech lead is paged if the on-call cannot mitigate
  within 30 minutes.
- **Run-of-show.** Page on-call via PagerDuty (or equivalent).
  Sev-1 wakes the tech lead directly.

---

## 9. Security Operations

### 9.1 Secret rotation

- **JWT secrets.** Rotating either JWT secret invalidates *all*
  tokens. Coordinate with a planned logout-all-sessions.
  ```bash
  # Rotate access-token secret
  # 1. Generate new secret
  NEW_SECRET=$(openssl rand -base64 32)
  # 2. Update the secret manager
  aws secretsmanager update-secret --secret-id quiz/jwt-access-secret --secret-string "$NEW_SECRET"
  # 3. Redeploy. All users are logged out by this.
  ```
- **Cloudinary keys.** Cloudinary supports a rolling API key; create
  a new key, deploy with both keys, retire the old key after a grace
  period.
- **Resend API key.** Same pattern — generate, deploy, retire.

### 9.2 Audit log retention

The `auth_audit_logs` table grows by ~10 k rows/day for a busy
deployment. A nightly retention job (see Phase 7 #4) deletes rows
older than 90 days. To extend retention, change the constant in the
retention service.

### 9.3 Rate limits (rules of thumb)

- Public endpoints (login, register, password-reset): 60 rps/IP with
  burst 100.
- Authenticated endpoints: 10 rps/user with burst 30.
- The limits live in `src/modules/auth/config/throttle.constants.ts`
  and are exposed via `/api/v1/health/throttle-stats` (TODO when
  implemented).

---

## 10. Operations Playbook

### 10.1 Adding a new ENV var

1. Add the schema entry to `src/core/config/env.validation.ts`.
2. Add the default to `.env.example` with a comment.
3. Update `core/config/<area>.config.ts` to consume it.
4. Update this OPERATIONS.md if the variable is operator-facing.
5. Document in the next release notes.

### 10.2 Adding a new module

1. Pick a directory under `src/modules/<name>/`.
2. Follow the four-layer pattern: `transport` → `application` →
   `domain` → `infrastructure`. See ADR-0010.
3. Define ports in `domain/ports.ts` and implement adapters in
   `infrastructure/`. See ADR-0018.
4. Add a `module.ts` that wires the providers.
5. Register the module in `app.module.ts`.
6. Write at least one application-service unit test and one E2E
   scenario.
7. Add to the OpenAPI generation.

### 10.3 After a deploy

1. Watch `http_request_duration_seconds` for the route you
   touched. Verify p99 hasn't regressed by >20%.
2. Check `http_requests_total{status="5xx"}` for new errors.
3. Verify `/api/v1/health` still returns `up`.
4. If you rolled out a database migration, check that
   `db_query_duration_seconds` is stable; a sudden jump suggests a
   missing index.

---

_Last regenerated: 2026-08-19 against `quiz_backend/package.json` on
branch `main`._
