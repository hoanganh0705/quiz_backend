import {
  OutboxPayloadValidationError,
  parseAttemptXpOutboxPayload,
  parseDailyChallengeXpOutboxPayload,
} from './payload-schema';

describe('parseAttemptXpOutboxPayload', () => {
  const valid = {
    userId: 'u-1',
    attemptId: 'a-1',
    amount: 50,
    idempotencyKey: 'xp:u-1:attempt:a-1',
    correlationId: 'corr-1',
    timestamp: '2026-01-01T00:00:00.000Z',
  };

  it('returns the canonical payload when every required field is present', () => {
    const parsed = parseAttemptXpOutboxPayload(valid);
    expect(parsed).toEqual(valid);
  });

  it('treats correlationId as optional when omitted', () => {
    const { correlationId: _correlationId, ...rest } = valid;
    void _correlationId;
    const parsed = parseAttemptXpOutboxPayload(rest);
    expect(parsed.correlationId).toBeUndefined();
  });

  it.each([
    ['userId', { ...valid, userId: '' }],
    ['userId', { ...valid, userId: 42 }],
    ['attemptId', { ...valid, attemptId: null }],
    ['amount', { ...valid, amount: 'fifty' }],
    ['amount', { ...valid, amount: NaN }],
    ['idempotencyKey', { ...valid, idempotencyKey: undefined }],
    ['timestamp', { ...valid, timestamp: '' }],
  ])('throws OutboxPayloadValidationError at field "%s"', (_label, input) => {
    expect(() => parseAttemptXpOutboxPayload(input)).toThrow(OutboxPayloadValidationError);
  });

  it('throws when the payload itself is not a plain object', () => {
    expect(() => parseAttemptXpOutboxPayload(null)).toThrow(OutboxPayloadValidationError);
    expect(() => parseAttemptXpOutboxPayload('not-an-object')).toThrow(
      OutboxPayloadValidationError,
    );
    expect(() => parseAttemptXpOutboxPayload(['array', 'not', 'object'])).toThrow(
      OutboxPayloadValidationError,
    );
  });

  it('rejects correlationId of the wrong type', () => {
    expect(() => parseAttemptXpOutboxPayload({ ...valid, correlationId: 123 })).toThrow(
      OutboxPayloadValidationError,
    );
  });

  it('carries the failing field on the thrown error', () => {
    try {
      parseAttemptXpOutboxPayload({ ...valid, userId: '' });
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(OutboxPayloadValidationError);
      expect((error as OutboxPayloadValidationError).field).toBe('userId');
    }
  });
});

describe('parseDailyChallengeXpOutboxPayload', () => {
  const valid = {
    userId: 'u-1',
    challengeId: 'c-1',
    amount: 100,
    idempotencyKey: 'xp:u-1:daily_challenge:c-1',
    correlationId: 'corr-1',
    timestamp: '2026-01-01T00:00:00.000Z',
  };

  it('returns the canonical payload when every required field is present', () => {
    const parsed = parseDailyChallengeXpOutboxPayload(valid);
    expect(parsed).toEqual(valid);
  });

  it('throws when challengeId is missing', () => {
    const { challengeId: _challengeId, ...rest } = valid;
    void _challengeId;
    expect(() => parseDailyChallengeXpOutboxPayload(rest)).toThrow(OutboxPayloadValidationError);
  });

  it('throws when amount is not a finite number', () => {
    expect(() => parseDailyChallengeXpOutboxPayload({ ...valid, amount: 'oops' })).toThrow(
      OutboxPayloadValidationError,
    );
  });

  it('rejects correlationId of the wrong type', () => {
    expect(() =>
      parseDailyChallengeXpOutboxPayload({ ...valid, correlationId: { id: 'x' } }),
    ).toThrow(OutboxPayloadValidationError);
  });
});
