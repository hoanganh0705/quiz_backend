# Retry-Queue Dead-Letter Queue Runbook

> Operational guide for the retry-queue DLQ. The retry queue retries
> failed event-handler invocations; when an envelope exhausts its
> configured `maxAttempts`, it is moved to the corresponding tier's
> dead-letter list (`tier:<tier>:dlq`). Every five minutes, the
> `RetryQueueDrainScheduler` drains that list, persists each envelope
> to `dead_letter_events`, and re-enqueues it onto the live queue
> with `attempts: 1` reset.
>
> Scope: operational layer for `docs/audit/phase6-event-queue-background-job-audit.md`
> Finding F4. Depends on Phase 1 (handler-failure visibility) and
> Phase 2 (cron-job locking).

---

## What the DLQ is

Each tier of the retry queue has a companion DLQ list:

| Tier | Live queue key | DLQ key | Re-enqueue target |
| --- | --- | --- | --- |
| `attempt` | `tier:attempt:queue` | `tier:attempt:dlq` | `tier:attempt:queue` |
| `coin` | `tier:coin:queue` | `tier:coin:dlq` | `tier:coin:queue` |

When a handler throws, the retry engine increments `attempts` and
re-queues with backoff. Once `attempts` exceeds `maxAttempts`, the
envelope is `LPUSH`ed onto the tier's DLQ list and removed from the
live queue.

The DLQ is therefore a forensic buffer: every entry there has
already failed N times against its handler and is not retried by the
normal engine.

---

## What the drain does

Every five minutes, `RetryQueueDrainScheduler` runs on a single
replica (advisory lock key `common:cron:retry_queue_dlq_drain`,
TTL 600s). For each tier, it:

1. Reads `LLEN tier:<tier>:dlq` to populate the
   `quiz_retry_queue_dlq_size{tier=<tier>}` gauge.
2. `LPOP`s up to 100 envelopes from the DLQ.
3. For each envelope, inserts a row into `dead_letter_events`
   with the original payload, error message, attempts counter,
   tier, and the ISO timestamp of when the envelope was drained.
4. Re-enqueues the envelope onto the live queue with `attempts: 1`
   so the retry engine gives it a fresh chance.

The DLQ size gauge therefore always reflects "what has not yet been
drained into the DB". After a drain cycle the gauge reads 0 for
that tier; if it grows again between cycles, a downstream handler is
still failing.

---

## When to read this runbook

Alert on:

| Signal | Threshold | Page |
| --- | --- | --- |
| `quiz_retry_queue_dlq_size{tier="attempt"}` > 0 for 30 min | Drain is not catching up, or the engine is re-failing rapidly | On-call |
| `quiz_retry_queue_dlq_size{tier="coin"}` > 0 for 30 min | Same for the coin tier | On-call |
| `dead_letter_events` row insert rate spike | A single event type is repeatedly failing | Engineering |

A non-zero DLQ is not itself an outage — the engine keeps working
on the live queue. Treat it as a forensic signal: every entry there
is an event that has already failed at least once against its
handler.

---

## Pre-flight

Before debugging the DLQ:

1. **Confirm the drain scheduler is running.** Check the metric
   `quiz_retry_queue_dlq_size` is being updated. If it is stuck at
   a stale value, the scheduler is not running on any replica.
2. **Confirm `dead_letter_events` exists.**
   ```bash
   pnpm db:check
   ```
   The output should list the dead-letter migration as applied.
   If not, run `pnpm db:migrate` first.
3. **Confirm the Redis circuit is closed.** Open circuit returns
   `-1` from the gauge and is logged as a `retry_queue_dlq_probe_circuit_open`
   counter increment. If the circuit is open, address the Redis
   outage before triaging DLQ entries — the drain cannot LPOP.

---

## Triage

### 1. Sample the DLQ contents

Pull the most recent 10 drained entries for the affected tier:

```sql
SELECT id, tier, error_message, attempts, drained_at
FROM   dead_letter_events
WHERE  tier = $1
ORDER  BY drained_at DESC
LIMIT  10;
```

The `error_message` is the same string the live queue recorded when
the handler threw. Cross-reference with the handler's logs from the
same window.

### 2. Group by error signature

```sql
SELECT error_message, COUNT(*) AS occurrences
FROM   dead_letter_events
WHERE  drained_at > now() - interval '1 hour'
GROUP  BY error_message
ORDER  BY occurrences DESC
LIMIT  20;
```

A single dominant error signature usually points at:

- A regression in a single handler (most common).
- A downstream service outage that the handler cannot retry
  through (DB pool exhaustion, third-party API down).
- A schema/code mismatch where the handler deserialises an event
  shape that no longer exists.

### 3. Compare with the live-queue error rate

A growing DLQ alongside a healthy live queue means the engine is
correctly absorbing failures — investigate the handler. A growing
DLQ alongside a growing live-queue error rate means the engine is
the bottleneck and Phase 1 metrics should also be alarming.

---

## Common failure modes

| Symptom | Likely cause | Action |
| --- | --- | --- |
| DLQ size climbs monotonically, never resets to 0 between cycles | Drain scheduler not running, or Redis LPOP is failing on every replica | Check scheduler logs for `acquired: false` (lock contention — only one replica should drain). Check Redis logs for `READONLY` or `LOADING` errors. |
| DLQ size stays at 0 but `dead_letter_events` insert rate is high | Drain is running and persisting, but the live queue is processing them on first attempt (i.e. transient failure has healed) | No action — the system recovered. Confirm `retry_queue_engine_failures_total` is also falling. |
| All entries have the same `error_message` for the past hour | A single handler regression | Roll back the recent handler deploy; entries already in the DLQ will be re-processed on the next drain. |
| `error_message` is `null` or empty | Handler threw a non-Error (e.g. `throw 'bad'`) | Inspect the handler source; the retry engine cannot capture a stack trace for non-Error throws. |
| `drained_at` is in the future relative to `now()` | DB clock skew | Fix the DB clock; do not edit `drained_at` manually. |

---

## Manual re-enqueue

If the engine has been paused or a single envelope needs to be
re-tried immediately, the drain scheduler will pick it up on the
next 5-minute tick. To force an immediate drain (e.g. during
incident response), invoke the scheduler from a one-off Node
process:

```bash
pnpm ts-node -r tsconfig-paths/register \
  -e "import('src/common/events/retry-queue-drain.scheduler').then(m => m.RetryQueueDrainScheduler.prototype.runOnce.call(new m.RetryQueueDrainScheduler(/* deps */)))"
```

> The drain is idempotent: LPOP + DB insert + LPUSH. Re-running is
> safe; entries already in `dead_letter_events` simply get a second
> row.

For surgical re-enqueue of a single envelope (skipping the DB
record), use Redis directly:

```bash
redis-cli LPOP tier:attempt:dlq | \
  jq '.payload' | \
  redis-cli LPUSH tier:attempt:queue
```

This bypasses the dead-letter persistence. Only do this if you are
confident the envelope is safe to retry without the forensic row.

---

## Cleanup

The `dead_letter_events` table grows monotonically. A periodic
retention job (not currently shipped) should prune rows older than
the operational retention window (suggested: 30 days). Until that
job exists, prune manually:

```sql
DELETE FROM dead_letter_events
WHERE drained_at < now() - interval '30 days';
```

Run during a low-traffic window; the DELETE locks rows but does
not block reads.

---

## References

- `src/common/events/retry-queue-drain.scheduler.ts` — the drain
  scheduler this runbook documents.
- `src/core/redis/retry-queue.metrics.ts` — the gauge and circuit
  integration.
- `src/core/database/migrations/0001-dead-letter-events.ts` — the
  schema migration that creates `dead_letter_events`.
- `src/core/database/schema/dead-letter/schema.ts` — Drizzle schema
  for `dead_letter_events`.
- `docs/audit/phase6-event-queue-background-job-audit.md` — the
  audit whose Finding F4 motivates this work.
- `docs/audit/phase7-event-queue-remediation-plan.md` — the
  remediation plan (Phase 3 = this runbook).
