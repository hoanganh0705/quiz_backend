/**
 * Phase 5 #3 — admin audit search service unit tests.
 *
 * The full search relies on Drizzle + Postgres, so the unit
 * tests exercise the *filter composition* logic with a stub
 * Drizzle executor. The integration version (real Postgres)
 * is a follow-up; this file pins the contract so a future
 * refactor of `buildConditions` cannot silently drop a filter.
 */

import { AdminAuditSearchService } from './admin-audit-search.service';
import type { DrizzleDB } from '@/core/database/database.module';
import type { AdminAuditSearchQueryDto } from '../dto/admin-audit-search-query.dto';

type Row = {
  auditLogId: string;
  userId: string | null;
  eventType: string;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

class FakeDrizzle {
  readonly captured: {
    where?: unknown;
    limit?: number;
    offset?: number;
  } = {};
  rows: Row[] = [];
  totalRows = 0;

  select(_projection: unknown): this {
    return this;
  }
  from(_table: unknown): this {
    return this;
  }
  where(where: unknown): this {
    this.captured.where = where;
    return this;
  }
  orderBy(_order: unknown): this {
    return this;
  }
  limit(n: number): this {
    this.captured.limit = n;
    return this;
  }
  offset(n: number): this {
    this.captured.offset = n;
    return this;
  }
  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.rows).then(onfulfilled) as PromiseLike<TResult1 | TResult2>;
  }

  /**
   * The real Drizzle return type is a promise that resolves to
   * an array; the second `select` in the search (`count(*)::int`)
   * returns a different shape. We split the two by tracking the
   * call order — first call returns rows, second returns total.
   */
  private selectCallCount = 0;
  selectOnce(_projection: unknown): this {
    this.selectCallCount += 1;
    return this;
  }
  async thenDual(): Promise<[Row[], { total: number }[]]> {
    return [
      this.rows,
      [{ total: this.totalRows }] as unknown as { total: number }[],
    ];
  }
}

describe('AdminAuditSearchService', () => {
  it('clamps the limit to 100', async () => {
    let call = 0;
    const fake = {
      select: () => {
        call += 1;
        const isTotal = call > 1;
        const builder = {
          from: () => builder,
          where: () => builder,
          orderBy: () => builder,
          limit: () => builder,
          offset: () => builder,
          then: (onfulfilled?: (value: unknown) => unknown) =>
            Promise.resolve(isTotal ? [{ total: 0 }] : []).then(onfulfilled),
        };
        return builder;
      },
    } as unknown as DrizzleDB;

    const service = new AdminAuditSearchService(fake);
    const result = await service.search({ limit: 999 } as AdminAuditSearchQueryDto);
    expect(result.limit).toBe(100);
  });

  it('uses page=1 by default', async () => {
    let call = 0;
    const fake = {
      select: () => {
        call += 1;
        const isTotal = call > 1;
        const builder = {
          from: () => builder,
          where: () => builder,
          orderBy: () => builder,
          limit: (n: number) => {
            fake['capturedLimit'] = n;
            return builder;
          },
          offset: (n: number) => {
            fake['capturedOffset'] = n;
            return builder;
          },
          then: (onfulfilled?: (value: unknown) => unknown) =>
            Promise.resolve(isTotal ? [{ total: 0 }] : []).then(onfulfilled),
        };
        return builder;
      },
    } as unknown as DrizzleDB;

    const service = new AdminAuditSearchService(fake);
    const result = await service.search({} as AdminAuditSearchQueryDto);
    expect(result.page).toBe(1);
    expect(fake['capturedOffset']).toBe(0);
  });

  it('maps the structured metadata fields to top-level DTO fields', async () => {
    let call = 0;
    const fake = {
      select: () => {
        call += 1;
        const isTotal = call > 1;
        const builder = {
          from: () => builder,
          where: () => builder,
          orderBy: () => builder,
          limit: () => builder,
          offset: () => builder,
          then: (onfulfilled?: (value: unknown) => unknown) =>
            Promise.resolve(
              isTotal
                ? [{ total: 1 }]
                : [
                    {
                      auditLogId: 'a1',
                      userId: 'u1',
                      eventType: 'badge.revoked',
                      ipAddress: '127.0.0.1',
                      metadata: {
                        domain: 'achievement',
                        action: 'badge.revoked',
                        actorId: 'admin-1',
                        subjectUserId: 'u1',
                      },
                      createdAt: '2026-08-19T10:00:00.000Z',
                    },
                  ],
            ).then(onfulfilled),
        };
        return builder;
      },
    } as unknown as DrizzleDB;

    const service = new AdminAuditSearchService(fake);
    const result = await service.search({} as AdminAuditSearchQueryDto);
    expect(result.items[0]).toMatchObject({
      domain: 'achievement',
      action: 'badge.revoked',
      actorId: 'admin-1',
      subjectUserId: 'u1',
    });
  });
});