/// <reference types="jest" />
/**
 * Phase 3.1 of `docs/migrations/USER_MODULE_CONTRACT_HARDENING.md` — verifies
 * that the `ResponseFormatInterceptor`'s `normalizeTemporalFields` function
 * correctly rewrites non-ISO timestamp strings to ISO 8601.
 *
 * This is a **unit test** of the interceptor's pure logic, independent of any
 * running app or infrastructure. The actual normalization functions are imported
 * from the shared utility `temporal-normalizer.util.ts`.
 *
 * The regex matches:
 *   - `2026-07-14T10:30:00.000Z`  (canonical ISO)
 *   - `2026-07-14T10:30:00Z`      (minimal ISO without millis)
 *   - `2026-07-14T10:30:00.123Z`  (ISO with sub-ms precision)
 *   - `2026-07-14T10:30:00.123456Z` (ISO with microseconds)
 */
import {
  isTemporalKey,
  normalizeIsoString,
  normalizeTemporalFields,
} from '../utils/temporal-normalizer.util';

describe('normalizeTemporalFields — shared utility (Phase 3.1)', () => {
  const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,})?Z$/;

  // ── isTemporalKey ─────────────────────────────────────────────────────────

  describe('isTemporalKey', () => {
    it.each([
      ['createdAt', true],
      ['updatedAt', true],
      ['completedAt', true],
      ['deletedAt', true],
      ['startTime', true],
      ['endTime', true],
      ['startTimestamp', true],
      ['startDate', true],
      ['expiresAt', true],
      ['followedAt', true],
      // Case-insensitive
      ['CreatedAt', true],
      ['CREATEDAT', true],
      ['isPublic', false],
      ['lastUpdated', true], // ends with "updated"
      ['tagName', false],
    ])('%s → %s', (key, expected) => {
      expect(isTemporalKey(key)).toBe(expected);
    });
  });

  // ── normalizeIsoString ────────────────────────────────────────────────────

  describe('normalizeIsoString', () => {
    it('passes through a canonical ISO string unchanged', () => {
      const input = '2026-07-14T10:30:00.000Z';
      expect(normalizeIsoString(input)).toBe(input);
    });

    it('normalizes a minimal ISO string without millis to 3-digit milliseconds', () => {
      // JS Date always normalizes to exactly 3-digit ms in toISOString()
      const input = '2026-07-14T10:30:00Z';
      expect(normalizeIsoString(input)).toBe('2026-07-14T10:30:00.000Z');
    });

    it('normalizes a valid ISO string with sub-millisecond precision to 3 digits', () => {
      // JS Date truncates to milliseconds (not rounds) and pads to 3 digits
      const input = '2026-07-14T10:30:00.123456Z';
      expect(normalizeIsoString(input)).toBe('2026-07-14T10:30:00.123Z');
    });

    it('normalizes a Postgres-style timestamp with space and offset', () => {
      const input = '2026-07-14 10:30:19.156551+00';
      expect(normalizeIsoString(input)).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('normalizes a timestamp with space and no timezone', () => {
      const input = '2026-07-14 10:30:19.156551';
      expect(normalizeIsoString(input)).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('returns input unchanged for an unparseable string', () => {
      expect(normalizeIsoString('not-a-timestamp')).toBe('not-a-timestamp');
    });

    it('returns input unchanged for an empty string', () => {
      expect(normalizeIsoString('')).toBe('');
    });
  });

  // ── normalizeTemporalFields ──────────────────────────────────────────────

  describe('normalizeTemporalFields', () => {
    it('leaves a null value as-is', () => {
      expect(normalizeTemporalFields(null)).toBeNull();
    });

    it('leaves an undefined value as-is', () => {
      expect(normalizeTemporalFields(undefined)).toBeUndefined();
    });

    it('leaves a plain string as-is', () => {
      expect(normalizeTemporalFields('hello')).toBe('hello');
    });

    it('converts a Date instance to ISO string', () => {
      const date = new Date('2026-07-14T10:30:00.000Z');
      expect(normalizeTemporalFields(date)).toBe('2026-07-14T10:30:00.000Z');
    });

    it('rewrites createdAt with Postgres format to ISO', () => {
      const input = { createdAt: '2026-07-14 10:30:19.156551+00' };
      const result = normalizeTemporalFields(input) as Record<string, unknown>;
      expect(result.createdAt).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('rewrites updatedAt with Postgres format to ISO', () => {
      const input = { updatedAt: '2026-07-14 10:30:19.156551+00' };
      const result = normalizeTemporalFields(input) as Record<string, unknown>;
      expect(result.updatedAt).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('rewrites followedAt with Postgres format to ISO', () => {
      const input = { followedAt: '2026-07-14 10:30:19.156551+00' };
      const result = normalizeTemporalFields(input) as Record<string, unknown>;
      expect(result.followedAt).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('passes through non-temporal fields unchanged', () => {
      const input = {
        tagId: '550e8400-e29b-71d4-a716-446655440000',
        name: 'JavaScript',
        slug: 'javascript',
        xpTotal: 15420,
        isPublic: true,
      };
      expect(normalizeTemporalFields(input)).toEqual(input);
    });

    it('normalizes all temporal fields in a mixed object', () => {
      const input = {
        tagId: '550e8400-e29b-71d4-a716-446655440000',
        createdAt: '2026-07-14 10:30:19.156551+00',
        updatedAt: '2026-01-01 00:00:00+00',
        name: 'JavaScript',
      };
      const result = normalizeTemporalFields(input) as Record<string, unknown>;
      expect(result.tagId).toBe('550e8400-e29b-71d4-a716-446655440000');
      expect(result.name).toBe('JavaScript');
      expect(result.createdAt).toMatch(ISO_TIMESTAMP_REGEX);
      expect(result.updatedAt).toMatch(ISO_TIMESTAMP_REGEX);
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
      const result = normalizeTemporalFields(input) as Record<string, unknown>;
      const outer = result.outer as Record<string, unknown>;
      const inner = outer.inner as Record<string, unknown>;
      expect(outer.createdAt).toMatch(ISO_TIMESTAMP_REGEX);
      expect(inner.updatedAt).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('normalizes temporal fields in arrays', () => {
      const input = {
        items: [
          { tagId: '1', createdAt: '2026-07-14 10:30:19.156551+00' },
          { tagId: '2', createdAt: '2026-01-01 00:00:00+00' },
        ],
      };
      const result = normalizeTemporalFields(input) as Record<string, unknown>;
      const items = result.items as Array<Record<string, unknown>>;
      expect(items[0].createdAt).toMatch(ISO_TIMESTAMP_REGEX);
      expect(items[1].createdAt).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('does NOT rewrite non-temporal keys that happen to contain dates', () => {
      const input = {
        // lastUpdated: ends with "updated" → SHOULD be normalized
        lastActivity: '2026-07-14 10:30:19.156551+00', // ends with "ty", not matched
        tagName: '2026-07-14 10:30:19.156551+00', // ends with "me", not matched
      };
      const result = normalizeTemporalFields(input) as Record<string, unknown>;
      // lastUpdated should be normalized (ends with "updated")
      expect(result.lastActivity).toBe('2026-07-14 10:30:19.156551+00');
      expect(result.tagName).toBe('2026-07-14 10:30:19.156551+00');
    });

    it('stops normalizing at MAX_NESTING_DEPTH to prevent stack overflow', () => {
      const obj: Record<string, unknown> = {};
      let current = obj;
      for (let i = 0; i < 15; i++) {
        current.nested = { createdAt: '2026-07-14 10:30:19.156551+00' };
        current = current.nested as Record<string, unknown>;
      }
      const result = normalizeTemporalFields(obj) as Record<string, unknown>;
      let deepest = result;
      for (let i = 0; i < 15; i++) {
        deepest = deepest.nested as Record<string, unknown>;
      }
      // Deepest level (depth 14) should NOT be normalized — depth exceeded
      expect(deepest.createdAt).toBe('2026-07-14 10:30:19.156551+00');
    });

    it('already-canonical ISO strings are passed through unchanged', () => {
      const input = {
        createdAt: '2026-07-14T10:30:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const result = normalizeTemporalFields(input) as Record<string, unknown>;
      expect(result.createdAt).toBe('2026-07-14T10:30:00.000Z');
      expect(result.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });
});
