/// <reference types="node" />
/**
 * Outbox recovery CLI.
 *
 * Operational tooling for the `outbox_events` table that backs
 * the auth, ranking, and achievement outbox processors. The
 * table has three lifecycle states an operator needs to be
 * able to inspect and act on:
 *
 *   1. **Live / unprocessed** — `processedAt IS NULL`,
 *      `failedAt IS NULL`. The processor will pick it up.
 *   2. **Retry-pending** — `processedAt IS NULL`,
 *      `failedAt IS NULL`, `nextAttemptAt > now`. The
 *      processor will skip it until the back-off window
 *      elapses.
 *   3. **Dead-letter** — `processedAt IS NULL`,
 *      `failedAt IS NOT NULL`, `dlqReason IS NOT NULL`. The
 *      processor skips it permanently. This is the bucket
 *      the audit called out as needing manual recovery.
 *
 * Subcommands (selected via `process.argv[2]`, mirroring
 * the existing `pnpm db:seed:*` pattern):
 *
 *   - `inspect` — show events by id, by status, or list DLQ.
 *   - `retry`   — clear `failedAt` / `dlqReason` and reset
 *                 `attemptCount` / `nextAttemptAt` so the
 *                 processor re-attempts on its next tick.
 *   - `discard` — mark an event as operator-rejected with
 *                 a permanent `dlqReason` so the processor
 *                 never picks it up again. (Used when the
 *                 root cause is the *payload* — e.g. a
 *                 permanently invalid email address — and
 *                 retrying would just thrash the DLQ.)
 *
 * All three are bounded to one row by default (operations
 * usually act on a single event_id surfaced by the DLQ
 * monitor alert) but accept `--all` on `retry` / `discard`
 * for the rare bulk-recovery case.
 *
 * Production safety
 * -----------------
 * Like the seed commands, the CLI refuses to run in
 * production unless `ALLOW_PROD_OUTBOX_OPERATIONS=true`.
 * The outbox is the source of truth for auth security
 * notifications, so an accidental bulk-retry in a real
 * production environment would replay password-reset
 * emails and similar side effects.
 */

import 'dotenv/config';
import { and, desc, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { db, requireEnv, closePool } from './db-client';
import { outboxEvents } from '@/core/database/schema';

type RecoveryAction = 'retry' | 'discard';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

const ALLOW_PROD_ENV_VAR = 'ALLOW_PROD_OUTBOX_OPERATIONS';

function refuseInProduction(): void {
  if (isProduction() && process.env[ALLOW_PROD_ENV_VAR] !== 'true') {
    throw new Error(
      `Refusing to run outbox operations in production. Set ${ALLOW_PROD_ENV_VAR}=true to override.`,
    );
  }
}

/**
 * Parse a `key=value` flag from `process.argv`. Supports
 * both `--key=value` and `--key value` forms (the latter
 * only for a small allow-list of flags). Positional
 * arguments are returned separately so the caller can
 * distinguish "the user passed a UUID" from "the user
 * passed --event-id <UUID>".
 */
function parseFlags(argv: readonly string[]): {
  flags: Record<string, string | boolean>;
  positional: string[];
} {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) break;

    if (arg.startsWith('--')) {
      const body = arg.slice(2);
      const eqIdx = body.indexOf('=');
      if (eqIdx >= 0) {
        const key = body.slice(0, eqIdx);
        const value = body.slice(eqIdx + 1);
        flags[key] = value;
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[body] = next;
          i += 1;
        } else {
          flags[body] = true;
        }
      }
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

type OutboxRow = typeof outboxEvents.$inferSelect;

function formatRow(row: OutboxRow): string {
  // The payload can contain user-supplied data (e.g. email
  // addresses, user IDs); render it as JSON for readability
  // but keep the row on a single line so an operator can
  // pipe the output to `grep` / `awk` without re-parsing
  // multi-line blobs.
  return JSON.stringify({
    eventId: row.eventId,
    aggregateType: row.aggregateType,
    eventType: row.eventType,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt,
    lastAttemptAt: row.lastAttemptAt,
    nextAttemptAt: row.nextAttemptAt,
    failedAt: row.failedAt,
    dlqReason: row.dlqReason,
    lastError: row.lastError,
    correlationId: row.correlationId,
    payload: row.payload,
  });
}

async function inspect(args: readonly string[]): Promise<void> {
  const { flags, positional } = parseFlags(args);
  const limit = Number(flags.limit ?? 50);
  const boundedLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 50;

  const status = typeof flags.status === 'string' ? flags.status : null;
  const eventIdFlag = typeof flags['event-id'] === 'string' ? flags['event-id'] : null;
  const aggregateFlag = typeof flags.aggregate === 'string' ? flags.aggregate : null;
  const positionalEventId = positional.find(isUuid) ?? null;
  const eventId = eventIdFlag ?? positionalEventId;

  if (eventId !== null) {
    if (!isUuid(eventId)) {
      throw new Error(`--event-id must be a UUID, got: ${eventId}`);
    }
    const rows = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.eventId, eventId))
      .limit(1);

    if (rows.length === 0) {
      console.log(`(no event with event_id=${eventId})`);
      return;
    }
    console.log(formatRow(rows[0]));
    return;
  }

  // Status filter. Mapping is explicit so a typo in the flag
  // fails fast rather than silently returning everything.
  let whereClause;
  if (status === 'dlq') {
    whereClause = and(isNull(outboxEvents.processedAt), isNotNull(outboxEvents.failedAt));
  } else if (status === 'live') {
    whereClause = and(
      isNull(outboxEvents.processedAt),
      isNull(outboxEvents.failedAt),
      lte(outboxEvents.nextAttemptAt, sql`now()`),
    );
  } else if (status === 'pending') {
    whereClause = and(
      isNull(outboxEvents.processedAt),
      isNull(outboxEvents.failedAt),
      sql`${outboxEvents.nextAttemptAt} > now()`,
    );
  } else if (status === 'processed') {
    whereClause = isNotNull(outboxEvents.processedAt);
  } else if (status === null) {
    whereClause = undefined;
  } else {
    throw new Error(
      `--status must be one of dlq|live|pending|processed (got: ${status})`,
    );
  }

  const baseQuery = db
    .select()
    .from(outboxEvents)
    .orderBy(desc(outboxEvents.createdAt))
    .limit(boundedLimit);

  const rows = whereClause !== undefined ? await baseQuery.where(whereClause) : await baseQuery;

  if (rows.length === 0) {
    console.log(`(no events matching filters: status=${status ?? '*'}, aggregate=${aggregateFlag ?? '*'})`);
    return;
  }

  const filtered =
    aggregateFlag !== null
      ? rows.filter((r) => r.aggregateType === aggregateFlag)
      : rows;

  if (filtered.length === 0) {
    console.log(
      `(no events with aggregate_type=${aggregateFlag} in the selected status set)`,
    );
    return;
  }

  console.log(
    `[outbox:inspect] ${filtered.length} event(s) — status=${status ?? 'all'}, aggregate=${
      aggregateFlag ?? '*'
    }, limit=${boundedLimit}`,
  );
  for (const row of filtered) {
    console.log(formatRow(row));
  }
}

async function recover(action: RecoveryAction, args: readonly string[]): Promise<void> {
  const { flags, positional } = parseFlags(args);
  const eventIdFlag = typeof flags['event-id'] === 'string' ? flags['event-id'] : null;
  const positionalEventId = positional.find(isUuid) ?? null;
  const eventId = eventIdFlag ?? positionalEventId;
  const all = flags.all === true;
  const reason =
    typeof flags.reason === 'string' && flags.reason.trim().length > 0
      ? flags.reason.trim()
      : null;

  if (!all && eventId === null) {
    throw new Error(
      `outbox:${action} requires either --event-id=<uuid> or --all (and a --reason)`,
    );
  }
  if (action === 'discard' && !all && reason === null) {
    throw new Error('outbox:discard requires --reason so the DLQ reason is auditable');
  }

  const nowIso = new Date().toISOString();

  if (all) {
    // Bulk recovery: target every event currently in the
    // DLQ. Used when a downstream (e.g. Resend, ranking
    // service) had a transient outage and the bulk of the
    // DLQ is recoverable in one shot. Bounded with a
    // hard ceiling so a runaway operation cannot pin the
    // database — an operator re-runs the command if more
    // events accumulated.
    const dlqClause = and(
      isNull(outboxEvents.processedAt),
      isNotNull(outboxEvents.failedAt),
      isNotNull(outboxEvents.dlqReason),
    );

    const candidates = await db
      .select({ eventId: outboxEvents.eventId })
      .from(outboxEvents)
      .where(dlqClause)
      .limit(500);

    if (candidates.length === 0) {
      console.log(`[outbox:${action}] no DLQ events to operate on`);
      return;
    }

    if (action === 'retry') {
      const result = await db
        .update(outboxEvents)
        .set({
          failedAt: null,
          dlqReason: null,
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          nextAttemptAt: nowIso,
        })
        .where(
          and(
            isNull(outboxEvents.processedAt),
            isNotNull(outboxEvents.failedAt),
            isNotNull(outboxEvents.dlqReason),
          ),
        )
        .returning({ eventId: outboxEvents.eventId });

      console.log(
        `[outbox:retry] re-queued ${result.length} DLQ event(s); the next processor tick will pick them up`,
      );
      return;
    }

    // action === 'discard' with --all
    const dlqReasonSuffix = reason !== null ? `:${reason}` : ':discarded_by_operator';
    const result = await db
      .update(outboxEvents)
      .set({
        // Keep `failedAt` as the original marker (it is
        // already set on DLQ rows) but overwrite
        // `dlqReason` with the operator-supplied reason
        // so future audits can distinguish
        // "discarded_by_operator" from
        // "exhausted_retries:...".
        dlqReason: sql`concat(${`discarded_by_operator${dlqReasonSuffix}`})`,
      })
      .where(dlqClause)
      .returning({ eventId: outboxEvents.eventId });

    console.log(`[outbox:discard] discarded ${result.length} DLQ event(s) with reason: ${reason}`);
    return;
  }

  // Single-event recovery.
  if (eventId === null) {
    // Unreachable in practice: the early return above
    // already rejected this case. The guard exists for
    // type narrowing only.
    throw new Error('outbox:recover: missing event-id (internal guard)');
  }
  if (!isUuid(eventId)) {
    throw new Error(`--event-id must be a UUID, got: ${eventId}`);
  }

  const existing = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.eventId, eventId))
    .limit(1);

  if (existing.length === 0) {
    throw new Error(`No outbox event found with event_id=${eventId}`);
  }

  const row = existing[0];
  if (row.processedAt !== null) {
    throw new Error(
      `Event ${eventId} is already processed at ${row.processedAt}; refusing to ${action}.`,
    );
  }

  if (action === 'retry') {
    await db
      .update(outboxEvents)
      .set({
        failedAt: null,
        dlqReason: null,
        lastError: null,
        attemptCount: 0,
        lastAttemptAt: null,
        nextAttemptAt: nowIso,
      })
      .where(eq(outboxEvents.eventId, eventId));

    console.log(
      `[outbox:retry] event ${eventId} (${row.aggregateType}:${row.eventType}) re-queued; the next processor tick will pick it up`,
    );
    return;
  }

  // action === 'discard' — record operator decision in
  // dlqReason. failedAt is already set on DLQ rows; we
  // leave it in place so the row's lifecycle marker
  // (processedAt / failedAt) remains the same.
  await db
    .update(outboxEvents)
    .set({
      dlqReason: `discarded_by_operator:${reason}`,
    })
    .where(eq(outboxEvents.eventId, eventId));

  console.log(
    `[outbox:discard] event ${eventId} (${row.aggregateType}:${row.eventType}) discarded with reason: ${reason}`,
  );
}

function usage(): void {
  console.log(`Usage:
  pnpm outbox:inspect [--event-id=<uuid>] [--status=<dlq|live|pending|processed>] [--aggregate=<name>] [--limit=<n>]
  pnpm outbox:retry   --event-id=<uuid>
  pnpm outbox:retry   --all
  pnpm outbox:discard --event-id=<uuid> --reason="<text>"
  pnpm outbox:discard --all [--reason="<text>"]

Subcommands:
  inspect   List or show outbox events. Defaults to the 50 most recent across all statuses.
  retry     Clear failedAt/dlqReason and reset attempt counters; the processor will re-attempt on its next tick.
            Targets a single event by default; pass --all to retry every DLQ event.
  discard   Mark an event as operator-rejected. Requires --reason so the DLQ reason is auditable.
            Targets a single event by default; pass --all to discard every DLQ event.

Environment:
  DATABASE_URL                       Postgres connection string (required).
  ALLOW_PROD_OUTBOX_OPERATIONS=true  Required to run in production.
  NODE_ENV=production                Implies the safety check above.
`);
}

async function main(): Promise<void> {
  // The literal union keeps the `case` switch exhaustive
  // for `inspect` / `retry` / `discard`. Help-style flags
  // (`help`, `--help`, `-h`) are handled explicitly below
  // before the switch.
  const subcommand = process.argv[2] as string | undefined;
  const subArgs = process.argv.slice(3);

  // DATABASE_URL is the only hard requirement for any
  // subcommand. The `requireEnv` helper throws a clear
  // error message on missing config.
  requireEnv('DATABASE_URL');
  refuseInProduction();

  switch (subcommand) {
    case 'inspect':
      await inspect(subArgs);
      return;
    case 'retry':
      await recover('retry', subArgs);
      return;
    case 'discard':
      await recover('discard', subArgs);
      return;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      usage();
      return;
    default:
      usage();
      throw new Error(`Unknown outbox subcommand: ${subcommand}`);
  }
}

main()
  .catch((error) => {
    console.error('[outbox] failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
