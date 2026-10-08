import { randomUUID } from 'node:crypto';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const CORRELATION_ID_MAX_LENGTH = 64;
const CORRELATION_ID_ALLOWED_CHAR_PATTERN = /^[A-Za-z0-9-]+$/;

export const isValidCorrelationId = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  if (value.length === 0) return false;
  if (value.length > CORRELATION_ID_MAX_LENGTH) return false;
  return CORRELATION_ID_ALLOWED_CHAR_PATTERN.test(value);
};

export const sanitizeCorrelationId = (
  raw: string | undefined,
  fallback: () => string = () => randomUUID(),
): string => {
  return isValidCorrelationId(raw) ? raw : fallback();
};

export { CORRELATION_ID_HEADER, CORRELATION_ID_MAX_LENGTH };
