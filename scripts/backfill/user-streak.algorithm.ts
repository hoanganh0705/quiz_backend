/**
 * Pure algorithm for `user-streak` backfill (§3.2).
 *
 * This module is intentionally framework-free: no DB, no logger, no
 * side effects. It takes the user's full set of distinct completion
 * days (in UTC) and a reference "today" and returns the trio the
 * script writes via §3.1 SQL.
 *
 * Splitting the algorithm from the I/O lets us:
 *   1. Unit-test every §7.1 case (including the 1,000-day Concern 1
 *      regression test) in milliseconds with no test DB.
 *   2. Re-use the same algorithm in any future "compute streak from
 *      raw attempt data" caller without dragging in Drizzle.
 *
 * The algorithm mirrors §3.2 verbatim — see `docs/plans/user-streak-system.md`.
 */

/**
 * A UTC calendar day. Serialized as `YYYY-MM-DD` so it round-trips
 * through Postgres `DATE` columns, the `pg` driver's date parser,
 * and JS `Date` constructors (which always treat a `YYYY-MM-DD`
 * string as UTC-midnight). Avoid the JS `Date` object's
 * `getUTCDate()` arithmetic — the day arithmetic below operates on
 * the `YYYY-MM-DD` string directly so a host timezone never leaks in.
 */
export type UtcDayString = string;

/**
 * The trio the backfill writes into `users`.
 *
 * `currentStreak` and `longestStreak` are non-negative integers
 * (`int >= 0` enforced by `users_streak_nonneg`).
 * `lastStreakDay` is null when the user has no completed attempts;
 * otherwise it equals the supplied `today`.
 */
export interface StreakTrio {
  currentStreak: number;
  longestStreak: number;
  lastStreakDay: UtcDayString | null;
}

/**
 * The user-supplied input to the algorithm.
 *
 * `days` is the full set of distinct UTC days on which the user has
 * at least one `quiz_attempts` row with `status = 'completed'` —
 * ordered descending (most recent first). Per §3.2 there is **no**
 * LIMIT: a user's longest streak ever may be years in the past, so
 * truncating the result would silently under-report `longest_streak`.
 *
 * `today` is the reference day. Per §3.2 the script computes
 * `(now() AT TIME ZONE 'UTC')::date` itself rather than trusting
 * `new Date().toISOString().slice(0, 10)` — both should agree, but
 * the SQL cast is the source of truth and is what we mirror here.
 */
export interface BackfillInput {
  days: readonly UtcDayString[];
  today: UtcDayString;
}

/**
 * Subtract `n` days from a `YYYY-MM-DD` string.
 *
 * Implements calendar-day arithmetic correctly across month/year
 * boundaries (e.g. `2024-03-01 - 1 day = 2024-02-29`). We use the
 * `Date` constructor with a UTC anchor (`T00:00:00Z`) so the host
 * timezone never leaks in, then format back to `YYYY-MM-DD`.
 *
 * Why not `Date.setUTCDate(d.getUTCDate() - n)`? That works, but
 * constructing a fresh `Date` for each call is a few-microsecond
 * operation in V8 — well within the §3.2 "few-microsecond walk"
 * budget for D up to ~1,500.
 */
export function utcDaySubtract(day: UtcDayString, n: number): UtcDayString {
  // `Date.UTC(...)` returns ms-since-epoch in UTC; passing it to
  // `new Date(...)` yields a Date whose getUTC* methods return
  // UTC components regardless of host tz. The `T00:00:00Z` suffix
  // in the input string already pins the input to UTC midnight.
  const anchor = new Date(`${day}T00:00:00Z`);
  const prevMs = anchor.getTime() - n * 24 * 60 * 60 * 1000;
  const prev = new Date(prevMs);
  const yyyy = prev.getUTCFullYear();
  const mm = String(prev.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(prev.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Normalise an arbitrary date input (Date object, ISO string, or
 * already-formatted `YYYY-MM-DD`) to a canonical `YYYY-MM-DD` UTC
 * day string. The backfill itself fetches `days` from SQL which
 * already returns `YYYY-MM-DD` strings via `::date` casts, but the
 * unit tests (and any future in-process caller) need a robust
 * normaliser.
 *
 * The input must unambiguously point to a UTC instant. Anything
 * with a timezone offset (`...+07:00`) is rejected: a backfill that
 * silently re-bases to UTC will produce the wrong day boundary.
 */
export function toUtcDayString(input: Date | string): UtcDayString {
  if (typeof input === 'string') {
    // Already in canonical form?
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    // Must be a UTC-anchored ISO string ending in `Z`. Offsets like
    // `+07:00` are rejected because re-basing to UTC silently changes
    // the calendar day in any host east/west of UTC — a backfill that
    // does this would under/over-report the streak boundary.
    if (!/Z$/.test(input)) {
      throw new Error(
        `toUtcDayString: string input must be a UTC-anchored ISO string ending in 'Z' (got: ${input})`,
      );
    }
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`toUtcDayString: invalid date string: ${input}`);
    }
    return formatUtcDay(d);
  }
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new Error('toUtcDayString: invalid Date');
    }
    return formatUtcDay(input);
  }
  throw new Error(`toUtcDayString: unsupported input type: ${typeof input}`);
}

function formatUtcDay(d: Date): UtcDayString {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Compute the `current_streak` for the supplied `today` given the
 * user's full set of distinct completion days.
 *
 * Per §3.2:
 *   current := 0
 *   cursor  := today
 *   while days.contains(cursor):
 *       current := current + 1
 *       cursor  := cursor - INTERVAL '1 day'
 *
 * We model "days contains cursor" as a `Set<UtcDayString>` lookup
 * which is O(1) per probe. The walk is `O(current_streak)` — at
 * most a few hundred iterations even for a five-year-active user.
 *
 * `days` need not be sorted; the algorithm reads them as a set. The
 * caller passes them pre-sorted only as a documentation hint.
 */
export function computeCurrentStreak(days: readonly UtcDayString[], today: UtcDayString): number {
  const set = new Set<UtcDayString>(days);
  let current = 0;
  let cursor = today;
  while (set.has(cursor)) {
    current += 1;
    cursor = utcDaySubtract(cursor, 1);
  }
  return current;
}

/**
 * Compute the `longest_streak` for the user's full set of distinct
 * completion days.
 *
 * Per §3.2:
 *   longest := 0
 *   prev    := NULL
 *   run     := 0
 *   for d in days ordered DESC:           -- single pass
 *       if prev IS NULL OR d = prev - INTERVAL '1 day':
 *           run := run + 1
 *       else:
 *           run := 1
 *       longest := max(longest, run)
 *       prev := d
 *
 * The caller is responsible for supplying `days` in **descending**
 * order. The backfill script does this in SQL
 * (`ORDER BY 1 DESC`); the algorithm itself does not re-sort
 * because the unit tests should mirror the production data shape.
 *
 * Returns `0` for an empty `days` array — a user with no completed
 * attempts has `longest_streak = 0` (the DB default), not `1`.
 */
export function computeLongestStreak(days: readonly UtcDayString[]): number {
  let longest = 0;
  let prev: UtcDayString | null = null;
  let run = 0;
  for (const d of days) {
    if (prev === null || d === utcDaySubtract(prev, 1)) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = d;
  }
  return longest;
}

/**
 * Compute the full trio from a backfill input.
 *
 * Per §3.2 the trio is:
 *   - `current_streak`  — the live streak ending today.
 *   - `longest_streak`  — the all-time longest streak in the user's
 *                         full history.
 *   - `last_streak_day` — `today` when `current_streak > 0`,
 *                         otherwise `NULL`.
 *
 * The `last_streak_day` semantics are: "the most recent UTC day on
 * which the user has at least one completed attempt." If the
 * current streak is `0`, the user has not completed an attempt
 * today (or yesterday, etc.), so `last_streak_day` is null — the
 * hot-path SQL's `GREATEST(u.last_streak_day, $day::date)` will
 * set it on the next completion.
 *
 * `current_streak` and `longest_streak` are not clamped against the
 * supplied `prev` cache — the script writes whatever the recompute
 * produces. The §3.1 SQL's `IS DISTINCT FROM` guard means a
 * backfill that produces identical values writes zero rows
 * (idempotency, see §6.3). Re-runs are safe.
 */
export function computeBackfillTrio(input: BackfillInput): StreakTrio {
  const { days, today } = input;
  const currentStreak = computeCurrentStreak(days, today);
  const longestStreak = computeLongestStreak(days);
  const lastStreakDay = currentStreak > 0 ? today : null;
  return { currentStreak, longestStreak, lastStreakDay };
}
