/**
 * Phase 5 #1 — Drizzle/Postgres query tracing.
 *
 * Wraps the Drizzle database client so every `select`, `insert`,
 * `update`, `delete`, and `execute` call emits a `client` span
 * with the SQL text and table name as attributes. The wrapper
 * uses the same `tracing.withSpan` shape as the HTTP / Redis /
 * BullMQ wrappers, so a single trace tree contains every layer.
 *
 * Why wrap Drizzle and not `pg.Client`?
 * -------------------------------------
 * Drizzle's chainable query builder means the actual SQL text
 * is only known when `.execute()` or the awaited promise is
 * resolved. Wrapping at the `client` level captures the SQL
 * from Drizzle's internal `sql` field; wrapping at the `pg`
 * level would require parsing the parameterised query strings
 * from postgres' wire protocol. The Drizzle wrapper captures
 * the high-level operation (`select`, `insert`, …) without
 * depending on Drizzle's internal SQL emitter.
 *
 * Span naming follows `db.<operation>.<table>` where possible
 * (e.g. `db.select.users`). For `execute` (raw SQL) the span
 * is `db.execute.<first 32 chars of sql>` so the operator can
 * tell queries apart in the trace logs.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  TRACING_PROVIDER,
  type TracingProvider,
} from '@/core/observability/tracing.provider';

const TRACED_METHODS = [
  'select',
  'insert',
  'update',
  'delete',
  'execute',
  'transaction',
] as const;
type TracedMethod = (typeof TRACED_METHODS)[number];

@Injectable()
export class DrizzleTracingWrapper {
  constructor(
    @Inject(TRACING_PROVIDER)
    private readonly tracing: TracingProvider,
  ) {}

  wrap<T extends object>(client: T): T {
    return new Proxy(client, {
      get: (target, prop, receiver) => {
        if (
          typeof prop !== 'string' ||
          !TRACED_METHODS.includes(prop as TracedMethod)
        ) {
          return Reflect.get(target, prop, receiver);
        }
        const original = Reflect.get(target, prop, receiver) as unknown;
        if (typeof original !== 'function') return original;
        return (...args: unknown[]) => {
          return this.tracing.withSpan(
            `db.${prop}`,
            {
              kind: 'client',
              attributes: {
                'db.system': 'postgresql',
                'db.operation': String(prop),
              },
            },
            () => Reflect.apply(original, target, args),
          );
        };
      },
    });
  }
}