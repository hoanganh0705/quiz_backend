import { AdminAuditSearchService } from './admin-audit-search.service';
import type { DrizzleDB } from '@/core/database/database.module';
import type { AdminAuditSearchQueryDto } from '../dto/admin-audit-search-query.dto';

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
