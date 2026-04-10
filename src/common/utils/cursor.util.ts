import { BadRequestException } from '@nestjs/common';

export const decodeBase64JsonCursor = <T>(cursor: string): Partial<T> => {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(decoded) as Partial<T>;
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
};

export const encodeBase64JsonCursor = (payload: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

export const isIsoDateString = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

export const isStringMatchingPattern = (value: unknown, pattern: RegExp): value is string =>
  typeof value === 'string' && pattern.test(value);
