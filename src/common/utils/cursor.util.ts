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

/**
 * Phase 2 (audit issue 2.4): strict cursor parser for the
 * `GET /api/v1/instances` list endpoint.
 *
 * The cursor is a base64url-encoded JSON `{ createdAt: string, instanceId: string }`.
 * Any missing/typed-wrong key surfaces as `400 BadRequestException` so a
 * tampered cursor can't feed `undefined` into the SQL cursor comparison.
 *
 * Phase 4 (audit issue 2.9): the list cursor is now base64url-encoded
 * (aligned with the rest of the codebase). For backward compatibility
 * the decoder accepts both `base64` and `base64url` — base64url is a
 * subset of base64, so Node's permissive `'base64'` decoder handles
 * both. Existing clients keep working.
 */
export function decodeInstanceCursor(cursor: string): { createdAt: string; instanceId: string } {
  let decoded: unknown;
  try {
    // `'base64'` is intentional: it accepts both base64 and base64url
    // strings on Node.js ≥ 14, so the upgrade to base64url encoding
    // is wire-compatible.
    decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  } catch {
    throw new BadRequestException('Invalid cursor');
  }

  if (decoded === null || typeof decoded !== 'object') {
    throw new BadRequestException('Invalid cursor');
  }

  const record = decoded as Record<string, unknown>;
  if (typeof record.createdAt !== 'string' || typeof record.instanceId !== 'string') {
    throw new BadRequestException('Invalid cursor');
  }

  return { createdAt: record.createdAt, instanceId: record.instanceId };
}

/**
 * Phase 2 (audit issue 2.4 — leaderboard variant): strict cursor parser for
 * `GET /api/v1/instances/{id}/leaderboard`. The cursor is a base64url-encoded
 * JSON `{ rank: number, instancePlayerId: string }`.
 */
export function decodeLeaderboardCursor(cursor: string): {
  rank: number;
  instancePlayerId: string;
} {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
  } catch {
    throw new BadRequestException('Invalid cursor');
  }

  if (decoded === null || typeof decoded !== 'object') {
    throw new BadRequestException('Invalid cursor');
  }

  const record = decoded as Record<string, unknown>;
  if (typeof record.rank !== 'number' || typeof record.instancePlayerId !== 'string') {
    throw new BadRequestException('Invalid cursor');
  }

  return { rank: record.rank, instancePlayerId: record.instancePlayerId };
}
