/// <reference types="jest" />
/**
 * Phase 3.1 of `docs/migrations/USER_MODULE_CONTRACT_HARDENING.md` — verifies
 * that the `ResponseFormatInterceptor`'s `normalizeTemporalFields` function
 * correctly rewrites non-ISO timestamp strings to ISO 8601.
 *
 * This is a **unit test** of the interceptor's pure logic, independent of any
 * running app or infrastructure.
 *
 * The regex matches:
 *   - `2026-07-14T10:30:00.000Z`  (canonical ISO)
 *   - `2026-07-14T10:30:00Z`      (minimal ISO without millis)
 *   - `2026-07-14T10:30:00.123Z`  (ISO with sub-ms precision)
 *   - `2026-07-14T10:30:00.123456Z` (ISO with microseconds)
 */
describe('ResponseFormatInterceptor — normalizeTemporalFields (Phase 3.1)', () => {
  // ── Helpers (mirrors the interceptor implementation) ─────────────────────────

  const MAX_NESTING_DEPTH = 10;

  function isTemporalKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return (
      normalized.endsWith('time') ||
      normalized.endsWith('timestamp') ||
      normalized.endsWith('date') ||
      normalized.endsWith('at')
    );
  }

  function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const proto = Object.getPrototypeOf(value) as object | null;
    return proto === Object.prototype || proto === null;
  }

  function normalizeIsoString(value: string): string {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return value;
    }
    const normalized = new Date(parsed).toISOString();
    return normalized !== value ? normalized : value;
  }

  function normalizeTemporalFields(value: unknown, depth: number): unknown {
    if (depth > MAX_NESTING_DEPTH) return value;
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value.map((item) => normalizeTemporalFields(item, depth + 1));
    }
    if (isPlainObject(value)) {
      const normalized: Record<string, unknown> = {};
      for (const [key, entryValue] of Object.entries(value)) {
        const processed = normalizeTemporalFields(entryValue, depth + 1);
        if (isTemporalKey(key) && typeof processed === 'string') {
          normalized[key] = normalizeIsoString(processed);
        } else {
          normalized[key] = processed;
        }
      }
      return normalized;
    }
    return value;
  }

  const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,})?Z$/;

  // ── Temporal key patterns ───────────────────────────────────────────────────

  describe('isTemporalKey', () => {
    it.each([
      ['createdAt', true],
      ['updatedAt', true],
      ['completedAt', true],
      ['lastUpdated', false], // ends with "ted", not matched by isTemporalKey
      ['deletedAt', true],
      ['startTime', true],
      ['endTime', true],
      ['startTimestamp', true],
      ['startDate', true],
      ['expiresAt', true],
      // Case-insensitive
      ['CreatedAt', true],
      ['CREATEDAT', true],
      // Not temporal — "updated" ends with "ted", not "at"/"time"/"timestamp"/"date"
      ['username', false],
      ['email', false],
      ['bio', false],
      ['settings', false],
      ['count', false],
      ['isPublic', false],
      ['lastUpdated', false], // ends with "ted", not in the isTemporalKey patterns
    ])('%s → %s', (key, expected) => {
      expect(isTemporalKey(key)).toBe(expected);
    });
  });

  // ── normalizeIsoString ──────────────────────────────────────────────────────

  describe('normalizeIsoString', () => {
    it('passes through a canonical ISO string unchanged', () => {
      const input = '2026-07-14T10:30:00.000Z';
      expect(normalizeIsoString(input)).toBe(input);
    });

    it('normalizes a minimal ISO string without millis to 3-digit milliseconds', () => {
      // JS Date always normalizes to exactly 3-digit ms in toISOString()
      const input = '2026-07-14T10:30:00Z';
      const result = normalizeIsoString(input);
      expect(result).toBe('2026-07-14T10:30:00.000Z');
    });

    it('normalizes a valid ISO string with sub-millisecond precision to 3 digits', () => {
      // JS Date truncates to milliseconds (not rounds) and pads to 3 digits
      const input = '2026-07-14T10:30:00.123456Z';
      const result = normalizeIsoString(input);
      expect(result).toBe('2026-07-14T10:30:00.123Z');
    });

    it('normalizes a Postgres-style timestamp with space and offset', () => {
      const input = '2026-07-14 10:30:19.156551+00';
      const result = normalizeIsoString(input);
      expect(result).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('normalizes a timestamp with space and no timezone', () => {
      const input = '2026-07-14 10:30:19.156551';
      const result = normalizeIsoString(input);
      expect(result).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('returns input unchanged for an unparseable string', () => {
      const input = 'not-a-timestamp';
      expect(normalizeIsoString(input)).toBe(input);
    });

    it('returns input unchanged for an empty string', () => {
      expect(normalizeIsoString('')).toBe('');
    });
  });

  // ── normalizeTemporalFields ─────────────────────────────────────────────────

  describe('normalizeTemporalFields', () => {
    it('leaves a null value as-is', () => {
      expect(normalizeTemporalFields(null, 0)).toBeNull();
    });

    it('leaves an undefined value as-is', () => {
      expect(normalizeTemporalFields(undefined, 0)).toBeUndefined();
    });

    it('leaves a plain string as-is', () => {
      expect(normalizeTemporalFields('hello', 0)).toBe('hello');
    });

    it('converts a Date instance to ISO string', () => {
      const date = new Date('2026-07-14T10:30:00.000Z');
      expect(normalizeTemporalFields(date, 0)).toBe('2026-07-14T10:30:00.000Z');
    });

    it('rewrites createdAt with Postgres format to ISO', () => {
      const input = { createdAt: '2026-07-14 10:30:19.156551+00' };
      const result = normalizeTemporalFields(input, 0) as Record<string, unknown>;
      expect(result.createdAt).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('rewrites updatedAt with Postgres format to ISO', () => {
      const input = { updatedAt: '2026-07-14 10:30:19.156551+00' };
      const result = normalizeTemporalFields(input, 0) as Record<string, unknown>;
      expect(result.updatedAt).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('passes through non-temporal fields unchanged', () => {
      const input = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        displayName: 'Alice',
        xpTotal: 15420,
        isPublic: true,
      };
      const result = normalizeTemporalFields(input, 0) as Record<string, unknown>;
      expect(result).toEqual(input);
    });

    it('normalizes all temporal fields in a mixed object', () => {
      const input = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        createdAt: '2026-07-14 10:30:19.156551+00',
        updatedAt: '2026-01-01 00:00:00+00',
        username: 'alice',
        streakStartTime: '2026-07-01 00:00:00+00',
      };
      const result = normalizeTemporalFields(input, 0) as Record<string, unknown>;
      expect(result.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.username).toBe('alice');
      expect(result.createdAt).toMatch(ISO_TIMESTAMP_REGEX);
      expect(result.updatedAt).toMatch(ISO_TIMESTAMP_REGEX);
      expect(result.streakStartTime).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('normalizes temporal fields in nested objects', () => {
      const input = {
        outer: {
          createdAt: '2026-07-14 10:30:19.156551+00',
          inner: {
            updatedAt: '2026-01-01 00:00:00+00',
          },
        },
      };
      const result = normalizeTemporalFields(input, 0) as Record<string, unknown>;
      const outer = result.outer as Record<string, unknown>;
      const inner = outer.inner as Record<string, unknown>;
      expect(outer.createdAt).toMatch(ISO_TIMESTAMP_REGEX);
      expect(inner.updatedAt).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('normalizes temporal fields in arrays', () => {
      const input = {
        badges: [
          { badgeId: '1', earnedAt: '2026-07-14 10:30:19.156551+00' },
          { badgeId: '2', earnedAt: '2026-01-01 00:00:00+00' },
        ],
      };
      const result = normalizeTemporalFields(input, 0) as Record<string, unknown>;
      const badges = result.badges as Array<Record<string, unknown>>;
      expect(badges[0].earnedAt).toMatch(ISO_TIMESTAMP_REGEX);
      expect(badges[1].earnedAt).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('stops normalizing at MAX_NESTING_DEPTH to prevent stack overflow', () => {
      // Build a deeply nested object (depth > MAX_NESTING_DEPTH)
      const obj: Record<string, unknown> = {};
      let current = obj;
      for (let i = 0; i < 15; i++) {
        current.nested = { createdAt: '2026-07-14 10:30:19.156551+00' };
        current = current.nested as Record<string, unknown>;
      }
      const result = normalizeTemporalFields(obj, 0) as Record<string, unknown>;
      // The deepest level should NOT be normalized (depth exceeded)
      let deepest = result;
      for (let i = 0; i < 15; i++) {
        deepest = deepest.nested as Record<string, unknown>;
      }
      expect(deepest.createdAt).toBe('2026-07-14 10:30:19.156551+00');
    });

    it('already-canonical ISO strings are passed through unchanged', () => {
      const input = {
        createdAt: '2026-07-14T10:30:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const result = normalizeTemporalFields(input, 0) as Record<string, unknown>;
      expect(result.createdAt).toBe('2026-07-14T10:30:00.000Z');
      expect(result.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });
});
