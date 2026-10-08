/**
 * Outbox payload shape validation.
 *
 * Producers insert outbox rows from application code, and consumers
 * downstream (XP outbox processors, ranking/coin/achievement
 * dispatchers) trust the payload shape verbatim. A producer bug —
 * wrong field name, missing correlation id, mistyped amount — would
 * otherwise surface only when the consumer tries to use the field,
 * with a generic error message that obscures the root cause.
 *
 * These parsers run on the producer side immediately before the
 * insert. A failure throws a typed `OutboxPayloadValidationError`
 * so the producer transaction aborts with the same failure mode
 * as any other constraint violation. Processors that consume rows
 * use the same parsers to validate on read so the two layers never
 * disagree.
 */

export interface AttemptXpOutboxPayload {
  readonly userId: string;
  readonly attemptId: string;
  readonly amount: number;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly timestamp: string;
}

export interface DailyChallengeXpOutboxPayload {
  readonly userId: string;
  readonly challengeId: string;
  readonly amount: number;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly timestamp: string;
}

/**
 * Thrown when an outbox payload fails shape validation. The error
 * carries the field path so a producer bug is debuggable from the
 * stack trace alone.
 */
export class OutboxPayloadValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`outbox payload invalid at ${field}: ${message}`);
    this.name = 'OutboxPayloadValidationError';
    this.field = field;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new OutboxPayloadValidationError(field, `expected non-empty string, got ${typeof value}`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new OutboxPayloadValidationError(field, `expected finite number, got ${typeof value}`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new OutboxPayloadValidationError(
      field,
      `expected string when present, got ${typeof value}`,
    );
  }
  return value;
}

/**
 * Validate the shape of an `attempt.xp_to_publish` outbox payload.
 *
 * Producers must supply `userId`, `attemptId`, `amount`,
 * `idempotencyKey`, and `timestamp`; `correlationId` is optional
 * but must be a string when present. The returned value is the same
 * payload, narrowed to the canonical interface so callers can rely
 * on field presence without further checks.
 */
export function parseAttemptXpOutboxPayload(value: unknown): AttemptXpOutboxPayload {
  if (!isPlainObject(value)) {
    throw new OutboxPayloadValidationError('payload', 'must be a JSON object');
  }
  const userId = requireString(value['userId'], 'userId');
  const attemptId = requireString(value['attemptId'], 'attemptId');
  const amount = requireNumber(value['amount'], 'amount');
  const idempotencyKey = requireString(value['idempotencyKey'], 'idempotencyKey');
  const correlationId = optionalString(value['correlationId'], 'correlationId');
  const timestamp = requireString(value['timestamp'], 'timestamp');
  return { userId, attemptId, amount, idempotencyKey, correlationId, timestamp };
}

/**
 * Validate the shape of a `daily_challenge.xp_to_publish` outbox
 * payload. Same contract as the attempt variant, with
 * `challengeId` substituted for `attemptId`.
 */
export function parseDailyChallengeXpOutboxPayload(value: unknown): DailyChallengeXpOutboxPayload {
  if (!isPlainObject(value)) {
    throw new OutboxPayloadValidationError('payload', 'must be a JSON object');
  }
  const userId = requireString(value['userId'], 'userId');
  const challengeId = requireString(value['challengeId'], 'challengeId');
  const amount = requireNumber(value['amount'], 'amount');
  const idempotencyKey = requireString(value['idempotencyKey'], 'idempotencyKey');
  const correlationId = optionalString(value['correlationId'], 'correlationId');
  const timestamp = requireString(value['timestamp'], 'timestamp');
  return { userId, challengeId, amount, idempotencyKey, correlationId, timestamp };
}
