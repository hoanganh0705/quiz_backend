/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import type { PinoLogger } from 'nestjs-pino';
import { VerificationEmailHandler } from './verification.handler';
import type { EmailJobContext } from './email-job.handler';
import { EMAIL_JOB_NAMES } from '../email.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import type { EmailConfig, EmailVerificationConfig } from '@/core/config';
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

const makeEmailVerificationConfig = (
  overrides: Partial<EmailVerificationConfig> = {},
): EmailVerificationConfig =>
  ({
    tokenTtlSeconds: 3_600,
    baseUrl: 'https://example.com/verify-email',
    ...overrides,
  }) as EmailVerificationConfig;

interface DbMock {
  db: DrizzleDB;
  txInsert: jest.Mock;
  txValues: jest.Mock;
  txOnConflict: jest.Mock;
  txReturning: jest.Mock;
  txSelect: jest.Mock;
  txFrom: jest.Mock;
  txWhere: jest.Mock;
  txLimit: jest.Mock;
  txDelete: jest.Mock;
  txSql: jest.Mock;
  topDelete: jest.Mock;
  topWhere: jest.Mock;
}

const makeDb = (claim: 'first' | 'duplicate'): DbMock => {
  const txInsert = jest.fn();
  const txValues = jest.fn();
  const txOnConflict = jest.fn();
  const txReturning = jest.fn();
  const txSelect = jest.fn();
  const txFrom = jest.fn();
  const txWhere = jest.fn();
  const txLimit = jest.fn();
  const txDelete = jest.fn();
  const txSql = jest.fn();
  const topDelete = jest.fn();
  const topWhere = jest.fn();

  const terminalReturn =
    claim === 'first'
      ? [{ sentTokenId: 'sent-1', sentAt: new Date('2026-01-01').toISOString() }]
      : [];

  txInsert.mockImplementation(() => ({
    values: txValues.mockImplementation(() => ({
      onConflictDoNothing: txOnConflict.mockImplementation(() => ({
        returning: txReturning.mockResolvedValue(terminalReturn),
      })),
    })),
  }));
  txSelect.mockImplementation(() => ({
    from: txFrom.mockImplementation(() => ({
      where: txWhere.mockImplementation(() => ({
        limit: txLimit.mockResolvedValue([{ sentAt: new Date('2026-01-01').toISOString() }]),
      })),
    })),
  }));
  txDelete.mockImplementation(() => ({
    where: topWhere.mockReturnThis(),
  }));
  topDelete.mockReturnValue({ where: topWhere.mockReturnThis() });
  txSql.mockReturnValue({});

  const transaction = jest.fn(async (work: (tx: unknown) => Promise<unknown>) =>
    work({
      insert: txInsert,
      select: txSelect,
      delete: txDelete,
    }),
  );

  const db = {
    transaction,
    delete: topDelete,
  } as unknown as DrizzleDB;

  return {
    db,
    txInsert,
    txValues,
    txOnConflict,
    txReturning,
    txSelect,
    txFrom,
    txWhere,
    txLimit,
    txDelete,
    txSql,
    topDelete,
    topWhere,
  };
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

describe('VerificationEmailHandler', () => {
  const makeHandler = (opts: {
    db: DrizzleDB;
    resilience?: ReturnType<typeof makeResilience>;
    verificationConfig?: EmailVerificationConfig;
  }) => {
    const resilience = opts.resilience ?? makeResilience();
    const verification = opts.verificationConfig ?? makeEmailVerificationConfig();
    const handlerLogger = makeLogger();
    const handler = new VerificationEmailHandler(
      opts.db,
      makeEmailConfig(),
      verification,
      resilience,
      handlerLogger,
    );
    return { handler, resilience, handlerLogger };
  };

  it('sends the verification email when the token is claimed for the first time', async () => {
    const { db } = makeDb('first');
    const { handler, resilience } = makeHandler({ db });

    await handler.process(
      { email: 'user@example.com', token: 'token-abc', userId: 'user-1' },
      makeContext(),
    );

    expect(resilience.runWithResilience).toHaveBeenCalledTimes(1);
  });

  it('skips the send and logs duplicate when the token was already claimed', async () => {
    const { db } = makeDb('duplicate');
    const { handler, resilience, handlerLogger } = makeHandler({ db });
    const ctx = makeContext();

    await handler.process({ email: 'user@example.com', token: 'dup-token' }, ctx);

    expect(resilience.runWithResilience).not.toHaveBeenCalled();
    expect(handlerLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'email_send_verification_skipped_duplicate',
        reason: 'token_already_sent',
      }),
    );
  });

  it('deletes the claim and logs a classified timeout error', async () => {
    const mocks = makeDb('first');
    const resilience = makeResilience({
      runWithResilience: jest.fn(async () => {
        throw new Error('Email sending timed out after 5000ms');
      }),
    });
    const { handler, handlerLogger } = makeHandler({ db: mocks.db, resilience });
    const ctx = makeContext();

    await expect(
      handler.process({ email: 'user@example.com', token: 't', userId: 'u-1' }, ctx),
    ).rejects.toThrow(/timed out/);

    expect(mocks.topDelete).toHaveBeenCalledTimes(1);
    expect(mocks.topWhere).toHaveBeenCalledTimes(1);
    expect(handlerLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'email_send_verification_error',
        errorCode: 'timeout',
      }),
    );
  });

  it('classifies CircuitOpenError as errorCode=circuit_open', async () => {
    const { db } = makeDb('first');
    const resilience = makeResilience({
      runWithResilience: jest.fn(async () => {
        const e = new Error('cool-down');
        e.name = 'CircuitOpenError';
        throw e;
      }),
    });
    const { handler, handlerLogger } = makeHandler({ db, resilience });
    const ctx = makeContext();

    await expect(handler.process({ email: 'user@example.com', token: 't' }, ctx)).rejects.toThrow();

    expect(handlerLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'circuit_open' }),
    );
  });

  it('classifies unrecognised errors as errorCode=provider_error', async () => {
    const { db } = makeDb('first');
    const resilience = makeResilience({
      runWithResilience: jest.fn(async () => {
        throw new Error('something else');
      }),
    });
    const { handler, handlerLogger } = makeHandler({ db, resilience });
    const ctx = makeContext();

    await expect(handler.process({ email: 'user@example.com', token: 't' }, ctx)).rejects.toThrow();

    expect(handlerLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'provider_error' }),
    );
  });

  it('throws when constructed without a Resend API key', () => {
    expect(
      () =>
        new VerificationEmailHandler(
          makeDb('first').db,
          { ...makeEmailConfig(), resendApiKey: '' },
          makeEmailVerificationConfig(),
          makeResilience(),
          makeLogger(),
        ),
    ).toThrow(/required configuration/);
  });

  it('exposes the correct jobName', () => {
    const { handler } = makeHandler({ db: makeDb('first').db });
    expect(handler.jobName).toBe(EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL);
  });

  it('does not delete the claim on the happy path', async () => {
    const mocks = makeDb('first');
    const { handler } = makeHandler({ db: mocks.db });
    await handler.process({ email: 'user@example.com', token: 't', userId: 'u-1' }, makeContext());
    expect(mocks.topDelete).not.toHaveBeenCalled();
  });
});
