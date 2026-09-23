/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { OutboxProcessorService } from './outbox-processor.service';
import type { DrizzleDB } from '@/core/database/database.module';
import type { AuthSecurityNotificationPort } from '@/modules/notification/domain/ports/notification-ports';

function makeLogger(): any {
  return { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makeSelectChain(rows: unknown[]) {
  const chain: any = {};
  for (const m of ['from', 'where', 'orderBy']) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.for = jest.fn().mockResolvedValue(rows);
  return chain;
}

function makeUpdateChain() {
  const updateSetChain: any = {};
  updateSetChain.where = jest.fn().mockResolvedValue(undefined);
  const updateChain: any = {};
  updateChain.set = jest.fn().mockReturnValue(updateSetChain);
  return updateChain;
}

function makeDb(pending: unknown[]) {
  const selectChain = makeSelectChain(pending);
  const updateChain = makeUpdateChain();
  return {
    db: {
      select: jest.fn().mockReturnValue(selectChain),
      update: jest.fn().mockReturnValue(updateChain),
    },
  };
}

function makeAuthAuditLogService() {
  return {
    maxOutboxRetries: 3,
    buildNextAttemptIso: jest.fn().mockReturnValue(new Date().toISOString()),
    record: jest.fn().mockResolvedValue(undefined),
    purgeExpired: jest.fn().mockResolvedValue(0),
  };
}

function makeNotificationService(): AuthSecurityNotificationPort {
  return {
    notifyPasswordChanged: jest.fn().mockResolvedValue(undefined),
    notifyPasswordResetRequested: jest.fn().mockResolvedValue(undefined),
    notifyPasswordResetCompleted: jest.fn().mockResolvedValue(undefined),
    notifyAccountDeleted: jest.fn().mockResolvedValue(undefined),
    notifySessionRevoked: jest.fn().mockResolvedValue(undefined),
    notifyAllSessionsRevoked: jest.fn().mockResolvedValue(undefined),
    notifyOAuthLinked: jest.fn().mockResolvedValue(undefined),
    notifyOAuthUnlinked: jest.fn().mockResolvedValue(undefined),
  };
}

function makeProcessor(opts: {
  pending: ReadonlyArray<Record<string, unknown>>;
  auditLogService?: any;
  notificationService?: AuthSecurityNotificationPort;
}): OutboxProcessorService {
  const { db } = makeDb([...opts.pending]);
  return new OutboxProcessorService(
    db as unknown as DrizzleDB,
    opts.auditLogService ?? (makeAuthAuditLogService() as unknown as any),
    opts.notificationService ?? makeNotificationService(),
    makeLogger(),
  );
}

const baseRow = {
  eventId: 'ev-1',
  aggregateType: 'account',
  eventType: 'password_changed',
  payload: { userId: 'u-1' },
  createdAt: new Date().toISOString(),
  attemptCount: 0,
  idempotencyKey: 'auth:test',
  correlationId: 'corr-1',
};

describe('OutboxProcessorService (auth) — idempotency conflict', () => {
  it('marks processed without retrying when dispatch throws a unique-violation error', async () => {
    const auditLogService = makeAuthAuditLogService();
    auditLogService.record = jest.fn().mockImplementation(() => {
      throw new Error('duplicate key value violates unique constraint 23505');
    });
    const processor = makeProcessor({ pending: [baseRow], auditLogService });

    await processor.processPendingEvents();

    // Even on conflict, no DLQ alert should be raised because the row was processed.
    const logger = processor['logger'] as unknown as { info: jest.Mock };
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth_outbox_processor_completed',
        processedCount: 1,
        failedCount: 0,
      }),
    );
  });
});

describe('OutboxProcessorService (auth) — failure path', () => {
  it('retries on a non-conflict error', async () => {
    const auditLogService = makeAuthAuditLogService();
    auditLogService.record = jest.fn().mockRejectedValue(new Error('redis-down'));
    const processor = makeProcessor({
      pending: [{ ...baseRow, attemptCount: 0 }],
      auditLogService,
    });

    await processor.processPendingEvents();

    const logger = processor['logger'] as unknown as { info: jest.Mock };
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth_outbox_processor_completed',
        processedCount: 0,
        failedCount: 1,
      }),
    );
  });
});

describe('OutboxProcessorService (auth) — DLQ monitor', () => {
  it('logs a DLQ alert when poisoned rows exist', async () => {
    const plainChain: any = {};
    for (const m of ['from', 'where', 'orderBy']) {
      plainChain[m] = jest.fn().mockReturnValue(plainChain);
    }
    plainChain.limit = jest.fn().mockResolvedValue([
      { eventId: 'p-1', attemptCount: 9 },
      { eventId: 'p-2', attemptCount: 11 },
    ]);

    const db = {
      select: jest.fn().mockReturnValue(plainChain),
      update: jest.fn(),
    } as unknown as DrizzleDB;

    const processor = new OutboxProcessorService(
      db,
      makeAuthAuditLogService() as unknown as any,
      makeNotificationService(),
      makeLogger(),
    );

    await processor.monitorDeadLetterQueue();

    const logger = processor['logger'] as unknown as { error: jest.Mock };
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth_outbox_dlq_alert',
        totalDlqEvents: 2,
      }),
    );
  });
});
