/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import type { PinoLogger } from 'nestjs-pino';
import { PasswordResetEmailHandler } from './password-reset.handler';
import type { EmailJobContext } from './email-job.handler';
import { EMAIL_JOB_NAMES } from '../email.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import type { EmailConfig, PasswordResetConfig } from '@/core/config';
import type { EmailResilienceRunner } from '../resilience/email-resilience.runner';

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn(async () => ({ data: { id: 'mock-email-id' }, error: null })),
      },
    })),
  };
});

const makeLogger = (): PinoLogger =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  }) as unknown as PinoLogger;

const makeEmailConfig = (): EmailConfig =>
  ({
    provider: 'resend',
    fromAddress: 'noreply@example.com',
    fromName: 'Acme',
    resendApiKey: 're_test_key',
    sendTimeoutMs: 5_000,
    queueConcurrency: 5,
    circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 30_000 },
  }) as EmailConfig;

const makePasswordResetConfig = (
  overrides: Partial<PasswordResetConfig> = {},
): PasswordResetConfig =>
  ({
    tokenTtlSeconds: 3_600,
    baseUrl: 'https://example.com/reset-password',
    ...overrides,
  }) as PasswordResetConfig;

interface DbMock {
  db: DrizzleDB;
  select: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
}

const makeDb = (rows: ReadonlyArray<Record<string, unknown>>): DbMock => {
  const select = jest.fn();
  const from = jest.fn();
  const where = jest.fn();
  const orderBy = jest.fn();
  const limit = jest.fn();
  limit.mockResolvedValue(rows);
  orderBy.mockReturnValue({ limit });
  where.mockReturnValue({ orderBy });
  from.mockReturnValue({ where });
  select.mockReturnValue({ from });

  const db = { select } as unknown as DrizzleDB;

  return { db, select, from, where, orderBy, limit };
};

const makeResilience = (
  overrides: {
    runWithResilience?: jest.Mock;
    getCircuitState?: () => 'closed' | 'open' | 'half-open';
  } = {},
) => {
  const runner = {
    runWithResilience:
      overrides.runWithResilience ??
      jest.fn(async <T>(build: (signal: AbortSignal) => Promise<T>) =>
        build(new AbortController().signal),
      ),
    getCircuitState: overrides.getCircuitState ?? jest.fn(() => 'closed' as const),
  };
  return runner as unknown as EmailResilienceRunner & {
    runWithResilience: jest.Mock;
    getCircuitState: jest.Mock;
  };
};

const makeContext = (): EmailJobContext => ({
  jobId: 'job-1',
  correlationId: 'corr-1',
  logger: makeLogger(),
});

describe('PasswordResetEmailHandler', () => {
  const makeHandler = (opts: {
    db: DrizzleDB;
    resilience?: ReturnType<typeof makeResilience>;
    passwordResetConfig?: PasswordResetConfig;
  }) => {
    const resilience = opts.resilience ?? makeResilience();
    const passwordReset = opts.passwordResetConfig ?? makePasswordResetConfig();
    const handlerLogger = makeLogger();
    const handler = new PasswordResetEmailHandler(
      opts.db,
      makeEmailConfig(),
      passwordReset,
      resilience,
      handlerLogger,
    );
    return { handler, resilience, handlerLogger };
  };

  it('sends the password reset email when the token row is active', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const { db } = makeDb([{ usedAt: null, revokedAt: null, expiresAt: future }]);
    const { handler, resilience } = makeHandler({ db });

    await handler.process(
      { email: 'user@example.com', token: 'reset-tok', userId: 'user-1' },
      makeContext(),
    );

    expect(resilience.runWithResilience).toHaveBeenCalledTimes(1);
  });

  it('does nothing and warns when the token row is missing', async () => {
    const { db } = makeDb([]);
    const { handler, resilience, handlerLogger } = makeHandler({ db });

    await handler.process(
      { email: 'user@example.com', token: 'no-such-token', userId: 'user-1' },
      makeContext(),
    );

    expect(resilience.runWithResilience).not.toHaveBeenCalled();
    expect(handlerLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'email_password_reset_token_missing' }),
    );
  });

  it('does nothing and logs inactive when the token has been revoked', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const { db } = makeDb([
      { usedAt: null, revokedAt: new Date().toISOString(), expiresAt: future },
    ]);
    const { handler, resilience, handlerLogger } = makeHandler({ db });

    await handler.process(
      { email: 'user@example.com', token: 't', userId: 'user-1' },
      makeContext(),
    );

    expect(resilience.runWithResilience).not.toHaveBeenCalled();
    expect(handlerLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'email_password_reset_skipped_inactive',
        reason: 'token_revoked_or_expired',
      }),
    );
  });

  it('does nothing and logs inactive when the token has expired', async () => {
    const past = new Date(Date.now() - 1_000).toISOString();
    const { db } = makeDb([{ usedAt: null, revokedAt: null, expiresAt: past }]);
    const { handler, resilience, handlerLogger } = makeHandler({ db });

    await handler.process(
      { email: 'user@example.com', token: 't', userId: 'user-1' },
      makeContext(),
    );

    expect(resilience.runWithResilience).not.toHaveBeenCalled();
    expect(handlerLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'email_password_reset_skipped_inactive' }),
    );
  });

  it('classifies the timeout error on provider failure', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const { db } = makeDb([{ usedAt: null, revokedAt: null, expiresAt: future }]);
    const resilience = makeResilience({
      runWithResilience: jest.fn(async () => {
        throw new Error('Email sending timed out after 5000ms');
      }),
    });
    const { handler, handlerLogger } = makeHandler({ db, resilience });

    await expect(
      handler.process({ email: 'user@example.com', token: 't', userId: 'user-1' }, makeContext()),
    ).rejects.toThrow(/timed out/);

    expect(handlerLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'email_send_password_reset_error',
        errorCode: 'timeout',
      }),
    );
  });

  it('throws when constructed without a Resend API key', () => {
    expect(
      () =>
        new PasswordResetEmailHandler(
          makeDb([]).db,
          { ...makeEmailConfig(), resendApiKey: '' },
          makePasswordResetConfig(),
          makeResilience(),
          makeLogger(),
        ),
    ).toThrow(/required configuration/);
  });

  it('exposes the correct jobName', () => {
    const { handler } = makeHandler({ db: makeDb([]).db });
    expect(handler.jobName).toBe(EMAIL_JOB_NAMES.SEND_PASSWORD_RESET_EMAIL);
  });
});
