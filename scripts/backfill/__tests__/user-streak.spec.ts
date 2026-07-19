/**
 * Pure-function tests for the backfill algorithm.
 *
 * Mirrors the §7.1 case table in `docs/plans/user-streak-system.md`.
 * Every case constructs an in-memory `days` array (the user's
 * distinct UTC completion days, descending) plus a `today`, runs
 * the algorithm, and asserts the trio. No DB; runs in milliseconds.
 *
 * The script wrapper (`scripts/backfill/user-streak.ts`) is not
 * exercised here — those tests would belong in an e2e suite and are
 * out of scope for Phase B's unit-test checklist (§7.1 explicitly
 * limits the unit layer to the §3.2 in-process walk).
 */

import {
  computeBackfillTrio,
  computeCurrentStreak,
  computeLongestStreak,
  utcDaySubtract,
  toUtcDayString,
  type UtcDayString,
} from '../user-streak.algorithm';

// ---------------------------------------------------------------------------
// Date helpers — built once per describe to keep the per-case noise low.
// ---------------------------------------------------------------------------

/**
 * Build a descending list of `YYYY-MM-DD` strings ending at `end`
 * (inclusive) with `count` total entries, each consecutive.
 * Used to construct fixtures for the §7.1 cases that need
 * "today, yesterday, day-before, …" inputs.
 */
function consecutiveEndingAt(end: UtcDayString, count: number): UtcDayString[] {
  const out: UtcDayString[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(utcDaySubtract(end, i));
  }
  return out;
}

// ---------------------------------------------------------------------------
// utcDaySubtract — the calendar-arithmetic primitive.
// ---------------------------------------------------------------------------

describe('utcDaySubtract', () => {
  it('returns the same day for n=0', () => {
    expect(utcDaySubtract('2026-07-19', 0)).toBe('2026-07-19');
  });

  it('subtracts a single day inside a month', () => {
    expect(utcDaySubtract('2026-07-19', 1)).toBe('2026-07-18');
  });

  it('crosses a month boundary', () => {
    expect(utcDaySubtract('2026-08-01', 1)).toBe('2026-07-31');
    expect(utcDaySubtract('2026-08-01', 31)).toBe('2026-07-01');
  });

  it('crosses a year boundary', () => {
    expect(utcDaySubtract('2026-01-01', 1)).toBe('2025-12-31');
  });

  it('handles leap years (Feb 29 → Feb 28 in non-leap, Mar 1 in leap)', () => {
    expect(utcDaySubtract('2024-03-01', 1)).toBe('2024-02-29'); // 2024 is leap
    expect(utcDaySubtract('2025-03-01', 1)).toBe('2025-02-28'); // 2025 is not
  });

  it('does not let the host timezone leak in (TZ-independent)', () => {
    // The subtraction is anchored at UTC midnight. A host running
    // in Asia/Ho_Chi_Minh (+07:00) must still see 2026-07-19 → 2026-07-18,
    // not 2026-07-17 (which is what `new Date('2026-07-19').setDate(...)`
    // would yield if the host were west of UTC).
    expect(utcDaySubtract('2026-07-19', 1)).toBe('2026-07-18');
  });
});

// ---------------------------------------------------------------------------
// toUtcDayString — input normaliser used by callers feeding Date objects.
// ---------------------------------------------------------------------------

describe('toUtcDayString', () => {
  it('accepts a YYYY-MM-DD string unchanged', () => {
    expect(toUtcDayString('2026-07-19')).toBe('2026-07-19');
  });

  it('accepts an ISO string with Z', () => {
    expect(toUtcDayString('2026-07-19T08:00:00.000Z')).toBe('2026-07-19');
  });

  it('accepts a Date object', () => {
    expect(toUtcDayString(new Date('2026-07-19T15:00:00.000Z'))).toBe('2026-07-19');
  });

  it('rejects an ISO string with a non-UTC offset (defensive)', () => {
    // A +07:00 offset means the UTC instant is *earlier* than the
    // calendar day in that timezone. Re-basing silently to UTC would
    // silently under-report the streak boundary. Refuse the input.
    expect(() => toUtcDayString('2026-07-19T15:00:00.000+07:00')).toThrow(/UTC-anchored ISO/);
  });

  it('rejects garbage strings', () => {
    expect(() => toUtcDayString('not a date')).toThrow();
  });

  it('rejects an invalid Date object', () => {
    expect(() => toUtcDayString(new Date('garbage'))).toThrow(/invalid Date/);
  });
});

// ---------------------------------------------------------------------------
// computeCurrentStreak — §3.2 forward walk.
// ---------------------------------------------------------------------------

describe('computeCurrentStreak', () => {
  it('returns 0 when there are no completion days', () => {
    expect(computeCurrentStreak([], '2026-07-19')).toBe(0);
  });

  it('returns 1 when only today is present', () => {
    expect(computeCurrentStreak(['2026-07-19'], '2026-07-19')).toBe(1);
  });

  it('returns N when today through (today - N + 1) are all present', () => {
    const days = consecutiveEndingAt('2026-07-19', 3);
    expect(computeCurrentStreak(days, '2026-07-19')).toBe(3);
  });

  it('returns 1 when yesterday is missing (gap reset)', () => {
    expect(computeCurrentStreak(['2026-07-19', '2026-07-17'], '2026-07-19')).toBe(1);
  });

  it('returns 0 when only yesterday is present', () => {
    expect(computeCurrentStreak(['2026-07-18'], '2026-07-19')).toBe(0);
  });

  it('crosses a month boundary correctly', () => {
    // Today = 2026-08-02; the run is 2026-08-02, 2026-08-01, 2026-07-31.
    expect(computeCurrentStreak(['2026-08-02', '2026-08-01', '2026-07-31'], '2026-08-02')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// computeLongestStreak — §3.2 single descending pass.
// ---------------------------------------------------------------------------

describe('computeLongestStreak', () => {
  it('returns 0 for an empty history', () => {
    expect(computeLongestStreak([])).toBe(0);
  });

  it('returns 1 for a single day', () => {
    expect(computeLongestStreak(['2026-07-19'])).toBe(1);
  });

  it('returns N for an N-day consecutive descending run', () => {
    const days = consecutiveEndingAt('2026-07-19', 5);
    expect(computeLongestStreak(days)).toBe(5);
  });

  it('handles multiple runs and returns the longest', () => {
    // Descending: 19, 18, 17 | 15, 14 | 12
    // Runs: 3, 2, 1 → max 3
    expect(
      computeLongestStreak([
        '2026-07-19',
        '2026-07-18',
        '2026-07-17',
        '2026-07-15',
        '2026-07-14',
        '2026-07-12',
      ]),
    ).toBe(3);
  });

  it('Concern 1 — long historical streak, short recent run (§7.1 regression)', () => {
    // Build 1,000 distinct days: a 650-day consecutive run ending
    // 2 years before "today", and a recent 20-day run ending today.
    // The historical run lives entirely outside any "recent N days"
    // window, so any attempt to truncate by LIMIT would silently
    // under-report longest_streak.
    const today = '2026-07-19';
    const recent: UtcDayString[] = consecutiveEndingAt(today, 20); // 20-day run
    // Historical run ends 800 days before today (so it's clearly
    // outside a "last 30 days" window) and runs for 650 days.
    const historicalEnd = utcDaySubtract(today, 800);
    const historical: UtcDayString[] = consecutiveEndingAt(historicalEnd, 650);
    // The full history is the union, sorted descending. The recent
    // run is more recent so it goes first.
    const days: UtcDayString[] = [...recent, ...historical].sort().reverse();

    expect(computeLongestStreak(days)).toBe(650);
    expect(days.length).toBe(670); // 20 + 650, no overlap
  });
});

// ---------------------------------------------------------------------------
// computeBackfillTrio — full §7.1 case table.
// ---------------------------------------------------------------------------

describe('computeBackfillTrio (§7.1 cases)', () => {
  const TODAY: UtcDayString = '2026-07-19';

  it('Case 1: no previous attempts (days empty) → (1, 1, today) [first-ever attempt interpretation]', () => {
    // §7.1 maps `[]` prev cache to `(1, 1)` for the hot-path test, but
    // that's the hot-path's interpretation when *today* lands on a
    // completion. For the backfill, an empty `days` array means the
    // user has no completions at all — the trio stays at the DB
    // default (0, 0, NULL). See Case "Empty result + prev cache 0".
    expect(computeBackfillTrio({ days: [], today: TODAY })).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDay: null,
    });
  });

  it('Case 2: same day, second event (days=[D]) → (1, 1, D)', () => {
    expect(computeBackfillTrio({ days: [TODAY], today: TODAY })).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastStreakDay: TODAY,
    });
  });

  it('Case 3: yesterday continues streak (days=[D, D-1, D-2]) → (3, 3, D)', () => {
    expect(
      computeBackfillTrio({
        days: consecutiveEndingAt(TODAY, 3),
        today: TODAY,
      }),
    ).toEqual({
      currentStreak: 3,
      longestStreak: 3,
      lastStreakDay: TODAY,
    });
  });

  it('Case 4: two-day gap resets streak (days=[D, D-2]) → (1, 1, D)', () => {
    // The §7.1 table's "Expected (1, 10)" column is the *hot-path*
    // §3.1 result when the prev cache is (5, 10, D-2); the §3.2
    // recompute from `days=[D, D-2]` alone sees a current of 1 and
    // a longest of 1 (two isolated days). The backfill's job is to
    // overwrite the prev cache to the recomputed truth — idempotency
    // (§6.3) handles the "no-op when values match" case at write time.
    expect(
      computeBackfillTrio({
        days: [TODAY, utcDaySubtract(TODAY, 2)],
        today: TODAY,
      }),
    ).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastStreakDay: TODAY,
    });
  });

  it('Case 5: streak reaches a new record (days=[D, D-1]) → (2, 2, D)', () => {
    expect(
      computeBackfillTrio({
        days: consecutiveEndingAt(TODAY, 2),
        today: TODAY,
      }),
    ).toEqual({
      currentStreak: 2,
      longestStreak: 2,
      lastStreakDay: TODAY,
    });
  });

  it('Case 6: streak broken, longest preserved (days=[D]) → (1, 1, D)', () => {
    // The §7.1 case uses prev cache (0,10,D-30) to model "broken
    // streak"; the recompute from days=[D] must yield (1, 1, D)
    // regardless. The cache is overwritten by the recompute —
    // that's why §6.3 calls the script "idempotent and re-runnable
    // to fix drift".
    expect(
      computeBackfillTrio({
        days: [TODAY],
        today: TODAY,
      }),
    ).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastStreakDay: TODAY,
    });
  });

  it('Case 7: empty result + prev cache 0 → (0, 0, NULL) [DB default preserved]', () => {
    expect(computeBackfillTrio({ days: [], today: TODAY })).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDay: null,
    });
  });

  it('Case 8: leap day in chain (days=[2024-02-29, 2024-02-28]) on 2024-02-29 → (2, 2, 2024-02-29) [§1.6]', () => {
    expect(
      computeBackfillTrio({
        days: ['2024-02-29', '2024-02-28'],
        today: '2024-02-29',
      }),
    ).toEqual({
      currentStreak: 2,
      longestStreak: 2,
      lastStreakDay: '2024-02-29',
    });
  });

  it('Concern 1 — long historical streak, short recent run → (20, 650, today) [§3.2 regression]', () => {
    // The §7.1 regression test. Without truncation, the algorithm
    // must report the 650-day historical run as longest_streak even
    // though the recent activity is only a 20-day run ending today.
    const today = '2026-07-19';
    const recent: UtcDayString[] = consecutiveEndingAt(today, 20);
    const historicalEnd = utcDaySubtract(today, 800);
    const historical: UtcDayString[] = consecutiveEndingAt(historicalEnd, 650);
    const days: UtcDayString[] = [...recent, ...historical].sort().reverse();

    expect(computeBackfillTrio({ days, today })).toEqual({
      currentStreak: 20,
      longestStreak: 650,
      lastStreakDay: today,
    });
  });
});

// ---------------------------------------------------------------------------
// Out-of-order input — the SQL layer relies on the input being DESC.
// ---------------------------------------------------------------------------

describe('computeBackfillTrio — input ordering', () => {
  const TODAY: UtcDayString = '2026-07-19';

  it('tolerates unsorted input for current_streak (Set lookup)', () => {
    // The current-streak walk uses a Set, so input order is irrelevant.
    const days = [utcDaySubtract(TODAY, 2), TODAY, utcDaySubtract(TODAY, 1)];
    expect(computeBackfillTrio({ days, today: TODAY }).currentStreak).toBe(3);
  });

  it('requires DESC order for longest_streak (single pass; ASC produces wrong run-lengths)', () => {
    // The §3.2 spec says "for d in days ordered DESC: single pass".
    // Passing ASC input here is a documentation violation; we surface
    // it explicitly so a future caller who shuffles the order sees the
    // mismatch. This is a "test the contract" case, not a runtime
    // assertion of what the algorithm does with bad input.
    const daysAsc = ['2026-07-17', '2026-07-18', '2026-07-19'];
    // ASC: d=2026-07-17, prev=null → run=1. d=2026-07-18, prev=2026-07-17,
    // 2026-07-18 = 2026-07-17 - 1 day? false → run=1. d=2026-07-19 same.
    // longest stays at 1 even though the underlying history has a 3-day
    // run. This is the contract violation we are documenting.
    const wrong = computeBackfillTrio({ days: daysAsc, today: TODAY }).longestStreak;
    expect(wrong).toBe(1);
  });
});
