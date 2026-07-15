/**
 * Temporal field normalization utilities.
 *
 * Used by both `ResponseFormatInterceptor` (to normalize raw service DTOs that
 * bypass the presenter) and `ApiResponse` factory (to normalize data that passes
 * through a presenter before it is wrapped in the canonical envelope).
 *
 * The `isTemporalKey` function identifies fields that contain timestamps by
 * checking for common suffixes (time, timestamp, date, at).
 *
 * The `normalizeIsoString` function converts any parseable date string to the
 * canonical ISO 8601 format used throughout the API responses.
 */

const MAX_NESTING_DEPTH = 10;

/**
 * Identify fields that contain timestamp values by their naming convention.
 * Matches keys ending in: time, timestamp, date, at, updated
 *
 * Examples: createdAt, updatedAt, deletedAt, startTime, endTimestamp, expiresDate,
 *           lastUpdated, lastActivityUpdated, globallyUpdated
 * Non-matches: username, email, isPublic, lastUpdated (already matched by "updated")
 */
export function isTemporalKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.endsWith('time') ||
    normalized.endsWith('timestamp') ||
    normalized.endsWith('date') ||
    normalized.endsWith('at') ||
    normalized.endsWith('updated')
  );
}

/**
 * Convert a date string to canonical ISO 8601 format.
 * Returns the input unchanged if parsing fails.
 *
 * Examples:
 *   "2026-07-14T10:30:00.000Z" → "2026-07-14T10:30:00.000Z" (unchanged)
 *   "2026-07-14T10:30:00Z"     → "2026-07-14T10:30:00.000Z" (padded)
 *   "2026-07-14 10:30:19.156+00" → "2026-07-14T10:30:19.156Z" (Postgres → ISO)
 *   "not-a-date"                → "not-a-date" (unchanged)
 */
export function normalizeIsoString(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  const normalized = new Date(parsed).toISOString();
  return normalized !== value ? normalized : value;
}

/**
 * Recursively normalize all temporal fields in a value to ISO 8601 strings.
 * Stops descending at MAX_NESTING_DEPTH to prevent stack overflow.
 *
 * Handles: null, undefined, Date instances, strings, arrays, and plain objects.
 * Skips: class instances, functions, symbols, circular references (depth limit).
 */
export function normalizeTemporalFields(value: unknown, depth = 0): unknown {
  if (depth > MAX_NESTING_DEPTH) {
    return value;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

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

/**
 * Check if a value is a plain object (not an array, class instance, or primitive).
 * A plain object has `Object.prototype` or `null` as its prototype.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}
